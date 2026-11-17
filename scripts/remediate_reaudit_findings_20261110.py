#!/usr/bin/env python3
"""
remediate_reaudit_findings_20261110.py
Remediates findings from the 2026-11-10 independent re-audit:
1. Clears 4 non-numeric modifier prices (+$1.00, S$+2, S$+3) from 'Price (SGD)', moves to Description / Notes, sets price to None.
2. Harmonizes 68 licence-bearing menu rows that had blank Postal Code and Address from official Food Directory records:
   - NTF0132003: 500 CLEMENCEAU AVENUE NORTH #01-32, Singapore 229495 (229495)
   - NTF0151004: 500 CLEMENCEAU AVENUE NORTH #01-51, Singapore 229495 (229495)
   - B90107P013: 848 YISHUN STREET 81 #01-122, KHATIB CENTRAL, Singapore 760848 (760848)
   - W80066N008: 164 BUKIT MERAH CENTRAL #01-3631, Singapore 150164 (150164)
   - W80066N002: 164 BUKIT MERAH CENTRAL #01-3631, Singapore 150164 (150164)
3. Cleans 159 descriptions containing 'Unresolved source scope:' internal notes (strips internal note, preserves real dish text).
4. Synchronizes unlisted_venues.csv and review_list_20261110.csv with verified postals, addresses, and identity mismatch notes.
5. Saves atomically with ZipFile verification.
"""

import os, sys, hashlib, zipfile, openpyxl, csv

root = "/Users/Siew Hean/Documents/GitHub/Hungry"
wb_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx")
temp_wb_path = wb_path + ".tmp_reaudit_fix"

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

# 1. Remediate 4 non-numeric price modifiers
price_mods_fixed = 0
for row in ws.iter_rows(min_row=2):
    p_cell = row[h["Price (SGD)"]]
    p_val = str(p_cell.value or "").strip()
    d_cell = row[h["Description / Notes"]]
    d_val = str(d_cell.value or "").strip()
    
    if p_val == "+$1.00":
        p_cell.value = None
        d_cell.value = f"Add-on (+S$1.00) | {d_val}" if d_val else "Add-on (+S$1.00)"
        price_mods_fixed += 1
    elif p_val == "S$+2":
        p_cell.value = None
        d_cell.value = f"Add-on modifier: S$+2 | {d_val}" if d_val else "Add-on modifier: S$+2"
        price_mods_fixed += 1
    elif p_val == "S$+3":
        p_cell.value = None
        d_cell.value = f"Add-on modifier: S$+3 | {d_val}" if d_val else "Add-on modifier: S$+3"
        price_mods_fixed += 1

print(f"Fixed {price_mods_fixed} non-numeric price modifiers (expected 4)")

# 2. Harmonize 68 licence-bearing menu rows with blank address/postal
fd_stalls = {
    "NTF0132003": ("500 CLEMENCEAU AVENUE NORTH #01-32, Singapore 229495", "229495"),
    "NTF0151004": ("500 CLEMENCEAU AVENUE NORTH #01-51, Singapore 229495", "229495"),
    "B90107P013": ("848 YISHUN STREET 81 #01-122, KHATIB CENTRAL, Singapore 760848", "760848"),
    "W80066N008": ("164 BUKIT MERAH CENTRAL #01-3631, Singapore 150164", "150164"),
    "W80066N002": ("164 BUKIT MERAH CENTRAL #01-3631, Singapore 150164", "150164"),
}

postal_harmonized = 0
for row in ws.iter_rows(min_row=2):
    lic_cell = row[h["SFA Licence"]]
    lic = str(lic_cell.value or "").strip().upper()
    if lic in fd_stalls:
        addr_cell = row[h["Address"]]
        post_cell = row[h["Postal Code"]]
        if not str(post_cell.value or "").strip():
            addr_cell.value = fd_stalls[lic][0]
            post_cell.value = fd_stalls[lic][1]
            postal_harmonized += 1

print(f"Harmonized {postal_harmonized} licence-bearing menu rows with official postal/address (expected 68)")

# 3. Clean 159 descriptions containing 'Unresolved source scope:'
descs_cleaned = 0
for row in ws.iter_rows(min_row=2):
    d_cell = row[h["Description / Notes"]]
    d_val = str(d_cell.value or "").strip()
    if "Unresolved source scope:" in d_val:
        if " | Unresolved source scope:" in d_val:
            clean = d_val.split(" | Unresolved source scope:")[0].strip()
            d_cell.value = clean if clean else None
        elif d_val.startswith("Unresolved source scope:"):
            d_cell.value = None
        else:
            # fallback: remove the phrase and trailing sentence
            parts = d_val.split("Unresolved source scope:")
            clean = parts[0].strip().rstrip("|-; ")
            d_cell.value = clean if clean else None
        descs_cleaned += 1

print(f"Cleaned {descs_cleaned} descriptions with internal audit notes (expected 159)")

# Save workbook
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

# 4. Synchronize unlisted_venues.csv
unlisted_csv_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/unlisted_venues.csv")
with open(unlisted_csv_path, "r", encoding="utf-8") as f:
    uv_rows = list(csv.DictReader(f))

uv_updated = 0
for r in uv_rows:
    lic = r["sfa_licence_no"].strip().upper()
    if lic in fd_stalls:
        if not r["postal_code"] or not r["address"]:
            r["address"] = fd_stalls[lic][0]
            r["postal_code"] = fd_stalls[lic][1]
            uv_updated += 1

with open(unlisted_csv_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(uv_rows[0].keys()))
    writer.writeheader()
    writer.writerows(uv_rows)
print(f"Updated {uv_updated} venues in unlisted_venues.csv with authentic directory address/postal (expected 4)")

# 5. Synchronize review_list_20261110.csv to include INMERS (NE16423V000)
review_csv_path = os.path.join(root, "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/review_list_20261110.csv")
with open(review_csv_path, "r", encoding="utf-8") as f:
    rl_rows = list(csv.DictReader(f))

# Check if NE16423V000 already present
existing_lics = {r["stall_licence_no"].strip().upper() for r in rl_rows}
if "NE16423V000" not in existing_lics:
    rl_rows.append({
        "stall_licence_no": "NE16423V000",
        "stall_name": "Inmers",
        "source_url": "https://food.grab.com/sg/en/restaurant/the-tree-cafe-eastpoint-mall-delivery/SGDD09575",
        "reason": "NAME_MISMATCH",
        "extracted_postal": "528833",
        "target_postal": "519599",
        "extracted_unit": "#03-24",
        "target_unit": "#03-109",
        "extracted_name": "The Tree Cafe (Eastpoint Mall)",
        "target_name": "Inmers",
        "crawl_timestamp": "2026-10-27"
    })
    with open(review_csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rl_rows[0].keys()))
        writer.writeheader()
        writer.writerows(rl_rows)
    print(f"Appended NE16423V000 (Inmers vs The Tree Cafe) to review_list_20261110.csv (now {len(rl_rows)} rows)")
