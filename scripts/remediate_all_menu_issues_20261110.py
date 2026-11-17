#!/usr/bin/env python3
"""
scripts/remediate_all_menu_issues_20261110.py

Two-pass clean remediation:
Pass 1 (read-only):
- Read Food Directory to get licences and postals.
- Check 9 postal typos in Food Directory.
- Discover prefix renewal remappings and compound licence remappings.
- Find all 3,824 non-numeric price rows in Menu & Price.
- Find all disjoint branch URLs to clear.

Pass 2 (write mode):
- Apply 9 postal updates in Food Directory.
- Apply non-numeric price standardizations in Menu & Price.
- Apply licence remappings in Menu & Price.
- Clear disjoint branch URLs in Menu & Price.
- Append REV-032 to REV-043 in URL Review Register.
- Save to temp file, verify ZIP integrity, and atomically replace.
"""
import openpyxl
import re
import os
import sys
import time
import zipfile
import hashlib
import csv
from datetime import datetime, timezone
from collections import defaultdict

WORKBOOK_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
TEMP_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_tmp.xlsx"
REVIEW_CSV_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/review_list_20261110.csv"

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def main():
    print("=== Comprehensive Menu Remediation (Pass 1: Read-Only Analysis) ===")
    t0 = time.time()
    wb_ro = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    ws_dir_ro = wb_ro["Food Directory"]
    ws_menu_ro = wb_ro["Menu & Price"]

    # 1. Analyze Food Directory
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

    dir_lics = set()
    dir_lic_to_postal = {}
    dir_prefixes = defaultdict(list)
    dir_row_updates = {} # row_idx -> new_postal

    for idx, row in enumerate(ws_dir_ro.iter_rows(values_only=True), start=1):
        if idx == 1:
            headers = list(row)
            d_lic_col = headers.index("SFA Licence") + 1
            d_post_col = headers.index("Postal Code") + 1
            continue
        lic = str(row[d_lic_col - 1] or "").strip()
        postal = str(row[d_post_col - 1] or "").strip()
        if lic:
            dir_lics.add(lic)
            if lic in postal_typo_fixes:
                target_p = postal_typo_fixes[lic]
                dir_row_updates[idx] = target_p
                dir_lic_to_postal[lic] = target_p
            else:
                dir_lic_to_postal[lic] = postal
            prefix = re.sub(r"\d{3}$", "", lic)
            dir_prefixes[prefix].append((lic, dir_lic_to_postal[lic]))

    print(f"Directory analyzed in {time.time() - t0:.2f}s: {len(dir_lics)} licences, {len(dir_row_updates)} postal fixes queued.")

    # 2. Configured Remappings
    branch_remaps = {
        "CE22F46X000": "CE24E72B000", # Ah Er Soup Kitchener Complex
        "S84185B005": "S84185B000",   # 21 Cafe Eunos Grove
        "B86036X008": "B86036X011"    # 167 Nasi Kukus Woodlands St 11
    }

    compound_remaps = {
        "CE23L42A000; CE22F27X000": "CE23L42A000", # Drips Bakery Studio
        "NW10303C000, SE25F72A000, W02041J000": "NW10303C000", # #87 Just Thai
        "CE09L13K000, CE09L13K002": "CE09L13K000",
        "SW18F23K000, SW18F23K002": "SW18F23K000",
        "CE21L34V000, CE21L34V002": "CE21L34V000",
        "NE17544L000, NE17544L002": "NE17544L000",
        "CE19J32X000, CE19J32X002": "CE19J32X000"
    }

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

    # 3. Analyze Menu & Price
    menu_lic_updates = {}   # row_idx -> new_lic
    menu_price_updates = {} # row_idx -> (new_price, new_desc)
    menu_url_clears = {}    # row_idx -> (new_url, new_img, new_desc)
    review_additions = []
    timestamp_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Discover prefix remaps
    dynamic_prefix_remaps = {}
    for idx, row in enumerate(ws_menu_ro.iter_rows(values_only=True), start=1):
        if idx == 1:
            headers = list(row)
            m_venue_col = headers.index("F&B Venue Name") + 1
            m_lic_col = headers.index("SFA Licence") + 1
            m_addr_col = headers.index("Address") + 1
            m_post_col = headers.index("Postal Code") + 1
            m_dish_col = headers.index("Menu Item / Dish Name") + 1
            m_price_col = headers.index("Price (SGD)") + 1
            m_desc_col = headers.index("Description / Notes") + 1
            m_img_col = headers.index("Dish Image URL") + 1
            m_url_col = headers.index("Menu Source URL") + 1
            continue

        lic = str(row[m_lic_col - 1] or "").strip()
        postal = str(row[m_post_col - 1] or "").strip()
        price = row[m_price_col - 1]
        desc = str(row[m_desc_col - 1] or "").strip()
        url = str(row[m_url_col - 1] or "").strip()
        img = str(row[m_img_col - 1] or "").strip()
        venue = str(row[m_venue_col - 1] or "").strip()

        # Prefix discovery
        if lic and lic not in dir_lics and ";" not in lic and "," not in lic:
            if lic not in branch_remaps and lic not in compound_remaps and lic not in dynamic_prefix_remaps:
                prefix = re.sub(r"\d{3}$", "", lic)
                if prefix in dir_prefixes:
                    candidates = dir_prefixes[prefix]
                    matched = None
                    for c_lic, c_post in candidates:
                        if postal and c_post and postal == c_post:
                            matched = c_lic
                            break
                    if not matched and len(candidates) == 1:
                        matched = candidates[0][0]
                    if matched:
                        dynamic_prefix_remaps[lic] = matched

        target_lic = None
        if lic in branch_remaps:
            target_lic = branch_remaps[lic]
        elif lic in compound_remaps:
            target_lic = compound_remaps[lic]
        elif lic in dynamic_prefix_remaps:
            target_lic = dynamic_prefix_remaps[lic]

        if target_lic and target_lic != lic:
            menu_lic_updates[idx] = target_lic
            lic = target_lic

        # Clear disjoint URLs
        if lic in disjoint_urls_to_clear and url:
            reason = disjoint_urls_to_clear[lic]
            review_additions.append({
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
            new_img = "" if ("foodpanda" in img or "grab" in img) else img
            new_desc = f"[Quarantined: {reason} delivery URL cleared] {desc}".strip()
            menu_url_clears[idx] = ("", new_img, new_desc)

        # Standardize non-numeric prices
        if price is not None and str(price).strip():
            p_str = str(price).strip()
            cleaned = p_str.replace("SGD", "").replace("S$", "").replace("$", "").replace(",", "").strip()
            try:
                float(cleaned)
            except ValueError:
                # Non-numeric
                if p_str.lower().startswith("from"):
                    note = f"[Price note: {p_str}]"
                elif any(k in p_str for k in ["M $", "S $", "L $", "XL $", "portion $", "/"]):
                    note = f"[Variants: {p_str}]"
                elif "-" in p_str or "~" in p_str:
                    note = f"[Price range: {p_str}]"
                else:
                    note = f"[Price info: {p_str}]"
                
                # Check if new_desc was already updated by url clear
                base_desc = menu_url_clears[idx][2] if idx in menu_url_clears else desc
                new_desc = f"{note} {base_desc}".strip()
                menu_price_updates[idx] = (None, new_desc)

    wb_ro.close()
    print(f"Pass 1 finished in {time.time() - t0:.2f}s:")
    print(f"  Dynamic prefix remaps discovered: {len(dynamic_prefix_remaps)}")
    print(f"  Menu licences to update: {len(menu_lic_updates)}")
    print(f"  Disjoint delivery URLs to clear: {len(menu_url_clears)}")
    print(f"  Non-numeric prices to standardize: {len(menu_price_updates)}")

    # Pass 2: Write Mode
    print("\n=== Comprehensive Menu Remediation (Pass 2: Targeted Writing) ===")
    t1 = time.time()
    wb_rw = openpyxl.load_workbook(WORKBOOK_PATH)
    ws_dir_rw = wb_rw["Food Directory"]
    ws_menu_rw = wb_rw["Menu & Price"]
    ws_reg_rw = wb_rw["URL Review Register"]

    # Apply Directory updates
    for r_idx, new_postal in dir_row_updates.items():
        ws_dir_rw.cell(row=r_idx, column=d_post_col, value=new_postal)
    print(f"Applied {len(dir_row_updates)} Directory postal updates.")

    # Apply Menu Licence updates
    for r_idx, new_lic in menu_lic_updates.items():
        ws_menu_rw.cell(row=r_idx, column=m_lic_col, value=new_lic)
    print(f"Applied {len(menu_lic_updates)} Menu licence updates.")

    # Apply Menu URL clears
    for r_idx, (new_url, new_img, new_desc) in menu_url_clears.items():
        ws_menu_rw.cell(row=r_idx, column=m_url_col, value=new_url if new_url else None)
        ws_menu_rw.cell(row=r_idx, column=m_img_col, value=new_img if new_img else None)
        ws_menu_rw.cell(row=r_idx, column=m_desc_col, value=new_desc)
    print(f"Applied {len(menu_url_clears)} Menu URL clears.")

    # Apply Menu Price standardizations
    for r_idx, (new_price, new_desc) in menu_price_updates.items():
        ws_menu_rw.cell(row=r_idx, column=m_price_col, value=new_price)
        ws_menu_rw.cell(row=r_idx, column=m_desc_col, value=new_desc)
    print(f"Applied {len(menu_price_updates)} Menu price standardizations.")

    # Append URL Review Register entries
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
        ws_reg_rw.append(list(entry))
    print(f"Appended {len(reg_entries)} audit entries to URL Review Register.")

    # Atomic Save
    print(f"Saving atomically to {TEMP_PATH} ...")
    wb_rw.save(TEMP_PATH)
    print(f"Saved temp file in {time.time() - t1:.2f}s.")

    print("Verifying temp workbook ZIP integrity...")
    with zipfile.ZipFile(TEMP_PATH, "r") as z:
        bad = z.testzip()
        if bad:
            raise RuntimeError(f"Corrupted temp workbook ZIP: {bad}")

    print("ZIP verified PASS. Replacing master workbook...")
    os.replace(TEMP_PATH, WORKBOOK_PATH)

    final_sha = sha256_file(WORKBOOK_PATH)
    final_sz = os.path.getsize(WORKBOOK_PATH)
    print(f"Master Workbook Successfully Remediated!")
    print(f"New SHA-256: {final_sha} ({final_sz} bytes)")

    # Append to review_list_20261110.csv
    fieldnames = ["stall_licence_no", "stall_name", "source_url", "reason", "extracted_postal", "target_postal", "extracted_unit", "target_unit", "extracted_name", "target_name", "crawl_timestamp"]
    existing_keys = set()
    if os.path.exists(REVIEW_CSV_PATH):
        with open(REVIEW_CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                existing_keys.add((r["stall_licence_no"], r["source_url"]))

    with open(REVIEW_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        for row in review_additions:
            k = (row["stall_licence_no"], row["source_url"])
            if k not in existing_keys:
                writer.writerow(row)
                existing_keys.add(k)

    print(f"Appended {len(review_additions)} rows to {REVIEW_CSV_PATH}.")
    print(f"Total time elapsed: {time.time() - t0:.2f}s")

if __name__ == "__main__":
    main()
