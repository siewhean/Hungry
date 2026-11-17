#!/usr/bin/env python3
"""
scripts/firecrawl_pass23_massive_expansion.py

Massive Parallel Firecrawl Scraper for Singapore Food Directory & Menus.
Saturates local Firecrawl instance (12 CPUs / 7.57GB RAM) with 45 concurrent workers.
Scrapes hawker centres, food courts, and fast-casual / bakery / beverage chain brands across Singapore.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

FIRECRAWL_URL = "http://localhost:3002/v1/scrape"
OUTPUT_DIR = "data/crawls/pass23_firecrawl_scrapes"
CONCURRENCY = 45

# 120+ High-Priority Food Portal & Official Chain URLs
TARGETS = [
    # --- Major Fast Casual & Specialty Food Chains ---
    {"id": "bk_menu", "url": "https://www.burgerking.com.sg/Menu", "group": "chain"},
    {"id": "kfc_menu", "url": "https://www.kfc.com.sg/menu", "group": "chain"},
    {"id": "subway_menu", "url": "https://subway.com.sg/menu/", "group": "chain"},
    {"id": "yakun_menu", "url": "https://yakun.com/menu/", "group": "chain"},
    {"id": "toastbox_menu", "url": "https://toastbox.com.sg/menu.html", "group": "chain"},
    {"id": "starbucks_menu", "url": "https://www.starbucks.com.sg/menu", "group": "chain"},
    {"id": "oldchangkee_menu", "url": "https://www.oldchangkee.com/menu.html", "group": "chain"},
    {"id": "pizzahut_menu", "url": "https://www.pizzahut.com.sg/menu/pizzas", "group": "chain"},
    {"id": "breadtalk_products", "url": "https://www.breadtalk.com.sg/products/", "group": "chain"},
    {"id": "jollibee_menu", "url": "https://www.jollibee.com.sg/menu", "group": "chain"},
    {"id": "crave_menu", "url": "https://cravenasilemak.com/menu/", "group": "chain"},
    {"id": "mosburger_menu", "url": "https://www.mosburger.com.sg/menu.php", "group": "chain"},
    {"id": "astons_menu", "url": "https://www.astons.com.sg/menu/specialities/", "group": "chain"},
    {"id": "sweechoon_menu", "url": "https://www.sweechoon.com/menu/", "group": "chain"},
    {"id": "dintaifung_menu", "url": "https://dintaifung.com.sg/menu/", "group": "chain"},
    {"id": "enciktan_menu", "url": "https://enciktan.com.sg/menu/", "group": "chain"},
    {"id": "tenderfresh_menu", "url": "https://www.tenderfresh.com.sg/menu", "group": "chain"},
    {"id": "pastamania_menu", "url": "https://www.pastamania.com.sg/menu", "group": "chain"},
    {"id": "saizeriya_menu", "url": "https://www.saizeriya.com.sg/menu/", "group": "chain"},
    {"id": "pepperlunch_menu", "url": "https://www.pepperlunch.com.sg/menu/", "group": "chain"},
    {"id": "genkisushi_menu", "url": "https://www.genkisushi.com.sg/menu/", "group": "chain"},
    {"id": "sushitei_menu", "url": "https://sushitei.com/menu/", "group": "chain"},
    {"id": "songfa_menu", "url": "https://songfa.com.sg/pages/menu", "group": "chain"},
    {"id": "boontongkee_menu", "url": "https://boontongkee.com.sg/menu/", "group": "chain"},

    # --- Bubble Tea, Beverage & Bakery Chains ---
    {"id": "liho_menu", "url": "https://www.liho.com.sg/menu", "group": "beverage"},
    {"id": "koithe_menu", "url": "https://www.koithe.com/en/global/koi-singapore/menu", "group": "beverage"},
    {"id": "gongcha_menu", "url": "https://www.gongcha.com.sg/menu/", "group": "beverage"},
    {"id": "playmade_menu", "url": "https://www.playmade.com/menu", "group": "beverage"},
    {"id": "eachacup_menu", "url": "https://www.each-a-cup.com/menu", "group": "beverage"},
    {"id": "polarpuffs_menu", "url": "https://polarpuffs-cakes.com/menu/", "group": "bakery"},
    {"id": "fourleaves_products", "url": "https://fourleaves.com.sg/products/", "group": "bakery"},

    # --- Food Court Operators & Stalls ---
    {"id": "koufu_locations", "url": "https://www.koufu.com.sg/our-businesses/cookhouse-by-koufu/", "group": "foodcourt"},
    {"id": "foodrepublic_outlets", "url": "https://foodrepublic.com.sg/find-a-food-republic/", "group": "foodcourt"},
    {"id": "kopitiam_about", "url": "https://www.fairprice.com.sg/kopitiam/", "group": "foodcourt"},

    # --- SethLui Iconic Hawker Centre Guides ---
    {"id": "sl_chinatown", "url": "https://sethlui.com/chinatown-complex-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_maxwell", "url": "https://sethlui.com/maxwell-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_amoy", "url": "https://sethlui.com/amoy-street-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_oldairport", "url": "https://sethlui.com/old-airport-road-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_honglim", "url": "https://sethlui.com/hong-lim-market-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_goldenmile", "url": "https://sethlui.com/golden-mile-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_tiongbahru", "url": "https://sethlui.com/tiong-bahru-market-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_newton", "url": "https://sethlui.com/newton-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_adamroad", "url": "https://sethlui.com/adam-road-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_bedok85", "url": "https://sethlui.com/85-fengshan-centre-food-guide-singapore/", "group": "hawker"},
    {"id": "sl_changivillage", "url": "https://sethlui.com/changi-village-hawker-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_whampoa", "url": "https://sethlui.com/whampoa-market-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_tekka", "url": "https://sethlui.com/tekka-centre-food-guide-singapore/", "group": "hawker"},
    {"id": "sl_ghimmoh", "url": "https://sethlui.com/ghim-moh-market-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_abcbrickworks", "url": "https://sethlui.com/abc-brickworks-market-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_pasirpanjang", "url": "https://sethlui.com/pasir-panjang-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_alexandra", "url": "https://sethlui.com/alexandra-village-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_marineparade", "url": "https://sethlui.com/marine-parade-central-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_zionriverside", "url": "https://sethlui.com/zion-riverside-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_eastcoast", "url": "https://sethlui.com/east-coast-lagoon-food-village-guide-singapore/", "group": "hawker"},
    {"id": "sl_bukittimah", "url": "https://sethlui.com/bukit-timah-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_chompchomp", "url": "https://sethlui.com/chomp-chomp-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_yuhua", "url": "https://sethlui.com/yuhua-market-hawker-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_jurongwest505", "url": "https://sethlui.com/jurong-west-505-market-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_tamanjurong", "url": "https://sethlui.com/taman-jurong-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_marsiling", "url": "https://sethlui.com/marsiling-lane-food-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_senja", "url": "https://sethlui.com/senja-hawker-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_bukitcanberra", "url": "https://sethlui.com/bukit-canberra-hawker-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_fernvale", "url": "https://sethlui.com/fernvale-hawker-centre-guide-singapore/", "group": "hawker"},
    {"id": "sl_onepunggol", "url": "https://sethlui.com/one-punggol-hawker-centre-guide-singapore/", "group": "hawker"},

    # --- DanielFoodDiary Comprehensive Hawker Guides ---
    {"id": "dfd_chinatown", "url": "https://danielfooddiary.com/2023/07/28/chinatowncomplex/", "group": "hawker"},
    {"id": "dfd_maxwell", "url": "https://danielfooddiary.com/2023/08/20/maxwellfoodcentre/", "group": "hawker"},
    {"id": "dfd_amoy", "url": "https://danielfooddiary.com/2023/06/15/amoystreetfoodcentre/", "group": "hawker"},
    {"id": "dfd_oldairport", "url": "https://danielfooddiary.com/2023/05/20/oldairportroadfoodcentre/", "group": "hawker"},
    {"id": "dfd_honglim", "url": "https://danielfooddiary.com/2023/04/10/honglimfoodcentre/", "group": "hawker"},
    {"id": "dfd_goldenmile", "url": "https://danielfooddiary.com/2023/06/02/goldenmilefoodcentre/", "group": "hawker"},
    {"id": "dfd_tiongbahru", "url": "https://danielfooddiary.com/2023/07/11/tiongbahrufoodcentre/", "group": "hawker"},
    {"id": "dfd_newton", "url": "https://danielfooddiary.com/2023/09/01/newtonfoodcentre/", "group": "hawker"},
    {"id": "dfd_adamroad", "url": "https://danielfooddiary.com/2023/05/01/adamroadfoodcentre/", "group": "hawker"},
    {"id": "dfd_bedok85", "url": "https://danielfooddiary.com/2022/08/11/bedok85/", "group": "hawker"},
    {"id": "dfd_changivillage", "url": "https://danielfooddiary.com/2022/03/10/changivillage/", "group": "hawker"},
    {"id": "dfd_whampoa", "url": "https://danielfooddiary.com/2023/02/10/whampoamarket/", "group": "hawker"},
    {"id": "dfd_tekka", "url": "https://danielfooddiary.com/2022/10/15/tekkacentre/", "group": "hawker"},
    {"id": "dfd_ghimmoh", "url": "https://danielfooddiary.com/2023/01/05/ghimmohfoodcentre/", "group": "hawker"},
    {"id": "dfd_abcbrickworks", "url": "https://danielfooddiary.com/2022/12/01/abcbrickworks/", "group": "hawker"},
    {"id": "dfd_alexandra", "url": "https://danielfooddiary.com/2023/03/15/alexandravillage/", "group": "hawker"},
    {"id": "dfd_zionriverside", "url": "https://danielfooddiary.com/2023/05/05/zionriverside/", "group": "hawker"},
    {"id": "dfd_eastcoast", "url": "https://danielfooddiary.com/2023/08/01/eastcoastlagoon/", "group": "hawker"},
    {"id": "dfd_chompchomp", "url": "https://danielfooddiary.com/2023/06/25/chompchomp/", "group": "hawker"},

    # --- Eatbook.sg Authentic Hawker Food Guides ---
    {"id": "eb_chinatown", "url": "https://eatbook.sg/chinatown-complex-food-centre/", "group": "hawker"},
    {"id": "eb_maxwell", "url": "https://eatbook.sg/maxwell-food-centre/", "group": "hawker"},
    {"id": "eb_amoy", "url": "https://eatbook.sg/amoy-street-food-centre/", "group": "hawker"},
    {"id": "eb_oldairport", "url": "https://eatbook.sg/old-airport-road-food-centre/", "group": "hawker"},
    {"id": "eb_honglim", "url": "https://eatbook.sg/hong-lim-food-centre/", "group": "hawker"},
    {"id": "eb_goldenmile", "url": "https://eatbook.sg/golden-mile-food-centre/", "group": "hawker"},
    {"id": "eb_tiongbahru", "url": "https://eatbook.sg/tiong-bahru-market/", "group": "hawker"},
    {"id": "eb_newton", "url": "https://eatbook.sg/newton-food-centre/", "group": "hawker"},
    {"id": "eb_adamroad", "url": "https://eatbook.sg/adam-road-food-centre/", "group": "hawker"},
    {"id": "eb_bedok85", "url": "https://eatbook.sg/bedok-85-market/", "group": "hawker"},
    {"id": "eb_changivillage", "url": "https://eatbook.sg/changi-village-food-centre/", "group": "hawker"},
    {"id": "eb_whampoa", "url": "https://eatbook.sg/whampoa-market/", "group": "hawker"},
    {"id": "eb_tekka", "url": "https://eatbook.sg/tekka-centre-food/", "group": "hawker"},
    {"id": "eb_ghimmoh", "url": "https://eatbook.sg/ghim-moh-market/", "group": "hawker"},
    {"id": "eb_abcbrickworks", "url": "https://eatbook.sg/abc-brickworks/", "group": "hawker"},
    {"id": "eb_pasirpanjang", "url": "https://eatbook.sg/pasir-panjang-food-centre/", "group": "hawker"},
    {"id": "eb_alexandra", "url": "https://eatbook.sg/alexandra-village-food-centre/", "group": "hawker"},
    {"id": "eb_marineparade", "url": "https://eatbook.sg/marine-parade-food-centre/", "group": "hawker"},
    {"id": "eb_zionriverside", "url": "https://eatbook.sg/zion-riverside-food-centre/", "group": "hawker"},
    {"id": "eb_eastcoast", "url": "https://eatbook.sg/east-coast-lagoon-food-village/", "group": "hawker"},
    {"id": "eb_bukittimah", "url": "https://eatbook.sg/bukit-timah-market/", "group": "hawker"},
    {"id": "eb_chompchomp", "url": "https://eatbook.sg/chomp-chomp-food-centre/", "group": "hawker"},
    {"id": "eb_yuhua", "url": "https://eatbook.sg/yuhua-village-market-and-food-centre/", "group": "hawker"},
    {"id": "eb_jurongwest505", "url": "https://eatbook.sg/jurong-west-505-food/", "group": "hawker"},
    {"id": "eb_tamanjurong", "url": "https://eatbook.sg/taman-jurong-food-centre/", "group": "hawker"},
    {"id": "eb_marsiling", "url": "https://eatbook.sg/marsiling-lane-food-centre/", "group": "hawker"},
    {"id": "eb_senja", "url": "https://eatbook.sg/senja-hawker-centre/", "group": "hawker"},
    {"id": "eb_bukitcanberra", "url": "https://eatbook.sg/bukit-canberra-hawker-centre/", "group": "hawker"},
    {"id": "eb_fernvale", "url": "https://eatbook.sg/fernvale-hawker-centre/", "group": "hawker"},
    {"id": "eb_onepunggol", "url": "https://eatbook.sg/one-punggol-hawker-centre/", "group": "hawker"}
]

def scrape_target(target):
    item_id = target["id"]
    url = target["url"]
    out_file = os.path.join(OUTPUT_DIR, f"{item_id}.json")
    
    # Cache check
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        return item_id, True, "Cached on disk"

    payload = json.dumps({
        "url": url,
        "formats": ["markdown"],
        "waitFor": 1500,
        "timeout": 45000
    }).encode("utf-8")
    
    req = urllib.request.Request(
        FIRECRAWL_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=50) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elapsed = time.time() - t0
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            content_len = len(data.get("data", {}).get("markdown", ""))
            return item_id, True, f"Success ({elapsed:.1f}s, {content_len:,} chars)"
    except Exception as e:
        elapsed = time.time() - t0
        return item_id, False, f"Failed ({elapsed:.1f}s): {str(e)[:120]}"

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total = len(TARGETS)
    print(f"============================================================")
    print(f"Pass 23 Massive Parallel Firecrawl Crawler")
    print(f"Target count: {total} Singapore food URLs")
    print(f"Concurrency: {CONCURRENCY} parallel worker threads")
    print(f"Firecrawl endpoint: {FIRECRAWL_URL}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"============================================================")
    
    start_time = time.time()
    success_count = 0
    fail_count = 0
    
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        future_map = {executor.submit(scrape_target, t): t for t in TARGETS}
        for future in as_completed(future_map):
            t = future_map[future]
            item_id, ok, msg = future.result()
            if ok:
                success_count += 1
                status_str = "OK"
            else:
                fail_count += 1
                status_str = "ERR"
            print(f"[{status_str}] {item_id:20s} -> {msg}")
            
    total_time = time.time() - start_time
    print(f"\n============================================================")
    print(f"Pass 23 Crawl Complete in {total_time:.1f}s")
    print(f"Total Scraped: {total} | Success: {success_count} | Failed: {fail_count}")
    print(f"============================================================")

if __name__ == "__main__":
    main()
