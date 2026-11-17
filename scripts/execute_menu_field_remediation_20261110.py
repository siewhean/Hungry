#!/usr/bin/env python3
"""
execute_menu_field_remediation_20261110.py
Executes the Menu Field Remediation Plan on the master workbook:
1. Dietary contradictions (96 rows in field_evidence.csv): suppress conflicting positive claims (Halal, Pork-free).
2. Sloppy Shack (72 rows, 1720-1791, NE08128A000): clear Magic Wok prices to None, mark Description as quarantined.
3. Unit discrepancies (1,011 rows across 21 licences): harmonize Address to official Food Directory registered address.
4. Literal spaces in image URLs (134 rows in Burger King): replace space with %20.
5. Literal N/A descriptions (10 rows in Tenderbest): set to None.
6. Chicky Fun variant pricing (7 rows): set Price (SGD) to None, record variant note.
7. 'From' text in notes alongside fixed prices (38 rows in field_evidence.csv): set Price (SGD) to None, preserve note.
8. Deduplication of 348 exact duplicate pairs (696 rows): remove the duplicate row, log manifest.
"""

import os, sys, hashlib, zipfile, openpyxl, csv, json

root = "/Users/Siew Hean/Documents/GitHub/Hungry"
wb_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx")
temp_wb_path = wb_path + ".tmp_field_remed"

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

dir_addresses = {}
target_21_lics = {
    "CE20C52N000", "CE11Q35A000", "CE14G17X000", "CE04427J000", "B02080L000",
    "W00346X000", "CE07F22P000", "W94258E000", "NE12G65C000", "NE18265X000",
    "CE08915V000", "J88031A000", "SE14C24K000", "C82221B001", "SW16F04B000",
    "NE12I47X000", "CE10D21K000", "SW09255A000", "SE07377B000", "NE13M55J000",
    "CE25G86X000"
}

for row in fd.iter_rows(min_row=2, values_only=True):
    lic = str(row[fd_lic_idx] or "").strip().upper()
    if lic in target_21_lics:
        addr = str(row[fd_addr_idx] or "").strip()
        post = str(row[fd_post_idx] or "").strip()
        if addr:
            dir_addresses[lic] = (addr, post)

print(f"Loaded directory official addresses for {len(dir_addresses)} licences")

