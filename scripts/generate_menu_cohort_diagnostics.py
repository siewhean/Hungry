#!/usr/bin/env python3
"""
generate_menu_cohort_diagnostics.py
Regenerates menu_cohort_diagnostics.json to accurately reflect the audited master workbook:
- Current 64 unlisted licences (1,501 dishes) catalogued in unlisted_venues.csv
- Standardized non-numeric price variant patterns preserved in Description / Notes
- Top missing price venues (preserved blank per zero-placeholder rule)
"""

import os, json, re, hashlib
from collections import Counter, defaultdict
import openpyxl

ROOT = "/Users/Siew Hean/Documents/GitHub/Hungry"
WORKBOOK_PATH = os.path.join(ROOT, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx")
OUT_JSON = os.path.join(ROOT, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/menu_cohort_diagnostics.json")

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def main():
    wb_sha = sha256_file(WORKBOOK_PATH)
    wb_size = os.path.getsize(WORKBOOK_PATH)
    print(f"Loading workbook {wb_sha} ({wb_size} bytes)...")

    wb = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    ws_dir = wb["Food Directory"]
    dir_lics = set()
    for r in ws_dir.iter_rows(min_row=2, values_only=True):
        val = str(r[2]).strip() if r[2] else ""
        if val:
            dir_lics.add(val)

    ws_menu = wb["Menu & Price"]
    unmatched_licences = defaultdict(lambda: {"venue": "", "postal": "", "address": "", "count": 0, "dishes": []})
    standardized_variants = defaultdict(lambda: {"count": 0, "samples": []})
    missing_price_venues = Counter()
    total_dishes = 0
    missing_price_count = 0

    for r_idx, r in enumerate(ws_menu.iter_rows(min_row=2, values_only=True), start=2):
        total_dishes += 1
        venue = str(r[0]).strip() if r[0] else ""
        lic = str(r[1]).strip() if r[1] else ""
        addr = str(r[2]).strip() if r[2] else ""
        postal = str(r[3]).strip() if r[3] else ""
        item_name = str(r[4]).strip() if r[4] else ""
        price = r[6]
        desc = str(r[7]).strip() if r[7] else ""

        if lic and lic not in dir_lics:
            d = unmatched_licences[lic]
            d["venue"] = venue
            d["postal"] = postal
            d["address"] = addr
            d["count"] += 1
            if len(d["dishes"]) < 5:
                d["dishes"].append(item_name)

        if price is None or str(price).strip() == "":
            missing_price_count += 1
            if venue:
                missing_price_venues[venue] += 1

            # Check if Description contains standardized variant pricing
            m = re.search(r"(\[(?:Price note|Variants|Price range|Price info): [^\]]+\])", desc)
            if m:
                pat = m.group(1)
                standardized_variants[pat]["count"] += 1
                if len(standardized_variants[pat]["samples"]) < 3:
                    standardized_variants[pat]["samples"].append({
                        "row": r_idx,
                        "venue": venue,
                        "item": item_name,
                        "raw_variant_format": pat
                    })

    wb.close()

    top_variants = sorted(
        [{"pattern": k, "count": v["count"], "samples": v["samples"]} for k, v in standardized_variants.items()],
        key=lambda x: -x["count"]
    )

    top_missing_venues = [
        {"venue": v, "count": c} for v, c in missing_price_venues.most_common(30)
    ]

    out_data = {
        "workbook_sha256": wb_sha,
        "workbook_size_bytes": wb_size,
        "total_dishes_audited": total_dishes,
        "unmatched_licences_count": len(unmatched_licences),
        "unmatched_licences_dishes": sum(v["count"] for v in unmatched_licences.values()),
        "unmatched_licences": dict(unmatched_licences),
        "standardized_price_variants_count": sum(v["count"] for v in standardized_variants.values()),
        "top_standardized_price_variants": top_variants[:50],
        "total_missing_price_rows": missing_price_count,
        "top_missing_price_venues": top_missing_venues
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2, ensure_ascii=False)

    print(f"Saved refreshed diagnostics to {OUT_JSON}.")
    print(f"Unmatched licences: {len(unmatched_licences)} ({sum(v['count'] for v in unmatched_licences.values())} dishes)")
    print(f"Standardized price variants: {sum(v['count'] for v in standardized_variants.values())}")
    print(f"Total missing prices: {missing_price_count}")

if __name__ == "__main__":
    main()
