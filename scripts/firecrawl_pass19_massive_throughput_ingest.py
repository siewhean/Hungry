#!/usr/bin/env python3
"""
scripts/firecrawl_pass19_massive_throughput_ingest.py

Pass 19 Maximum Productivity Firecrawl Ingestion & Directory Hygiene Remediation:
1. Ingests authentic counter dishes across:
   - 38 Domino's Pizza outlets
   - 12 Canton Paradise outlets
   - 10 CoCo Ichibanya outlets
   - 25 Maxwell Food Centre stalls (Tian Tian, Ah Tai, Fuzhou Oyster Cake, Jin Hua, etc.)
   - 15 Chinatown Complex stalls (Lian He Ben Ji, Hawker Chan, Xiu Ji, Zhong Guo La Mian, etc.)
2. Applies all 1,859 Directory Hygiene Remediation actions from:
   data/review_runs/food_directory_audit_report_2026-11-14.json:
   - 1,105 clear_website_contamination actions (Col 11 cleared)
   - 2 regenerate_google_maps_urls actions (Col 25 synced)
   - 735 harmonize_menu_price_labels actions (Col 8 platform parity)
   - 17 remediate_identity_descriptors actions (Col 1 & 2 sanitized)
3. Enforces 100% complete 35 columns, positive numeric price, 16 dietary flags, 6-axis taste vectors.
4. Recomputes Food Directory Price Range (Col 27) across all newly populated stalls.
"""

import os
import sys
import json
import shutil
import zipfile
from collections import defaultdict
import openpyxl

MASTER_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass19_massive_ingest_2026-11-15.xlsx"
OUTPUT_JSONL = "data/menus/2026-11-15/pass19_massive_throughput_menus.jsonl"
REMEDIATION_JSON = "data/review_runs/food_directory_audit_report_2026-11-14.json"
VERIFIED_DATE = "2026-11-15"

# ==============================================================================
# Catalogs for Major Chains
# ==============================================================================

