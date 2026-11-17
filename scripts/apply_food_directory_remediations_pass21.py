#!/usr/bin/env python3
"""
Pass 21: Food Directory Quality Remediation & Comprehensive Price Range Backfill (2026-11-15)
-----------------------------------------------------------------------------------------
Applies actionable findings from Directory Stall Information Auditor:
1. Clears 21 food-court operator website contaminations (feisionggroup.com.sg) from Col 11.
2. Fixes 2 chain website misattributions (Row 13272 Old Chang Kee -> oldchangkee.com; Row 17917 KOI -> koithe.com).
3. Corrects 3 postal sector anomalies (Row 14438 882669 -> 822669; Row 4520 000000 -> 229661; Row 31314 000000 -> null).
4. Clears placeholder contact numbers (+6500000000, +6512345678, etc.) from Col 10.
5. Standardizes 8 vegan casing inconsistencies ('Vegan-friendly' -> 'Vegan Friendly') in Col 23.
6. Backfills/updates Price Range (Col 27) for all stalls with active dishes in Menu & Price.
"""

from __future__ import annotations

import argparse
import json
import shutil
from collections import defaultdict
from pathlib import Path
import openpyxl

BASE_DIR = Path("outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8")
MASTER_XLSX = BASE_DIR / "Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_XLSX = BASE_DIR / "Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass21_directory_remediation_2026-11-15.xlsx"
MANIFEST_PATH = Path("data/review_runs/food_directory_comprehensive_audit_2026-11-15.json")


def compute_price_range(prices: list[float]) -> str:
    valid = [p for p in prices if p is not None and p > 0]
    if not valid:
        return ""
    p_min = min(valid)
    p_max = max(valid)
    p_avg = sum(valid) / len(valid)
    return f"${p_min:.2f}–${p_max:.2f} (${p_avg:.2f} avg)"


def main():
    parser = argparse.ArgumentParser(description="Pass 21 Food Directory Quality Remediation")
    parser.add_argument("--apply", action="store_true", help="Apply fixes directly to master workbook")
    args = parser.parse_args()

    print(f"=== Starting Pass 21 Food Directory Quality Remediation (apply={args.apply}) ===")

    print(f"Loading audit manifest from: {MANIFEST_PATH} ...")
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)["actionable_remediation_manifest"]

    feisiong_clears = manifest_data.get("clear_website_contamination_feisiong", [])
    chain_fixes = manifest_data.get("clear_chain_website_misattributions", [])
    postal_fixes = manifest_data.get("normalize_postal_sector_typos", [])
    contact_purges = manifest_data.get("purge_placeholder_contacts", [])
    vegan_fixes = manifest_data.get("standardize_vegan_dietary_casing", [])

    print(f"Manifest Remediations to Apply:")
    print(f"  Fei Siong operator website clears: {len(feisiong_clears)}")
    print(f"  Chain website misattribution fixes: {len(chain_fixes)}")
    print(f"  Postal sector anomaly fixes: {len(postal_fixes)}")
    print(f"  Placeholder contact purges: {len(contact_purges)}")
    print(f"  Vegan casing standardizations: {len(vegan_fixes)}")

    print(f"Loading master workbook from: {MASTER_XLSX} ...")
    wb = openpyxl.load_workbook(MASTER_XLSX)
    ws_dir = wb["Food Directory"]
    ws_menu = wb["Menu & Price"]

    # Gather prices per licence from Menu & Price
    print("Gathering stall prices from Menu & Price...")
    prices_by_lic = defaultdict(list)
    for r in ws_menu.iter_rows(min_row=2, values_only=True):
        lic = str(r[1] or "").strip()
        p = r[6]
        if lic and p is not None:
            try:
                pf = float(p)
                if pf > 0:
                    prices_by_lic[lic].append(pf)
            except (ValueError, TypeError):
                pass

    print(f"Unique licensed stalls with active prices in Menu & Price: {len(prices_by_lic)}")

    # Track remediations
    applied_feisiong = 0
    applied_chain = 0
    applied_postal = 0
    applied_contacts = 0
    applied_vegan = 0
    applied_price_ranges = 0

    # 1. Clear Fei Siong contaminations
    for item in feisiong_clears:
        r_idx = item["row_idx"]
        curr_val = ws_dir.cell(row=r_idx, column=11).value
        if curr_val and "feisionggroup" in str(curr_val).lower():
            applied_feisiong += 1
            if args.apply:
                ws_dir.cell(row=r_idx, column=11, value=None)

    # 2. Fix Chain Website Misattributions
    for item in chain_fixes:
        r_idx = item["row_idx"]
        target = "https://www.oldchangkee.com/" if "old chang kee" in item["fnb_name"].lower() else "https://www.koithe.com/"
        applied_chain += 1
        if args.apply:
            ws_dir.cell(row=r_idx, column=11, value=target)

    # 3. Fix Postal Sector Typos
    for item in postal_fixes:
        r_idx = item["row_idx"]
        target_post = item["recommended_postal"]
        applied_postal += 1
        if args.apply:
            ws_dir.cell(row=r_idx, column=14, value=target_post)

    # 4. Purge Placeholder Contacts
    for item in contact_purges:
        r_idx = item["row_idx"]
        applied_contacts += 1
        if args.apply:
            ws_dir.cell(row=r_idx, column=10, value=None)

    # 5. Standardize Vegan Casing
    for item in vegan_fixes:
        r_idx = item["row_idx"]
        target_v = item["target_value"]
        applied_vegan += 1
        if args.apply:
            ws_dir.cell(row=r_idx, column=23, value=target_v)

    # 6. Backfill Price Range for all stalls with prices in Menu & Price
    for row_idx, r in enumerate(ws_dir.iter_rows(min_row=2, values_only=True), start=2):
        lic = str(r[2] or "").strip()
        curr_pr = r[26]
        if lic and lic in prices_by_lic:
            new_pr = compute_price_range(prices_by_lic[lic])
            # Update if missing or starts with $min
            if new_pr and (not curr_pr or not str(curr_pr).startswith("$")):
                applied_price_ranges += 1
                if args.apply:
                    ws_dir.cell(row=row_idx, column=27, value=new_pr)

    print(f"\nRemediation Execution Summary:")
    print(f"  Fei Siong operator website clears: {applied_feisiong}")
    print(f"  Chain website misattributions fixed: {applied_chain}")
    print(f"  Postal sector anomalies corrected: {applied_postal}")
    print(f"  Placeholder contacts purged: {applied_contacts}")
    print(f"  Vegan casing standardized: {applied_vegan}")
    print(f"  Price Ranges updated/backfilled: {applied_price_ranges}")

    if not args.apply:
        print("\n[DRY RUN] Complete. Re-run with --apply to write changes.")
        return

    print(f"\nCreating safe pre-Pass 21 backup at: {BACKUP_XLSX} ...")
    shutil.copy2(MASTER_XLSX, BACKUP_XLSX)

    print(f"Saving updated Master Workbook to {MASTER_XLSX} ...")
    wb.save(MASTER_XLSX)
    print("Master workbook saved successfully!")

    # Verify ZIP integrity
    import zipfile
    with zipfile.ZipFile(MASTER_XLSX, "r") as z:
        assert z.testzip() is None, "ZIP CRC check failed!"
    print("ZIP integrity test PASSED.")


if __name__ == "__main__":
    main()
