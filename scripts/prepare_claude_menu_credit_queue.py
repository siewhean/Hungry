#!/usr/bin/env python3
"""Prepare a review-only shortlist from the audited Hungry menu snapshot."""

import argparse
from bisect import bisect_left
from collections import Counter, defaultdict
import csv
from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit, urlunsplit

from openpyxl import load_workbook
from claude_menu_reconciliation import valid_record

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8"
MASTER = CATALOGUE / "Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
MASTER_SHA256 = "7d8d80171a066b470bd0739a8511f257f62661928fc7f7f6ea8ebd4eb22f2d2f"
PRE_DEDUP_SHA256 = "55edce2afcbdfefc032e17c6f4731b62d4918229e9641652d5379bddf18f59f8"
SOURCE = ROOT / "data/menus/quarantine-2026-11-08/menus_consolidated_2026-11-08.jsonl"
WORK = CATALOGUE / "_work"
RECONCILIATION = WORK / "menu_reconciliation_2026-11-10_after_remediation"
DELETIONS = WORK / "menu_field_remediation_2026-11-10/duplicate_removal_manifest.csv"
QUEUE = WORK / "claude_menu_reconciliation_2026-11-10/scale-evidence"
AUDIT_DATE = date(2026, 11, 10)
BUSINESS = re.compile(
    r"\b(?:cafe|coffee|kitchen|bakery|restaurant|bistro|diner|tea|juice|food|seafood|rice|noodle|"
    r"chicken|fish|wok|house|shop|stall|bar|grill|express|cuisine|pizzeria|dessert|catering|"
    r"patisserie|canteen|eatery|kopi|kopitiam|makan|prata|sushi|ramen|foodcourt)\b",
    re.IGNORECASE,
)
UNIT = re.compile(r"#[0-9A-Za-z]+\s*-\s*[0-9A-Za-z]+(?:[ /-]+[0-9A-Za-z]+)?")
OUTLET_PATH = {
    "foodpanda": re.compile(r"/restaurant/[a-z0-9]+/[a-z0-9-]+/?", re.IGNORECASE),
    "grab": re.compile(r"/sg/(?:en|zh)/restaurant/[a-z0-9-]+/[a-z0-9-]+/?", re.IGNORECASE),
}
OUTLET_HOST = {"foodpanda": {"www.foodpanda.sg", "foodpanda.sg"}, "grab": {"food.grab.com"}}
PRICE = re.compile(r"(?:S\$|\$|SGD\s*)?\s*([0-9]+(?:\.[0-9]{1,2})?)")
SAFE_VARIANT = re.compile(r"[\w .()/'-]{1,70}", re.UNICODE)
SAFE_TEXT = re.compile(r"(?:https?://|sk-ant-|api[_ -]?key|access[_ -]?token|session[_ -]?id|\bpassword\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})", re.I)


def hash_file(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def norm(value):
    return " ".join(re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).split())


def public_route(url, provider):
    if not isinstance(url, str):
        return None
    try:
        parts = urlsplit(url)
        if (
            parts.scheme not in ("http", "https")
            or parts.netloc.lower() not in OUTLET_HOST[provider]
            or not OUTLET_PATH[provider].fullmatch(parts.path)
        ):
            return None
    except ValueError:
        return None
    # Send a public outlet locator only, without tracking or session parameters.
    return urlunsplit(("https", parts.netloc.lower(), parts.path.rstrip("/"), "", ""))


def capture_date(value):
    if not isinstance(value, str):
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            captured = datetime.strptime(value, fmt).date()
        except ValueError:
            continue
        if 0 <= (AUDIT_DATE - captured).days <= 30:
            return captured.isoformat()
    return None


def positive_price(value):
    if isinstance(value, bool):
        return None
    match = PRICE.fullmatch(str(value or "").strip())
    if not match:
        return None
    amount = Decimal(match[1])
    return f"{amount:.2f}" if amount > 0 else None


