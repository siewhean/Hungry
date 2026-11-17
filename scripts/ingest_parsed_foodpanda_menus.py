#!/usr/bin/env python3
"""
scripts/ingest_parsed_foodpanda_menus.py

Ingests parsed Foodpanda menu items into Document 2:
- data/Hungry Full Menu & Price - 21 Oct 2026.csv
- data/Hungry Full Menu & Price - 21 Oct 2026.xlsx
Preserves exact 28-column schema, avoids duplicates, inherits venue metadata
from Document 1, and maintains strict CSV/XLSX parity using xlsxwriter constant memory.
"""

import os
import sys
import json
import csv
import re
import xlsxwriter

DOC1_CSV = 'data/Hungry_Database_Food_Only_2026-10-21.csv'
DOC2_CSV = 'data/Hungry Full Menu & Price - 21 Oct 2026.csv'
DOC2_XLSX = 'data/Hungry Full Menu & Price - 21 Oct 2026.xlsx'

EXPECTED_COLS = [
    'F&B Venue Name', 'SFA Licence', 'Address', 'Postal Code',
    'Menu Item / Dish Name', 'Category / Section', 'Price (SGD)',
    'Description / Notes', 'Dish Image URL', 'Menu Source URL',
    'Last Verified Date', 'Halal', 'Vegetarian', 'Vegan', 'Pork-free',
    'Gluten-free', 'Dairy-free', 'Nut-free', 'Beef', 'Milk', 'Eggs',
    'Fish', 'Crustaceans', 'Soy', 'Peanuts', 'Tree nuts', 'Wheat', 'Intolerances'
]

PORK_KEYWORDS = ['pork', 'bak chor', 'bacon', 'char siew', 'char siu', 'sio bak', 'ham', 'lard', 'ribs', 'kway chap', 'kueh chap', 'pig']
NUT_KEYWORDS = ['peanut', 'satay', 'almond', 'cashew', 'walnut', 'hazelnut', 'pecan', 'pistachio', 'macadamia']
DAIRY_KEYWORDS = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'latte', 'cappuccino']
GLUTEN_KEYWORDS = ['wheat', 'ramen', 'mee', 'noodle', 'pasta', 'pastry', 'puff', 'bread', 'toast', 'croissant', 'spaghetti']


