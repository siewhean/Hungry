#!/usr/bin/env python3
"""
scripts/reconcile_catalogue_ingestion_mappings.py

Executes Gate 2:
- Reconciles canonical dish IDs from Menu & Price.
- Produces verified canonical mappings preserving outlet, variant, and channel.
- Resolves the 18 same-price groups (36 rows) into 18 canonical items while retaining
  both source workbook rows, licensee titles, and descriptions.
- Explicitly keeps the 14 multi-price rows (7 groups) on hold (HOLD_VARIANT_PRICE).
- Emits:
  1. canonical_duplicate_pair_reconciliation.csv (36 rows -> 18 items with dual source references)
  2. canonical_multi_price_holds_reconciliation.csv (14 rows kept on hold with exact variant details)
  3. canonical_catalogue_verified_mappings.csv (23,908 verified canonical items: 23,890 unambiguous + 18 merged duplicates)
  4. catalogue_ingestion_reconciliation_report.json
"""

import csv
import json
import hashlib
from collections import defaultdict
from pathlib import Path
import openpyxl

WORKBOOK_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
CANONICAL_CSV = "data/singapore_food_businesses_canonical.csv"
OUTPUT_DIR = Path("outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_next_round_audit_2026-11-10")

def main():
    print("1. Loading business mappings and directory...")
    lic_to_business = {}
    with open(CANONICAL_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            lic = (r.get("Licence No") or "").strip().upper()
            bid = (r.get("Business ID") or "").strip()
            if lic and bid:
                lic_to_business[lic] = bid

    wb = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    ws_dir = wb["Food Directory"]
    dir_venues = {}
    for r in ws_dir.iter_rows(min_row=2, values_only=True):
        lic = str(r[2] or "").strip().upper()
        v_name = str(r[0] or "").strip()
        v_id = str(r[31] or "").strip() if len(r) > 31 and r[31] else None
        if lic:
            dir_venues[lic] = {"venue_id": v_id, "name": v_name}

    print("2. Scanning Menu & Price for held rows...")
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
            lic_clean = str(licence or "").strip().upper()
            dish_clean = str(dish_name or "").strip()
            bid = lic_to_business.get(lic_clean) or (f"SFA-{lic_clean}" if lic_clean in dir_venues else "")
            canonical_id = f"dsh-menu-{hashlib.md5(f'{bid}:{dish_clean.lower()}'.encode('utf-8')).hexdigest()}" if bid and dish_clean else ""

            held_records.append({
                "workbook_row": row_idx,
                "licence": lic_clean,
                "business_id": bid,
                "canonical_dish_id": canonical_id,
                "venue_name": str(venue_name or "").strip(),
                "dish_name": dish_clean,
                "category": str(category or "").strip(),
                "price": price,
                "hold_type": "quarantine" if is_quarantine else "publication_hold",
                "description": desc_str
            })

    print(f"Total held rows: {len(held_records)}")

    # Group by canonical_dish_id
    id_groups = defaultdict(list)
    for r in held_records:
        id_groups[r["canonical_dish_id"]].append(r)

    unambiguous_items = []
    same_price_groups = []
    multi_price_groups = []

    for cid, rows in id_groups.items():
        if len(rows) == 1:
            unambiguous_items.append(rows[0])
        else:
            prices = [str(r["price"] or "") for r in rows]
            if len(set(prices)) == 1:
                same_price_groups.append(rows)
            else:
                multi_price_groups.append(rows)

    print(f"Unambiguous 1-to-1 rows: {len(unambiguous_items)}")
    print(f"Same-price duplicate groups: {len(same_price_groups)} ({sum(len(g) for g in same_price_groups)} rows)")
    print(f"Multi-price variant groups: {len(multi_price_groups)} ({sum(len(g) for g in multi_price_groups)} rows)")

    # 3. Process 18 Same-Price Duplicate Groups (36 rows -> 18 canonical items)
    duplicate_rows_out = []
    merged_duplicate_items = []

    for group in same_price_groups:
        cid = group[0]["canonical_dish_id"]
        dish_name = group[0]["dish_name"]
        lic = group[0]["licence"]
        bid = group[0]["business_id"]
        price = group[0]["price"]
        cat = group[0]["category"]

        source_rows = [r["workbook_row"] for r in group]
        source_venues = list(dict.fromkeys(r["venue_name"] for r in group))
        source_descs = [f"Row {r['workbook_row']} ({r['venue_name']}): {r['description'][:90]}" for r in group]

        merged_item = {
            "canonical_dish_id": cid,
            "business_id": bid,
            "licence": lic,
            "dish_name": dish_name,
            "category": cat,
            "price": price,
            "hold_scope": "whole_item",
            "hold_reason": f"Publication hold (duplicate source rows merged: {source_rows})",
            "source_workbook_rows": ";".join(str(x) for x in source_rows),
            "source_venues": ";".join(source_venues),
            "merged_row_count": len(group),
            "source_references_retained": " | ".join(source_descs)
        }
        merged_duplicate_items.append(merged_item)

        for idx, r in enumerate(group, 1):
            duplicate_rows_out.append({
                "canonical_dish_id": cid,
                "business_id": bid,
                "licence": lic,
                "dish_name": dish_name,
                "price": price,
                "pair_role": f"source_reference_{idx}_of_{len(group)}",
                "workbook_row": r["workbook_row"],
                "venue_name": r["venue_name"],
                "source_references": f"Row {r['workbook_row']} under '{r['venue_name']}'",
                "original_description": r["description"][:120]
            })

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dup_csv = OUTPUT_DIR / "canonical_duplicate_pair_reconciliation.csv"
    with open(dup_csv, "w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "canonical_dish_id", "business_id", "licence", "dish_name", "price",
            "pair_role", "workbook_row", "venue_name", "source_references", "original_description"
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in duplicate_rows_out:
            writer.writerow(r)
    print(f"Saved duplicate reconciliation CSV: {dup_csv}")

    # 4. Process 7 Multi-Price Variant Groups (14 rows kept on hold)
    multi_price_rows_out = []
    for group in multi_price_groups:
        cid = group[0]["canonical_dish_id"]
        dish_name = group[0]["dish_name"]
        lic = group[0]["licence"]
        bid = group[0]["business_id"]

        prices = [float(r["price"]) for r in group]
        price_diff = max(prices) - min(prices)

        for r in group:
            multi_price_rows_out.append({
                "canonical_dish_id": cid,
                "business_id": bid,
                "licence": lic,
                "dish_name": dish_name,
                "workbook_row": r["workbook_row"],
                "venue_name": r["venue_name"],
                "row_price": r["price"],
                "all_group_prices": "/".join(f"{p:.2f}" for p in prices),
                "price_variance": f"SGD {price_diff:.2f}",
                "hold_disposition": "HOLD_VARIANT_PRICE",
                "hold_reason": f"Disputed multi-price variant across rows {[x['workbook_row'] for x in group]}",
                "description": r["description"][:120]
            })

    multi_csv = OUTPUT_DIR / "canonical_multi_price_holds_reconciliation.csv"
    with open(multi_csv, "w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "canonical_dish_id", "business_id", "licence", "dish_name", "workbook_row",
            "venue_name", "row_price", "all_group_prices", "price_variance",
            "hold_disposition", "hold_reason", "description"
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in multi_price_rows_out:
            writer.writerow(r)
    print(f"Saved multi-price holds reconciliation CSV: {multi_csv}")

    # 5. Build Verified Canonical Mappings for Ingestion (23,890 unambiguous + 18 merged duplicate items = 23,908 items)
    verified_mappings = []

    # Add unambiguous rows
    for r in unambiguous_items:
        verified_mappings.append({
            "canonical_dish_id": r["canonical_dish_id"],
            "business_id": r["business_id"],
            "licence": r["licence"],
            "dish_name": r["dish_name"],
            "category": r["category"],
            "price": r["price"],
            "hold_scope": "whole_item",
            "hold_reason": "Publication hold (single confirmed outlet row)" if r["hold_type"] == "publication_hold" else "Quarantine pending authentic menu",
            "source_workbook_rows": str(r["workbook_row"]),
            "source_venues": r["venue_name"],
            "merged_row_count": 1,
            "source_references_retained": f"Row {r['workbook_row']} ({r['venue_name']})"
        })

    # Add merged duplicate items
    verified_mappings.extend(merged_duplicate_items)

    verified_mappings.sort(key=lambda x: (x["licence"], x["dish_name"].lower()))

    verified_csv = OUTPUT_DIR / "canonical_catalogue_verified_mappings.csv"
    with open(verified_csv, "w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "canonical_dish_id", "business_id", "licence", "dish_name", "category",
            "price", "hold_scope", "hold_reason", "source_workbook_rows", "source_venues",
            "merged_row_count", "source_references_retained"
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in verified_mappings:
            writer.writerow(r)
    print(f"Saved verified canonical mappings CSV ({len(verified_mappings)} items): {verified_csv}")

    # 6. Generate JSON Report
    report = {
        "workbook": WORKBOOK_PATH,
        "total_source_held_rows": len(held_records),
        "unambiguous_rows_verified": len(unambiguous_items),
        "same_price_duplicate_rows": sum(len(g) for g in same_price_groups),
        "same_price_duplicate_items_merged": len(same_price_groups),
        "multi_price_variant_rows_held": sum(len(g) for g in multi_price_groups),
        "multi_price_groups_count": len(multi_price_groups),
        "total_verified_canonical_items_for_ingestion": len(verified_mappings),
        "breakdown": {
            "unambiguous_single_row_items": len(unambiguous_items),
            "merged_duplicate_items_retaining_both_references": len(merged_duplicate_items),
            "excluded_held_multi_price_rows": len(multi_price_rows_out)
        },
        "multi_price_hold_groups": [
            {
                "canonical_dish_id": g[0]["canonical_dish_id"],
                "licence": g[0]["licence"],
                "dish_name": g[0]["dish_name"],
                "rows": [x["workbook_row"] for x in g],
                "prices": [float(x["price"]) for x in g],
                "disposition": "HOLD_VARIANT_PRICE"
            }
            for g in multi_price_groups
        ]
    }

    report_path = OUTPUT_DIR / "catalogue_ingestion_reconciliation_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Saved catalogue ingestion reconciliation report JSON: {report_path}")

if __name__ == "__main__":
    main()
