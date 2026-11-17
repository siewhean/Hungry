#!/usr/bin/env python3
"""
scripts/firecrawl_pass22_high_concurrency_crawler.py

High-Throughput Parallel Firecrawl Crawler for Singapore Chain & Hawker Menus.
Saturates local Firecrawl instance (12 CPUs / 7.57GB RAM) with 35 concurrent Playwright contexts.
Uses concurrent.futures.ThreadPoolExecutor with standard urllib.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

FIRECRAWL_URL = "http://localhost:3002/v1/scrape"
OUTPUT_DIR = "data/crawls/pass22_firecrawl_scrapes"
CONCURRENCY = 35

URLS = [
    # Chain Outlets & Menus
    {"id": "bk_menu", "url": "https://www.burgerking.com.sg/Menu", "chain": "Burger King"},
    {"id": "bk_locator", "url": "https://www.burgerking.com.sg/Locator", "chain": "Burger King"},
    {"id": "kfc_menu", "url": "https://www.kfc.com.sg/menu", "chain": "KFC"},
    {"id": "kfc_location", "url": "https://www.kfc.com.sg/location", "chain": "KFC"},
    {"id": "subway_menu", "url": "https://subway.com.sg/menu/", "chain": "Subway"},
    {"id": "subway_find", "url": "https://subway.com.sg/find-a-subway/", "chain": "Subway"},
    {"id": "yakun_menu", "url": "https://yakun.com/menu/", "chain": "Ya Kun Kaya Toast"},
    {"id": "yakun_outlets", "url": "https://yakun.com/find-us/", "chain": "Ya Kun Kaya Toast"},
    {"id": "toastbox_menu", "url": "https://toastbox.com.sg/menu.html", "chain": "Toast Box"},
    {"id": "toastbox_outlets", "url": "https://toastbox.com.sg/locations.html", "chain": "Toast Box"},
    {"id": "starbucks_menu", "url": "https://www.starbucks.com.sg/menu", "chain": "Starbucks"},
    {"id": "starbucks_locator", "url": "https://www.starbucks.com.sg/store-locator", "chain": "Starbucks"},
    {"id": "oldchangkee_menu", "url": "https://www.oldchangkee.com/menu.html", "chain": "Old Chang Kee"},
    {"id": "pizzahut_menu", "url": "https://www.pizzahut.com.sg/menu/pizzas", "chain": "Pizza Hut"},
    {"id": "breadtalk_products", "url": "https://www.breadtalk.com.sg/products/", "chain": "BreadTalk"},
    {"id": "jollibee_menu", "url": "https://www.jollibee.com.sg/menu", "chain": "Jollibee"},
    {"id": "crave_menu", "url": "https://cravenasilemak.com/menu/", "chain": "Crave Nasi Lemak"},
    {"id": "mosburger_menu", "url": "https://www.mosburger.com.sg/menu.php", "chain": "MOS Burger"},
    {"id": "astons_menu", "url": "https://www.astons.com.sg/menu/specialities/", "chain": "Astons"},
    {"id": "sweechoon_menu", "url": "https://www.sweechoon.com/menu/", "chain": "Swee Choon"},
    {"id": "dintaifung_menu", "url": "https://dintaifung.com.sg/menu/", "chain": "Din Tai Fung"},

    # Hawker Centre Guides & Dishes (SethLui, DanielFoodDiary, Eatbook, MissTamChiak)
    {"id": "sethlui_amoy", "url": "https://sethlui.com/amoy-street-food-centre-guide-singapore/", "centre": "AMOY"},
    {"id": "sethlui_maxwell", "url": "https://sethlui.com/maxwell-food-centre-guide-singapore/", "centre": "MAXWELL"},
    {"id": "sethlui_chinatown", "url": "https://sethlui.com/chinatown-complex-food-centre-guide-singapore/", "centre": "CHINATOWN_COMPLEX"},
    {"id": "sethlui_oldairport", "url": "https://sethlui.com/old-airport-road-food-centre-guide-singapore/", "centre": "OLD_AIRPORT_ROAD"},
    {"id": "sethlui_honglim", "url": "https://sethlui.com/hong-lim-market-food-centre-guide-singapore/", "centre": "HONG_LIM"},
    {"id": "sethlui_goldenmile", "url": "https://sethlui.com/golden-mile-food-centre-guide-singapore/", "centre": "GOLDEN_MILE"},
    {"id": "sethlui_tiongbahru", "url": "https://sethlui.com/tiong-bahru-market-food-centre-guide-singapore/", "centre": "TIONG_BAHRU"},
    {"id": "sethlui_newton", "url": "https://sethlui.com/newton-food-centre-guide-singapore/", "centre": "NEWTON"},
    {"id": "sethlui_adamroad", "url": "https://sethlui.com/adam-road-food-centre-guide-singapore/", "centre": "ADAM_ROAD"},

    {"id": "dfd_amoy", "url": "https://danielfooddiary.com/2023/06/15/amoystreetfoodcentre/", "centre": "AMOY"},
    {"id": "dfd_maxwell", "url": "https://danielfooddiary.com/2023/08/20/maxwellfoodcentre/", "centre": "MAXWELL"},
    {"id": "dfd_chinatown", "url": "https://danielfooddiary.com/2023/07/28/chinatowncomplex/", "centre": "CHINATOWN_COMPLEX"},
    {"id": "dfd_oldairport", "url": "https://danielfooddiary.com/2023/05/20/oldairportroadfoodcentre/", "centre": "OLD_AIRPORT_ROAD"},
    {"id": "dfd_honglim", "url": "https://danielfooddiary.com/2023/04/10/honglimfoodcentre/", "centre": "HONG_LIM"},
    {"id": "dfd_goldenmile", "url": "https://danielfooddiary.com/2023/06/02/goldenmilefoodcentre/", "centre": "GOLDEN_MILE"},
    {"id": "dfd_tiongbahru", "url": "https://danielfooddiary.com/2023/07/11/tiongbahrufoodcentre/", "centre": "TIONG_BAHRU"},
    {"id": "dfd_newton", "url": "https://danielfooddiary.com/2023/09/01/newtonfoodcentre/", "centre": "NEWTON"},
    {"id": "dfd_adamroad", "url": "https://danielfooddiary.com/2023/05/01/adamroadfoodcentre/", "centre": "ADAM_ROAD"},

    {"id": "eatbook_amoy", "url": "https://eatbook.sg/amoy-street-food-centre/", "centre": "AMOY"},
    {"id": "eatbook_maxwell", "url": "https://eatbook.sg/maxwell-food-centre/", "centre": "MAXWELL"},
    {"id": "eatbook_chinatown", "url": "https://eatbook.sg/chinatown-complex-food-centre/", "centre": "CHINATOWN_COMPLEX"},
    {"id": "eatbook_oldairport", "url": "https://eatbook.sg/old-airport-road-food-centre/", "centre": "OLD_AIRPORT_ROAD"},
    {"id": "eatbook_honglim", "url": "https://eatbook.sg/hong-lim-food-centre/", "centre": "HONG_LIM"},
    {"id": "eatbook_goldenmile", "url": "https://eatbook.sg/golden-mile-food-centre/", "centre": "GOLDEN_MILE"},
    {"id": "eatbook_tiongbahru", "url": "https://eatbook.sg/tiong-bahru-market/", "centre": "TIONG_BAHRU"},
    {"id": "eatbook_newton", "url": "https://eatbook.sg/newton-food-centre/", "centre": "NEWTON"},
    {"id": "eatbook_adamroad", "url": "https://eatbook.sg/adam-road-food-centre/", "centre": "ADAM_ROAD"},
]

def scrape_target(target):
    item_id = target["id"]
    url = target["url"]
    out_file = os.path.join(OUTPUT_DIR, f"{item_id}.json")
    
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        print(f"[{item_id}] Cached on disk.")
        return True

    payload = json.dumps({
        "url": url,
        "formats": ["markdown"],
        "waitFor": 2000,
        "timeout": 45000
    }).encode("utf-8")
    
    req = urllib.request.Request(
        FIRECRAWL_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"[{item_id}] Dispatching scrape to Firecrawl -> {url}")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            elapsed = time.time() - t0
            res_json = json.loads(resp.read().decode("utf-8"))
            if res_json.get("success"):
                data = res_json.get("data", {})
                md = data.get("markdown", "")
                print(f"[{item_id}] SUCCESS in {elapsed:.1f}s | Markdown length: {len(md):,}")
                with open(out_file, "w") as f:
                    json.dump({
                        "id": item_id,
                        "url": url,
                        "target": target,
                        "markdown": md,
                        "metadata": data.get("metadata", {})
                    }, f, indent=2)
                return True
            else:
                print(f"[{item_id}] FAILED: {res_json.get('error')}")
    except Exception as e:
        print(f"[{item_id}] ERROR: {e}")
    return False

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"=== Starting High-Concurrency Firecrawl Scraper ===")
    print(f"Target count: {len(URLS)} URLs | Concurrency Pool: {CONCURRENCY}")
    
    t_start = time.time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = {executor.submit(scrape_target, target): target for target in URLS}
        success_count = 0
        for future in as_completed(futures):
            target = futures[future]
            try:
                if future.result():
                    success_count += 1
            except Exception as e:
                print(f"[{target['id']}] Exception: {e}")
                
    total_time = time.time() - t_start
    print(f"\n=== Scrape Complete in {total_time:.1f}s ===")
    print(f"Total targets: {len(URLS)} | Succeeded: {success_count} | Failed: {len(URLS) - success_count}")

if __name__ == "__main__":
    main()
