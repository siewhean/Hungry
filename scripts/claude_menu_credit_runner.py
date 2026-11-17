#!/usr/bin/env python3
"""Run prepared menu reviews via the synchronous Claude API with a shared credit ledger."""

import argparse
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from contextlib import closing
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import fcntl
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
from tempfile import NamedTemporaryFile
from threading import Event
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener

from claude_menu_reconciliation import (
    API_VERSION, AuditError, NoRedirect, api_key, classify_result, decode, digest,
    encode, load_plan, valid_record,
)

API_ROOT = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-5-5"
# Standard Claude API, USD 2/10 per million tokens, expressed as microdollars.
INPUT_RATE = 2
OUTPUT_RATE = 10
OUTPUT_LIMIT = 1200
RESPONSE_LIMIT = 2 * 1024 * 1024
MAX_BUDGET = 99_000_000
MAX_WORKERS = 24
SCOPE_INSTRUCTION = """
Compare the outlet independently of channel. Equivalent printed unit ranges
such as #03-35/40 and #03-35 to #03-40 can identify the same outlet when the
business, address and postal also agree. An exact delivery listing cannot
confer branch or counter scope on a separate brand menu. A disclaimer that
pricing may vary is not same-channel evidence. For price MATCH or MISMATCH,
the cited excerpts must establish that the price itself applies to the exact
outlet and channel. Use INSUFFICIENT when that link is missing.
"""


class ProviderError(AuditError):
    def __init__(self, code):
        self.code = code
        super().__init__(f"Claude HTTP {code}" if code is not None else "Claude request did not complete")


def utc_now():
    return datetime.now(timezone.utc)


def timestamp(value):
    date = datetime.fromisoformat(value)
    if date.utcoffset() is None:
        raise ValueError("Deadline requires an explicit offset or Z")
    return date.astimezone(timezone.utc)


def amount(value):
    number = Decimal(value)
    if not number.is_finite() or not 0 < number <= 99:
        raise ValueError("Budget must be positive and at most USD 99")
    micros = number * 1_000_000
    if micros != micros.to_integral_value():
        raise ValueError("Budget allows at most six decimal places")
    return int(micros)


def usd(micros):
    return f"{Decimal(micros) / 1_000_000:.6f}"