def candidate_rows(counts, deletions):
    with SOURCE.open(encoding="utf-8") as sources, (
        RECONCILIATION / "menu_source_reconciliation_rows.jsonl"
    ).open(encoding="utf-8") as reconciled:
        for source_line, (raw, audit_line) in enumerate(zip(sources, reconciled, strict=True), 1):
            counts["historical_rows_examined"] += 1
            audit = json.loads(audit_line)
            if audit["source_line"] != source_line:
                raise ValueError("The reconciliation rows are not aligned to the historical snapshot")
            provider = audit["source"]
            if provider not in OUTLET_HOST or audit["record_reconciliation_status"] != "singleton_match":
                continue
            if audit["freshness_status"] != "within_30d":
                continue
            if audit["outlet_identity_status"] == "known_outlet_url_conflict":
                counts["already_known_wrong_outlet"] += 1
                continue
            if audit["outlet_identity_status"] != "name_overlap":
                issue = "outlet_name_difference"
            elif audit["price_status"] == "conflict":
                issue = "price_difference"
            elif audit["menu_source_url_status"] == "different":
                issue = "different_source_route"
            elif audit["price_status"] == "not_comparable_missing_or_unparsed":
                issue = "price_semantics_missing_or_ambiguous"
            else:
                counts["already_agrees_or_deliberately_missing_url"] += 1
                continue
            prior_row = audit["workbook_row"]
            shift = bisect_left(deletions, prior_row)
            if shift < len(deletions) and prior_row == deletions[shift]:
                counts["deleted_row"] += 1
                continue
            source = json.loads(raw)
            if (
                audit["stall_licence_no"] != str(source["stall_licence_no"]).strip().upper()
                or audit["item_name"] != source["item_name"]
                or (audit["source_url"] or "") != str(source["source_url"]).strip()
            ):
                raise ValueError(f"Source guard failed at snapshot line {source_line}")
            url = public_route(source["source_url"], provider)
            captured = capture_date(source["crawl_timestamp"])
            amount = positive_price(source["price_sgd"])
            variants = source["variation_prices_sgd"]
            if not url or not captured or not (amount or variants or source["price_from"]):
                counts["invalid_or_incomplete_source"] += 1
                continue
            yield prior_row - shift, issue, audit, source, url, captured


def evidence_text(audit, source):
    facts = [
        f"Saved historical {audit['source']} item extract, snapshot line {audit['source_line']}. "
        "The listed stall name is a stored attribution, not an independently observed outlet name. "
        "The extract supplies no independently observed source postal code or unit.",
        f"Stored stall label: {source['stall_name']}. Item: {source['item_name']}.",
    ]
    amount = positive_price(source["price_sgd"])
    if amount:
        qualifier = "starting amount" if source["price_from"] is True else "numeric price in snapshot"
        facts.append(f"SGD {qualifier}: {amount}.")
    if source["price_from"] is True:
        facts.append("The extract marks the offer as a starting price.")
    variations = source["variation_prices_sgd"]
    if isinstance(variations, list):
        amounts = [positive_price(value) for value in variations[:8]]
        if amounts and all(amounts):
            facts.append(f"Saved variation amounts in SGD, with no size labels supplied: {', '.join(amounts)}.")
    promo = positive_price(source["discounted_price_sgd"])
    if promo:
        facts.append(f"Separate saved promotional amount: SGD {promo}.")
    return " ".join(facts)


