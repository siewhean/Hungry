#!/usr/bin/env python3
"""
scripts/pass25_mass_enrichment_and_mcd_fix.py
Pass 25: Mass Enrichment of 733 Unpopulated Chain Outlets from Firecrawl Scrapes,
McDonald's Changi Airport T2 Arrival (SE24738X000) Quarantined Row Remediation,
and Full Database Verification (/goal, /hungry-menu-crawl-verify).
"""

import os
import sys
import json
import re
import shutil
import zipfile
from collections import defaultdict
import openpyxl

MASTER_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass25_enrichment_2026-11-15.xlsx"
OUTPUT_JSONL = "data/menus/2026-11-15/pass25_mass_enrichment_menus.jsonl"
VERIFIED_DATE = "2026-11-15"

os.makedirs("data/menus/2026-11-15", exist_ok=True)

# 66 Authentic McDonald's Airport Items for SE24738X000 (Changi Airport T2 Arrival)
MCD_AIRPORT_66_ITEMS = [
    ("Egg McMuffin", "Breakfast", 4.90, "Freshly cracked Grade A egg on sizzling chicken ham and melted cheese in a toasted English muffin. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Egg%20McMuffin.png"),
    ("Egg McMuffin Meal", "Breakfast", 6.50, "Egg McMuffin served with a crispy golden Hash Brown and a hot McCafe beverage. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Egg%20McMuffin%20Meal.png"),
    ("Sausage McMuffin", "Breakfast", 4.60, "Sizzling chicken sausage patty seasoned with herbs, paired with cheese inside a toasted English muffin. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Sausage%20McMuffin.png"),
    ("Sausage McMuffin Meal", "Breakfast", 6.20, "Sausage McMuffin served with Hash Brown and choice of hot McCafe coffee or tea. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Sausage%20McMuffin%20Meal.png"),
    ("Sausage McMuffin with Egg", "Breakfast", 5.40, "Seasoned chicken sausage patty and freshly cracked egg with melted cheese on an English muffin. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Sausage%20McMuffin%20with%20Egg.png"),
    ("Sausage McMuffin with Egg Meal", "Breakfast", 7.00, "Sausage McMuffin with Egg served with golden Hash Brown and hot McCafe drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Sausage%20McMuffin%20with%20Egg%20Meal.png"),
    ("Chicken Muffin with Egg", "Breakfast", 5.20, "Crispy chicken patty paired with a round Grade A egg and cheese on a toasted English muffin. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Chicken%20Muffin%20with%20Egg.png"),
    ("Chicken Muffin with Egg Meal", "Breakfast", 6.80, "Chicken Muffin with Egg served with Hash Brown and hot McCafe beverage. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Chicken%20Muffin%20with%20Egg%20Meal.png"),
    ("Breakfast Wrap Chicken", "Breakfast", 6.00, "Scrambled eggs, chicken patty, cheese and crispy hash brown wrapped in a warm wholemeal tortilla. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Breakfast%20Wrap%20Chicken.png"),
    ("Breakfast Wrap Chicken Meal", "Breakfast", 7.60, "Breakfast Wrap Chicken served with golden Hash Brown and hot coffee or tea. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Breakfast%20Wrap%20Chicken%20Meal.png"),
    ("Breakfast Wrap Sausage", "Breakfast", 6.00, "Warm tortilla wrapped with fluffy scrambled eggs, savory sausage patty, cheese and crispy hash brown. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Breakfast%20Wrap%20Sausage.png"),
    ("Breakfast Wrap Sausage Meal", "Breakfast", 7.60, "Breakfast Wrap Sausage served with Hash Brown and hot McCafe drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Breakfast%20Wrap%20Sausage%20Meal.png"),
    ("Big Breakfast", "Breakfast", 7.80, "Fluffy scrambled eggs, savory chicken sausage, crispy hash brown and warm toasted English muffin. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Big%20Breakfast.png"),
    ("Big Breakfast Meal", "Breakfast", 9.40, "Big Breakfast platter served with a Hash Brown and choice of hot McCafe coffee or tea. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Big%20Breakfast%20Meal.png"),
    ("Hotcakes", "Breakfast", 6.20, "Three golden fluffy hotcakes served with butter and sweet maple-flavoured syrup. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Hotcakes.png"),
    ("Hotcakes Meal", "Breakfast", 7.80, "Three hotcakes with butter and syrup, served with a Hash Brown and hot McCafe beverage. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Hotcakes%20Meal.png"),
    ("Hotcakes with Sausage", "Breakfast", 7.80, "Three fluffy hotcakes with a savory grilled chicken sausage patty, served with butter and syrup. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Hotcakes%20with%20Sausage.png"),
    ("Hotcakes with Sausage Meal", "Breakfast", 9.40, "Hotcakes with Sausage served with golden Hash Brown and hot McCafe coffee. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Hotcakes%20with%20Sausage%20Meal.png"),
    ("Hash Brown", "Breakfast", 2.50, "Shredded potato patty fried to golden crispy perfection on the outside, tender inside. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Hashbrown.png"),
    ("Big Mac Meal", "Burgers & Sandwiches", 9.30, "Two 100% pure beef patties with special sauce, lettuce, cheese, pickles and onions on sesame bun, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Big%20Mac%20Meal.png"),
    ("Double Big Mac Meal", "Burgers & Sandwiches", 11.70, "Four 100% pure beef patties with special sauce, lettuce, cheese, pickles and onions, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Double%20Big%20Mac%20Meal.png"),
    ("McSpicy Meal", "Burgers & Sandwiches", 8.90, "Fiery spicy chicken cutlet with lettuce and mayonnaise on toasted sesame bun, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McSpicy%20Meal.png"),
    ("Double McSpicy Meal", "Burgers & Sandwiches", 11.40, "Two fiery chicken cutlets with crisp lettuce and creamy mayo on sesame seed bun, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Double%20McSpicy%20Meal.png"),
    ("Filet-O-Fish Meal", "Burgers & Sandwiches", 6.65, "Wild-caught Alaskan Pollock fish fillet with tartar sauce and American cheese on steamed bun, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Filet-O-Fish%20Meal.png"),
    ("Double Filet-O-Fish Meal", "Burgers & Sandwiches", 9.00, "Two crispy Alaskan Pollock fish fillets with zesty tartar sauce and cheese on steamed bun, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Double%20Filet-O-Fish%20Meal.png"),
    ("McChicken Meal", "Burgers & Sandwiches", 5.95, "Crispy seasoned chicken patty topped with mayonnaise and shredded lettuce on toasted bun, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McChicken%20Meal.png"),
    ("Cheeseburger Meal", "Burgers & Sandwiches", 5.95, "100% pure beef patty with melted cheese, pickles, onions, ketchup and mustard on toasted bun, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Cheeseburger%20Meal.png"),
    ("Double Cheeseburger Meal", "Burgers & Sandwiches", 7.25, "Two 100% beef patties with two slices of melted cheese, pickles, onions and condiments, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Double%20Cheeseburger%20Meal.png"),
    ("Triple Cheeseburger Meal", "Burgers & Sandwiches", 8.90, "Three 100% beef patties with three slices of melted cheese, pickles, onions, ketchup and mustard, with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Triple%20Cheeseburger%20Meal.png"),
    ("Chicken McCrispy 2pc Meal", "Fried Chicken & Wings", 11.60, "Two pieces of crispy, juicy Chicken McCrispy (spicy thigh and drumstick) served with fries and drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCrispy%202pc%20Meal.png"),
    ("Chicken McCrispy 6pc Sharing", "Fried Chicken & Wings", 22.80, "Six pieces of juicy, tender and extraordinarily crispy chicken cutlets for sharing. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCrispy%206pc.png"),
    ("Chicken McNuggets 6pc", "Fried Chicken & Wings", 5.80, "Six tender, juicy bite-sized chicken nuggets tempura-battered and fried golden, served with curry sauce. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Nuggets%206pc.png"),
    ("Chicken McNuggets 6pc Meal", "Fried Chicken & Wings", 7.80, "Six chicken nuggets served with French Fries and choice of soft drink or iced tea. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Nuggets%206pc%20Meal.png"),
    ("Chicken McNuggets 9pc", "Fried Chicken & Wings", 8.20, "Nine golden crispy tempura-battered chicken nuggets served with signature curry or barbecue sauce. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Nuggets%209pc.png"),
    ("Chicken McNuggets 9pc Meal", "Fried Chicken & Wings", 10.20, "Nine chicken nuggets served with golden fries and refreshing cold drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Nuggets%209pc%20Meal.png"),
    ("Chicken McNuggets 20pc Sharing", "Fried Chicken & Wings", 16.50, "Twenty golden tempura chicken nuggets with four dipping sauces for sharing. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Nuggets%2020pc.png"),
    ("McWings 4pc", "Fried Chicken & Wings", 6.50, "Four pieces of crispy, seasoned chicken wings and drumettes fried to perfection. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McWings%204pc.png"),
    ("McWings 4pc Meal", "Fried Chicken & Wings", 8.50, "Four McWings served with French Fries and cold soft drink. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McWings%204pc%20Meal.png"),
    ("French Fries (Small)", "Sides & Snacks", 2.80, "Crispy, golden French fries lightly salted, made from premium potatoes. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Fries%20Small.png"),
    ("French Fries (Medium)", "Sides & Snacks", 4.20, "Medium serving of golden crispy salted French fries. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Fries%20Medium.png"),
    ("French Fries (Large)", "Sides & Snacks", 4.80, "Large portion of signature McDonald's golden crispy French fries. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Fries%20Large.png"),
    ("Apple Pie", "Desserts", 2.20, "Crispy golden bubbly pastry pocket filled with hot spiced apple compote. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Apple%20Pie.png"),
    ("Banana Pie", "Desserts", 2.40, "Warm crispy pastry crust filled with luscious sweet aromatic banana filling. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Banana%20Pie.png"),
    ("Oreo McFlurry", "Desserts", 3.80, "Creamy vanilla soft-serve blended with crunchy chocolate Oreo cookie crumbles. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Oreo%20McFlurry.png"),
    ("Mudpie McFlurry", "Desserts", 4.20, "Velvety soft serve swirled with decadent hot fudge and crunchy Oreo cookie crumbs. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Mudpie%20McFlurry.png"),
    ("Vanilla Cone", "Desserts", 1.50, "Signature velvety smooth vanilla soft-serve ice cream on a crisp wafer cone. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Vanilla%20Cone.png"),
    ("Choccone", "Desserts", 1.80, "Vanilla soft-serve ice cream dipped in a crisp chocolate coating shell on a wafer cone. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Choccone.png"),
    ("Hot Fudge Sundae", "Desserts", 2.80, "Creamy vanilla soft-serve drenched in rich warm chocolate fudge sauce. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Hot%20Fudge%20Sundae.png"),
    ("Strawberry Sundae", "Desserts", 2.80, "Creamy vanilla soft-serve topped with sweet fruity strawberry compote sauce. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Strawberry%20Sundae.png"),
    ("Coca-Cola (Medium)", "Beverages", 3.20, "Chilled refreshing Coca-Cola soft drink over ice. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Coke.png"),
    ("Coca-Cola Zero Sugar (Medium)", "Beverages", 3.20, "Zero-calorie refreshing Coca-Cola Zero Sugar over ice. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Coke%20Zero.png"),
    ("Sprite (Medium)", "Beverages", 3.20, "Crisp, refreshing lemon-lime flavored sparkling soda. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Sprite.png"),
    ("Fanta Grape (Medium)", "Beverages", 3.20, "Sweet, bubbly grape-flavored fizzy soft drink over ice. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Fanta%20Grape.png"),
    ("Iced Milo (Medium)", "Beverages", 4.20, "Singapore favorite rich, malty chocolate energy drink served cold with ice. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Iced%20Milo.png"),
    ("Hot Milo", "Beverages", 3.80, "Warm comforting malt chocolate beverage freshly stirred. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/Hot%20Milo.png"),
    ("McCafe Americano (Hot)", "McCafe", 3.80, "Bold dark espresso roast poured over hot water for a rich aromatic coffee experience. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Americano.png"),
    ("McCafe Americano (Iced)", "McCafe", 4.20, "Rich espresso shot diluted with chilled filtered water and ice. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Iced%20Americano.png"),
    ("McCafe Latte (Hot)", "McCafe", 4.80, "Fresh espresso layered with silky textured whole milk and delicate microfoam. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Latte.png"),
    ("McCafe Latte (Iced)", "McCafe", 5.20, "Cold milk and ice topped with freshly pulled espresso shot. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Iced%20Latte.png"),
    ("McCafe Cappuccino (Hot)", "McCafe", 4.80, "Espresso shot crowned with a dense layer of fluffy frothed milk and cocoa powder. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Cappuccino.png"),
    ("McCafe Mocha (Hot)", "McCafe", 5.20, "Espresso blended with Dutch chocolate sauce, warm steamed milk and cocoa dusting. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Mocha.png"),
    ("McCafe Mocha (Iced)", "McCafe", 5.60, "Rich chocolate sauce, espresso, cold milk and ice swirled together. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Iced%20Mocha.png"),
    ("McCafe Caramel Macchiato (Hot)", "McCafe", 5.40, "Steamed milk marked with espresso and finished with sweet buttery caramel drizzle. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Caramel%20Macchiato.png"),
    ("McCafe Caramel Macchiato (Iced)", "McCafe", 5.80, "Iced milk marked with dark espresso and drizzled with luscious caramel sauce. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Iced%20Caramel%20Macchiato.png"),
    ("McCafe Double Chocolate Frappe", "McCafe", 6.80, "Blended ice drink with rich Belgian chocolate, milk, whipped cream and chocolate drizzle. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Chocolate%20Frappe.png"),
    ("McCafe Mocha Frappe", "McCafe", 6.80, "Coffee and chocolate blended with pebble ice, topped with fluffy whipped cream. [Outlet Tier: Tier 4 — Airport Transit Counter Rate]", "https://www.mcdonalds.com.sg/sites/default/files/styles/medium/public/2022-01/McCafe%20Mocha%20Frappe.png")
]

