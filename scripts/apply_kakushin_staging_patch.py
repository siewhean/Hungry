#!/usr/bin/env python3
"""
apply_kakushin_staging_patch.py

Applies the Kakushin portion notes review patch to a staging copy of the workbook:
- Target rows: 4430, 4431, 4432 in Menu & Price
- Licence: CE22E83L000
- Checks guards: master hash == 7d8d80171a066b470bd0739a8511f257f62661928fc7f7f6ea8ebd4eb22f2d2f
  Prices == 45.00, 78.00, 128.00
  Old Description / Notes == None / empty
- Updates Description / Notes:
  Row 4430: "Portion: 5 pieces for one guest. Dine-in price excludes GST and service charge."
  Row 4431: "Portion: 3 kinds, 9 pieces. Dine-in price excludes GST and service charge."
  Row 4432: "Portion: 5 kinds, 15 pieces. Dine-in price excludes GST and service charge."
- Preserves freeze_panes = 'A2' and row 1 header formatting.
- Verifies ZIP integrity and 0 XML formulas / error cells.
- Verifies exact 3-cell diff between source and patched copy.
"""

import os, sys, hashlib, zipfile, openpyxl, csv, shutil
from openpyxl.styles import Font, PatternFill

root = "/Users/Siew Hean/Documents/GitHub/Hungry"
master_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx")
work_dir = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_next_round_audit_2026-11-10")
staged_path = os.path.join(work_dir, "staged_kakushin_patch.xlsx")
patch_csv = os.path.join(work_dir, "kakushin_portion_review_patch.csv")

def calc_sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

master_sha = calc_sha(master_path)
print("Master SHA-256:", master_sha)
expected_master_sha = "7d8d80171a066b470bd0739a8511f257f62661928fc7f7f6ea8ebd4eb22f2d2f"
if master_sha != expected_master_sha:
    raise ValueError(f"Master SHA mismatch! Expected {expected_master_sha}, got {master_sha}")

# Load patch rules
patch_records = []
with open(patch_csv, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        patch_records.append(row)

print(f"Loaded {len(patch_records)} patch rules from {patch_csv}")

# Fresh copy from master to staged
shutil.copyfile(master_path, staged_path)
print("Fresh staged copy created.")

wb = openpyxl.load_workbook(staged_path)
ws_menu = wb["Menu & Price"]
mh = {str(c or "").strip(): i for i, c in enumerate(next(ws_menu.iter_rows(min_row=1, max_row=1, values_only=True)))}

# Verify and apply patch
applied_count = 0
for rule in patch_records:
    r_idx = int(rule["current_row"])
    expected_lic = rule["licence"].strip().upper()
    expected_dish = rule["dish"].strip()
    expected_price = float(rule["price_sgd_guard"])
    proposed_notes = rule["proposed_value"].strip()

    actual_lic = str(ws_menu.cell(row=r_idx, column=mh["SFA Licence"] + 1).value or "").strip().upper()
    actual_dish = str(ws_menu.cell(row=r_idx, column=mh["Menu Item / Dish Name"] + 1).value or "").strip()
    actual_price_raw = ws_menu.cell(row=r_idx, column=mh["Price (SGD)"] + 1).value
    actual_price = float(actual_price_raw)
    actual_notes = ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value

    print(f"Checking row {r_idx}: actual_lic={actual_lic}, actual_dish={actual_dish}, actual_price={actual_price}, actual_notes={actual_notes}")

    assert actual_lic == expected_lic, f"Row {r_idx} licence mismatch: {actual_lic} != {expected_lic}"
    assert actual_dish == expected_dish, f"Row {r_idx} dish mismatch: {actual_dish} != {expected_dish}"
    assert abs(actual_price - expected_price) < 0.001, f"Row {r_idx} price mismatch: {actual_price} != {expected_price}"
    assert actual_notes is None or str(actual_notes).strip() == "", f"Row {r_idx} existing notes not empty: {actual_notes}"

    # Apply proposed notes
    ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value = proposed_notes
    applied_count += 1

print(f"Successfully applied {applied_count}/3 patch rules.")

# Preserve presentation
ws_menu.freeze_panes = "A2"
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFFFF")
header_fill = PatternFill(fill_type="solid", start_color="FF163A37", end_color="FF163A37")
for col_idx in range(1, len(mh) + 1):
    cell = ws_menu.cell(row=1, column=col_idx)
    cell.font = header_font
    cell.fill = header_fill

# Save staged workbook
tmp_staged = staged_path + ".tmp"
wb.save(tmp_staged)

# Verify ZIP integrity and XML health
with zipfile.ZipFile(tmp_staged, "r") as z:
    bad_file = z.testzip()
    if bad_file:
        raise ValueError(f"Corrupted ZIP member: {bad_file}")
    formula_count = 0
    error_cell_count = 0
    for name in z.namelist():
        if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
            data = z.read(name).decode("utf-8")
            formula_count += data.count("<f>") + data.count("<f ")
            error_cell_count += data.count('t="e"')
    print(f"Staged ZIP integrity: PASS | Raw XML Formula tags: {formula_count}, Error cells: {error_cell_count}")
    if formula_count > 0 or error_cell_count > 0:
        raise ValueError("Formula tags or error cells detected in staged workbook!")

os.replace(tmp_staged, staged_path)
staged_sha = calc_sha(staged_path)
staged_size = os.path.getsize(staged_path)
print(f"Patched staged workbook SHA-256: {staged_sha} ({staged_size} bytes)")

# Perform precise read-back verification across master and staged
wb_orig = openpyxl.load_workbook(master_path, read_only=True)
wb_patched = openpyxl.load_workbook(staged_path, read_only=True)

diffs = []
for sheetname in wb_orig.sheetnames:
    so = wb_orig[sheetname]
    sp = wb_patched[sheetname]
    for r_idx, (ro, rp) in enumerate(zip(so.iter_rows(values_only=True), sp.iter_rows(values_only=True)), start=1):
        for c_idx, (vo, vp) in enumerate(zip(ro, rp), start=1):
            if vo != vp:
                diffs.append((sheetname, r_idx, c_idx, vo, vp))

print(f"Total cell differences between master and staged workbook: {len(diffs)}")
for d in diffs:
    col_name = list(mh.keys())[d[2]-1] if d[0] == "Menu & Price" and d[2]-1 < len(mh) else str(d[2])
    print(f"  Sheet '{d[0]}', Row {d[1]}, Col {d[2]} ({col_name}): '{d[3]}' -> '{d[4]}'")

assert len(diffs) == 3, f"Expected exactly 3 cell differences, found {len(diffs)}!"
print("Exact 3-cell difference assertion verified successfully!")
