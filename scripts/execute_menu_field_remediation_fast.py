#!/usr/bin/env python3
"""
execute_menu_field_remediation_fast.py
High-performance execution of Menu Field Remediation Plan on master workbook:
1. Dietary contradictions (96 rows in field_evidence.csv): suppress conflicting positive claims (Halal, Pork-free).
2. Sloppy Shack (72 rows, NE08128A000): clear Magic Wok prices to None, mark Description as quarantined.
3. Unit discrepancies (1,011 rows across 21 licences): harmonize Address to official Food Directory registered address.
4. Literal spaces in image URLs (134 rows in Burger King): replace space with %20.
5. Literal N/A descriptions (10 rows in Tenderbest): set to None.
6. Chicky Fun variant pricing (7 rows): set Price (SGD) to None, record variant note.
7. 'From' text in notes alongside fixed prices (38 rows in field_evidence.csv): set Price (SGD) to None, preserve note.
8. Deduplication of 348 exact duplicate pairs (696 rows): remove the duplicate row, log to Row Deletion Manifest and CSV.
Uses fast sheet replacement to complete in seconds without cell coordinate shift bottlenecks.
"""

import os, sys, hashlib, zipfile, openpyxl, csv, json

root = "/Users/Siew Hean/Documents/GitHub/Hungry"
wb_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx")
temp_wb_path = wb_path + ".tmp_fast_remed"

def calc_sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

print("Initial SHA-256:", calc_sha(wb_path))

wb = openpyxl.load_workbook(wb_path)
ws = wb["Menu & Price"]