def prepare(output, shard_size):
    if not 1 <= shard_size <= 1000:
        raise ValueError("--shard-size must be between 1 and 1,000")
    if output.exists():
        raise ValueError("Choose a new output directory")
    master_hash = hash_file(MASTER)
    if master_hash != MASTER_SHA256:
        raise ValueError("Master hash differs from the validated reconciliation lineage")
    with (RECONCILIATION / "menu_source_reconciliation_report.json").open() as file:
        historical = json.load(file)["inputs"]
    source_hash = hash_file(SOURCE)
    if historical["workbook_sha256"] != PRE_DEDUP_SHA256 or historical["consolidated_jsonl_sha256"] != source_hash:
        raise ValueError("Historical source or reconciliation lineage differs")
    with DELETIONS.open(newline="", encoding="utf-8-sig") as file:
        deletions = sorted(int(row["Original CSV Line"]) for row in csv.DictReader(file))
    if len(deletions) != 348 or len(set(deletions)) != 348:
        raise ValueError("Expected 348 unique deletion pointers")

    counts = Counter()
    candidates = defaultdict(list)
    for n, *candidate in candidate_rows(counts, deletions):
        candidates[n].append(candidate)

    records = []
    mismatch_routes = Counter()
    workbook = load_workbook(MASTER, read_only=True, data_only=True)
    try:
        rows = iter(workbook["Menu & Price"].values)
        header = {name: i for i, name in enumerate(next(rows))}
        for number, row in enumerate(rows, 2):
            if number not in candidates:
                continue
            item, lic, venue, address, postal, price, target_url = (
                row[header[name]]
                for name in ("Menu Item / Dish Name", "SFA Licence", "F&B Venue Name", "Address", "Postal Code", "Price (SGD)", "Menu Source URL")
            )
            for issue, audit, source, url, captured in candidates[number]:
                if str(lic or "").strip().upper() != audit["stall_licence_no"] or norm(item) != norm(audit["item_name"]):
                    counts["current_master_guard_failed"] += 1
                    continue
                public_values = (str(venue or ""), str(source["stall_name"] or ""), str(item or ""), str(source["item_name"] or ""))
                if (
                    not all(public_values)
                    or not BUSINESS.search(public_values[0])
                    or not BUSINESS.search(public_values[1])
                    or any(len(value) > 220 or SAFE_TEXT.search(value) for value in public_values)
                    or not re.fullmatch(r"[A-Z0-9-]{4,24}", str(lic or ""))
                ):
                    counts["outside_public_business_filter"] += 1
                    continue
                if issue == "price_semantics_missing_or_ambiguous" and positive_price(price) and not source["price_from"] and not source["variation_prices_sgd"]:
                    counts["no_remaining_price_semantics_question"] += 1
                    continue
                pair = (lic, url)
                if issue == "outlet_name_difference" and mismatch_routes[pair] >= 3:
                    counts["repetitive_outlet_mismatch"] += 1
                    continue
                if issue == "outlet_name_difference":
                    mismatch_routes[pair] += 1
                unit = UNIT.search(str(address or ""))
                post = str(postal or "")
                if not re.fullmatch(r"[0-9]{6}", post):
                    post = ""
                target = {
                    "current_menu_row": number,
                    "licence": lic,
                    "venue": venue,
                    "unit": unit.group() if unit else "",
                    "postal": post,
                    "dish": item,
                    "price_sgd": positive_price(price),
                    "channel": "unknown",
                    "candidate_issue": issue,
                    "historical_extract_only": True,
                }
                if target_url:
                    for provider in OUTLET_HOST:
                        safe = public_route(target_url, provider)
                        if safe:
                            target["recorded_menu_url"] = safe
                            break
                record = {
                    "record_id": f"historical-{number}-{audit['source_record_id']}",
                    "workbook": target,
                    "evidence": [{
                        "evidence_id": f"saved-line-{audit['source_line']}",
                        "source_url": url,
                        "captured_at": captured,
                        "text": evidence_text(audit, source),
                    }],
                }
                if not valid_record(record):
                    raise ValueError(f"Invalid runner envelope for current worksheet row {number}")
                records.append((issue, record))
                counts[issue] += 1
        if number != 123341:
            raise ValueError("Unexpected master row count")
    finally:
        workbook.close()
    priorities = {"price_difference": 0, "different_source_route": 1, "outlet_name_difference": 2, "price_semantics_missing_or_ambiguous": 3}
    records.sort(key=lambda pair: (priorities[pair[0]], pair[1]["workbook"]["current_menu_row"]))
    output.mkdir(parents=True, mode=0o700, exist_ok=False)
    shards = []
    for start in range(0, len(records), shard_size):
        subset = records[start:start + shard_size]
        path = output / f"historical-{len(shards) + 1:03}.jsonl"
        with path.open("x", encoding="utf-8") as file:
            for _, record in subset:
                file.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n")
        shards.append({"file": path.name, "records": len(subset), "sha256": hash_file(path)})
    manifest = {
        "master_sha256": master_hash,
        "historical_source_sha256": source_hash,
        "pre_dedup_master_sha256": PRE_DEDUP_SHA256,
        "observation_cutoff": AUDIT_DATE.isoformat(),
        "disposition": "REVIEW_ONLY_HISTORICAL_CANDIDATES",
        "records": len(records),
        "counts": dict(counts),
        "shards": shards,
    }
    with (output / "queue_manifest.json").open("x", encoding="utf-8") as file:
        json.dump(manifest, file, indent=2)
        file.write("\n")
    print(json.dumps(manifest, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=QUEUE)
    parser.add_argument("--shard-size", type=int, default=250)
    args = parser.parse_args()
    prepare(args.out_dir, args.shard_size)


if __name__ == "__main__":
    main()