def call_api(key, suffix, params, deadline):
    remaining = (deadline - utc_now()).total_seconds()
    if remaining <= 1:
        raise ProviderError(None)
    request = Request(
        API_ROOT + suffix, data=encode(params), method="POST",
        headers={
            "anthropic-version": API_VERSION,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with build_opener(NoRedirect).open(request, timeout=min(90, remaining)) as response:
            payload = response.read(RESPONSE_LIMIT + 1)
        if len(payload) > RESPONSE_LIMIT:
            raise ValueError("Response too large")
        result = decode(payload)
        if not isinstance(result, dict):
            raise ValueError("Invalid response envelope")
        return result
    except HTTPError as error:
        raise ProviderError(error.code) from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise ProviderError(None) from None


def connect(path):
    db = sqlite3.connect(path, timeout=30, isolation_level=None)
    db.execute("pragma synchronous=FULL")
    return db


def configure(db, budget, deadline):
    db.executescript("""
        create table if not exists config (
            id integer primary key check (id=1),
            budget integer not null,
            deadline text not null,
            policy text not null,
            frozen_reason text
        );
        create table if not exists reviews (
            master_sha text not null,
            record_id text not null,
            custom_id text not null,
            request_sha text not null,
            reserved integer not null,
            actual integer,
            status text not null,
            result text,
            primary key (master_sha, record_id)
        );
    """)
    policy = f"{API_VERSION}:{MODEL}:{INPUT_RATE}:{OUTPUT_RATE}:{OUTPUT_LIMIT}"
    params = (budget, deadline.isoformat(), policy)
    db.execute("insert or ignore into config values (1, ?, ?, ?, null)", params)
    stored = db.execute("select budget, deadline, policy, frozen_reason from config").fetchone()
    if tuple(stored[:3]) != params:
        raise AuditError("Use the ledger's original budget, deadline and runner price policy.")
    if stored[3]:
        raise AuditError(f"Ledger is frozen: {stored[3]}. Review the provider usage before proceeding.")


def stats(db):
    budget, deadline, _, reason = db.execute(
        "select budget, deadline, policy, frozen_reason from config"
    ).fetchone()
    rows = db.execute("""
        select status, count(*), sum(coalesce(actual, reserved)), sum(coalesce(actual, 0))
        from reviews group by status
    """).fetchall()
    charged = sum(row[3] for row in rows)
    committed = sum(row[2] for row in rows)
    return {
        "budget_usd": usd(budget),
        "estimated_usage_usd": usd(charged),
        "unsettled_reserved_usd": usd(committed - charged),
        "available_after_reservations_usd": usd(budget - committed),
        "deadline_utc": deadline,
        "frozen_reason": reason,
        "requests": {row[0]: row[1] for row in rows},
    }


def reserve(db, job, cost, budget):
    db.execute("begin immediate")
    try:
        if db.execute("select frozen_reason from config where id=1").fetchone()[0]:
            return "frozen"
        existing = db.execute(
            "select 1 from reviews where master_sha=? and record_id=?", job[:2]
        ).fetchone()
        if existing:
            return "already_attempted"
        committed = db.execute("select coalesce(sum(coalesce(actual,reserved)),0) from reviews").fetchone()[0]
        if committed + cost > budget:
            return "budget"
        db.execute("""
            insert into reviews(master_sha,record_id,custom_id,request_sha,reserved,status)
            values (?, ?, ?, ?, ?, 'reserved_uncertain')
        """, (*job, cost))
        return "reserved"
    finally:
        db.commit()


def price_usage(message):
    usage = message.get("usage")
    tool_use = usage.get("server_tool_use") if isinstance(usage, dict) else None
    if (
        message.get("model") != MODEL
        or not isinstance(usage, dict)
        or any(type(usage.get(name)) is not int or usage[name] < 0 for name in ("input_tokens", "output_tokens"))
        or usage["output_tokens"] > OUTPUT_LIMIT
        or any(usage.get(name, 0) != 0 for name in ("cache_creation_input_tokens", "cache_read_input_tokens"))
        or (tool_use is not None and (
            not isinstance(tool_use, dict) or any(value != 0 for value in tool_use.values())
        ))
        or usage.get("speed") not in (None, "standard")
        or usage.get("service_tier") not in (None, "standard")
    ):
        return None
    return INPUT_RATE * usage["input_tokens"] + OUTPUT_RATE * usage["output_tokens"]


def process(item, path, key, budget, deadline, stop):
    job, params, evidence, historical_only = item
    if stop.is_set() or utc_now() >= deadline:
        return "stopped"
    count_params = {k: v for k, v in params.items() if k not in ("max_tokens", "service_tier")}
    try:
        estimated = call_api(key, "/count_tokens", count_params, deadline)["input_tokens"]
        if type(estimated) is not int or estimated <= 0:
            raise ValueError("Invalid input token count")
    except (ProviderError, KeyError, ValueError) as error:
        stop.set()
        if isinstance(error, ProviderError):
            return f"count_failed_{error.code}" if error.code else "count_failed"
        return "invalid_count"
    if stop.is_set() or (deadline - utc_now()).total_seconds() <= 1:
        return "stopped"
    ceiling = estimated + (estimated + 19) // 20 + 256
    cost = ceiling * INPUT_RATE + OUTPUT_LIMIT * OUTPUT_RATE
    with closing(connect(path)) as db:
        state = reserve(db, job, cost, budget)
        if state != "reserved":
            if state == "budget":
                stop.set()
            return state
        if stop.is_set() or (deadline - utc_now()).total_seconds() <= 1:
            db.execute("delete from reviews where master_sha=? and record_id=?", job[:2])
            return "stopped_before_dispatch"
        try:
            message = call_api(key, "", params, deadline)
        except ProviderError as error:
            stop.set()
            status = "provider_rejected_429" if error.code == 429 else "provider_failure_uncertain"
            db.execute(
                "update reviews set status=?, result=? where master_sha=? and record_id=?",
                (status, json.dumps({"provider_http_status": error.code}), *job[:2]),
            )
            return status
        actual = price_usage(message)
        if actual is None or actual > cost:
            stop.set()
            reason = "Provider usage was unexpected or exceeded reservation"
            db.execute("update config set frozen_reason=? where id=1", (reason,))
        review = classify_result({"type": "succeeded", "message": message}, evidence)
        assessment = review.get("model_assessment", {})
        if historical_only and (
            assessment.get("outlet_status") == "MATCH"
            or assessment.get("price_status") in ("MATCH", "MISMATCH")
        ):
            review["review_status"] = "HOLD_HISTORICAL_SCOPE"
        db.execute(
            "update reviews set actual=?, status=?, result=? where master_sha=? and record_id=?",
            (actual, review["review_status"], encode(review).decode(), *job[:2]),
        )
        return review["review_status"]


def iter_jobs(paths):
    for run_dir in paths:
        if (run_dir / "submission.json").exists():
            raise AuditError("A selected plan has a Batch submission receipt. Exclude it from synchronous runs.")
        manifest, _, requests = load_plan(run_dir)
        if manifest["model"] != MODEL:
            raise AuditError(f"Prepare all synchronous plans with --model {MODEL}.")
        for request in requests:
            original = request["params"]
            if set(original) != {"model", "max_tokens", "system", "messages", "output_config"}:
                raise AuditError("Unsupported prepared request options for standard metered execution.")
            system = original["system"]
            messages = original["messages"]
            config = original["output_config"]
            if (
                not isinstance(system, str)
                or not isinstance(messages, list)
                or len(messages) != 1
                or set(messages[0]) != {"role", "content"}
                or messages[0]["role"] != "user"
                or not isinstance(messages[0]["content"], str)
                or set(config) != {"format"}
                or config["format"].get("type") != "json_schema"
            ):
                raise AuditError("Prepared request must be text-only with JSON output and no tools or caching.")
            record = decode(messages[0]["content"])
            if not valid_record(record):
                raise AuditError("Invalid evidence envelope in prepared plan.")
            params = {
                **original, "max_tokens": OUTPUT_LIMIT,
                "system": system + SCOPE_INSTRUCTION,
                "output_config": {**config, "effort": "low"},
                "thinking": {"type": "between_tools"},
                "service_tier": "standard_only",
            }
            # Count endpoint does not accept the creation-only service tier parameter.
            yield (
                (manifest["master_sha256"], record["record_id"], request["custom_id"], digest(encode(params))),
                params,
                record["evidence"],
                record["workbook"].get("historical_extract_only") is True,
            )


def export_reviews(db, directory):
    destination = directory / "sync_review_results.jsonl"
    with NamedTemporaryFile(dir=directory, prefix=".sync_reviews.", delete=False) as out:
        tmp = Path(out.name)
        try:
            for row in db.execute("""
                select master_sha, record_id, custom_id, request_sha, reserved, actual, status, result
                from reviews order by rowid
            """):
                sha, record_id, custom_id, request_sha, reserved, actual, status, result = row
                out.write(encode({
                    "master_sha256": sha, "record_id": record_id, "custom_id": custom_id,
                    "sync_request_sha256": request_sha, "reserved_usd": usd(reserved),
                    "estimated_usage_usd": usd(actual) if actual is not None else None,
                    "review_status": status, **(decode(result) if result else {}),
                }) + b"\n")
            out.flush()
            os.fsync(out.fileno())
            os.replace(tmp, destination)
        finally:
            tmp.unlink(missing_ok=True)


def execute(db, args, paths, path, key, budget, deadline):
    stop = Event()
    existing = set(db.execute("select master_sha,record_id from reviews"))
    jobs = iter_jobs(paths)
    scheduled = 0
    active = set()
    with ThreadPoolExecutor(max_workers=args.max_workers) as workers:
        while True:
            while (
                len(active) < args.max_workers and scheduled < args.max_new_requests
                and not stop.is_set() and utc_now() < deadline
            ):
                item = next(jobs, None)
                if item is None:
                    break
                guard = item[0][:2]
                if guard in existing:
                    continue
                existing.add(guard)
                active.add(workers.submit(process, item, path, key, budget, deadline, stop))
                scheduled += 1
            if not active:
                break
            done, active = wait(active, return_when=FIRST_COMPLETED)
            for task in done:
                outcome = task.result()
                if outcome not in ("REVIEW_REQUIRED", "HOLD_INVALID_MODEL_OUTPUT", "HOLD_OUTPUT_TOKEN_LIMIT"):
                    print(f"Worker outcome: {outcome}", file=sys.stderr)
                if scheduled % 25 == 0 or not active:
                    print(json.dumps(stats(db)), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, action="append", default=[])
    parser.add_argument("--plan-root", type=Path, help="Directory containing prepared plan directories.")
    parser.add_argument("--ledger-dir", type=Path, required=True)
    parser.add_argument("--master-workbook", type=Path, help="Workbook snapshot to verify before any paid request.")
    parser.add_argument("--budget-usd")
    parser.add_argument("--deadline", help="Absolute ISO 8601 deadline including timezone.")
    parser.add_argument("--max-workers", type=int, default=4)
    parser.add_argument("--max-new-requests", type=int, default=12)
    parser.add_argument("--confirm-paid", action="store_true")
    parser.add_argument("--approve-scale", action="store_true", help="Required for more than 25 new requests.")
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()
    try:
        path = args.ledger_dir / "ledger.sqlite3"
        if args.report_only:
            if not path.is_file():
                raise AuditError("No ledger exists yet.")
            with closing(connect(path)) as db:
                print(json.dumps(stats(db), indent=2))
            return 0
        if not args.confirm_paid:
            raise AuditError("Paid execution requires --confirm-paid.")
        if not args.budget_usd or not args.deadline:
            raise AuditError("Supply an explicit budget and deadline.")
        budget, deadline = amount(args.budget_usd), timestamp(args.deadline)
        if not 0 < budget <= MAX_BUDGET or deadline <= utc_now():
            raise AuditError("Budget or deadline is invalid.")
        if not 1 <= args.max_workers <= MAX_WORKERS or args.max_new_requests < 1:
            raise AuditError(f"Use 1–{MAX_WORKERS} workers and a positive request limit.")
        if args.max_new_requests > 25 and not args.approve_scale:
            raise AuditError("Review the pilot results before using --approve-scale.")
        paths = list(args.run_dir)
        if args.plan_root:
            paths += sorted(path.parent for path in args.plan_root.glob("*/plan.json"))
        if not paths:
            raise AuditError("Supply at least one prepared plan directory.")
        if args.master_workbook is None:
            raise AuditError("Supply --master-workbook to verify the intended snapshot before paid execution.")
        with args.master_workbook.open("rb") as workbook:
            master_sha = hashlib.file_digest(workbook, "sha256").hexdigest()
        if any(decode((plan / "plan.json").read_bytes()).get("master_sha256") != master_sha for plan in paths):
            raise AuditError("A selected plan does not match the supplied workbook SHA-256.")
        key = api_key()
        args.ledger_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        with (args.ledger_dir / ".lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise AuditError("Another paid process is using this ledger.") from None
            with closing(connect(path)) as db:
                configure(db, budget, deadline)
                try:
                    execute(db, args, paths, path, key, budget, deadline)
                finally:
                    export_reviews(db, args.ledger_dir)
                    print(json.dumps(stats(db), indent=2))
        return 0
    except (AuditError, InvalidOperation, KeyError, TypeError, ValueError, OSError, sqlite3.Error) as error:
        print(f"Error: {error if isinstance(error, AuditError) else type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
