#!/usr/bin/env python3
"""
apply_post_remediation_audit_fixes.py

Resolves the prioritized issues identified in Post-remediation Audit.md:
1. Chicky Fun variant pricing (7 rows):
   - Clears Price (SGD) to None for all 7 variant rows (103187, 103188, 103194, 103195, 103196, 103201, 103202).
   - Removes generated generic range prefixes from descriptions, restoring authentic dish text.
2. Starting-price notes (38 rows):
   - Removes generated '[Price note: from S$...]' prefixes from Description/Notes across all 38 rows.
   - Price (SGD) remains None (cleared).
3. Newton 32 cross-stall quarantine:
   - Rows 103217-103220 in Menu & Price: clears Price (SGD) to None, sets Last Verified Date to None,
     prepends '[QUARANTINED: Disputed Newton 51 cross-stall price/item pending authentic Newton 32 menu]' to Description/Notes.
   - Food Directory row 41565 (NTF0132003): clears Newton 51 y2ny listing image URL to None.
4. Worksheet presentation:
   - Restores freeze_panes = 'A2' on Menu & Price worksheet.
   - Restores dark green header formatting (Calibri 11 bold white text, solid #163A37 fill) on row 1.
5. Verifies ZIP integrity, formula tags == 0, error cells == 0, and atomically saves.
"""

import os, sys, hashlib, zipfile, openpyxl, csv, bisect, re
from openpyxl.styles import Font, PatternFill

root = "/Users/Siew Hean/Documents/GitHub/Hungry"
wb_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx")
temp_wb_path = wb_path + ".tmp_post_audit_fixes"

def calc_sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

print("Initial master workbook SHA-256:", calc_sha(wb_path))

# Load deletion manifest for accurate row mapping
deleted_rows = []
manifest_csv = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/duplicate_removal_manifest.csv")
with open(manifest_csv) as f:
    for row in csv.DictReader(f):
        deleted_rows.append(int(row["Original CSV Line"]))
deleted_rows.sort()

def pre_to_post(pre_r):
    if pre_r in set(deleted_rows):
        return None
    cnt = bisect.bisect_left(deleted_rows, pre_r)
    return pre_r - cnt

# Load 38 from-notes rows from field_evidence.csv
evidence_csv = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/field_evidence.csv")
from_rows_post = set()
with open(evidence_csv) as f:
    for row in csv.DictReader(f):
        if row["issue"] in ("different_from_amount_in_notes", "exact_price_cell_equals_noted_from_amount"):
            pre_r = int(row["workbook_row"])
            post_r = pre_to_post(pre_r)
            if post_r:
                from_rows_post.add(post_r)

print(f"Loaded {len(from_rows_post)} from-notes rows mapped to post-remediation coordinates (expected 38)")

# Load workbook
print("Loading workbook...")
wb = openpyxl.load_workbook(wb_path)
ws_menu = wb["Menu & Price"]
ws_dir = wb["Food Directory"]

mh = {str(c or "").strip(): i for i, c in enumerate(next(ws_menu.iter_rows(min_row=1, max_row=1, values_only=True)))}
dh = {str(c or "").strip(): i for i, c in enumerate(next(ws_dir.iter_rows(min_row=1, max_row=1, values_only=True)))}

# 1. Chicky Fun variant pricing (7 rows)
# Current rows: 103187, 103188, 103194, 103195, 103196, 103201, 103202
chicky_rows = [103187, 103188, 103194, 103195, 103196, 103201, 103202]
chicky_fixed = 0
for r_idx in chicky_rows:
    lic = ws_menu.cell(row=r_idx, column=mh["SFA Licence"] + 1).value
    dish = ws_menu.cell(row=r_idx, column=mh["Menu Item / Dish Name"] + 1).value
    if str(lic or "").strip().upper() == "S97091V011":
        # Clear fixed price
        ws_menu.cell(row=r_idx, column=mh["Price (SGD)"] + 1).value = None
        # Clean description of generated range prefix
        cur_d = str(ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value or "")
        clean_d = re.sub(r"^\[Price note: [^\]]+\]\s*", "", cur_d).strip()
        ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value = clean_d if clean_d else None
        chicky_fixed += 1

