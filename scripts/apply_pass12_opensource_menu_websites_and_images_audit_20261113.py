#!/usr/bin/env python3
"""
Pass 12 Open-Source Singapore Menu Website Text & Counter Board Image Cross-Check Audit (2026-11-13)
====================================================================================================
Cross-checks and remediates menu items, counter prices, size breakdowns, categories, and
cross-merchant / non-food / HTML-table contaminations across chain and non-chain stalls in:
  outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx

Open-source references cross-checked (website text + counter menu board images):
  - Counter menu board images inspected:
      * Toast Box counter menu board (toastbox_1.jpg / toast-box-menu-1.jpg)
      * The Coffee Bean & Tea Leaf Espresso/Coffee, Ice Blended, and Tea counter boards
        (coffeebean_1.jpg, coffeebean_iceblended.jpg, coffeebean_tea.jpg)
      * Jollibee Singapore counter menu boards (jollibee_1.jpg, jollibee_2.jpg)
      * Subway Singapore menu board (subway_1.jpg) & subdelivery.com.sg / menus.sg
      * KFC Singapore menu images (kfc_1.jpg, kfc_2.jpg)
  - Open-source Singapore menu websites & official brand stores:
      * allsgpromo.com, sgmenuprices.com, menus.sg, menuhub.sg
      * eatbook.sg, sethlui.com, danielfooddiary.com, 8days.sg
      * huggscoffee.com, subdelivery.com.sg, boostjuicebars.com.sg, breadtalk.com.sg,
        coffeebean.com.sg, sweeheng.com.sg, funtoast.com.sg, yakun.com, jollibee.com.sg
"""

import argparse
import html
import os
import re
import shutil
from collections import defaultdict
import openpyxl

MASTER_XLSX = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_XLSX = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass12_opensource_websites_audit_2026-11-13.xlsx"


