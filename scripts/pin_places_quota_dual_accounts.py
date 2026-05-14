#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = "places.id"
DEFAULT_QUERIES = [
    "food singapore",
    "restaurant singapore",
    "hawker centre singapore",
    "coffee singapore",
    "chicken rice singapore",
    "laksa singapore",
    "nasi lemak singapore",
    "bak kut teh singapore",
]


def read_env_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def post_search_text(api_key: str, query: str, timeout_s: float = 10.0) -> int:
    body = json.dumps({"textQuery": query, "languageCode": "en", "regionCode": "sg"}).encode("utf-8")
    req = urllib.request.Request(url=SEARCH_TEXT_URL, data=body, method="POST")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("X-Goog-Api-Key", api_key)
    req.add_header("X-Goog-FieldMask", FIELD_MASK)
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            _ = resp.read()
        return 200
    except urllib.error.HTTPError as exc:
        return int(getattr(exc, "code", 0) or 0)
    except Exception:
        return -1


def run_account_window(
    api_key: str,
    account_name: str,
    duration_s: int,
    concurrency: int,
    queries: list[str],
) -> dict[str, Any]:
    state = {"sent": 0, "ok": 0, "http_429": 0, "http_other": 0, "network_err": 0}
    lock = threading.Lock()
    start = time.time()

    def worker(worker_idx: int) -> None:
        idx = worker_idx
        while time.time() - start < duration_s:
            query = queries[idx % len(queries)]
            idx += 1
            code = post_search_text(api_key, query)
            with lock:
                state["sent"] += 1
                if code == 200:
                    state["ok"] += 1
                elif code == 429:
                    state["http_429"] += 1
                elif code == -1:
                    state["network_err"] += 1
                else:
                    state["http_other"] += 1
            if code == 429:
                time.sleep(0.08)

    threads = [threading.Thread(target=worker, args=(idx,), daemon=True) for idx in range(concurrency)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    return {
        "account": account_name,
        "duration_s": duration_s,
        "concurrency": concurrency,
        "elapsed_s": round(time.time() - start, 2),
        **state,
    }


def account_at_ceiling(stats: dict[str, Any], target_per_minute: int) -> bool:
    # Practical 100% condition: either 429 appears (quota edge) or sustained near-max successful requests.
    return bool(stats["http_429"] > 0 or stats["ok"] >= int(target_per_minute * 0.95))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pin Places SearchText quota for both primary and backup keys until both reach quota ceiling behavior."
    )
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--duration-s", type=int, default=75)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--target-per-minute", type=int, default=600)
    parser.add_argument("--max-cycles", type=int, default=20)
    args = parser.parse_args()

    env = read_env_file(Path(args.env_file))
    primary_key = env.get("GOOGLE_MAPS_ENRICHMENT_API_KEY", "")
    backup_key = env.get("GOOGLE_MAPS_ENRICHMENT_API_KEY_BACKUP", "")
    if not primary_key or not backup_key:
        raise SystemExit("Missing GOOGLE_MAPS_ENRICHMENT_API_KEY or GOOGLE_MAPS_ENRICHMENT_API_KEY_BACKUP")

    reached = {"primary": False, "backup": False}
    results: list[dict[str, Any]] = []
    cycle = 0

    while cycle < args.max_cycles and not (reached["primary"] and reached["backup"]):
        cycle += 1
        if not reached["primary"]:
            primary_stats = run_account_window(
                api_key=primary_key,
                account_name="primary",
                duration_s=args.duration_s,
                concurrency=args.concurrency,
                queries=DEFAULT_QUERIES,
            )
            primary_stats["cycle"] = cycle
            primary_stats["ceiling_reached"] = account_at_ceiling(primary_stats, args.target_per_minute)
            reached["primary"] = bool(primary_stats["ceiling_reached"])
            results.append(primary_stats)

        if not reached["backup"]:
            backup_stats = run_account_window(
                api_key=backup_key,
                account_name="backup",
                duration_s=args.duration_s,
                concurrency=args.concurrency,
                queries=DEFAULT_QUERIES,
            )
            backup_stats["cycle"] = cycle
            backup_stats["ceiling_reached"] = account_at_ceiling(backup_stats, args.target_per_minute)
            reached["backup"] = bool(backup_stats["ceiling_reached"])
            results.append(backup_stats)

    print(
        json.dumps(
            {
                "mode": "dual_account_quota_pin",
                "target_per_minute": args.target_per_minute,
                "duration_s": args.duration_s,
                "concurrency": args.concurrency,
                "max_cycles": args.max_cycles,
                "cycles_run": cycle,
                "primary_reached": reached["primary"],
                "backup_reached": reached["backup"],
                "completed": reached["primary"] and reached["backup"],
                "results": results,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
