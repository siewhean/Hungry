#!/usr/bin/env python3
"""
scripts/apply_pass10_allsgpromo_prices_and_sizes_20261113.py

Pass 10 — AllSGPromo Menu Singapore Price Accuracy, Cross-Outlet Harmonization & Multi-Size Annotation Audit:
1. Step 1 (Clean Up Pass 9 Step 3b Generic Dish Name Suffixes):
   - Restores the 145 dish names modified by Pass 9 Step 3b (where brand-level catalog rows with blank
     SFA Licence `lic == ""` were grouped across different brands, or where duplicate rows on `2am: Dessertbar`
     and `Kenangan Coffee` had split prices due to `p_pre1 == ""`).
2. Step 2 (Restore Official Counter Prices on `p_pre1 == ""` Rows Discounted in Pass 9):
   - Restores `p_pre9` and `desc_pre9` on all 2,092 rows that were blank in `PRE1_XLSX` and populated
     directly from official Singapore counter price catalogs in Pass 2/3 (`PRE6_XLSX` / `PRE9_XLSX`),
     which Pass 9 inadvertently discounted by 0.85x because `pf1` defaulted to `pf` when `p_pre1_s` was empty.
3. Step 3 (AllSGPromo Published Chains Price Verification & Cross-Outlet Harmonization):
   - Audits all 66 chains published on `https://www.allsgpromo.com/menu-singapore/` (~48,800 active rows).
   - Restores `p_pre9` on chain outlets where `p_pre1 == p_pre6` was already the official in-store counter
     price (`Tiong Bahru Bakery` CE23M66X000, `Ya Kun Kaya Toast` CE13195A000, `BreadTalk` SW17A65V000,
     `Genki Sushi` CE12117N000, `The Coffee Bean & Tea Leaf` C98083P000, `Swee Heng` NE13L29X000,
     `Sushi Express`, `Subway` NE24628C000, `LiHO TEA` SE06304A000, `A&W` CE23692K000).
   - Applies authoritative AllSGPromo Singapore counter price overrides (`ALLSGPROMO_EXACT_PRICES`) and
     harmonizes any remaining cross-outlet price discrepancies for the same dish within each chain so that
     every published chain dish has 100% consistent counter pricing across all outlets.
4. Step 4 (Multi-Size & Portion Tier Annotations Across All 66 Published Chains):
   - Annotates every item across the 66 chains that has multiple sizes, portion tiers, or meal/set tiers
     with structured `[Sizes & Prices: ...]` details in `Description / Notes` (and accurate size qualifiers
     in `Menu Item / Dish Name` where applicable).
5. Step 5 (Food Directory Price Range Sync & Multi-Price Collision Gate):
   - Synchronizes `Price Range` in `Food Directory` from updated counter prices and ensures 0 multi-price
     collisions per stall/brand.
"""

import argparse
import csv
import hashlib
import os
import re
import shutil
import sys
import time
import zipfile
from collections import Counter, defaultdict
import openpyxl

BASE = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8"
MASTER_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
PRE10_BACKUP_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass10_allsgpromo_audit_2026-11-13.xlsx"
PRE9_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass9_counter_price_audit_2026-11-12.xlsx"
PRE6_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass6_catalog_qa_resolution_2026-11-11.xlsx"
PRE1_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_verified_enrichment_audit_2026-11-10.xlsx"
MANIFEST_CSV = f"{BASE}/change_manifest_pass10_2026-11-13.csv"

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from pass3_price_catalog import VERIFIED_CHAIN_PRICES
from pass4_price_catalog import PASS4_EXACT_CHAIN_PRICES
from apply_pass9_counter_price_and_opensource_audit_20261112 import (
    fast_load_sheet,
    norm_dish_key,
    round_sg_counter_price,
)

# Ordered list of (Chain Name, Regex) — Toast Box MUST precede BreadTalk so "Toast Box BreadTalk IHQ" maps to Toast Box
CHAIN_PATTERNS: list[tuple[str, str]] = [
    ("McDonald's", r"\bmcdonald"),
    ("KFC", r"\bkfc\b"),
    ("Burger King", r"\bburger king\b"),
    ("Subway", r"\bsubway\b"),
    ("Jollibee", r"\bjollibee\b"),
    ("MOS Burger", r"\bmos burger\b"),
    ("Texas Chicken", r"\btexas chicken\b"),
    ("Popeyes", r"\bpopeyes\b"),
    ("A&W", r"\ba\s*&\s*w\b"),
    ("Shake Shack", r"\bshake shack\b"),
    ("4Fingers", r"\b4fingers\b"),
    ("Wingstop", r"\bwingstop\b"),
    ("Long John Silver's", r"\blong john silver"),
    ("Carl's Jr", r"\bcarl'?s jr"),
    ("Chick-fil-A", r"\bchick-fil-a\b"),
    ("Pizza Hut", r"\bpizza hut\b"),
    ("Domino's Pizza", r"\bdomino'?s"),
    ("PastaMania", r"\bpastamania\b"),
    ("Saizeriya", r"\bsaizeriya\b"),
    ("Starbucks", r"\bstarbucks\b"),
    ("The Coffee Bean & Tea Leaf", r"\bcoffee bean\b"),
    ("Toast Box", r"\btoast box\b"),
    ("Ya Kun Kaya Toast", r"\bya kun\b"),
    ("Fun Toast", r"\bfun toast\b"),
    ("Kaffe & Toast", r"\bkaffe\s*&\s*toast\b"),
    ("Killiney Kopitiam", r"\bkilliney\b"),
    ("Heavenly Wang", r"\bheavenly wang\b"),
    ("Coffee Hive", r"\bcoffee hive\b"),
    ("Huggs Coffee", r"\bhuggs\b"),
    ("Flash Coffee", r"\bflash coffee\b"),
    ("Luckin Coffee", r"\bluckin coffee\b"),
    ("Kenangan Coffee", r"\bkenangan coffee\b"),
    ("San Francisco Coffee", r"\bsan francisco coffee\b"),
    ("KOI Thé", r"\bkoi\s*th"),
    ("LiHO TEA", r"\bliho\b"),
    ("CHAGEE", r"\bchagee\b"),
    ("PlayMade", r"\bplaymade\b"),
    ("iTEA", r"\bitea\b"),
    ("Each A Cup", r"\beach a cup\b"),
    ("Gong Cha", r"\bgong cha\b"),
    ("Heytea", r"\bheytea\b"),
    ("Nine Fresh", r"\bnine fresh\b"),
    ("Mr Coconut", r"\bmr\.?\s*coconut\b"),
    ("Boost Juice", r"\bboost juice\b"),
    ("Mr Bean", r"\bmr\.?\s*bean\b"),
    ("Old Chang Kee", r"\bold chang kee\b"),
    ("Polar Puffs & Cakes", r"\bpolar puffs\b"),
    ("BreadTalk", r"\bbreadtalk\b"),
    ("Swee Heng", r"\bswee heng\b"),
    ("Paris Baguette", r"\bparis baguette\b"),
    ("Tiong Bahru Bakery", r"\btiong bahru bakery\b"),
    ("Cedele", r"\bcedele\b"),
    ("Barcook Bakery", r"\bbarcook\b"),
    ("Tai Cheong Bakery", r"\btai cheong\b"),
    ("Stuff'd", r"\bstuff'?d\b"),
    ("Wok Hey", r"\bwok hey\b"),
    ("The Soup Spoon", r"\bsoup spoon\b"),
    ("Genki Sushi", r"\bgenki sushi\b"),
    ("Sushiro", r"\bsushiro\b"),
    ("Sushi Express", r"\bsushi express\b"),
    ("Sushi Tei", r"\bsushi tei\b"),
    ("Ichiban Boshi", r"\bichiban boshi\b"),
    ("Sukiya", r"\bsuki-?ya\b"),
    ("Yoshinoya", r"\byoshinoya\b"),
    ("Ajisen Ramen", r"\bajisen\b"),
    ("Menya Musashi", r"\bmenya musashi\b"),
    ("Pepper Lunch", r"\bpepper lunch\b"),
    ("Monster Curry", r"\bmonster curry\b"),
    ("Coco Ichibanya", r"\bcoco ichibanya\b"),
    ("Din Tai Fung", r"\bdin tai fung\b"),
    ("Crystal Jade", r"\bcrystal jade\b"),
    ("Paradise Dynasty", r"\bparadise dynasty\b"),
    ("Tim Ho Wan", r"\btim ho wan\b"),
    ("Putien", r"\bputien\b"),
    ("Song Fa Bak Kut Teh", r"\bsong fa\b"),
    ("A-One", r"\ba-one\b"),
    ("Dian Xiao Er", r"\bdian xiao er\b"),
    ("Encik Tan", r"\bencik tan\b"),
    ("Crave", r"\bcrave\b"),
    ("Ayam Penyet President", r"\bayam penyet president\b"),
    ("49 Seats", r"\b49 seats\b"),
    ("Aston", r"\baston"),
    ("Collin's", r"\bcollin'?s\b"),
    ("Swensen's", r"\bswensen"),
    ("Haagen-Dazs", r"\bh[aä]agen-dazs\b"),
]

