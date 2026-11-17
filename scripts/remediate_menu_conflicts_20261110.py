#!/usr/bin/env python3
"""
scripts/remediate_menu_conflicts_20261110.py

Remediates cross-stall contamination and misattributed URLs in Menu & Price:
1. Newton 32 BBQ Seafood (NTF0132003): rows 103565-103568 -> clear misattributed Newton 51 URL & image, clean description.
2. Newton 51 (Newton Food Centre): rows 106715-106722 -> correct licence NTF0132003 to NTF0151004 (unit #01-51).
3. SLOPPY SHACK (NE08128A000): rows 1720-1791 (72 rows) -> clear misattributed Foodpanda URL (dishes are Magic Wok Thai items).
4. Ai Xin Korean & Japanese Food (NW05105C003): 182 rows -> clear misattributed AL Hawa Indian Muslim Food URL & images.
5. AJ Delights (BM20182002): 25 rows -> clear misattributed Pu Tian Delights URL & images.
6. Ahjussi Korean Cuisine (CE09F31V005): 28 rows -> clear misattributed WuGuYuFen Hunan Cuisine URL & images.
7. Ah Ma Chi Mian (C99161N003 & C89200E001): 50 rows -> clear mismatched Parkway Parade Foodpanda URL.
8. URL Review Register: Append audit review records REV-025 through REV-031.
"""
import openpyxl
import re
import os
import sys
import time
import zipfile
import hashlib

