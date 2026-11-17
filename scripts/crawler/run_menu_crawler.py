#!/usr/bin/env python3
"""
scripts/crawler/run_menu_crawler.py

Continuous crawler for hungry-menu-crawl-verify.
Iterates over all stalls in Food Directory with Menu URLs.
Enforces Identity Gate (postal code, unit #XX-YY, business name overlap).
Appends strictly verified menu items to JSON Lines and rejected/errored stalls to review list.
"""

import os
import re
import ssl
import sys
import json
import time
import uuid
import openpyxl
import urllib.request
from datetime import datetime

SSL_CTX = ssl._create_unverified_context()

WORKBOOK_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
DATE_STR = "2026-11-08"
OUTPUT_DIR = f"data/menus/{DATE_STR}"
OUTPUT_JSONL = f"{OUTPUT_DIR}/menus_consolidated_{DATE_STR}.jsonl"
REVIEW_JSONL = f"{OUTPUT_DIR}/review_list_{DATE_STR}.jsonl"
PROGRESS_FILE = f"{OUTPUT_DIR}/crawler_progress.json"

os.makedirs(OUTPUT_DIR, exist_ok=True)

FP_HEADERS = {
    "User-Agent": "Foodpanda/24.12.0 (Linux; U; Android 14; Pixel 8 Pro)",
    "Accept": "application/json",
    "x-fp-api-key": "android"
}

def clean_unit(text):
    if not text:
        return ""
    m = re.search(r'#(\d+)-([A-Za-z0-9]+)', text)
    if m:
        return f"#{int(m.group(1)):02d}-{m.group(2).upper()}"
    m2 = re.search(r'#(\d+)', text)
    if m2:
        return f"#{int(m2.group(1)):02d}"
    return ""

def token_overlap(s1, s2):
    t1 = set(re.findall(r'[a-zA-Z0-9]+', s1.lower()))
    t2 = set(re.findall(r'[a-zA-Z0-9]+', s2.lower()))
    stopwords = {'food', 'court', 'singapore', 'stall', 'centre', 'pte', 'ltd', 'and', 'the', 'at', 'cafe', 'restaurant', 'islandwide'}
    common = (t1 & t2) - stopwords
    return len(common) > 0