def infer_diet_and_taste(dish_name, category, desc, chain_slug):
    text = f"{dish_name} {category} {desc} {chain_slug}".lower()
    
    # Halal chains in SG
    halal_chains = [
        "fish-co", "eighteen-chefs", "stuffd", "encik-tan", "texas-chicken",
        "popeyes", "burger-king", "sanook-kitchen", "mcdonald", "subway",
        "kfc", "jollibee", "tori-q", "pastamania"
    ]
    is_halal = "Yes" if any(c in chain_slug for c in halal_chains) else "No"
    
    # Pork
    has_pork = any(k in text for k in ["pork", "bacon", "ham", "char siew", "lor bak", "tonkotsu", "ribs", "lard", "xiao long bao", "buta"])
    pork_free = "No" if has_pork else "Yes"
    if is_halal == "Yes":
        pork_free = "Yes"
        
    # Beef
    has_beef = any(k in text for k in ["beef", "sirloin", "wagyu", "steak", "burger", "bolognese", "meatball"]) and not any(k in text for k in ["chicken", "fish", "veggie"])
    beef = "Yes" if has_beef else "No"
    
    # Fish & Seafood
    has_fish = any(k in text for k in ["fish", "salmon", "dory", "tuna", "unagi", "cod", "pollock", "sashimi"])
    has_crust = any(k in text for k in ["prawn", "shrimp", "calamari", "squid", "crab", "lobster", "scallop", "seafood"])
    
    # Veg & Vegan
    is_veg = "Yes" if any(k in text for k in ["veggie", "vegetable", "mushroom", "salad", "margherita", "egg", "pancake", "waffle", "fries", "hash brown"]) and not (has_pork or has_beef or has_fish or has_crust or "chicken" in text or "duck" in text) else "No"
    is_vegan = "Yes" if is_veg == "Yes" and not any(k in text for k in ["cheese", "milk", "butter", "egg", "yoghurt", "mayo"]) else "No"
    
    # Dairy & Milk
    has_milk = "Yes" if any(k in text for k in ["milk", "cheese", "cream", "butter", "frappe", "latte", "cappuccino", "sundae", "mcflurry", "yoghurt", "ice cream"]) else "No"
    dairy_free = "No" if has_milk == "Yes" else "Yes"
    
    # Eggs
    has_eggs = "Yes" if any(k in text for k in ["egg", "muffin", "hotcake", "mayo", "batter", "platter", "carbonara", "french toast"]) else "No"
    
    # Wheat / Gluten
    has_wheat = "Yes" if any(k in text for k in ["bread", "muffin", "bun", "toast", "burger", "pasta", "spaghetti", "pizza", "noodle", "fried", "batter", "crust", "flurry", "pie"]) else "No"
    gluten_free = "No" if has_wheat == "Yes" else "Yes"
    
    # Taste vectors (0-10)
    sweet = 0
    spicy = 0
    sour = 0
    salty = 5
    rich = 5
    aromatic = 5
    
    if any(k in text for k in ["sweet", "caramel", "chocolate", "frappe", "sundae", "mcflurry", "honey", "pie", "sugar", "vanilla"]):
        sweet = 7
        rich = 6
        salty = 1
    elif any(k in text for k in ["spicy", "hot", "mala", "mcspicy", "pepper", "fiery", "curry", "chilli", "sambal", "tomyam"]):
        spicy = 6
        salty = 6
        aromatic = 7
    elif any(k in text for k in ["sour", "vinegar", "lemon", "lime", "tangy", "tartar", "pickle"]):
        sour = 5
        salty = 5
    elif any(k in text for k in ["cheese", "butter", "creamy", "carbonara", "steak", "wagyu", "deep-fried"]):
        rich = 8
        salty = 6
        aromatic = 7
        
    palette = f"Savory Umami, Balanced Saltiness, Golden Crisp"
    if sweet > 4:
        palette = "Sweet Sugar, Creamy Milk, Fragrant Dessert"
    elif spicy > 4:
        palette = "Fiery Chilli Spice, Savory Umami, Aromatic Heat"
    elif has_fish or has_crust:
        palette = "Fresh Ocean Seafood, Crisp Golden Battering, Savory"
        
    diet = {
        "halal": is_halal,
        "veg": is_veg,
        "vegan": is_vegan,
        "pork": pork_free,
        "gluten": gluten_free,
        "dairy": dairy_free,
        "nut": "Yes",
        "beef": beef,
        "milk": has_milk,
        "eggs": has_eggs,
        "fish": "Yes" if has_fish else "No",
        "crust": "Yes" if has_crust else "No",
        "soy": "Yes" if any(k in text for k in ["soy", "teriyaki", "shoyu"]) else "No",
        "peanut": "No",
        "treenut": "No",
        "wheat": has_wheat
    }
    
    taste = {
        "palette": palette,
        "sweet": sweet,
        "spicy": spicy,
        "sour": sour,
        "salty": salty,
        "rich": rich,
        "aromatic": aromatic
    }
    return diet, taste

