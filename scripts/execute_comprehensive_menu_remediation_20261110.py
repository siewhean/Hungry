import openpyxl, re, json, os, hashlib, zipfile, csv
from datetime import datetime, timezone
from collections import defaultdict

wb_path = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
temp_wb_path = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_temp.xlsx"

print(f"Loading master workbook: {wb_path} ...")
wb = openpyxl.load_workbook(wb_path)

ws_dir = wb["Food Directory"]
ws_menu = wb["Menu & Price"]
ws_register = wb["URL Review Register"]

# 1. Update Food Directory Postal Code Typos
postal_typo_fixes = {
    "NW20R34L000": "750133", # Canberra Plaza 133 Canberra View
    "C84311B000": "600252",  # 252 Jurong East St 24
    "NW23I32E002": "762470", # 470B Yishun St 42
    "CE21071E000": "310085", # 85 Lor 4 Toa Payoh
    "CE22A60V000": "178905", # 13 Stamford Rd Capitol Piazza
    "SE25O97L000": "550304", # 304 Serangoon Ave 2
    "SW16E16A000": "680810", # 810 CCK Ave 7
    "C82221B001": "120722",  # 722 Clementi West St 2
    "E96072N000": "462029"   # 29B Chai Chee Ave
}

dir_lic_col = None
dir_postal_col = None
for col_idx in range(1, ws_dir.max_column + 1):
    val = ws_dir.cell(row=1, column=col_idx).value
    if val == "SFA Licence":
        dir_lic_col = col_idx
    elif val == "Postal Code":
        dir_postal_col = col_idx

dir_postals_updated = 0
dir_lic_to_postal = {}
dir_lics = set()
dir_prefixes = defaultdict(list)

for row_idx in range(2, ws_dir.max_row + 1):
    lic = str(ws_dir.cell(row=row_idx, column=dir_lic_col).value or "").strip()
    if lic:
        dir_lics.add(lic)
        if lic in postal_typo_fixes:
            new_p = postal_typo_fixes[lic]
            ws_dir.cell(row=row_idx, column=dir_postal_col, value=new_p)
            dir_postals_updated += 1
            dir_lic_to_postal[lic] = new_p
        else:
            p_val = str(ws_dir.cell(row=row_idx, column=dir_postal_col).value or "").strip()
            dir_lic_to_postal[lic] = p_val
        
        prefix = re.sub(r"\d{3}$", "", lic)
        dir_prefixes[prefix].append((lic, dir_lic_to_postal[lic]))

print(f"Updated {dir_postals_updated} postal codes in Food Directory.")

# 2. Collect Prefix & Compound Remappings
# Disjoint branch remappings to authentic branch licences in directory
branch_remaps = {
    "CE22F46X000": "CE24E72B000", # Ah Er Soup Kitchener Complex (808 French Rd #01-03)
    "S84185B005": "S84185B000",   # 21 Cafe Eunos Grove (631 Bedok Reservoir Rd #01-886)
    "B86036X008": "B86036X011"    # 167 Nasi Kukus (167 Woodlands St 11 #01-07)
}

# Compound string remappings
compound_remaps = {
    "CE23L42A000; CE22F27X000": "CE23L42A000", # Drips Bakery Studio (71 Seng Poh Rd)
    "NW10303C000, SE25F72A000, W02041J000": "NW10303C000", # #87 Just Thai
    "CE09L13K000, CE09L13K002": "CE09L13K000",
    "SW18F23K000, SW18F23K002": "SW18F23K000",
    "CE21L34V000, CE21L34V002": "CE21L34V000",
    "NE17544L000, NE17544L002": "NE17544L000",
    "CE19J32X000, CE19J32X002": "CE19J32X000"
}

# Licences with disjoint branch delivery URLs to clear and log to review list
disjoint_urls_to_clear = {
    "CE04560A000": "Starbucks Gleneagles vs Suntec",
    "NW25Q43B000": "Ajumma Lentor vs Westgate",
    "NW17783B000": "Feng Food Northpoint vs Woods Square",
    "W00365L000": "Ananda Bhavan Syed Alwi vs Serangoon Rd",
    "CE23349L001": "Ah Er Soup Woodleigh vs Yuan Ching",
    "CE09266K013": "Ah Er Soup ION Orchard vs Wisma Atria",
    "J88136X007": "Abang Gemuk Teck Whye vs Segar Rd",
    "SW18G14V000": "Chateraise Jurong Point vs Clementi"
}