headers = [str(c or "").strip() for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
h = {k: i for i, k in enumerate(headers)}

# 1. Load 96 dietary contradiction rows from field_evidence.csv
dietary_rows_to_fix = set()
with open(os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/field_evidence.csv")) as f:
    r = csv.DictReader(f)
    for row in r:
        if row["issue"] == "pork_or_lard_text_vs_halal_or_pork_free":
            dietary_rows_to_fix.add(int(row["workbook_row"]))

print(f"Loaded {len(dietary_rows_to_fix)} dietary contradiction row indices")

# 2. Load 38 from-notes rows from field_evidence.csv
from_notes_rows_to_fix = set()
with open(os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/field_evidence.csv")) as f:
    r = csv.DictReader(f)
    for row in r:
        if row["issue"] in ("different_from_amount_in_notes", "exact_price_cell_equals_noted_from_amount"):
            from_notes_rows_to_fix.add(int(row["workbook_row"]))

print(f"Loaded {len(from_notes_rows_to_fix)} from-notes row indices")

# 3. Load official directory addresses for the 21 unit-conflict licences
fd = wb["Food Directory"]
fd_headers = [str(c or "").strip() for c in next(fd.iter_rows(min_row=1, max_row=1, values_only=True))]
fd_lic_idx = fd_headers.index("SFA Licence")
fd_addr_idx = fd_headers.index("Full Address")
fd_post_idx = fd_headers.index("Postal Code")

target_21_lics = {
    "CE20C52N000", "CE11Q35A000", "CE14G17X000", "CE04427J000", "B02080L000",
    "W00346X000", "CE07F22P000", "W94258E000", "NE12G65C000", "NE18265X000",
    "CE08915V000", "J88031A000", "SE14C24K000", "C82221B001", "SW16F04B000",
    "NE12I47X000", "CE10D21K000", "SW09255A000", "SE07377B000", "NE13M55J000",
    "CE25G86X000"
}

dir_addresses = {}
for row in fd.iter_rows(min_row=2, values_only=True):
    lic = str(row[fd_lic_idx] or "").strip().upper()
    if lic in target_21_lics:
        addr = str(row[fd_addr_idx] or "").strip()
        post = str(row[fd_post_idx] or "").strip()
        if addr:
            dir_addresses[lic] = (addr, post)

print(f"Loaded directory official addresses for {len(dir_addresses)} licences")

# 4. Load exact duplicate row pairs from workbook_findings.csv
duplicate_pairs = {}
duplicate_rows_to_remove = set()
with open(os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/workbook_findings.csv")) as f:
    r = csv.DictReader(f)
    for row in r:
        finding = row.get("\ufefffinding") or row.get("finding")
        if finding == "EXACT_DUPLICATE_ROW":
            related = [int(x.strip()) for x in row["related_rows"].split(",") if x.strip()]
            if len(related) == 2:
                retained_r = min(related)
                deleted_r = max(related)
                duplicate_rows_to_remove.add(deleted_r)
                duplicate_pairs[deleted_r] = retained_r

print(f"Identified {len(duplicate_rows_to_remove)} duplicate rows to remove (expected 348)")

# Create new sheet at index 2 (replacing Menu & Price position)
ws_new = wb.create_sheet(title="Menu & Price_new", index=2)
# Append header
ws_new.append(headers)

# Track remediation counts
dietary_fixed = 0
from_notes_fixed = 0
sloppy_quarantined = 0
unit_harmonized = 0
spaces_encoded = 0
na_descs_cleaned = 0
chicky_fun_fixed = 0
deleted_manifest_entries = []

last_del_num = 521
del_manifest_ws = wb["Row Deletion Manifest"]

for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    # Check if this row is a duplicate to be deleted
    if row_idx in duplicate_rows_to_remove:
        last_del_num += 1
        retained_row_idx = duplicate_pairs[row_idx]
        del_entry = {
            "Event ID": f"DEL-{last_del_num:04d}",
            "Dataset": "Menu & Price",
            "Original CSV Line": str(row_idx),
            "Retained CSV Line": str(retained_row_idx),
            "Stable Row ID Deleted": f"MENU-{row[h['SFA Licence']]}-{row_idx:06d}",
            "Stable Row ID Retained": f"MENU-{row[h['SFA Licence']]}-{retained_row_idx:06d}",
            "Reason": "Exact duplicate row matching across all 28 fields; retained the earlier complete record.",
            "Evidence Date": "2026-11-10"
        }
        deleted_manifest_entries.append(del_entry)
        del_manifest_ws.append([
            del_entry["Event ID"], del_entry["Dataset"], del_entry["Original CSV Line"],
            del_entry["Retained CSV Line"], del_entry["Stable Row ID Deleted"],
            del_entry["Stable Row ID Retained"], del_entry["Reason"], del_entry["Evidence Date"]
        ])
        continue  # skip appending duplicate row!

    # Copy row values to a mutable list
    row_vals = list(row)

    # A. Dietary claims contradiction
    if row_idx in dietary_rows_to_fix:
        if str(row_vals[h["Halal"]] or "").strip().lower() == "yes":
            row_vals[h["Halal"]] = "No"
        if str(row_vals[h["Pork-free"]] or "").strip().lower() == "yes":
            row_vals[h["Pork-free"]] = "No"
        dietary_fixed += 1

    # B. From-notes price fix
    if row_idx in from_notes_rows_to_fix:
        cur_p = str(row_vals[h["Price (SGD)"]] or "").strip()
        cur_d = str(row_vals[h["Description / Notes"]] or "").strip()
        if cur_p:
            row_vals[h["Price (SGD)"]] = None
            if f"Price note: from S${cur_p}" not in cur_d:
                row_vals[h["Description / Notes"]] = f"[Price note: from S${cur_p}] {cur_d}" if cur_d else f"[Price note: from S${cur_p}]"
            from_notes_fixed += 1

    # C. Sloppy Shack (NE08128A000, rows 1720-1791)
    lic_val = str(row_vals[h["SFA Licence"]] or "").strip().upper()
    if lic_val == "NE08128A000":
        if row_vals[h["Price (SGD)"]] is not None:
            row_vals[h["Price (SGD)"]] = None
            orig_d = str(row_vals[h["Description / Notes"]] or "").strip()
            if "[QUARANTINED" not in orig_d:
                row_vals[h["Description / Notes"]] = f"[QUARANTINED: Disputed Magic Wok cross-stall price/item pending authentic Sloppy Shack menu] {orig_d}".strip()
            sloppy_quarantined += 1

    # D. Chicky Fun (S97091V011, variant rows around 103535)
    if lic_val == "S97091V011":
        d_val = str(row_vals[h["Description / Notes"]] or "").strip()
        item_val = str(row_vals[h["Menu Item / Dish Name"]] or "").strip()
        if "Steamed Chicken Rice" in item_val or "Roast Chicken Rice" in item_val:
            if row_vals[h["Price (SGD)"]] is not None and "variant" not in d_val.lower():
                cur_p = str(row_vals[h["Price (SGD)"]] or "").strip()
                row_vals[h["Price (SGD)"]] = None
                row_vals[h["Description / Notes"]] = f"[Price note: variants S$3.80 - S$4.30] {d_val}".strip()
                chicky_fun_fixed += 1

    # E. Unit discrepancies (21 licences)
    if lic_val in dir_addresses:
        new_addr, new_post = dir_addresses[lic_val]
        if str(row_vals[h["Address"]] or "").strip() != new_addr:
            row_vals[h["Address"]] = new_addr
            if new_post and not str(row_vals[h["Postal Code"]] or "").strip():
                row_vals[h["Postal Code"]] = new_post
            unit_harmonized += 1

    # F. Image URLs with spaces (Burger King)
    img_val = str(row_vals[h["Dish Image URL"]] or "").strip()
    if " " in img_val:
        row_vals[h["Dish Image URL"]] = img_val.replace(" ", "%20")
        spaces_encoded += 1

    # G. N/A descriptions
    desc_val = str(row_vals[h["Description / Notes"]] or "").strip()
    if desc_val.upper() in ("N/A", "NA"):
        row_vals[h["Description / Notes"]] = None
        na_descs_cleaned += 1

    # Append row to new worksheet
    ws_new.append(row_vals)

print(f"Applied all transformations:")
print(f"  Dietary contradictions fixed: {dietary_fixed} (expected 96)")
print(f"  From-notes prices cleared: {from_notes_fixed} (expected 38)")
print(f"  Sloppy Shack rows quarantined: {sloppy_quarantined} (expected 72)")
print(f"  Unit addresses harmonized: {unit_harmonized} (expected 1011)")
print(f"  Image URL spaces encoded: {spaces_encoded} (expected 134)")
print(f"  N/A descriptions cleaned: {na_descs_cleaned} (expected 10)")
print(f"  Chicky Fun variant rows fixed: {chicky_fun_fixed}")
print(f"  Exact duplicate rows removed: {len(deleted_manifest_entries)} (expected 348)")
print(f"  New Menu & Price row count: {ws_new.max_row} (expected 123,341 including header)")

# Replace old Menu & Price with new sheet
wb.remove(ws)
ws_new.title = "Menu & Price"

# Save external CSV manifest
manifest_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/duplicate_removal_manifest.csv")
with open(manifest_path, "w", encoding="utf-8", newline="") as mf:
    writer = csv.DictWriter(mf, fieldnames=["Event ID", "Dataset", "Original CSV Line", "Retained CSV Line", "Stable Row ID Deleted", "Stable Row ID Retained", "Reason", "Evidence Date"])
    writer.writeheader()
    writer.writerows(deleted_manifest_entries)
print(f"Saved duplicate removal manifest to {manifest_path}")

# Atomic save
print("Saving updated master workbook to temporary file...")
wb.save(temp_wb_path)

print("Verifying ZIP integrity of temporary workbook...")
with zipfile.ZipFile(temp_wb_path) as z:
    if z.testzip() is not None:
        raise RuntimeError("Corrupted zipfile in temporary workbook!")

os.replace(temp_wb_path, wb_path)
new_sha = calc_sha(wb_path)
new_size = os.path.getsize(wb_path)
print(f"Successfully remediated workbook!\nNew SHA-256: {new_sha}\nNew Size: {new_size} bytes")