# 4. Load exact duplicate row pairs from workbook_findings.csv
duplicate_rows_to_remove = set()
with open(os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/workbook_findings.csv")) as f:
    r = csv.DictReader(f)
    for row in r:
        finding = row.get("\ufefffinding") or row.get("finding")
        if finding == "EXACT_DUPLICATE_ROW":
            related = [int(x.strip()) for x in row["related_rows"].split(",") if x.strip()]
            if len(related) == 2:
                # remove the second row
                duplicate_rows_to_remove.add(max(related))

print(f"Identified {len(duplicate_rows_to_remove)} duplicate rows to remove (expected 348)")

# Track remediation counts
dietary_fixed = 0
from_notes_fixed = 0
sloppy_quarantined = 0
unit_harmonized = 0
spaces_encoded = 0
na_descs_cleaned = 0
chicky_fun_fixed = 0

for row_idx, row in enumerate(ws.iter_rows(min_row=2), start=2):
    # A. Dietary claims contradiction
    if row_idx in dietary_rows_to_fix:
        halal_cell = row[h["Halal"]]
        pork_free_cell = row[h["Pork-free"]]
        if str(halal_cell.value or "").strip().lower() == "yes":
            halal_cell.value = "No"
        if str(pork_free_cell.value or "").strip().lower() == "yes":
            pork_free_cell.value = "No"
        dietary_fixed += 1

    # B. From-notes price fix
    if row_idx in from_notes_rows_to_fix:
        p_cell = row[h["Price (SGD)"]]
        d_cell = row[h["Description / Notes"]]
        cur_p = str(p_cell.value or "").strip()
        cur_d = str(d_cell.value or "").strip()
        if cur_p:
            p_cell.value = None
            if f"Price note: from S${cur_p}" not in cur_d:
                d_cell.value = f"[Price note: from S${cur_p}] {cur_d}" if cur_d else f"[Price note: from S${cur_p}]"
            from_notes_fixed += 1

    # C. Sloppy Shack (NE08128A000, rows 1720-1791)
    lic_val = str(row[h["SFA Licence"]].value or "").strip().upper()
    if lic_val == "NE08128A000":
        p_cell = row[h["Price (SGD)"]]
        d_cell = row[h["Description / Notes"]]
        if p_cell.value is not None:
            p_cell.value = None
            orig_d = str(d_cell.value or "").strip()
            if "[QUARANTINED" not in orig_d:
                d_cell.value = f"[QUARANTINED: Disputed Magic Wok cross-stall price/item pending authentic Sloppy Shack menu] {orig_d}".strip()
            sloppy_quarantined += 1

    # D. Chicky Fun (S97091V011, variant rows around 103535)
    if lic_val == "S97091V011":
        d_val = str(row[h["Description / Notes"]].value or "").strip()
        p_cell = row[h["Price (SGD)"]]
        item_val = str(row[h["Menu Item / Dish Name"]].value or "").strip()
        if "Steamed Chicken Rice" in item_val or "Roast Chicken Rice" in item_val:
            if p_cell.value is not None and "variant" not in d_val.lower():
                cur_p = str(p_cell.value or "").strip()
                p_cell.value = None
                row[h["Description / Notes"]].value = f"[Price note: variants S$3.80 - S$4.30] {d_val}".strip()
                chicky_fun_fixed += 1

    # E. Unit discrepancies (21 licences)
    if lic_val in dir_addresses:
        addr_cell = row[h["Address"]]
        post_cell = row[h["Postal Code"]]
        new_addr, new_post = dir_addresses[lic_val]
        if str(addr_cell.value or "").strip() != new_addr:
            addr_cell.value = new_addr
            if new_post and not str(post_cell.value or "").strip():
                post_cell.value = new_post
            unit_harmonized += 1

    # F. Image URLs with spaces (Burger King)
    img_cell = row[h["Dish Image URL"]]
    img_val = str(img_cell.value or "").strip()
    if " " in img_val:
        img_cell.value = img_val.replace(" ", "%20")
        spaces_encoded += 1

    # G. N/A descriptions
    desc_cell = row[h["Description / Notes"]]
    desc_val = str(desc_cell.value or "").strip()
    if desc_val.upper() in ("N/A", "NA"):
        desc_cell.value = None
        na_descs_cleaned += 1

print(f"Remediation counts before deduplication:")
print(f"  Dietary contradictions fixed: {dietary_fixed} (expected 96)")
print(f"  From-notes prices cleared: {from_notes_fixed} (expected 38)")
print(f"  Sloppy Shack rows quarantined: {sloppy_quarantined} (expected 72)")
print(f"  Unit addresses harmonized: {unit_harmonized} (expected 1011)")
print(f"  Image URL spaces encoded: {spaces_encoded} (expected 134)")
print(f"  N/A descriptions cleaned: {na_descs_cleaned} (expected 10)")
print(f"  Chicky Fun variant rows fixed: {chicky_fun_fixed}")

# 5. Deduplication of 348 exact duplicate rows
# We delete rows from bottom to top to preserve row indices!
manifest_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/duplicate_removal_manifest.csv")
deleted_rows_log = []

for r_idx in sorted(duplicate_rows_to_remove, reverse=True):
    # record deleted row info
    deleted_row_vals = [cell.value for cell in ws[r_idx]]
    deleted_rows_log.append({
        "deleted_row_number": r_idx,
        "licence": deleted_row_vals[h["SFA Licence"]],
        "venue": deleted_row_vals[h["F&B Venue Name"]],
        "dish": deleted_row_vals[h["Menu Item / Dish Name"]],
        "price": deleted_row_vals[h["Price (SGD)"]],
        "category": deleted_row_vals[h["Category / Section"]],
    })
    ws.delete_rows(r_idx)

print(f"Deleted {len(deleted_rows_log)} exact duplicate rows (expected 348)")

with open(manifest_path, "w", encoding="utf-8", newline="") as mf:
    writer = csv.DictWriter(mf, fieldnames=["deleted_row_number", "licence", "venue", "dish", "price", "category"])
    writer.writeheader()
    writer.writerows(deleted_rows_log)

print(f"Logged deletion manifest to {manifest_path}")

# 6. Save and atomic replacement
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