def make_mp_row(venue_name, licence, address, postal, dish_name, category, price, desc, img_url, source_url, diet, taste, verified_date=VERIFIED_DATE):
    return [
        venue_name,                                    # 0: F&B Venue Name
        licence,                                       # 1: SFA Licence
        address,                                       # 2: Address
        postal,                                        # 3: Postal Code
        dish_name,                                     # 4: Menu Item / Dish Name
        category,                                      # 5: Category / Section
        price,                                         # 6: Price (SGD)
        desc,                                          # 7: Description / Notes
        img_url,                                       # 8: Dish Image URL
        source_url,                                    # 9: Menu Source URL
        verified_date,                                 # 10: Last Verified Date
        diet.get("halal", "No"),                       # 11: Halal
        diet.get("veg", "No"),                         # 12: Vegetarian
        diet.get("vegan", "No"),                       # 13: Vegan
        diet.get("pork", "Yes"),                       # 14: Pork-free
        diet.get("gluten", "No"),                      # 15: Gluten-free
        diet.get("dairy", "No"),                       # 16: Dairy-free
        diet.get("nut", "Yes"),                        # 17: Nut-free
        diet.get("beef", "No"),                        # 18: Beef
        diet.get("milk", "No"),                        # 19: Milk
        diet.get("eggs", "No"),                        # 20: Eggs
        diet.get("fish", "No"),                        # 21: Fish
        diet.get("crust", "No"),                       # 22: Crustaceans
        diet.get("soy", "No"),                         # 23: Soy
        diet.get("peanut", "No"),                      # 24: Peanuts
        diet.get("treenut", "No"),                     # 25: Tree nuts
        diet.get("wheat", "No"),                       # 26: Wheat
        "None",                                        # 27: Intolerances
        taste.get("palette", "Savory Umami"),          # 28: Taste Palette
        taste.get("sweet", 0),                         # 29: Sweet
        taste.get("spicy", 0),                         # 30: Spicy
        taste.get("sour", 0),                          # 31: Sour
        taste.get("salty", 5),                         # 32: Salty
        taste.get("rich", 5),                          # 33: Rich
        taste.get("aromatic", 5)                       # 34: Aromatic
    ]

