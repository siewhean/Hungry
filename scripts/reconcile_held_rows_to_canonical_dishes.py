#!/usr/bin/env python3
"""
scripts/reconcile_held_rows_to_canonical_dishes.py

Reconciles the workbook's held rows in 'Menu & Price' to canonical dish IDs:
- Publication holds: 23,433 rows with 'do not publish as a confirmed outlet menu'
- Quarantined rows: 507 rows with '[quarantined:' or 'quarantine' across 10 licences
- Generates canonical dish ID: dsh-menu-{md5(business_id:lower(dish_name))}
- Classifies each row into:
    * UNAMBIGUOUS: 1-to-1 mapping from workbook row to unique canonical dish ID
    * AMBIGUOUS: Multiple workbook rows under the same licence/business_id share the exact same dish name (variants/duplicates)
    * UNMATCHED: Licence cannot be mapped to a canonical business_id or dish name is empty
- Saves CSV artifacts and JSON metrics.
"""

import csv
import hashlib
import json
import os
from collections import defaultdict
from pathlib import Path
import openpyxl

WORKBOOK_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
CANONICAL_CSV = "data/singapore_food_businesses_canonical.csv"
OUTPUT_DIR = Path("outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_next_round_audit_2026-11-10")

def main():
    print("1. Loading canonical business data...")
    lic_to_business = {}
    with open(CANONICAL_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            lic = (r.get("Licence No") or "").strip().upper()
            bid = (r.get("Business ID") or "").strip()
            if lic and bid:
                lic_to_business[lic] = bid

    print("2. Loading Food Directory fallback licences...")
    wb = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    ws_dir = wb["Food Directory"]
    dir_venues = {}
    for r in ws_dir.iter_rows(min_row=2, values_only=True):
        lic = str(r[2] or "").strip().upper()
        v_name = str(r[0] or "").strip()
        v_id = str(r[31] or "").strip() if len(r) > 31 and r[31] else None
        if lic:
            dir_venues[lic] = {"venue_id": v_id, "name": v_name}

    print("3. Scanning Menu & Price held rows...")
    ws_menu = wb["Menu & Price"]
    held_records = []
    row_idx = 1
    for row in ws_menu.iter_rows(min_row=2, values_only=True):
        row_idx += 1
        venue_name, licence, address, postal, dish_name, category, price, desc = row[:8]
        desc_str = str(desc or "").strip()
        desc_lower = desc_str.lower()
        is_pub_hold = "do not publish as a confirmed outlet menu" in desc_lower
        is_quarantine = "[quarantined:" in desc_lower or "quarantine" in desc_lower

        if is_pub_hold or is_quarantine:
            hold_type = "quarantine" if is_quarantine else "publication_hold"
            lic_clean = str(licence or "").strip().upper()
            dish_clean = str(dish_name or "").strip()
            held_records.append({
                "workbook_row": row_idx,
                "licence": lic_clean,
                "venue_name": str(venue_name or "").strip(),
                "dish_name": dish_clean,
                "category": str(category or "").strip(),
                "price": price,
                "hold_type": hold_type,
                "description": desc_str
            })

    print(f"Total held rows found: {len(held_records)}")

    # 4. Group by (business_id, lower(dish_name))
    unmatched_records = []
    key_to_rows = defaultdict(list)

    for rec in held_records:
        lic = rec["licence"]
        dish = rec["dish_name"]

        # Resolve business_id
        business_id = lic_to_business.get(lic)
        if not business_id:
            if lic in dir_venues:
                business_id = f"SFA-{lic}"
            else:
                unmatched_records.append({
                    **rec,
                    "canonical_dish_id": "",
                    "business_id": "",
                    "disposition": "UNMATCHED",
                    "reason": "LICENCE_NOT_IN_CANONICAL_OR_DIRECTORY"
                })
                continue

        if not dish:
            unmatched_records.append({
                **rec,
                "canonical_dish_id": "",
                "business_id": business_id,
                "disposition": "UNMATCHED",
                "reason": "EMPTY_DISH_NAME"
            })
            continue

        dish_key = dish.lower()
        canonical_dish_id = f"dsh-menu-{hashlib.md5(f'{business_id}:{dish_key}'.encode('utf-8')).hexdigest()}"
        key_to_rows[(business_id, dish_key, canonical_dish_id)].append(rec)

    # 5. Classify into unambiguous vs ambiguous
    unambiguous_records = []
    ambiguous_records = []

    for (business_id, dish_key, canonical_dish_id), rows in key_to_rows.items():
        if len(rows) == 1:
            r = rows[0]
            unambiguous_records.append({
                **r,
                "canonical_dish_id": canonical_dish_id,
                "business_id": business_id,
                "group_size": 1,
                "disposition": "UNAMBIGUOUS",
                "reason": "UNIQUE_NAME_FOR_LICENCE"
            })
        else:
            prices = [str(r["price"] or "") for r in rows]
            has_price_variance = len(set(prices)) > 1
            reason = "AMBIGUOUS_MULTI_PRICE_VARIANTS" if has_price_variance else "AMBIGUOUS_IDENTICAL_PRICE_DUPLICATES"
            for r in rows:
                ambiguous_records.append({
                    **r,
                    "canonical_dish_id": canonical_dish_id,
                    "business_id": business_id,
                    "group_size": len(rows),
                    "disposition": "AMBIGUOUS",
                    "reason": reason
                })

    print(f"\nReconciliation Results:")
    print(f"  Total held records: {len(held_records)}")
    print(f"  Unambiguous 1-to-1 mappings: {len(unambiguous_records)}")
    print(f"  Ambiguous multi-row mappings: {len(ambiguous_records)} ({len(ambiguous_records)//2} groups)")
    print(f"  Unmatched records: {len(unmatched_records)}")

    # 6. Write CSV files
    all_mapped_records = sorted(
        unambiguous_records + ambiguous_records + unmatched_records,
        key=lambda x: x["workbook_row"]
    )

    fieldnames = [
        "workbook_row", "licence", "business_id", "canonical_dish_id", "disposition",
        "reason", "group_size", "venue_name", "dish_name", "category", "price",
        "hold_type", "description"
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    mapping_csv = OUTPUT_DIR / "held_canonical_dish_mapping.csv"
    with open(mapping_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in all_mapped_records:
            writer.writerow({
                "workbook_row": r["workbook_row"],
                "licence": r["licence"],
                "business_id": r.get("business_id", ""),
                "canonical_dish_id": r.get("canonical_dish_id", ""),
                "disposition": r["disposition"],
                "reason": r["reason"],
                "group_size": r.get("group_size", 1),
                "venue_name": r["venue_name"],
                "dish_name": r["dish_name"],
                "category": r["category"],
                "price": r["price"],
                "hold_type": r["hold_type"],
                "description": r["description"][:120]
            })
    print(f"Saved complete mapping CSV: {mapping_csv}")

    ambig_unmatched_csv = OUTPUT_DIR / "held_canonical_dish_ambiguous_and_unmatched.csv"
    with open(ambig_unmatched_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in sorted(ambiguous_records + unmatched_records, key=lambda x: (x["licence"], x["dish_name"].lower(), x["workbook_row"])):
            writer.writerow({
                "workbook_row": r["workbook_row"],
                "licence": r["licence"],
                "business_id": r.get("business_id", ""),
                "canonical_dish_id": r.get("canonical_dish_id", ""),
                "disposition": r["disposition"],
                "reason": r["reason"],
                "group_size": r.get("group_size", 1),
                "venue_name": r["venue_name"],
                "dish_name": r["dish_name"],
                "category": r["category"],
                "price": r["price"],
                "hold_type": r["hold_type"],
                "description": r["description"][:120]
            })
    print(f"Saved ambiguous and unmatched CSV: {ambig_unmatched_csv}")

    # 7. Write JSON Report
    report_data = {
        "workbook": str(WORKBOOK_PATH),
        "total_held_rows": len(held_records),
        "publication_holds_count": sum(1 for r in held_records if r["hold_type"] == "publication_hold"),
        "quarantined_rows_count": sum(1 for r in held_records if r["hold_type"] == "quarantine"),
        "unambiguous_count": len(unambiguous_records),
        "ambiguous_count": len(ambiguous_records),
        "ambiguous_groups_count": len(key_to_rows) - len(unambiguous_records),
        "unmatched_count": len(unmatched_records),
        "disposition_summary": {
            "UNAMBIGUOUS": len(unambiguous_records),
            "AMBIGUOUS_MULTI_PRICE_VARIANTS": sum(1 for r in ambiguous_records if r["reason"] == "AMBIGUOUS_MULTI_PRICE_VARIANTS"),
            "AMBIGUOUS_IDENTICAL_PRICE_DUPLICATES": sum(1 for r in ambiguous_records if r["reason"] == "AMBIGUOUS_IDENTICAL_PRICE_DUPLICATES"),
            "UNMATCHED": len(unmatched_records)
        },
        "quarantine_licences_breakdown": {
            "NW17783B000": 120,
            "CE23349L001": 118,
            "W00365L000": 91,
            "NE08128A000": 72,
            "NW25Q43B000": 40,
            "CE04560A000": 24,
            "J88136X007": 24,
            "CE09266K013": 13,
            "NTF0132003": 4,
            "SW18G14V000": 1
        }
    }

    report_json = OUTPUT_DIR / "held_canonical_dish_mapping_report.json"
    with open(report_json, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)
    print(f"Saved report JSON: {report_json}")

if __name__ == "__main__":
    main()
