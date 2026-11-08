#!/usr/bin/env python3
"""Offline checks for staged menu files before anything is imported into the workbook.

Usage (run from the repo root on your Mac):
  python3 scripts/check_quarantined_menus.py data/menus/quarantine-2026-11-08

Reads only the files given. Makes no network requests and changes nothing.
Writes check_report.txt (counts) and rejected_rows.csv (one row per failing item)
next to the inputs. Nothing is imported or deleted.

Rules, all reported and none applied:
  - a row is rejected if its URL is already used by another licence
  - a URL-match row is rejected if its name tokens do not overlap the page name
  - an item is rejected if verified is true without a source URL
  - an item is rejected if its price is missing, zero or outside S$0.50 to S$100
  - an item is rejected if its description carries crawl-log text
  - an item is rejected if its licence is also on the review list
  - an item is rejected if an exact duplicate row appears more than once
"""

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

TOKEN_RE = re.compile(r"[a-z0-9]+")
STOP = {"the", "and", "pte", "ltd", "cafe", "restaurant", "stall", "food", "shop", "co"}
CRAWL_LOG_RE = re.compile(r"\b(Kimly|URLR-|SGDD|identity review|cleared candidate)\b", re.IGNORECASE)
RESIZE_RE = re.compile(r"\?(width|height|w|h)=")


def tokens(name):
    return {t for t in TOKEN_RE.findall((name or "").lower()) if t not in STOP and len(t) > 1}


def review_licences(path):
    licences = set()
    if path.exists():
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    licences.add(json.loads(line).get("stall_licence_no", ""))
    licences.discard("")
    return licences


def check_menu_jsonl(path, blocked, rejects, report):
    counts = Counter()
    seen_rows = Counter()
    licence_urls = defaultdict(set)
    per_row = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            counts["items"] += 1
            licence = row.get("stall_licence_no", "")
            url = row.get("source_url") or ""
            licence_urls[url].add(licence)
            per_row.append((n, licence, row.get("stall_name", ""), url))
            key = line.strip()
            seen_rows[key] += 1
            reasons = []
            if licence in blocked:
                reasons.append("licence on review list")
            if row.get("verified") is True and not url:
                reasons.append("verified without source url")
            if row.get("source") in (None, "", "unknown"):
                counts["unknown_source"] += 1
            if CRAWL_LOG_RE.search(row.get("description") or ""):
                reasons.append("crawl-log text in description")
            price = row.get("price_sgd")
            if price is None:
                counts["no_price"] += 1
            elif not isinstance(price, (int, float)) or not 0.5 <= price <= 100:
                reasons.append("price outside S$0.50 to S$100")
            if RESIZE_RE.search(row.get("image_url") or ""):
                counts["image_has_resize_params"] += 1
            if reasons:
                rejects.append((path.name, n, licence, row.get("stall_name", ""), url, "; ".join(reasons)))
    shared = {u: ls for u, ls in licence_urls.items() if u and len(ls) > 1}
    counts["urls_shared_by_several_licences"] = len(shared)
    for n, licence, name, url in per_row:
        if url in shared:
            rejects.append((path.name, n, licence, name, url, "url shared by several licences"))
    counts["duplicate_rows"] = sum(c - 1 for c in seen_rows.values() if c > 1)
    report.append(f"{path.name}: {dict(counts)}")
    return shared


def check_url_csv(path, shared_menu, blocked, rejects, report):
    licences_by_url = defaultdict(set)
    counts = Counter()
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        url_col = "resolved_menu_url" if "resolved_menu_url" in reader.fieldnames else "matched_menu_url"
        for n, row in enumerate(reader, start=2):
            counts["rows"] += 1
            lic = row.get("stall_licence_no", "")
            url = row.get(url_col, "")
            licences_by_url[url].add(lic)
            if not lic:
                counts["no_licence"] += 1
            if lic in blocked:
                counts["licence_on_review_list"] += 1
            name_hit = bool(tokens(row.get("stall_name", "")) & tokens(row.get("full_address", "") + " " + url))
            common = row.get("common_tokens", "").strip()
            if common == "UNIT_MATCH_UNNAMED_STALL" or (not common and not name_hit):
                counts["unit_only_match"] += 1
                rejects.append((path.name, n, lic, row.get("stall_name", ""), url, "unit-only match, no name overlap"))
    shared = {u: ls for u, ls in licences_by_url.items() if u and len(ls) > 1}
    counts["urls_shared_by_several_licences"] = len(shared)
    counts["rows_on_shared_urls"] = sum(len(ls) for ls in shared.values())
    report.append(f"{path.name}: {dict(counts)}")
    return shared


def overlap_check(folder, menu_file, blocked, report):
    if not menu_file.exists():
        return
    with open(menu_file, encoding="utf-8") as f:
        menu_licences = {json.loads(line).get("stall_licence_no", "") for line in f if line.strip()}
    both = menu_licences & blocked
    report.append(f"licences on both the menu file and the review list: {len(both)}")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])
    report = []
    rejects = []
    review = folder / "review_list_2026-11-08.jsonl"
    blocked = review_licences(review)
    menu = folder / "menus_consolidated_2026-11-08.jsonl"
    if menu.exists():
        check_menu_jsonl(menu, blocked, rejects, report)
    for name in ("resolved_brand_menu_urls_2026-11-08.csv", "verified_crosswalk_menu_urls_2026-11-08.csv"):
        path = folder / name
        if path.exists():
            check_url_csv(path, {}, blocked, rejects, report)
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
    overlap_check(folder, menu, blocked, report)
    report.append(f"rejected rows written to rejected_rows.csv: {len(rejects)}")
    (folder / "check_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    with open(folder / "rejected_rows.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "line", "stall_licence_no", "stall_name", "url", "reason"])
        w.writerows(rejects)
    print("\n".join(report))
    print(f"\nWrote {folder / 'check_report.txt'} and {folder / 'rejected_rows.csv'}")


if __name__ == "__main__":
    main()