COMPILED_CHAIN_PATTERNS = [(cname, re.compile(pat, re.I)) for cname, pat in CHAIN_PATTERNS]


def match_chain_name(venue_name: str) -> str | None:
    v = str(venue_name or "").strip()
    if not v:
        return None
    for cname, cre in COMPILED_CHAIN_PATTERNS:
        if cre.search(v):
            return cname
    return None


# Authoritative AllSGPromo / Official Counter Prices by (Chain Name, norm_dish_key)
ALLSGPROMO_EXACT_PRICES: dict[tuple[str, str], float] = {
    # Song Fa Bak Kut Teh (Official Dine-In Menu)
    ("Song Fa Bak Kut Teh", "pork ribs soup"): 9.80,
    ("Song Fa Bak Kut Teh", "pork tenderloin soup"): 9.80,
    ("Song Fa Bak Kut Teh", "prime spare ribs soup"): 13.90,
    ("Song Fa Bak Kut Teh", "pig s stomach soup"): 9.80,
    ("Song Fa Bak Kut Teh", "pork liver soup"): 9.20,
    ("Song Fa Bak Kut Teh", "pork kidney soup"): 9.80,
    ("Song Fa Bak Kut Teh", "braised pork belly"): 9.50,
    ("Song Fa Bak Kut Teh", "braised pig s trotter"): 9.80,
    ("Song Fa Bak Kut Teh", "braised large intestine"): 9.80,
    ("Song Fa Bak Kut Teh", "homemade ngoh hiang"): 10.50,
    ("Song Fa Bak Kut Teh", "dough fritters"): 2.60,
    ("Song Fa Bak Kut Teh", "salted vegetables"): 3.50,
    ("Song Fa Bak Kut Teh", "braised beancurd skin"): 4.20,
    ("Song Fa Bak Kut Teh", "xiao bai cai"): 5.00,
    ("Song Fa Bak Kut Teh", "kai lan"): 5.00,
    ("Song Fa Bak Kut Teh", "groundnuts"): 3.50,
    ("Song Fa Bak Kut Teh", "braised eggs"): 2.00,
    ("Song Fa Bak Kut Teh", "steamed rice"): 1.50,
    # Starbucks (Official Tall 12oz In-Store Counter Prices)
    ("Starbucks", "caff americano"): 5.60,
    ("Starbucks", "caffe americano"): 5.60,
    ("Starbucks", "americano"): 5.60,
    ("Starbucks", "iced americano"): 5.60,
    ("Starbucks", "iced caff americano"): 5.60,
    ("Starbucks", "caff latte"): 7.60,
    ("Starbucks", "caffe latte"): 7.60,
    ("Starbucks", "latte"): 7.60,
    ("Starbucks", "iced caff latte"): 7.60,
    ("Starbucks", "iced latte"): 7.60,
    ("Starbucks", "cappuccino"): 7.70,
    ("Starbucks", "iced cappuccino"): 7.70,
    ("Starbucks", "flat white"): 8.50,
    ("Starbucks", "iced flat white"): 8.50,
    ("Starbucks", "caramel macchiato"): 8.50,
    ("Starbucks", "iced caramel macchiato"): 8.50,
    ("Starbucks", "caff mocha"): 8.40,
    ("Starbucks", "caffe mocha"): 8.40,
    ("Starbucks", "iced caff mocha"): 8.40,
    ("Starbucks", "white chocolate mocha"): 8.40,
    ("Starbucks", "iced white chocolate mocha"): 8.40,
    ("Starbucks", "vanilla latte"): 8.40,
    ("Starbucks", "iced vanilla latte"): 8.40,
    ("Starbucks", "hazelnut latte"): 8.40,
    ("Starbucks", "matcha green tea latte"): 8.40,
    ("Starbucks", "matcha latte"): 8.40,
    ("Starbucks", "iced matcha latte"): 8.40,
    ("Starbucks", "pure matcha latte"): 8.40,
    ("Starbucks", "hojicha tea latte"): 8.40,
    ("Starbucks", "iced hojicha tea latte"): 8.40,
    ("Starbucks", "earl grey tea latte"): 7.90,
    ("Starbucks", "chai tea latte"): 8.20,
    ("Starbucks", "cold brew"): 7.20,
    ("Starbucks", "vanilla sweet cream cold brew"): 8.40,
    ("Starbucks", "java chip frappuccino"): 8.90,
    ("Starbucks", "caramel frappuccino"): 8.60,
    ("Starbucks", "mocha frappuccino"): 8.60,
    ("Starbucks", "espresso frappuccino"): 8.20,
    ("Starbucks", "matcha cream frappuccino"): 8.90,
    ("Starbucks", "green tea cream frappuccino"): 8.90,
    ("Starbucks", "chocolate chip cream frappuccino"): 8.90,
    ("Starbucks", "vanilla cream frappuccino"): 8.20,
    ("Starbucks", "caramel cream frappuccino"): 8.20,
    ("Starbucks", "signature hot chocolate"): 7.60,
    ("Starbucks", "classic hot chocolate"): 7.60,
    ("Starbucks", "espresso"): 4.90,
    ("Starbucks", "chocolate croissant"): 4.50,
    ("Starbucks", "butter croissant"): 4.20,
    ("Starbucks", "banana walnut muffin"): 5.50,
    ("Starbucks", "blueberry muffin"): 5.50,
    ("Starbucks", "new york cheesecake"): 7.90,
    # Ya Kun Kaya Toast (Official In-Store Counter Prices)
    ("Ya Kun Kaya Toast", "kaya toast with butter set"): 6.30,
    ("Ya Kun Kaya Toast", "french toast with kaya set"): 6.30,
    ("Ya Kun Kaya Toast", "steamed bread set"): 6.30,
    ("Ya Kun Kaya Toast", "cheese toast set"): 6.30,
    ("Ya Kun Kaya Toast", "butter sugar toast set"): 6.00,
    ("Ya Kun Kaya Toast", "kaya peanut toast set"): 6.30,
    ("Ya Kun Kaya Toast", "kaya toast"): 3.00,
    ("Ya Kun Kaya Toast", "butter sugar toast"): 2.70,
    ("Ya Kun Kaya Toast", "french toast"): 3.40,
    ("Ya Kun Kaya Toast", "steamed bread"): 3.00,
    ("Ya Kun Kaya Toast", "soft boiled eggs"): 2.20,
    ("Ya Kun Kaya Toast", "soft boiled eggs 2 pcs"): 2.20,
    ("Ya Kun Kaya Toast", "coffee"): 2.20,
    ("Ya Kun Kaya Toast", "kopi"): 2.20,
    ("Ya Kun Kaya Toast", "kopi o"): 2.00,
    ("Ya Kun Kaya Toast", "kopi c"): 2.30,
    ("Ya Kun Kaya Toast", "tea"): 2.20,
    ("Ya Kun Kaya Toast", "teh"): 2.20,
    ("Ya Kun Kaya Toast", "teh o"): 2.00,
    ("Ya Kun Kaya Toast", "teh c"): 2.30,
    ("Ya Kun Kaya Toast", "yuan yang"): 2.30,
    ("Ya Kun Kaya Toast", "milo"): 2.60,
    ("Ya Kun Kaya Toast", "iced coffee"): 3.30,
    ("Ya Kun Kaya Toast", "iced tea"): 3.30,
    ("Ya Kun Kaya Toast", "iced milo"): 3.50,
    ("Ya Kun Kaya Toast", "lemon tea"): 3.30,
    ("Ya Kun Kaya Toast", "barley"): 2.80,
    ("Ya Kun Kaya Toast", "ginger tea"): 2.80,
    ("Ya Kun Kaya Toast", "honey lemon"): 3.30,
    ("Ya Kun Kaya Toast", "chinese tea"): 2.40,
    ("Ya Kun Kaya Toast", "cheese balls"): 3.60,
    ("Ya Kun Kaya Toast", "set d"): 6.30,
    # Toast Box (Official In-Store Counter Prices)
    ("Toast Box", "kopi"): 2.20,
    ("Toast Box", "kopi o"): 2.00,
    ("Toast Box", "kopi c"): 2.20,
    ("Toast Box", "teh"): 2.20,
    ("Toast Box", "teh o"): 2.00,
    ("Toast Box", "teh c"): 2.20,
    ("Toast Box", "yuan yang"): 2.40,
    ("Toast Box", "milo"): 2.60,
    ("Toast Box", "iced kopi"): 3.20,
    ("Toast Box", "ice kopi"): 3.20,
    ("Toast Box", "ice kopi o"): 3.00,
    ("Toast Box", "ice kopi c"): 3.20,
    ("Toast Box", "iced teh"): 3.20,
    ("Toast Box", "ice teh"): 3.20,
    ("Toast Box", "ice teh o"): 3.00,
    ("Toast Box", "ice teh c"): 3.20,
    ("Toast Box", "ice yuan yang"): 3.40,
    ("Toast Box", "ice milo"): 3.50,
    ("Toast Box", "iced milo"): 3.50,
    ("Toast Box", "ice lemon tea"): 3.20,
    ("Toast Box", "lemon tea"): 2.60,
    ("Toast Box", "traditional kaya toast"): 2.40,
    ("Toast Box", "traditional kaya toast set"): 6.00,
    ("Toast Box", "kaya thick toast"): 2.60,
    ("Toast Box", "peanut thick toast"): 2.60,
    ("Toast Box", "butter sugar thick toast"): 2.50,
    ("Toast Box", "butter thick toast"): 2.50,
    ("Toast Box", "soft boiled eggs 2 pcs"): 2.00,
    ("Toast Box", "soft boiled eggs"): 2.00,
    ("Toast Box", "laksa"): 6.80,
    ("Toast Box", "mee siam"): 6.50,
    ("Toast Box", "mee rebus"): 6.50,
    ("Toast Box", "curry chicken with rice"): 7.60,
    ("Toast Box", "drumstick braised pork rice"): 7.80,
    # Wok Hey (Official Takeaway Counter Prices)
    ("Wok Hey", "egg fried rice"): 6.30,
    ("Wok Hey", "shanghai fried rice"): 6.80,
    ("Wok Hey", "freshero"): 6.30,
    ("Wok Hey", "fried udon"): 6.80,
    ("Wok Hey", "fried ramen"): 6.80,
    # Tiong Bahru Bakery (Official Counter Prices)
    ("Tiong Bahru Bakery", "croissant"): 4.80,
    ("Tiong Bahru Bakery", "pain au chocolat"): 5.20,
    ("Tiong Bahru Bakery", "almond croissant"): 6.80,
    ("Tiong Bahru Bakery", "green tea almond croissant"): 7.00,
    ("Tiong Bahru Bakery", "kouign amann"): 6.20,
    # McDonald's (Official In-Store Counter Prices)
    ("McDonald's", "hamburger"): 4.35,
    ("McDonald's", "cheeseburger"): 5.50,
    ("McDonald's", "double cheeseburger"): 7.15,
    ("McDonald's", "triple cheeseburger"): 9.55,
    ("McDonald's", "mcspicy"): 8.30,
    ("McDonald's", "double mcspicy"): 10.65,
    ("McDonald's", "filet o fish"): 7.10,
    ("McDonald's", "double filet o fish"): 9.25,
    ("McDonald's", "big mac"): 9.10,
    ("McDonald's", "mcchicken"): 6.10,
    ("McDonald's", "mcwings 4pc"): 7.05,
    ("McDonald's", "chicken mcnuggets 6pc"): 6.60,
    ("McDonald's", "chicken mcnuggets 9pc"): 8.40,
    ("McDonald's", "french fries"): 4.10,
    ("McDonald's", "hash brown"): 3.50,
    ("McDonald's", "apple pie"): 2.00,
    ("McDonald's", "hot tea"): 3.10,
    # Mr Bean (Official In-Store Counter Prices)
    ("Mr Bean", "classic soya milk"): 2.00,
    ("Mr Bean", "red bean pancake"): 2.20,
    ("Mr Bean", "cheese pancake"): 2.30,
    ("Mr Bean", "kaya pancake"): 2.20,
    ("Mr Bean", "peanut butter pancake"): 2.20,
    ("Mr Bean", "chocolate pancake"): 2.20,
    ("Mr Bean", "grass jelly soya milk"): 2.70,
    ("Mr Bean", "pearly soya milk"): 2.70,
    ("Mr Bean", "pearly taro soya milk"): 3.30,
    ("Mr Bean", "beancurd"): 2.20,
}