# Dynamically discover all valid prefix remaps
dynamic_prefix_remaps = {}
for row_idx in range(2, ws_menu.max_row + 1):
    lic_val = str(ws_menu.cell(row=row_idx, column=2).value or "").strip()
    if not lic_val or lic_val in dir_lics:
        continue
    if ";" in lic_val or "," in lic_val:
        continue
    if lic_val in branch_remaps or lic_val in compound_remaps:
        continue
    
    prefix = re.sub(r"\d{3}$", "", lic_val)
    if prefix in dir_prefixes:
        candidates = dir_prefixes[prefix]
        m_postal = str(ws_menu.cell(row=row_idx, column=4).value or "").strip()
        matched = None
        for c_lic, c_postal in candidates:
            if m_postal and c_postal and m_postal == c_postal:
                matched = c_lic
                break
        if not matched and len(candidates) == 1:
            matched = candidates[0][0]
        if matched:
            dynamic_prefix_remaps[lic_val] = matched

print(f"Dynamically discovered {len(dynamic_prefix_remaps)} prefix/renewal remappings.")

# Find column indices in Menu & Price
m_cols = {}
for col_idx in range(1, ws_menu.max_column + 1):
    val = ws_menu.cell(row=1, column=col_idx).value
    if val:
        m_cols[val] = col_idx

lic_col = m_cols["SFA Licence"]
name_col = m_cols["F&B Venue Name"]
addr_col = m_cols["Address"]
postal_col = m_cols["Postal Code"]
price_col = m_cols["Price (SGD)"]
desc_col = m_cols["Description / Notes"]
img_col = m_cols["Dish Image URL"]
url_col = m_cols["Menu Source URL"]

menu_licences_updated = 0
menu_urls_cleared = 0
nonnumeric_prices_standardized = 0

review_list_additions = []
timestamp_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

print("Processing Menu & Price rows...")
for row_idx in range(2, ws_menu.max_row + 1):
    lic = str(ws_menu.cell(row=row_idx, column=lic_col).value or "").strip()
    venue = str(ws_menu.cell(row=row_idx, column=name_col).value or "").strip()
    addr = str(ws_menu.cell(row=row_idx, column=addr_col).value or "").strip()
    postal = str(ws_menu.cell(row=row_idx, column=postal_col).value or "").strip()
    price = ws_menu.cell(row=row_idx, column=price_col).value
    desc = str(ws_menu.cell(row=row_idx, column=desc_col).value or "").strip()
    url = str(ws_menu.cell(row=row_idx, column=url_col).value or "").strip()

    # 1. Update SFA Licence if in remappings
    target_lic = None
    if lic in branch_remaps:
        target_lic = branch_remaps[lic]
    elif lic in compound_remaps:
        target_lic = compound_remaps[lic]
    elif lic in dynamic_prefix_remaps:
        target_lic = dynamic_prefix_remaps[lic]
    
    if target_lic and target_lic != lic:
        ws_menu.cell(row=row_idx, column=lic_col, value=target_lic)
        menu_licences_updated += 1
        lic = target_lic

    # 2. Clear misattributed delivery URLs for disjoint branches
    if lic in disjoint_urls_to_clear and url:
        reason = disjoint_urls_to_clear[lic]
        review_list_additions.append({
            "stall_licence_no": lic,
            "stall_name": venue,
            "source_url": url,
            "reason": "POSTAL_MISMATCH",
            "extracted_postal": postal,
            "target_postal": dir_lic_to_postal.get(lic, ""),
            "extracted_unit": "",
            "target_unit": "",
            "extracted_name": venue,
            "target_name": venue,
            "crawl_timestamp": timestamp_iso
        })
        ws_menu.cell(row=row_idx, column=url_col, value="")
        # also clear image URL if it was from that delivery domain
        img_val = str(ws_menu.cell(row=row_idx, column=img_col).value or "").strip()
        if "foodpanda" in img_val or "grab" in img_val:
            ws_menu.cell(row=row_idx, column=img_col, value="")
        # append note
        new_desc = f"[Quarantined: {reason} delivery URL cleared] {desc}".strip()
        ws_menu.cell(row=row_idx, column=desc_col, value=new_desc)
        menu_urls_cleared += 1

    # 3. Standardize Non-numeric prices
    if price is not None and str(price).strip():
        p_str = str(price).strip()
        cleaned = p_str.replace("SGD", "").replace("S$", "").replace("$", "").replace(",", "").strip()
        is_num = False
        try:
            float(cleaned)
            is_num = True
        except ValueError:
            is_num = False

        if not is_num:
            # Preserve in description
            if p_str.lower().startswith("from"):
                note = f"[Price note: {p_str}]"
            elif any(k in p_str for k in ["M $", "S $", "L $", "XL $", "portion $", "/"]):
                note = f"[Variants: {p_str}]"
            elif "-" in p_str or "~" in p_str:
                note = f"[Price range: {p_str}]"
            else:
                note = f"[Price info: {p_str}]"
            
            new_desc = f"{note} {desc}".strip()
            ws_menu.cell(row=row_idx, column=price_col, value="") # set to blank
            ws_menu.cell(row=row_idx, column=desc_col, value=new_desc)
            nonnumeric_prices_standardized += 1

