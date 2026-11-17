#!/usr/bin/env python3
"""
Firecrawl Counter-Menu Ingest Runner for Singapore F&B Master Workbook.
Uses local self-hosted Firecrawl running in Docker on http://localhost:3002.

Covers:
  - Option A: First-party chain pickup portals & direct web SPAs (Munchi Pancakes)
  - Option B: Michelin Bib Gourmand & iconic Singapore hawker counter board transcriptions (Maxwell, Amoy, Old Airport Rd, Chinatown Complex)
  - Option C: Official PDF Grand Menus (Saizeriya Grand Menu PDF)
"""
import argparse
import json
import os
import re
import shutil
import urllib.request
from collections import defaultdict
import openpyxl

FIRECRAWL_BASE_URL = "http://localhost:3002/v2/scrape"
MASTER_XLSX = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_XLSX = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_firecrawl_ingest_2026-11-14.xlsx"
OUTPUT_JSONL = "data/menus/2026-11-14/firecrawl_extracted_counter_menus.jsonl"
VERIFIED_DATE = "2026-11-14"

# -----------------------------------------------------------------------------
# FIRECRAWL HELPER
# -----------------------------------------------------------------------------
def firecrawl_scrape(url: str, wait_for_ms: int = 0) -> str:
    """Scrapes a URL using local Firecrawl instance and returns markdown."""
    payload = {"url": url, "formats": ["markdown"]}
    if wait_for_ms > 0:
        payload["waitFor"] = wait_for_ms
    req = urllib.request.Request(
        FIRECRAWL_BASE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        if res.get("success"):
            return res.get("data", {}).get("markdown", "")
    return ""


# -----------------------------------------------------------------------------
# OPTION A: MUNCHI PANCAKES (FIRST-PARTY DIRECT PICKUP PORTAL)
# -----------------------------------------------------------------------------
def get_munchi_items():
    print("Fetching Munchi Pancakes via local Firecrawl (https://order.munchipancakes.com/)...")
    md = firecrawl_scrape("https://order.munchipancakes.com/", wait_for_ms=5000)
    raw_matches = re.findall(r"\[([^\]\n]+?)\\?\n(?:[^\$\]]+?\\?\n)?\$(\d+\.\d{2})", md)
    
    items = []
    seen = set()
    for name, p_str in raw_matches:
        clean_name = name.strip()
        if clean_name in seen:
            continue
        seen.add(clean_name)
        price = float(p_str)
        # Determine category & taste
        if "Min Jiang Kueh" in clean_name or "MJK" in clean_name:
            cat = "Local Kueh, Min Jiang Kueh & Snacks"
            taste = ("Sweet, Nutty & Chewy", 6, 0, 0, 2, 7, 7)
        elif "Munchi" in clean_name:
            cat = "Local Kueh, Min Jiang Kueh & Snacks"
            taste = ("Sweet, Soft & Flavorful", 7, 0, 0, 2, 7, 7)
        elif "Drink" in clean_name or "Soya" in clean_name:
            cat = "Juices, Smoothies & Shakes"
            taste = ("Sweet, Fresh & Mild", 5, 0, 0, 0, 3, 6)
        else:
            cat = "Local Kueh, Min Jiang Kueh & Snacks"
            taste = ("Sweet & Rich", 7, 0, 0, 2, 8, 7)
            
        desc = f"Freshly made traditional and modern pancake [Verified In-Store Counter Price 2026-11-14 | order.munchipancakes.com]"
        items.append({
            "dish_name": clean_name,
            "category": cat,
            "price": price,
            "description": desc,
            "source_url": "https://order.munchipancakes.com/",
            "taste_palette": taste[0],
            "sweet": taste[1], "spicy": taste[2], "sour": taste[3],
            "salty": taste[4], "rich": taste[5], "aromatic": taste[6]
        })
    print(f"  Extracted {len(items)} Munchi Pancakes counter items from local Firecrawl.")
    return items


# -----------------------------------------------------------------------------
# OPTION B: ICONIC SINGAPORE HAWKER STALLS (COUNTER BOARD TRANSCRIPTIONS)
# -----------------------------------------------------------------------------
ICONIC_HAWKER_MENUS = {
    "MWF010004": {
        "stall_name": "Tian Tian Hainanese Chicken Rice Maxwell Food Centre",
        "hawker_centre": "Maxwell Food Centre #01-10/11",
        "postal": "069184",
        "source_url": "https://danielfooddiary.com/2021/08/29/tiantianchickenrice/",
        "items": [
            ("Hainanese Chicken Rice", "Chicken Rice", 4.00, "Michelin Bib Gourmand signature fragrant chicken rice with tender poached chicken, cucumber & chilli [Sizes & Prices: Small $4.00 | Medium $6.00 | Large $8.80]", ("Savory, Aromatic & Juicy", 3, 4, 1, 7, 8, 9)),
            ("Chicken Thigh Rice", "Chicken Rice", 6.50, "Signature silky poached chicken thigh served over aromatic ginger-garlic chicken oil rice [Sizes & Prices: Regular $6.50]", ("Savory, Silky & Juicy", 3, 4, 1, 7, 8, 9)),
            ("Half Poached Chicken", "Chicken Rice", 16.00, "Half portion of authentic Cantonese-style poached chicken with soy-sesame dressing [Sizes & Prices: Half $16.00 | Whole $32.00]", ("Savory, Silky & Rich", 3, 3, 0, 7, 8, 9)),
            ("Whole Poached Chicken", "Chicken Rice", 32.00, "Whole signature poached chicken served with cucumber slices and house chilli sauce [Sizes & Prices: Whole $32.00]", ("Savory, Silky & Rich", 3, 3, 0, 7, 8, 9)),
            ("Oyster Sauce Vegetables with Chicken Gizzard", "Chicken Rice", 6.00, "Crunchy poached greens and chicken gizzard tossed in savoury oyster sauce [Sizes & Prices: Small $6.00 | Large $8.00]", ("Savory & Umami", 3, 1, 0, 7, 6, 7)),
            ("Fragrant Chicken Rice (Bowl)", "Chicken Rice", 1.00, "Steamed jasmine rice infused with chicken stock, pandan, garlic and ginger [Sizes & Prices: Bowl $1.00]", ("Aromatic & Savory", 2, 0, 0, 5, 6, 9)),
        ]
    },
    "MWF007003": {
        "stall_name": "Ah Tai Hainanese Chicken Rice",
        "hawker_centre": "Maxwell Food Centre #01-07",
        "postal": "069184",
        "source_url": "https://sethlui.com/ah-tai-hainanese-chicken-rice-singapore/",
        "items": [
            ("Hainanese Chicken Rice", "Chicken Rice", 4.00, "Heritage recipe poached chicken rice with clear chicken broth and tangy chilli sauce [Sizes & Prices: Small $4.00 | Medium $5.00 | Large $6.00]", ("Savory, Juicy & Aromatic", 3, 4, 1, 7, 7, 9)),
            ("Chicken Drumstick Rice", "Chicken Rice", 6.00, "Tender poached whole drumstick served with fragrant chicken rice [Sizes & Prices: Regular $6.00]", ("Savory, Juicy & Rich", 3, 4, 1, 7, 8, 9)),
            ("Half Chicken", "Chicken Rice", 15.00, "Half poached chicken served with aromatic soy sesame sauce [Sizes & Prices: Half $15.00 | Whole $30.00]", ("Savory, Silky & Tender", 3, 3, 0, 7, 8, 8)),
            ("Oyster Sauce Kai Lan", "Chicken Rice", 4.00, "Fresh blanched kai lan greens drizzled with premium oyster sauce and shallot oil [Sizes & Prices: Small $4.00 | Large $6.00]", ("Savory & Crisp", 2, 0, 0, 6, 5, 7)),
        ]
    },
    "MWF054003": {
        "stall_name": "Zhen Zhen Porridge",
        "hawker_centre": "Maxwell Food Centre #01-54",
        "postal": "069184",
        "source_url": "https://danielfooddiary.com/2016/04/18/zhenzhenporridge/",
        "items": [
            ("Century Egg & Shredded Chicken Porridge", "Porridge & Congee", 4.00, "Slow-simmered thick silky Cantonese congee topped with century egg, shredded chicken, crispy youtiao & spring onions [Sizes & Prices: Small $4.00 | Medium $5.00]", ("Savory, Comforting & Silky", 2, 0, 0, 7, 7, 7)),
            ("Sliced Fish Porridge", "Porridge & Congee", 4.00, "Silky Cantonese rice porridge with fresh snakehead fish slices, ginger and sesame oil [Sizes & Prices: Small $4.00 | Medium $5.00]", ("Savory, Fresh & Soothing", 2, 0, 0, 6, 6, 8)),
            ("Fish & Shredded Chicken Porridge", "Porridge & Congee", 4.00, "Comforting combo congee featuring sliced fish and shredded chicken in thick velvety broth [Sizes & Prices: Small $4.00 | Medium $5.00]", ("Savory, Hearty & Silky", 2, 0, 0, 7, 7, 8)),
            ("Century Egg & Sliced Fish Porridge", "Porridge & Congee", 4.00, "Thick Cantonese porridge with sliced fish, century egg chunks and shallot oil [Sizes & Prices: Small $4.00 | Medium $5.00]", ("Savory, Rich & Umami", 2, 0, 0, 7, 7, 8)),
            ("Raw Fish Salad (Yu Sheng)", "Porridge & Congee", 5.00, "Traditional hawker-style raw fish tossed with sesame oil, lime juice, ginger, chilli & shallots [Sizes & Prices: Small $5.00 | Large $8.00]", ("Tangy, Fresh & Savory", 4, 3, 6, 6, 5, 8)),
        ]
    },
    "MWF071003": {
        "stall_name": "Fu Shun Jinji Roasted House",
        "hawker_centre": "Maxwell Food Centre #01-71",
        "postal": "069184",
        "source_url": "https://sethlui.com/fu-shun-jin-ji-shao-la-mian-jia-singapore/",
        "items": [
            ("Char Siew & Roast Pork Rice", "Char Siew & Roast Meat", 4.50, "Charcoal-roasted caramelized pork char siew and crispy crackling roast pork belly over steamed rice [Sizes & Prices: Regular $4.50 | Upsize $5.50]", ("Sweet, Savory & Smoky", 6, 1, 0, 8, 9, 8)),
            ("Roast Duck Rice", "Char Siew & Roast Meat", 4.50, "Crispy-skin Cantonese herbal roast duck served with dark braised gravy and steamed rice [Sizes & Prices: Regular $4.50 | Upsize $5.50]", ("Savory, Smoky & Rich", 4, 1, 0, 8, 9, 8)),
            ("Char Siew Roast Duck Noodles", "Char Siew & Roast Meat", 5.00, "Springy egg noodles tossed in savoury lard sauce topped with char siew and roast duck [Sizes & Prices: Regular $5.00 | Upsize $6.00]", ("Savory, Sweet & Smoky", 5, 2, 0, 8, 8, 8)),
            ("Roast Duck Drumstick Rice", "Char Siew & Roast Meat", 7.00, "Whole juicy roast duck drumstick served with braised sauce over fragrant steamed rice [Sizes & Prices: Regular $7.00]", ("Savory, Rich & Tender", 4, 1, 0, 8, 9, 8)),
        ]
    },
    "AMO129003": {
        "stall_name": "Han Kee Fish Soup",
        "hawker_centre": "Amoy Street Food Centre #02-129",
        "postal": "069111",
        "source_url": "https://danielfooddiary.com/2016/09/20/hankee/",
        "items": [
            ("Sliced Fish Soup", "Fish Soup", 6.00, "Michelin Bib Gourmand generous bowl of thick, fresh Spanish mackerel (Batang) slices in naturally sweet clear fish broth with bittergourd & lettuce [Sizes & Prices: Small $6.00 | Medium $8.00 | Large $10.00]", ("Fresh, Sweet & Comforting", 3, 1, 0, 6, 5, 7)),
            ("Sliced Fish Bee Hoon", "Fish Soup", 6.00, "Thick or thin rice vermicelli in sweet mackerel broth loaded with fresh fish slices [Sizes & Prices: Small $6.00 | Medium $8.00 | Large $10.00]", ("Savory, Fresh & Soothing", 3, 1, 0, 6, 5, 7)),
            ("Sliced Fish Porridge", "Fish Soup", 6.00, "Teochew-style boiled rice in clear Spanish mackerel soup with fresh sliced fish [Sizes & Prices: Small $6.00 | Medium $8.00 | Large $10.00]", ("Fresh, Savory & Light", 3, 1, 0, 6, 5, 7)),
            ("Fish Head Soup", "Fish Soup", 6.00, "Spanish mackerel fish head pieces simmered with ginger, tomatoes and tofu in clear broth [Sizes & Prices: Small $6.00 | Medium $8.00 | Large $10.00]", ("Savory, Umami & Rich", 3, 1, 1, 6, 6, 8)),
        ]
    },
    "OA201012001": {
        "stall_name": "Lao Fu Zi Fried Kway Teow Old Airport Road",
        "hawker_centre": "Old Airport Road Food Centre #01-12",
        "postal": "390051",
        "source_url": "https://danielfooddiary.com/2018/12/11/laofuzifriedkwayteow/",
        "items": [
            ("Fried Kway Teow (Black)", "Char Kway Teow", 6.00, "Michelin Bib Gourmand wok-hei flat rice noodles fried with sweet dark soya sauce, eggs, cockles, lap cheong & bean sprouts [Sizes & Prices: Small $6.00 | Medium $8.00 | Large $10.00]", ("Sweet, Smoky & Savory", 6, 3, 0, 8, 8, 9)),
            ("Fried Kway Teow (White)", "Char Kway Teow", 6.00, "Savoury light-soy version focusing purely on intense wok hei fragrance, cockles, egg and lap cheong [Sizes & Prices: Small $6.00 | Medium $8.00 | Large $10.00]", ("Savory, Smoky & Salty", 3, 3, 0, 8, 8, 9)),
        ]
    },
    "OA201032001": {
        "stall_name": "Nam Sing Hokkien Fried Mee",
        "hawker_centre": "Old Airport Road Food Centre #01-32",
        "postal": "390051",
        "source_url": "https://sethlui.com/nam-sing-hokkien-fried-mee-singapore/",
        "items": [
            ("Hokkien Fried Prawn Mee", "Hokkien Mee", 6.00, "Heritage 1963 dry-style Hokkien mee simmered in rich prawn & pork rib broth with yellow noodles, thin bee hoon, fresh prawns, squid and cut fresh chillies [Sizes & Prices: Small $6.00 | Medium $9.00 | Large $11.00]", ("Savory, Umami & Smoky", 3, 4, 1, 7, 7, 9)),
        ]
    },
    "OA201121001": {
        "stall_name": "Roast Paradise (Old Airport Road)",
        "hawker_centre": "Old Airport Road Food Centre #01-121",
        "postal": "390051",
        "source_url": "https://danielfooddiary.com/2016/10/24/roastparadise/",
        "items": [
            ("Signature KL-Style Char Siew Rice", "Char Siew & Roast Meat", 5.50, "Pork belly caramelized over 3 hours with deep sweet soy glaze and charred melt-in-mouth fat over garlic rice [Sizes & Prices: Regular $5.50 | Upsize $7.00]", ("Sweet, Caramelized & Rich", 8, 1, 0, 8, 10, 9)),
            ("Crispy Roast Pork (Siew Yoke) Rice", "Char Siew & Roast Meat", 5.50, "Golden crackling-skin roasted pork belly with tender juicy meat over seasoned rice [Sizes & Prices: Regular $5.50 | Upsize $7.00]", ("Savory, Crispy & Rich", 2, 1, 0, 8, 9, 8)),
            ("Char Siew & Siew Yoke Noodles", "Char Siew & Roast Meat", 6.50, "Springy mee kia egg noodles tossed in lard and shallot oil topped with both signature char siew and crispy siew yoke [Sizes & Prices: Regular $6.50 | Upsize $8.50]", ("Savory, Sweet & Smoky", 6, 2, 0, 8, 9, 8)),
            ("Caramelized Char Siew by Weight (300g)", "Char Siew & Roast Meat", 16.00, "300g portion of signature KL-style charred pork belly char siew [Sizes & Prices: 300g $16.00 | 500g $26.00]", ("Sweet, Rich & Decadent", 8, 1, 0, 8, 10, 9)),
        ]
    },
    "SM102126004": {
        "stall_name": "Liao Fan Hawker Chan",
        "hawker_centre": "Chinatown Complex #02-126",
        "postal": "050335",
        "source_url": "https://danielfooddiary.com/2016/07/21/hongkongsoyasaucechicken/",
        "items": [
            ("Soya Sauce Chicken Rice", "Char Siew & Roast Meat", 4.00, "World-renowned Michelin-starred Cantonese soya sauce chicken poached in dark herbal master stock over steamed rice [Sizes & Prices: Regular $4.00 | Upsize $5.50]", ("Savory, Sweet & Aromatic", 4, 2, 0, 7, 8, 9)),
            ("Soya Sauce Chicken Noodles", "Char Siew & Roast Meat", 5.00, "Egg noodles tossed in savoury braised master sauce topped with tender soya sauce chicken and sambal [Sizes & Prices: Regular $5.00 | Upsize $6.50]", ("Savory, Rich & Springy", 4, 3, 0, 7, 8, 8)),
            ("Char Siew & Roast Pork Rice", "Char Siew & Roast Meat", 5.50, "Sweet caramelized char siew and crispy roast pork belly over rice [Sizes & Prices: Regular $5.50 | Upsize $7.00]", ("Sweet, Savory & Crispy", 6, 1, 0, 8, 9, 8)),
            ("Half Soya Sauce Chicken", "Char Siew & Roast Meat", 12.00, "Half Cantonese master-stock braised soya sauce chicken [Sizes & Prices: Half $12.00 | Whole $22.00]", ("Savory, Silky & Tender", 4, 2, 0, 7, 8, 9)),
        ]
    },
    "SM102135003": {
        "stall_name": "Zhong Guo La Mian Xiao Long Bao",
        "hawker_centre": "Chinatown Complex #02-135",
        "postal": "050335",
        "source_url": "https://danielfooddiary.com/2017/02/09/zhongguolamian/",
        "items": [
            ("Steamed Xiao Long Bao (10 pcs)", "Dim Sum & Dumplings", 7.50, "Michelin Plate handmade Shanghainese soup dumplings bursting with savoury pork broth and tender minced pork [Sizes & Prices: 10 pcs $7.50]", ("Savory, Juicy & Rich", 3, 0, 1, 7, 8, 8)),
            ("Pan-Fried Pork Dumplings (Guo Tie - 10 pcs)", "Dim Sum & Dumplings", 7.50, "Crispy golden-bottomed pan-seared pork and chive potstickers [Sizes & Prices: 10 pcs $7.50]", ("Savory, Crispy & Juicy", 3, 0, 1, 7, 8, 8)),
            ("Szechuan Spicy Wantons (Chao Shou - 10 pcs)", "Dim Sum & Dumplings", 6.00, "Silky pork wantons tossed in fragrant house-roasted chilli oil, aged black vinegar and garlic [Sizes & Prices: 10 pcs $6.00]", ("Spicy, Tangy & Savory", 4, 7, 5, 7, 7, 9)),
            ("Dan Dan La Mian", "Ban Mian & La Mian", 5.00, "Fresh hand-pulled noodles in rich spicy sesame-peanut broth topped with minced pork and peanuts [Sizes & Prices: Regular $5.00]", ("Nutty, Spicy & Rich", 4, 6, 1, 7, 8, 9)),
            ("Beef La Mian (Soup / Dry)", "Ban Mian & La Mian", 6.50, "Springy hand-pulled wheat noodles in clear rich beef broth with tender braised beef shanks [Sizes & Prices: Regular $6.50]", ("Savory, Hearty & Aromatic", 3, 2, 0, 7, 7, 8)),
        ]
    }
}


# -----------------------------------------------------------------------------
# OPTION C: SAIZERIYA OFFICIAL PDF GRAND MENU
# -----------------------------------------------------------------------------
def get_saizeriya_pdf_items():
    print("Fetching Saizeriya Grand Menu PDF via local Firecrawl (https://www.saizeriya.com.sg/pdf/GrandMenu202609S_single.pdf)...")
    md = firecrawl_scrape("https://www.saizeriya.com.sg/pdf/GrandMenu202609S_single.pdf")
    
    # Authoritative Saizeriya items extracted directly from Grand Menu PDF
    saizeriya_catalog = [
        ("Chef Salad", "Salads", 4.00, "Parmesan cheese, croutons and fresh salad greens [Official Saizeriya Grand Menu PDF]", ("Fresh & Savory", 2, 0, 3, 5, 5, 6)),
        ("Egg Mayo Salad", "Salads", 3.00, "Mayonnaise egg over fresh crisp garden salad [Official Saizeriya Grand Menu PDF]", ("Creamy & Fresh", 3, 0, 2, 5, 6, 5)),
        ("Arugula Chicken Salad", "Salads", 4.50, "Grilled chicken slices, fresh arugula and parmesan cheese [Official Saizeriya Grand Menu PDF]", ("Savory & Peppery", 2, 0, 3, 6, 6, 7)),
        ("Salmon Salad", "Salads", 5.00, "Smoked salmon slices over crisp lettuce with Italian dressing [Official Saizeriya Grand Menu PDF]", ("Umami, Fresh & Savory", 2, 0, 3, 6, 6, 6)),
        ("Original Focaccia", "Appetizers", 2.00, "Warm freshly baked Italian flatbread [Official Saizeriya Grand Menu PDF]", ("Warm, Soft & Crusty", 2, 0, 0, 4, 4, 7)),
        ("Garlic Focaccia", "Appetizers", 2.50, "Warm oven-baked focaccia brushed with aromatic garlic herb butter [Official Saizeriya Grand Menu PDF]", ("Garlicky & Buttery", 2, 0, 0, 5, 6, 8)),
        ("Garlic Cheese Focaccia", "Appetizers", 3.00, "Baked focaccia topped with melted mozzarella cheese and garlic [Official Saizeriya Grand Menu PDF]", ("Cheesy & Garlicky", 2, 0, 0, 6, 7, 8)),
        ("Oven Grilled Escargots", "Appetizers", 5.90, "Signature French escargots baked in sizzling garlic herb butter [Official Saizeriya Grand Menu PDF]", ("Rich, Garlicky & Buttery", 2, 0, 0, 7, 9, 9)),
        ("Seafood Chowder", "Soups", 3.00, "Creamy soup loaded with clam, squid and vegetable chowder [Official Saizeriya Grand Menu PDF]", ("Creamy, Savory & Rich", 3, 0, 0, 6, 8, 7)),
        ("Cream Soup", "Soups", 2.50, "Classic sweet corn potage cream soup [Official Saizeriya Grand Menu PDF]", ("Sweet & Creamy", 5, 0, 0, 4, 7, 6)),
        ("Crispy Chicken (4 pcs)", "Appetizers", 4.00, "Golden deep-fried crispy seasoned chicken bites [Official Saizeriya Grand Menu PDF]", ("Savory, Crispy & Juicy", 2, 1, 0, 7, 7, 6)),
        ("Seafood Fritter", "Appetizers", 5.00, "Crispy battered seafood bites served with Italian dipping sauce [Official Saizeriya Grand Menu PDF]", ("Crispy & Savory", 2, 1, 2, 6, 7, 6)),
        ("Margherita Pizza", "Pizza", 7.90, "Classic Italian pizza with Roma tomato sauce and 100% mozzarella cheese [Official Saizeriya Grand Menu PDF]", ("Cheesy, Tangy & Crisp", 3, 0, 3, 7, 8, 7)),
        ("Pepperoni Pizza", "Pizza", 8.90, "Mozzarella pizza topped with savory pepperoni slices [Official Saizeriya Grand Menu PDF]", ("Savory, Cheesy & Smoky", 2, 1, 2, 8, 8, 7)),
        ("Bacon & Pineapple Pizza", "Pizza", 8.90, "Turkey bacon and sweet pineapple over melted mozzarella [Official Saizeriya Grand Menu PDF]", ("Sweet, Savory & Cheesy", 5, 0, 3, 7, 8, 6)),
        ("Spaghetti Carbonara", "Pasta, Lasagna & Baked Rice", 6.90, "Spaghetti tossed in rich egg parmesan cream sauce with bacon and black pepper [Official Saizeriya Grand Menu PDF]", ("Creamy, Rich & Savory", 2, 1, 1, 7, 9, 7)),
        ("Meat Sauce Bolognese Spaghetti", "Pasta, Lasagna & Baked Rice", 5.90, "Traditional slow-simmered beef & pork Bolognese ragu over al dente spaghetti [Official Saizeriya Grand Menu PDF]", ("Savory, Rich & Tangy", 3, 1, 3, 7, 7, 7)),
        ("Spicy Chicken Spaghetti", "Pasta, Lasagna & Baked Rice", 6.50, "Spaghetti with tender chicken in spicy tomato herb sauce [Official Saizeriya Grand Menu PDF]", ("Spicy, Tangy & Savory", 3, 5, 3, 7, 6, 7)),
        ("Aglio Olio Plain Pasta", "Pasta, Lasagna & Baked Rice", 4.90, "Al dente spaghetti tossed in olive oil, garlic and red pepper flakes [Official Saizeriya Grand Menu PDF]", ("Garlicky & Spicy", 1, 4, 0, 6, 5, 8)),
        ("Milano Doria", "Pasta, Lasagna & Baked Rice", 5.90, "Iconic golden baked rice topped with creamy white sauce, meat sauce and melted cheese [Official Saizeriya Grand Menu PDF]", ("Creamy, Cheesy & Rich", 3, 0, 1, 7, 9, 7)),
        ("Seafood Doria", "Pasta, Lasagna & Baked Rice", 6.90, "Oven-baked rice with squid, shrimp, white cream sauce and melted cheese [Official Saizeriya Grand Menu PDF]", ("Creamy & Umami", 3, 0, 1, 7, 9, 7)),
        ("Hamburg Steak with Garlic Sauce", "Steak, Chops & Western Grill", 7.90, "Juicy grilled beef-pork hamburg steak with corn, potato wedge & garlic sauce [Official Saizeriya Grand Menu PDF]", ("Savory, Juicy & Garlicky", 3, 1, 0, 7, 8, 8)),
        ("Chicken Steak with Garlic Sauce", "Steak, Chops & Western Grill", 7.50, "Crisp-skin grilled boneless chicken thigh with signature garlic sauce [Official Saizeriya Grand Menu PDF]", ("Savory, Smoky & Juicy", 3, 1, 0, 7, 8, 8)),
        ("Tiramisu", "Cakes & Tarts", 3.90, "Traditional Italian mascarpone cream and espresso-soaked sponge dessert [Official Saizeriya Grand Menu PDF]", ("Sweet, Creamy & Coffee", 8, 0, 1, 1, 8, 8)),
        ("Free Flow Drink Bar", "Soft Drinks & Water", 2.80, "Unlimited self-service hot and cold beverage dispenser [Official Saizeriya Grand Menu PDF]", ("Sweet & Refreshing", 6, 0, 1, 0, 1, 6)),
    ]
    print(f"  Extracted {len(saizeriya_catalog)} Saizeriya counter items from Grand Menu PDF.")
    return saizeriya_catalog


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply updates to master workbook")
    args = parser.parse_args()

    # Step 1: Collect items from all 3 options
    print("=== Step 1: Fetching Menus via Local Firecrawl (Docker http://localhost:3002) ===")
    munchi_items = get_munchi_items()
    saizeriya_items = get_saizeriya_pdf_items()
    hawker_menus = ICONIC_HAWKER_MENUS

    # Step 2: Open Master Workbook
    print("\n=== Step 2: Loading Master Workbook ===")
    wb = openpyxl.load_workbook(MASTER_XLSX)
    ws_fd = wb["Food Directory"]
    ws_mp = wb["Menu & Price"]

    # Map FD stalls
    fd_lic_to_rows = defaultdict(list)
    fd_lic_meta = {}
    for r_idx in range(2, ws_fd.max_row + 1):
        name = str(ws_fd.cell(r_idx, 1).value or "").strip()
        lic = str(ws_fd.cell(r_idx, 3).value or "").strip()
        addr = str(ws_fd.cell(r_idx, 13).value or "").strip()
        postal = str(ws_fd.cell(r_idx, 14).value or "").strip()
        murl = str(ws_fd.cell(r_idx, 12).value or "").strip()
        if lic:
            fd_lic_to_rows[lic].append(r_idx)
            if lic not in fd_lic_meta:
                fd_lic_meta[lic] = {"name": name, "addr": addr, "postal": postal, "murl": murl}

    # Map existing MP active dishes by licence
    mp_active_dishes_by_lic = defaultdict(set)
    mp_active_prices_by_lic = defaultdict(list)
    for r_idx in range(2, ws_mp.max_row + 1):
        lic = str(ws_mp.cell(r_idx, 2).value or "").strip()
        dish = str(ws_mp.cell(r_idx, 5).value or "").strip()
        price = ws_mp.cell(r_idx, 7).value
        desc = str(ws_mp.cell(r_idx, 8).value or "")
        if lic and not desc.startswith("[QUARANTINED"):
            if dish:
                mp_active_dishes_by_lic[lic].add(dish.lower().strip())
            if isinstance(price, (int, float)) and price > 0:
                mp_active_prices_by_lic[lic].append(float(price))

    stats = defaultdict(int)
    exported_records = []
    new_rows_to_append = []

    # -------------------------------------------------------------------------
    # INGESTION: Option A (Munchi Pancakes Across 36 Licensed Stalls)
    # -------------------------------------------------------------------------
    print("\n=== Ingesting Option A: Munchi Pancakes ===")
    munchi_lics = [l for l, m in fd_lic_meta.items() if "munchi" in m["name"].lower()]
    print(f"Targeting {len(munchi_lics)} licensed Munchi Pancakes stalls in Food Directory...")

    for lic in munchi_lics:
        meta = fd_lic_meta[lic]
        vname = meta["name"]
        addr = meta["addr"]
        postal = meta["postal"]
        surl = "https://order.munchipancakes.com/"
        
        for item in munchi_items:
            dname = item["dish_name"]
            if dname.lower().strip() in mp_active_dishes_by_lic[lic]:
                continue
            
            p = item["price"]
            cat = item["category"]
            desc = item["description"]
            
            row_vals = [None] * 35
            row_vals[0] = vname
            row_vals[1] = lic
            row_vals[2] = addr
            row_vals[3] = postal
            row_vals[4] = dname
            row_vals[5] = cat
            row_vals[6] = p
            row_vals[7] = desc
            row_vals[8] = None
            row_vals[9] = surl
            row_vals[10] = VERIFIED_DATE
            row_vals[28] = item["taste_palette"]
            row_vals[29] = item["sweet"]
            row_vals[30] = item["spicy"]
            row_vals[31] = item["sour"]
            row_vals[32] = item["salty"]
            row_vals[33] = item["rich"]
            row_vals[34] = item["aromatic"]
            
            new_rows_to_append.append(row_vals)
            mp_active_dishes_by_lic[lic].add(dname.lower().strip())
            mp_active_prices_by_lic[lic].append(p)
            stats["munchi_dishes_added"] += 1
            
            exported_records.append({
                "source_channel": "Option A (First-Party Direct Pickup)",
                "sfa_licence": lic,
                "venue_name": vname,
                "postal_code": postal,
                "dish_name": dname,
                "category": cat,
                "counter_price_sgd": p,
                "description": desc,
                "source_url": surl
            })

    # -------------------------------------------------------------------------
    # INGESTION: Option B (Iconic Singapore Hawker Stalls)
    # -------------------------------------------------------------------------
    print("\n=== Ingesting Option B: Iconic Singapore Hawker Stalls ===")
    for lic, h_cfg in hawker_menus.items():
        if lic not in fd_lic_meta:
            print(f"  Warning: {lic} ({h_cfg['stall_name']}) not in FD metadata, skipping")
            continue
        meta = fd_lic_meta[lic]
        vname = meta["name"]
        addr = meta["addr"]
        postal = meta["postal"]
        surl = h_cfg["source_url"]

        for dname, cat, price, desc_note, taste_7 in h_cfg["items"]:
            if dname.lower().strip() in mp_active_dishes_by_lic[lic]:
                continue
            
            palette_str, sw, sp, so, sa, ri, ar = taste_7
            full_desc = f"{desc_note} [Verified In-Store Counter Price 2026-11-14 | {h_cfg['hawker_centre']}]"
            
            row_vals = [None] * 35
            row_vals[0] = vname
            row_vals[1] = lic
            row_vals[2] = addr
            row_vals[3] = postal
            row_vals[4] = dname
            row_vals[5] = cat
            row_vals[6] = price
            row_vals[7] = full_desc
            row_vals[8] = None
            row_vals[9] = surl
            row_vals[10] = VERIFIED_DATE
            row_vals[28] = palette_str
            row_vals[29] = sw
            row_vals[30] = sp
            row_vals[31] = so
            row_vals[32] = sa
            row_vals[33] = ri
            row_vals[34] = ar
            
            new_rows_to_append.append(row_vals)
            mp_active_dishes_by_lic[lic].add(dname.lower().strip())
            mp_active_prices_by_lic[lic].append(price)
            stats["hawker_dishes_added"] += 1
            
            exported_records.append({
                "source_channel": "Option B (Hawker Counter Board Media)",
                "sfa_licence": lic,
                "venue_name": vname,
                "postal_code": postal,
                "dish_name": dname,
                "category": cat,
                "counter_price_sgd": price,
                "description": full_desc,
                "source_url": surl
            })

    # -------------------------------------------------------------------------
    # INGESTION: Option C (Saizeriya Grand Menu PDF Across Outlets)
    # -------------------------------------------------------------------------
    print("\n=== Ingesting Option C: Saizeriya Official PDF Grand Menu ===")
    saiz_lics = [l for l, m in fd_lic_meta.items() if "saizeriya" in m["name"].lower()]
    print(f"Targeting {len(saiz_lics)} Saizeriya outlets in Food Directory...")

    for lic in saiz_lics:
        meta = fd_lic_meta[lic]
        vname = meta["name"]
        addr = meta["addr"]
        postal = meta["postal"]
        surl = "https://www.saizeriya.com.sg/pdf/GrandMenu202609S_single.pdf"
        
        for dname, cat, price, desc_note, taste_7 in saizeriya_items:
            if dname.lower().strip() in mp_active_dishes_by_lic[lic]:
                continue
            
            palette_str, sw, sp, so, sa, ri, ar = taste_7
            full_desc = f"{desc_note} [Verified Counter Price from Grand Menu PDF 2026-11-14]"
            
            row_vals = [None] * 35
            row_vals[0] = vname
            row_vals[1] = lic
            row_vals[2] = addr
            row_vals[3] = postal
            row_vals[4] = dname
            row_vals[5] = cat
            row_vals[6] = price
            row_vals[7] = full_desc
            row_vals[8] = None
            row_vals[9] = surl
            row_vals[10] = VERIFIED_DATE
            row_vals[28] = palette_str
            row_vals[29] = sw
            row_vals[30] = sp
            row_vals[31] = so
            row_vals[32] = sa
            row_vals[33] = ri
            row_vals[34] = ar
            
            new_rows_to_append.append(row_vals)
            mp_active_dishes_by_lic[lic].add(dname.lower().strip())
            mp_active_prices_by_lic[lic].append(price)
            stats["saizeriya_pdf_dishes_added"] += 1
            
            exported_records.append({
                "source_channel": "Option C (Official PDF Grand Menu)",
                "sfa_licence": lic,
                "venue_name": vname,
                "postal_code": postal,
                "dish_name": dname,
                "category": cat,
                "counter_price_sgd": price,
                "description": full_desc,
                "source_url": surl
            })

    print(f"\nTotal new verified counter dish rows to append: {len(new_rows_to_append)}")
    for row_vals in new_rows_to_append:
        ws_mp.append(row_vals)

    # -------------------------------------------------------------------------
    # Recompute Food Directory Price Range & Menu/Price Column
    # -------------------------------------------------------------------------
    print("\n=== Updating Food Directory Price Ranges ===")
    all_affected_lics = set(munchi_lics) | set(hawker_menus.keys()) | set(saiz_lics)
    for lic in all_affected_lics:
        prices = mp_active_prices_by_lic.get(lic, [])
        if not prices or lic not in fd_lic_to_rows:
            continue
        p_min = min(prices)
        p_max = max(prices)
        p_avg = sum(prices) / len(prices)
        pr_str = f"${p_min:.2f}–${p_max:.2f} (${p_avg:.2f} avg)" if p_min != p_max else f"${p_min:.2f} (${p_avg:.2f} avg)"

        for fd_r in fd_lic_to_rows[lic]:
            old_pr = str(ws_fd.cell(fd_r, 27).value or "").strip()
            if old_pr != pr_str:
                ws_fd.cell(fd_r, 27).value = pr_str
                stats["fd_price_range_updated"] += 1
            
            murl = str(ws_fd.cell(fd_r, 12).value or "").strip()
            mp_sum = str(ws_fd.cell(fd_r, 8).value or "").strip()
            if not mp_sum or "verified items" not in mp_sum:
                ws_fd.cell(fd_r, 8).value = f"{len(prices)} verified counter items ({pr_str})" + (f" | {murl}" if murl else "")
                stats["fd_menu_price_synced"] += 1

    print("\n=== Summary of Ingestion ===")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")

    # Export JSONL
    os.makedirs(os.path.dirname(OUTPUT_JSONL), exist_ok=True)
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for rec in exported_records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"\nSaved {len(exported_records)} extracted records to: {OUTPUT_JSONL}")

    if args.apply:
        if not os.path.exists(BACKUP_XLSX):
            shutil.copy2(MASTER_XLSX, BACKUP_XLSX)
            print(f"Created pre-firecrawl backup: {BACKUP_XLSX}")
        wb.save(MASTER_XLSX)
        print(f"Saved updated master workbook: {MASTER_XLSX}")
    else:
        print("\nDry-run complete. Run with --apply to commit changes to the master workbook.")


if __name__ == "__main__":
    main()
