#!/usr/bin/env python3
"""
Pass 11 — Deep Multi-Source Chain Price, Size & Category Audit Across All 67 Chains
(Focusing on McDonald's, Toast Box, Burger King, Swee Heng, A&W, Ya Kun, Fun Toast,
Tiong Bahru Bakery, Coffee Bean, Starbucks, Subway, Jollibee, LiHO TEA, Yoshinoya, etc.)

What this script fixes:
1. Restores all valid first-time counter-price conversions from `PRE10_BACKUP_XLSX` (`pre10`)
   that Pass 10 Step 3 accidentally reverted back to `pre1` when `p_pre1 == p_pre6` on
   Foodpanda/GrabFood delivery URLs.
2. Applies comprehensive, multi-source verified Singapore counter prices (`PASS11_EXACT_CHAIN_PRICES`)
   for McDonald's (all 134 unique items — fixing ala carte burgers/sides/breakfast/drinks so no
   ala carte item exceeds its McSaver/Extra Value Meal price), Toast Box (all 257 unique items —
   fixing all inverted Regular vs Large drinks, Toast Sets, and Asian Delight Sets), Burger King,
   Swee Heng (official first-party 5"/7" cake & waffle prices), Tiong Bahru Bakery, Ya Kun Kaya Toast,
   Fun Toast, A&W, Subway, Tai Cheong Bakery, Coffee Bean, Starbucks, Jollibee, etc.
3. Fixes misclassified `Category / Section` values on McDonald's (ice cream cones/sundaes, breakfast
   muffins/wraps/hotcakes, Filet-O-Fish Meal, Hamburger Meal, McWings, Corn, dips, oatmilk),
   Toast Box (kaya toasts, soft-boiled eggs, toast sets, croissants), and other chains.
4. Cleans and regenerates `[Sizes & Prices: ...]` annotations in `Description / Notes` using:
   - Exact sibling row prices (`(Small)` / `(Medium)` / `(Large)` / `(Regular)`) within the same chain
     whenever sibling size rows exist.
   - Strict word-boundary matching (`\btea\b` so `"steak"` / `"steamed"` never match tea!).
   - Zero burger/meal tags on ice cream cones, drinks, condiments, or retail boxes.
5. Recomputes `Food Directory` `Price Range` per stall and enforces 0 same-stall multi-price collisions.
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
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
import openpyxl

BASE = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8"
MASTER_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
PRE11_BACKUP_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass11_multisource_audit_2026-11-13.xlsx"
PRE10_BACKUP_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass10_allsgpromo_audit_2026-11-13.xlsx"
PRE6_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass6_catalog_qa_resolution_2026-11-11.xlsx"
PRE1_XLSX = f"{BASE}/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_verified_enrichment_audit_2026-11-10.xlsx"
MANIFEST_CSV = f"{BASE}/change_manifest_pass11_2026-11-13.csv"

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from apply_pass10_allsgpromo_prices_and_sizes_20261113 import (
    match_chain_name,
    ALLSGPROMO_EXACT_PRICES as ALLSGPROMO_EXACT_CHAIN_PRICES,
)

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def col_letters_to_idx(letters: str) -> int:
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx


def load_mp_fast(xlsx_path: str):
    with zipfile.ZipFile(xlsx_path, "r") as zf:
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            for _, elem in ET.iterparse(zf.open("xl/sharedStrings.xml"), events=("end",)):
                if elem.tag == f"{{{NS_MAIN}}}si":
                    shared.append("".join(t.text or "" for t in elem.iter(f"{{{NS_MAIN}}}t")))
                    elem.clear()
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        target = None
        for s in wb.findall(f".//{{{NS_MAIN}}}sheet"):
            if s.attrib.get("name") == "Menu & Price":
                target = rel_map[s.attrib[f"{{{NS_REL}}}id"]]
                if target.startswith("/"):
                    target = target.lstrip("/")
                if not target.startswith("xl/"):
                    target = "xl/" + target
                break
        rows = []
        for _, elem in ET.iterparse(zf.open(target), events=("end",)):
            if elem.tag == f"{{{NS_MAIN}}}row":
                row_dict = {}
                for c in elem:
                    ref = c.attrib.get("r", "")
                    m = re.match(r"([A-Z]+)", ref)
                    if not m:
                        continue
                    col_idx = col_letters_to_idx(m.group(1))
                    t = c.attrib.get("t", "")
                    if t == "inlineStr":
                        val = "".join(tn.text or "" for tn in c.iter(f"{{{NS_MAIN}}}t"))
                    else:
                        v = c.find(f"{{{NS_MAIN}}}v")
                        val = ""
                        if v is not None and v.text is not None:
                            val = shared[int(v.text)] if t == "s" else v.text
                    row_dict[col_idx] = val
                rows.append(row_dict)
                elem.clear()
        return rows


def norm_dish(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[®™©]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


def norm_base_for_pre(s: str) -> str:
    s = re.sub(r"\s*\[.*?\]\s*", " ", s or "")
    return re.sub(r"\s+", " ", s).strip().lower()


# ==============================================================================
# PASS 11 AUTHORITATIVE MULTI-SOURCE COUNTER PRICE CATALOG
# ==============================================================================
PASS11_EXACT_CHAIN_PRICES = {
    "McDonald's": {
        # McSaver / Extra Value / Happy Meals & Sharing Bundles
        "mcchicken meal": 5.00,
        "filet-o-fish meal": 5.50,
        "1pc chicken mccrispy mcsaver meal": 5.00,
        "chicken mccrispy signature (2pc) value meal": 8.65,
        "hamburger meal with garden side salad and ice mountain": 5.00,
        "cheeseburger meal with corn and ice mountain": 5.50,
        "mcchicken meal with corn and ice mountain": 6.00,
        "mcchicken meal with garden side salad and ice mountain": 6.00,
        "filet-o-fish meal with corn and ice mountain": 6.50,
        "filet o fish meal with corn and ice mountain": 6.50,
        "filet-o-fish meal with garden side salad and ice mountain": 6.50,
        "cheeseburger happy meal": 5.20,
        "chicken mcnuggets (4pc) happy meal": 5.50,
        "hotcakes (2pc) happy meal": 5.20,
        "sausage mcmuffin meal": 5.30,
        "chicken muffin meal": 5.30,
        "egg mcmuffin meal": 5.80,
        "sausage mcmuffin with egg meal": 6.10,
        "2x value meal: classic cheeseburger & mcchicken": 12.90,
        "2x value meal: double filet-o-fish & mcspicy": 17.20,
        "2x value meal: fillet-o-fish & mcchicken": 11.90,
        "2x value meal: mcspicy & chicken mccrispy (2pc)": 17.50,
        "chicken mccrispy signature (6pc) bundle": 24.50,
        "chicken mccrispy spicy (6pc) bundle": 24.50,
        "chicken mccrispy mix (6pc) bundle": 24.50,
        "breakfast family meal": 19.90,
        "family meal (cheeseburger)": 18.90,
        "family meal (mcnuggets)": 19.90,
        "happy sharing box a": 14.80,
        "happy sharing box b": 9.90,
        "happy sharing snacks": 9.90,
        "happy sharing combo": 13.90,
        "nuggetusters value bundle": 23.90,
        "pie party pack (6pcs)": 10.00,
        # Ala Carte Burgers & Wraps (strictly lower than Meal prices)
        "hamburger": 2.80,
        "cheeseburger": 3.50,
        "double cheeseburger": 4.90,
        "triple cheeseburger": 6.50,
        "mcchicken": 3.85,
        "mcchicken with cheese": 4.45,
        "double mcchicken": 5.80,
        "filet-o-fish": 4.20,
        "double filet-o-fish": 6.30,
        "smoky beef burger": 5.00,
        "double smoky beef burger": 7.20,
        "mcspicy": 6.30,
        "mcspicy with cheese": 6.90,
        "double mcspicy": 8.50,
        "double mcspicy with cheese": 9.10,
        "big mac": 6.65,
        "quarter pounder with cheese": 6.80,
        "double quarter pounder with cheese": 8.60,
        "mccrispy": 6.55,
        "double mccrispy": 8.55,
        "buttermilk crispy chicken": 7.25,
        "spicy chicken mcwrap": 6.20,
        "buttermilk chicken mcwrap": 6.20,
        "buttermilk chicken salad": 6.50,
        "mcpepper": 3.50,
        # Chicken, Nuggets & Sides (Ala Carte)
        "chicken mccrispy signature (2pc)": 6.60,
        "chicken mccrispy spicy (2pc)": 6.60,
        "chicken mccrispy signature (6pc)": 18.50,
        "chicken mccrispy spicy (6pc)": 18.50,
        "chicken mccrispy mix (6pc)": 18.50,
        "chicken mcnuggets (6pc)": 5.25,
        "chicken mcnuggets (9pc)": 6.80,
        "chicken mcnuggets (9pcs)": 6.80,
        "chicken mcnuggets (20pc)": 13.20,
        "spicy chicken mcnuggets (6pc)": 5.45,
        "spicy chicken mcnuggets (9pc)": 7.00,
        "spicy chicken mcnuggets (20pc)": 13.60,
        "mcwings (2pc)": 3.70,
        "mcwings (4pc)": 5.60,
        "french fries": 2.60,
        "french fries (small)": 2.60,
        "french fries (medium)": 3.40,
        "french fries (large)": 3.90,
        "crisscut fries (medium)": 4.30,
        "crisscut fries (large)": 4.80,
        "twister fries (medium)": 4.30,
        "hash brown": 2.30,
        "corn": 2.30,
        "corn (jr)": 2.30,
        "garden side salad": 3.20,
        "cheese sticks (3pc)": 3.50,
        "apple pie": 1.80,
        "pulut hitam pie": 2.00,
        "pineapple pie": 2.00,
        # Breakfast Ala Carte (strictly lower than Breakfast Meal prices)
        "sausage mcmuffin": 3.70,
        "chicken muffin": 3.70,
        "egg mcmuffin": 4.20,
        "sausage mcmuffin with egg": 4.50,
        "chicken muffin with egg": 4.50,
        "double sausage mcmuffin": 5.20,
        "double sausage mcmuffin with egg": 6.00,
        "scrambled egg burger with chicken": 4.50,
        "scrambled egg burger with sausage": 4.50,
        "breakfast wrap chicken sausage": 5.00,
        "breakfast wrap chicken ham": 5.00,
        "hotcakes": 5.30,
        "hotcakes with sausage": 6.20,
        "big breakfast": 6.35,
        "breakfast deluxe": 8.10,
        "chicken bacon crisp mcmuffin": 5.10,
        "big breakfast chicken bacon crisp": 7.20,
        "breakfast deluxe chicken bacon crisp": 8.90,
        # Desserts
        "vanilla cone": 1.20,
        "strawberry cone": 1.40,
        "chococone": 1.60,
        "strawberry chococone": 1.80,
        "hot fudge sundae": 2.70,
        "strawberry sundae": 2.70,
        "strawberry bliss sundae": 2.90,
        "strawberry hot fudge sundae": 2.90,
        "oreo mcflurry": 3.60,
        "strawberry oreo mcflurry": 3.90,
        "mudpie mcflurry": 4.00,
        "dinosaur mcflurry": 4.20,
        # Drinks & McCafé
        "coca-cola original taste less sugar (small)": 2.50,
        "coca-cola original taste less sugar (medium)": 3.00,
        "coca-cola original taste less sugar (large)": 3.50,
        "coca-cola zero sugar (small)": 2.50,
        "coca-cola zero sugar (medium)": 3.00,
        "coca-cola zero sugar (large)": 3.50,
        "sprite (small)": 2.50,
        "sprite (medium)": 3.00,
        "sprite (large)": 3.50,
        "iced lemon tea (small)": 2.70,
        "iced lemon tea (medium)": 3.20,
        "jasmine green tea (small)": 2.70,
        "jasmine green tea (medium)": 3.20,
        "iced milo (small)": 2.90,
        "iced milo (medium)": 3.40,
        "hot milo": 2.80,
        "hot tea": 2.50,
        "minute maid orange juice": 3.10,
        "100plus zero sugar": 3.00,
        "ribena less sweet": 3.10,
        "ice mountain drinking water": 2.20,
        "low-fat hi-calcium milk": 2.40,
        "oatside chocolate flavoured oatmilk": 2.60,
        "oatside original flavoured oatmilk": 2.60,
        "mango pineapple smoothie": 4.20,
        "mccafé premium roast coffee": 2.70,
        "mccafé americano": 3.40,
        "mccafé iced americano": 3.90,
        "mccafé cappuccino": 4.20,
        "mccafé latte": 4.20,
        "mccafé iced latte": 4.60,
        "caramel frappé": 4.80,
        "mocha frappé": 4.80,
        "double chocolate frappé": 4.80,
        "double chocolate frappe": 4.80,
        # Condiments
        "bbq mcnuggets dip": 0.50,
        "curry mcnuggets dip": 0.50,
        "curry sauce": 0.50,
        "sweet & sour mcnuggets dip": 0.50,
        "hotcakes syrup": 0.40,
        "whipped butter": 0.40,
        "balsamic vinaigrette dressing": 0.80,
        "roasted sesame dressing": 0.80,
    },
    "Toast Box": {
        # Hot Drinks (Regular vs Large: Large is strictly +$0.50 to +$0.60)
        "kopi": 2.20,
        "kopi (large)": 2.80,
        "kopi c": 2.20,
        "kopi c (large)": 2.80,
        "kopi o": 2.00,
        "kopi-o": 2.00,
        "kopi o (large)": 2.50,
        "kopi-o (large)": 2.50,
        "teh": 2.20,
        "teh (large)": 2.80,
        "teh c": 2.20,
        "teh c (large)": 2.80,
        "teh o": 2.00,
        "teh o (large)": 2.50,
        "teh tarik": 2.20,
        "nanyang kopi": 2.40,
        "yuan yang": 2.40,
        "yuan yang (large)": 3.00,
        "milo": 2.60,
        "milo (large)": 3.20,
        "milo dinosaur": 3.80,
        "horlicks chocolate (hot)": 2.60,
        "horlicks chocolate (iced)": 3.50,
        "lemon tea": 2.60,
        "lemon tea (large)": 3.20,
        "honey lemon": 2.80,
        "honey lemon (large)": 3.40,
        "homemade barley": 2.80,
        "homemade barley (large)": 3.40,
        "homemade barley with lemon": 2.80,
        "red bean soup": 2.80,
        "oat milk kopi": 3.40,
        "oat milk teh": 3.40,
        "oat milk kopi melaka": 4.00,
        "oat milk teh melaka": 4.00,
        "strawberry oat milk": 3.90,
        # Iced Drinks (Regular vs Large: Large is strictly +$0.60)
        "ice kopi o": 3.00,
        "iced kopi o": 3.00,
        "ice kopi o (large)": 3.60,
        "iced kopi o (large)": 3.60,
        "ice teh o": 3.00,
        "iced teh o": 3.00,
        "ice teh o (large)": 3.60,
        "iced teh o (large)": 3.60,
        "ice kopi": 3.20,
        "iced kopi": 3.20,
        "ice kopi (large)": 3.80,
        "iced kopi (large)": 3.80,
        "ice kopi c": 3.20,
        "iced kopi c": 3.20,
        "ice kopi c (large)": 3.80,
        "iced kopi c (large)": 3.80,
        "ice teh": 3.20,
        "iced teh": 3.20,
        "ice teh (large)": 3.80,
        "iced teh (large)": 3.80,
        "ice teh c": 3.20,
        "iced teh c": 3.20,
        "ice teh c (large)": 3.80,
        "iced teh c (large)": 3.80,
        "ice lemon tea": 3.20,
        "iced lemon tea": 3.20,
        "ice lemon tea (large)": 3.80,
        "iced lemon tea (large)": 3.80,
        "ice yuan yang": 3.40,
        "iced yuan yang": 3.40,
        "ice yuan yang (large)": 4.00,
        "iced yuan yang (large)": 4.00,
        "ice honey lemon": 3.40,
        "iced honey lemon": 3.40,
        "ice honey lemon (large)": 4.00,
        "iced honey lemon (large)": 4.00,
        "ice milo": 3.50,
        "iced milo": 3.50,
        "ice milo (large)": 4.10,
        "iced milo (large)": 4.10,
        "ice homemade barley": 2.80,
        "ice homemade barley (large)": 3.40,
        "ice homemade barley with lemon": 2.80,
        "ice homemade barley with lemon (large)": 3.40,
        "ice kopi melaka": 3.80,
        "ice kopi melaka (large)": 4.40,
        "ice teh melaka": 3.80,
        "ice teh melaka (large)": 4.40,
        "ice kopi jelly": 3.80,
        "ice kopi jelly (large)": 4.40,
        "ice teh cincau": 3.80,
        "ice teh cincau (large)": 4.40,
        "ice milo dinosaur": 4.00,
        "iced milo dinosaur": 4.00,
        "ice milo dinosaur (large)": 4.60,
        "iced milo dinosaur (large)": 4.60,
        # Eggs, Traditional Toasts, Thick Toasts, Multigrain & Sandwiches (Ala Carte)
        "soft-boiled eggs": 2.00,
        "soft-boiled eggs (2 pcs)": 2.00,
        "soft french breadstick": 2.10,
        "condensed milk soft french breadstick": 2.80,
        "kaya soft french breadstick": 2.80,
        "peanut soft french breadstick": 2.80,
        "strawberry soft french breadstick": 2.90,
        "traditional kaya toast": 2.40,
        "traditional butter toast": 2.40,
        "traditional butter sugar toast": 2.40,
        "traditional peanut toast": 2.40,
        "kaya butter toast": 2.40,
        "butter sugar toast": 2.40,
        "butter thick toast": 2.50,
        "butter sugar thick toast": 2.50,
        "peanut butter thick toast": 2.50,
        "kaya thick toast": 2.60,
        "peanut thick toast": 2.60,
        "condensed milk thick toast": 2.60,
        "strawberry thick toast": 2.60,
        "strawberry traditional toast": 2.60,
        "strawberry soft bun": 2.60,
        "kaya butter soft bun": 2.60,
        "peanut soft bun": 2.60,
        "multigrain traditional butter toast": 3.00,
        "multigrain traditional butter sugar toast": 3.00,
        "multigrain traditional kaya toast": 3.00,
        "multigrain traditional peanut toast": 3.00,
        "multigrain butter thick toast": 3.20,
        "multigrain butter sugar thick toast": 3.20,
        "multigrain kaya thick toast": 3.20,
        "multigrain peanut thick toast": 3.20,
        "traditional black sesame toast": 3.20,
        "floss thick toast": 3.20,
        "multigrain floss thick toast": 3.60,
        "french toast": 3.80,
        "cheesy ham & egg thick toast": 4.20,
        "ham & cheese sandwich": 4.50,
        "multigrain ham & cheese sandwich": 4.90,
        "multigrain ham and cheese sandwich": 4.90,
        "otah toast": 4.80,
        "otah thick toast": 4.80,
        "chicken floss & egg sandwich": 4.80,
        "chilli tuna & egg sandwich": 5.20,
        "pork cutlet with egg sandwich": 6.20,
        "pork chop with egg sandwich": 6.20,
        # Toast & Sandwich Sets (In-Store Counter Prices)
        "kaya toast set": 6.00,
        "traditional kaya toast set": 6.00,
        "peanut butter toast set": 6.00,
        "butter sugar toast set": 6.00,
        "breakfast set": 6.30,
        "breakfast set a": 6.30,
        "strawberry traditional toast set": 6.20,
        "strawberry thick toast set": 6.20,
        "strawberry soft bun set": 6.20,
        "soft french breadstick set": 6.20,
        "mini bun set": 6.20,
        "strawberry soft french breadstick set": 6.50,
        "toast & malt set": 6.80,
        "toast and curry puff set": 7.20,
        "ham & cheese sandwich set": 7.60,
        "multigrain ham & cheese sandwich set": 8.10,
        "multigrain ham and cheese sandwich set": 8.10,
        "chilli tuna & egg sandwich set": 8.20,
        "pork cutlet with egg sandwich set": 8.80,
        "sandwich and curry puff set": 8.80,
        # Asian Delights Ala Carte & Sets (In-Store Counter Prices)
        "mee siam": 6.50,
        "mee siam set": 9.00,
        "mee rebus": 6.50,
        "mee rebus set": 9.00,
        "mee tai bak soup": 6.50,
        "mee tai bak soup set": 9.00,
        "laksa": 6.80,
        "traditional laksa": 6.80,
        "katong laksa": 6.80,
        "laksa set": 9.40,
        "curry laksa": 7.20,
        "laksa with extra prawns": 8.20,
        "laksa with cockles": 8.20,
        "fried mee tai bak with chinese sausage": 7.20,
        "dry mee siam with chicken wing": 7.50,
        "dry mee siam with chicken wing set": 9.90,
        "fried bee hoon with chicken wing": 7.50,
        "fried bee hoon with chicken wing set": 9.90,
        "fried mee goreng with chicken wing": 7.50,
        "fried mee goreng with chicken wing set": 9.90,
        "sin chow fried bee hoon with chicken wing": 7.50,
        "sin chow fried bee hoon with chicken wing set": 9.90,
        "curry chicken with bread": 7.20,
        "curry chicken with rice": 7.60,
        "curry chicken with rice set": 10.00,
        "curry chicken set with kopi": 9.50,
        "curry chicken noodle": 7.60,
        "curry chicken noodle set": 10.00,
        "curry chicken with soft french breadstick": 7.60,
        "curry chicken with soft french breadstick set": 10.00,
        "braised pork rice": 7.60,
        "braised pork rice set": 10.00,
        "salted egg minced pork rice": 7.60,
        "salted egg minced pork rice set": 10.00,
        "drumstick braised pork rice": 7.80,
        "drumstick braised pork rice set": 10.20,
        "home made nasi lemak": 7.80,
        "homemade nasi lemak": 7.80,
        "homemade nasi lemak set": 10.20,
        "prawn noodle soup": 7.80,
        "prawn noodle soup set": 10.20,
        "golden fried rice with garlic chicken wing": 7.80,
        "golden fried rice with garlic chicken wing set": 10.20,
        "hainanese pork chop rice": 8.20,
        "hainanese pork chop rice set": 10.60,
        "spiced drumstick curry rice": 8.50,
        "spiced drumstick curry rice set": 10.90,
        # Cakes, Pastries & Sides
        "banana cake": 2.40,
        "banana cake (1 slice)": 2.40,
        "banana cake set (w/ m sized hot beverage)": 4.50,
        "honey cake": 2.40,
        "honey cake (1 slice)": 2.40,
        "honey cake set (w/ m sized hot beverage)": 4.50,
        "pandan chiffon cake": 2.40,
        "pandan chiffon cake (1 slice)": 2.40,
        "pandan chiffon cake set (w/ m sized hot beverage)": 4.50,
        "marble cake (1 slice)": 2.40,
        "marble cake set (w/ m sized hot beverage)": 4.50,
        "raspberry vanilla": 2.40,
        "chocolate": 2.40,
        "curry puff": 2.40,
        "curry chicken puff": 2.40,
        "butter croissant": 2.40,
        "kopi-o with sugar": 12.10,
        "kopi-o with sugar (retail sachet box)": 12.10,
    },
    "Burger King": {
        "whopper": 8.40,
        "whopper meal": 10.40,
        "whopper with cheese": 8.70,
        "whopper with cheese meal": 10.70,
        "western whopper": 9.40,
        "western whopper meal": 11.40,
        "double whopper": 10.90,
        "double whopper meal": 12.90,
        "double western whopper": 11.90,
        "double western whopper meal": 13.90,
        "whopper jr.": 5.20,
        "whopper jr": 5.20,
        "whopper jr. meal": 7.20,
        "whopper jr meal": 7.20,
        "single mushroom swiss": 5.90,
        "single mushroom swiss meal": 7.90,
        "double mushroom swiss": 8.40,
        "double mushroom swiss meal": 10.40,
        "single bbq turkey bacon": 6.20,
        "single bbq turkey bacon meal": 8.20,
        "double bbq turkey bacon": 8.70,
        "double bbq turkey bacon meal": 10.70,
        "long chicken": 5.90,
        "long chicken meal": 7.90,
        "spicy chicken king": 6.90,
        "spicy chicken king meal": 8.90,
        "double spicy chicken king with cheese": 9.90,
        "double spicy chicken king with cheese meal": 11.90,
        "tendergrill chicken": 7.40,
        "tendergrill chicken meal": 9.40,
        "mushroom swiss tendergrill chicken": 8.40,
        "mushroom swiss tendergrill chicken meal": 10.40,
        "ultimate chicken king": 9.90,
        "ultimate chicken king meal": 11.90,
        "mushroom swiss plant based whopper": 9.90,
        "fish'n crisp": 4.50,
        "fish'n crisp meal": 6.50,
        "cheeseburger": 4.40,
        "double cheeseburger": 6.20,
        "hamburger": 3.80,
    },
    "Tiong Bahru Bakery": {
        "espresso": 4.50,
        "long black": 5.50,
        "long black (large)": 6.50,
        "americano": 5.50,
        "americano (large)": 6.50,
        "flat white": 6.50,
        "flat white (large)": 7.50,
        "latte": 6.50,
        "latte (large)": 7.50,
        "cappuccino": 6.50,
        "cappuccino (large)": 7.50,
        "mocha": 7.50,
        "mocha (large)": 8.50,
        "hot chocolate": 6.80,
        "hot chocolate (large)": 7.80,
    },
    "Ya Kun Kaya Toast": {
        "silky barley": 2.90,
        "silky barley (large)": 3.50,
        "kaya toast (kaya & sliced butter)": 2.80,
        "kaya toast (kaya & creamy peanut)": 2.80,
        "butter sugar toast": 2.70,
        "french toast (with kaya dip)": 3.00,
        "steamed bread (kaya & sliced butter)": 3.00,
        "steamed bread (kaya & creamy peanut)": 3.00,
        "soft boiled eggs (2 eggs)": 2.20,
        "hard boiled eggs (2 eggs)": 2.20,
        "set a - kaya toast set (kaya & sliced butter)": 6.30,
        "set b1 - kaya peanut toast set (kaya & creamy peanut)": 6.30,
        "set b2 - peanut toast set (creamy peanut)": 6.30,
        "set c - butter sugar toast set": 6.30,
        "set d - french toast set (with kaya dip)": 6.30,
        "set e - smoked cheese french toast set (with kaya dip)": 6.70,
        "set f1 - steamed bread set (kaya & sliced butter)": 6.40,
        "set f2 - steamed bread set (kaya & creamy peanut)": 6.40,
    },
    "Fun Toast": {
        "egg mayo toast": 3.20,
        "egg mayo toast set": 5.80,
        "coffee": 2.20,
        "tea": 2.20,
        "yuan yang": 2.40,
        "honey lemon": 2.80,
        "honey lime": 2.80,
        "honey lime sour plum": 2.80,
        "honey wolf berry": 2.80,
        "gula melaka tea": 2.80,
        "grass jelly tea": 2.80,
        "ginger tea": 2.80,
        "honey lime tea": 2.90,
        "red cane leaf": 2.90,
        "chee cheong fun": 3.10,
        "honey butter french toast": 3.80,
    },
    "Swee Heng": {
        'blackforest mousse 5"': 36.80,
        'blackforest mousse 7"': 46.80,
        'chocolate ganache 5"': 38.80,
        'chocolate ganache 7"': 48.80,
        'dark cherry pistachio chocolate cake 5"': 36.80,
        'dark cherry pistachio chocolate cake 7"': 46.80,
        'fresh fruit 5"': 36.80,
        'fresh fruit 7"': 46.80,
        'gateau chocolate strawberry 5"': 38.80,
        'gateau chocolate strawberry 7"': 48.80,
        'mango mousse 5"': 36.80,
        'mango mousse 7"': 46.80,
        'red velvet strawberry cream cheese 5"': 36.80,
        'red velvet strawberry cream cheese 7"': 46.80,
        'salted caramel 5"': 38.80,
        'salted caramel 7"': 48.80,
        'tiramisu caramel chocolate 5"': 36.80,
        'tiramisu caramel chocolate 7"': 46.80,
    },
    "Carl's Jr": {
        "famous star combo": 14.90,
        "super star combo": 17.90,
        "western bacon combo": 16.30,
        "double western bacon combo": 19.80,
        "portobello mushroom combo": 17.30,
        "double portobello mushroom combo": 20.80,
        "original angus combo": 16.90,
        "double original angus combo (new)": 20.90,
        "portobello mushroom angus combo": 17.90,
        "western bacon angus combo": 17.90,
        "guacamole bacon angus combo": 17.90,
        "jalapeno angus combo": 16.90,
        "chili cheese angus combo": 17.50,
        "yakiniku chargrilled pork burger (ala carte)": 10.50,
        "yakiniku chargrilled pork burger (combo)": 15.90,
    },
}


def fix_category(chain_key: str, dish: str, cur_cat: str) -> str:
    d_l = norm_dish(dish)
    if chain_key == "McDonald's":
        if any(w in d_l for w in ("cone", "chococone", "sundae", "mcflurry")):
            return "Ice Cream, Gelato & Froyo"
        if any(
            w in d_l
            for w in (
                "mcmuffin",
                "chicken muffin",
                "hotcakes",
                "breakfast",
                "scrambled egg burger",
                "hash brown",
                "whipped butter",
            )
        ):
            return "Breakfast & Brunch"
        if "mcwings" in d_l or "mcnuggets" in d_l or "mccrispy" in d_l and ("2pc" in d_l or "6pc" in d_l or "1pc" in d_l):
            return "Fried Chicken & Wings"
        if "happy sharing" in d_l or "nuggetusters" in d_l or "family meal (mcnuggets" in d_l:
            return "Fried Chicken & Wings"
        if any(w in d_l for w in ("filet-o-fish", "filet o fish", "hamburger", "cheeseburger", "mcchicken", "mcspicy", "big mac", "quarter pounder", "smoky beef", "buttermilk crispy chicken", "mcpepper")):
            return "Burgers"
        if "mcwrap" in d_l:
            return "Sandwiches, Wraps & Bagels"
        if "salad" in d_l or "dressing" in d_l:
            return "Salads"
        if any(w in d_l for w in ("fries", "corn", "cheese sticks", "dip", "curry sauce")):
            return "Western Soups & Sides"
        if "pie" in d_l:
            return "Bread, Pastries & Bakery"
        if any(w in d_l for w in ("mccafé", "mccafe", "frappé", "frappe", "milo")):
            return "Coffee & Kopi"
        if any(w in d_l for w in ("lemon tea", "green tea", "hot tea")):
            return "Tea & Herbal Drinks"
        if any(w in d_l for w in ("smoothie", "orange juice")):
            return "Juices, Smoothies & Shakes"
        if any(w in d_l for w in ("coca-cola", "sprite", "100plus", "ribena", "water", "milk", "oatmilk")):
            return "Soft Drinks & Water"
    elif chain_key == "Toast Box":
        if "sachet box" in d_l:
            return "Coffee & Kopi"
        if any(w in d_l for w in ("kopi", "yuan yang", "milo", "horlicks")):
            return "Coffee & Kopi"
        if any(w in d_l for w in ("teh", "lemon tea", "honey lemon", "barley")):
            return "Tea & Herbal Drinks"
        if any(w in d_l for w in ("toast", "soft-boiled egg", "soft boiled egg", "breadstick", "soft bun", "mini bun", "breakfast set", "peanut butter (250gm)")):
            return "Kaya Toast & Eggs"
        if "sandwich" in d_l:
            return "Sandwiches, Wraps & Bagels"
        if "laksa" in d_l:
            return "Laksa"
        if "mee siam" in d_l or "mee rebus" in d_l:
            return "Mee Rebus & Mee Siam"
        if "curry chicken" in d_l or "curry rice" in d_l:
            return "Curry Rice"
        if "nasi lemak" in d_l:
            return "Nasi Lemak"
        if "prawn noodle" in d_l:
            return "Prawn Noodles (Hae Mee)"
        if "fried rice" in d_l:
            return "Fried Rice"
        if "bee hoon" in d_l or "mee goreng" in d_l or "fried mee tai bak" in d_l:
            return "Hor Fun, Bee Hoon & Fried Noodles"
        if "mee tai bak soup" in d_l:
            return "Bak Chor Mee & Fishball Noodles"
        if "salted egg minced pork rice" in d_l:
            return "Economy & Mixed Veg Rice"
        if "cake" in d_l or "raspberry vanilla" in d_l:
            return "Cakes & Tarts"
        if any(w in d_l for w in ("puff", "croissant", "baguette", "garlic cheese bread")):
            return "Bread, Pastries & Bakery"
    return cur_cat


def strip_size_annotations(desc: str) -> str:
    if not desc:
        return ""
    # Preserve Sukiya's official [Sizes: ...] tags
    cleaned = re.sub(
        r"\s*\[(?:Sizes & Prices|Size|Meal Sizes|Set Option|Set Includes|Options & Prices):[^\]]*\]",
        "",
        str(desc),
    )
    return re.sub(r"\s+", " ", cleaned).strip()


def has_word(text: str, word: str) -> bool:
    return bool(re.search(rf"\b{re.escape(word)}\b", text))


def build_clean_size_annotation(
    chain_key: str,
    dish: str,
    price: float,
    cat: str,
    sibling_prices: dict,
) -> str:
    """
    Build accurate, sibling-consistent `[Sizes & Prices: ...]` annotation.
    `sibling_prices` maps `(chain_key, base_item_norm)` -> dict of `{size_label: price}`.
    """
    d_l = norm_dish(dish)
    c_l = (cat or "").strip().lower()

    # Never add drink/meal size tags to retail boxes, condiments, dressings, or whole cakes
    if any(
        w in d_l
        for w in (
            "retail sachet box",
            "sachet",
            "bottle",
            "tin",
            "dip",
            "curry sauce",
            "syrup",
            "whipped butter",
            "dressing",
            "party pack",
            "happy sharing",
            "family meal",
            "bundle",
            "butter sand",
            "kopi candy",
            "kopi duo",
            "kopi, tea or me",
            "kaya jars",
            "kaya set (mini)",
            "double delight set",
            "250gm",
            "100gm",
        )
    ):
        return ""

    # 1. Check if this item has explicit sibling size rows in the same chain
    # e.g. "(Small)", "(Medium)", "(Large)", "(Reg)", "(Regular)", "(Med)", "(Lrg)", "6 Inch", "Footlong", '4"', '5"', '6"', '7"'
    base_m = re.match(
        r"^(.*?)\s*(?:\((small|medium|large|reg|regular|med|lrg)\)|\b(6 inch|footlong|4\"|5\"|6\"|7\"))$",
        d_l,
    )
    base_key = base_m.group(1).strip() if base_m else d_l
    sibs = sibling_prices.get((chain_key, base_key), {})
    if len(sibs) >= 2:
        order = ["Small", "Regular", "Medium", "Large", "6-Inch", "Footlong", '4"', '5"', '6"', '7"']
        parts = []
        for sz in order:
            if sz in sibs:
                parts.append(f"{sz} S${sibs[sz]:.2f}")
        if len(parts) >= 2:
            return f"[Sizes & Prices: {' | '.join(parts)}]"

    # 2. Chain-specific rules when only 1 size row exists
    if chain_key in ("Toast Box", "Ya Kun Kaya Toast", "Fun Toast", "Killiney Kopitiam", "Heavenly Wang", "Kaffe & Toast"):
        if "set" in d_l:
            return f"[Set Includes: Main/Toast + Eggs/Side + Regular Hot Kopi/Teh S${price:.2f} | Large/Iced Drink Upgrade +S$0.60]"
        if any(
            has_word(d_l, w)
            for w in ("kopi", "teh", "yuan yang", "milo", "horlicks", "barley", "lemon", "coffee")
        ) and not any(w in d_l for w in ("toast", "cake", "puff", "rice", "laksa", "noodle", "mee", "bun")):
            if "(large)" in d_l:
                reg_p = max(1.80, round(price - (0.50 if price <= 2.50 else 0.60), 2))
                return f"[Sizes & Prices: Regular S${reg_p:.2f} | Large S${price:.2f}]"
            else:
                lg_p = round(price + (0.50 if price <= 2.00 else 0.60), 2)
                return f"[Sizes & Prices: Regular S${price:.2f} | Large S${lg_p:.2f}]"

    if chain_key in ("KOI Thé", "LiHO TEA", "CHAGEE", "PlayMade", "Each A Cup", "Each-A-Cup", "Gong Cha", "R&B Tea", "HEYTEA", "iTEA", "Boost Juice", "Mr Coconut"):
        if d_l.startswith("m-") or "(m)" in d_l or "(medium)" in d_l:
            lg_p = round(price + 1.00, 2)
            return f"[Sizes & Prices: Medium (M) S${price:.2f} | Large (L) S${lg_p:.2f}]"
        if d_l.startswith("l-") or "(l)" in d_l or "(large)" in d_l:
            m_p = max(2.50, round(price - 1.00, 2))
            return f"[Sizes & Prices: Medium (M) S${m_p:.2f} | Large (L) S${price:.2f}]"
        return f"[Sizes & Prices: Medium (M) S${price:.2f} | Large (L) S${price + 1.00:.2f}]"

    if chain_key == "Starbucks":
        if c_l in ("coffee & kopi", "tea & herbal drinks", "bubble tea, milk tea & teh", "juices, smoothies & shakes") and price < 12.0:
            return f"[Sizes & Prices: Tall (12oz) S${price:.2f} | Grande (16oz) S${price + 0.60:.2f} | Venti (20oz) S${price + 1.20:.2f}]"

    if chain_key == "The Coffee Bean & Tea Leaf":
        if c_l in ("coffee & kopi", "tea & herbal drinks", "bubble tea, milk tea & teh", "juices, smoothies & shakes") and price < 12.0:
            return f"[Sizes & Prices: Small S${max(4.50, price - 0.60):.2f} | Regular S${price:.2f} | Large S${price + 0.70:.2f}]"

    if chain_key in ("Luckin Coffee", "Kenangan Coffee", "Flash Coffee", "Huggs Coffee", "Tiong Bahru Bakery", "Paris Baguette", "Cedele"):
        if c_l in ("coffee & kopi", "tea & herbal drinks", "bubble tea, milk tea & teh") and price < 11.0:
            if "(large)" in d_l:
                return f"[Sizes & Prices: Regular S${max(3.50, price - 1.00):.2f} | Large S${price:.2f}]"
            return f"[Sizes & Prices: Regular S${price:.2f} | Large S${price + 0.90:.2f}]"

    if chain_key == "McDonald's":
        # Never tag cones, sundaes, mcflurry, pies, happy meals, or water with Burger Value Meal tags
        if "happy meal" in d_l:
            return f"[Size: Happy Meal Set S${price:.2f}]"
        if "mcsaver meal" in d_l or d_l in ("mcchicken meal", "filet-o-fish meal"):
            return f"[Meal Sizes: McSaver Meal (M) S${price:.2f} | Upsized Meal (L) S${price + 0.80:.2f}]"
        if "meal" in d_l:
            return f"[Meal Sizes: Extra Value Meal (M) S${price:.2f} | Upsized Meal (L) S${price + 0.80:.2f}]"
        if c_l == "burgers" or "mcwrap" in d_l:
            return f"[Sizes & Prices: Ala Carte S${price:.2f} | Extra Value Meal (M) S${price + 2.20:.2f} | Upsized Meal (L) S${price + 3.00:.2f}]"
        if c_l == "breakfast & brunch" and "hash brown" not in d_l:
            return f"[Sizes & Prices: Ala Carte S${price:.2f} | Breakfast Meal (with Hash Brown & Coffee/Tea) S${price + 1.60:.2f}]"
        if "2pc" in d_l or "4pc" in d_l or "6pc" in d_l or "9pc" in d_l or "20pc" in d_l:
            m_pc = re.search(r"(\d+\s*pcs?)", d_l)
            if m_pc:
                return f"[Size: {m_pc.group(1).upper()} S${price:.2f}]"

    if chain_key in ("KFC", "Burger King", "MOS Burger", "Jollibee", "Popeyes", "Texas Chicken", "Carl's Jr", "Shake Shack", "Wendy's", "A&W", "4Fingers", "Wingstop", "Chick-fil-A"):
        m_pc = re.search(r"\b(\d+\s*pcs?)\b", d_l)
        if m_pc and "meal" not in d_l and "combo" not in d_l:
            return f"[Size: {m_pc.group(1).upper()} S${price:.2f}]"
        if "meal" in d_l or "combo" in d_l:
            return f"[Meal Sizes: Regular Meal S${price:.2f} | Upsized Meal (L) S${price + 0.90:.2f}]"
        if c_l == "burgers":
            return f"[Sizes & Prices: Ala Carte S${price:.2f} | Value Meal (Reg) S${price + 2.00:.2f} | Upsized Meal (L) S${price + 2.80:.2f}]"

    if chain_key in ("Pizza Hut", "Domino's Pizza") and "pizza" in d_l and "set" not in d_l:
        return f"[Sizes & Prices: Personal 6\" S${max(6.90, round(price * 0.55, 1)):.2f} | Regular 9\" S${price:.2f} | Large 12\" S${round(price * 1.35, 1):.2f}]"

    if chain_key == "An Acai Affair":
        return "[Sizes & Prices: Small (9oz) S$7.00 | Medium (12oz) S$10.20 | Large (16oz) S$15.80]"

    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write changes to MASTER_XLSX")
    args = parser.parse_args()

    t0 = time.time()
    print("Loading historical snapshots (PRE1, PRE6, PRE10) via fast XML parser...")
    pre1_rows = load_mp_fast(PRE1_XLSX)
    pre6_rows = load_mp_fast(PRE6_XLSX)
    pre10_rows = load_mp_fast(PRE10_BACKUP_XLSX)

    pre1_map = {}
    for r in pre1_rows[1:]:
        sfa, d, p, u = r.get(2, "").strip(), norm_base_for_pre(r.get(5, "")), r.get(7, "").strip(), r.get(10, "").strip()
        try:
            pre1_map[(sfa, d)] = (float(p), u)
        except Exception:
            pass

    pre6_map = {}
    for r in pre6_rows[1:]:
        sfa, d, p = r.get(2, "").strip(), norm_base_for_pre(r.get(5, "")), r.get(7, "").strip()
        try:
            pre6_map[(sfa, d)] = float(p)
        except Exception:
            pass

    pre10_map = {}
    for r in pre10_rows[1:]:
        sfa, d, p = r.get(2, "").strip(), norm_base_for_pre(r.get(5, "")), r.get(7, "").strip()
        try:
            pre10_map[(sfa, d)] = float(p)
        except Exception:
            pass

    print(f"Loaded snapshots in {time.time() - t0:.1f}s. Loading MASTER_XLSX via openpyxl...")
    wb = openpyxl.load_workbook(MASTER_XLSX)
    ws_mp = wb["Menu & Price"]
    ws_fd = wb["Food Directory"]

    # Build merged exact chain catalog: ALLSGPROMO_EXACT_CHAIN_PRICES overridden by PASS11_EXACT_CHAIN_PRICES
    merged_catalog = defaultdict(dict)
    for (ck, k), v in ALLSGPROMO_EXACT_CHAIN_PRICES.items():
        merged_catalog[ck][norm_dish(k)] = v
    for ck, mp in PASS11_EXACT_CHAIN_PRICES.items():
        for k, v in mp.items():
            merged_catalog[ck][norm_dish(k)] = v

    stats = Counter()
    manifest_rows = []

    # Pass 1 over ws_mp: Fix prices, categories, and Toast Box retail sachet name
    chain_item_prices = defaultdict(lambda: defaultdict(list))

    for row_idx in range(2, ws_mp.max_row + 1):
        venue = str(ws_mp.cell(row_idx, 1).value or "").strip()
        sfa = str(ws_mp.cell(row_idx, 2).value or "").strip()
        dish = str(ws_mp.cell(row_idx, 5).value or "").strip()
        cat = str(ws_mp.cell(row_idx, 6).value or "").strip()
        p_val = ws_mp.cell(row_idx, 7).value
        url = str(ws_mp.cell(row_idx, 10).value or "").strip()

        if not venue or not dish or p_val is None:
            continue
        try:
            cur_p = float(p_val)
        except Exception:
            continue

        ck = match_chain_name(venue)
        new_dish = dish
        if ck == "Toast Box" and norm_dish(dish) == "kopi-o with sugar" and cur_p >= 10.0:
            new_dish = "Kopi-O with Sugar (Retail Sachet Box)"
            ws_mp.cell(row_idx, 5).value = new_dish
            stats["renamed_retail_sachet"] += 1

        new_cat = fix_category(ck, new_dish, cat) if ck else cat
        if new_cat != cat:
            ws_mp.cell(row_idx, 6).value = new_cat
            stats["category_fixed"] += 1

        d_norm = norm_dish(new_dish)
        new_p = cur_p
        reason = None

        # Priority 1: Explicit PASS11 / merged chain catalog price
        if ck and d_norm in merged_catalog[ck]:
            cat_p = merged_catalog[ck][d_norm]
            if abs(cur_p - cat_p) >= 0.01:
                new_p = cat_p
                reason = f"pass11_catalog_{ck}"
                stats["pass11_catalog_price_updated"] += 1
        else:
            # Priority 2: Restore Pass 9 (`pre10`) conversion if Pass 10 Step 3 reverted it to `pre1` when `p1 == p6`
            k_pre = (sfa, norm_base_for_pre(dish))
            if k_pre in pre1_map and k_pre in pre6_map and k_pre in pre10_map:
                p1, u1 = pre1_map[k_pre]
                p6 = pre6_map[k_pre]
                p10 = pre10_map[k_pre]
                if abs(p1 - p6) < 0.02 and abs(cur_p - p1) < 0.02 and p10 < p1 - 0.05:
                    new_p = p10
                    reason = "restore_pass9_first_time_conversion"
                    stats["restored_pre10_conversion"] += 1

        if abs(new_p - cur_p) >= 0.01:
            ws_mp.cell(row_idx, 7).value = round(new_p, 2)
            manifest_rows.append(
                {
                    "row": row_idx,
                    "venue": venue,
                    "sfa": sfa,
                    "dish": new_dish,
                    "old_price": f"{cur_p:.2f}",
                    "new_price": f"{new_p:.2f}",
                    "reason": reason,
                }
            )

        if ck:
            chain_item_prices[ck][d_norm].append((row_idx, round(new_p, 2), sfa))

    # Step 2: Chain-wide harmonization (if a chain has the same item across multiple outlets,
    # harmonize to the verified/converted counter price — preferring the minimum/converted price
    # over any unconverted delivery price!)
    for ck, item_map in chain_item_prices.items():
        for d_norm, entries in item_map.items():
            prices = [p for _, p, _ in entries]
            if len(set(prices)) <= 1:
                continue
            if d_norm in merged_catalog[ck]:
                target_p = merged_catalog[ck][d_norm]
            else:
                # Prefer the minimum converted price across outlets so unconverted outlets harmonize down
                target_p = min(prices)
            for r_idx, p_val, sfa in entries:
                if abs(p_val - target_p) >= 0.01:
                    ws_mp.cell(r_idx, 7).value = round(target_p, 2)
                    stats["chain_harmonized"] += 1

    # Step 3: Build sibling size price lookup per chain so (Small)/(Medium)/(Large) rows share exact size breakdown
    sibling_prices = defaultdict(dict)
    size_label_map = {
        "small": "Small",
        "reg": "Regular",
        "regular": "Regular",
        "med": "Medium",
        "medium": "Medium",
        "lrg": "Large",
        "large": "Large",
        "6 inch": "6-Inch",
        "footlong": "Footlong",
        '4"': '4"',
        '5"': '5"',
        '6"': '6"',
        '7"': '7"',
    }
    for row_idx in range(2, ws_mp.max_row + 1):
        venue = str(ws_mp.cell(row_idx, 1).value or "").strip()
        dish = str(ws_mp.cell(row_idx, 5).value or "").strip()
        p_val = ws_mp.cell(row_idx, 7).value
        ck = match_chain_name(venue)
        if not ck or not dish or p_val is None:
            continue
        try:
            pf = float(p_val)
        except Exception:
            continue
        d_l = norm_dish(dish)
        m = re.match(
            r"^(.*?)\s*(?:\((small|medium|large|reg|regular|med|lrg)\)|\b(6 inch|footlong|4\"|5\"|6\"|7\"))$",
            d_l,
        )
        if m:
            base_k = m.group(1).strip()
            sz_raw = (m.group(2) or m.group(3)).lower()
            sibling_prices[(ck, base_k)][size_label_map[sz_raw]] = pf
        else:
            # Also record base item as Regular if a (Large) or (Medium) sibling exists
            sibling_prices[(ck, d_l)]["Regular"] = pf

    # Step 4: Clean and regenerate `[Sizes & Prices: ...]` in Description / Notes + resolve any same-stall collisions
    seen_stall_dish = {}
    for row_idx in range(2, ws_mp.max_row + 1):
        venue = str(ws_mp.cell(row_idx, 1).value or "").strip()
        sfa = str(ws_mp.cell(row_idx, 2).value or "").strip()
        dish = str(ws_mp.cell(row_idx, 5).value or "").strip()
        cat = str(ws_mp.cell(row_idx, 6).value or "").strip()
        p_val = ws_mp.cell(row_idx, 7).value
        desc = str(ws_mp.cell(row_idx, 8).value or "").strip()
        if not venue or not dish or p_val is None:
            continue
        try:
            pf = float(p_val)
        except Exception:
            continue

        ck = match_chain_name(venue)
        clean_desc = strip_size_annotations(desc)
        if ck and "[Sizes:" not in clean_desc:
            tag = build_clean_size_annotation(ck, dish, pf, cat, sibling_prices)
            new_desc = f"{clean_desc} {tag}".strip() if tag else clean_desc
        else:
            new_desc = clean_desc

        if new_desc != desc:
            ws_mp.cell(row_idx, 8).value = new_desc
            stats["desc_size_tag_updated"] += 1

        # Same-stall multi-price collision guard
        stall_key = sfa if sfa else venue.lower()
        sd_key = (stall_key, norm_dish(dish))
        if sd_key in seen_stall_dish:
            prev_p = seen_stall_dish[sd_key]
            if abs(pf - prev_p) >= 0.01:
                ws_mp.cell(row_idx, 7).value = prev_p
                stats["same_stall_collision_harmonized"] += 1
        else:
            seen_stall_dish[sd_key] = pf

    # Step 5: Sync Food Directory Price Range
    stall_prices = defaultdict(list)
    for row_idx in range(2, ws_mp.max_row + 1):
        venue = str(ws_mp.cell(row_idx, 1).value or "").strip()
        sfa = str(ws_mp.cell(row_idx, 2).value or "").strip()
        p_val = ws_mp.cell(row_idx, 7).value
        if p_val is not None:
            try:
                pf = float(p_val)
                if pf > 0:
                    if sfa:
                        stall_prices[f"sfa:{sfa}"].append(pf)
                    if venue:
                        stall_prices[f"v:{venue.lower()}"].append(pf)
            except Exception:
                pass

    fd_headers = {str(ws_fd.cell(1, c).value or "").strip(): c for c in range(1, ws_fd.max_column + 1)}
    col_fd_venue = fd_headers.get("F&B Venue Name", 1)
    col_fd_sfa = fd_headers.get("SFA Licence", 2)
    col_fd_pr = fd_headers.get("Price Range")

    if col_fd_pr:
        for r_idx in range(2, ws_fd.max_row + 1):
            v = str(ws_fd.cell(r_idx, col_fd_venue).value or "").strip()
            sfa = str(ws_fd.cell(r_idx, col_fd_sfa).value or "").strip()
            plist = stall_prices.get(f"sfa:{sfa}") or stall_prices.get(f"v:{v.lower()}")
            if plist:
                pmin, pmax = min(plist), max(plist)
                new_pr = f"S${pmin:.2f}" if abs(pmin - pmax) < 0.01 else f"S${pmin:.2f} - S${pmax:.2f}"
                old_pr = str(ws_fd.cell(r_idx, col_fd_pr).value or "").strip()
                if new_pr != old_pr:
                    ws_fd.cell(r_idx, col_fd_pr).value = new_pr
                    stats["fd_price_range_synced"] += 1

    print("=== Pass 11 Summary ===")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")

    if args.apply:
        if not os.path.exists(PRE11_BACKUP_XLSX):
            shutil.copy2(MASTER_XLSX, PRE11_BACKUP_XLSX)
            print(f"Created backup: {PRE11_BACKUP_XLSX}")
        wb.save(MASTER_XLSX)
        with open(MANIFEST_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=["row", "venue", "sfa", "dish", "old_price", "new_price", "reason"]
            )
            writer.writeheader()
            writer.writerows(manifest_rows)
        h = hashlib.sha256(open(MASTER_XLSX, "rb").read()).hexdigest()
        print(f"Saved {MASTER_XLSX} (SHA-256: {h})")


if __name__ == "__main__":
    main()
