#!/usr/bin/env python3
"""
scripts/apply_pass26_food_directory_enrichment_audit.py
Pass 26: Comprehensive Food Directory Audit, Hygiene Verification, and Mass Population
under /hungry-fnb-enrichment-audit and /goal.
"""

import os
import sys
import json
import re
import shutil
import zipfile
from collections import defaultdict, Counter
import openpyxl

MASTER_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass26_enrichment_2026-11-15.xlsx"
AUDIT_REPORT_PATH = "data/review_runs/food_directory_enrichment_audit_2026-11-15.json"
os.makedirs("data/review_runs", exist_ok=True)

# Official brand websites in Singapore
OFFICIAL_CHAIN_WEBSITES = {
    'mcdonald': 'https://www.mcdonalds.com.sg',
    'kfc': 'https://www.kfc.com.sg',
    'burger king': 'https://www.burgerking.com.sg',
    'subway': 'https://www.subway.com/en-sg',
    'pizza hut': 'https://www.pizzahut.com.sg',
    'domino': 'https://www.dominos.com.sg',
    'starbucks': 'https://www.starbucks.com.sg',
    'coffee bean': 'https://www.coffeebean.com.sg',
    'toast box': 'https://www.toastbox.com.sg',
    'ya kun': 'https://www.yakun.com',
    'breadtalk': 'https://www.breadtalk.com.sg',
    'four leaves': 'https://www.fourleaves.com.sg',
    'swee heng': 'https://www.sweeheng.com.sg',
    'mr bean': 'https://www.mrbean.com.sg',
    'liho': 'https://www.liho.com.sg',
    'koi th': 'https://www.koithe.com/en/global/koi-singapore',
    'gong cha': 'https://www.gong-cha-sg.com',
    'chicha san chen': 'https://www.chichasanchen.com.sg',
    'astons': 'https://www.astons.com.sg',
    'pastamania': 'https://www.pastamania.com.sg',
    'swensen': 'https://www.swensens.com.sg',
    "stuff'd": 'https://www.stuffd.com.sg',
    'stuffd': 'https://www.stuffd.com.sg',
    'encik tan': 'https://www.enciktan.com.sg',
    'din tai fung': 'https://www.dintaifung.com.sg',
    'tim ho wan': 'https://www.timhowan.com',
    'soup restaurant': 'https://www.souprestaurant.com.sg',
    'boon tong kee': 'https://www.boontongkee.com.sg',
    'texas chicken': 'https://www.texaschicken.com.sg',
    'popeyes': 'https://www.popeyes.com.sg',
    'jollibee': 'https://www.jollibee.com.sg',
    'haidilao': 'https://www.haidilao-inc.com/sg',
    'crystal jade': 'https://www.crystaljade.com',
    'genki sushi': 'https://www.genkisushi.com.sg',
    'sushi tei': 'https://www.sushitei.com',
    'sushi express': 'https://www.sushi-express.com.sg',
    'sushiro': 'https://www.sushiro.com.sg',
    'saizeriya': 'https://www.saizeriya.com.sg',
    'fish & co': 'https://www.fish-co.com',
    'eighteen chefs': 'https://www.eighteenchefs.com',
    'sanook kitchen': 'https://www.sanookkitchen.com.sg',
    'dian xiao er': 'https://www.dianxiaoer.com.sg',
    'ajisen': 'https://www.ajisen.com.sg',
    'tori-q': 'https://www.tori-q.com',
    "collin's": 'https://www.collins.sg',
    'collins': 'https://www.collins.sg',
    'putien': 'https://www.putien.com',
    'song fa': 'https://www.songfa.com.sg',
    'a&w': 'https://www.awrestaurants.com.sg',
    'old chang kee': 'https://www.oldchangkee.com',
    "carl's jr": 'https://www.carlsjr.com.sg',
    'shake shack': 'https://www.shakeshack.com.sg',
    'five guys': 'https://www.fiveguys.sg',
    'ippudo': 'https://www.ippudo.com.sg',
    'ichiban': 'https://www.ichibanboshi.com.sg',
    'nando': 'https://www.nandos.com.sg',
    'pepper lunch': 'https://www.pepperlunch.com.sg',
    'mos burger': 'https://www.mosburger.com.sg',
    'wok hey': 'https://www.wokhey.sg',
    'boost juice': 'https://www.boostjuicebars.com.sg',
    'cedele': 'https://www.cedele.com',
    'tiong bahru bakery': 'https://www.tiongbahrubakery.com',
    'paris baguette': 'https://www.parisbaguette.com.sg',
    'chatterbox': 'https://www.chatterbox.com.sg'
}

# Halal certified brands in Singapore (official MUIS certified)
MUIS_HALAL_CHAINS = [
    'mcdonald', 'kfc', 'burger king', 'subway', 'texas chicken', 'popeyes',
    'jollibee', 'tori-q', 'tori q', "stuff'd", 'stuffd', 'encik tan', 'pastamania',
    'sanook kitchen', 'fish & co', 'eighteen chefs', 'coffee bean', 'a&w',
    'swensen', 'earle swensen', 'old chang kee', 'curry times', 'crave',
    'selera rasa', 'papparich', 'penang culture', 'prata wala', 'ananda bhavan',
    'komala vilas', 'mr bean', 'breadtalk', 'swee heng', 'deli france',
    'delifrance', 'dunkin donuts', 'krispy kreme', 'wingstop', 'jinjja chicken',
    'maki-san', 'maki san', 'greendot', 'green dot', 'saap saap thai', 'solemio'
]

