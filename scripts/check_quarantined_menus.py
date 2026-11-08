#!/usr/bin/env python3
"""Offline checks for staged menu files before anything is imported into the workbook.

Usage (run from the repo root on your Mac):
  python3 scripts/check_quarantined_menus.py data/menus/quarantine-2026-11-08

Reads only the files given. Makes no network requests and changes nothing.
Prints counts and writes a report next to the inputs as check_report.txt.
"""

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOP = {"the", "and", "pte", "ltd", "cafe", "restaurant", "stall", "food", "shop", "co"}


def tokens(name):
    return {t for t in TOKEN_RE.findall((name or "").lower()) if t not in STOP and len(t) > 1}


def check_menu_jsonl(path, report):
    counts = Counter()
    by_licence = defaultdict(set)
    examples = defaultdict(list)
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            counts["items"] += 1
            licence = row.get("stall_licence_no", "")
            if row.get("verified") is True and not row.get("source_url"):
                counts["verified_without_source_url"] += 1
                examples["verified_without_source_url"].append(licence)
            if row.get("source") in (None, "", "unknown"):
                counts["unknown_source"] += 1
            if re.search(r"\b(Kimly|crawl|review|URLR-|SGDD)\b", row.get("description") or ""):
                counts["description_has_crawl_log_text"] += 1
                examples["description_has_crawl_log_text"].append(licence)
            price = row.get("price_sgd")
            if price is None:
                counts["no_price"] += 1
            elif not isinstance(price, (int, float)) or price <= 0:
                counts["bad_price"] += 1
            by_licence[licence].add(row.get("source_url") or "")
    report.append(f"{path.name}: {dict(counts)}")
    for k, v in examples.items():
        report.append(f"  sample {k}: {sorted(set(v))[:10]}")
    return by_licence


def check_url_csv(path, report, name_col, url_col):
    licences_by_url = defaultdict(set)
    counts = Counter()
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            counts["rows"] += 1
            url = row.get(url_col, "")
            licences_by_url[url].add(row.get("stall_licence_no", ""))
            if "brand_source" in row or "common_tokens" in row:
                name_tokens = tokens(row.get(name_col, ""))
                if not name_tokens:
                    counts["no_name_for_match"] += 1
            if row.get("common_tokens", "").strip() in ("", "UNIT_MATCH_UNNAMED_STALL"):
                counts["unit_only_match"] += 1
    shared = {u: ls for u, ls in licences_by_url.items() if u and len(ls) > 1}
    counts["urls_shared_by_several_licences"] = len(shared)
    counts["rows_on_shared_urls"] = sum(len(ls) for ls in shared.values())
    report.append(f"{path.name}: {dict(counts)}")
    for u, ls in list(shared.items())[:5]:
        report.append(f"  shared url {u} -> {len(ls)} licences")
    return shared


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])
    report = []
    menu = folder / "menus_consolidated_2026-11-08.jsonl"
    if menu.exists():
        check_menu_jsonl(menu, report)
    for name in ("resolved_brand_menu_urls_2026-11-08.csv", "verified_crosswalk_menu_urls_2026-11-08.csv"):
        path = folder / name
        if path.exists():
            check_url_csv(path, report, "stall_name", "resolved_menu_url" if "resolved" in name else "matched_menu_url")
    review = folder / "review_list_2026-11-08.jsonl"
    if review.exists():
        reasons = Counter()
        with open(review, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    row = json.loads(line)
                    reasons[(row.get("rejection_reason") or row.get("reason") or "").split(" (")[0].split(":")[0]] += 1
        report.append(f"{review.name}: {sum(reasons.values())} rows")
        for reason, n in reasons.most_common():
            report.append(f"  {n} x {reason or '(no reason)'}")
    out = folder / "check_report.txt"
    out.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