def load_processed_licences():
    processed = set()
    if os.path.exists(OUTPUT_JSONL):
        with open(OUTPUT_JSONL, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                try:
                    obj = json.loads(line)
                    lic = obj.get('stall_licence_no')
                    if lic: processed.add(lic.strip())
                except: pass
    if os.path.exists(REVIEW_JSONL):
        with open(REVIEW_JSONL, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                try:
                    obj = json.loads(line)
                    lic = obj.get('stall_licence_no')
                    if lic: processed.add(lic.strip())
                except: pass
    return processed

def load_stalls_to_crawl(processed_licences):
    print("Loading workbook Food Directory...")
    wb = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    ws = wb['Food Directory']
    headers = [c.value for c in next(ws.iter_rows(max_row=1))]
    hmap = {h: i for i, h in enumerate(headers)}
    
    stalls = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        lic = str(row[hmap.get('SFA Licence')] or '').strip()
        name = str(row[hmap.get('F&B Name')] or '').strip()
        murl = str(row[hmap.get('Menu URL')] or '').strip()
        postal = str(row[hmap.get('Postal Code')] or '').strip()
        addr = str(row[hmap.get('Full Address')] or '').strip()
        
        if not lic or lic in processed_licences:
            continue
        if not murl or murl == 'None' or 'http' not in murl:
            continue
            
        code = None
        if 'foodpanda.sg' in murl:
            match = re.search(r'restaurant/([a-zA-Z0-9]+)/', murl)
            if match:
                code = match.group(1)
        
        stalls.append({
            'licence': lic,
            'name': name,
            'postal': postal,
            'addr': addr,
            'url': murl,
            'code': code
        })
    print(f"Total pending stalls to crawl: {len(stalls)}")
    return stalls

def crawl_loop(batch_limit=None):
    processed_licences = load_processed_licences()
    stalls = load_stalls_to_crawl(processed_licences)
    
    if batch_limit:
        stalls = stalls[:batch_limit]
        
    print(f"Starting crawl run for {len(stalls)} stalls...")
    attempted = 0
    verified = 0
    items_total = 0
    rejected = 0
    skipped_or_blocked = 0
    
    out_f = open(OUTPUT_JSONL, 'a', encoding='utf-8')
    rev_f = open(REVIEW_JSONL, 'a', encoding='utf-8')
    
    try:
        for idx, s in enumerate(stalls, 1):
            attempted += 1
            now_ts = datetime.now().isoformat()
            
            # Non-foodpanda or missing code for now
            if not s['code']:
                skipped_or_blocked += 1
                rev_f.write(json.dumps({
                    'stall_licence_no': s['licence'],
                    'stall_name': s['name'],
                    'source_url': s['url'],
                    'reason': 'NON_FOODPANDA_OR_UNPARSED_URL',
                    'timestamp': now_ts
                }, ensure_ascii=False) + '\n')
                rev_f.flush()
                continue
                
            api_url = f"https://sg.fd-api.com/api/v5/vendors/{s['code']}?include=menus"
            req = urllib.request.Request(api_url, headers=FP_HEADERS)
            
            data = None
            retry_count = 0
            while retry_count < 2:
                try:
                    with urllib.request.urlopen(req, context=SSL_CTX, timeout=12) as resp:
                        data = json.loads(resp.read().decode('utf-8')).get('data', {})
                        break
                except urllib.error.HTTPError as he:
                    if he.code == 429:
                        print(f"[{idx}/{len(stalls)}] Rate-limit 429 encountered. Backing off 30s...")
                        time.sleep(30)
                        retry_count += 1
                    elif he.code in (400, 404):
                        # Vendor inactive or not found
                        break
                    else:
                        time.sleep(3)
                        retry_count += 1
                except Exception as e:
                    time.sleep(3)
                    retry_count += 1
            
            if data is None:
                skipped_or_blocked += 1
                rev_f.write(json.dumps({
                    'stall_licence_no': s['licence'],
                    'stall_name': s['name'],
                    'source_url': s['url'],
                    'reason': 'API_FETCH_UNAVAILABLE_OR_INACTIVE',
                    'timestamp': now_ts
                }, ensure_ascii=False) + '\n')
                rev_f.flush()
                time.sleep(1)
                continue
                
            extracted_postal = str(data.get('post_code') or '').strip()
            extracted_addr = str(data.get('address') or '').strip()
            extracted_name = str(data.get('name') or '').strip()
            
            target_postal = str(s['postal']).strip()
            postal_match = (extracted_postal == target_postal) if (extracted_postal and target_postal) else False
            
            target_unit = clean_unit(s['addr'])
            extracted_unit = clean_unit(extracted_addr)
            unit_match = (extracted_unit == target_unit) if (extracted_unit and target_unit) else False
            
            name_match = token_overlap(s['name'], extracted_name) or token_overlap(s['addr'], extracted_name)
            
            # 1. Identity Gate Evaluation
            if not postal_match or (target_unit and extracted_unit and not unit_match) or (not name_match and not unit_match):
                rejected += 1
                fail_reasons = []
                if not postal_match: fail_reasons.append(f"POSTAL_MISMATCH ({extracted_postal} vs {target_postal})")
                if target_unit and extracted_unit and not unit_match: fail_reasons.append(f"UNIT_MISMATCH ({extracted_unit} vs {target_unit})")
                if not name_match: fail_reasons.append(f"NAME_MISMATCH ({extracted_name} vs {s['name']})")
                
                rev_f.write(json.dumps({
                    'stall_licence_no': s['licence'],
                    'stall_name': s['name'],
                    'source_url': s['url'],
                    'reason': ' | '.join(fail_reasons),
                    'extracted_postal': extracted_postal,
                    'target_postal': target_postal,
                    'extracted_unit': extracted_unit,
                    'target_unit': target_unit,
                    'extracted_name': extracted_name,
                    'target_name': s['name'],
                    'timestamp': now_ts
                }, ensure_ascii=False) + '\n')
                rev_f.flush()
                time.sleep(1.2)
                continue
                
            # Identity gate PASSED
            menus = data.get('menus', [])
            stall_items = 0
            for menu in menus:
                m_title = menu.get('name') or 'Main Menu'
                for cat in menu.get('menu_categories', []):
                    cat_name = cat.get('name') or 'General'
                    for prod in cat.get('products', []):
                        item_name = prod.get('name', '').strip()
                        if not item_name: continue
                        desc = (prod.get('description') or '').strip()
                        images = prod.get('images', [])
                        img_url = images[0].get('image_url') if images else None
                        if img_url and '?' in img_url:
                            img_url = img_url.split('?')[0]
                            
                        variations = prod.get('product_variations', [])
                        price_sgd = None
                        variation_prices = []
                        if len(variations) == 1:
                            p_val = variations[0].get('price')
                            if p_val and float(p_val) > 0:
                                price_sgd = round(float(p_val), 2)
                        elif len(variations) > 1:
                            for v in variations:
                                vp = v.get('price')
                                if vp and float(vp) > 0:
                                    variation_prices.append(round(float(vp), 2))
                        
                        record = {
                            'stall_licence_no': s['licence'],
                            'stall_name': extracted_name,
                            'source_url': s['url'],
                            'source': 'foodpanda',
                            'verified': True,
                            'menu_title': m_title,
                            'menu_hours': '',
                            'category': cat_name,
                            'item_name': item_name,
                            'price_sgd': price_sgd,
                            'discounted_price_sgd': None,
                            'price_from': False,
                            'variation_prices_sgd': variation_prices,
                            'description': desc,
                            'image_url': img_url,
                            'sold_out': not prod.get('is_available', True),
                            'crawl_timestamp': now_ts
                        }
                        out_f.write(json.dumps(record, ensure_ascii=False) + '\n')
                        stall_items += 1
                        items_total += 1
                        
            out_f.flush()
            verified += 1
            if idx % 10 == 0 or idx == len(stalls):
                print(f"[{idx}/{len(stalls)}] Attempted: {attempted}, Verified: {verified}, Items: {items_total}, Rejected: {rejected}, Skipped: {skipped_or_blocked}")
            
            time.sleep(1.2)
            
    finally:
        out_f.close()
        rev_f.close()
        
    print("\n--- Batch Run Completed ---")
    print(f"Attempted: {attempted}")
    print(f"Verified stalls: {verified}")
    print(f"Menu items written: {items_total}")
    print(f"Rejected by Identity Gate: {rejected}")
    print(f"Skipped / Inactive: {skipped_or_blocked}")

if __name__ == '__main__':
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    crawl_loop(limit)