WORKBOOK_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def main():
    dry_run = "--dry-run" in sys.argv
    print(f"=== Menu Conflict Remediation === (Dry run: {dry_run})")
    
    initial_sha = sha256_file(WORKBOOK_PATH)
    initial_size = os.path.getsize(WORKBOOK_PATH)
    print(f"Initial Workbook SHA-256: {initial_sha} ({initial_size} bytes)")
    
    t0 = time.time()
    wb = openpyxl.load_workbook(WORKBOOK_PATH)
    print(f"Loaded workbook in {time.time() - t0:.2f}s")
    
    ws_menu = wb["Menu & Price"]
    headers = [cell.value for cell in ws_menu[1]]
    ix = {h: i + 1 for i, h in enumerate(headers)}
    
    c_venue = ix["F&B Venue Name"]
    c_lic = ix["SFA Licence"]
    c_dish = ix["Menu Item / Dish Name"]
    c_desc = ix["Description / Notes"]
    c_img = ix["Dish Image URL"]
    c_url = ix["Menu Source URL"]
    
    updates = {
        "newton_32_cleared": 0,
        "newton_51_licence_corrected": 0,
        "sloppy_shack_cleared": 0,
        "ai_xin_cleared": 0,
        "aj_delights_cleared": 0,
        "ahjussi_cleared": 0,
        "ah_ma_chi_mian_cleared": 0,
    }
    
    # Iterate through Menu & Price
    for r in range(2, ws_menu.max_row + 1):
        venue = str(ws_menu.cell(row=r, column=c_venue).value or "").strip()
        lic = str(ws_menu.cell(row=r, column=c_lic).value or "").strip()
        dish = str(ws_menu.cell(row=r, column=c_dish).value or "").strip()
        url = str(ws_menu.cell(row=r, column=c_url).value or "").strip()
        desc = str(ws_menu.cell(row=r, column=c_desc).value or "").strip()
        
        # 1. Newton 32 BBQ Seafood (NTF0132003) with newton-51 URL (rows 103565-103568)
        if lic == "NTF0132003" and "newton 32" in venue.lower():
            if "newton-51" in url.lower():
                ws_menu.cell(row=r, column=c_url).value = None
                ws_menu.cell(row=r, column=c_img).value = None
                cleaned_desc = re.sub(r'\[Main Menu \d{2}:\d{2}:\d{2}-\d{2}:\d{2}:\d{2}\]', '', desc).strip()
                ws_menu.cell(row=r, column=c_desc).value = f"{cleaned_desc} | Cleared misattributed Newton 51 Foodpanda URL; authentic stall 32 menu unverified."
                updates["newton_32_cleared"] += 1
                
        # 2. Newton 51 (Newton Food Centre) with NTF0132003 (rows 106715-106722)
        elif lic == "NTF0132003" and "newton 51" in venue.lower():
            ws_menu.cell(row=r, column=c_lic).value = "NTF0151004"
            updates["newton_51_licence_corrected"] += 1
            
        # 3. SLOPPY SHACK (NE08128A000): rows 1720-1791
        elif lic == "NE08128A000" and venue == "SLOPPY SHACK":
            if url and "sloppy-shack" in url.lower():
                ws_menu.cell(row=r, column=c_url).value = None
                ws_menu.cell(row=r, column=c_desc).value = f"{desc} | Cleared misattributed Sloppy Shack Foodpanda URL: dishes are Thai menu items from Magic Wok KINEX (cross-stall contamination)."
                updates["sloppy_shack_cleared"] += 1
                
        # 4. Ai Xin Korean & Japanese Food (NW05105C003)
        elif lic == "NW05105C003" and "al-hawa" in url.lower():
            ws_menu.cell(row=r, column=c_url).value = None
            ws_menu.cell(row=r, column=c_img).value = None
            ws_menu.cell(row=r, column=c_desc).value = f"{desc} | Cleared misattributed AL Hawa Indian Muslim Food URL from Ai Xin Korean & Japanese Food."
            updates["ai_xin_cleared"] += 1
            
        # 5. AJ Delights (BM20182002)
        elif lic == "BM20182002" and "pu-tian" in url.lower():
            ws_menu.cell(row=r, column=c_url).value = None
            ws_menu.cell(row=r, column=c_img).value = None
            ws_menu.cell(row=r, column=c_desc).value = f"{desc} | Cleared misattributed Pu Tian Delights URL from AJ Delights muffin stall."
            updates["aj_delights_cleared"] += 1
            
        # 6. Ahjussi Korean Cuisine (CE09F31V005)
        elif lic == "CE09F31V005" and "wuguyufen" in url.lower():
            ws_menu.cell(row=r, column=c_url).value = None
            ws_menu.cell(row=r, column=c_img).value = None
            ws_menu.cell(row=r, column=c_desc).value = f"{desc} | Cleared misattributed WuGuYuFen Hunan Cuisine URL from Ahjussi Korean Cuisine."
            updates["ahjussi_cleared"] += 1
            
        # 7. Ah Ma Chi Mian (C99161N003 & C89200E001) with Parkway Parade URL
        elif lic in ("C99161N003", "C89200E001") and "ah-ma-chi-mian-a-ma-chi-mian-kopitiam-at-parkway-parade" in url.lower():
            ws_menu.cell(row=r, column=c_url).value = None
            ws_menu.cell(row=r, column=c_desc).value = f"{desc} | Cleared mismatched Parkway Parade URL from Jurong stall."
            updates["ah_ma_chi_mian_cleared"] += 1
            
    print("Updates to Menu & Price:")
    for k, v in updates.items():
        print(f"  {k}: {v}")
        
    total_modified = sum(updates.values())
    print(f"Total Menu & Price rows updated: {total_modified}")

    # 8. Append to URL Review Register
    ws_reg = wb["URL Review Register"]
    reg_rows = [
        ("REV-025", "Menu & Price", "103565-103568", "Menu & Price", "Menu Source URL", "Newton 32 BBQ Seafood", "NTF0132003",
         "Newton 32 BBQ Seafood rows cite Foodpanda URL for Newton 51 at a different unit (#01-51 vs #01-32).",
         "https://foodpanda.sg/restaurant/y2ny/newton-51-newton-food-centre", "Cleared misattributed Newton 51 URL and dish images; stall 32 menu unverified",
         None, "Foodpanda y2ny is titled Newton 51 at #01-51; cleared misattributed link from Newton 32 BBQ Seafood.", "2026-11-10", "CORRECTED",
         "103565", "Newton 32 BBQ Seafood", "NTF0132003", None, "Menu Source URL", None, "SOURCE FIELD CLEARED; authentic stall 32 menu unverified"),
        ("REV-026", "Menu & Price", "106715-106722", "Menu & Price", "SFA Licence", "Newton 51 (Newton Food Centre)", "NTF0132003",
         "Newton 51 rows carried SFA Licence NTF0132003 belonging to stall 32 instead of NTF0151004 (#01-51).",
         "NTF0132003", "Corrected licence to NTF0151004 matching unit #01-51",
         "NTF0151004", "Foodpanda y2ny corresponds to Newton 51 at #01-51 with SFA Licence NTF0151004.", "2026-11-10", "CORRECTED",
         "106715", "Newton 51 (Newton Food Centre)", "NTF0151004", "https://foodpanda.sg/restaurant/y2ny/newton-51-newton-food-centre", "SFA Licence", "NTF0151004", "LICENCE CORRECTED to NTF0151004"),
        ("REV-027", "Menu & Price", "1720-1791", "Menu & Price", "Menu Source URL", "SLOPPY SHACK", "NE08128A000",
         "Sloppy Shack rows cite Foodpanda URL for Sloppy Shack but dish rows contain 70 Magic Wok Thai items.",
         "https://foodpanda.sg/restaurant/n5lc/sloppy-shack-ehub", "Cleared misattributed Sloppy Shack URL from Magic Wok Thai dishes",
         None, "Dishes are Thai items from Magic Wok KINEX; cleared misattributed Sloppy Shack Foodpanda link.", "2026-11-10", "CORRECTED",
         "1720", "SLOPPY SHACK", "NE08128A000", None, "Menu Source URL", None, "SOURCE FIELD CLEARED; Thai dishes from Magic Wok unverified"),
        ("REV-028", "Menu & Price", "105430-105611", "Menu & Price", "Menu Source URL", "Ai Xin Korean & Japanese Food", "NW05105C003",
         "Ai Xin Korean & Japanese Food rows cite Foodpanda URL for AL Hawa Indian Muslim Food.",
         "https://foodpanda.sg/restaurant/sv9k/al-hawa-indian-muslim-food-sembawang-close", "Cleared misattributed AL Hawa URL and dish images",
         None, "Foodpanda sv9k is AL Hawa Indian Muslim Food (Biryani/Prata); cross-contaminated into Ai Xin.", "2026-11-10", "CORRECTED",
         "105430", "Ai Xin Korean & Japanese Food", "NW05105C003", None, "Menu Source URL", None, "SOURCE FIELD CLEARED; cross-stall contamination"),
        ("REV-029", "Menu & Price", "105661-105685", "Menu & Price", "Menu Source URL", "AJ Delights", "BM20182002",
         "AJ Delights muffin bakery rows cite Foodpanda URL for Pu Tian Delights zi char stall.",
         "https://foodpanda.sg/restaurant/qfn4/pu-tian-delights-alexandra-village-food-centre-qfn4", "Cleared misattributed Pu Tian Delights URL and dish images",
         None, "Foodpanda qfn4 is Pu Tian Delights at Alexandra Village; cross-contaminated into AJ Delights muffins.", "2026-11-10", "CORRECTED",
         "105661", "AJ Delights", "BM20182002", None, "Menu Source URL", None, "SOURCE FIELD CLEARED; cross-stall contamination"),
        ("REV-030", "Menu & Price", "105259-105286", "Menu & Price", "Menu Source URL", "Ahjussi Korean Cuisine", "CE09F31V005",
         "Ahjussi Korean Cuisine rows cite Foodpanda URL for WuGuYuFen Hunan Cuisine at 313@Somerset.",
         "https://foodpanda.sg/restaurant/w0v4/wuguyufen-hunan-cuisine-313atsomerset-w0v4", "Cleared misattributed WuGuYuFen Hunan Cuisine URL and dish images",
         None, "Foodpanda w0v4 is WuGuYuFen Hunan Cuisine; cross-contaminated into Ahjussi Korean Cuisine.", "2026-11-10", "CORRECTED",
         "105259", "Ahjussi Korean Cuisine", "CE09F31V005", None, "Menu Source URL", None, "SOURCE FIELD CLEARED; cross-stall contamination"),
        ("REV-031", "Menu & Price", "104560-104609", "Menu & Price", "Menu Source URL", "Ah Ma Chi Mian", "C99161N003, C89200E001",
         "Jurong Point and Jurong Gateway Ah Ma Chi Mian rows cite Parkway Parade Foodpanda URL.",
         "https://foodpanda.sg/restaurant/b4k4/ah-ma-chi-mian-a-ma-chi-mian-kopitiam-at-parkway-parade", "Cleared mismatched Parkway Parade URL from Jurong stalls",
         None, "Foodpanda b4k4 is Parkway Parade; mismatched across Jurong Point (C99161N003) and Jurong Gateway (C89200E001).", "2026-11-10", "CORRECTED",
         "104560", "Ah Ma Chi Mian", "C99161N003", None, "Menu Source URL", None, "SOURCE FIELD CLEARED; cross-branch mismatch"),
    ]
    
    for entry in reg_rows:
        ws_reg.append(list(entry))
    print(f"Appended {len(reg_rows)} review entries (REV-025 to REV-031) to URL Review Register.")
    
    if dry_run:
        print("Dry run complete; no changes saved to disk.")
        return

    t_save = time.time()
    print(f"Saving workbook to {WORKBOOK_PATH}...")
    wb.save(WORKBOOK_PATH)
    print(f"Workbook saved in {time.time() - t_save:.2f}s")
    
    final_sha = sha256_file(WORKBOOK_PATH)
    final_size = os.path.getsize(WORKBOOK_PATH)
    print(f"Final Workbook SHA-256: {final_sha} ({final_size} bytes)")
    
    # Test ZIP integrity
    print("Verifying ZIP integrity...")
    with zipfile.ZipFile(WORKBOOK_PATH, "r") as z:
        bad = z.testzip()
        if bad is None:
            print("ZIP integrity: PASS (testzip() == None)")
        else:
            print(f"FAIL: Corrupt file in ZIP: {bad}")
            sys.exit(1)

if __name__ == "__main__":
    main()
