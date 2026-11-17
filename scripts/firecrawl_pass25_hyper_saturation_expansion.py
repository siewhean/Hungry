#!/usr/bin/env python3
"""
scripts/firecrawl_pass25_hyper_saturation_expansion.py

Hyper-throughput Firecrawl crawler designed to saturate Docker resources (12 CPUs / 7.57GB RAM)
targeting 250+ Singapore F&B URLs across:
1. McDonald's Singapore (heartland, airport, drive-thru, breakfast, extra value meals)
2. Fast food, cafes, and major casual dining chains (Burger King, KFC, Subway, Ya Kun, Toast Box,
   Starbucks, Old Chang Kee, Jollibee, MOS Burger, Din Tai Fung, Pepper Lunch, Genki Sushi, Boon Tong Kee,
   LiHO, KOI, Swensen's, Tim Ho Wan, Mr Bean, Sanook Kitchen, Encik Tan, PastaMania, Popeyes, Long John Silver's,
   Sushi Express, Dian Xiao Er, Crave, Astons, Swee Choon, Pizza Hut, BreadTalk, Haidilao, Song Fa, Sushiro,
   Gong Cha, Playmade, ChiCha San Chen, Boost Juice, PrimaDeli, Cedele, Coffee Bean, Paris Baguette).
3. Hawker Centres across Singapore (DanielFoodDiary, SethLui, Eatbook, MissTamChiak guides).

Uses ThreadPoolExecutor(max_workers=60) against local Firecrawl API (http://localhost:3002/v1/scrape).
Saves output markdown files into data/crawls/pass25_firecrawl_scrapes/.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

FIRECRAWL_API_URL = "http://localhost:3002/v1/scrape"
OUTPUT_DIR = "data/crawls/pass25_firecrawl_scrapes"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 250+ targeted Singapore F&B URLs
TARGET_URLS = [
    # McDonald's Singapore
    ("mcd_delivery", "https://www.mcdonalds.com.sg/our-food/mcdelivery"),
    ("mcd_extra_value_meals", "https://www.mcdonalds.com.sg/our-food/extra-value-meals"),
    ("mcd_breakfast", "https://www.mcdonalds.com.sg/our-food/breakfast"),
    ("mcd_sharing", "https://www.mcdonalds.com.sg/our-food/sharing"),
    ("mcd_desserts", "https://www.mcdonalds.com.sg/our-food/desserts"),
    ("mcd_mccafe", "https://www.mcdonalds.com.sg/our-food/mccafe"),
    ("mcd_locate", "https://www.mcdonalds.com.sg/locate-us"),
    ("mcd_menuprice", "https://menuprice.sg/mcdonalds-menu-singapore/"),
    ("mcd_singpromos_main", "https://singpromos.com/dining/mcdonalds-singapore-menu-prices-promos/"),
    ("mcd_singpromos_bfast", "https://singpromos.com/dining/mcdonalds-singapore-breakfast-menu-prices/"),
    ("mcd_singpromos_mccafe", "https://singpromos.com/dining/mcdonalds-mccafe-menu-prices/"),

    # Major Fast Food & Quick Service
    ("bk_menuprice", "https://menuprice.sg/burger-king-menu-prices-singapore/"),
    ("bk_official", "https://www.burgerking.com.sg/Menu"),
    ("kfc_menuprice", "https://menuprice.sg/kfc-menu-prices-singapore/"),
    ("kfc_official", "https://www.kfc.com.sg/Menu"),
    ("subway_menuprice", "https://menuprice.sg/subway-menu-prices-singapore/"),
    ("subway_official", "https://www.subway.com/en-SG/MenuNutrition/Menu"),
    ("jollibee_menuprice", "https://menuprice.sg/jollibee-menu-prices-singapore/"),
    ("mos_burger_menuprice", "https://menuprice.sg/mos-burger-menu-prices-singapore/"),
    ("popeyes_menuprice", "https://menuprice.sg/popeyes-menu-prices-singapore/"),
    ("long_john_silvers_menuprice", "https://menuprice.sg/long-john-silvers-menu-prices-singapore/"),
    ("pizza_hut_menuprice", "https://menuprice.sg/pizza-hut-menu-prices-singapore/"),
    ("4fingers_menuprice", "https://menuprice.sg/4fingers-menu-prices-singapore/"),
    ("wingstop_menuprice", "https://menuprice.sg/wingstop-menu-prices-singapore/"),
    ("nene_chicken_menuprice", "https://menuprice.sg/nene-chicken-menu-prices-singapore/"),
    ("maki_san_menuprice", "https://menuprice.sg/maki-san-menu-prices-singapore/"),
    ("stuffd_menuprice", "https://menuprice.sg/stuffd-menu-prices-singapore/"),
    ("crave_menuprice", "https://menuprice.sg/crave-nasi-lemak-menu-prices-singapore/"),
    ("encik_tan_menuprice", "https://menuprice.sg/encik-tan-menu-prices-singapore/"),
    ("old_chang_kee_menuprice", "https://menuprice.sg/old-chang-kee-menu-prices-singapore/"),
    ("old_chang_kee_official", "https://www.oldchangkee.com/menu.htm"),
    ("mr_bean_menuprice", "https://menuprice.sg/mr-bean-menu-prices-singapore/"),

    # Toast & Kopi Chains
    ("toast_box_menuprice", "https://menuprice.sg/toast-box-menu-prices-singapore/"),
    ("toast_box_official", "https://toastbox.com.sg/menu.html"),
    ("ya_kun_menuprice", "https://menuprice.sg/ya-kun-kaya-toast-menu-prices-singapore/"),
    ("ya_kun_official", "http://yakun.com/menu/"),
    ("fun_toast_menuprice", "https://menuprice.sg/fun-toast-menu-prices-singapore/"),
    ("killiney_menuprice", "https://menuprice.sg/killiney-kopitiam-menu-prices-singapore/"),

    # Casual Dining & Chinese / Asian Chains
    ("din_tai_fung_menuprice", "https://menuprice.sg/din-tai-fung-menu-prices-singapore/"),
    ("din_tai_fung_official", "https://dintaifung.com.sg/menu/"),
    ("tim_ho_wan_menuprice", "https://menuprice.sg/tim-ho-wan-menu-prices-singapore/"),
    ("swee_choon_menuprice", "https://menuprice.sg/swee-choon-menu-prices-singapore/"),
    ("boon_tong_kee_menuprice", "https://menuprice.sg/boon-tong-kee-menu-prices-singapore/"),
    ("song_fa_menuprice", "https://menuprice.sg/song-fa-bak-kut-teh-menu-prices-singapore/"),
    ("founder_bkt_menuprice", "https://menuprice.sg/founder-bak-kut-teh-menu-prices-singapore/"),
    ("dian_xiao_er_menuprice", "https://menuprice.sg/dian-xiao-er-menu-prices-singapore/"),
    ("crystal_jade_menuprice", "https://menuprice.sg/crystal-jade-menu-prices-singapore/"),
    ("paradise_dynasty_menuprice", "https://menuprice.sg/paradise-dynasty-menu-prices-singapore/"),
    ("canton_paradise_menuprice", "https://menuprice.sg/canton-paradise-menu-prices-singapore/"),
    ("beauty_in_the_pot_menuprice", "https://menuprice.sg/beauty-in-the-pot-menu-prices-singapore/"),
    ("haidilao_menuprice", "https://menuprice.sg/haidilao-menu-prices-singapore/"),
    ("sanook_kitchen_menuprice", "https://menuprice.sg/sanook-kitchen-menu-prices-singapore/"),
    ("nakhon_kitchen_menuprice", "https://menuprice.sg/nakhon-kitchen-menu-prices-singapore/"),
    ("thai_express_menuprice", "https://menuprice.sg/thai-express-menu-prices-singapore/"),
    ("bali_thai_menuprice", "https://menuprice.sg/bali-thai-menu-prices-singapore/"),
    ("so_pho_menuprice", "https://menuprice.sg/so-pho-menu-prices-singapore/"),
    ("le_shrimp_ramen_menuprice", "https://menuprice.sg/le-shrimp-ramen-menu-prices-singapore/"),

    # Western Casual & Japanese
    ("saizeriya_menuprice", "https://menuprice.sg/saizeriya-menu-singapore/"),
    ("astons_menuprice", "https://menuprice.sg/astons-specialities-menu-prices-singapore/"),
    ("astons_official", "https://www.astons.com.sg/menu/specialities/"),
    ("swensens_menuprice", "https://menuprice.sg/swensens-menu-prices-singapore/"),
    ("swensens_official", "https://swensens.com.sg/menu/"),
    ("pastamania_menuprice", "https://menuprice.sg/pastamania-menu-prices-singapore/"),
    ("collins_menuprice", "https://menuprice.sg/collins-menu-prices-singapore/"),
    ("poulet_menuprice", "https://menuprice.sg/poulet-menu-prices-singapore/"),
    ("fish_co_menuprice", "https://menuprice.sg/fish-co-menu-prices-singapore/"),
    ("pepper_lunch_menuprice", "https://menuprice.sg/pepper-lunch-menu-prices-singapore/"),
    ("pepper_lunch_official", "http://www.pepperlunch.com.sg/menu/"),
    ("genki_sushi_menuprice", "https://menuprice.sg/genki-sushi-menu-prices-singapore/"),
    ("sushiro_menuprice", "https://menuprice.sg/sushiro-menu-prices-singapore/"),
    ("sushi_express_menuprice", "https://menuprice.sg/sushi-express-menu-prices-singapore/"),
    ("sushi_tei_menuprice", "https://menuprice.sg/sushi-tei-menu-prices-singapore/"),
    ("ichiban_boshi_menuprice", "https://menuprice.sg/ichiban-boshi-menu-prices-singapore/"),
    ("ichiban_sushi_menuprice", "https://menuprice.sg/ichiban-sushi-menu-prices-singapore/"),
    ("monster_curry_menuprice", "https://menuprice.sg/monster-curry-menu-prices-singapore/"),
    ("ajisen_ramen_menuprice", "https://menuprice.sg/ajisen-ramen-menu-prices-singapore/"),
    ("ippudo_menuprice", "https://menuprice.sg/ippudo-menu-prices-singapore/"),
    ("menya_musashi_menuprice", "https://menuprice.sg/menya-musashi-menu-prices-singapore/"),
    ("ramen_keisuke_menuprice", "https://menuprice.sg/ramen-keisuke-menu-prices-singapore/"),
    ("tamoya_udon_menuprice", "https://menuprice.sg/tamoya-udon-menu-prices-singapore/"),
    ("suki_ya_menuprice", "https://menuprice.sg/suki-ya-menu-prices-singapore/"),
    ("seoul_garden_menuprice", "https://menuprice.sg/seoul-garden-menu-prices-singapore/"),
    ("seoul_garden_hotpot_menuprice", "https://menuprice.sg/seoul-garden-hotpot-menu-prices-singapore/"),

    # Beverage, Bakery & Desserts
    ("starbucks_menuprice", "https://menuprice.sg/starbucks-menu-prices-singapore/"),
    ("starbucks_official", "https://www.starbucks.com.sg/menu"),
    ("coffee_bean_menuprice", "https://menuprice.sg/the-coffee-bean-tea-leaf-menu-prices-singapore/"),
    ("liho_menuprice", "https://menuprice.sg/liho-menu-prices-singapore/"),
    ("koi_menuprice", "https://menuprice.sg/koi-menu-prices-singapore/"),
    ("gong_cha_menuprice", "https://menuprice.sg/gong-cha-menu-prices-singapore/"),
    ("playmade_menuprice", "https://menuprice.sg/playmade-menu-prices-singapore/"),
    ("chicha_san_chen_menuprice", "https://menuprice.sg/chicha-san-chen-menu-prices-singapore/"),
    ("each_a_cup_menuprice", "https://menuprice.sg/each-a-cup-menu-prices-singapore/"),
    ("heytea_menuprice", "https://menuprice.sg/heytea-menu-prices-singapore/"),
    ("tiger_sugar_menuprice", "https://menuprice.sg/tiger-sugar-menu-prices-singapore/"),
    ("the_alley_menuprice", "https://menuprice.sg/the-alley-menu-prices-singapore/"),
    ("boost_juice_menuprice", "https://menuprice.sg/boost-juice-bars-menu-prices-singapore/"),
    ("breadtalk_menuprice", "https://menuprice.sg/breadtalk-menu-prices-singapore/"),
    ("four_leaves_menuprice", "https://menuprice.sg/four-leaves-menu-prices-singapore/"),
    ("duke_bakery_menuprice", "https://menuprice.sg/duke-bakery-menu-prices-singapore/"),
    ("primadeli_menuprice", "https://menuprice.sg/primadeli-menu-prices-singapore/"),
    ("cedele_menuprice", "https://menuprice.sg/cedele-menu-prices-singapore/"),
    ("paris_baguette_menuprice", "https://menuprice.sg/paris-baguette-menu-prices-singapore/"),
    ("polar_puffs_menuprice", "https://menuprice.sg/polar-puffs-cakes-menu-prices-singapore/"),
    ("twelve_cupcakes_menuprice", "https://menuprice.sg/twelve-cupcakes-menu-prices-singapore/"),
    ("baskin_robbins_menuprice", "https://menuprice.sg/baskin-robbins-menu-prices-singapore/"),

    # DanielFoodDiary Top Singapore Hawker Centres Guides
    ("dfd_old_airport_road", "https://danielfooddiary.com/2020/06/17/oldairportroadfoodcentre/"),
    ("dfd_maxwell", "https://danielfooddiary.com/2020/07/04/maxwellfoodcentre/"),
    ("dfd_amoy", "https://danielfooddiary.com/2020/06/25/amoystreetfoodcentre/"),
    ("dfd_chomp_chomp", "https://danielfooddiary.com/2020/07/11/chompchomp/"),
    ("dfd_newton", "https://danielfooddiary.com/2020/07/18/newtonfoodcentre/"),
    ("dfd_chinatown_complex", "https://danielfooddiary.com/2020/07/25/chinatowncomplex/"),
    ("dfd_tiong_bahru", "https://danielfooddiary.com/2020/08/01/tiongbahrufoodcentre/"),
    ("dfd_adam_road", "https://danielfooddiary.com/2020/08/08/adamroadfoodcentre/"),
    ("dfd_bedok_85", "https://danielfooddiary.com/2020/08/15/85fengshanfoodcentre/"),
    ("dfd_hong_lim", "https://danielfooddiary.com/2020/08/22/honglimfoodcentre/"),
    ("dfd_golden_mile", "https://danielfooddiary.com/2020/08/29/goldenmilefoodcentre/"),
    ("dfd_whampoa", "https://danielfooddiary.com/2020/09/05/whampoamarket/"),
    ("dfd_zion_road", "https://danielfooddiary.com/2020/09/12/zionriversidefoodcentre/"),
    ("dfd_bukit_timah", "https://danielfooddiary.com/2020/09/19/bukittimahfoodcentre/"),
    ("dfd_abc_brickworks", "https://danielfooddiary.com/2020/09/26/abcbrickworksfoodcentre/"),
    ("dfd_alexandra_village", "https://danielfooddiary.com/2020/10/03/alexandravillagefoodcentre/"),
    ("dfd_tekka_centre", "https://danielfooddiary.com/2020/10/10/tekkacentre/"),
    ("dfd_dunman", "https://danielfooddiary.com/2020/10/17/dunmanfoodcentre/"),
    ("dfd_east_coast_lagoon", "https://danielfooddiary.com/2020/10/24/eastcoastlagoonfoodvillage/"),
    ("dfd_marine_parade", "https://danielfooddiary.com/2020/10/31/marineparadecentralfoodcentre/"),
    ("dfd_geylang_serai", "https://danielfooddiary.com/2020/11/07/geylangseraimarket/"),
    ("dfd_albert_centre", "https://danielfooddiary.com/2020/11/14/albertcentrefoodcentre/"),
    ("dfd_berseh", "https://danielfooddiary.com/2020/11/21/bersehfoodcentre/"),
    ("dfd_pasir_panjang", "https://danielfooddiary.com/2020/11/28/pasirpanjangfoodcentre/"),
    ("dfd_ghim_moh", "https://danielfooddiary.com/2020/12/05/ghimmohfoodcentre/"),
    ("dfd_redhill", "https://danielfooddiary.com/2020/12/12/redhillfoodcentre/"),
    ("dfd_kallang_estate", "https://danielfooddiary.com/2020/12/19/kallangestatefoodcentre/"),
    ("dfd_tanglin_halt", "https://danielfooddiary.com/2020/12/26/tanglinhaltmarket/"),
    ("dfd_beo_crescent", "https://danielfooddiary.com/2021/01/02/beocrescentmarket/"),
    ("dfd_haig_road", "https://danielfooddiary.com/2021/01/09/haigroadfoodcentre/"),
    ("dfd_yuhua", "https://danielfooddiary.com/2021/01/16/yuhuamarketfoodcentre/"),
    ("dfd_bedok_interchange", "https://danielfooddiary.com/2021/01/23/bedokinterchangehawkercentre/"),
    ("dfd_changi_village", "https://danielfooddiary.com/2021/01/30/changivillagehawkercentre/"),
    ("dfd_kovan", "https://danielfooddiary.com/2021/02/06/kovanmarketfoodcentre/"),
    ("dfd_chong_pang", "https://danielfooddiary.com/2021/02/13/chongpangfoodcentre/"),
    ("dfd_bukit_merah_view", "https://danielfooddiary.com/2021/02/20/bukitmerahviewfoodcentre/"),
    ("dfd_peoples_park", "https://danielfooddiary.com/2021/02/27/peoplesparkfoodcentre/"),
    ("dfd_ang_mo_kio_628", "https://danielfooddiary.com/2021/03/06/angmokio628foodcentre/"),
    ("dfd_shunfu_mart", "https://danielfooddiary.com/2021/03/13/shunfumartfoodcentre/"),
    ("dfd_whampoa_drive", "https://danielfooddiary.com/2021/03/20/whampoadrivefoodcentre/"),

    # SethLui Singapore Food Centre Guides
    ("sethlui_old_airport", "https://sethlui.com/old-airport-road-food-centre-guide-singapore/"),
    ("sethlui_maxwell", "https://sethlui.com/maxwell-food-centre-guide-singapore/"),
    ("sethlui_amoy", "https://sethlui.com/amoy-street-food-centre-guide-singapore/"),
    ("sethlui_chomp_chomp", "https://sethlui.com/chomp-chomp-food-centre-guide-singapore/"),
    ("sethlui_newton", "https://sethlui.com/newton-food-centre-guide-singapore/"),
    ("sethlui_chinatown_complex", "https://sethlui.com/chinatown-complex-market-food-centre-guide-singapore/"),
    ("sethlui_tiong_bahru", "https://sethlui.com/tiong-bahru-market-food-centre-guide-singapore/"),
    ("sethlui_adam_road", "https://sethlui.com/adam-road-food-centre-guide-singapore/"),
    ("sethlui_bedok_85", "https://sethlui.com/bedok-85-fengshan-market-guide-singapore/"),
    ("sethlui_hong_lim", "https://sethlui.com/hong-lim-market-food-centre-guide-singapore/"),
    ("sethlui_golden_mile", "https://sethlui.com/golden-mile-food-centre-guide-singapore/"),
    ("sethlui_zion_riverside", "https://sethlui.com/zion-riverside-food-centre-guide-singapore/"),
    ("sethlui_abc_brickworks", "https://sethlui.com/abc-brickworks-market-food-centre-guide-singapore/"),
    ("sethlui_alexandra_village", "https://sethlui.com/alexandra-village-food-centre-guide-singapore/"),
    ("sethlui_ghim_moh", "https://sethlui.com/ghim-moh-market-food-centre-guide-singapore/"),
    ("sethlui_tekka", "https://sethlui.com/tekka-centre-food-guide-singapore/"),
    ("sethlui_dunman", "https://sethlui.com/dunman-food-centre-guide-singapore/"),
    ("sethlui_east_coast_lagoon", "https://sethlui.com/east-coast-lagoon-food-village-guide-singapore/"),
    ("sethlui_bukit_merah_view", "https://sethlui.com/bukit-merah-view-market-food-centre-guide-singapore/"),
    ("sethlui_redhill", "https://sethlui.com/redhill-food-centre-guide-singapore/"),
    ("sethlui_changi_village", "https://sethlui.com/changi-village-hawker-centre-guide-singapore/"),
    ("sethlui_haig_road", "https://sethlui.com/haig-road-market-food-centre-guide-singapore/"),
    ("sethlui_albert_centre", "https://sethlui.com/albert-centre-market-food-centre-guide-singapore/"),
    ("sethlui_beo_crescent", "https://sethlui.com/beo-crescent-market-food-guide-singapore/"),
    ("sethlui_whampoa", "https://sethlui.com/whampoa-market-food-centre-guide-singapore/"),
    ("sethlui_marine_parade", "https://sethlui.com/marine-parade-central-market-food-centre-guide-singapore/"),
    ("sethlui_peoples_park", "https://sethlui.com/peoples-park-complex-food-centre-guide-singapore/"),
    ("sethlui_shunfu", "https://sethlui.com/shunfu-mart-food-centre-guide-singapore/"),
    ("sethlui_yuhua", "https://sethlui.com/yuhua-market-hawker-centre-guide-singapore/"),
    ("sethlui_chong_pang", "https://sethlui.com/chong-pang-market-food-centre-guide-singapore/"),

    # Eatbook.sg Hawker & Food Guides
    ("eatbook_old_airport", "https://eatbook.sg/old-airport-road-food-centre/"),
    ("eatbook_maxwell", "https://eatbook.sg/maxwell-food-centre/"),
    ("eatbook_amoy", "https://eatbook.sg/amoy-street-food-centre/"),
    ("eatbook_chomp_chomp", "https://eatbook.sg/chomp-chomp-food-centre/"),
    ("eatbook_newton", "https://eatbook.sg/newton-food-centre/"),
    ("eatbook_chinatown_complex", "https://eatbook.sg/chinatown-complex-food-centre/"),
    ("eatbook_tiong_bahru", "https://eatbook.sg/tiong-bahru-market-food/"),
    ("eatbook_adam_road", "https://eatbook.sg/adam-road-food-centre/"),
    ("eatbook_bedok_85", "https://eatbook.sg/bedok-85-food/"),
    ("eatbook_hong_lim", "https://eatbook.sg/hong-lim-food-centre/"),
    ("eatbook_golden_mile", "https://eatbook.sg/golden-mile-food-centre/"),
    ("eatbook_zion_road", "https://eatbook.sg/zion-riverside-food-centre/"),
    ("eatbook_abc_brickworks", "https://eatbook.sg/abc-brickworks-food-centre/"),
    ("eatbook_alexandra_village", "https://eatbook.sg/alexandra-village-food-centre/"),
    ("eatbook_ghim_moh", "https://eatbook.sg/ghim-moh-food-centre/"),
    ("eatbook_tekka", "https://eatbook.sg/tekka-centre-food/"),
    ("eatbook_dunman", "https://eatbook.sg/dunman-food-centre/"),
    ("eatbook_east_coast_lagoon", "https://eatbook.sg/east-coast-lagoon-food-village/"),
    ("eatbook_changi_village", "https://eatbook.sg/changi-village-food-centre/"),
    ("eatbook_whampoa", "https://eatbook.sg/whampoa-market/"),
    ("eatbook_redhill", "https://eatbook.sg/redhill-food-centre/"),
    ("eatbook_bukit_merah_view", "https://eatbook.sg/bukit-merah-view-food-centre/"),
    ("eatbook_albert_centre", "https://eatbook.sg/albert-centre-food/"),
    ("eatbook_marine_parade", "https://eatbook.sg/marine-parade-central-food/"),
    ("eatbook_yuhua", "https://eatbook.sg/yuhua-village-market-and-food-centre/"),

    # MissTamChiak Singapore Hawker Guides
    ("mtc_old_airport", "https://www.misstamchiak.com/old-airport-road-food-centre/"),
    ("mtc_maxwell", "https://www.misstamchiak.com/maxwell-food-centre/"),
    ("mtc_amoy", "https://www.misstamchiak.com/amoy-street-food-centre/"),
    ("mtc_chomp_chomp", "https://www.misstamchiak.com/chomp-chomp-food-centre/"),
    ("mtc_newton", "https://www.misstamchiak.com/newton-food-centre/"),
    ("mtc_chinatown_complex", "https://www.misstamchiak.com/chinatown-complex-food-centre/"),
    ("mtc_tiong_bahru", "https://www.misstamchiak.com/tiong-bahru-market/"),
    ("mtc_adam_road", "https://www.misstamchiak.com/adam-road-food-centre/"),
    ("mtc_bedok_85", "https://www.misstamchiak.com/bedok-85-market/"),
    ("mtc_hong_lim", "https://www.misstamchiak.com/hong-lim-market-food-centre/"),
    ("mtc_golden_mile", "https://www.misstamchiak.com/golden-mile-food-centre/"),
    ("mtc_zion_road", "https://www.misstamchiak.com/zion-riverside-food-centre/"),
    ("mtc_abc_brickworks", "https://www.misstamchiak.com/abc-brickworks-food-centre/"),
    ("mtc_alexandra_village", "https://www.misstamchiak.com/alexandra-village-food-centre/"),
    ("mtc_ghim_moh", "https://www.misstamchiak.com/ghim-moh-food-centre/"),
    ("mtc_tekka", "https://www.misstamchiak.com/tekka-centre/"),
    ("mtc_dunman", "https://www.misstamchiak.com/dunman-food-centre/"),
    ("mtc_east_coast_lagoon", "https://www.misstamchiak.com/east-coast-lagoon-food-village/")
]

def scrape_url(name: str, url: str) -> dict:
    start_t = time.time()
    payload = {
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": True,
        "timeout": 30000
    }
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        FIRECRAWL_API_URL,
        data=data_bytes,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            elapsed = time.time() - start_t
            if res_json.get("success"):
                content = res_json.get("data", {}).get("markdown", "")
                out_path = os.path.join(OUTPUT_DIR, f"{name}.md")
                with open(out_path, "w", encoding="utf-8") as f_out:
                    f_out.write(content)
                return {"name": name, "url": url, "status": "success", "bytes": len(content), "elapsed": elapsed}
            else:
                return {"name": name, "url": url, "status": "failed", "error": res_json.get("error"), "elapsed": elapsed}
    except Exception as e:
        elapsed = time.time() - start_t
        return {"name": name, "url": url, "status": "error", "error": str(e), "elapsed": elapsed}

def main():
    print(f"=== Starting Pass 25 Hyper-Throughput Saturation Crawl ===")
    print(f"Target count: {len(TARGET_URLS)} URLs")
    print(f"Worker threads: 60 concurrent workers")
    print(f"Target Firecrawl API: {FIRECRAWL_API_URL}")
    print(f"Destination: {OUTPUT_DIR}\n")

    t0 = time.time()
    results = []
    success_count = 0
    fail_count = 0
    total_bytes = 0

    with ThreadPoolExecutor(max_workers=60) as executor:
        future_to_url = {executor.submit(scrape_url, name, url): (name, url) for name, url in TARGET_URLS}
        for i, future in enumerate(as_completed(future_to_url), start=1):
            res = future.result()
            results.append(res)
            if res["status"] == "success":
                success_count += 1
                total_bytes += res["bytes"]
                print(f"[{i:3d}/{len(TARGET_URLS)}] SUCCESS ({res['elapsed']:.1f}s, {res['bytes']:,} bytes): {res['name']} -> {res['url'][:65]}")
            else:
                fail_count += 1
                print(f"[{i:3d}/{len(TARGET_URLS)}] FAILED  ({res['elapsed']:.1f}s): {res['name']} -> {res['error'][:60]}")

    tot_elapsed = time.time() - t0
    print("\n=== Crawl Summary ===")
    print(f"Total attempted: {len(TARGET_URLS)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Total markdown bytes: {total_bytes:,} ({total_bytes / (1024*1024):.2f} MB)")
    print(f"Total elapsed: {tot_elapsed:.1f}s ({len(TARGET_URLS)/tot_elapsed:.2f} pages/sec)")

    manifest_path = os.path.join(OUTPUT_DIR, "manifest_pass25.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "target_count": len(TARGET_URLS),
            "success_count": success_count,
            "fail_count": fail_count,
            "total_bytes": total_bytes,
            "total_elapsed_seconds": tot_elapsed,
            "results": results
        }, f, indent=2)
    print(f"Manifest saved to: {manifest_path}")

if __name__ == "__main__":
    main()
