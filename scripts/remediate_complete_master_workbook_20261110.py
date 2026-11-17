#!/usr/bin/env python3
"""
scripts/remediate_complete_master_workbook_20261110.py

Comprehensive Master Workbook Remediation:
1. Food Directory: Fix 9 postal code typos (Canberra Plaza, 252 Jurong East, 31 Holland, 190 Degrees Bakery, 800 Bowls, 147 Seafood, 7 Stars, 722 Mixed Veg Rice, Ang Kok Hui).
2. Menu & Price:
   a. 7 cross-stall contamination fixes (Newton 32/51, Sloppy Shack, Ai Xin, AJ Delights, Ahjussi, Ah Ma Chi Mian).
   b. Branch licence remappings (Ah Er Kitchener CE24E72B000, 21 Cafe Eunos S84185B000, 167 Nasi Kukus B86036X011, Bainian96 Bishan S91065E009, Anjana Kitchen SW23106J000).
   c. Compound & Prefix renewal licence remappings (resolving unmatched licences).
   d. Quarantining disjoint branch delivery URLs (Starbucks Gleneagles, Ajumma Lentor, Feng Food Northpoint, Ananda Bhavan Syed Alwi, Ah Er Woodleigh, Ah Er ION, Abang Gemuk Teck Whye, Chateraise Jurong Point).
   e. Harmonizing Postal Code and Address to registered Food Directory entries for all remaining licence-matched rows.
   f. Standardizing all 3,824+ non-numeric price strings into Description/Notes and setting Price (SGD) to null per Section 2 of hungry-menu-crawl-verify.
3. URL Review Register: Append audit review records REV-202+ matching all 21 schema columns.
4. Review List CSV: Output quarantined/cleared items to review_list_20261110.csv per Section 3 of hungry-menu-crawl-verify.
5. Atomic Save: Save to temp file, verify ZIP integrity (testzip() == None), and atomically replace.
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

def extract_postal(text):
    if not text:
        return ""
    m = re.search(r"\b(\d{6})\b", str(text))
    return m.group(1) if m else ""

def main():
    print("=== Complete Master Workbook Remediation (Pass 1: Read-Only Analysis) ===")
    t0 = time.time()
    wb_ro = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    ws_dir_ro = wb_ro["Food Directory"]
    ws_menu_ro = wb_ro["Menu & Price"]
    ws_reg_ro = wb_ro["URL Review Register"]

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
    dir_lic_to_data = {}
    dir_prefixes = defaultdict(list)
    dir_row_updates = {} # row_idx -> new_postal

    for idx, row in enumerate(ws_dir_ro.iter_rows(values_only=True), start=1):
        if idx == 1:
            headers = list(row)
            d_name_col = headers.index("F&B Name") + 1
            d_lic_col = headers.index("SFA Licence") + 1
            d_addr_col = headers.index("Full Address") + 1
            d_post_col = headers.index("Postal Code") + 1
            continue
        lic = str(row[d_lic_col - 1] or "").strip()
        name = str(row[d_name_col - 1] or "").strip()
        addr = str(row[d_addr_col - 1] or "").strip()
        postal = str(row[d_post_col - 1] or "").strip()
        if lic:
            dir_lics.add(lic)
            if lic in postal_typo_fixes:
                target_p = postal_typo_fixes[lic]
                dir_row_updates[idx] = target_p
                postal = target_p
            dir_lic_to_data[lic] = {"name": name, "addr": addr, "post": postal}
            prefix = re.sub(r"\d{3}$", "", lic)
            dir_prefixes[prefix].append((lic, postal, addr))

    print(f"Food Directory analyzed: {len(dir_lics)} licences, {len(dir_row_updates)} postal typo fixes queued.")

    # 2. Configured Remappings
    branch_licence_remaps = {
        "CE22F46X000": "CE24E72B000", # Ah Er Soup Kitchener Complex
        "S84185B005": "S84185B000",   # 21 Cafe Eunos Grove
        "B86036X008": "B86036X011",   # 167 Nasi Kukus Woodlands St 11
        "S91065E003": "S91065E009",   # Bainian96 Bishan St 11
        "SW18B72J000": "SW23106J000", # Anjana Kitchen Vision Exchange
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

    disjoint_branch_quarantines = {
        "CE04560A000": ("Starbucks Gleneagles Hospital", "Suntec City Mall candidate delivery URL cleared from Gleneagles Hospital branch"),
        "NW25Q43B000": ("Ajumma's Lentor Modern", "Westgate candidate delivery URL cleared from Lentor Modern branch"),
        "NW17783B000": ("Feng Food Northpoint City", "Woods Square candidate delivery URL cleared from Northpoint City branch"),
        "W00365L000": ("Ananda Bhavan Syed Alwi Road", "Serangoon Road candidate delivery URL cleared from Syed Alwi Road branch"),
        "CE23349L001": ("Ah Er Soup The Woodleigh Mall", "Yuan Ching Road candidate delivery URL cleared from The Woodleigh Mall branch"),
        "CE09266K013": ("Ah Er Herbal Soup ION Orchard", "Wisma Atria candidate delivery URL cleared from ION Orchard branch"),
        "J88136X007": ("Abang Gemuk Teck Whye", "Segar Road candidate delivery URL cleared from Teck Whye branch"),
        "SW18G14V000": ("Chateraise Jurong Point", "Clementi West candidate delivery URL cleared from Jurong Point branch")
    }

    # 3. Analyze Menu & Price
    menu_lic_updates = {}     # row_idx -> new_lic
    menu_geo_updates = {}     # row_idx -> (new_addr, new_post)
    menu_price_updates = {}   # row_idx -> (new_price, new_desc)
    menu_url_clears = {}      # row_idx -> (new_url, new_img, new_desc)
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
        addr = str(row[m_addr_col - 1] or "").strip()
        dish = str(row[m_dish_col - 1] or "").strip()
        price = row[m_price_col - 1]
        desc = str(row[m_desc_col - 1] or "").strip()
        url = str(row[m_url_col - 1] or "").strip()
        img = str(row[m_img_col - 1] or "").strip()
        venue = str(row[m_venue_col - 1] or "").strip()

        # Dynamic prefix discovery for unmatched licences
        if lic and lic not in dir_lics and ";" not in lic and "," not in lic:
            if lic not in branch_licence_remaps and lic not in compound_remaps and lic not in dynamic_prefix_remaps:
                prefix = re.sub(r"\d{3}$", "", lic)
                if prefix in dir_prefixes:
                    candidates = dir_prefixes[prefix]
                    matched = None
                    for c_lic, c_post, c_addr in candidates:
                        if postal and c_post and postal == c_post:
                            matched = c_lic
                            break
                    if not matched and len(candidates) == 1:
                        matched = candidates[0][0]
                    if matched:
                        dynamic_prefix_remaps[lic] = matched

        # A. Determine target licence
        target_lic = lic
        if lic in branch_licence_remaps:
            target_lic = branch_licence_remaps[lic]
        elif lic in compound_remaps:
            target_lic = compound_remaps[lic]
        elif lic in dynamic_prefix_remaps:
            target_lic = dynamic_prefix_remaps[lic]

        # B. 7 Cross-stall contamination fixes
        # 1. Newton 32 BBQ Seafood (NTF0132003) with newton-51 URL (rows 103565-103568)
        if lic == "NTF0132003" and "newton 32" in venue.lower() and "newton-51" in url.lower():
            cleaned_desc = re.sub(r'\[Main Menu \d{2}:\d{2}:\d{2}-\d{2}:\d{2}:\d{2}\]', '', desc).strip()
            new_desc = f"{cleaned_desc} | Cleared misattributed Newton 51 Foodpanda URL; authentic stall 32 menu unverified."
            menu_url_clears[idx] = ("", "", new_desc)
            url, img, desc = "", "", new_desc
            review_additions.append({
                "stall_licence_no": lic, "stall_name": venue, "source_url": "https://foodpanda.sg/restaurant/x4bf/newton-51-newton-food-centre",
                "reason": "CROSS_STALL_CONTAMINATION", "extracted_postal": postal, "target_postal": postal,
                "extracted_unit": "#01-51", "target_unit": "#01-32", "extracted_name": "Newton 51", "target_name": venue,
                "crawl_timestamp": timestamp_iso
            })

        # 2. Newton 51 (Newton Food Centre) with NTF0132003 (rows 106715-106722)
        elif lic == "NTF0132003" and "newton 51" in venue.lower():
            target_lic = "NTF0151004"

        # 3. SLOPPY SHACK (NE08128A000): rows 1720-1791
        elif lic == "NE08128A000" and venue == "SLOPPY SHACK" and url and "sloppy-shack" in url.lower():
            new_desc = f"{desc} | Cleared misattributed Sloppy Shack Foodpanda URL: dishes are Thai menu items from Magic Wok KINEX (cross-stall contamination)."
            menu_url_clears[idx] = ("", img, new_desc)
            url, desc = "", new_desc
            review_additions.append({
                "stall_licence_no": lic, "stall_name": venue, "source_url": "https://foodpanda.sg/restaurant/w2ve/sloppy-shack-kinex",
                "reason": "CROSS_STALL_CONTAMINATION", "extracted_postal": postal, "target_postal": postal,
                "extracted_unit": "#B1-K8", "target_unit": "#B1-K8", "extracted_name": "Magic Wok Thai", "target_name": venue,
                "crawl_timestamp": timestamp_iso
            })

        # 4. Ai Xin Korean & Japanese Food (NW05105C003)
        elif lic == "NW05105C003" and "al-hawa" in url.lower():
            new_desc = f"{desc} | Cleared misattributed AL Hawa Indian Muslim Food URL from Ai Xin Korean & Japanese Food."
            menu_url_clears[idx] = ("", "", new_desc)
            url, img, desc = "", "", new_desc
            review_additions.append({
                "stall_licence_no": lic, "stall_name": venue, "source_url": "https://foodpanda.sg/restaurant/x4ol/al-hawa-indian-muslim-food-yishun-central",
                "reason": "CROSS_STALL_CONTAMINATION", "extracted_postal": postal, "target_postal": postal,
                "extracted_unit": "", "target_unit": "", "extracted_name": "AL Hawa Indian Muslim Food", "target_name": venue,
                "crawl_timestamp": timestamp_iso
            })

        # 5. AJ Delights (BM20182002)
        elif lic == "BM20182002" and "pu-tian" in url.lower():
            new_desc = f"{desc} | Cleared misattributed Pu Tian Delights URL from AJ Delights muffin bakery."
            menu_url_clears[idx] = ("", "", new_desc)
            url, img, desc = "", "", new_desc
            review_additions.append({
                "stall_licence_no": lic, "stall_name": venue, "source_url": "https://foodpanda.sg/restaurant/qfn4/pu-tian-delights-alexandra-village-food-centre-qfn4",
                "reason": "CROSS_STALL_CONTAMINATION", "extracted_postal": postal, "target_postal": postal,
                "extracted_unit": "#01-76", "target_unit": "#01-82", "extracted_name": "Pu Tian Delights", "target_name": venue,
                "crawl_timestamp": timestamp_iso
            })

        # 6. Ahjussi Korean Cuisine (CE09F31V005)
        elif lic == "CE09F31V005" and "wuguyufen" in url.lower():
            new_desc = f"{desc} | Cleared misattributed WuGuYuFen Hunan Cuisine URL from Ahjussi Korean Cuisine."
            menu_url_clears[idx] = ("", "", new_desc)
            url, img, desc = "", "", new_desc
            review_additions.append({
                "stall_licence_no": lic, "stall_name": venue, "source_url": "https://foodpanda.sg/restaurant/w0v4/wuguyufen-hunan-cuisine-313atsomerset-w0v4",
                "reason": "CROSS_STALL_CONTAMINATION", "extracted_postal": postal, "target_postal": postal,
                "extracted_unit": "#05-01/02/03", "target_unit": "#05-01/02/03", "extracted_name": "WuGuYuFen Hunan Cuisine", "target_name": venue,
                "crawl_timestamp": timestamp_iso
            })

        # 7. Ah Ma Chi Mian (C99161N003 & C89200E001) with Parkway Parade URL
        elif lic in ("C99161N003", "C89200E001") and "parkway-parade" in url.lower():
            new_desc = f"{desc} | Cleared mismatched Parkway Parade URL from Jurong stall."
            menu_url_clears[idx] = ("", img, new_desc)
            url, desc = "", new_desc
            review_additions.append({
                "stall_licence_no": lic, "stall_name": venue, "source_url": "https://foodpanda.sg/restaurant/b4k4/ah-ma-chi-mian-a-ma-chi-mian-kopitiam-at-parkway-parade",
                "reason": "CROSS_BRANCH_MISMATCH", "extracted_postal": postal, "target_postal": postal,
                "extracted_unit": "", "target_unit": "", "extracted_name": "Ah Ma Chi Mian Parkway Parade", "target_name": venue,
                "crawl_timestamp": timestamp_iso
            })

        # C. Disjoint branch delivery URL quarantines
        if target_lic in disjoint_branch_quarantines and url:
            branch_label, action_desc = disjoint_branch_quarantines[target_lic]
            clean_img = "" if ("foodpanda" in img or "grab" in img) else img
            base_desc = menu_url_clears[idx][2] if idx in menu_url_clears else desc
            new_desc = f"[Quarantined: {action_desc}] {base_desc}".strip()
            menu_url_clears[idx] = ("", clean_img, new_desc)
            review_additions.append({
                "stall_licence_no": target_lic, "stall_name": venue, "source_url": url,
                "reason": "POSTAL_MISMATCH", "extracted_postal": postal, "target_postal": dir_lic_to_data.get(target_lic, {}).get("post", ""),
                "extracted_unit": "", "target_unit": "", "extracted_name": venue, "target_name": dir_lic_to_data.get(target_lic, {}).get("name", venue),
                "crawl_timestamp": timestamp_iso
            })
            url = ""
            desc = new_desc

        # Queue licence update if target differs
        if target_lic and target_lic != lic:
            menu_lic_updates[idx] = target_lic
            lic = target_lic

        # D. Harmonize Address and Postal Code for licence-matched stalls
        if lic in dir_lic_to_data:
            dir_rec = dir_lic_to_data[lic]
            d_post = dir_rec["post"]
            d_addr = dir_rec["addr"]
            if d_post and postal and d_post.zfill(6) != postal.zfill(6):
                # Update Address and Postal Code in Menu & Price to match authentic Directory record
                menu_geo_updates[idx] = (d_addr, d_post)

        # E. Standardize Non-Numeric Prices into Description / Notes
        if price is not None and str(price).strip():
            p_str = str(price).strip()
            cleaned = p_str.replace("SGD", "").replace("S$", "").replace("$", "").replace(",", "").strip()
            try:
                float(cleaned)
            except ValueError:
                # Non-numeric string
                if p_str.lower().startswith("from"):
                    note = f"[Price note: {p_str}]"
                elif any(k in p_str for k in ["M $", "S $", "L $", "XL $", "portion $", "/"]):
                    note = f"[Variants: {p_str}]"
                elif "-" in p_str or "~" in p_str:
                    note = f"[Price range: {p_str}]"
                else:
                    note = f"[Price info: {p_str}]"
                
                base_desc = menu_url_clears[idx][2] if idx in menu_url_clears else desc
                new_desc = f"{note} {base_desc}".strip()
                menu_price_updates[idx] = (None, new_desc)

    # 4. Check URL Review Register max review ID
    max_rev_id = 201
    for row in ws_reg_ro.iter_rows(values_only=True):
        if row and row[0] and str(row[0]).startswith("REV-"):
            m = re.search(r"\d+", str(row[0]))
            if m:
                val = int(m.group(0))
                if val > max_rev_id:
                    max_rev_id = val

    wb_ro.close()
    print(f"Pass 1 finished in {time.time() - t0:.2f}s:")
    print(f"  Food Directory postal typo updates: {len(dir_row_updates)}")
    print(f"  Dynamic prefix remaps discovered: {len(dynamic_prefix_remaps)}")
    print(f"  Menu licence updates: {len(menu_lic_updates)}")
    print(f"  Menu postal/address harmonizations: {len(menu_geo_updates)}")
    print(f"  Menu URL clears & quarantines: {len(menu_url_clears)}")
    print(f"  Non-numeric price standardizations: {len(menu_price_updates)}")
    print(f"  Review register additions planned: {len(review_additions)} (Starting at REV-{max_rev_id + 1:03d})")

    # Pass 2: Write Mode
    print("\n=== Complete Master Workbook Remediation (Pass 2: Targeted Writing) ===")
    t1 = time.time()
    wb_rw = openpyxl.load_workbook(WORKBOOK_PATH)
    ws_dir_rw = wb_rw["Food Directory"]
    ws_menu_rw = wb_rw["Menu & Price"]
    ws_reg_rw = wb_rw["URL Review Register"]

    # 1. Apply Directory updates
    for r_idx, new_postal in dir_row_updates.items():
        ws_dir_rw.cell(row=r_idx, column=d_post_col, value=new_postal)
    print(f"Applied {len(dir_row_updates)} Directory postal updates.")

    # 2. Apply Menu Licence updates
    for r_idx, new_lic in menu_lic_updates.items():
        ws_menu_rw.cell(row=r_idx, column=m_lic_col, value=new_lic)
    print(f"Applied {len(menu_lic_updates)} Menu licence updates.")

    # 3. Apply Menu Geo updates (Address and Postal Code)
    for r_idx, (new_addr, new_post) in menu_geo_updates.items():
        ws_menu_rw.cell(row=r_idx, column=m_addr_col, value=new_addr)
        ws_menu_rw.cell(row=r_idx, column=m_post_col, value=new_post)
    print(f"Applied {len(menu_geo_updates)} Menu Address/Postal synchronizations.")

    # 4. Apply Menu URL clears
    for r_idx, (new_url, new_img, new_desc) in menu_url_clears.items():
        cell_u = ws_menu_rw.cell(row=r_idx, column=m_url_col)
        cell_u.value = new_url if new_url else None
        cell_i = ws_menu_rw.cell(row=r_idx, column=m_img_col)
        cell_i.value = new_img if new_img else None
        cell_d = ws_menu_rw.cell(row=r_idx, column=m_desc_col)
        cell_d.value = new_desc
    print(f"Applied {len(menu_url_clears)} Menu URL clears.")

    # 5. Apply Menu Price standardizations
    for r_idx, (new_price, new_desc) in menu_price_updates.items():
        cell_p = ws_menu_rw.cell(row=r_idx, column=m_price_col)
        cell_p.value = None
        cell_d = ws_menu_rw.cell(row=r_idx, column=m_desc_col)
        cell_d.value = new_desc
    print(f"Applied {len(menu_price_updates)} Menu price standardizations.")

    # 6. Append URL Review Register entries matching all 21 columns
    next_rev = max_rev_id + 1
    new_reg_rows = []

    # Summary entries for systemic fixes:
    systemic_entries = [
        ("Directory Postal Typo Corrections", "Food Directory", "Various", "Food Directory", "Postal Code", "9 Licensed Venues", "NW20R34L000 etc.",
         "Directory postal code typos identified against official postal directory records.", "Typos (e.g. 753133, 600254, 760470)", "Corrected to official postal codes (750133, 600252, 762470, etc.)",
         None, "Official postal address verification per Section 1 of hungry-menu-crawl-verify.", "2026-11-10", "CORRECTED", "Various", "9 Licensed Venues", "NW20R34L000 etc.", "Official Postal", "Postal Code", "Official Postal", "VERIFIED"),
        ("Price Schema Standardization", "Menu & Price", "Various", "Menu & Price", "Price (SGD)", "Various Stalls", "Various",
         "3,824+ non-numeric price strings ('From S$XX', variant combos, price ranges) stored in numeric Price column.", "Non-numeric strings", "Preserved raw text in Description/Notes and set Price (SGD) to null per Section 2 of hungry-menu-crawl-verify.",
         None, "Strict adherence to hungry-menu-crawl-verify Section 2: never invent synthetic numbers; store variant/from pricing in notes.", "2026-11-10", "CORRECTED", "Various", "Various Stalls", "Various", None, "Description / Notes", "Preserved in notes", "STANDARDIZED"),
        ("SFA Licence Renewal & Compound Harmonization", "Menu & Price", "Various", "Menu & Price", "SFA Licence", "Various Stalls", "Various",
         "Historical SFA prefix renewals and compound licence strings in Menu & Price not matching active Directory licences.", "Compound / Old renewal licence strings", "Remapped to active registered SFA licences in Food Directory.",
         None, "Prefix renewal crosswalk and compound licence primary key harmonization.", "2026-11-10", "CORRECTED", "Various", "Various Stalls", "Various", "Active Licence", "SFA Licence", "Active Licence", "RECONCILED"),
        ("Disjoint Branch URL Quarantine", "Menu & Price", "Various", "Menu & Price", "Menu Source URL", "Various Chain Outlets", "Various",
         "Candidate delivery URLs belonging to different branches attached across disjoint outlet locations.", "Wrong-branch delivery URLs", "Cleared misattributed URLs and images; logged to review list with reason POSTAL_MISMATCH per Section 1.",
         None, "Strict adherence to hungry-menu-crawl-verify Section 1 (Identity Gate anti-contamination).", "2026-11-10", "CORRECTED", "Various", "Various Chain Outlets", "Various", None, "Menu Source URL", None, "CLEARED — WRONG OUTLET")
    ]

    for item in systemic_entries:
        rev_id = f"REV-{next_rev:03d}"
        next_rev += 1
        row = (
            rev_id, item[1], item[2], item[3], item[4], item[5], item[6],
            item[7], item[8], item[9], item[10], item[11], item[12], item[13],
            item[14], item[15], item[16], item[17], item[18], item[19], item[20]
        )
        ws_reg_rw.append(list(row))
        new_reg_rows.append(rev_id)

    print(f"Appended {len(new_reg_rows)} systemic audit entries ({new_reg_rows[0]} to {new_reg_rows[-1]}) to URL Review Register.")

    # 7. Atomic Save
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

    # 8. Append to review_list_20261110.csv
    fieldnames = ["stall_licence_no", "stall_name", "source_url", "reason", "extracted_postal", "target_postal", "extracted_unit", "target_unit", "extracted_name", "target_name", "crawl_timestamp"]
    existing_keys = set()
    if os.path.exists(REVIEW_CSV_PATH):
        with open(REVIEW_CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                existing_keys.add((r["stall_licence_no"], r["source_url"]))

    with open(REVIEW_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        added_count = 0
        for r in review_additions:
            k = (r["stall_licence_no"], r["source_url"])
            if k not in existing_keys:
                writer.writerow(r)
                existing_keys.add(k)
                added_count += 1

    print(f"Appended {added_count} review entries to {REVIEW_CSV_PATH}.")
    print(f"Total time elapsed: {time.time() - t0:.2f}s")

if __name__ == "__main__":
    main()
