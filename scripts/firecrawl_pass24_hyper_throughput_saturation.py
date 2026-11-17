#!/usr/bin/env python3
"""
scripts/firecrawl_pass24_hyper_throughput_saturation.py

Hyper-throughput crawling script designed to fully saturate the 12 available CPUs
and 7.57GB RAM of the self-hosted local Firecrawl instance at http://localhost:3002.

Crawls ~250 high-priority Singapore F&B targets:
1. Major Hawker Centres (DanielFoodDiary, SethLui, Eatbook, MissTamChiak)
2. Iconic Hawker Stall Menu Reviews with Counter Prices
3. All Major Chain Websites (Ya Kun, Toast Box, Subway, KFC, Burger King, MOS, Jollibee, Saizeriya, etc.)
4. Food Court Tenant Catalogs (Food Republic, Koufu, Malaysia Boleh)
5. Open-Source Menu Catalogs (AllSGPromo, SingPromos)

Runs 60 concurrent thread workers against http://localhost:3002/v1/scrape using Python standard library.
Saves markdown output to data/crawls/pass24_firecrawl_scrapes/.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

FIRECRAWL_URL = "http://localhost:3002/v1/scrape"
OUTPUT_DIR = "data/crawls/pass24_firecrawl_scrapes"
CONCURRENCY = 60  # Fully load 12 CPUs
REQUEST_TIMEOUT = 45

# 1. Hawker Centres: DanielFoodDiary Guides
DFD_HAWKER_URLS = [
    ("dfd_maxwell", "https://danielfooddiary.com/2023/07/04/maxwellfoodcentre/"),
    ("dfd_amoy", "https://danielfooddiary.com/2023/06/15/amoystreetfoodcentre/"),
    ("dfd_chinatown_complex", "https://danielfooddiary.com/2023/06/20/chinatowncomplex/"),
    ("dfd_old_airport_road", "https://danielfooddiary.com/2023/06/22/oldairportroadfoodcentre/"),
    ("dfd_hong_lim", "https://danielfooddiary.com/2023/06/27/honglimfoodcentre/"),
    ("dfd_tiong_bahru", "https://danielfooddiary.com/2023/06/29/tiongbahrufoodcentre/"),
    ("dfd_golden_mile", "https://danielfooddiary.com/2023/07/06/goldenmilefoodcentre/"),
    ("dfd_tekka_centre", "https://danielfooddiary.com/2023/07/11/tekkacentre/"),
    ("dfd_bedok_85", "https://danielfooddiary.com/2023/07/13/bedok85/"),
    ("dfd_changi_village", "https://danielfooddiary.com/2023/07/18/changivillagefoodcentre/"),
    ("dfd_adam_road", "https://danielfooddiary.com/2023/07/20/adamroadfoodcentre/"),
    ("dfd_whampoa", "https://danielfooddiary.com/2023/07/25/whampoamarket/"),
    ("dfd_ghim_moh", "https://danielfooddiary.com/2023/07/27/ghimmohfoodcentre/"),
    ("dfd_zion_riverside", "https://danielfooddiary.com/2023/08/01/zionriversidefoodcentre/"),
    ("dfd_newton", "https://danielfooddiary.com/2023/08/03/newtonfoodcentre/"),
    ("dfd_alexandra_village", "https://danielfooddiary.com/2023/08/08/alexandravillagefoodcentre/"),
    ("dfd_abc_brickworks", "https://danielfooddiary.com/2023/08/10/abcbrickworks/"),
    ("dfd_clementi_448", "https://danielfooddiary.com/2023/08/15/clementi448/"),
    ("dfd_jurong_west_505", "https://danielfooddiary.com/2023/08/17/jurongwest505/"),
    ("dfd_yuhua_market", "https://danielfooddiary.com/2023/08/22/yuhuamarket/"),
    ("dfd_bukit_timah", "https://danielfooddiary.com/2023/08/24/bukittimahfoodcentre/"),
    ("dfd_pek_kio", "https://danielfooddiary.com/2023/08/29/pekkiofoodcentre/"),
    ("dfd_berseh", "https://danielfooddiary.com/2023/08/31/bersehfoodcentre/"),
    ("dfd_pasir_panjang", "https://danielfooddiary.com/2023/09/05/pasirpanjangfoodcentre/"),
    ("dfd_dunman", "https://danielfooddiary.com/2023/09/07/dunmanfoodcentre/"),
    ("dfd_marine_parade", "https://danielfooddiary.com/2023/09/12/marineparadecentral/"),
    ("dfd_bedok_interchange", "https://danielfooddiary.com/2023/09/14/bedokinterchangehawkercentre/"),
    ("dfd_haig_road", "https://danielfooddiary.com/2023/09/19/haigroadfoodcentre/"),
    ("dfd_geylang_serai", "https://danielfooddiary.com/2023/09/21/geylangseraimarket/"),
    ("dfd_kovan_209", "https://danielfooddiary.com/2023/09/26/kovan209market/"),
    ("dfd_chomp_chomp", "https://danielfooddiary.com/2023/09/28/chompchomp/"),
    ("dfd_serangoon_garden", "https://danielfooddiary.com/2023/10/03/serangoongardenmarket/"),
    ("dfd_chong_pang", "https://danielfooddiary.com/2023/10/05/chongpangmarket/"),
    ("dfd_yishun_park", "https://danielfooddiary.com/2023/10/10/yishunparkhawkercentre/"),
    ("dfd_ci_yuan", "https://danielfooddiary.com/2023/10/12/ciyuanhawkercentre/"),
    ("dfd_bukit_canberra", "https://danielfooddiary.com/2023/10/17/bukitcanberrahawkercentre/"),
    ("dfd_one_punggol", "https://danielfooddiary.com/2023/10/19/onepunggolhawkercentre/"),
    ("dfd_fernvale", "https://danielfooddiary.com/2023/10/24/fernvalehawkercentre/"),
    ("dfd_senja", "https://danielfooddiary.com/2023/10/26/senjahawkercentre/"),
    ("dfd_margaret_drive", "https://danielfooddiary.com/2023/10/31/margaretdrivehawkercentre/"),
]

# 2. Hawker Centres: SethLui Guides
SETHLUI_HAWKER_URLS = [
    ("sethlui_maxwell", "https://sethlui.com/maxwell-food-centre-stalls-singapore/"),
    ("sethlui_amoy", "https://sethlui.com/amoy-street-food-centre-stalls-singapore/"),
    ("sethlui_chinatown_complex", "https://sethlui.com/chinatown-complex-food-centre-stalls-singapore/"),
    ("sethlui_old_airport_road", "https://sethlui.com/old-airport-road-food-centre-stalls-singapore/"),
    ("sethlui_tiong_bahru", "https://sethlui.com/tiong-bahru-market-stalls-singapore/"),
    ("sethlui_hong_lim", "https://sethlui.com/hong-lim-food-centre-stalls-singapore/"),
    ("sethlui_golden_mile", "https://sethlui.com/golden-mile-food-centre-stalls-singapore/"),
    ("sethlui_tekka", "https://sethlui.com/tekka-centre-food-stalls-singapore/"),
    ("sethlui_bedok_85", "https://sethlui.com/bedok-85-fengshan-market-stalls-singapore/"),
    ("sethlui_changi_village", "https://sethlui.com/changi-village-hawker-centre-stalls-singapore/"),
    ("sethlui_adam_road", "https://sethlui.com/adam-road-food-centre-stalls-singapore/"),
    ("sethlui_whampoa", "https://sethlui.com/whampoa-food-centre-stalls-singapore/"),
    ("sethlui_ghim_moh", "https://sethlui.com/ghim-moh-food-centre-stalls-singapore/"),
    ("sethlui_zion_riverside", "https://sethlui.com/zion-riverside-food-centre-stalls-singapore/"),
    ("sethlui_newton", "https://sethlui.com/newton-food-centre-stalls-singapore/"),
    ("sethlui_alexandra_village", "https://sethlui.com/alexandra-village-food-centre-stalls-singapore/"),
    ("sethlui_abc_brickworks", "https://sethlui.com/abc-brickworks-food-centre-stalls-singapore/"),
    ("sethlui_clementi_448", "https://sethlui.com/clementi-448-market-food-centre-stalls-singapore/"),
    ("sethlui_jurong_west_505", "https://sethlui.com/jurong-west-505-market-food-centre-singapore/"),
    ("sethlui_bukit_timah", "https://sethlui.com/bukit-timah-food-centre-stalls-singapore/"),
    ("sethlui_pekkio", "https://sethlui.com/pek-kio-market-food-centre-singapore/"),
    ("sethlui_berseh", "https://sethlui.com/berseh-food-centre-stalls-singapore/"),
    ("sethlui_pasir_panjang", "https://sethlui.com/pasir-panjang-food-centre-singapore/"),
    ("sethlui_dunman", "https://sethlui.com/dunman-food-centre-singapore/"),
    ("sethlui_marine_parade", "https://sethlui.com/marine-parade-central-market-food-centre-singapore/"),
    ("sethlui_haig_road", "https://sethlui.com/haig-road-market-food-centre-singapore/"),
    ("sethlui_geylang_serai", "https://sethlui.com/geylang-serai-market-food-centre-singapore/"),
    ("sethlui_kovan_209", "https://sethlui.com/kovan-209-market-food-centre-singapore/"),
    ("sethlui_chomp_chomp", "https://sethlui.com/chomp-chomp-food-centre-stalls-singapore/"),
    ("sethlui_serangoon_garden", "https://sethlui.com/serangoon-garden-market-food-centre-singapore/"),
]

# 3. Hawker Centres: Eatbook.sg Guides
EATBOOK_HAWKER_URLS = [
    ("eatbook_maxwell", "https://eatbook.sg/maxwell-food-centre/"),
    ("eatbook_amoy", "https://eatbook.sg/amoy-street-food-centre/"),
    ("eatbook_chinatown_complex", "https://eatbook.sg/chinatown-complex-food-centre/"),
    ("eatbook_old_airport_road", "https://eatbook.sg/old-airport-road-food-centre/"),
    ("eatbook_tiong_bahru", "https://eatbook.sg/tiong-bahru-market-food/"),
    ("eatbook_hong_lim", "https://eatbook.sg/hong-lim-market-food-centre/"),
    ("eatbook_golden_mile", "https://eatbook.sg/golden-mile-food-centre/"),
    ("eatbook_tekka", "https://eatbook.sg/tekka-centre-food/"),
    ("eatbook_bedok_85", "https://eatbook.sg/bedok-85-fengshan-food/"),
    ("eatbook_changi_village", "https://eatbook.sg/changi-village-hawker-centre/"),
    ("eatbook_adam_road", "https://eatbook.sg/adam-road-food-centre/"),
    ("eatbook_whampoa", "https://eatbook.sg/whampoa-market-food/"),
    ("eatbook_ghim_moh", "https://eatbook.sg/ghim-moh-food-centre/"),
    ("eatbook_zion_riverside", "https://eatbook.sg/zion-riverside-food-centre/"),
    ("eatbook_newton", "https://eatbook.sg/newton-food-centre/"),
    ("eatbook_alexandra_village", "https://eatbook.sg/alexandra-village-food-centre/"),
    ("eatbook_abc_brickworks", "https://eatbook.sg/abc-brickworks-food-centre/"),
    ("eatbook_clementi_448", "https://eatbook.sg/clementi-448-food-centre/"),
    ("eatbook_jurong_west_505", "https://eatbook.sg/jurong-west-505-food/"),
    ("eatbook_yuhua_market", "https://eatbook.sg/yuhua-market-hawker-centre/"),
    ("eatbook_bukit_timah", "https://eatbook.sg/bukit-timah-food-centre/"),
    ("eatbook_one_punggol", "https://eatbook.sg/one-punggol-hawker-centre/"),
    ("eatbook_senja", "https://eatbook.sg/senja-hawker-centre/"),
    ("eatbook_bukit_canberra", "https://eatbook.sg/bukit-canberra-hawker-centre/"),
    ("eatbook_fernvale", "https://eatbook.sg/fernvale-hawker-centre/"),
]

# 4. Hawker Centres: Miss Tam Chiak Guides
MTC_HAWKER_URLS = [
    ("mtc_maxwell", "https://www.misstamchiak.com/maxwell-food-centre/"),
    ("mtc_amoy", "https://www.misstamchiak.com/amoy-street-food-centre/"),
    ("mtc_chinatown_complex", "https://www.misstamchiak.com/chinatown-complex-food-centre/"),
    ("mtc_old_airport_road", "https://www.misstamchiak.com/old-airport-road-food-centre/"),
    ("mtc_tiong_bahru", "https://www.misstamchiak.com/tiong-bahru-market/"),
    ("mtc_hong_lim", "https://www.misstamchiak.com/hong-lim-food-centre/"),
    ("mtc_golden_mile", "https://www.misstamchiak.com/golden-mile-food-centre/"),
    ("mtc_tekka", "https://www.misstamchiak.com/tekka-centre/"),
    ("mtc_bedok_85", "https://www.misstamchiak.com/bedok-85-food-centre/"),
    ("mtc_adam_road", "https://www.misstamchiak.com/adam-road-food-centre/"),
    ("mtc_whampoa", "https://www.misstamchiak.com/whampoa-food-centre/"),
    ("mtc_ghim_moh", "https://www.misstamchiak.com/ghim-moh-food-centre/"),
    ("mtc_zion_riverside", "https://www.misstamchiak.com/zion-riverside-food-centre/"),
    ("mtc_newton", "https://www.misstamchiak.com/newton-food-centre/"),
    ("mtc_alexandra_village", "https://www.misstamchiak.com/alexandra-village-food-centre/"),
    ("mtc_abc_brickworks", "https://www.misstamchiak.com/abc-brickworks-food-centre/"),
    ("mtc_clementi_448", "https://www.misstamchiak.com/clementi-448-food-centre/"),
    ("mtc_bukit_timah", "https://www.misstamchiak.com/bukit-timah-food-centre/"),
]

# 5. Major F&B Chains Official Menus & Catalogs
CHAIN_OFFICIAL_URLS = [
    ("chain_yakun_menu", "https://yakun.com/menu/"),
    ("chain_toastbox_menu", "https://toastbox.com.sg/menu.html"),
    ("chain_breadtalk_menu", "https://www.breadtalk.com.sg/products/"),
    ("chain_oldchangkee_menu", "https://www.oldchangkee.com/menus.html"),
    ("chain_subway_menu", "https://subwayisfresh.com.sg/menu/"),
    ("chain_kfc_menu", "https://www.kfc.com.sg/menu"),
    ("chain_bk_menu", "https://www.burgerking.com.sg/Menu"),
    ("chain_mos_menu", "https://www.mosburger.com.sg/menu.php"),
    ("chain_jollibee_menu", "https://www.jollibee.com.sg/menu"),
    ("chain_pizzahut_menu", "https://www.pizzahut.com.sg/menu/pizzas"),
    ("chain_dtf_menu", "https://dintaifung.com.sg/menu/"),
    ("chain_pepperlunch_menu", "https://www.pepperlunch.com.sg/menu/"),
    ("chain_genkisushi_menu", "https://www.genkisushi.com.sg/menu"),
    ("chain_sweechoon_menu", "https://www.sweechoon.com/menu"),
    ("chain_boontongkee_menu", "https://boontongkee.com.sg/menu/"),
    ("chain_astons_menu", "https://www.astons.com.sg/specialities/menu/"),
    ("chain_crave_menu", "https://crave.com.sg/menu/"),
    ("chain_starbucks_menu", "https://www.starbucks.com.sg/menu"),
    ("chain_liho_menu", "https://liho.sg/menu/"),
    ("chain_koi_menu", "https://www.koithe.com/en/global/koi-singapore/drinks"),
    ("chain_saizeriya_menu", "https://www.saizeriya.com.sg/menu/"),
    ("chain_twomenbagel_menu", "https://www.twomenbagels.com/menu"),
    ("chain_toriq_menu", "https://www.tori-q.com/menu"),
    ("chain_stuffd_menu", "https://www.stuffd.com/sg/menu"),
    ("chain_enciktan_menu", "https://enciktan.com.sg/menu/"),
    ("chain_namnam_menu", "https://namnam.net/menu/"),
    ("chain_songfa_menu", "https://songfa.com.sg/pages/menu"),
    ("chain_timhowan_menu", "https://www.timhowan.com/our-menu/"),
    ("chain_sanook_menu", "https://sanookkitchen.com.sg/menu/"),
    ("chain_paradise_menu", "https://www.paradisegp.net/brand-menu.php?id=1"),
    ("chain_crystaljade_menu", "https://www.crystaljade.com/hongkongkitchen/menu/"),
    ("chain_dianxiaoer_menu", "https://www.dianxiaoer.com.sg/menu/"),
    ("chain_souprestaurant_menu", "https://www.souprestaurant.com.sg/menu/"),
    ("chain_putien_menu", "https://www.putien.com/menu/"),
    ("chain_sushiro_menu", "https://www.sushiro.co.jp/en/singapore/menu/"),
    ("chain_sushiexpress_menu", "https://www.sushiexpress.com.sg/menu"),
    ("chain_ichibanboshi_menu", "https://www.ichibanboshi.com.sg/menu/"),
    ("chain_ajisen_menu", "https://ajisen.com.sg/menu/"),
    ("chain_ippudo_menu", "https://www.ippudo.com.sg/menu/"),
    ("chain_collins_menu", "https://www.collins.sg/menu"),
    ("chain_swensens_menu", "https://www.swensens.com.sg/menu"),
    ("chain_pastamania_menu", "https://www.pastamania.com.sg/menu"),
    ("chain_mrbean_menu", "https://www.mrbean.com.sg/products"),
    ("chain_polarpuffs_menu", "https://polarpuffs-cakes.com/menu"),
    ("chain_cedele_menu", "https://cedele.com/pages/menu"),
    ("chain_parisbaguette_menu", "https://parisbaguette.com.sg/menu/"),
    ("chain_gongcha_menu", "https://www.gongcha.com.sg/menu/"),
    ("chain_playmade_menu", "https://www.playmade.com/menu"),
    ("chain_thealley_menu", "https://thealleysingapore.com/menu/"),
    ("chain_chicha_menu", "https://chichasanchen.com.sg/menu/"),
    ("chain_heytea_menu", "https://www.heytea.com/sg/menu"),
    ("chain_boostjuice_menu", "https://www.boostjuicebars.com.sg/menu/"),
    ("chain_tuktukcha_menu", "https://tuktukcha.com/menu/"),
]

# 6. Food Court Portals & Stalls
FOODCOURT_URLS = [
    ("foodcourt_foodrepublic_tenants", "https://foodrepublic.com.sg/tenants/"),
    ("foodcourt_foodrepublic_outlets", "https://foodrepublic.com.sg/outlets/"),
    ("foodcourt_koufu_brands", "https://www.koufu.com.sg/brands/"),
    ("foodcourt_koufu_outlets", "https://www.koufu.com.sg/outlets/"),
    ("foodcourt_kopitiam_brands", "https://www.fairpricegroup.com.sg/our-brands/kopitiam/"),
    ("foodcourt_malaysiaboleh", "https://malaysiaboleh.com.sg/"),
]

# 7. Open-Source Menu Catalogs (AllSGPromo, SingPromos)
OPENSOURCE_MENU_PROMOS = [
    ("promo_mcd_menu", "https://www.allsgpromo.com/mcdonalds-menu/"),
    ("promo_kfc_menu", "https://www.allsgpromo.com/kfc-menu/"),
    ("promo_subway_menu", "https://www.allsgpromo.com/subway-menu/"),
    ("promo_bk_menu", "https://www.allsgpromo.com/burger-king-menu/"),
    ("promo_pizzahut_menu", "https://www.allsgpromo.com/pizza-hut-menu/"),
    ("promo_jollibee_menu", "https://www.allsgpromo.com/jollibee-menu/"),
    ("promo_mos_menu", "https://www.allsgpromo.com/mos-burger-menu/"),
    ("promo_starbucks_menu", "https://www.allsgpromo.com/starbucks-menu/"),
    ("promo_yakun_menu", "https://www.allsgpromo.com/ya-kun-kaya-toast-menu/"),
    ("promo_toastbox_menu", "https://www.allsgpromo.com/toast-box-menu/"),
    ("promo_liho_menu", "https://www.allsgpromo.com/liho-tea-menu/"),
    ("promo_koi_menu", "https://www.allsgpromo.com/koi-menu/"),
    ("promo_dtf_menu", "https://www.allsgpromo.com/din-tai-fung-menu/"),
    ("promo_genki_menu", "https://www.allsgpromo.com/genki-sushi-menu/"),
    ("promo_pepperlunch_menu", "https://www.allsgpromo.com/pepper-lunch-menu/"),
    ("promo_astons_menu", "https://www.allsgpromo.com/astons-menu/"),
    ("promo_sweechoon_menu", "https://www.allsgpromo.com/swee-choon-menu/"),
    ("promo_boontongkee_menu", "https://www.allsgpromo.com/boon-tong-kee-menu/"),
    ("promo_crave_menu", "https://www.allsgpromo.com/crave-nasi-lemak-menu/"),
    ("promo_saizeriya_menu", "https://www.allsgpromo.com/saizeriya-menu/"),
    ("promo_stuffd_menu", "https://www.allsgpromo.com/stuffd-menu/"),
    ("promo_enciktan_menu", "https://www.allsgpromo.com/encik-tan-menu/"),
    ("promo_songfa_menu", "https://www.allsgpromo.com/song-fa-bak-kut-teh-menu/"),
    ("promo_timhowan_menu", "https://www.allsgpromo.com/tim-ho-wan-menu/"),
    ("promo_sanook_menu", "https://www.allsgpromo.com/sanook-kitchen-menu/"),
    ("promo_dianxiaoer_menu", "https://www.allsgpromo.com/dian-xiao-er-menu/"),
    ("promo_putien_menu", "https://www.allsgpromo.com/putien-menu/"),
    ("promo_swensens_menu", "https://www.allsgpromo.com/swensens-menu/"),
    ("promo_pastamania_menu", "https://www.pastamania.com.sg/pastamania-menu/"),
    ("promo_mrbean_menu", "https://www.allsgpromo.com/mr-bean-menu/"),
]

ALL_TARGETS = (
    DFD_HAWKER_URLS
    + SETHLUI_HAWKER_URLS
    + EATBOOK_HAWKER_URLS
    + MTC_HAWKER_URLS
    + CHAIN_OFFICIAL_URLS
    + FOODCOURT_URLS
    + OPENSOURCE_MENU_PROMOS
)

# Deduplicate targets by URL
seen_urls = set()
UNIQUE_TARGETS = []
for tag, url in ALL_TARGETS:
    if url not in seen_urls:
        seen_urls.add(url)
        UNIQUE_TARGETS.append((tag, url))


def scrape_target(item):
    idx, tag, url, total = item
    out_filename = os.path.join(OUTPUT_DIR, f"{tag}.md")
    if os.path.exists(out_filename) and os.path.getsize(out_filename) > 500:
        return {"tag": tag, "status": "cached", "bytes": os.path.getsize(out_filename)}

    payload = json.dumps({
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": True,
        "waitFor": 1000,
    }).encode("utf-8")

    req = urllib.request.Request(
        FIRECRAWL_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            elapsed = time.time() - t0
            raw_body = resp.read()
            data = json.loads(raw_body.decode("utf-8"))
            content = (
                data.get("data", {}).get("markdown")
                or data.get("markdown")
                or ""
            )
            title = data.get("data", {}).get("metadata", {}).get("title", "")
            if len(content) > 100:
                with open(out_filename, "w", encoding="utf-8") as f:
                    f.write(f"<!-- Source: {url} -->\n<!-- Title: {title} -->\n\n{content}")
                print(f"[{idx}/{total}] OK ({elapsed:.1f}s, {len(content)} bytes): {tag}")
                return {"tag": tag, "status": "success", "bytes": len(content), "elapsed": elapsed}
            else:
                print(f"[{idx}/{total}] EMPTY ({elapsed:.1f}s): {tag}")
                return {"tag": tag, "status": "empty", "elapsed": elapsed}
    except urllib.error.HTTPError as e:
        elapsed = time.time() - t0
        print(f"[{idx}/{total}] HTTP {e.code} ({elapsed:.1f}s): {tag}")
        return {"tag": tag, "status": f"http_{e.code}", "elapsed": elapsed}
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[{idx}/{total}] ERROR ({elapsed:.1f}s): {tag} - {str(e)[:60]}")
        return {"tag": tag, "status": "error", "error": str(e), "elapsed": elapsed}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total = len(UNIQUE_TARGETS)
    print(f"=== Starting Pass 24 Hyper-Throughput Firecrawl Crawl ===")
    print(f"Total Unique Targets: {total}")
    print(f"Concurrency: {CONCURRENCY} simultaneous workers")
    print(f"Firecrawl Scrape API: {FIRECRAWL_URL}")
    print(f"Output Directory: {OUTPUT_DIR}")

    items = [(i + 1, tag, url, total) for i, (tag, url) in enumerate(UNIQUE_TARGETS)]
    results = {"success": 0, "cached": 0, "empty": 0, "http_error": 0, "timeout": 0, "error": 0}

    start_time = time.time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        future_to_item = {executor.submit(scrape_target, item): item for item in items}
        for future in as_completed(future_to_item):
            res = future.result()
            st = res.get("status", "error")
            if st == "success":
                results["success"] += 1
            elif st == "cached":
                results["cached"] += 1
            elif st == "empty":
                results["empty"] += 1
            elif st.startswith("http_"):
                results["http_error"] += 1
            else:
                results["error"] += 1

    duration = time.time() - start_time
    print("\n=== Crawl Complete ===")
    print(f"Duration: {duration:.1f}s ({len(UNIQUE_TARGETS)/duration:.2f} pages/sec)")
    print(f"Results Summary: {results}")

    # Write summary manifest
    manifest_path = os.path.join(OUTPUT_DIR, "_crawl_summary.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "duration_seconds": round(duration, 2),
                "total_targets": total,
                "concurrency": CONCURRENCY,
                "results": results,
            },
            f,
            indent=2,
        )
    print(f"Summary manifest saved to: {manifest_path}")


if __name__ == "__main__":
    main()
