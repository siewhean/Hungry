#!/usr/bin/env python3
"""
scripts/ingest_foodpanda_api_cache.py

Ingests verified dishes from data/foodpanda_api_cache.jsonl into Document 2
(data/Hungry Full Menu & Price - 21 Oct 2026.csv and .xlsx) with full metadata
crosswalk from Document 1 (data/Hungry_Database_Food_Only_2026-10-21.csv).
"""

import csv
import json
import os
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory
import time

from regenerate_document2_xlsx import export_legacy_menu

DOC1_CSV = "data/Hungry_Database_Food_Only_2026-10-21.csv"
DOC2_CSV = "data/Hungry Full Menu & Price - 21 Oct 2026.csv"
DOC2_XLSX = "data/Hungry Full Menu & Price - 21 Oct 2026.xlsx"
CACHE_JSONL = "data/foodpanda_api_cache.jsonl"
BACKUP_DIR = "data/backups"
LEGACY_COLUMNS = (
    "F&B Venue Name", "SFA Licence", "Address", "Postal Code",
    "Menu Item / Dish Name", "Category / Section", "Price (SGD)",
    "Description / Notes", "Dish Image URL", "Menu Source URL", "Last Verified Date",
    "Halal", "Vegetarian", "Vegan", "Pork-free", "Gluten-free", "Dairy-free",
    "Nut-free", "Beef", "Milk", "Eggs", "Fish", "Crustaceans", "Soy", "Peanuts",
    "Tree nuts", "Wheat", "Intolerances",
)


def main():
    print(f"[Ingest] Starting ingestion from {CACHE_JSONL} into Document 2...")

    # 1. Back up Document 2
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    bak_csv = os.path.join(BACKUP_DIR, f"Hungry Full Menu & Price - 21 Oct 2026_{ts}.csv.bak")
    bak_xlsx = os.path.join(BACKUP_DIR, f"Hungry Full Menu & Price - 21 Oct 2026_{ts}.xlsx.bak")
    shutil.copyfile(DOC2_CSV, bak_csv)
    shutil.copyfile(DOC2_XLSX, bak_xlsx)
    print(f"[Ingest] Backed up Document 2 to {bak_csv}")

    # 2. Load Document 1 metadata
    doc1_meta = {}
    with open(DOC1_CSV, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            lic = r.get("SFA Licence", "").strip()
            if lic:
                doc1_meta[lic] = {
                    "name": r.get("F&B Name", "").strip(),
                    "address": r.get("Full Address", "").strip(),
                    "postal_code": r.get("Postal Code", "").strip(),
                    "halal": r.get("Halal Certified", "Unknown").strip(),
                    "vegan": r.get("Vegan", "Unknown").strip()
                }
    print(f"[Ingest] Loaded metadata for {len(doc1_meta)} stalls from Document 1.")

    # 3. Load existing (SFA Licence, Dish Name) from Document 2 to avoid any duplicates
    existing_pairs = set()
    with open(DOC2_CSV, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, [])
        if tuple(header) != LEGACY_COLUMNS:
            raise ValueError("Document 2 CSV header differs from the legacy ingestion schema")
        lic_idx = header.index("SFA Licence")
        dish_idx = header.index("Menu Item / Dish Name")
        for row in reader:
            if len(row) > max(lic_idx, dish_idx):
                existing_pairs.add((row[lic_idx].strip(), row[dish_idx].strip().lower()))

    print(f"[Ingest] Found {len(existing_pairs)} existing (Licence, Dish Name) keys in Document 2.")

    # 4. Read cache and build rows
    new_rows = []
    stalls_ingested = set()
    skipped_dups = 0

    with open(CACHE_JSONL, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            lic = data.get("sfa_licence", "").strip()
            source_url = data.get("source_url", "").strip()
            items = data.get("items", [])

            meta = doc1_meta.get(lic, {})
            venue_name = meta.get("name") or data.get("stall_name", "").strip()
            address = meta.get("address", "")
            postal_code = meta.get("postal_code", "")
            halal_cert = meta.get("halal", "Unknown")
            vegan_cert = meta.get("vegan", "Unknown")

            for item in items:
                dish_name = item.get("name", "").strip()
                if not dish_name:
                    continue
                pair = (lic, dish_name.lower())
                if pair in existing_pairs:
                    skipped_dups += 1
                    continue

                existing_pairs.add(pair)
                stalls_ingested.add(lic)

                cat = item.get("category", "Mains").strip()
                price = item.get("price_sgd", "").strip()
                desc = item.get("description", "").strip()
                img = item.get("image_url", "").strip()

                # Inferred dietary tags
                is_halal = "Yes" if halal_cert == "Yes" else ("No" if halal_cert == "No" else "Unknown")
                pork_free = "Yes" if is_halal == "Yes" else ""
                is_vegan = "Yes" if vegan_cert == "Yes" else ""
                is_veg = "Yes" if is_vegan == "Yes" else ""

                row = [
                    venue_name,             # F&B Venue Name
                    lic,                    # SFA Licence
                    address,                # Address
                    postal_code,            # Postal Code
                    dish_name,              # Menu Item / Dish Name
                    cat,                    # Category / Section
                    price,                  # Price (SGD)
                    desc,                   # Description / Notes
                    img,                    # Dish Image URL
                    source_url,             # Menu Source URL
                    "2026-10-25",           # Last Verified Date
                    is_halal,               # Halal
                    is_veg,                 # Vegetarian
                    is_vegan,               # Vegan
                    pork_free,              # Pork-free
                    "",                     # Gluten-free
                    "",                     # Dairy-free
                    "",                     # Nut-free
                    "Unknown",              # Beef
                    "Unknown",              # Milk
                    "Unknown",              # Eggs
                    "Unknown",              # Fish
                    "Unknown",              # Crustaceans
                    "Unknown",              # Soy
                    "Unknown",              # Peanuts
                    "Unknown",              # Tree nuts
                    "Unknown",              # Wheat
                    "Not assessed — ingredient list unavailable"  # Intolerances
                ]
                new_rows.append(row)

    print(f"[Ingest] Prepared {len(new_rows)} new dish rows across {len(stalls_ingested)} stalls (skipped {skipped_dups} duplicate keys).")

    if not new_rows:
        print("[Ingest] No new rows to ingest.")
        return

    # Stage both outputs so schema and XLSX validation failures leave Document 2 intact.
    csv_path = Path(DOC2_CSV)
    xlsx_path = Path(DOC2_XLSX)
    with TemporaryDirectory(prefix=".legacy-menu-ingest-", dir=csv_path.parent) as staging:
        staged_csv = Path(staging) / csv_path.name
        staged_xlsx = Path(staging) / xlsx_path.name
        shutil.copyfile(csv_path, staged_csv)
        with staged_csv.open("rb") as f:
            f.seek(-1, os.SEEK_END)
            needs_separator = f.read(1) not in (b"\r", b"\n")
        with staged_csv.open("a", encoding="utf-8-sig", newline="") as f:
            if needs_separator:
                f.write("\r\n")
            csv.writer(f).writerows(new_rows)

        counts = export_legacy_menu(staged_csv, staged_xlsx)
        os.replace(staged_csv, csv_path)
        try:
            os.replace(staged_xlsx, xlsx_path)
        except OSError:
            os.replace(bak_csv, csv_path)
            raise

    print(
        f"[Ingest COMPLETE] Raw CSV: {counts.input_rows:,} | "
        f"Excluded: {counts.excluded_rows:,} | XLSX exported: {counts.exported_rows:,}"
    )


if __name__ == "__main__":
    main()