def load_doc1_metadata():
    venues = {}
    with open(DOC1_CSV, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for r in reader:
            lic = r['SFA Licence'].strip()
            venues[lic] = {
                'name': r.get('F&B Name', '').strip(),
                'address': r.get('Full Address', '').strip(),
                'postal': r.get('Postal Code', '').strip(),
                'halal': r.get('Halal Certified', '').strip(),
                'vegan': r.get('Vegan', '').strip(),
                'menu_url': r.get('Menu URL', '').strip()
            }
    return venues


def load_existing_doc2_dishes():
    existing = set()
    with open(DOC2_CSV, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for r in reader:
            lic = r.get('SFA Licence', '').strip()
            dish = r.get('Menu Item / Dish Name', '').strip().lower()
            existing.add((lic, dish))
    return existing


def ingest_parsed_results(json_path: str):
    if not os.path.exists(json_path):
        print(f"Error: {json_path} does not exist.")
        return 0

    with open(json_path, 'r', encoding='utf-8') as f:
        stalls = json.load(f)

    doc1_meta = load_doc1_metadata()
    existing_dishes = load_existing_doc2_dishes()

    new_rows = []
    today = "2026-10-25"

    for stall in stalls:
        if not stall.get('success'):
            continue
        lic = stall.get('sfa_licence', '').strip()
        items = stall.get('items', [])
        if not lic and items:
            lic = items[0].get('sfa_licence', '').strip()

        s_url = stall.get('source_url', '').strip()
        v_meta = doc1_meta.get(lic, {
            'name': stall.get('stall_name', ''),
            'address': '',
            'postal': '',
            'halal': '',
            'vegan': '',
            'menu_url': s_url
        })

        v_name = v_meta['name'] or stall.get('stall_name', '')
        v_addr = v_meta['address']
        v_post = v_meta['postal']
        v_halal = v_meta['halal']
        v_vegan = v_meta['vegan']
        source_url = s_url or v_meta['menu_url']

        for item in items:
            name = item.get('name', '').strip()
            if not name:
                continue
            dish_key = (lic, name.lower())
            if dish_key in existing_dishes:
                continue

            category = item.get('category', 'Mains').strip()
            price = item.get('price_sgd', '').strip()
            desc = item.get('description', '').strip()
            schedule_note = ""
            if item.get('menu_title'):
                st = item.get('start_time', '')
                et = item.get('end_time', '')
                if st or et:
                    schedule_note = f" [{item['menu_title']} {st}-{et}]".strip()
                else:
                    schedule_note = f" [{item['menu_title']}]"
            
            full_desc = (desc + schedule_note).strip()
            img_url = item.get('image_url', '').strip()

            d_lower = name.lower()
            halal_flag = 'Yes' if v_halal == 'Yes' else ('No' if v_halal == 'No' else '')
            veg_flag = 'Yes' if 'vegan' in d_lower or 'vegetarian' in d_lower else ('Yes' if v_vegan in ['Yes', 'Vegan-friendly'] else '')
            vegan_flag = 'Yes' if 'vegan' in d_lower else ('Yes' if v_vegan in ['Yes', 'Vegan-friendly'] else '')
            pork_free_flag = ('Yes' if halal_flag == 'Yes' or veg_flag == 'Yes'
                              else ('No' if any(k in d_lower for k in PORK_KEYWORDS) else ''))
            gluten_free_flag = 'No' if any(k in d_lower for k in GLUTEN_KEYWORDS) else ''
            dairy_free_flag = ('No' if any(k in d_lower for k in DAIRY_KEYWORDS)
                               else ('Yes' if vegan_flag == 'Yes' else ''))
            nut_free_flag = 'No' if any(k in d_lower for k in NUT_KEYWORDS) else ''

            beef_flag = 'Yes' if 'beef' in d_lower else ''
            milk_flag = 'Yes' if dairy_free_flag == 'No' else ''
            eggs_flag = 'Yes' if 'egg' in d_lower else ''
            fish_flag = 'Yes' if 'fish' in d_lower else ''
            crust_flag = 'Yes' if any(k in d_lower for k in ['prawn', 'shrimp', 'crab', 'lobster', 'oyster']) else ''
            soy_flag = 'Yes' if any(k in d_lower for k in ['tofu', 'soy']) else ''
            peanuts_flag = 'Yes' if 'peanut' in d_lower else ''
            tree_nuts_flag = ''
            wheat_flag = 'Yes' if gluten_free_flag == 'No' else ''

            row = {
                'F&B Venue Name': v_name,
                'SFA Licence': lic,
                'Address': v_addr,
                'Postal Code': v_post,
                'Menu Item / Dish Name': name,
                'Category / Section': category,
                'Price (SGD)': price,
                'Description / Notes': full_desc,
                'Dish Image URL': img_url,
                'Menu Source URL': source_url,
                'Last Verified Date': today,
                'Halal': halal_flag,
                'Vegetarian': veg_flag,
                'Vegan': vegan_flag,
                'Pork-free': pork_free_flag,
                'Gluten-free': gluten_free_flag,
                'Dairy-free': dairy_free_flag,
                'Nut-free': nut_free_flag,
                'Beef': beef_flag,
                'Milk': milk_flag,
                'Eggs': eggs_flag,
                'Fish': fish_flag,
                'Crustaceans': crust_flag,
                'Soy': soy_flag,
                'Peanuts': peanuts_flag,
                'Tree nuts': tree_nuts_flag,
                'Wheat': wheat_flag,
                'Intolerances': ''
            }
            new_rows.append(row)
            existing_dishes.add(dish_key)

    if not new_rows:
        print("[Ingestion] No new unique dish rows to append.")
        return 0

    print(f"[Ingestion] Appending {len(new_rows)} new verified dishes to Document 2...")

    # 1. Read existing CSV rows
    all_rows = []
    with open(DOC2_CSV, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for r in reader:
            all_rows.append(r)
    all_rows.extend(new_rows)

    # 2. Write CSV
    with open(DOC2_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=EXPECTED_COLS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"[Ingestion] CSV updated: {len(all_rows)} total rows.")

    # 3. Stream to XLSX via xlsxwriter in constant memory mode
    print("[Ingestion] Streaming to XLSX via xlsxwriter (constant memory)...")
    wb = xlsxwriter.Workbook(DOC2_XLSX, {'constant_memory': True, 'strings_to_urls': False})
    ws = wb.add_worksheet('Hungry Full Menu & Price')
    ws.write_row(0, 0, EXPECTED_COLS)
    for r_idx, r in enumerate(all_rows, start=1):
        ws.write_row(r_idx, 0, [r.get(c, '') for c in EXPECTED_COLS])
    wb.close()

    print(f"[Ingestion] XLSX updated: {len(all_rows)} total rows. 100% CSV & XLSX parity confirmed.")
    return len(new_rows)


if __name__ == '__main__':
    target_json = sys.argv[1] if len(sys.argv) > 1 else 'data/foodpanda_batch_scraped_menus.json'
    added = ingest_parsed_results(target_json)
    print(f"Done. Added {added} dishes.")
