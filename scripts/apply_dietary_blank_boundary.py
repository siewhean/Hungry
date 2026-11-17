#!/usr/bin/env python3
"""
apply_dietary_blank_boundary.py
Applies the evidence boundary for dietary fields per user directive:
- "No is an explicit claim. Where the evidence only invalidated a prior Yes,
  keep the field blank or on hold until the exact dish and outlet evidence supports No."
- Uses the deletion manifest to map pre-remediation row numbers from field_evidence.csv
  to current post-remediation row numbers.
- Carries forward the boundary that the 72 Sloppy Shack rows remain quarantined.
- Verifies ZIP integrity and formula/XML cleanliness before atomic replacement.
"""

import os, sys, hashlib, zipfile, openpyxl, csv, bisect, json

root = "/Users/Siew Hean/Documents/GitHub/Hungry"
wb_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx")
temp_wb_path = wb_path + ".tmp_dietary_blank"

def calc_sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

print("Initial master workbook SHA-256:", calc_sha(wb_path))

# 1. Load deletion manifest
deleted_rows = []
manifest_csv = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/duplicate_removal_manifest.csv")
with open(manifest_csv) as f:
    for row in csv.DictReader(f):
        deleted_rows.append(int(row["Original CSV Line"]))
deleted_rows.sort()
print(f"Loaded {len(deleted_rows)} deleted row indices from deletion manifest")

def pre_to_post(pre_r):
    if pre_r in set(deleted_rows):
        return None
    cnt = bisect.bisect_left(deleted_rows, pre_r)
    return pre_r - cnt

# 2. Load 96 dietary contradiction rows from field_evidence.csv
evidence_csv = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_field_remediation_2026-11-10/field_evidence.csv")
dietary_targets = {}
with open(evidence_csv) as f:
    for row in csv.DictReader(f):
        if row["issue"] == "pork_or_lard_text_vs_halal_or_pork_free":
            pre_r = int(row["workbook_row"])
            post_r = pre_to_post(pre_r)
            ev = json.loads(row["evidence"])
            claims = ev.get("claims", {})
            dietary_targets[post_r] = {
                "pre_row": pre_r,
                "post_row": post_r,
                "venue": ev.get("venue"),
                "dish": ev.get("dish"),
                "invalidated_claims": claims
            }

print(f"Loaded {len(dietary_targets)} dietary target rows mapped to post-remediation coordinates")

# 3. Load workbook for modification
print("Loading workbook...")
wb = openpyxl.load_workbook(wb_path)
ws = wb["Menu & Price"]

headers = [str(c or "").strip() for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
h = {k: i for i, k in enumerate(headers)}
halal_col = h["Halal"] + 1        # 1-based openpyxl column
pork_free_col = h["Pork-free"] + 1  # 1-based openpyxl column
dish_col = h["Menu Item / Dish Name"] + 1

# 4. Apply boundary: where evidence invalidated a prior Yes, blank the field (None)
halal_blanked = 0
pork_free_blanked = 0
mismatched_dishes = 0

for post_r, info in dietary_targets.items():
    current_dish = ws.cell(row=post_r, column=dish_col).value
    expected_dish = info["dish"]
    if str(current_dish or "").strip().lower() != str(expected_dish or "").strip().lower():
        print(f"Warning: Dish mismatch at post row {post_r}: current '{current_dish}' vs expected '{expected_dish}'")
        mismatched_dishes += 1

    invalidated = info["invalidated_claims"]

    # If Halal had prior Yes that was invalidated, set to None (blank)
    if invalidated.get("Halal") == "Yes":
        cur_val = ws.cell(row=post_r, column=halal_col).value
        if cur_val == "No":
            ws.cell(row=post_r, column=halal_col).value = None
            halal_blanked += 1

    # If Pork-free had prior Yes that was invalidated, set to None (blank)
    if invalidated.get("Pork-free") == "Yes":
        cur_val = ws.cell(row=post_r, column=pork_free_col).value
        if cur_val == "No":
            ws.cell(row=post_r, column=pork_free_col).value = None
            pork_free_blanked += 1

print(f"Dish alignment check: {len(dietary_targets) - mismatched_dishes}/{len(dietary_targets)} perfectly matched")
print(f"Halal fields blanked (invalidated 'Yes' reverted from 'No' to blank): {halal_blanked}")
print(f"Pork-free fields blanked (invalidated 'Yes' reverted from 'No' to blank): {pork_free_blanked}")

# 5. Verify Sloppy Shack boundary carries forward
sloppy_count = 0
sloppy_quarantined_notes = 0
sloppy_prices_none = 0
lic_col = h["SFA Licence"] + 1
price_col = h["Price (SGD)"] + 1
desc_col = h["Description / Notes"] + 1

for r_idx in range(2, ws.max_row + 1):
    lic_val = str(ws.cell(row=r_idx, column=lic_col).value or "").strip().upper()
    if lic_val == "NE08128A000":
        sloppy_count += 1
        p_val = ws.cell(row=r_idx, column=price_col).value
        d_val = str(ws.cell(row=r_idx, column=desc_col).value or "").strip()
        if p_val is None:
            sloppy_prices_none += 1
        if "[QUARANTINED:" in d_val:
            sloppy_quarantined_notes += 1

print(f"Sloppy Shack verification (NE08128A000):")
print(f"  Total rows: {sloppy_count} (expected 72)")
print(f"  Prices blank (None): {sloppy_prices_none} (expected 72)")
print(f"  Description marked QUARANTINED: {sloppy_quarantined_notes} (expected 72)")

# 6. Save atomically
print("Saving modified workbook to temporary path...")
wb.save(temp_wb_path)

# 7. Integrity & formula checks
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

# 8. Atomic replacement
os.replace(temp_wb_path, wb_path)
final_sha = calc_sha(wb_path)
final_size = os.path.getsize(wb_path)
print(f"Successfully replaced master workbook!")
print(f"Final SHA-256: {final_sha} ({final_size} bytes)")
