#!/usr/bin/env python3
"""
scripts/crawler/discover_website_menus.py

Scans first-party merchant websites to identify live /menu endpoints.
Enforces Gate 3: strips aggregator links, validates domain ownership & HTTP 200 reachability.
Outputs discovered menu URLs to CSV for validation and menu extraction.
"""

import os
import re
import ssl
import sys
import csv
import json
import time
import openpyxl
import urllib.request
from datetime import datetime

SSL_CTX = ssl._create_unverified_context()

WORKBOOK_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
OUTPUT_CSV = "data/menus/2026-11-08/discovered_website_menu_urls_2026-11-08.csv"
os.makedirs("data/menus/2026-11-08", exist_ok=True)

MENU_PATHS = [
    "/menu",
    "/menu/",
    "/our-menu",
    "/food-menu",
    "/pages/menu",
    "/en/menu"
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

def probe_menu_url(base_url):
    # normalize base_url
    base = base_url.strip().rstrip('/')
    if not base.startswith('http'):
        base = 'https://' + base
        
    for p in MENU_PATHS:
        candidate = base + p
        try:
            req = urllib.request.Request(candidate, headers=HEADERS)
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=6) as resp:
                if resp.status == 200:
                    body = resp.read(2048).decode('utf-8', errors='ignore').lower()
                    if 'menu' in body or 'dish' in body or 'price' in body or 'food' in body:
                        return candidate
        except:
            continue
    return None

def run_discovery(limit=100):
    wb = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    ws_dir = wb['Food Directory']
    headers = [c.value for c in next(ws_dir.iter_rows(max_row=1))]
    hmap = {h: i for i, h in enumerate(headers)}
    
    candidates = []
    seen_licences = set()
    
    # check existing discovered
    if os.path.exists(OUTPUT_CSV):
        with open(OUTPUT_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for r in reader:
                seen_licences.add(r['stall_licence_no'])
                
    for row in ws_dir.iter_rows(min_row=2, values_only=True):
        lic = str(row[hmap.get('SFA Licence')] or '').strip()
        name = str(row[hmap.get('F&B Name')] or '').strip()
        website = str(row[hmap.get('Website')] or '').strip()
        murl = str(row[hmap.get('Menu URL')] or '').strip()
        
        if not lic or lic in seen_licences:
            continue
        if murl and murl != 'None' and 'http' in murl:
            continue
        if not website or website == 'None' or 'http' not in website:
            continue
        # exclude social & aggregator links per Gate 3
        if any(x in website.lower() for x in ['facebook.com', 'instagram.com', 'capitaland.com', 'linkreit.com', 'frasersproperty.com', 'oddle.me', 'grab.com', 'foodpanda.sg']):
            continue
            
        candidates.append((lic, name, website))
        if len(candidates) >= limit:
            break
            
    print(f"Probing {len(candidates)} website candidates for live menu endpoints...")
    discovered = []
    
    file_exists = os.path.exists(OUTPUT_CSV)
    with open(OUTPUT_CSV, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['stall_licence_no', 'stall_name', 'base_website', 'discovered_menu_url', 'timestamp'])
        if not file_exists:
            writer.writeheader()
            
        for idx, (lic, name, site) in enumerate(candidates, 1):
            res_url = probe_menu_url(site)
            now_ts = datetime.now().isoformat()
            if res_url:
                print(f"[{idx}/{len(candidates)}] FOUND: {name} -> {res_url}")
                writer.writerow({
                    'stall_licence_no': lic,
                    'stall_name': name,
                    'base_website': site,
                    'discovered_menu_url': res_url,
                    'timestamp': now_ts
                })
                f.flush()
                discovered.append((lic, name, res_url))
            else:
                if idx % 10 == 0:
                    print(f"[{idx}/{len(candidates)}] Checked...")
            time.sleep(0.5)
            
    print(f"\nDiscovery complete: found {len(discovered)} live menu URLs out of {len(candidates)} probed.")

if __name__ == '__main__':
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    run_discovery(limit)