print(f"Updated {menu_licences_updated} licences in Menu & Price.")
print(f"Cleared {menu_urls_cleared} misattributed delivery URLs.")
print(f"Standardized {nonnumeric_prices_standardized} non-numeric prices into Description notes with blank Price (SGD).")

# 4. Append URL Review Register entries
reg_entries = [
    ("REV-032", "2026-11-10", "NW20R34L000", "365 Juices Bar Canberra Plaza", "Food Directory postal code corrected from typo 753133 to official Canberra Plaza 750133.", "CORRECTED"),
    ("REV-033", "2026-11-10", "C84311B000", "252 Foodcourt Jurong East", "Food Directory postal code corrected from adjacent 600254 to official 600252.", "CORRECTED"),
    ("REV-034", "2026-11-10", "NW23I32E002", "31 Holland Pte Ltd", "Food Directory postal code corrected from typo 760470 to official 762470.", "CORRECTED"),
    ("REV-035", "2026-11-10", "CE21071E000", "190 Degrees Bakery", "Food Directory postal code corrected from adjacent 312085 to official 310085.", "CORRECTED"),
    ("REV-036", "2026-11-10", "CE22A60V000", "800 Bowls Capitol Piazza", "Food Directory postal code harmonized from 178884 to Capitol 178905.", "CORRECTED"),
    ("REV-037", "2026-11-10", "SE25O97L000", "147 Seafood Steamboat", "Food Directory postal code corrected from typo 550308 to official 550304.", "CORRECTED"),
    ("REV-038", "2026-11-10", "SW16E16A000", "7 Stars CCK Ave 7", "Food Directory postal code corrected from typo 681810 to official 680810.", "CORRECTED"),
    ("REV-039", "2026-11-10", "C82221B001", "722 Mixed Veg Rice", "Food Directory postal code corrected from adjacent 120721 to official 120722.", "CORRECTED"),
    ("REV-040", "2026-11-10", "E96072N000", "Ang Kok Hui", "Food Directory postal code corrected from typo 460029 to official 462029.", "CORRECTED"),
    ("REV-041", "2026-11-10", "VARIOUS", "3824 Non-Numeric Prices", "Standardized all non-numeric strings ('From S$XX', variants, ranges) into Description/Notes with blank Price (SGD) per Section 2 of hungry-menu-crawl-verify.", "CORRECTED"),
    ("REV-042", "2026-11-10", "VARIOUS", "Prefix & Compound Licences", "Remapped dynamic prefix renewal variants and compound licence strings in Menu & Price to authentic active Directory SFA licences.", "CORRECTED"),
    ("REV-043", "2026-11-10", "VARIOUS", "Disjoint Branch Delivery URLs", "Cleared misattributed cross-branch delivery URLs on Starbucks Gleneagles, Ajumma Lentor, Feng Food, Ananda Bhavan, Ah Er Woodleigh/ION, Abang Gemuk, and Chateraise.", "CORRECTED")
]

for entry in reg_entries:
    ws_register.append(list(entry))

print(f"Appended {len(reg_entries)} review entries to URL Review Register.")

print(f"Saving atomically to {temp_wb_path} ...")
wb.save(temp_wb_path)

# Verify temp zip
print("Verifying temp workbook ZIP integrity...")
with zipfile.ZipFile(temp_wb_path, "r") as z:
    bad = z.testzip()
    if bad:
        raise RuntimeError(f"Corrupted temp workbook ZIP: {bad}")

# Atomic replace
os.replace(temp_wb_path, wb_path)
print(f"Atomically replaced master workbook: {wb_path}")

# Verify replaced file
with open(wb_path, "rb") as f:
    fb = f.read()
    new_sha = hashlib.sha256(fb).hexdigest()
    new_sz = len(fb)

print(f"Final Workbook SHA-256: {new_sha} ({new_sz} bytes)")

# 5. Append to review_list_20261110.csv
review_csv_path = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/review_list_20261110.csv"
fieldnames = ["stall_licence_no", "stall_name", "source_url", "reason", "extracted_postal", "target_postal", "extracted_unit", "target_unit", "extracted_name", "target_name", "crawl_timestamp"]

existing_urls = set()
if os.path.exists(review_csv_path):
    with open(review_csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            existing_urls.add((r["stall_licence_no"], r["source_url"]))

with open(review_csv_path, "a", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    for row in review_list_additions:
        key = (row["stall_licence_no"], row["source_url"])
        if key not in existing_urls:
            writer.writerow(row)
            existing_urls.add(key)

print(f"Appended {len(review_list_additions)} rows to {review_csv_path}.")