print(f"Chicky Fun variant rows updated: {chicky_fixed}/7")

# 2. Starting-price notes (38 rows)
from_notes_cleaned = 0
for r_idx in from_rows_post:
    cur_d = str(ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value or "")
    clean_d = re.sub(r"^\[Price note: from S\$[0-9.]+\]\s*", "", cur_d).strip()
    ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value = clean_d if clean_d else None
    ws_menu.cell(row=r_idx, column=mh["Price (SGD)"] + 1).value = None
    from_notes_cleaned += 1

print(f"From-notes rows cleaned of generated prefix: {from_notes_cleaned}/38")

# 3. Newton 32 cross-stall quarantine
# Menu rows 103217 - 103220
newton_menu_quarantined = 0
for r_idx in range(103217, 103221):
    lic = ws_menu.cell(row=r_idx, column=mh["SFA Licence"] + 1).value
    if str(lic or "").strip().upper() == "NTF0132003":
        ws_menu.cell(row=r_idx, column=mh["Price (SGD)"] + 1).value = None
        ws_menu.cell(row=r_idx, column=mh["Last Verified Date"] + 1).value = None
        cur_d = str(ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value or "").strip()
        if "[QUARANTINED:" not in cur_d:
            ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value = f"[QUARANTINED: Disputed Newton 51 cross-stall price/item pending authentic Newton 32 menu] {cur_d}".strip()
        newton_menu_quarantined += 1

print(f"Newton 32 menu rows quarantined: {newton_menu_quarantined}/4")

# Food Directory row 41565 (NTF0132003)
newton_dir_cleared = 0
for r_idx in range(41560, 41570):
    lic = ws_dir.cell(row=r_idx, column=dh["SFA Licence"] + 1).value
    venue = ws_dir.cell(row=r_idx, column=dh["F&B Name"] + 1).value
    if str(lic or "").strip().upper() == "NTF0132003" and "Newton 32" in str(venue or ""):
        cur_img = ws_dir.cell(row=r_idx, column=dh["Approved Image URL"] + 1).value
        print(f"Directory row {r_idx}: Clearing Newton 51 image URL '{cur_img}'")
        ws_dir.cell(row=r_idx, column=dh["Approved Image URL"] + 1).value = None
        newton_dir_cleared += 1

print(f"Newton 32 directory images cleared: {newton_dir_cleared}/1")

# 4. Worksheet presentation on Menu & Price
print("Setting freeze_panes and header styling on Menu & Price...")
ws_menu.freeze_panes = "A2"

header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFFFF")
header_fill = PatternFill(fill_type="solid", start_color="FF163A37", end_color="FF163A37")

for col_idx in range(1, len(mh) + 1):
    cell = ws_menu.cell(row=1, column=col_idx)
    cell.font = header_font
    cell.fill = header_fill

print("Presentation properties restored.")

# 5. Save atomically
print("Saving modified workbook to temporary path...")
wb.save(temp_wb_path)

# 6. Integrity & formula checks
print("Verifying ZIP integrity...")
with zipfile.ZipFile(temp_wb_path, "r") as z:
    bad_file = z.testzip()
    if bad_file:
        raise ValueError(f"Corrupted ZIP member: {bad_file}")
    print("ZIP integrity: PASS")

    # Formula tags and error cells
    formula_count = 0
    error_cell_count = 0
    for name in z.namelist():
        if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
            data = z.read(name).decode("utf-8")
            formula_count += data.count("<f>") + data.count("<f ")
            error_cell_count += data.count('t="e"')

    print(f"Raw XML Formula tags: {formula_count}, Error cells: {error_cell_count}")
    if formula_count > 0 or error_cell_count > 0:
        raise ValueError("Formula tags or error cells detected!")

# 7. Atomic replacement
os.replace(temp_wb_path, wb_path)
final_sha = calc_sha(wb_path)
final_size = os.path.getsize(wb_path)
print(f"Successfully replaced master workbook!")
print(f"Final SHA-256: {final_sha} ({final_size} bytes)")