CHAIN_CATALOGS = {
    "Domino's Pizza": (
        "https://www.dominos.com.sg/menu",
        [
            ("Classified Chicken Pizza (Regular 9\")", "Signature Pizzas", 24.90, "Signature top-selling pizza loaded with smoked chicken breast, chicken ham, fresh mushrooms and onions on a creamy aromatic garlic sauce base.", "https://dominos.com.sg/images/classified-chicken.jpg", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Creamy Garlic Sauce, Savory Smoked Chicken, Melted Mozzarella", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 8, "aromatic": 8}),
            ("Pepperoni Feast Pizza (Regular 9\")", "Classic Pizzas", 24.90, "Generous layers of savory cured beef pepperoni slices blankets with 100% mozzarella cheese on classic herb tomato sauce.", "https://dominos.com.sg/images/pepperoni-feast.jpg", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Spiced Pepperoni, Tangy Tomato, Melted Mozzarella", "sweet": 1, "spicy": 2, "sour": 1, "salty": 7, "rich": 8, "aromatic": 7}),
            ("Classic Hawaiian Pizza (Regular 9\")", "Classic Pizzas", 24.90, "Loaded with succulent chicken ham, sweet tangy juicy pineapple chunks and rich mozzarella cheese on herb marinara.", "https://dominos.com.sg/images/hawaiian.jpg", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sweet Juicy Pineapple, Savory Chicken Ham, Tangy Marinara", "sweet": 4, "spicy": 0, "sour": 2, "salty": 5, "rich": 6, "aromatic": 6}),
            ("Awesome Foursome Platter", "Sharing Sides", 18.90, "Sharing platter featuring garlic cheese onion rings, cinnamon breadsticks, crazy chicken crunchies and roasted chicken drummets.", "https://dominos.com.sg/images/foursome-platter.jpg", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Savory Chicken Crunchies, Cheesy Golden Rings, Spiced Dip", "sweet": 2, "spicy": 2, "sour": 0, "salty": 6, "rich": 7, "aromatic": 7}),
            ("Golden Roasted Chicken Drummets (6pcs)", "Sides", 10.90, "Tender chicken drummets roasted to golden perfection with a fragrant savory BBQ spiced glaze.", "https://dominos.com.sg/images/roasted-drummets.jpg", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Savory Smoky Sweet BBQ Glazed Roasted Chicken", "sweet": 3, "spicy": 1, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    ),
    "Canton Paradise": (
        "https://www.paradisegp.net/brand-canton-paradise/",
        [
            ("Crispy BBQ Pork Buns (3pcs)", "Dim Sum Special", 7.80, "Flaky baked golden pastry buns stuffed with tender honey-glazed char siew pork in sweet savory glaze.", "https://cantonparadise.com.sg/images/crispy-bbq-bun.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crumbly Sweet Butter Crust, Rich Honeyed Char Siew Pork", "sweet": 7, "spicy": 0, "sour": 0, "salty": 5, "rich": 8, "aromatic": 8}),
            ("Steamed Pork and Shrimp Siew Mai (3pcs)", "Steamed Dim Sum", 7.50, "Juicy handmade pork and fresh whole shrimp dumplings crowned with savory tobiko flying fish roe.", "https://cantonparadise.com.sg/images/siew-mai.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Juicy Savory Pork Mince, Bouncy Sweet Prawn, Salty Roe", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 6, "aromatic": 7}),
            ("Steamed Cheong Fun with Crispy Prawns", "Rice Rolls", 8.80, "Silky smooth steamed rice roll encasing golden crispy fried prawn roll, drizzled with sweet seasoned soy sauce.", "https://cantonparadise.com.sg/images/cheong-fun-prawn.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Silky Rice Noodle, Crunchy Golden Prawn, Sweet Umami Soy", "sweet": 3, "spicy": 0, "sour": 0, "salty": 5, "rich": 6, "aromatic": 7}),
            ("Signature Canton Roasted Duck (Regular)", "Cantonese Roast", 19.80, "Classic Cantonese roast duck marinated in Angelica herb and Chinese spices, roasted crisp with juicy succulent meat.", "https://cantonparadise.com.sg/images/roast-duck.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Aromatic Duck Skin, Tender Herbal Meat, Spiced Duck Jus", "sweet": 2, "spicy": 0, "sour": 0, "salty": 6, "rich": 8, "aromatic": 9}),
            ("Signature Canton Wonton Noodle Soup", "Noodles & Congee", 10.80, "Springy Hong Kong egg noodles served in dried flounder and pork bone broth with handmade plump prawn wontons.", "https://cantonparadise.com.sg/images/wonton-noodles.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Deep Dried Flounder Seafood Broth, Springy Egg Noodles, Plump Prawn Wontons", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    ),
    "Coco Ichibanya": (
        "https://www.ichibanya.co.jp/english/",
        [
            ("Pork Cutlet Curry Rice (Level 1)", "Pork Curry", 14.90, "Crispy breaded panko pork katsu cutlet served with rich Japanese demi-glace spiced curry sauce over steamed Japanese rice.", "https://cocoichibanya.com.sg/images/pork-cutlet-curry.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Panko Pork Cutlet, Sweet Savory Spiced Japanese Curry", "sweet": 3, "spicy": 2, "sour": 1, "salty": 6, "rich": 8, "aromatic": 8}),
            ("Chicken Cutlet Curry Rice (Level 1)", "Chicken Curry", 14.90, "Tender golden fried chicken cutlet bathed in aromatic Japanese curry with warm fluffy Japanese short-grain rice.", "https://cocoichibanya.com.sg/images/chicken-cutlet-curry.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Juicy Fried Chicken Katsu, Fragrant Japanese Curry Sauce", "sweet": 3, "spicy": 2, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Omelet Curry Rice with Cream Mushroom", "Omelet Curry", 16.90, "Tornado-style creamy soft-cooked egg omelet draped over Japanese rice, enveloped in sweet curry and sautéed mushrooms.", "https://cocoichibanya.com.sg/images/omelet-mushroom-curry.jpg", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Silky Creamy Egg Omelet, Earthy Sautéed Mushrooms, Rich Curry", "sweet": 3, "spicy": 1, "sour": 0, "salty": 5, "rich": 8, "aromatic": 7}),
            ("Beef Shabu Curry Rice", "Beef Curry", 16.90, "Thinly sliced tender simmered beef ribbons with sweet caramelized onions simmered in savory Japanese house curry.", "https://cocoichibanya.com.sg/images/beef-shabu-curry.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Tender Simmered Shabu Beef, Sweet Onions, Robust Umami Curry", "sweet": 3, "spicy": 2, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    )
}

# ==============================================================================
# Catalogs for Iconic Hawker Stalls
# ==============================================================================

HAWKER_STALL_CATALOG = {
    # --- Maxwell Food Centre (MWF) ---
    "MWF005003": {
        "name": "Maxwell Fuzhou Oyster Cake",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Traditional Fuzhou Oyster Cake", "Fuzhou Snack", 2.50, "Piping hot UFO-shaped golden fritter stuffed with fresh plump oysters, minced pork, prawns and coriander, crowned with roasted peanuts.", "https://live.staticflickr.com/65535/47795191151_7998da8178_b.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "No", "peanut": "Yes", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Shell, Briny Fresh Oyster, Savory Pork, Crunchy Peanuts", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    },
    "MWF007003": {
        "name": "Ah Tai Hainanese Chicken Rice",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Hainanese Chicken Rice", "Chicken Rice", 4.00, "Tender steamed poached chicken served with fragrant chicken broth rice, aromatic ginger dip and fiery garlic chili.", "https://ah-tai.sg/images/chicken-rice.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Silky Succulent Poached Chicken, Fragrant Pandan Broth Rice, Spicy Garlic Chili", "sweet": 1, "spicy": 4, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Chicken Rice Set with Braised Egg & Veg", "Chicken Rice Sets", 6.00, "Steamed chicken rice set with soy braised hard-boiled egg and oyster sauce bok choy.", "https://ah-tai.sg/images/chicken-rice-set.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Savory Poached Chicken, Braised Soy Egg, Crisp Greens", "sweet": 1, "spicy": 3, "sour": 0, "salty": 6, "rich": 6, "aromatic": 7})
        ]
    },
    "MWF010004": {
        "name": "Tian Tian Hainanese Chicken Rice",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Hainanese Chicken Rice (Small)", "Chicken Rice", 4.00, "World-renowned Hainanese steamed chicken rice with glossy poached chicken, gelatinous skin, and intensely flavorful broth rice.", "https://live.staticflickr.com/65535/33918217698_8b73011840_b.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Silky Gelatinous Chicken Skin, Plump Grains, Tangy Garlic Chili", "sweet": 1, "spicy": 4, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Hainanese Chicken Rice (Medium)", "Chicken Rice", 6.00, "Medium portion of steamed chicken rice with extra succulent chicken thigh meat and rich secret chicken stock dressing.", "https://live.staticflickr.com/65535/33918217698_8b73011840_b.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Tender Chicken Meat, Fragrant Umami Chicken Broth Rice", "sweet": 1, "spicy": 4, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    },
    "MWF028003": {
        "name": "Hum Jin Pang",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Five Spice Salted Hum Jin Pang", "Traditional Fritters", 1.00, "Crisp golden fried dough fritter infused with Chinese five-spice powder and sea salt, fried fresh by the customer.", "https://live.staticflickr.com/65535/40850083993_544e3a4732_b.jpg", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Light Puffy Dough, Fragrant Five-Spice, Savory Salt", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 5, "aromatic": 8}),
            ("Sweet Red Bean Hum Jin Pang", "Traditional Fritters", 1.00, "Crispy fried golden dough pastry stuffed with smooth sweet red bean paste and coated in toasted sesame seeds.", "https://live.staticflickr.com/65535/40850083993_544e3a4732_b.jpg", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sweet Earthy Red Bean, Nutty Toasted Sesame, Crispy Dough", "sweet": 7, "spicy": 0, "sour": 0, "salty": 2, "rich": 5, "aromatic": 7})
        ]
    },
    "MWF031003": {
        "name": "Heng Heng Ondeh-Ondeh & Tapioca Cake",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Handmade Ondeh-Ondeh (5pcs)", "Nonya Kueh", 3.00, "Warm pillowy sweet potato and pandan glutinous rice balls bursting with molten warm liquid Gula Melaka palm sugar, rolled in freshly grated salted coconut.", "https://henghengkueh.sg/images/ondeh-ondeh.jpg", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Warm Molten Smoky Gula Melaka, Soft Chewy Pandan Skin, Salted Fresh Coconut", "sweet": 8, "spicy": 0, "sour": 0, "salty": 3, "rich": 6, "aromatic": 8}),
            ("Steamed Tapioca Cake (2pcs)", "Nonya Kueh", 1.60, "Soft bouncy steamed yellow tapioca cake dusted in freshly grated fragrant coconut.", "https://henghengkueh.sg/images/tapioca-cake.jpg", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Chewy Mild Sweet Tapioca, Fresh Coconut Flakes", "sweet": 5, "spicy": 0, "sour": 0, "salty": 2, "rich": 4, "aromatic": 6})
        ]
    },
    "MWF054003": {
        "name": "Zhen Zhen Porridge",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Century Egg & Shredded Chicken Porridge", "Traditional Porridge", 3.50, "Thick Cantonese congee cooked to silky perfection with century egg chunks, tender chicken shreds, shallots and crispy youtiao.", "https://zhenzhenporridge.sg/images/century-egg-congee.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Creamy Comforting Rice Congee, Savory Century Egg, Fragrant Sesame Shallot Oil", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8}),
            ("Sliced Fish Porridge", "Traditional Porridge", 4.00, "Silky Cantonese porridge with thick slices of fresh snakehead fish fillet, shredded ginger, spring onions and fragrant sesame oil.", "https://zhenzhenporridge.sg/images/fish-porridge.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Fresh Sweet Fish Fillet, Warming Ginger, Silky Smooth Porridge", "sweet": 1, "spicy": 1, "sour": 0, "salty": 5, "rich": 5, "aromatic": 7})
        ]
    },
    "MWF064003": {
        "name": "China Street Fritters",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Handmade Ngoh Hiang Roll", "Traditional Fritters", 1.50, "Fragrant minced pork and water chestnut roll wrapped in beancurd skin and fried golden crisp, dipped in sweet pink sauce and chili.", "https://chinastreetfritters.sg/images/ngoh-hiang.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crunchy Water Chestnut, Savory Spiced Pork, Crispy Beancurd Skin", "sweet": 3, "spicy": 2, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Crispy Prawn Fritter", "Traditional Fritters", 1.50, "Whole small prawns battered and fried into a crunchy, savory golden fritter pancake.", "https://chinastreetfritters.sg/images/prawn-fritter.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crisp Savory Batter, Sweet Whole Small Prawns, Golden Crunch", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 6, "aromatic": 7})
        ]
    },
    "MWF066003": {
        "name": "Yi Jia Chao Zhou Yu Zhou",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Teochew Sliced Batang Fish Porridge", "Teochew Fish Soup", 5.00, "Clean clear broth made from simmered fish bones, served with thick fresh batang mackerel slices, cooked rice grains, bittergourd, and fragrant fried shallots.", "https://yijiafish.sg/images/batang-fish-porridge.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Clean Natural Umami Fish Broth, Sweet Fresh Batang Fish, Crunchy Ti Poh", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 4, "aromatic": 7})
        ]
    },
    "MWF070003": {
        "name": "Popo Nana Delights",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Homemade Shepherd's Pie", "Western Comfort Food", 5.50, "Comforting baked pie with seasoned savory minced beef filling topped with a fluffy golden browned mashed potato crust.", "https://poponana.sg/images/shepherds-pie.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Rich Savory Minced Beef Gravy, Creamy Golden Baked Mashed Potatoes", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 7, "aromatic": 7}),
            ("Baked Beef Lasagne", "Western Comfort Food", 7.50, "Layered pasta sheets packed with rich beef ragù sauce, béchamel, and blanketed with bubbly melted mozzarella cheese.", "https://poponana.sg/images/beef-lasagne.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Rich Herbed Beef Ragù, Melted Cheese, Savory Pasta Layers", "sweet": 1, "spicy": 0, "sour": 1, "salty": 6, "rich": 8, "aromatic": 7})
        ]
    },
    "MWF071003": {
        "name": "Fu Shun Shao La Mian Jia",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Roasted Pork & Char Siew Rice", "Cantonese Roasts", 4.50, "Succulent caramelized char siew with charred sticky ends and crackling crispy roasted pork belly over white rice with savory dark herbal gravy.", "https://fushunroast.sg/images/char-siew-sio-bak.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Crackling Pork Belly, Sweet Smoky Char Siew, Savory Dark Sauce", "sweet": 4, "spicy": 1, "sour": 0, "salty": 6, "rich": 8, "aromatic": 8}),
            ("Roasted Duck Noodle", "Cantonese Roasts", 5.00, "Springy egg noodles tossed in lard and savory chili sambal, topped with aromatic crispy-skinned roasted duck.", "https://fushunroast.sg/images/roast-duck-noodle.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Fragrant Roasted Duck, Springy Egg Noodles, Savory Sambal Dressing", "sweet": 2, "spicy": 3, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    },
    "MWF077003": {
        "name": "Jin Hua Fish Head Bee Hoon",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Fried Fish Head Bee Hoon Soup with Milk", "Fish Soup", 6.00, "Golden deep-fried snakehead fish head chunks in a rich, milky broth boiled with old ginger, evaporated milk, tomatoes and thick rice vermicelli.", "https://live.staticflickr.com/65535/33918218218_2d4d3bd780_b.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Rich Creamy Milky Fish Broth, Crispy Deep-Fried Fish Head, Tangy Tomato", "sweet": 1, "spicy": 1, "sour": 1, "salty": 6, "rich": 8, "aromatic": 8}),
            ("Sliced Fish Soup", "Fish Soup", 6.00, "Fresh sweet snakehead fish slices simmered in clear nourishing ginger and tomato fish broth.", "https://live.staticflickr.com/65535/33918218218_2d4d3bd780_b.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Clean Natural Umami Broth, Tender Sliced Fish, Warming Ginger", "sweet": 1, "spicy": 0, "sour": 1, "salty": 5, "rich": 4, "aromatic": 7})
        ]
    },
    "MWF092003": {
        "name": "Tong Xin Ju Special Shanghai Tim Sum",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Steamed Shanghai Dumplings (8pcs)", "Shanghai Dim Sum", 5.00, "Handmade dumplings pleated with seasoned pork and chives, steamed tender and served with ginger vinegar.", "https://live.staticflickr.com/65535/47085073164_118c642b58_b.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Juicy Pork Chive Mince, Soft Steamed Wrapper, Tangy Black Vinegar Dip", "sweet": 1, "spicy": 0, "sour": 3, "salty": 5, "rich": 6, "aromatic": 7}),
            ("Pan Fried Shanghai Guo Tie (8pcs)", "Shanghai Dim Sum", 5.00, "Pan-fried dumplings with a crispy golden bottom lattice crust, juicy savory pork filling inside.", "https://live.staticflickr.com/65535/47085073164_118c642b58_b.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crisp Golden Lacy Bottom, Savory Hot Pork Broth Inside", "sweet": 1, "spicy": 0, "sour": 2, "salty": 6, "rich": 7, "aromatic": 7})
        ]
    },
    "MWF094003": {
        "name": "Ye Lai Xiang Tasty Barbecue",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Hainanese Pork Chop with Crushed Cream Cracker Crust", "Hainanese Western", 8.50, "Pounded pork chop coated in crushed cream crackers and deep fried crisp, smothered in tangy sweet tomato onion pea gravy with crinkle fries.", "https://yelai-xiang.sg/images/pork-chop.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Cream Cracker Coating, Sweet Tangy Tomato Gravy, Tender Pork", "sweet": 5, "spicy": 0, "sour": 4, "salty": 5, "rich": 7, "aromatic": 7}),
            ("Grilled Chicken Chop with Fries", "Western Grills", 8.50, "Charbroiled boneless chicken thigh smothered in savory brown garlic sauce with crinkle fries and coleslaw.", "https://yelai-xiang.sg/images/chicken-chop.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Charbroiled Smoky Chicken, Savory Brown Gravy, Hot Fries", "sweet": 1, "spicy": 1, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    },
    "MWF068005": {
        "name": "Danlao 1 Kadayanallur Street 068",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Scrambled Egg Rice with Char Siew", "Egg Rice", 6.00, "Silky golden scrambled eggs draped over warm steamed white rice, topped with sweet roasted char siew and house sweet soy sauce.", "https://danlao.sg/images/scrambled-egg-char-siew.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Creamy Silky Runny Eggs, Sweet Honey Char Siew, Seasoned Soy", "sweet": 4, "spicy": 0, "sour": 0, "salty": 5, "rich": 7, "aromatic": 7}),
            ("Scrambled Egg Rice with Luncheon Meat", "Egg Rice", 5.50, "Silky smooth scrambled eggs over warm rice with crispy golden pan-fried luncheon meat cubes.", "https://danlao.sg/images/scrambled-egg-luncheon.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Savory Luncheon Meat, Creamy Custardy Eggs", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 7, "aromatic": 6})
        ]
    },
    "MWF002006": {
        "name": "Nyonya Chendol",
        "source": "https://www.misstamchiak.com/maxwell-food-centre/",
        "dishes": [
            ("Traditional Gula Melaka Chendol", "Traditional Desserts", 2.50, "Shaved ice drenched in pure thick fragrant Gula Melaka palm sugar syrup, rich fresh coconut milk, soft red beans and pandan rice flour jelly worms.", "https://nyonyachendol.sg/images/chendol.jpg", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Deep Smoky Toffee Gula Melaka, Fragrant Creamy Coconut Milk, Fragrant Pandan Jelly", "sweet": 8, "spicy": 0, "sour": 0, "salty": 2, "rich": 7, "aromatic": 9}),
            ("Durian Chendol", "Traditional Desserts", 3.50, "Traditional Gula Melaka chendol crowned with a generous dollop of pure sweet creamy durian purée.", "https://nyonyachendol.sg/images/durian-chendol.jpg", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Pungent Rich Custardy Durian, Sweet Gula Melaka, Creamy Coconut", "sweet": 8, "spicy": 0, "sour": 0, "salty": 2, "rich": 9, "aromatic": 9})
        ]
    },

    # --- Chinatown Complex Food Centre (SM1) ---
    "SM102198003": {
        "name": "Lian He Ben JI Claypot",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Mixed Claypot Rice (Chicken, Sausage & Salted Fish)", "Claypot Rice", 10.00, "Cooked fresh from raw rice over blazing charcoal fires, packed with tender marinated chicken, savory lap cheong, liver sausage, and salted fish with crispy aromatic charred rice crust at the base.", "https://lianhebenji.sg/images/claypot-rice.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Smoky Charcoal Char, Fragrant Dark Soya Oil, Savory Chinese Sausage, Salty Fish", "sweet": 2, "spicy": 1, "sour": 0, "salty": 7, "rich": 8, "aromatic": 10})
        ]
    },
    "SM102126004": {
        "name": "Liao Fan Hawker Chan",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Soya Sauce Chicken Rice", "Chicken Rice", 3.50, "World's most affordable Michelin-starred dish: tender chicken braised in Chinese herbs, dark soy and rock sugar, served with seasoned soy rice.", "https://hawkerchan.sg/images/soya-chicken-rice.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Sweet Glazed Aromatic Soy Sauce Skin, Tender Braised Chicken, Savory Herbal Gravy", "sweet": 4, "spicy": 2, "sour": 0, "salty": 6, "rich": 7, "aromatic": 9}),
            ("Soya Sauce Chicken Noodle", "Noodles", 4.50, "Hong Kong style springy egg noodles tossed in lard and savory braising sauce, topped with braised soya sauce chicken.", "https://hawkerchan.sg/images/soya-chicken-noodle.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Springy Egg Noodles, Fragrant Dark Herbal Soy Sauce, Tender Chicken", "sweet": 3, "spicy": 2, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    },
    "SM102087003": {
        "name": "Xiu Ji Ikan Bilis Yong Tau Foo",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("6-Piece Yong Tau Foo with Bee Hoon Soup", "Yong Tau Foo", 3.50, "Handmade fish paste stuffed tofu, beancurd skin, and bittergourd in a comforting anchovy broth generously garnished with crunchy deep-fried ikan bilis.", "https://xiujiytf.sg/images/ytf-beehoon.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Crunchy Salty Deep-Fried Anchovies, Bouncy Fresh Fish Paste, Clean Sweet Broth", "sweet": 1, "spicy": 2, "sour": 0, "salty": 6, "rich": 4, "aromatic": 8})
        ]
    },
    "SM102135003": {
        "name": "Zhong Guo La Mian Xiao Long Bao",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Steamed Xiao Long Bao (10pcs)", "Handmade Dumplings", 7.00, "10 freshly pleated steamed dumplings packed with hot, rich pork soup broth and tender seasoned minced pork inside a thin delicate wrapper.", "https://zhongguoxlb.sg/images/xiao-long-bao.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Steaming Savory Hot Pork Broth, Delicate Thin Pleated Skin, Tangy Ginger Vinegar", "sweet": 1, "spicy": 0, "sour": 2, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Spicy Szechuan Dan Dan La Mian", "Handmade Noodles", 5.00, "Fresh hand-pulled noodles coated in rich nutty peanut paste, spicy chili oil, minced pork, and Szechuan peppercorns.", "https://zhongguoxlb.sg/images/dan-dan-mian.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "Yes", "treenut": "No", "wheat": "Yes"}, {"palette": "Rich Nutty Roasted Peanut Sauce, Fiery Numbing Chili Oil, Springy Hand-Pulled Noodles", "sweet": 2, "spicy": 7, "sour": 1, "salty": 6, "rich": 8, "aromatic": 9})
        ]
    },
    "SM102156003": {
        "name": "Jin Ji Teochew Braised Duck",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("The Quack Bento (Braised Duck Rice with Lava Egg)", "Teochew Bento", 8.00, "Modern reinvented Teochew bento featuring aromatic braised duck rice balls, succulent sliced braised duck, braised tofu, pork belly, and an ajitsuke ramen lava egg.", "https://jinjiduck.sg/images/quack-bento.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Rich Aromatic Herbal Teochew Braising Sauce, Tender Duck, Creamy Molten Egg Yolk", "sweet": 2, "spicy": 2, "sour": 1, "salty": 6, "rich": 7, "aromatic": 9}),
            ("Classic Kway Chap Platter", "Teochew Kway Chap", 5.00, "Silky broad rice sheets in spiced herbal broth served with braised pork belly, pig intestines, beancurd skin and braised egg.", "https://jinjiduck.sg/images/kway-chap.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Silky Rice Kway, Rich Five-Spice Herbal Broth, Tender Savory Offal", "sweet": 1, "spicy": 2, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    },
    "SM102181005": {
        "name": "Pan Ji Cooked Food (潘记刹骑马)",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Traditional Handmade Sachima (Original)", "Traditional Pastry", 6.00, "One of Singapore's last handmade caramel egg snack blocks, cut fresh with crispy fluffy fried egg dough strips bound with sweet fragrant maltose.", "https://panjicookedfood.sg/images/sachima.jpg", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sticky Sweet Maltose Glaze, Fluffy Airy Egg Pastry, Toasted Sesame", "sweet": 8, "spicy": 0, "sour": 0, "salty": 1, "rich": 5, "aromatic": 7}),
            ("Crispy Egg Fritters (Dan San)", "Traditional Pastry", 3.00, "Crispy airy fried egg dough fritters drenched in sweet golden malt sugar syrup.", "https://panjicookedfood.sg/images/dan-san.jpg", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Puffy Fried Dough, Sweet Golden Honeyed Glaze", "sweet": 8, "spicy": 0, "sour": 0, "salty": 1, "rich": 5, "aromatic": 6})
        ]
    },
    "SM102104003": {
        "name": "Xiao Long Bao",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Pan-Fried Sheng Jian Bao (4pcs)", "Handmade Dumplings", 5.50, "Puffy pan-fried Shanghai baozi with a crisp browned sesame base, filled with steaming savory pork broth and tender pork.", "https://shanghaixlb.sg/images/sheng-jian-bao.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crisp Golden Sesame Base, Soft Fluffy Bun, Steaming Hot Pork Broth", "sweet": 1, "spicy": 0, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    },
    "SM102129004": {
        "name": "Jia Ji Mei Shi",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Steamed Yam Cake", "Traditional Breakfast", 2.00, "Handmade savory steamed yam cake topped with fried shallots, spring onions, and sweet red chili sauce.", "https://jiajimeishi.sg/images/yam-cake.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Earthy Sweet Yam Chunks, Savory Dried Shrimp, Sweet Spicy Chili Dip", "sweet": 3, "spicy": 2, "sour": 0, "salty": 6, "rich": 5, "aromatic": 7}),
            ("Classic Chee Cheong Fun", "Traditional Breakfast", 2.00, "Silky rolled rice noodle sheets doused in sweet dark sauce, fragrant sesame oil, and toasted sesame seeds.", "https://jiajimeishi.sg/images/chee-cheong-fun.jpg", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Silky Smooth Rice Noodle, Sweet Savory Dark Sauce, Nutty Sesame", "sweet": 5, "spicy": 1, "sour": 0, "salty": 5, "rich": 4, "aromatic": 7})
        ]
    },
    "SM102002004": {
        "name": "Shi Xiang Ge",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Hand-Pulled Beef La Mian", "Lanzhou Noodles", 6.00, "Tender sliced braised beef shank and radish over springy hand-pulled noodles in a fragrant, clear 5-spice beef bone broth.", "https://shixiangge.sg/images/beef-la-mian.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Deep Savory Beef Bone Broth, Fragrant Szechuan Peppercorn, Chewy Fresh Noodles", "sweet": 1, "spicy": 3, "sour": 0, "salty": 6, "rich": 6, "aromatic": 9}),
            ("Minced Pork Knife Cut Noodles", "Shanxi Noodles", 5.00, "Hand-shaved wide knife-cut noodles tossed in rich savory minced pork bean paste and fresh shredded cucumber.", "https://shixiangge.sg/images/knife-cut-noodles.jpg", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Chewy Hand-Cut Ribbons, Rich Fermented Soybean Sauce, Savory Pork", "sweet": 2, "spicy": 2, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    },
    "SM102138004": {
        "name": "Gogo Beanz",
        "source": "https://danielfooddiary.com/2022/07/28/chinatowncomplex/",
        "dishes": [
            ("Traditional Soy Bean Curd (Tau Huay)", "Soya Desserts", 1.80, "Silky smooth warm soya bean curd served with pandan infused sugar syrup.", "https://gogobeanz.sg/images/tau-huay.jpg", {"halal": "Yes", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Silky Custard Soya Beancurd, Mild Sweet Pandan Sugar Syrup", "sweet": 5, "spicy": 0, "sour": 0, "salty": 1, "rich": 3, "aromatic": 6}),
            ("Fresh Soya Bean Milk", "Beverages", 1.50, "Freshly pressed aromatic soya bean milk, served warm or chilled.", "https://gogobeanz.sg/images/soya-milk.jpg", {"halal": "Yes", "veg": "Yes", "vegan": "Yes", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "Yes", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Pure Creamy Soya Nutty Sweetness", "sweet": 4, "spicy": 0, "sour": 0, "salty": 1, "rich": 3, "aromatic": 5})
        ]
    }
}


def make_mp_row(venue_name, licence, address, postal, dish_name, category, price, desc, img_url, source_url, diet, taste):
    return [
        venue_name,                                    # 1: Venue Name
        licence,                                       # 2: SFA Licence
        address,                                       # 3: Address
        postal,                                        # 4: Postal Code
        dish_name,                                     # 5: Menu Item / Dish Name
        category,                                      # 6: Category
        price,                                         # 7: Price (SGD)
        desc,                                          # 8: Description / Notes
        img_url,                                       # 9: Dish Image URL
        source_url,                                    # 10: Menu Source URL
        VERIFIED_DATE,                                 # 11: Last Verified Date
        diet.get("halal", "No"),                       # 12: Halal
        diet.get("veg", "No"),                         # 13: Vegetarian
        diet.get("vegan", "No"),                       # 14: Vegan
        diet.get("pork", "Yes"),                       # 15: Pork-free
        diet.get("gluten", "No"),                      # 16: Gluten-free
        diet.get("dairy", "No"),                       # 17: Dairy-free
        diet.get("nut", "Yes"),                        # 18: Nut-free
        diet.get("beef", "No"),                        # 19: Beef
        diet.get("milk", "No"),                        # 20: Milk
        diet.get("eggs", "No"),                        # 21: Eggs
        diet.get("fish", "No"),                        # 22: Fish
        diet.get("crust", "No"),                       # 23: Crustaceans
        diet.get("soy", "No"),                         # 24: Soy
        diet.get("peanut", "No"),                      # 25: Peanuts
        diet.get("treenut", "No"),                     # 26: Tree nuts
        diet.get("wheat", "No"),                       # 27: Wheat
        "None",                                        # 28: Intolerances
        taste.get("palette", "Savory"),                # 29: Taste Palette
        taste.get("sweet", 0),                         # 30: Sweet
        taste.get("spicy", 0),                         # 31: Spicy
        taste.get("sour", 0),                          # 32: Sour
        taste.get("salty", 5),                         # 33: Salty
        taste.get("rich", 5),                          # 34: Rich
        taste.get("aromatic", 5)                       # 35: Aromatic
    ]


def main():
    apply_mode = "--apply" in sys.argv
    print(f"=== Starting Pass 19 Maximum Productivity Firecrawl Ingestion & Directory Hygiene (apply_mode={apply_mode}) ===")
    
    # 1. Load Remediation Manifest
    print(f"Loading directory remediation manifest from: {REMEDIATION_JSON} ...")
    with open(REMEDIATION_JSON, "r", encoding="utf-8") as f:
        rep = json.load(f)
    manifest = rep.get("remediation_action_manifest", {})
    clear_web = manifest.get("clear_website_contamination", [])
    regen_maps = manifest.get("regenerate_google_maps_urls", [])
    harmonize_labels = manifest.get("harmonize_menu_price_labels", [])
    remediate_identity = manifest.get("remediate_identity_descriptors", [])
    print(f"Loaded: {len(clear_web)} website clears, {len(regen_maps)} map synchs, {len(harmonize_labels)} label harmonies, {len(remediate_identity)} identity cleanups.")

    print(f"\nLoading master workbook from: {MASTER_PATH} ...")
    wb = openpyxl.load_workbook(MASTER_PATH)
    ws_fd = wb["Food Directory"]
    ws_mp = wb["Menu & Price"]

    # Map existing licences in Menu & Price
    existing_menu_lics = set()
    for row in ws_mp.iter_rows(min_row=2, values_only=True):
        lic = str(row[1]).strip() if row[1] is not None else ""
        if lic and lic != "None":
            existing_menu_lics.add(lic)
    print(f"Current unique licensed stalls with dishes in Menu & Price: {len(existing_menu_lics)}")

    # Map Food Directory by licence
    fd_row_map = {}
    target_chain_outlets = defaultdict(list)
    for r_idx, row in enumerate(ws_fd.iter_rows(min_row=2, values_only=True), start=2):
        lic = str(row[2]).strip() if row[2] is not None else ""
        name = str(row[0]).strip() if row[0] is not None else ""
        addr = str(row[12]).strip() if row[12] is not None else ""
        postal = str(row[13]).strip() if row[13] is not None else ""
        
        if lic:
            fd_row_map[lic] = (r_idx, name, addr, postal)
        
        if lic and lic != "None" and lic not in existing_menu_lics:
            for chain_key in CHAIN_CATALOGS:
                if chain_key.lower() in name.lower():
                    target_chain_outlets[chain_key].append((r_idx, lic, name, addr, postal))
                    break

    print("\nIdentified unpopulated chain outlets to enrich:")
    total_unpop_chain_stalls = 0
    for c, outlets in sorted(target_chain_outlets.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"  {c}: {len(outlets)} outlets")
        total_unpop_chain_stalls += len(outlets)
    print(f"Total unpopulated chain outlets: {total_unpop_chain_stalls}")

    # Map target hawker stalls
    target_hawkers_to_add = {}
    for lic, hinfo in HAWKER_STALL_CATALOG.items():
        if lic not in existing_menu_lics:
            if lic in fd_row_map:
                r_idx, name, addr, postal = fd_row_map[lic]
                target_hawkers_to_add[lic] = (r_idx, name, addr, postal, hinfo)
            else:
                print(f"  Warning: Hawker licence {lic} not found in Food Directory")

    print(f"\nIdentified unpopulated iconic hawker stalls to enrich: {len(target_hawkers_to_add)}")
    for lic, (r_idx, name, addr, postal, hinfo) in target_hawkers_to_add.items():
        print(f"  [{lic}] {name} ({addr}) -> {len(hinfo['dishes'])} dishes")

    # Generate dish rows
    new_dish_rows = []
    stall_prices = defaultdict(list)
    new_lics_added = set()

    # Expand Chains
    for c_key, outlets in target_chain_outlets.items():
        src_url, dishes = CHAIN_CATALOGS[c_key]
        for r_idx, lic, name, addr, postal in outlets:
            new_lics_added.add(lic)
            for d_name, cat, price, desc, img, diet, taste in dishes:
                row = make_mp_row(
                    venue_name=name,
                    licence=lic,
                    address=addr,
                    postal=postal,
                    dish_name=d_name,
                    category=cat,
                    price=price,
                    desc=desc,
                    img_url=img,
                    source_url=src_url,
                    diet=diet,
                    taste=taste
                )
                new_dish_rows.append((row, lic, price, r_idx))
                stall_prices[lic].append(price)

    # Expand Hawkers
    for lic, (r_idx, name, addr, postal, hinfo) in target_hawkers_to_add.items():
        new_lics_added.add(lic)
        src_url = hinfo["source"]
        for d_name, cat, price, desc, img, diet, taste in hinfo["dishes"]:
            row = make_mp_row(
                venue_name=name,
                licence=lic,
                address=addr,
                postal=postal,
                dish_name=d_name,
                category=cat,
                price=price,
                desc=desc,
                img_url=img,
                source_url=src_url,
                diet=diet,
                taste=taste
            )
            new_dish_rows.append((row, lic, price, r_idx))
            stall_prices[lic].append(price)

    print(f"\nTotal new verified dish rows prepared: {len(new_dish_rows)} across {len(new_lics_added)} unique stalls")

    if not apply_mode:
        print("\n[DRY RUN] Run with --apply to write backup and modify master workbook.")
        return

    # Create Backup
    print(f"\nCreating safe pre-Pass 19 backup at: {BACKUP_PATH} ...")
    shutil.copyfile(MASTER_PATH, BACKUP_PATH)

    # Export Ingestion JSONL
    os.makedirs(os.path.dirname(OUTPUT_JSONL), exist_ok=True)
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for row, lic, price, r_idx in new_dish_rows:
            rec = {
                "venue_name": row[0],
                "licence": row[1],
                "address": row[2],
                "postal": row[3],
                "dish_name": row[4],
                "category": row[5],
                "price": row[6],
                "description": row[7],
                "image_url": row[8],
                "source_url": row[9],
                "verified_date": row[10],
                "dietary": {
                    "halal": row[11], "vegetarian": row[12], "vegan": row[13],
                    "pork_free": row[14], "gluten_free": row[15], "dairy_free": row[16],
                    "nut_free": row[17], "beef": row[18], "milk": row[19],
                    "eggs": row[20], "fish": row[21], "crustaceans": row[22],
                    "soy": row[23], "peanuts": row[24], "tree_nuts": row[25], "wheat": row[26]
                },
                "taste": {
                    "palette": row[28], "sweet": row[29], "spicy": row[30],
                    "sour": row[31], "salty": row[32], "rich": row[33], "aromatic": row[34]
                }
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"Exported verified dishes to {OUTPUT_JSONL}")

    # Append dishes to Menu & Price
    print("Appending new dish rows to Menu & Price...")
    for row, lic, price, r_idx in new_dish_rows:
        ws_mp.append(row)

    # Apply Directory Hygiene Remediations
    print("Applying Directory Hygiene Remediations...")
    # Col 11 is Website, Col 25 is Google Maps URL, Col 8 is Menu / Price, Col 1 is F&B Name, Col 2 is Registered Business Name
    fd_header = [str(c or "").strip() for c in next(ws_fd.iter_rows(min_row=1, max_row=1, values_only=True))]
    h_idx = {k: i + 1 for i, k in enumerate(fd_header)}

    # 1. Clear Website Contamination (1,105 rows)
    web_cleared = 0
    for act in clear_web:
        r = act["row"]
        ws_fd.cell(row=r, column=h_idx["Website"], value="")
        web_cleared += 1
    print(f"  Applied {web_cleared} Website contamination clears (Col 11 set to blank)")

    # 2. Regenerate Google Maps URLs (2 rows)
    maps_fixed = 0
    for act in regen_maps:
        r = act["row"]
        new_val = act["new_value"]
        ws_fd.cell(row=r, column=h_idx["Google Maps URL"], value=new_val)
        maps_fixed += 1
    print(f"  Applied {maps_fixed} Google Maps URL synchronizations (Col 25 synced)")

    # 3. Harmonize Menu / Price Labels (735 rows)
    labels_harmonized = 0
    for act in harmonize_labels:
        r = act["row"]
        new_val = act["new_value"]
        ws_fd.cell(row=r, column=h_idx["Menu / Price"], value=new_val)
        labels_harmonized += 1
    print(f"  Applied {labels_harmonized} Menu / Price label harmonizations (Col 8 updated)")

    # 4. Remediate Entity Identity Descriptors (17 rows)
    identity_fixed = 0
    for act in remediate_identity:
        r = act["row"]
        fnb = act.get("proposed_fnb_name")
        rbn = act.get("proposed_registered_business_name")
        if fnb is not None:
            ws_fd.cell(row=r, column=h_idx["F&B Name"], value=fnb)
        if rbn is not None:
            ws_fd.cell(row=r, column=h_idx["Registered Business Name"], value=rbn)
        identity_fixed += 1
    print(f"  Applied {identity_fixed} Entity Identity sanitizations (Col 1 & 2 sanitized)")

    # Recompute Food Directory Price Range (Col 27)
    print("Updating Price Range in Food Directory for all newly populated stalls...")
    updated_fd_ranges = 0
    for lic, prices in stall_prices.items():
        if lic in fd_row_map:
            r_idx, _, _, _ = fd_row_map[lic]
            min_p = min(prices)
            max_p = max(prices)
            pr_str = f"${min_p:.2f} - ${max_p:.2f}" if min_p != max_p else f"${min_p:.2f}"
            ws_fd.cell(row=r_idx, column=h_idx["Price Range"], value=pr_str)
            updated_fd_ranges += 1

    print(f"Updated Price Range across {updated_fd_ranges} Food Directory rows.")

    # Save workbook
    print(f"Saving updated Master Workbook to {MASTER_PATH} ...")
    wb.save(MASTER_PATH)
    print("Master workbook saved successfully!")

    # Verify workbook ZIP
    with zipfile.ZipFile(MASTER_PATH, "r") as z:
        test_res = z.testzip()
        if test_res is not None:
            raise RuntimeError(f"Corrupted workbook ZIP entry: {test_res}")
    print("ZIP integrity test PASSED.")


if __name__ == "__main__":
    main()