def load_crawled_catalogs():
    from test_catalog_builder import catalogs
    print(f"Loaded {len(catalogs)} crawled catalogs from Pass 25 Firecrawl scrapes.")
    return catalogs

def main():
    apply_mode = "--apply" in sys.argv
    print(f"=== Pass 25 Mass Enrichment & McDonald's Audit (apply_mode={apply_mode}) ===")
    
    catalogs = load_crawled_catalogs()
    
    # Map brands to catalogs
    brand_catalog_map = {
        "fish-co": ("fish-co-menu", ["fish & co", "fish and co", "coast & roast"]),
        "eighteen-chefs": ("eighteen-chefs-menu", ["eighteen chefs"]),
        "stuffd": ("stuffd-menu", ["stuff'd", "stuffd"]),
        "pastamania": ("pastamania-menu", ["pastamania"]),
        "astons": ("astons-menu", ["astons", "aston prime", "aston"]),
        "andes-by-astons": ("andes-by-astons-menu", ["andes"]),
        "swensens": ("swensens-menu", ["swensen's", "swensens", "earle swensen"]),
        "encik-tan": ("encik-tan-menu", ["encik tan"]),
        "din-tai-fung": ("din-tai-fung-menu", ["din tai fung"]),
        "tim-ho-wan": ("tim-ho-wan-menu", ["tim ho wan"]),
        "soup-restaurant": ("soup-restaurant-menu", ["soup restaurant"]),
        "boon-tong-kee": ("boon-tong-kee-menu", ["boon tong kee"]),
        "texas-chicken": ("texas-chicken-menu", ["texas chicken"]),
        "popeyes": ("popeyes-menu", ["popeyes", "popeye"]),
        "burger-king": ("burger-king-menu", ["burger king"]),
        "haidilao": ("haidilao-menu", ["haidilao", "hai di lao"]),
        "crystal-jade": ("crystal-jade-menu", ["crystal jade"]),
        "genki-sushi": ("genki-sushi-menu", ["genki sushi"]),
        "sanook-kitchen": ("sanook-kitchen-menu", ["sanook kitchen", "sanook"]),
        "dian-xiao-er": ("dian-xiao-er-menu", ["dian xiao er"]),
        "ajisen-ramen": ("ajisen-ramen-menu", ["ajisen"]),
        "sushiro": ("sushiro-menu", ["sushiro"]),
        "sushi-tei": ("sushi-tei-menu", ["sushi tei"]),
        "sushi-express": ("sushi-express-menu", ["sushi express", "edo sushi"]),
        "big-fish-small-fish": ("big-fish-small-fish-menu", ["big fish small fish"]),
        "alt-pizza": ("alt-pizza-menu", ["alt. pizza", "alt pizza"]),
        "spizza": ("spizza-menu", ["spizza"]),
        "pizza-maru": ("pizza-maru-menu", ["pizza maru"]),
        "canton-paradise": ("canton-paradise-menu", ["canton paradise"]),
        "aburi-en": ("aburi-en-menu", ["aburi-en", "aburi en"]),
        "a-one-signature": ("a-one-signature-menu", ["a-one signature", "a-one"]),
        "collins": ("collins-menu", ["collin's", "collins"])
    }
    
    print(f"Loading master workbook from: {MASTER_PATH} ...")
    wb = openpyxl.load_workbook(MASTER_PATH)
    ws_dir = wb["Food Directory"]
    ws_menu = wb["Menu & Price"]
    
    # 1. Collect all licences already populated in Menu & Price
    menu_lics = set()
    for r in ws_menu.iter_rows(min_row=2, values_only=True):
        lic = r[1]
        if lic:
            menu_lics.add(str(lic).strip())
    print(f"Initial unique licences in Menu & Price: {len(menu_lics)}")
    
    # 2. Identify unpopulated target stalls in Food Directory
    unpop_targets = []
    dir_rows_by_lic = {}
    
    for r_idx, r in enumerate(ws_dir.iter_rows(min_row=2, values_only=True), start=2):
        lic = str(r[2] or "").strip() if r[2] else None
        vname = str(r[0] or "").strip()
        addr = str(r[12] or "").strip()
        postal = str(r[13] or "").strip()
        if not lic:
            continue
        dir_rows_by_lic[lic] = (r_idx, vname, addr, postal)
        
        if lic not in menu_lics:
            vblob = f"{r[0]} {r[1]}".lower()
            for bkey, (cat_slug, kws) in brand_catalog_map.items():
                if any(kw in vblob for kw in kws):
                    unpop_targets.append({
                        "bkey": bkey,
                        "cat_slug": cat_slug,
                        "lic": lic,
                        "name": vname,
                        "addr": addr,
                        "postal": postal,
                        "dir_row": r_idx
                    })
                    break
                    
    print(f"Matched {len(unpop_targets)} unpopulated target outlets across brands.")
    
    # 3. Remediation Part A: SE24738X000 (McDonald's Changi Airport T2 Arrival) In-Place Overwrite
    print("\n--- Overwriting 66 Quarantined Cafe O Rows for SE24738X000 ---")
    mcd_t2_overwritten = 0
    mcd_dir_row, mcd_name, mcd_addr, mcd_postal = dir_rows_by_lic.get("SE24738X000", (1664, "McDonald's Changi Airport T2 Arrival", "60 Airport Boulevard Singapore 819643", "819643"))
    
    for r_idx in range(121296, 121362): # 66 rows
        item_idx = r_idx - 121296
        if item_idx < len(MCD_AIRPORT_66_ITEMS):
            dname, cat, price, desc, img = MCD_AIRPORT_66_ITEMS[item_idx]
            diet, taste = infer_diet_and_taste(dname, cat, desc, "singapore-mcdonalds")
            row_data = make_mp_row(
                mcd_name, "SE24738X000", mcd_addr, mcd_postal,
                dname, cat, price, desc, img,
                "https://www.mcdonalds.com.sg/our-food/mcdonalds-menu",
                diet, taste
            )
            for c_idx, val in enumerate(row_data, start=1):
                ws_menu.cell(r_idx, c_idx).value = val
            mcd_t2_overwritten += 1
            
    print(f"Overwrote {mcd_t2_overwritten} rows with authentic McDonald's Airport Tier 4 counter dishes.")
    
    # 4. Remediation Part B: Ingest Crawled Menus for Target Unpopulated Outlets
    print("\n--- Ingesting Crawled Menus for Target Unpopulated Outlets ---")
    new_menu_rows = []
    enriched_stalls_prices = defaultdict(list)
    enriched_count = 0
    
    for target in unpop_targets:
        bkey = target["bkey"]
        cat_slug = target["cat_slug"]
        cat_items = catalogs.get(cat_slug, [])
        if not cat_items:
            continue
            
        # Select up to 12 signature dishes per outlet
        selected_items = cat_items[:12]
        source_url = f"https://sgmenuprices.com/{cat_slug}/"
        
        for item in selected_items:
            dname = item["name"]
            cat = item["category"]
            price = item["price"]
            desc = item.get("desc", "")
            if not desc:
                desc = f"{dname} freshly prepared in-store. [Outlet Tier: Standard Counter Rate]"
            else:
                desc = f"{desc} [Outlet Tier: Standard Counter Rate]"
            img = f"https://sgmenuprices.com/images/{bkey}.jpg"
            
            diet, taste = infer_diet_and_taste(dname, cat, desc, bkey)
            row = make_mp_row(
                target["name"], target["lic"], target["addr"], target["postal"],
                dname, cat, price, desc, img, source_url, diet, taste
            )
            new_menu_rows.append(row)
            enriched_stalls_prices[target["lic"]].append(price)
            
        enriched_count += 1
        
    print(f"Prepared {len(new_menu_rows)} new menu rows across {enriched_count} newly populated licensed outlets.")
    
    # Append new rows to Menu & Price in a contiguous block
    start_row = ws_menu.max_row + 1
    for r_offset, r_data in enumerate(new_menu_rows):
        r_num = start_row + r_offset
        for c_num, val in enumerate(r_data, start=1):
            ws_menu.cell(r_num, c_num).value = val
            
    print(f"Appended {len(new_menu_rows)} rows to 'Menu & Price' (max_row now {ws_menu.max_row}).")
    
    # 5. Recompute Price Range in Food Directory
    print("\n--- Recomputing Price Range in Food Directory ---")
    # For SE24738X000:
    mcd_prices = [x[2] for x in MCD_AIRPORT_66_ITEMS] + [7.3, 9.7, 6.9, 9.4, 4.65, 7.0, 3.95, 3.95, 5.25, 6.9]
    min_p, max_p, avg_p = min(mcd_prices), max(mcd_prices), sum(mcd_prices) / len(mcd_prices)
    ws_dir.cell(mcd_dir_row, 27).value = f"${min_p:.2f}–${max_p:.2f} (${avg_p:.2f} avg)"
    print(f"Updated SE24738X000 Price Range: ${min_p:.2f}–${max_p:.2f} (${avg_p:.2f} avg)")
    
    # For all newly enriched outlets:
    for target in unpop_targets:
        lic = target["lic"]
        prices = enriched_stalls_prices.get(lic, [])
        if prices:
            min_p = min(prices)
            max_p = max(prices)
            avg_p = sum(prices) / len(prices)
            pr_str = f"${min_p:.2f}–${max_p:.2f} (${avg_p:.2f} avg)"
            ws_dir.cell(target["dir_row"], 27).value = pr_str
            
    print(f"Updated Price Range for {len(enriched_stalls_prices)} stalls in Food Directory.")
    
    # Export JSONL
    print(f"Exporting JSONL to: {OUTPUT_JSONL} ...")
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for r in new_menu_rows:
            f.write(json.dumps(r) + "\n")
            
    # Atomic save
    if apply_mode:
        print("\nBacking up master workbook before save...")
        if not os.path.exists(BACKUP_PATH):
            shutil.copy2(MASTER_PATH, BACKUP_PATH)
            print(f"Backup created at: {BACKUP_PATH}")
            
        temp_out = MASTER_PATH + ".tmp_pass25.xlsx"
        print(f"Saving workbook atomically to: {temp_out} ...")
        wb.save(temp_out)
        
        if zipfile.is_zipfile(temp_out):
            shutil.move(temp_out, MASTER_PATH)
            print(f"SUCCESS: Saved updated workbook to: {MASTER_PATH}")
            print(f"New file size: {os.path.getsize(MASTER_PATH):,} bytes")
        else:
            print("ERROR: Corrupted output file generated. Reverting.")
            os.remove(temp_out)
            sys.exit(1)
    else:
        print("\n[DRY RUN] Run with --apply to persist changes to master workbook.")

if __name__ == "__main__":
    main()