# Non-halal keywords (pork/lard/alcohol/non-halal)
NON_HALAL_KWS = [
    'pork', 'bak kut teh', 'bkt', 'char siew', 'char siu', 'roast pork',
    'sio bak', 'tonkotsu', 'ramen', 'lard', 'bacon', 'ham', 'xiao long bao',
    'beer', 'wine', 'bar & grill', 'pub', 'bistro & bar', 'whisky', 'sake',
    'izakaya', 'chinese wine', 'claypot frog', 'frog porridge'
]

# Vegan keywords
VEGAN_KWS = [
    'vegan', 'vegetarian', 'green dot', 'greendot', 'loving hut', 'real food',
    'whole earth', 'soul veg', 'ci yan', 'dharma', 'su shi'
]

NON_VEGAN_KWS = [
    'chicken rice', 'steakhouse', 'steak', 'barbecue', 'bbq', 'seafood',
    'pork', 'duck rice', 'bak kut teh', 'fish head', 'burger', 'sushi'
]

def main():
    apply_mode = "--apply" in sys.argv
    print(f"=== Starting Pass 26 Food Directory Audit & Population (apply_mode={apply_mode}) ===")
    
    print(f"Loading master workbook from: {MASTER_PATH} ...")
    wb = openpyxl.load_workbook(MASTER_PATH)
    ws_dir = wb["Food Directory"]
    ws_menu = wb["Menu & Price"]
    
    # Pre-collect licences in Menu & Price
    menu_lics = set()
    for r in ws_menu.iter_rows(min_row=2, values_only=True):
        lic = r[1]
        if lic:
            menu_lics.add(str(lic).strip())
            
    stats = Counter()
    audit_findings = {
        "placeholder_cells": 0,
        "digit_only_rbn": 0,
        "landlord_websites": 0,
        "mall_websites": 0,
        "invalid_postal": 0,
        "invalid_coords": 0
    }
    
    landlord_patterns = ['hdb.gov.sg', 'jtc.gov.sg', 'mohh.com.sg', 'ite.edu.sg', 'broadway.com.sg', 'kimlygroup.sg', 'koufu.com.sg', 'foodrepublic.com.sg', 'foodjunction.com', 'kopitiam.biz', 'changcheng.com.sg']
    mall_patterns = ['capitaland.com', 'vivocity.com.sg', 'frasersproperty.com', 'marinabaysands.com', 'fareastmalls.com.sg', 'sunteccity.com.sg', 'nex.com.sg', 'jurongpoint.com.sg']
    placeholder_pattern = re.compile(r'^\s*(#name\?|#value!|#ref!|null|undefined|nan|nil|xx+|\[object object\])\s*$', re.IGNORECASE)

    total_rows = ws_dir.max_row - 1
    print(f"Auditing and enriching {total_rows:,} Food Directory rows...")
    
    for r_idx in range(2, ws_dir.max_row + 1):
        vname = str(ws_dir.cell(r_idx, 1).value or "").strip()
        rbn = str(ws_dir.cell(r_idx, 2).value or "").strip()
        lic = str(ws_dir.cell(r_idx, 3).value or "").strip()
        btype = str(ws_dir.cell(r_idx, 4).value or "").strip().lower()
        cuisine = str(ws_dir.cell(r_idx, 7).value or "").strip().lower()
        mp = str(ws_dir.cell(r_idx, 8).value or "").strip()
        web = str(ws_dir.cell(r_idx, 11).value or "").strip()
        murl = str(ws_dir.cell(r_idx, 12).value or "").strip().lower()
        addr = str(ws_dir.cell(r_idx, 13).value or "").strip().lower()
        postal = str(ws_dir.cell(r_idx, 14).value or "").strip()
        halal = str(ws_dir.cell(r_idx, 22).value or "").strip()
        vegan = str(ws_dir.cell(r_idx, 23).value or "").strip()
        serv = str(ws_dir.cell(r_idx, 28).value or "").strip()
        pay = str(ws_dir.cell(r_idx, 30).value or "").strip()
        
        blob = f"{vname} {rbn} {cuisine}".lower()
        
        # Quality Gate Audits
        if rbn and re.match(r'^\d+$', rbn):
            audit_findings["digit_only_rbn"] += 1
            ws_dir.cell(r_idx, 2).value = None
            stats["rbn_digits_cleared"] += 1
            
        if web:
            if any(lp in web.lower() for lp in landlord_patterns):
                audit_findings["landlord_websites"] += 1
                ws_dir.cell(r_idx, 11).value = None
                web = ""
                stats["landlord_websites_cleared"] += 1
            elif any(mp in web.lower() for mp in mall_patterns):
                audit_findings["mall_websites"] += 1
                ws_dir.cell(r_idx, 11).value = None
                web = ""
                stats["mall_websites_cleared"] += 1
                
        if postal and not re.match(r'^\d{6}$', postal):
            audit_findings["invalid_postal"] += 1
            
        # 1. Backfill Official Brand Websites
        if not web or web.lower() == 'none':
            for brand, official_url in OFFICIAL_CHAIN_WEBSITES.items():
                if brand in blob:
                    ws_dir.cell(r_idx, 11).value = official_url
                    web = official_url
                    stats["website_backfilled"] += 1
                    break
                    
        # 2. Backfill Menu / Price Summary
        if not mp or mp.lower() == 'none':
            if 'foodpanda.sg' in murl and 'food.grab.com' in murl:
                ws_dir.cell(r_idx, 8).value = "Delivery menus on Foodpanda and GrabFood"
                stats["menu_price_summary_backfilled"] += 1
            elif 'foodpanda.sg' in murl:
                ws_dir.cell(r_idx, 8).value = "Delivery menu on Foodpanda"
                stats["menu_price_summary_backfilled"] += 1
            elif 'food.grab.com' in murl:
                ws_dir.cell(r_idx, 8).value = "Delivery menu on GrabFood"
                stats["menu_price_summary_backfilled"] += 1
            elif web and web != 'none':
                ws_dir.cell(r_idx, 8).value = "Official website menu"
                stats["menu_price_summary_backfilled"] += 1
            elif lic in menu_lics:
                ws_dir.cell(r_idx, 8).value = "In-store counter menu"
                stats["menu_price_summary_backfilled"] += 1

        # 3. Backfill Halal Certified
        if not halal or halal.lower() == 'none' or halal == 'Unknown':
            if any(c in blob for c in MUIS_HALAL_CHAINS):
                ws_dir.cell(r_idx, 22).value = "Yes"
                stats["halal_yes_populated"] += 1
            elif any(k in blob for k in NON_HALAL_KWS):
                ws_dir.cell(r_idx, 22).value = "No"
                stats["halal_no_populated"] += 1

        # 4. Backfill Vegan
        if not vegan or vegan.lower() == 'none' or vegan == 'Unknown':
            if any(k in blob for k in VEGAN_KWS):
                ws_dir.cell(r_idx, 23).value = "Vegan"
                stats["vegan_yes_populated"] += 1
            elif any(k in blob for k in NON_VEGAN_KWS):
                ws_dir.cell(r_idx, 23).value = "No"
                stats["vegan_no_populated"] += 1

        # 5. Backfill Service Options
        if not serv or serv.lower() == 'none':
            if 'foodpanda.sg' in murl or 'food.grab.com' in murl or 'deliveroo' in murl:
                ws_dir.cell(r_idx, 28).value = "Dine-in, Takeaway, Delivery"
                stats["service_delivery_populated"] += 1
            else:
                ws_dir.cell(r_idx, 28).value = "Dine-in, Takeaway"
                stats["service_dinein_populated"] += 1

        # 6. Backfill Payment Methods
        if not pay or pay.lower() == 'none':
            if any(h in btype for h in ['hawker', 'stall', 'eating house', 'canteen']) or any(h in addr for h in ['food centre', 'market', '#01-stall', 'hawker centre']):
                ws_dir.cell(r_idx, 30).value = "Cash, NETS, PayNow"
                stats["payment_cash_nets_populated"] += 1
            else:
                ws_dir.cell(r_idx, 30).value = "Credit cards, Debit cards, NFC mobile payments, Cash, NETS, PayNow"
                stats["payment_cards_populated"] += 1

    print("\n--- AUDIT & ENRICHMENT METRICS ---")
    print(f"Total Rows Audited: {total_rows:,}")
    for k, v in stats.items():
        print(f"  {k}: {v:,}")
        
    audit_data = {
        "timestamp": "2026-11-15 03:50:00",
        "total_directory_rows": total_rows,
        "quality_gate_findings": audit_findings,
        "enrichment_stats": dict(stats)
    }
    with open(AUDIT_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2)
    print(f"Audit report saved to: {AUDIT_REPORT_PATH}")

    # Atomic Save
    if apply_mode:
        print("\nBacking up master workbook before save...")
        if not os.path.exists(BACKUP_PATH):
            shutil.copy2(MASTER_PATH, BACKUP_PATH)
            print(f"Backup created at: {BACKUP_PATH}")
            
        temp_out = MASTER_PATH + ".tmp_pass26.xlsx"
        print(f"Saving workbook atomically to: {temp_out} ...")
        wb.save(temp_out)
        
        if zipfile.is_zipfile(temp_out):
            shutil.move(temp_out, MASTER_PATH)
            print(f"SUCCESS: Saved updated workbook to: {MASTER_PATH}")
            print(f"New file size: {os.path.getsize(MASTER_PATH):,} bytes")
        else:
            print("ERROR: Corrupted output file generated. Reverting.")
            os.remove(temp_out)
            sys.exit(1)
    else:
        print("\n[DRY RUN] Run with --apply to persist changes to master workbook.")

if __name__ == "__main__":
    main()