def norm(s: str) -> str:
    s = html.unescape(str(s or "")).strip().lower()
    s = re.sub(r"[®™©]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


# 1. Cross-merchant contaminated items to clear (blank out row in Menu & Price)
LUCKIN_CONTAMINATED_EGA_JUICE = {
    "bright",
    "cleanse",
    "glow",
    "green",
    "green 1",
    "joy",
    "natural anti - aging",
    "natural headache/ nausea relief",
    "natural immunobooster",
    "nirvana",
    "power",
    "re-energize (medium)",
}

YAKUN_CONTAMINATED_ITEMS = {
    "almond croissant",
    "bandung",
    "butter croissant",
    "char kway teow",
    "chee cheong fun & siew mai",
    "cheese boat",
    "chicken satay (10 sticks)",
    "chocolate croissant",
    "collection set",
    "curry chicken puff",
    "curry chicken with bread",
    "curry chicken with rice",
    "egg roti prata",
    "fried mee tai bak with chinese sausage",
    "garlic cheese bread",
    "hokkien mee",
    "kaya butter toast",
    "kaya toast set",
    "kopi c",
    "kopi o",
    "kopi-o",
    "mixed satay (10 sticks)",
    "multigrain ham & cheese sandwich",
    "mutton satay (10 sticks)",
    "nasi lemak with fried chicken",
    "otah",
    "otah toast",
    "peanut butter toast set",
    "peanut thick toast",
    "plain roti prata",
    "portuguese egg tart",
    "red bean bun",
    "roasted chicken rice",
    "sambal kang kong",
    "sausage roll",
    "set of 2 asian delight paste",
    "signature laksa",
    "soft-boiled eggs (2 pcs)",
    "sourdough loaf",
    "sunflower bun",
    "teh",
    "teh c",
    "teh o",
    "teh tarik",
    "teochew salted egg bak chang set with m-size hot beverage 潮州咸蛋肉粽",
    "teochew salted egg bak chang 潮州咸蛋肉粽",
    "traditional kaya toast",
    "tuna bun",
    "yam croissant",
}

LIHO_CONTAMINATED_TEMPLATE_ITEMS = {
    "cafe latte",
    "cappuccino",
    "espresso",
    "flat white",
    "hot chocolate",
    "iced kopi",
    "iced latte",
    "iced lemon tea",
    "kopi o",
    "milo dinosaur",
    "teh",
    "teh o",
}

CBTL_CONTAMINATED_TEMPLATE_PAIRS = {
    ("espresso", 3.00),
    ("cafe latte", 5.50),
    ("cappuccino", 5.50),
    ("flat white", 5.80),
    ("hot chocolate", 4.50),
    ("iced latte", 6.00),
}

CAFE_001_NON_FOOD_ITEMS = {
    "400ml u bottom cup with lid",
    "8oz cup with lid",
    "500ml cup with lid",
    "tissue pack",
    "750ml round kraft bowl",
    "250ml takeaway round container with lid",
}


def is_swee_heng_non_food(dish_norm: str) -> bool:
    if "candle" in dish_norm or "fork & plate" in dish_norm or "happy birthday gold topper" in dish_norm:
        return True
    return False


# 2. Exact Pass 12 Open-Source Website & Counter Menu Board Corrections
# Format: chain_key -> { normalized_dish: (new_price, optional_sizes_note, optional_category_override) }
PASS12_CHAIN_UPDATES = {
    "the coffee bean & tea leaf": {
        # Sliced cakes vs whole cakes fix + counter menu board (coffeebean_1.jpg, coffeebean_iceblended.jpg, coffeebean_tea.jpg)
        "homestyle carrot cake": (7.50, "Sizes & Prices: Slice $7.50 | Whole Cake (9\") $55.00", "Cakes & Tarts"),
        "👍 chicago cheesecake": (7.50, "Sizes & Prices: Slice $7.50 | Whole Cake (9\") $55.00", "Cakes & Tarts"),
        "👍 chocolate of a thousand leaves": (7.50, "Sizes & Prices: Slice $7.50 | Whole Cake (9\") $55.00", "Cakes & Tarts"),
        "pandan gula melaka cake": (7.50, "Sizes & Prices: Slice $7.50 | Whole Cake (8\") $78.00", "Cakes & Tarts"),
        "yuzu osmanthus cake": (8.00, "Sizes & Prices: Slice $8.00", "Cakes & Tarts"),
        # Espresso & Coffee counter board (coffeebean_1.jpg)
        "americano": (5.50, "Sizes & Prices: Small $5.00 | Regular $5.50 | Large $5.90", "Coffee & Kopi"),
        "americano (reg)": (5.50, "Sizes & Prices: Small $5.00 | Regular $5.50 | Large $5.90", "Coffee & Kopi"),
        "hazelnut americano": (6.70, "Sizes & Prices: Small $6.20 | Regular $6.70 | Large $7.20", "Coffee & Kopi"),
        "hazelnut americano (reg)": (6.70, "Sizes & Prices: Small $6.20 | Regular $6.70 | Large $7.20", "Coffee & Kopi"),
        "café latte (reg)": (6.80, "Sizes & Prices: Small $6.20 | Regular $6.80 | Large $7.30", "Coffee & Kopi"),
        "👍 café latte": (6.80, "Sizes & Prices: Small $6.20 | Regular $6.80 | Large $7.30", "Coffee & Kopi"),
        "single origin latte": (7.60, "Sizes & Prices: Small $7.00 | Regular $7.60 | Large $8.10", "Coffee & Kopi"),
        "single origin latte (reg)": (7.60, "Sizes & Prices: Small $7.00 | Regular $7.60 | Large $8.10", "Coffee & Kopi"),
        "mocha latte": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "mocha latte (reg)": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "hazelnut latte": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "hazelnut latte (reg)": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "vanilla latte": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "vanilla latte (reg)": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "dark chocolate latte": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "dark chocolate latte (reg)": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "salted caramel latte": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "salted caramel latte (reg)": (7.80, "Sizes & Prices: Small $7.30 | Regular $7.80 | Large $8.10", "Coffee & Kopi"),
        "salted caramel macchiato": (7.60, "Sizes & Prices: Small $7.00 | Regular $7.60 | Large $8.10", "Coffee & Kopi"),
        "salted caramel macchiato (reg)": (7.60, "Sizes & Prices: Small $7.00 | Regular $7.60 | Large $8.10", "Coffee & Kopi"),
        "spanish latte": (7.30, "Sizes & Prices: Small $6.80 | Regular $7.30 | Large $7.80", "Coffee & Kopi"),
        "spanish latte (reg)": (7.30, "Sizes & Prices: Small $6.80 | Regular $7.30 | Large $7.80", "Coffee & Kopi"),
        "cold brew": (6.30, "Sizes & Prices: Small $5.90 | Regular $6.30 | Large $6.60", "Coffee & Kopi"),
        "cold brew vanilla bean": (7.60, "Sizes & Prices: Regular $7.60", "Coffee & Kopi"),
        "cold brew salted caramel": (7.60, "Sizes & Prices: Regular $7.60", "Coffee & Kopi"),
        # Ice Blended counter board (coffeebean_iceblended.jpg)
        "the original mocha (coffee-based)": (7.80, "Sizes & Prices: Small $7.10 | Regular $7.80 | Large $8.80", "Coffee & Kopi"),
        "the original vanilla (coffee-based)": (7.80, "Sizes & Prices: Small $7.10 | Regular $7.80 | Large $8.80", "Coffee & Kopi"),
        "the ultimate mocha (coffee-based)": (8.00, "Sizes & Prices: Small $7.40 | Regular $8.00 | Large $8.90", "Coffee & Kopi"),
        "hazelnut (coffee-based)": (7.90, "Sizes & Prices: Small $7.20 | Regular $7.90 | Large $8.90", "Coffee & Kopi"),
        "dark chocolate (coffee-based)": (7.90, "Sizes & Prices: Small $7.20 | Regular $7.90 | Large $8.90", "Coffee & Kopi"),
        "salted caramel (coffee-based)": (7.90, "Sizes & Prices: Small $7.20 | Regular $7.90 | Large $8.90", "Coffee & Kopi"),
        "choc cookie crumble ice blended": (8.20, "Sizes & Prices: Small $7.60 | Regular $8.20 | Large $8.90", "Coffee & Kopi"),
        "pure dark chocolate (caffeine-free)": (7.90, "Sizes & Prices: Small $7.20 | Regular $7.90 | Large $8.90", "Coffee & Kopi"),
        "pure vanilla (caffeine-free)": (7.90, "Sizes & Prices: Small $7.20 | Regular $7.90 | Large $8.90", "Coffee & Kopi"),
        "pure salted caramel (caffeine-free)": (7.90, "Sizes & Prices: Small $7.20 | Regular $7.90 | Large $8.90", "Coffee & Kopi"),
        "matcha (tea-based)": (8.20, "Sizes & Prices: Small $7.20 | Regular $8.20 | Large $9.00", "Bubble Tea, Milk Tea & Teh"),
        # Tea counter board (coffeebean_tea.jpg)
        "chai tea latte": (7.60, "Sizes & Prices: Small $6.90 | Regular $7.60 | Large $7.90", "Tea & Herbal Drinks"),
        "matcha green tea latte": (7.60, "Sizes & Prices: Small $6.90 | Regular $7.60 | Large $7.90", "Bubble Tea, Milk Tea & Teh"),
        "organic matcha latte": (7.60, "Sizes & Prices: Small $6.90 | Regular $7.60 | Large $7.90", "Bubble Tea, Milk Tea & Teh"),
        "english breakfast tea latte": (6.90, "Sizes & Prices: Small $6.60 | Regular $6.90 | Large $7.30", "Tea & Herbal Drinks"),
        "hot dark chocolate": (7.10, "Sizes & Prices: Small $6.60 | Regular $7.10 | Large $7.80", "Coffee & Kopi"),
        "hot vanilla": (7.10, "Sizes & Prices: Small $6.60 | Regular $7.10 | Large $7.80", "Coffee & Kopi"),
        "peach jasmine cold brew tea with jelly": (7.20, "Sizes & Prices: Small $6.70 | Regular $7.20 | Large $8.00", "Tea & Herbal Drinks"),
        "watermelon mint lychee cold brew tea": (7.20, "Sizes & Prices: Small $6.70 | Regular $7.20 | Large $8.00", "Tea & Herbal Drinks"),
        "yuzu sencha cold brew tea with jelly & chia seeds": (7.20, "Sizes & Prices: Small $6.70 | Regular $7.20 | Large $8.00", "Tea & Herbal Drinks"),
        "java to go - cold brew coffee": (30.60, None, "Coffee & Kopi"),
        "java-to-go": (27.20, None, "Coffee & Kopi"),
        "java-to-go cold brew coffee": (30.60, None, "Coffee & Kopi"),
        "java-to-go cold brew tea": (30.60, None, "Tea & Herbal Drinks"),
    },
    "breadtalk": {
        "dark forest gateau": (6.90, "Sizes & Prices: Cup/Slice $6.90 | 4\" Whole $24.30 | 6\" Whole $40.60", "Cakes & Tarts"),
        "lychee rose": (6.90, "Sizes & Prices: Cup/Slice $6.90 | 4\" Whole $24.30 | 6\" Whole $40.60", "Cakes & Tarts"),
        "strawberry shortcake": (6.90, "Sizes & Prices: Cup/Slice $6.90 | 4\" Whole $27.40 | 6\" Whole $44.70", "Cakes & Tarts"),
        "mango chantilly cup": (6.90, "Sizes & Prices: Cup $6.90 | 4\" Whole $24.30 | 6\" Whole $40.60", "Cakes & Tarts"),
        "chantilly cup": (6.90, "Sizes & Prices: Cup $6.90 | 4\" Whole $24.30 | 6\" Whole $40.60", "Cakes & Tarts"),
        "strawberry yogurt cup": (6.90, "Sizes & Prices: Cup $6.90 | 4\" Whole $27.40 | 6\" Whole $44.70", "Cakes & Tarts"),
        "bottled pork floss": (9.50, None, "Bread, Pastries & Bakery"),
        "japan light cheesecake": (14.10, None, "Cakes & Tarts"),
        "strawberry japan light cheese cake 草莓日式轻乳酪": (14.10, None, "Cakes & Tarts"),
        "palmier french pastry (2 original + 2 chocolate) 原味+巧克力法国蝴蝶酥": (10.80, None, "Bread, Pastries & Bakery"),
        "palmier french pastry (2 original + 2 strawberry) 原味+草莓法国蝴蝶酥": (10.80, None, "Bread, Pastries & Bakery"),
        "chocolate bun 巧克力餐包": (4.70, None, "Bread, Pastries & Bakery"),
        "pesto cheese bun 罗勒芝士餐包": (4.70, None, "Bread, Pastries & Bakery"),
        "cottony cake (original + cocoa) 原味+可可棉花蛋糕": (5.00, None, "Cakes & Tarts"),
        "mango swiss roll 芒果瑞士卷": (8.10, None, "Cakes & Tarts"),
        "pandan swiss roll 班兰瑞士卷": (8.10, None, "Cakes & Tarts"),
    },
    "fun toast": {
        "ondeh ondeh soft bun": (2.90, "Sizes & Prices: Ala Carte $2.90 | Set $5.10", "Bread, Pastries & Bakery"),
        "ondeh-ondeh soft bun": (2.90, "Sizes & Prices: Ala Carte $2.90 | Set $5.10", "Bread, Pastries & Bakery"),
        "otah cheese soft bun set": (5.50, "Sizes & Prices: Ala Carte $4.40 | Set $5.50", "Satay & Otah"),
        "curry chicken with rice/soft bun/chee cheong fun": (6.60, "Sizes & Prices: Ala Carte $6.60 | Set $10.50", "Curry Rice"),
        "soya sauce chicken with rice/chee cheong fun": (6.60, "Sizes & Prices: Ala Carte $6.60 | Set $10.50", "Chicken Rice"),
        "shredded chicken soup with bee hoon/noodle/macaroni": (5.60, "Sizes & Prices: Ala Carte $5.60 | Set $9.50", "Traditional & Herbal Soups"),
        "siew mai": (2.60, "Sizes & Prices: 2 pcs $2.60", "Dim Sum & Dumplings"),
        "soft-boiled eggs (2pcs)": (2.10, None, "Kaya Toast & Eggs"),
    },
    "toast box": {
        "sweet tau sar piah (1 pc)": (2.00, "Sizes & Prices: 1 pc $2.00 | 4 pcs Box $7.50", "Local Kueh, Min Jiang Kueh & Snacks"),
        "salty tau sar piah (1 pc)": (2.00, "Sizes & Prices: 1 pc $2.00 | 4 pcs Box $7.50", "Local Kueh, Min Jiang Kueh & Snacks"),
        "laksa ready-to-cook paste": (6.00, "Sizes & Prices: 1 Box $6.00 | Set of 2 $11.50", "Laksa"),
        "curry chicken ready-to-cook paste": (6.00, "Sizes & Prices: 1 Box $6.00 | Set of 2 $11.50", "Curry Rice"),
        "mee rebus ready-to-cook paste": (6.00, "Sizes & Prices: 1 Box $6.00 | Set of 2 $11.50", "Mee Rebus, Mee Soto & Mee Siam"),
        "mee siam ready-to-cook paste": (6.00, "Sizes & Prices: 1 Box $6.00 | Set of 2 $11.50", "Mee Rebus, Mee Soto & Mee Siam"),
    },
    "boost juice": {
        "berry crush": (4.00, "Sizes & Prices: Kids $4.00 | Medio $5.00 | Original $6.00", "Juices, Smoothies & Shakes"),
        "watermelon lychee crush": (4.00, "Sizes & Prices: Kids $4.00 | Medio $5.00 | Original $6.00", "Juices, Smoothies & Shakes"),
        "mango lychee crush": (4.00, "Sizes & Prices: Kids $4.00 | Medio $5.00 | Original $6.00", "Juices, Smoothies & Shakes"),
        "strawberry melon crush": (4.00, "Sizes & Prices: Kids $4.00 | Medio $5.00 | Original $6.00", "Juices, Smoothies & Shakes"),
        "mango magic": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.50 | Original $6.50", "Juices, Smoothies & Shakes"),
        "strawberry squeeze": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.50 | Original $6.50", "Juices, Smoothies & Shakes"),
        "all berry bang": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.50 | Original $6.50", "Juices, Smoothies & Shakes"),
        "immunity juice": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.80 | Original $6.80", "Juices, Smoothies & Shakes"),
        "king william chocolate": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.80 | Original $6.80", "Juices, Smoothies & Shakes"),
        "banana buzz": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.50 | Original $6.50", "Juices, Smoothies & Shakes"),
        "berry blast": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.50 | Original $6.50", "Juices, Smoothies & Shakes"),
        "cookies & cream": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.50 | Original $6.50", "Juices, Smoothies & Shakes"),
        "passion mango": (4.80, "Sizes & Prices: Kids $4.80 | Medio $5.50 | Original $6.50", "Juices, Smoothies & Shakes"),
    },
    "domino's pizza": {
        "1-for-1 large pizza": (39.90, "Sizes & Prices: 2 Large Pizzas (1-for-1 Counter Promo) $39.90", "Pizza"),
        "1-for-1 regular pizza": (29.90, "Sizes & Prices: 2 Regular Pizzas (1-for-1 Counter Promo) $29.90", "Pizza"),
        "1-for-1 thick crunch pizza": (39.90, "Sizes & Prices: 2 Large Thick Crunch Pizzas (1-for-1 Counter Promo) $39.90", "Pizza"),
        "1-for-1 thick crunch pizza & large pizza": (39.90, "Sizes & Prices: 2 Large Pizzas (1-for-1 Counter Promo) $39.90", "Pizza"),
        "1-for-1 large cheese volcano pizzas": (47.90, "Sizes & Prices: 2 Large Cheese Volcano Pizzas (1-for-1 Counter Promo) $47.90", "Pizza"),
        "b1f1: buy 1 free 1": (45.90, "Sizes & Prices: Buy 1 Free 1 Counter Promo $45.90", "Pizza"),
    },
    "subway": {
        "veggie delite": (5.90, "Sizes & Prices: 6-Inch $5.90 | Footlong $10.90", "Sandwiches, Wraps & Bagels"),
        "veggie delite": (5.90, "Sizes & Prices: 6-Inch $5.90 | Footlong $10.90", "Sandwiches, Wraps & Bagels"),
        "egg mayo": (6.80, "Sizes & Prices: 6-Inch $6.80 | Footlong $12.50", "Sandwiches, Wraps & Bagels"),
        "chicken ham": (7.00, "Sizes & Prices: 6-Inch $7.00 | Footlong $12.70", "Sandwiches, Wraps & Bagels"),
        "chicken ham 6 inch": (7.00, "Sizes & Prices: 6-Inch $7.00 | Footlong $12.70", "Sandwiches, Wraps & Bagels"),
        "chicken ham footlong": (12.70, "Sizes & Prices: 6-Inch $7.00 | Footlong $12.70", "Sandwiches, Wraps & Bagels"),
        "tuna": (7.40, "Sizes & Prices: 6-Inch $7.40 | Footlong $13.40", "Sandwiches, Wraps & Bagels"),
        "cold cut trio": (7.50, "Sizes & Prices: 6-Inch $7.50 | Footlong $13.50", "Sandwiches, Wraps & Bagels"),
        "chicken teriyaki": (8.10, "Sizes & Prices: 6-Inch $8.10 | Footlong $14.20", "Sandwiches, Wraps & Bagels"),
        "chicken teriyaki 6 inch": (8.10, "Sizes & Prices: 6-Inch $8.10 | Footlong $14.20", "Sandwiches, Wraps & Bagels"),
        "chicken teriyaki footlong": (14.20, "Sizes & Prices: 6-Inch $8.10 | Footlong $14.20", "Sandwiches, Wraps & Bagels"),
        "chicken teriyaki wrap": (8.50, None, "Sandwiches, Wraps & Bagels"),
        "italian b.m.t.": (8.40, "Sizes & Prices: 6-Inch $8.40 | Footlong $14.50", "Sandwiches, Wraps & Bagels"),
        "italian b.m.t. 6 inch": (8.40, "Sizes & Prices: 6-Inch $8.40 | Footlong $14.50", "Sandwiches, Wraps & Bagels"),
        "italian b.m.t. footlong": (14.50, "Sizes & Prices: 6-Inch $8.40 | Footlong $14.50", "Sandwiches, Wraps & Bagels"),
        "italian b.m.t. salad bowl": (9.50, None, "Salads"),
        "chicken bacon ranch": (8.60, "Sizes & Prices: 6-Inch $8.60 | Footlong $14.30", "Sandwiches, Wraps & Bagels"),
        "chicken bacon ranch 6 inch": (8.60, "Sizes & Prices: 6-Inch $8.60 | Footlong $14.30", "Sandwiches, Wraps & Bagels"),
        "chicken bacon ranch footlong": (14.30, "Sizes & Prices: 6-Inch $8.60 | Footlong $14.30", "Sandwiches, Wraps & Bagels"),
        "chicken bacon ranch salad bowl": (9.50, None, "Salads"),
        "meatball marinara melt": (8.20, "Sizes & Prices: 6-Inch $8.20 | Footlong $14.30", "Sandwiches, Wraps & Bagels"),
        "meatball marinara wrap": (8.50, None, "Sandwiches, Wraps & Bagels"),
        "roast beef": (9.20, "Sizes & Prices: 6-Inch $9.20 | Footlong $15.50", "Sandwiches, Wraps & Bagels"),
        "steak & cheese": (9.50, "Sizes & Prices: 6-Inch $9.50 | Footlong $15.90", "Sandwiches, Wraps & Bagels"),
        "subway club": (8.90, "Sizes & Prices: 6-Inch $8.90 | Footlong $15.20", "Sandwiches, Wraps & Bagels"),
        "subway melt": (8.90, "Sizes & Prices: 6-Inch $8.90 | Footlong $15.20", "Sandwiches, Wraps & Bagels"),
        "roasted chicken breast": (7.90, "Sizes & Prices: 6-Inch $7.90 | Footlong $13.90", "Sandwiches, Wraps & Bagels"),
        "turkey": (8.30, "Sizes & Prices: 6-Inch $8.30 | Footlong $14.40", "Sandwiches, Wraps & Bagels"),
        "turkey breast": (8.30, "Sizes & Prices: 6-Inch $8.30 | Footlong $14.40", "Sandwiches, Wraps & Bagels"),
        "veggie patty": (7.50, "Sizes & Prices: 6-Inch $7.50 | Footlong $13.50", "Sandwiches, Wraps & Bagels"),
        "6-inch combo set": (7.90, "Sizes & Prices: 6-Inch Sub + Cookie/Chips + 16oz Drink $7.90", "Sandwiches, Wraps & Bagels"),
        "footlong combo set": (12.50, "Sizes & Prices: Footlong Sub + Cookie/Chips + 16oz Drink $12.50", "Sandwiches, Wraps & Bagels"),
    },
    "jollibee": {
        # Jollibee counter menu boards (jollibee_1.jpg, jollibee_2.jpg) + official SG counter prices
        "1pc chickenjoy ala carte": (4.50, "Sizes & Prices: 1pc Ala Carte $4.50 | 1pc w/ Side $5.50 | 1pc Value Meal $6.50", "Fried Chicken & Wings"),
        "1pc chickenjoy only": (4.50, "Sizes & Prices: 1pc Ala Carte $4.50 | 1pc w/ Side $5.50 | 1pc Value Meal $6.50", "Fried Chicken & Wings"),
        "1pc spicy chickenjoy only": (4.80, "Sizes & Prices: 1pc Spicy Ala Carte $4.80 | 1pc Value Meal $6.80", "Fried Chicken & Wings"),
        "1pc chickenjoy with 1 side": (5.50, "Sizes & Prices: 1pc w/ Side $5.50 | Value Meal w/ Drink $6.50", "Fried Chicken & Wings"),
        "1pc chickenjoy with 1 side value meal": (6.50, "Sizes & Prices: 1pc w/ Side & Drink $6.50", "Fried Chicken & Wings"),
        "1pc chickenjoy with jolly spaghetti": (7.00, "Sizes & Prices: Ala Carte $7.00 | Value Meal w/ Drink $7.75", "Fried Chicken & Wings"),
        "1pc chickenjoy with jolly spaghetti value meal": (7.75, "Sizes & Prices: Value Meal w/ Drink $7.75", "Fried Chicken & Wings"),
        "1pc chickenjoy with jolly spaghetti meal (d)": (7.75, "Sizes & Prices: Value Meal w/ Drink $7.75", "Fried Chicken & Wings"),
        "2pc chickenjoy with jolly spaghetti meal (d)": (10.80, "Sizes & Prices: 2pc Chickenjoy w/ Jolly Spaghetti & Drink $10.80", "Fried Chicken & Wings"),
        "2pc chickenjoy with burger steak meal (d)": (10.80, "Sizes & Prices: 2pc Chickenjoy w/ Burger Steak & Drink $10.80", "Fried Chicken & Wings"),
        "1pc chickenjoy nasi lemak meal (d)": (7.50, "Sizes & Prices: Ala Carte $5.50 | Meal w/ Drink $7.50", "Nasi Lemak"),
        "6pc chickenjoy bucket": (19.10, "Sizes & Prices: 6pc Bucket $19.10 | 8pc Bucket $23.80", "Fried Chicken & Wings"),
        "6pc chickenjoy bucket (d)": (19.10, "Sizes & Prices: 6pc Bucket $19.10 | 8pc Bucket $23.80", "Fried Chicken & Wings"),
        "6pcs chickenjoy bucket": (19.10, "Sizes & Prices: 6pc Bucket $19.10 | 8pc Bucket $23.80", "Fried Chicken & Wings"),
        "8pc chickenjoy bucket (d)": (23.80, "Sizes & Prices: 6pc Bucket $19.10 | 8pc Bucket $23.80", "Fried Chicken & Wings"),
        "8pcs chickenjoy bucket": (23.80, "Sizes & Prices: 6pc Bucket $19.10 | 8pc Bucket $23.80", "Fried Chicken & Wings"),
        "chickenjoy and spaghetti bundle meal (d)": (21.50, "Sizes & Prices: 6pc Chickenjoy + 3 Jolly Spaghetti Bundle $21.50", "Fried Chicken & Wings"),
        "(del ex) value meal c": (10.50, None, "Fried Chicken & Wings"),
        "fries": (2.75, "Sizes & Prices: Regular $1.50 | Medium $2.75 | Large $3.50", "Western Soups & Sides"),
        "fries reg": (1.50, "Sizes & Prices: Regular $1.50 | Medium $2.75 | Large $3.50", "Western Soups & Sides"),
        "chocolate sundae": (1.80, None, "Ice Cream, Gelato & Froyo"),
    },
    "huggs coffee": {
        "classic butter croissant": (3.70, None, "Bread, Pastries & Bakery"),
        "chocolate croissant": (4.10, None, "Bread, Pastries & Bakery"),
        "almond croissant": (4.10, None, "Bread, Pastries & Bakery"),
        "sultana croissant": (4.40, None, "Bread, Pastries & Bakery"),
        "cinnamon roll": (4.40, None, "Bread, Pastries & Bakery"),
        "blueberry muffin": (4.50, None, "Cakes & Tarts"),
        "banana walnut muffin": (4.50, None, "Cakes & Tarts"),
        "double chocolate muffin": (4.50, None, "Cakes & Tarts"),
        "scone": (4.50, None, "Bread, Pastries & Bakery"),
        "spinach ricotta puff": (4.50, None, "Bread, Pastries & Bakery"),
        "aged cheddar twist": (4.50, None, "Bread, Pastries & Bakery"),
        "chicken curry mushroom puff": (4.50, None, "Bread, Pastries & Bakery"),
        "chicken bolognese mini pie": (4.00, None, "Bread, Pastries & Bakery"),
        "chicken mushroom mini pie": (4.00, None, "Bread, Pastries & Bakery"),
        "tuna mini pie": (4.00, None, "Bread, Pastries & Bakery"),
        "chicken sausage puff": (4.00, None, "Bread, Pastries & Bakery"),
        "chicken mushroom pie": (7.60, None, "Bread, Pastries & Bakery"),
        "butter chicken pie": (7.60, None, "Bread, Pastries & Bakery"),
        "american beef pie": (7.60, None, "Bread, Pastries & Bakery"),
        "shepherd pie": (7.60, None, "Bread, Pastries & Bakery"),
        "turkey ham quiche": (7.60, None, "Bread, Pastries & Bakery"),
        "wholemeal butter chicken": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "wholemeal pesto mushroom (v)": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "wholemeal pesto tomato chicken": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "wholemeal satay chicken": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "wholemeal turkey ham & cheese": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "texmex beef wrap": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "thai chicken wrap": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "vegetarian cilantro wrap": (6.50, None, "Sandwiches, Wraps & Bagels"),
        "chocolate fudge cake": (7.90, None, "Cakes & Tarts"),
        "ondeh ondeh cake": (7.90, None, "Cakes & Tarts"),
        "speculoos cheese cake": (7.90, None, "Cakes & Tarts"),
        "yuzu osmanthus cake": (7.90, None, "Cakes & Tarts"),
        "kopi o": (2.60, "Sizes & Prices: Hot Regular $2.60 | Iced $3.20", "Coffee & Kopi"),
        "teh o": (2.60, "Sizes & Prices: Hot Regular $2.60 | Iced $3.20", "Bubble Tea, Milk Tea & Teh"),
        "kopi": (2.80, "Sizes & Prices: Hot Regular $2.80 | Iced $3.50", "Coffee & Kopi"),
        "teh": (2.80, "Sizes & Prices: Hot Regular $2.80 | Iced $3.50", "Bubble Tea, Milk Tea & Teh"),
        "kopi c": (3.00, "Sizes & Prices: Hot Regular $3.00 | Iced $3.70", "Coffee & Kopi"),
        "teh c": (3.00, "Sizes & Prices: Hot Regular $3.00 | Iced $3.70", "Bubble Tea, Milk Tea & Teh"),
        "oat kopi c": (3.50, None, "Coffee & Kopi"),
        "oat teh c": (3.50, None, "Bubble Tea, Milk Tea & Teh"),
        "americano": (5.00, "Sizes & Prices: Regular $5.00 | Large $5.80", "Coffee & Kopi"),
        "flat white": (5.50, "Sizes & Prices: Regular $5.50 | Large $6.40", "Coffee & Kopi"),
        "oat cortado": (5.50, None, "Coffee & Kopi"),
        "cafe latte": (6.00, "Sizes & Prices: Regular $6.00 | Large $6.90", "Coffee & Kopi"),
        "cappuccino": (6.00, "Sizes & Prices: Regular $6.00 | Large $6.90", "Coffee & Kopi"),
        "oat melbourne latte": (6.00, None, "Coffee & Kopi"),
        "mocha": (6.50, "Sizes & Prices: Regular $6.50 | Large $7.50", "Coffee & Kopi"),
        "latte gula": (6.50, "Sizes & Prices: Regular $6.50 | Large $7.50", "Coffee & Kopi"),
        "turmeric oat latte": (6.50, None, "Coffee & Kopi"),
        "french hot chocolate": (6.50, None, "Coffee & Kopi"),
        "cold brew (ethiopia dela)": (6.50, None, "Coffee & Kopi"),
        "iced peach green tea": (6.50, None, "Tea & Herbal Drinks"),
        "iced watermelon mint tea": (6.50, None, "Tea & Herbal Drinks"),
    },
    "ya kun kaya toast": {
        "iced coffee": (3.20, "Sizes & Prices: Regular $3.20 | Large $3.70", "Coffee & Kopi"),
        "iced tea": (3.20, "Sizes & Prices: Regular $3.20 | Large $3.70", "Bubble Tea, Milk Tea & Teh"),
        "kaya toast": (2.80, "Sizes & Prices: Ala Carte $2.80 | Set A $6.30", "Kaya Toast & Eggs"),
        "kaya toast with butter": (2.80, "Sizes & Prices: Ala Carte $2.80 | Set A $6.30", "Kaya Toast & Eggs"),
        "mee siam": (6.00, "Sizes & Prices: Ala Carte $6.00 | Set $8.30", "Mee Rebus, Mee Soto & Mee Siam"),
        "prawn noodle soup": (7.80, None, "Prawn Noodles"),
    },
    "mr bean": {
        "cheese pancake": (2.20, None, "Local Kueh, Min Jiang Kueh & Snacks"),
        "chocolate pancake": (2.10, None, "Local Kueh, Min Jiang Kueh & Snacks"),
        "classic beancurd": (2.00, None, "Local & Asian Desserts"),
        "icy sea salt chendol": (4.20, None, "Local & Asian Desserts"),
        "chicken meatball": (6.20, None, "Porridge & Congee"),
        "chicken meatballs": (6.20, None, "Porridge & Congee"),
        "chicken meatball rice bowl": (6.20, None, "Donburi & Japanese Rice Bowls"),
        "spicy minced chicken & mushroom": (6.20, None, "Porridge & Congee"),
        "spicy minced chicken and mushroom": (6.20, None, "Porridge & Congee"),
        "vegetarian jade tofu": (5.60, None, "Porridge & Congee"),
    },
    "tai cheong bakery": {
        "coconut & cream bun 棷絲奶油包": (2.90, None, "Bread, Pastries & Bakery"),
        "coconut & cream bun 椰絲奶油包": (2.90, None, "Bread, Pastries & Bakery"),
        "radish cake loaf 蘿荀糕": (24.20, None, "Carrot Cake (Chye Tow Kway)"),
        "radish cake loaf 蘿蔔糕": (24.20, None, "Carrot Cake (Chye Tow Kway)"),
        "egg tart 蛋挞": (2.60, "Sizes & Prices: 1 pc $2.60 | Box of 4 $10.40", "Cakes & Tarts"),
    },
    "starbucks": {
        "iced black tea latte": (7.10, "Sizes & Prices: Tall $6.60 | Grande $7.10 | Venti $7.70", "Bubble Tea, Milk Tea & Teh"),
        "iced caffe latte": (7.60, "Sizes & Prices: Tall $7.00 | Grande $7.60 | Venti $8.20", "Coffee & Kopi"),
        "iced latte": (7.60, "Sizes & Prices: Tall $7.00 | Grande $7.60 | Venti $8.20", "Coffee & Kopi"),
        "caffe latte": (7.60, "Sizes & Prices: Tall $7.00 | Grande $7.60 | Venti $8.20", "Coffee & Kopi"),
        "hojicha tea cream frappuccino": (8.90, "Sizes & Prices: Tall $8.30 | Grande $8.90 | Venti $9.50", "Bubble Tea, Milk Tea & Teh"),
        "iced caffè mocha": (8.40, "Sizes & Prices: Tall $7.80 | Grande $8.40 | Venti $9.00", "Coffee & Kopi"),
        "chocolate chip cream frappuccino": (8.90, "Sizes & Prices: Tall $8.30 | Grande $8.90 | Venti $9.50", "Coffee & Kopi"),
        "matcha cream frappuccino": (8.90, "Sizes & Prices: Tall $8.30 | Grande $8.90 | Venti $9.50", "Bubble Tea, Milk Tea & Teh"),
    },
}

# Category cleanups for misclassified items across all chains
CATEGORY_CLEANUPS = {
    "little butter latte": "Coffee & Kopi",
    "classic butter croissant": "Bread, Pastries & Bakery",
    "butter croissant": "Bread, Pastries & Bakery",
    "butter sugar toast": "Kaya Toast & Eggs",
    "kaya butter toast": "Kaya Toast & Eggs",
    "kaya butter toast set": "Kaya Toast & Eggs",
    "kaya toast (kaya & sliced butter)": "Kaya Toast & Eggs",
    "kaya toast with butter": "Kaya Toast & Eggs",
    "kaya toast": "Kaya Toast & Eggs",
    "kaya toast set": "Kaya Toast & Eggs",
    "set a - kaya toast set (kaya & sliced butter)": "Kaya Toast & Eggs",
    "set c - butter sugar toast set": "Kaya Toast & Eggs",
    "set f1 - steamed bread set (kaya & sliced butter)": "Kaya Toast & Eggs",
    "steamed bread (kaya & sliced butter)": "Kaya Toast & Eggs",
    "steamed kaya butter bread": "Kaya Toast & Eggs",
    "kaya butter steamed bread": "Kaya Toast & Eggs",
    "kaya butter crackers": "Kaya Toast & Eggs",
    "kaya crackers (with butter)": "Kaya Toast & Eggs",
    "sugar crackers (with butter)": "Kaya Toast & Eggs",
    "traditional kaya toast": "Kaya Toast & Eggs",
    "peanut butter toast set": "Kaya Toast & Eggs",
    "peanut thick toast": "Kaya Toast & Eggs",
    "honey butter french toast": "Kaya Toast & Eggs",
    "honey butter french toast set": "Kaya Toast & Eggs",
    "french toast": "Kaya Toast & Eggs",
    "butter cookies with nutella": "Bread, Pastries & Bakery",
    "2x butter cookies with nutella": "Bread, Pastries & Bakery",
    "garlic bread": "Bread, Pastries & Bakery",
    "garlic cheese bun": "Bread, Pastries & Bakery",
    "garlic cheese bread": "Bread, Pastries & Bakery",
    "butter sugar loaf": "Bread, Pastries & Bakery",
    "blueberry butter cake 蓝莓蛋糕": "Cakes & Tarts",
    "chocolate butter sand": "Bread, Pastries & Bakery",
    "red bean butter shio pan": "Bread, Pastries & Bakery",
    "mini peanut butter croissant": "Bread, Pastries & Bakery",
    "mini kaya butter croissant": "Bread, Pastries & Bakery",
    "starbucks coffee crust polo bun (served with chilled butter)": "Bread, Pastries & Bakery",
    "peanut butter pancake": "Local Kueh, Min Jiang Kueh & Snacks",
    "classic beancurd": "Local & Asian Desserts",
    "grass jelly beancurd": "Local & Asian Desserts",
    "pearly beancurd": "Local & Asian Desserts",
    "sea salt gula melaka beancurd": "Local & Asian Desserts",
    "ginger soup beancurd": "Local & Asian Desserts",
    "ginger soup riceballs with beancurd": "Local & Asian Desserts",
    "salted egg yolk tart": "Cakes & Tarts",
    "muesli bar": "Bread, Pastries & Bakery",
    "protein ball - chocolate & dates": "Bread, Pastries & Bakery",
    "protein ball - peanut butter": "Bread, Pastries & Bakery",
}


def detect_chain(venue: str) -> str:
    vl = venue.lower().strip()
    for ck in PASS12_CHAIN_UPDATES:
        if ck in vl:
            return ck
    if "swee heng" in vl:
        return "swee heng"
    if "luckin coffee" in vl:
        return "luckin coffee"
    if "liho" in vl:
        return "liho tea"
    return ""


def append_size_note(desc: str, size_note: str) -> str:
    if not size_note:
        return desc
    desc = str(desc or "").strip()
    tag = f"[{size_note}]"
    if size_note.lower() in desc.lower():
        return desc
    # Replace existing [Sizes & Prices: ...] if present
    if re.search(r"\[Sizes & Prices:[^\]]+\]", desc):
        return re.sub(r"\[Sizes & Prices:[^\]]+\]", tag, desc)
    return f"{desc} | {tag}" if desc else tag


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write changes to MASTER_XLSX")
    args = ap.parse_args()

    if args.apply and not os.path.exists(BACKUP_XLSX):
        shutil.copy2(MASTER_XLSX, BACKUP_XLSX)
        print(f"Created backup: {BACKUP_XLSX}")

    wb = openpyxl.load_workbook(MASTER_XLSX)
    ws = wb["Menu & Price"]

    stats = defaultdict(int)
    samples = defaultdict(list)

    # First pass: collect existing clean dish names per venue (for Al Barakath deduplication)
    venue_clean_dishes = defaultdict(set)
    for r in range(2, ws.max_row + 1):
        v = str(ws.cell(r, 1).value or "").strip()
        d = str(ws.cell(r, 5).value or "").strip()
        p = ws.cell(r, 7).value
        if v and d and p is not None:
            venue_clean_dishes[v.lower()].add(norm(d))

    def clear_row(r_idx: int, reason: str, v: str, d: str, p):
        stats[reason] += 1
        if len(samples[reason]) < 8:
            samples[reason].append((r_idx, v, d, p))
        if args.apply:
            cur_desc = str(ws.cell(r_idx, 8).value or "").strip()
            q_tag = f"[QUARANTINED: 2026-11-13 Pass 12 — {reason}]"
            if "[QUARANTINED:" not in cur_desc:
                ws.cell(r_idx, 8).value = f"{q_tag} {cur_desc}".strip()
            ws.cell(r_idx, 7).value = None   # Price (SGD)
            ws.cell(r_idx, 9).value = None   # Dish Image URL
            ws.cell(r_idx, 10).value = None  # Menu Source URL
            ws.cell(r_idx, 11).value = None  # Last Verified Date

    for r in range(2, ws.max_row + 1):
        v = str(ws.cell(r, 1).value or "").strip()
        d_raw = str(ws.cell(r, 5).value or "").strip()
        cat = str(ws.cell(r, 6).value or "").strip()
        p_val = ws.cell(r, 7).value
        desc = str(ws.cell(r, 8).value or "").strip()
        url = str(ws.cell(r, 10).value or "").strip()

        if not v or not d_raw or p_val is None:
            continue
        try:
            pf = round(float(p_val), 2)
        except Exception:
            continue

        vl = v.lower()
        dn = norm(d_raw)
        ck = detect_chain(v)

        # A. Decode HTML entities in dish names (e.g. Swee Heng &#038;, &#8217;, &#8211;)
        d_unescaped = html.unescape(d_raw).strip()
        if d_unescaped != d_raw:
            stats["html_entity_decoded"] += 1
            if len(samples["html_entity_decoded"]) < 6:
                samples["html_entity_decoded"].append((r, v, d_raw, d_unescaped))
            d_raw = d_unescaped
            dn = norm(d_raw)
            if args.apply:
                ws.cell(r, 5).value = d_raw

        # B. Clear contaminated / non-food / corrupted rows
        # 1) Luckin Coffee contaminated Ega Juice Clinic rows
        if ck == "luckin coffee" and dn in LUCKIN_CONTAMINATED_EGA_JUICE:
            clear_row(r, "cleared_luckin_ega_juice_contamination", v, d_raw, pf)
            continue

        # 2) Ya Kun Kaya Toast 7 outlets contaminated with BreadTalk / Fun Toast / Toast Box rows
        if ck == "ya kun kaya toast" and dn in YAKUN_CONTAMINATED_ITEMS:
            # Only clear if this is one of the 7 contaminated rows (e.g., url is https://app.yakun.com/menu.html)
            if url == "https://app.yakun.com/menu.html":
                clear_row(r, "cleared_yakun_cross_chain_contamination", v, d_raw, pf)
                continue

        # 3) LiHO TEA 6 outlets contaminated with generic kopitiam/cafe template rows
        if ck == "liho tea" and dn in LIHO_CONTAMINATED_TEMPLATE_ITEMS:
            clear_row(r, "cleared_liho_template_contamination", v, d_raw, pf)
            continue

        # 4) The Coffee Bean & Tea Leaf 4 outlets with generic cafe template rows
        if ck == "the coffee bean & tea leaf" and (dn, pf) in CBTL_CONTAMINATED_TEMPLATE_PAIRS:
            clear_row(r, "cleared_cbtl_template_contamination", v, d_raw, pf)
            continue

        # 5) 001 Cafe (Tampines Junction) non-food packaging rows
        if "001 cafe" in vl and dn in CAFE_001_NON_FOOD_ITEMS:
            clear_row(r, "cleared_001_cafe_packaging", v, d_raw, pf)
            continue

        # 6) Swee Heng non-food candles / forks / toppers
        if ck == "swee heng" and is_swee_heng_non_food(dn):
            clear_row(r, "cleared_swee_heng_non_food_candles", v, d_raw, pf)
            continue

        # 7) Al Barakath Restaurant concatenated multi-item table rows & REFRESHMENT suffix
        if "al barakath" in vl:
            if "|" in d_raw or re.search(r"\d+\.\d{2}", d_raw):
                clear_row(r, "cleared_al_barakath_concatenated_rows", v, d_raw, pf)
                continue
            if d_raw.endswith("REFRESHMENT") and len(d_raw) > len("REFRESHMENT"):
                clean_drink = d_raw[:-len("REFRESHMENT")].strip()
                if norm(clean_drink) in venue_clean_dishes[vl]:
                    clear_row(r, "cleared_al_barakath_duplicate_refreshment", v, d_raw, pf)
                    continue
                else:
                    stats["cleaned_al_barakath_refreshment_name"] += 1
                    d_raw = clean_drink
                    dn = norm(d_raw)
                    if args.apply:
                        ws.cell(r, 5).value = d_raw

        # C. Category cleanups
        if dn in CATEGORY_CLEANUPS and cat != CATEGORY_CLEANUPS[dn]:
            new_cat = CATEGORY_CLEANUPS[dn]
            stats["category_fixed"] += 1
            if len(samples["category_fixed"]) < 8:
                samples["category_fixed"].append((r, v, d_raw, f"{cat} -> {new_cat}"))
            cat = new_cat
            if args.apply:
                ws.cell(r, 6).value = new_cat

        # D. Swee Heng Foodpanda delivery bread/waffle rows (convert inflated delivery prices to counter prices)
        if ck == "swee heng" and "foodpanda.sg" in url.lower():
            sh_map = {
                "mini chicken sausage bun": 4.80,
                "blueberry waffle": 3.00,
                "chocolate waffle": 3.00,
                "strawberry waffle": 3.00,
                "mochi waffle": 3.00,
                "salted cheese waffle": 3.00,
                "chunky peanut butter waffle": 3.00,
                "butter waffle": 2.80,
                "kaya waffle": 2.80,
                "waffle plain": 2.30,
                "kitkat waffle": 3.80,
                "bisco crunchy waffle": 3.80,
                "kunafa pistachio waffle": 4.20,
            }
            new_p = sh_map.get(dn)
            if new_p is None and pf <= 12.0:
                # Standard Swee Heng buns/loaves on Foodpanda (~18% markup over counter)
                cand = round(pf * 0.85, 1)
                if cand < pf - 0.05:
                    new_p = cand
            if new_p is not None and abs(new_p - pf) > 0.04:
                stats["swee_heng_counter_price_updated"] += 1
                if len(samples["swee_heng_counter_price_updated"]) < 8:
                    samples["swee_heng_counter_price_updated"].append((r, v, d_raw, f"${pf:.2f} -> ${new_p:.2f}"))
                pf = new_p
                if args.apply:
                    ws.cell(r, 7).value = round(new_p, 2)

        # E. Pass 12 Chain Updates (Open-source website & counter menu board exact prices + size notes)
        if ck in PASS12_CHAIN_UPDATES and dn in PASS12_CHAIN_UPDATES[ck]:
            new_p, size_note, cat_override = PASS12_CHAIN_UPDATES[ck][dn]
            if new_p is not None and abs(new_p - pf) > 0.04:
                stats[f"price_updated_{ck}"] += 1
                if len(samples[f"price_updated_{ck}"]) < 6:
                    samples[f"price_updated_{ck}"].append((r, v, d_raw, f"${pf:.2f} -> ${new_p:.2f}"))
                pf = new_p
                if args.apply:
                    ws.cell(r, 7).value = round(new_p, 2)
            if size_note:
                new_desc = append_size_note(desc, size_note)
                if new_desc != desc:
                    stats[f"size_note_added_{ck}"] += 1
                    desc = new_desc
                    if args.apply:
                        ws.cell(r, 8).value = new_desc
            if cat_override and cat != cat_override:
                stats["category_fixed"] += 1
                if args.apply:
                    ws.cell(r, 6).value = cat_override

    # F. Recompute Food Directory Price Range from active Menu & Price rows
    venue_prices = defaultdict(list)
    for r in range(2, ws.max_row + 1):
        v = str(ws.cell(r, 1).value or "").strip()
        p_val = ws.cell(r, 7).value
        if v and p_val is not None:
            try:
                pf = float(p_val)
                if pf > 0:
                    venue_prices[v.lower()].append(pf)
            except Exception:
                pass

    ws_dir = wb["Food Directory"]
    dir_headers = [str(ws_dir.cell(1, c).value or "").strip() for c in range(1, ws_dir.max_column + 1)]
    if "Price Range" in dir_headers:
        pr_col = dir_headers.index("Price Range") + 1
        for r in range(2, ws_dir.max_row + 1):
            v = str(ws_dir.cell(r, 1).value or "").strip()
            if not v:
                continue
            plist = venue_prices.get(v.lower())
            if plist:
                lo, hi = min(plist), max(plist)
                new_pr = f"${lo:.2f}" if abs( hi - lo ) < 0.005 else f"${lo:.2f} - ${hi:.2f}"
                old_pr = str(ws_dir.cell(r, pr_col).value or "").strip()
                if new_pr != old_pr:
                    stats["directory_price_range_updated"] += 1
                    if len(samples["directory_price_range_updated"]) < 8:
                        samples["directory_price_range_updated"].append((r, v, old_pr, new_pr))
                    if args.apply:
                        ws_dir.cell(r, pr_col).value = new_pr

    print("=== PASS 12 SUMMARY ===")
    for k, cnt in sorted(stats.items()):
        print(f"  {k:45s}: {cnt}")
    print("\n=== SAMPLES ===")
    for k, slist in sorted(samples.items()):
        print(f"--- {k} ---")
        for item in slist:
            print("  ", item)

    if args.apply:
        wb.save(MASTER_XLSX)
        print(f"\nSaved updated workbook to {MASTER_XLSX}")


if __name__ == "__main__":
    main()