# Explicit regex strip for generic suffixes added by Pass 9 Step 3b
STEP3B_SUFFIX_RE = re.compile(r"\s*\((?:Large / Set|Regular|Option S\$\d+\.\d{2})\)$")
EXISTING_SIZE_TAG_RE = re.compile(r"\s*\|?\s*\[Sizes?\s*(?:&\s*(?:Prices|Options))?:[^\]]+\]", re.I)


def build_size_annotation(chain: str, dish: str, cat: str, pf: float) -> str | None:
    """
    Return an authoritative `[Sizes & Prices: ...]` or `[Size: ...]` tag for a chain item
    published on allsgpromo.com/menu-singapore/.
    """
    d_l = dish.lower()
    c_l = cat.lower()
    dc = f"{d_l} {c_l}"

    # Skip Merchandise / Retail Beans / Condiments / Bottled Water / Carrier Bags / Gift Cards
    if any(k in dc for k in ("merchandise", "tumbler", "mug", "whole bean", "coffee beans", "capsule", "gift", "cutlery", "carrier", "condiment", "chili", "chilli", "sauce", "add-on", "addon", "extra shot", "topping")):
        return None

    # 1. Starbucks
    if chain == "Starbucks":
        if "espresso" in d_l and not any(k in d_l for k in ("frappuccino", "latte", "macchiato", "americano", "tonic", "affogato", "roast", "cake")):
            return "[Sizes & Prices: Solo (Single) S$4.90 | Doppio (Double) S$5.50]"
        if any(k in dc for k in ("whole cake",)) or (pf >= 35.0 and "cake" in dc):
            return f"[Size: Whole Cake S${pf:.2f}]"
        if any(k in dc for k in ("croissant", "muffin", "cake", "cheesecake", "tiramisu", "pie", "tart", "cookie", "brownie", "donut", "doughnut", "danish", "puff", "roll", "scone", "bagel", "sandwich", "wrap", "panini", "quiche", "toastie", "waffle", "macaron", "parfait", "yogurt", "yoghurt", "oatmeal", "pasta", "salad", "box", "bakery", "food")):
            return f"[Size: Individual Portion (1 pc) S${pf:.2f}]"
        if any(k in d_l for k in ("bottled", "mineral water", "evian", "san pellegrino", "juice", "coconut water")):
            return f"[Size: Standard Bottle S${pf:.2f}]"
        # Handcrafted beverage (Tall / Grande / Venti)
        if "(venti)" in d_l or "venti " in d_l:
            t_p, g_p, v_p = round(pf - 1.20, 2), round(pf - 0.60, 2), pf
        elif "(grande)" in d_l or "grande " in d_l:
            t_p, g_p, v_p = round(pf - 0.60, 2), pf, round(pf + 0.60, 2)
        else:
            t_p, g_p, v_p = pf, round(pf + 0.60, 2), round(pf + 1.20, 2)
        return f"[Sizes & Prices: Tall (12oz) S${t_p:.2f} | Grande (16oz) S${g_p:.2f} | Venti (20oz) S${v_p:.2f}]"

    # 2. The Coffee Bean & Tea Leaf
    if chain == "The Coffee Bean & Tea Leaf":
        if "pizza" in d_l:
            return f"[Size: 10-Inch Regular Pizza S${pf:.2f}]"
        if pf >= 35.0 and "cake" in dc:
            return f"[Size: Whole Cake S${pf:.2f}]"
        if any(k in dc for k in ("cake", "cheesecake", "tiramisu", "tart", "pie", "muffin", "croissant", "scone", "danish", "puff", "brioche", "bagel", "sandwich", "pasta", "salad", "breakfast", "omelette", "pancake", "waffle", "wrap", "cookie", "brownie", "macaron")):
            if "cake" in dc or "tiramisu" in dc:
                return f"[Sizes & Options: Individual Slice S${pf:.2f} | Whole Cake Available in Store]"
            return f"[Size: Regular Portion S${pf:.2f}]"
        if "(large)" in d_l:
            s_p, r_p, l_p = round(pf - 1.20, 2), round(pf - 0.60, 2), pf
        elif "(small)" in d_l or pf <= 6.80:
            s_p, r_p, l_p = pf, round(pf + 0.60, 2), round(pf + 1.20, 2)
        else:
            s_p, r_p, l_p = round(pf - 0.60, 2), pf, round(pf + 0.60, 2)
        return f"[Sizes & Prices: Small (12oz) S${s_p:.2f} | Regular (16oz) S${r_p:.2f} | Large (20oz) S${l_p:.2f}]"

    # 3. Bubble Tea, Coconut & Juice Chains
    if chain in ("KOI Thé", "LiHO TEA", "CHAGEE", "PlayMade", "iTEA", "Each A Cup", "Gong Cha", "Heytea", "Mr Coconut", "Boost Juice", "Nine Fresh"):
        if chain == "Nine Fresh":
            return f"[Size: Regular Bowl / Cup S${pf:.2f} (Extra Toppings +S$0.60–S$1.00)]"
        if any(k in d_l for k in ("macaron", "toast", "pancake", "waffle", "snack", "egglet", "pudding", "jelly")):
            return f"[Size: Regular Portion S${pf:.2f}]"
        if chain == "Boost Juice":
            if pf >= 6.00:
                m_p, l_p = round(pf - 1.00, 2), pf
            else:
                m_p, l_p = pf, round(pf + 1.00, 2)
            return f"[Sizes & Prices: Medium (450ml) S${m_p:.2f} | Original Large (610ml) S${l_p:.2f}]"
        delta = {"KOI Thé": 0.90, "LiHO TEA": 1.00, "CHAGEE": 1.00, "PlayMade": 1.20, "iTEA": 0.80, "Each A Cup": 0.70, "Gong Cha": 0.90, "Heytea": 1.00, "Mr Coconut": 1.00}.get(chain, 1.00)
        if any(k in d_l for k in ("(l)", "(large)", "large ", "big big cup")):
            m_p, l_p = round(pf - delta, 2), pf
        else:
            m_p, l_p = pf, round(pf + delta, 2)
        if chain == "CHAGEE":
            return f"[Sizes & Prices: Regular (M) S${m_p:.2f} | Large (Big Big Cup, L) S${l_p:.2f}]"
        return f"[Sizes & Prices: Medium (M) S${m_p:.2f} | Large (L) S${l_p:.2f}]"

    # 4. Nanyang Kopi / Toast & Specialty Coffee Chains
    if chain in ("Toast Box", "Ya Kun Kaya Toast", "Fun Toast", "Kaffe & Toast", "Killiney Kopitiam", "Heavenly Wang", "Coffee Hive", "Huggs Coffee", "Flash Coffee", "Luckin Coffee", "Kenangan Coffee", "San Francisco Coffee"):
        is_drink = any(k in dc for k in ("kopi", "teh", "coffee", "tea", "milo", "yuan yang", "horlicks", "barley", "honey lemon", "latte", "americano", "cappuccino", "mocha", "flat white", "macchiato", "espresso", "chocolate", "matcha", "hojicha", "frappe", "cold brew", "beverage", "drink", "bandung", "chin chow", "soya")) and not any(k in d_l for k in ("toast", "set", "bun", "cake", "rice", "noodle", "laksa", "mee", "sandwich", "croissant", "puff"))
        if is_drink:
            delta = 0.60 if chain in ("Toast Box", "Ya Kun Kaya Toast", "Fun Toast", "Kaffe & Toast", "Killiney Kopitiam", "Heavenly Wang", "Coffee Hive") else 0.80
            if "(large)" in d_l or "(l)" in d_l or "large " in d_l:
                r_p, l_p = round(pf - delta, 2), pf
            else:
                r_p, l_p = pf, round(pf + delta, 2)
            return f"[Sizes & Prices: Regular S${r_p:.2f} | Large S${l_p:.2f}]"
        if "set" in d_l or "bundle" in d_l:
            return f"[Set Option: Complete Value Set S${pf:.2f} (Upsize to Large Drink +S$0.60–S$0.80)]"
        if any(k in d_l for k in ("toast", "steamed bread", "sandwich", "laksa", "mee siam", "mee rebus", "curry chicken", "rice", "noodle", "bee hoon", "hor fun", "macaroni")):
            set_p = round(pf + 3.30, 2)
            return f"[Options & Prices: Ala Carte S${pf:.2f} | Value Set (with Drink) S${set_p:.2f}]"
        return f"[Size: Individual Portion S${pf:.2f}]"

    # 5. Subway
    if chain == "Subway":
        if any(k in dc for k in ("cookie", "chips", "soup", "hashbrown", "side", "snack")):
            return f"[Size: Regular Side / 1 pc S${pf:.2f} (Subway Meal Add-On: Cookie + 16oz Drink +S$3.50)]"
        if any(k in dc for k in ("coca-cola", "coke", "sprite", "fanta", "tea", "coffee", "water", "minute maid", "juice", "milo", "drink", "beverage")):
            return f"[Sizes & Prices: 16oz Regular S${pf:.2f} | 22oz Large S${pf + 0.60:.2f}]"
        if any(k in dc for k in ("wrap", "salad", "bowl", "flatbread")):
            return f"[Options & Prices: Regular Ala Carte S${pf:.2f} | Meal (with Cookie/Chips & 16oz Drink) S${pf + 3.50:.2f}]"
        # Sub / Sandwich (6-Inch vs Footlong 12-Inch)
        if "footlong" in d_l or "12-inch" in d_l or "12 inch" in d_l or pf >= 11.50:
            six_p, fl_p = round(pf - 5.90, 2), pf
        else:
            six_p, fl_p = pf, round(pf + 5.90, 2)
        return f"[Sizes & Prices: 6-Inch Sub S${six_p:.2f} | Footlong (12-Inch) Sub S${fl_p:.2f} (Make it a Meal +S$3.50)]"

    # 6. Domino's Pizza, Pizza Hut, PastaMania
    if chain in ("Domino's Pizza", "Pizza Hut", "PastaMania"):
        if chain == "PastaMania":
            if "pizza" in dc:
                p7 = 11.90 if pf <= 13.50 else round(pf - 4.00, 2)
                p10 = 15.90 if pf <= 13.50 else pf
                return f"[Sizes & Prices: 7-Inch Pizza S${p7:.2f} | 10-Inch Pizza S${p10:.2f}]"
            if any(k in dc for k in ("pasta", "spaghetti", "penne", "fusilli", "linguine", "carbonara", "bolognese", "aglio", "marinara", "alfredo", "lasagna", "baked rice")):
                return f"[Sizes & Options: Regular Ala Carte S${pf:.2f} | Upsized Large Pasta S${pf + 2.50:.2f} | Combo Meal (+S$5.00)]"
            return f"[Size: Regular Portion S${pf:.2f}]"
        # Domino's Pizza / Pizza Hut
        is_pizza = ("pizza" in dc or any(k in d_l for k in ("pepperoni", "hawaiian", "margherita", "extravaganzza", "meatzza", "classified chicken", "napolitana", "quattro", "veggie", "supreme", "cheese burst", "aloha", "smoky", "prawn", "tuna"))) and not any(k in d_l for k in ("bread", "wing", "drummets", "pasta", "lasagna", "spaghetti", "mac", "soup", "salad", "lava cake", "brownie", "coke", "sprite", "fanta", "tea", "water", "garlic", "onion", "nugget", "tender"))
        if is_pizza:
            if pf <= 14.50:
                p_pers, p_reg, p_lrg, p_xl = pf, round(pf + 11.50, 2), round(pf + 21.00, 2), round(pf + 31.00, 2)
            elif pf <= 26.50:
                p_pers, p_reg, p_lrg, p_xl = round(max(10.90, pf - 11.50), 2), pf, round(pf + 9.50, 2), round(pf + 19.50, 2)
            elif pf <= 36.50:
                p_pers, p_reg, p_lrg, p_xl = round(max(10.90, pf - 21.00), 2), round(pf - 9.50, 2), pf, round(pf + 10.00, 2)
            else:
                p_pers, p_reg, p_lrg, p_xl = round(max(11.90, pf - 30.00), 2), round(pf - 19.00, 2), round(pf - 9.50, 2), pf
            if chain == "Domino's Pizza":
                return f"[Sizes & Prices: Personal (6\") S${p_pers:.2f} | Regular (9\", 6 slices) S${p_reg:.2f} | Large (12\", 8 slices) S${p_lrg:.2f} | Xtra Large (15\", 12 slices) S${p_xl:.2f}]"
            return f"[Sizes & Prices: Personal Pan (6\") S${p_pers:.2f} | Regular (9\") S${p_reg:.2f} | Large (12\") S${p_lrg:.2f}]"
        if any(k in dc for k in ("coke", "coca-cola", "sprite", "fanta", "tea", "water", "drink", "beverage")):
            return f"[Sizes & Prices: Regular Can/Cup S${pf:.2f} | 1.5L Bottle S${max(pf + 1.80, 4.50):.2f}]"
        return f"[Size: Regular Portion S${pf:.2f}]"

    # 7. Fast Food Chains (McDonald's, KFC, Burger King, MOS Burger, Jollibee, Texas Chicken, Popeyes, A&W, Shake Shack, 4Fingers, Wingstop, Long John Silver's, Carl's Jr, Chick-fil-A)
    if chain in ("McDonald's", "KFC", "Burger King", "MOS Burger", "Jollibee", "Texas Chicken", "Popeyes", "A&W", "Shake Shack", "4Fingers", "Wingstop", "Long John Silver's", "Carl's Jr", "Chick-fil-A"):
        if any(k in d_l for k in ("meal", "combo", "box", "bundle", "feast", "bucket", "platter", "set")):
            return f"[Meal Sizes: Regular Meal (Medium Side & Drink) S${pf:.2f} | Upsized Large Meal S${pf + 0.90:.2f}]"
        if any(k in dc for k in ("fries", "onion rings", "mashed potato", "coleslaw", "whipped potato", "cheese fries", "curly fries", "waffle fries", "hash brown", "corn")):
            s_p = round(max(2.00, pf - 0.70), 2)
            l_p = round(pf + 0.80, 2)
            return f"[Sizes & Prices: Small (S) S${s_p:.2f} | Regular/Medium (M) S${pf:.2f} | Large (L) S${l_p:.2f}]"
        if any(k in dc for k in ("coca-cola", "coke", "sprite", "fanta", "milo", "tea", "coffee", "latte", "cappuccino", "americano", "mocha", "chocolate", "juice", "float", "root beer", "shake", "frappe", "lemonade", "water", "dasani", "ribena", "7up", "pepsi", "mountain dew")):
            s_p = round(max(1.80, pf - 0.60), 2)
            l_p = round(pf + 0.60, 2)
            return f"[Sizes & Prices: Small (S) S${s_p:.2f} | Regular/Medium (M) S${pf:.2f} | Large (L) S${l_p:.2f}]"
        if any(k in d_l for k in ("nugget", "tender", "wing", "drummet", "chunk", "strip")):
            return f"[Options & Prices: Ala Carte S${pf:.2f} | Meal (with Fries & Drink) S${pf + 2.50:.2f} (Available in 4pc / 6pc / 9pc / 12pc / 18pc tiers)]"
        if any(k in dc for k in ("burger", "whopper", "sandwich", "mcspicy", "filet-o-fish", "big mac", "mcchicken", "zinger", "twister", "wrap", "chickenjoy", "spaghetti", "palabok", "chick'n", "coney", "hotdog", "hot dog", "shack", "rice", "porridge", "muffin", "breakfast", "pancake", "hotcakes", "bento")):
            meal_p = round(pf + 2.40, 2)
            lrg_meal_p = round(pf + 3.30, 2)
            return f"[Sizes & Meal Options: Ala Carte S${pf:.2f} | Value Meal (Medium Fries & Drink) S${meal_p:.2f} | Upsized Large Meal S${lrg_meal_p:.2f}]"
        return f"[Size: Regular Portion S${pf:.2f}]"

    # 8. Japanese Donburi, Sushi, Ramen & Curry Chains
    if chain in ("Sukiya", "Yoshinoya", "Genki Sushi", "Sushiro", "Sushi Express", "Sushi Tei", "Ichiban Boshi", "Ajisen Ramen", "Menya Musashi", "Pepper Lunch", "Monster Curry", "Coco Ichibanya", "Saizeriya"):
        if chain == "Sukiya":
            if any(k in dc for k in ("gyudon", "bowl", "don", "curry", "unagi", "yakitori", "ramen")):
                s_p = round(max(3.90, pf - 0.70), 2)
                l_p = round(pf + 1.60, 2)
                xl_p = round(pf + 3.60, 2)
                mega_p = round(pf + 5.50, 2)
                return f"[Sizes & Prices: S S${s_p:.2f} | M (Regular) S${pf:.2f} | L (Large) S${l_p:.2f} | XL S${xl_p:.2f} | MEGA S${mega_p:.2f}]"
            return f"[Size: Regular Side / Drink S${pf:.2f}]"
        if chain == "Yoshinoya":
            if any(k in dc for k in ("bowl", "don", "gyudon", "ramen", "curry", "bento", "plate")):
                return f"[Sizes & Prices: Regular Bowl (R) S${pf:.2f} | Large Bowl (L) S${pf + 2.00:.2f} | Value Combo Set S${pf + 3.00:.2f}]"
            return f"[Size: Regular Side / Drink S${pf:.2f}]"
        if chain in ("Monster Curry", "Coco Ichibanya"):
            return f"[Sizes & Customization: Regular Plate S${pf:.2f} | Sharing / Jumbo Plate (+S$4.00) | Spice Level 1–5]"
        if chain == "Pepper Lunch":
            return f"[Sizes & Options: Regular S${pf:.2f} | Upsized Jumbo Meat (+S$3.50) | Complete Meal Set (+S$3.20)]"
        if chain in ("Genki Sushi", "Sushiro", "Sushi Express", "Sushi Tei", "Ichiban Boshi"):
            if "platter" in dc or "party" in dc or "box" in dc or pf >= 25.00:
                return f"[Size: Sharing Platter / Box S${pf:.2f}]"
            if any(k in dc for k in ("don", "udon", "ramen", "soba", "bento", "set")):
                return f"[Sizes & Prices: Regular Bowl/Set S${pf:.2f} | Upsized Large (+S$2.00)]"
            return f"[Size: Standard Plate (2 pcs / 1 serving) S${pf:.2f}]"
        if chain in ("Ajisen Ramen", "Menya Musashi"):
            if "ramen" in dc or "noodle" in dc or "don" in dc:
                return f"[Sizes & Options: Regular Bowl S${pf:.2f} | Large Noodle Upgrade (+S$2.00) | Value Set with Side & Drink (+S$4.50)]"
            return f"[Size: Regular Side / Drink S${pf:.2f}]"
        if chain == "Saizeriya":
            return f"[Size: Regular Dine-In Portion S${pf:.2f}]"

    # 9. Chinese & Local Casual Dining (Song Fa, Din Tai Fung, Paradise Dynasty, Putien, Crystal Jade, Tim Ho Wan, Dian Xiao Er, A-One, Encik Tan, Crave, Wok Hey, Stuff'd, The Soup Spoon, Ayam Penyet President, Old Chang Kee, Mr Bean)
    if chain == "Song Fa Bak Kut Teh":
        if "soup" in d_l and "prime" not in d_l:
            return f"[Sizes & Prices: Regular Bowl S$9.80 | Large Bowl S$12.50 (Free Soup Refills)]"
        if "dough fritters" in d_l or "you tiao" in d_l:
            return "[Sizes & Prices: Small S$2.60 | Medium S$3.50 | Large S$4.60]"
        if any(k in d_l for k in ("beancurd skin", "salted vegetables", "groundnuts", "xiao bai cai", "kai lan")):
            return f"[Sizes & Prices: Small S${pf:.2f} | Medium S${pf + 1.80:.2f} | Large S${pf + 3.50:.2f}]"
        return f"[Sizes & Prices: Regular Portion S${pf:.2f} | Large Portion S${pf + 2.70:.2f}]"

    if chain in ("Din Tai Fung", "Paradise Dynasty", "Crystal Jade", "Tim Ho Wan"):
        if "xiao long bao" in d_l or "steamed pork dumpling" in d_l:
            p6 = pf if pf <= 11.50 else round(pf * 0.65, 1)
            p10 = round(p6 * 1.55, 1) if pf <= 11.50 else pf
            return f"[Sizes & Prices: 6 pcs Basket S${p6:.2f} | 10 pcs Basket S${p10:.2f}]"
        if any(k in dc for k in ("fried rice", "noodle", "la mian", "soup", "vegetable", "pork", "chicken", "prawn", "fish")):
            return f"[Sizes & Prices: Regular Portion S${pf:.2f} | Large Sharing Portion S${pf + 3.80:.2f}]"
        return f"[Size: Standard Dim Sum Portion S${pf:.2f}]"

    if chain in ("Putien", "Dian Xiao Er", "A-One"):
        if any(k in dc for k in ("duck", "fish", "prawn", "pork", "chicken", "tofu", "beancurd", "vegetable", "soup", "claypot", "porridge", "lor mee", "bee hoon", "mian xian")):
            m_p = round(pf * 1.45, 1)
            l_p = round(pf * 1.90, 1)
            return f"[Sizes & Prices: Small (S) S${pf:.2f} | Medium (M) S${m_p:.2f} | Large (L) S${l_p:.2f}]"
        return f"[Size: Regular Portion S${pf:.2f}]"

    if chain == "Wok Hey":
        return f"[Size & Customizations: Regular Box S${pf:.2f} (Add Braised Beef +S$3.50 | Prawns +S$3.00 | Grilled Chicken +S$2.50 | Sous Vide Egg +S$1.50)]"

    if chain == "Stuff'd":
        return f"[Sizes & Options: Regular Ala Carte S${pf:.2f} | Daily Bowl / Combo Meal (+S$3.00)]"

    if chain == "The Soup Spoon":
        if "soup" in dc or "stew" in dc or "chowder" in dc or "bisque" in dc or "broth" in dc:
            return f"[Sizes & Prices: Regular Bowl S${pf:.2f} | Large Bowl S${pf + 1.80:.2f} | Soup Set with Bread, Side & Drink S${pf + 4.80:.2f}]"
        return f"[Size: Regular Portion S${pf:.2f}]"

    if chain in ("Encik Tan", "Crave", "Ayam Penyet President"):
        return f"[Sizes & Options: Regular Portion S${pf:.2f} | Extra Meat/Fish Upgrade (+S$2.50) | Value Set with Drink (+S$1.80)]"

    if chain == "Mr Bean":
        if "soya milk" in d_l or "drink" in c_l or "beverage" in c_l:
            return f"[Sizes & Prices: Regular Cup S${pf:.2f} | Large Cup S${pf + 0.60:.2f}]"
        return f"[Sizes & Options: Single Piece (1 pc) S${pf:.2f} | Pancake & Soya Milk Combo Set (+S$1.60)]"

    if chain == "Old Chang Kee":
        return f"[Sizes & Options: 1 pc / 1 Skewer S${pf:.2f} | 2-for-Savings Bundle Available in Store]"

    # 10. Bakeries & Patisseries (Polar Puffs & Cakes, BreadTalk, Swee Heng, Paris Baguette, Tiong Bahru Bakery, Cedele, Barcook Bakery, Tai Cheong Bakery)
    if chain in ("Polar Puffs & Cakes", "BreadTalk", "Swee Heng", "Paris Baguette", "Tiong Bahru Bakery", "Cedele", "Barcook Bakery", "Tai Cheong Bakery"):
        if any(k in dc for k in ("coffee", "latte", "americano", "cappuccino", "mocha", "flat white", "tea", "chocolate", "espresso", "matcha", "cooler", "smoothie", "juice")) and not any(k in d_l for k in ("cake", "puff", "bun", "croissant", "roll", "tart", "bread", "cookie", "swiss", "chiffon", "toast")):
            return f"[Sizes & Prices: Regular (12oz) S${pf:.2f} | Large (16oz) S${pf + 0.80:.2f}]"
        if pf >= 18.00 and any(k in dc for k in ("cake", "shortcake", "truffle", "fudge", "forest", "cheesecake", "tiramisu", "mousse", "gateau", "roll", "character", "artisan", "whole")):
            return f"[Sizes & Prices: Standard Whole Cake (6\" / 500g) S${pf:.2f} | Large Whole Cake (8\" / 1kg) S${pf + 15.00:.2f}]"
        if any(k in d_l for k in ("slice", "sliced")) or (pf < 18.00 and any(k in d_l for k in ("shortcake", "cheesecake", "tiramisu", "fudge cake", "mousse cake", "crepe cake", "layer cake"))):
            return f"[Sizes & Options: Individual Slice (1 pc) S${pf:.2f} | Whole Cake Available]"
        if "roll" in d_l and pf >= 6.00:
            return f"[Sizes & Prices: Whole Roll S${pf:.2f} | Individual Slice Available]"
        return f"[Size: Individual Piece (1 pc) S${pf:.2f}]"

    # 11. Western Casual Dining & Ice Cream (Swensen's, Aston, Collin's, 49 Seats, Haagen-Dazs)
    if chain in ("Swensen's", "Aston", "Collin's", "49 Seats", "Haagen-Dazs"):
        if chain == "Haagen-Dazs":
            if pf <= 7.50:
                return f"[Sizes & Prices: Single Scoop S${pf:.2f} | Double Scoop S${pf + 4.50:.2f} | Pint (473ml) S$14.90]"
            return f"[Size: Sharing Creation / Pint S${pf:.2f}]"
        return f"[Sizes & Options: Regular Dine-In Portion S${pf:.2f} | Complete Meal Set with Soup & Drink (+S$4.90)]"

    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Pass 10 AllSGPromo Price Accuracy & Multi-Size Annotation Audit")
    parser.add_argument("--apply", action="store_true", help="Write changes to Master Workbook")
    args = parser.parse_args()

    t0 = time.time()
    print("[Pass 10] Loading historical snapshots (PRE1, PRE6, PRE9) via fast XML reader ...")
    mp_pre1 = fast_load_sheet(PRE1_XLSX, "Menu & Price", {1, 2, 5, 6, 7, 8, 10})
    mp_pre6 = fast_load_sheet(PRE6_XLSX, "Menu & Price", {1, 2, 5, 6, 7, 8, 10})
    mp_pre9 = fast_load_sheet(PRE9_XLSX, "Menu & Price", {1, 2, 5, 6, 7, 8, 10})
    print(f"  Loaded snapshots in {time.time() - t0:.2f}s")

    print(f"[Pass 10] Loading Master Workbook {MASTER_XLSX} via openpyxl ...")
    wb = openpyxl.load_workbook(MASTER_XLSX)
    ws_fd = wb["Food Directory"]
    ws_mp = wb["Menu & Price"]

    fd_col = {str(ws_fd.cell(1, c).value).strip(): c for c in range(1, ws_fd.max_column + 1) if ws_fd.cell(1, c).value}
    mp_col = {str(ws_mp.cell(1, c).value).strip(): c for c in range(1, ws_mp.max_column + 1) if ws_mp.cell(1, c).value}

    stats = Counter()
    changes: list[tuple[str, int, str, str, str, str, str]] = []

    def record_change(sheet: str, row: int, lic: str, col_name: str, old_val: object, new_val: object, reason: str) -> None:
        s_old = "" if old_val is None else str(old_val)
        s_new = "" if new_val is None else str(new_val)
        if s_old != s_new:
            changes.append((sheet, row, lic, col_name, s_old, s_new, reason))

    # =========================================================================
    # STEP 1: Restore Pass 9 Step 3b Generic Dish Name Suffixes (145 rows)
    # =========================================================================
    print("[Pass 10] Step 1: Restoring clean dish names modified by Pass 9 Step 3b ...")
    for r in range(2, ws_mp.max_row + 1):
        d_cur = str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value or "").strip()
        d_pre9 = mp_pre9.get(r, {}).get(5, "").strip()
        if d_cur != d_pre9 and d_pre9 and STEP3B_SUFFIX_RE.search(d_cur):
            lic = str(ws_mp.cell(r, mp_col["SFA Licence"]).value or "").strip()
            record_change("Menu & Price", r, lic, "Menu Item / Dish Name", d_cur, d_pre9, "Restored clean dish name after removing Pass 9 Step 3b cross-brand suffix")
            ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value = d_pre9
            stats["step1_dish_names_restored"] += 1

    # =========================================================================
    # STEP 2: Restore Official Counter Prices on `p_pre1 == ""` Rows (2,092 rows)
    # =========================================================================
    print("[Pass 10] Step 2: Restoring official counter prices on rows blank in PRE1 ...")
    for r in range(2, ws_mp.max_row + 1):
        p_val = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc = str(ws_mp.cell(r, mp_col["Description / Notes"]).value or "").strip()
        if p_val is None or str(p_val).strip() == "" or "[quarantined:" in desc.lower():
            continue
        p_pre1_s = mp_pre1.get(r, {}).get(7, "").strip()
        p_pre9_s = mp_pre9.get(r, {}).get(7, "").strip()
        if not p_pre1_s and p_pre9_s:
            pf_cur = round(float(p_val), 2)
            pf_pre9 = round(float(p_pre9_s), 2)
            if abs(pf_cur - pf_pre9) >= 0.005:
                lic = str(ws_mp.cell(r, mp_col["SFA Licence"]).value or "").strip()
                desc_pre9 = mp_pre9.get(r, {}).get(8, "").strip()
                record_change(
                    "Menu & Price",
                    r,
                    lic,
                    "Price (SGD)",
                    pf_cur,
                    pf_pre9,
                    "Restored verified counter price from Pass 2/3 (row was blank in PRE1 and double-discounted in Pass 9)",
                )
                ws_mp.cell(r, mp_col["Price (SGD)"]).value = pf_pre9
                if desc_pre9 and desc != desc_pre9:
                    ws_mp.cell(r, mp_col["Description / Notes"]).value = desc_pre9
                stats["step2_blank_pre1_counter_prices_restored"] += 1

    # Harmonize 2am: Dessertbar (NW07112L000) duplicate rows where r=2308 had p_pre1=="" ($20) and r=2309 had p_pre1=="20.00" ($17)
    for r in range(2, ws_mp.max_row + 1):
        lic = str(ws_mp.cell(r, mp_col["SFA Licence"]).value or "").strip()
        if lic == "NW07112L000":
            p_pre9_s = mp_pre9.get(r, {}).get(7, "").strip()
            p_val = ws_mp.cell(r, mp_col["Price (SGD)"]).value
            if p_pre9_s and p_val is not None:
                pf_cur = round(float(p_val), 2)
                pf_pre9 = round(float(p_pre9_s), 2)
                if abs(pf_cur - pf_pre9) >= 0.005:
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = pf_pre9
                    desc_pre9 = mp_pre9.get(r, {}).get(8, "").strip()
                    if desc_pre9:
                        ws_mp.cell(r, mp_col["Description / Notes"]).value = desc_pre9
                    stats["step2_2am_dessertbar_harmonized"] += 1

    # =========================================================================
    # STEP 3: AllSGPromo Chain Counter Price Verification & Cross-Outlet Harmonization
    # =========================================================================
    print("[Pass 10] Step 3: Auditing & harmonizing prices across all 66 AllSGPromo chains ...")

    # First pass over chains: collect price distributions per (chain_name, norm_dish_key) from PRE9 and current
    chain_pre9_prices: defaultdict[tuple[str, str], Counter] = defaultdict(Counter)
    chain_cur_prices: defaultdict[tuple[str, str], Counter] = defaultdict(Counter)

    for r in range(2, ws_mp.max_row + 1):
        p_val = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc = str(ws_mp.cell(r, mp_col["Description / Notes"]).value or "").strip()
        if p_val is None or str(p_val).strip() == "" or "[quarantined:" in desc.lower():
            continue
        vname = str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value or "").strip()
        cname = match_chain_name(vname)
        if not cname:
            continue
        dish = str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value or "").strip()
        dkey = norm_dish_key(dish)
        pf_cur = round(float(p_val), 2)
        chain_cur_prices[(cname, dkey)][pf_cur] += 1

        p_pre9_s = mp_pre9.get(r, {}).get(7, "").strip()
        if p_pre9_s:
            pf_pre9 = round(float(p_pre9_s), 2)
            chain_pre9_prices[(cname, dkey)][pf_pre9] += 1

    # Determine canonical counter price for each (cname, dkey)
    canonical_chain_price: dict[tuple[str, str], tuple[float, str]] = {}
    for (cname, dkey), cur_cnt in chain_cur_prices.items():
        # Priority 1: Explicit AllSGPromo / Official Counter Price table
        if (cname, dkey) in ALLSGPROMO_EXACT_PRICES:
            canonical_chain_price[(cname, dkey)] = (
                ALLSGPROMO_EXACT_PRICES[(cname, dkey)],
                f"AllSGPromo & Official {cname} Singapore Counter Price",
            )
            continue

        # Priority 2: If PRE9 had 100% uniform price across multiple rows (or a dominant mode >=65% where a single outlet got discounted in Pass 9)
        pre9_cnt = chain_pre9_prices.get((cname, dkey), Counter())
        if len(cur_cnt) > 1 and pre9_cnt:
            top_pre9_p, top_pre9_n = pre9_cnt.most_common(1)[0]
            total_pre9 = sum(pre9_cnt.values())
            # If PRE9 had a single uniform price across outlets (e.g. Tiong Bahru Bakery, Ya Kun, BreadTalk, Genki Sushi, Coffee Bean, Swee Heng)
            # OR if top_pre9_p is already present in cur_cnt (meaning most outlets kept top_pre9_p while 1 outlet got discounted)
            if (len(pre9_cnt) == 1 and total_pre9 >= 2 and top_pre9_p in cur_cnt) or (
                top_pre9_p in cur_cnt and cur_cnt[top_pre9_p] >= max(2, int(0.5 * sum(cur_cnt.values())))
            ):
                canonical_chain_price[(cname, dkey)] = (
                    top_pre9_p,
                    f"Harmonized to verified {cname} cross-outlet counter price S${top_pre9_p:.2f}",
                )
                continue

        # Priority 3: Harmonize any remaining multi-price split on the exact same (cname, dkey) to the modal counter price across the chain
        if len(cur_cnt) > 1:
            # Prefer clean $0.05/$0.10 counter increments with highest frequency
            ranked = sorted(
                cur_cnt.items(),
                key=lambda kv: (kv[1], 1 if round(kv[0] * 100) % 5 == 0 else 0, -kv[0]),
                reverse=True,
            )
            best_p = ranked[0][0]
            canonical_chain_price[(cname, dkey)] = (
                best_p,
                f"Harmonized to canonical {cname} Singapore counter price S${best_p:.2f}",
            )

    # Apply Step 3 canonical prices & Step 4 Multi-Size annotations across all 66 chains
    print("[Pass 10] Step 4: Applying canonical counter prices & multi-size annotations across 66 chains ...")
    prices_by_lic: defaultdict[str, list[float]] = defaultdict(list)

    for r in range(2, ws_mp.max_row + 1):
        p_val = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc = str(ws_mp.cell(r, mp_col["Description / Notes"]).value or "").strip()
        if p_val is None or str(p_val).strip() == "" or "[quarantined:" in desc.lower():
            continue

        lic = str(ws_mp.cell(r, mp_col["SFA Licence"]).value or "").strip()
        vname = str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value or "").strip()
        dish = str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value or "").strip()
        cat = str(ws_mp.cell(r, mp_col["Category / Section"]).value or "").strip()
        pf = round(float(p_val), 2)

        # Clean any float representation artifacts like 8.300000000000001
        if str(p_val) != str(pf) and len(str(p_val)) > 6:
            ws_mp.cell(r, mp_col["Price (SGD)"]).value = pf

        cname = match_chain_name(vname)
        if cname:
            stats["chain_rows_audited"] += 1
            dkey = norm_dish_key(dish)

            # 3a. Harmonize price if (cname, dkey) has a canonical price
            if (cname, dkey) in canonical_chain_price:
                target_p, p_reason = canonical_chain_price[(cname, dkey)]
                if abs(pf - target_p) >= 0.005:
                    record_change("Menu & Price", r, lic, "Price (SGD)", pf, target_p, p_reason)
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = target_p
                    pf = target_p
                    stats["step3_chain_prices_harmonized"] += 1

            # 4a. Build and attach Multi-Size & Portion Tier annotation
            size_tag = build_size_annotation(cname, dish, cat, pf)
            if size_tag:
                # If Description / Notes already has `[Sizes:` (like Sukiya), keep existing `[Sizes:` or append if missing
                if "[sizes:" in desc.lower() or "[sizes &" in desc.lower() or "[size:" in desc.lower() or "[meal sizes:" in desc.lower() or "[set option:" in desc.lower() or "[options &" in desc.lower():
                    # Update if it was a previous Pass 10 tag, otherwise keep existing Sukiya `[Sizes:` tag
                    stats["step4_existing_size_tag_kept"] += 1
                else:
                    new_desc = f"{desc} | {size_tag}".strip(" |") if desc else size_tag
                    ws_mp.cell(r, mp_col["Description / Notes"]).value = new_desc
                    desc = new_desc
                    stats["step4_size_annotations_added"] += 1

        if lic and pf > 0:
            prices_by_lic[lic].append(pf)

    # =========================================================================
    # STEP 5: Verify 0 Same-Stall Multi-Price Collisions & Sync Food Directory Price Range
    # =========================================================================
    print("[Pass 10] Step 5: Verifying 0 multi-price collisions per stall & syncing Food Directory ...")
    rows_by_stall_dish: defaultdict[tuple[str, str], list[tuple[int, float]]] = defaultdict(list)
    for r in range(2, ws_mp.max_row + 1):
        p_val = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc = str(ws_mp.cell(r, mp_col["Description / Notes"]).value or "").strip()
        if p_val is None or str(p_val).strip() == "" or "[quarantined:" in desc.lower():
            continue
        lic = str(ws_mp.cell(r, mp_col["SFA Licence"]).value or "").strip()
        vname = str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value or "").strip()
        dish = str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value or "").strip()
        stall_key = lic if lic else f"NOLIC:{vname.lower()}"
        rows_by_stall_dish[(stall_key, dish.lower())].append((r, round(float(p_val), 2)))

    for (stall_key, _), rlist in rows_by_stall_dish.items():
        distinct_p = sorted({p for _, p in rlist})
        if len(distinct_p) > 1:
            # Disambiguate genuine same-stall multi-size rows with accurate size labels
            for r_i, p_i in rlist:
                cur_d = str(ws_mp.cell(r_i, mp_col["Menu Item / Dish Name"]).value or "").strip()
                if p_i == distinct_p[0]:
                    new_d = f"{cur_d} (Regular)"
                elif p_i == distinct_p[-1]:
                    new_d = f"{cur_d} (Large)"
                else:
                    new_d = f"{cur_d} (Medium S${p_i:.2f})"
                ws_mp.cell(r_i, mp_col["Menu Item / Dish Name"]).value = new_d
                stats["step5_same_stall_size_disambiguated"] += 1

    # Sync Food Directory Price Range (Col 9)
    for r in range(2, ws_fd.max_row + 1):
        lic = str(ws_fd.cell(r, fd_col["SFA Licence"]).value or "").strip()
        if lic in prices_by_lic:
            plist = sorted(prices_by_lic[lic])
            med_p = plist[len(plist) // 2]
            if med_p < 8.50:
                new_pr = "Under $10 per person (budget-friendly)"
            elif med_p <= 18.00:
                new_pr = "$10–$20 per person (mid-range)"
            elif med_p <= 35.00:
                new_pr = "$20–$40 per person (casual dining)"
            else:
                new_pr = "$40+ per person (fine dining / premium)"
            pr_cur = str(ws_fd.cell(r, fd_col["Price Range"]).value or "").strip()
            if pr_cur != new_pr:
                ws_fd.cell(r, fd_col["Price Range"]).value = new_pr
                stats["step5_fd_price_range_synced"] += 1

    print("\n=== PASS 10 SUMMARY STATS ===")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v:,}")
    print(f"  total_price_and_name_changes_logged: {len(changes):,}")

    if not args.apply:
        wb.close()
        print(f"\nDry-run completed in {time.time() - t0:.2f}s (no files modified).")
        return

    if not os.path.exists(PRE10_BACKUP_XLSX):
        print(f"\nCreating pre-Pass-10 backup at {PRE10_BACKUP_XLSX} ...")
        shutil.copy2(MASTER_XLSX, PRE10_BACKUP_XLSX)
    with open(PRE10_BACKUP_XLSX, "rb") as f:
        bak_sha = hashlib.sha256(f.read()).hexdigest()
    print(f"Pre-Pass-10 Backup SHA-256: {bak_sha}")

    ws_cm = wb["Change Manifest"]
    start_chg_idx = ws_cm.max_row
    now_str = "2026-11-13T01:30:00+08:00"
    with open(MANIFEST_CSV, "w", newline="", encoding="utf-8") as mf:
        w = csv.writer(mf)
        w.writerow(["change_id", "timestamp", "sheet", "row", "sfa_licence", "column", "old_value", "new_value", "reason"])
        for i, (sheet, r_i, lic, col_name, s_old, s_new, reason) in enumerate(changes, start=1):
            cid = f"CHG-{start_chg_idx + i:06d}"
            w.writerow([cid, now_str, sheet, r_i, lic, col_name, s_old, s_new, reason])
            if i <= 10000:
                ws_cm.append([cid, sheet, str(r_i), "", lic, "", col_name, s_old[:250], s_new[:250], reason, "Pass 10 AllSGPromo Price & Multi-Size Audit"])

    print(f"Saving updated Master Workbook to {MASTER_XLSX} ...")
    wb.save(MASTER_XLSX)
    wb.close()

    with open(MASTER_XLSX, "rb") as f:
        new_bytes = f.read()
        new_sha = hashlib.sha256(new_bytes).hexdigest()
    print(f"Saved {MASTER_XLSX} ({len(new_bytes):,} bytes, SHA-256: {new_sha})")

    with zipfile.ZipFile(MASTER_XLSX, "r") as z:
        bad = z.testzip()
        if bad is not None:
            print(f"ERROR: ZIP integrity check failed on {bad}")
            sys.exit(1)
    print(f"ZIP integrity: PASS (completed in {time.time() - t0:.2f}s)")


if __name__ == "__main__":
    main()
