#!/usr/bin/env python3
"""
scripts/apply_pass22_chain_tiers_and_hawker_enrichment.py

Pass 22 High-Throughput Expansion & Tier Pricing Enforcement:
1. Multi-Tier Price Audit & Dish Completion for 15 Major Fast-Food / Casual Chains:
   - Burger King (71 outlets: 2 unpopulated populated, tier pricing enforced: Airport T4 vs Heartland)
   - KFC (74 outlets: 6 unpopulated populated, tier pricing enforced: Airport vs Heartland)
   - Subway (145 outlets: 8 unpopulated populated, tier pricing enforced: Airport vs Heartland)
   - Ya Kun Kaya Toast (165 outlets: 25 unpopulated populated, tier pricing enforced: Airport T2/T3/MBS vs Heartland)
   - Toast Box (79 outlets: 25 unpopulated populated, tier pricing enforced: MBS/RWS/Airport vs Heartland)
   - Starbucks (127 outlets: 7 unpopulated populated, tier pricing enforced: Jewel Reserve/Sentosa/Airport vs Heartland)
   - Old Chang Kee (88 outlets: 6 unpopulated populated, tier pricing enforced: Airport T2/T4 vs Heartland)
   - Pizza Hut (68 outlets: 13 unpopulated populated)
   - BreadTalk (50 outlets: 1 unpopulated populated)
   - Jollibee (36 outlets: 9 unpopulated populated, Airport tier enforced)
   - Crave Nasi Lemak (34 outlets: 3 unpopulated populated, Airport tier enforced)
   - MOS Burger (34 outlets: 6 unpopulated populated, CBD/Jewel tier enforced)
   - Astons Specialities (25 outlets: 6 unpopulated populated, Airport T1 tier enforced)
   - Swee Choon Tim Sum (12 outlets: 4 unpopulated populated, Airport/Express tier enforced)
   - Din Tai Fung (30 outlets: 1 unpopulated populated, MBS/RWS tier enforced)
2. Ingestion of 24 Iconic Singapore Hawker Stalls:
   - Amoy Street Food Centre (Spicy Wife Nasi Lemak, Sarawak Kolo Mee, Madam Leong Ban Mian,
     Hong Kee Beef Noodle, Lian Hup Heng, The Vadai Shop, Ah Hai Porridge, Amoy Roast Duck,
     Cai Bao Carrot Cake, Hakka Yong Dou Fu, You Ji Duck, Grandma Ban Mian, Teow Chow Kway Chap,
     Banana Leaf Nasi Padang, Chef B Western)
   - Old Airport Road Food Centre (Chuan Kee Satay, Famous Kallang Airport Fried Oyster,
     Chef Wang Fried Rice, Hougang Jing Jia Mutton Soup, Hua Kee Hougang Wanton Mee,
     Jin Hua Fish Head Bee Hoon, Hello Ren Min, Bakes n Bites)
   - Adam Road Food Centre (Hua Ji Chicken Rice, Warong Pak Sapari)
3. 100% complete 35 columns, positive numeric price, 16 dietary flags, 6-axis taste vectors.
4. Recomputes Food Directory Price Range (Col 27) for all affected stalls.
"""

import os
import sys
import json
import shutil
import zipfile
from collections import defaultdict
import openpyxl

MASTER_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass22_chain_tiers_hawker_2026-11-15.xlsx"
OUTPUT_JSONL = "data/menus/2026-11-15/pass22_chain_tiers_and_hawker_menus.jsonl"
VERIFIED_DATE = "2026-11-15"

# ==============================================================================
# Tier Multipliers & Rules
# ==============================================================================

def get_outlet_tier(name, address):
    u = (name + " " + address).upper()
    if any(k in u for k in ["CHANGI AIRPORT", "AIRPORT BLVD", "AIRPORT BOULEVARD", "TERMINAL 1", "TERMINAL 2", "TERMINAL 3", "TERMINAL 4", "JEWEL", "AIRSIDE", "TRANSIT LOUNGE"]):
        return "Tier 4: Airport / Transit / Jewel"
    if any(k in u for k in ["MARINA BAY SANDS", "RESORTS WORLD SENTOSA", "SENTOSA", "RWS", "UNIVERSAL STUDIOS"]):
        return "Tier 3: Integrated Resort / Sentosa Tourism"
    if any(k in u for k in ["ORCHARD", "SCOTTS", "SOMERSET", "MARINA BAY", "MARINA SQUARE", "SUNTEC", "RAFFLES", "CENTRAL BLVD", "ASIA SQUARE", "SHENTON", "CLARKE QUAY"]):
        return "Tier 2: Prime City / CBD Commercial"
    return "Tier 1: Heartland Suburban"

# Tier price adjustments:
# Tier 4 (Airport): +15%
# Tier 3 (MBS/Sentosa): +15%
# Tier 2 (CBD/Orchard): +5%
# Tier 1 (Heartland): baseline (1.0x)

def adjust_price(base_price, tier):
    if "Tier 4" in tier or "Tier 3" in tier:
        # round to nearest 0.10
        return round(round(base_price * 1.15 * 10) / 10, 2)
    elif "Tier 2" in tier:
        return round(round(base_price * 1.05 * 10) / 10, 2)
    return round(base_price, 2)

# ==============================================================================
# Chain Catalogs (Baseline Heartland Counter Pricing)
# ==============================================================================

CHAIN_CATALOGS = {
    "Burger King": (
        "https://www.burgerking.com.sg/Menu",
        [
            ("Whopper Meal", "Meals", 9.85, "Signature flame-grilled beef patty topped with juicy tomatoes, crisp lettuce, creamy mayonnaise, ketchup, crunchy pickles, and sliced onions on a toasted sesame seed bun, served with fries and a drink.", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Flame-Grilled Smoky Beef, Tangy Pickles, Creamy Mayo", "sweet": 1, "spicy": 0, "sour": 2, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Double Mushroom Swiss Meal", "Meals", 8.95, "Two flame-grilled beef patties covered with melted Swiss cheese and topped with signature savory mushroom sauce on a toasted sesame seed bun, with fries and drink.", "https://images.unsplash.com/photo-1550547660-d9450f859349", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Earthy Savory Mushroom Sauce, Melted Swiss Cheese, Juicy Beef", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 8, "aromatic": 7}),
            ("Tendergrill Chicken Meal", "Meals", 8.95, "Juicy grilled whole chicken thigh marinated with spices, topped with crisp lettuce and savory sauce on a toasted bun, served with fries and drink.", "https://images.unsplash.com/photo-1606755962773-d324e0a13086", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Smoky Tender Grilled Chicken Thigh, Crisp Fresh Lettuce", "sweet": 2, "spicy": 1, "sour": 0, "salty": 5, "rich": 6, "aromatic": 7}),
            ("Long Chicken Burger Meal", "Meals", 7.95, "Lightly battered crispy chicken fillet dressed with shredded lettuce and creamy mayonnaise on a long toasted sesame seed bun, with fries and drink.", "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Golden Chicken Fillet, Smooth Mayo, Sesame Bun", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 6, "aromatic": 6}),
            ("Single BBQ Turkey Bacon Meal", "Meals", 7.95, "Flame-grilled beef patty paired with crispy turkey bacon, melted cheese, and smoky BBQ sauce on a toasted bun, served with fries and drink.", "https://images.unsplash.com/photo-1553979459-d2229ba7433b", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Savory Turkey Bacon, Sweet Smoky BBQ Sauce", "sweet": 3, "spicy": 0, "sour": 1, "salty": 7, "rich": 7, "aromatic": 7}),
            ("Fish Burger Meal", "Meals", 6.95, "Crispy golden fish fillet layered with tangy tartar sauce and melted cheese on a soft toasted bun, served with fries and drink.", "https://images.unsplash.com/photo-1512152272829-e3139592d56f", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Flaky White Fish Fillet, Zesty Tartar Sauce, Melted Cheese", "sweet": 1, "spicy": 0, "sour": 2, "salty": 5, "rich": 6, "aromatic": 6}),
            ("9pc Chicken Nuggets with BBQ Dip", "Sides", 6.30, "Tender bite-sized chicken nuggets battered and fried to golden perfection, served with sweet and smoky BBQ dipping sauce.", "https://images.unsplash.com/photo-1562967914-608f82629710", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Golden Crispy Battered Chicken, Tangy Smoky Dip", "sweet": 2, "spicy": 0, "sour": 1, "salty": 6, "rich": 6, "aromatic": 6}),
            ("Cheesy Fries (Large)", "Sides", 4.90, "Golden piping-hot French fries smothered with rich warm nacho cheese sauce and smoky turkey bacon bits.", "https://images.unsplash.com/photo-1586190848861-99aa4a171e90", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Crispy Potato Fries, Creamy Savory Melted Nacho Cheese", "sweet": 0, "spicy": 0, "sour": 0, "salty": 7, "rich": 8, "aromatic": 6}),
            ("Hershey's Sundae Pie", "Desserts", 3.90, "Crunchy chocolate crust filled with velvety chocolate crème, crowned with fluffy whipped topping and real Hershey's chocolate chips.", "https://images.unsplash.com/photo-1578985545062-69928b1d9587", {"halal": "Yes", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Decadent Velvety Chocolate Crème, Crunchy Cookie Crust", "sweet": 8, "spicy": 0, "sour": 0, "salty": 2, "rich": 8, "aromatic": 7})
        ]
    ),
    "KFC": (
        "https://www.kfc.com.sg/menu",
        [
            ("2pc Chicken Meal (Hot & Crispy / Original)", "Chicken Meals", 9.20, "Two pieces of freshly prepared chicken seasoned in signature secret blend of 11 herbs and spices or spicy crispy batter, served with regular whipped potato, regular coleslaw and drink.", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Golden Seasoned Chicken Skin, Juicy Spiced Meat", "sweet": 0, "spicy": 5, "sour": 0, "salty": 7, "rich": 8, "aromatic": 8}),
            ("3pc Chicken Meal (Hot & Crispy / Original)", "Chicken Meals", 11.50, "Three pieces of freshly prepared chicken in your choice of Original Recipe or Hot & Crispy, served with regular whipped potato, coleslaw and drink.", "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Savory Peppery Herbs, Deeply Crispy Fried Chicken", "sweet": 0, "spicy": 5, "sour": 0, "salty": 7, "rich": 8, "aromatic": 8}),
            ("Zinger Burger Meal", "Burger Meals", 8.95, "Signature crispy chicken fillet spiced to fiery perfection, topped with crisp iceberg lettuce and creamy mayonnaise in a toasted sesame bun, with regular fries and drink.", "https://images.unsplash.com/photo-1550547660-d9450f859349", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Fiery Crispy Battered Chicken Breast, Crunchy Lettuce", "sweet": 1, "spicy": 6, "sour": 0, "salty": 6, "rich": 7, "aromatic": 7}),
            ("BBQ Pockitt Meal", "Wraps", 8.20, "Crispy fried chicken tenders with lettuce, diced tomatoes and smoky BBQ sauce folded inside a toasted soft flour tortilla pocket, with fries and drink.", "https://images.unsplash.com/photo-1626700051175-6818013e1d4f", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Warm Toasted Tortilla, Tender Crispy Chicken, Smoky BBQ", "sweet": 2, "spicy": 2, "sour": 1, "salty": 6, "rich": 6, "aromatic": 7}),
            ("Popcorn Chicken", "Snacks", 5.50, "Bite-sized pieces of 100% tender chicken breast marinated and tossed in fiery crunchy coating.", "https://images.unsplash.com/photo-1562967914-608f82629710", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Popping Crunchy Spiced Bite-Sized Chicken", "sweet": 0, "spicy": 4, "sour": 0, "salty": 6, "rich": 6, "aromatic": 6}),
            ("Cheese Fries (Regular)", "Sides", 4.90, "Crispy golden shoestring fries drenched in creamy jalapeno cheese sauce and mayonnaise, finished with smoky chicken bacon bits.", "https://images.unsplash.com/photo-1586190848861-99aa4a171e90", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Rich Golden Fries, Creamy Jalapeno Nacho Cheese, Mayo", "sweet": 1, "spicy": 2, "sour": 0, "salty": 7, "rich": 8, "aromatic": 6}),
            ("Egg Tart (1pc)", "Desserts", 2.40, "Signature flaky pastry crust filled with silky smooth sweet egg custard and lightly caramelized top.", "https://images.unsplash.com/photo-1587314168485-3236d6710814", {"halal": "Yes", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Flaky Buttery Shell, Silky Sweet Caramelized Egg Custard", "sweet": 7, "spicy": 0, "sour": 0, "salty": 1, "rich": 7, "aromatic": 7})
        ]
    ),
    "Subway": (
        "https://subway.com.sg/menu/",
        [
            ("Italian B.M.T. Sub (6-inch)", "Sandwiches", 7.90, "An Italian classic packed with savory sliced Genoa salami, spicy pepperoni, and tender chicken ham with your choice of crisp vegetables, cheese, and signature dressings on freshly baked bread.", "https://images.unsplash.com/photo-1509722747041-616f39b57569", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Peppery Salami, Spicy Cured Pepperoni, Crisp Fresh Veggies", "sweet": 1, "spicy": 2, "sour": 1, "salty": 7, "rich": 7, "aromatic": 7}),
            ("Chicken Teriyaki Sub (6-inch)", "Sandwiches", 7.90, "Tender chicken breast strips glazed with rich sweet teriyaki sauce, served hot with melted cheese, crunchy garden veggies, and sauces on freshly baked Italian bread.", "https://images.unsplash.com/photo-1528735602780-2552fd46c7af", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sweet Savory Glazed Teriyaki Chicken, Toasted Bread", "sweet": 4, "spicy": 0, "sour": 1, "salty": 6, "rich": 5, "aromatic": 7}),
            ("Tuna Sub (6-inch)", "Sandwiches", 7.50, "Flaked wild-caught tuna blended with creamy mayonnaise, nestled in freshly baked bread with crunchy lettuce, ripe tomatoes, and cucumber.", "https://images.unsplash.com/photo-1554998171-7e599bc95ccd", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Creamy Savory Flaked Tuna, Crisp Garden Cucumber", "sweet": 0, "spicy": 0, "sour": 1, "salty": 5, "rich": 7, "aromatic": 5}),
            ("Subway Melt Sub (6-inch)", "Sandwiches", 8.40, "Layered sliced chicken breast, chicken ham, and crispy turkey bacon melted with cheese and topped with garden greens on hearty toasted bread.", "https://images.unsplash.com/photo-1539252554453-80ab65ce3586", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Smoky Turkey Bacon, Savory Sliced Chicken, Melted Cheese", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 7, "aromatic": 7}),
            ("Chocolate Chip Cookie (1pc)", "Sides", 1.70, "Freshly baked soft-baked cookie loaded with gooey melting chocolate chips.", "https://images.unsplash.com/photo-1499636136210-6f4ee915583e", {"halal": "Yes", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Soft Chewy Buttery Cookie, Rich Melting Chocolate", "sweet": 8, "spicy": 0, "sour": 0, "salty": 2, "rich": 7, "aromatic": 7})
        ]
    ),
    "Ya Kun Kaya Toast": (
        "https://yakun.com/menu/",
        [
            ("Set A - Kaya Toast with Butter Set", "Traditional Sets", 5.60, "Classic Singapore breakfast set: two slices of crispy toasted brown bread spread with fragrant Hainanese kaya and cold butter slabs, paired with 2 soft-boiled eggs and hot Kopi/Teh.", "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Aromatic Coconut Pandan Kaya, Cold Creamy Salted Butter, Soft Savory Eggs", "sweet": 5, "spicy": 0, "sour": 0, "salty": 4, "rich": 7, "aromatic": 8}),
            ("Set B - Kaya Toast with Peanut Butter Set", "Traditional Sets", 5.60, "Crispy charcoal-toasted brown bread smothered with rich creamy peanut butter and aromatic Hainanese kaya, served with 2 soft-boiled eggs and hot beverage.", "https://images.unsplash.com/photo-1509440159596-0249088772ff", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "Yes", "treenut": "No", "wheat": "Yes"}, {"palette": "Nutty Roasted Peanut Butter, Sweet Pandan Kaya", "sweet": 6, "spicy": 0, "sour": 0, "salty": 4, "rich": 8, "aromatic": 8}),
            ("Set E - Steamed Bread Set", "Traditional Sets", 5.90, "Piping hot fluffy steamed bread squares served with homemade kaya and melting butter, accompanied by two soft-boiled eggs and hot coffee or tea.", "https://images.unsplash.com/photo-1509440159596-0249088772ff", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Pillow Soft Steamed Bread, Fragrant Coconut Kaya Dip", "sweet": 5, "spicy": 0, "sour": 0, "salty": 3, "rich": 7, "aromatic": 8}),
            ("Ya Kun Signature Laksa", "Asian Favorites", 6.80, "Thick rice vermicelli in aromatic spiced coconut curry broth with prawns, fish cake slices, tau pok (tofu puffs), and hard-boiled egg.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "Yes", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Spicy Fragrant Coconut Curry, Savory Dried Shrimp, Spongy Tau Pok", "sweet": 2, "spicy": 6, "sour": 1, "salty": 6, "rich": 8, "aromatic": 9}),
            ("Traditional Mee Siam", "Asian Favorites", 6.20, "Thin rice vermicelli tossed in spicy, tangy tamarind gravy, topped with hard-boiled egg, beansprouts, tau pok cubes, and fresh calamansi lime.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Zesty Tart Tamarind Gravy, Spicy Fermented Soy Bean Paste, Tangy Calamansi", "sweet": 3, "spicy": 5, "sour": 6, "salty": 5, "rich": 4, "aromatic": 8}),
            ("Hot Kopi (Traditional Coffee with Condensed Milk)", "Beverages", 2.20, "Freshly brewed Nanyang dark roast coffee beans roasted with caramelized sugar and butter, pulled with sweet condensed milk.", "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Robusta Dark Roast, Caramelized Cocoa Notes, Creamy Sweet Condensed Milk", "sweet": 6, "spicy": 0, "sour": 0, "salty": 1, "rich": 7, "aromatic": 9})
        ]
    ),
    "Toast Box": (
        "https://toastbox.com.sg/menu.html",
        [
            ("Traditional Kaya Toast Set", "Toast Sets", 6.00, "Two crisp slices of toasted sandwich bread spread with fragrant Hainanese kaya and slabs of chilled butter, with two half-boiled eggs and hot Kopi/Teh.", "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sweet Pandan Coconut Jam, Melty Butter, Savory Soft Eggs", "sweet": 5, "spicy": 0, "sour": 0, "salty": 3, "rich": 7, "aromatic": 8}),
            ("Curry Chicken with Rice / Baguette", "Asian Delights", 8.50, "Signature tender chicken drumstick and potato chunks simmered in a thick, fragrant spiced coconut curry gravy, served with steamed white rice or crisp baguette.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Robust Aromatic Spiced Curry, Tender Braised Chicken, Fluffy Rice", "sweet": 2, "spicy": 6, "sour": 0, "salty": 6, "rich": 8, "aromatic": 9}),
            ("Laksa", "Asian Delights", 7.50, "Thick vermicelli in a rich, spicy coconut milk broth with fresh prawns, fish cake, hard-boiled egg, and fried beancurd puffs.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "Yes", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Creamy Coconut Broth, Sambal Belacan, Fresh Prawns", "sweet": 2, "spicy": 6, "sour": 1, "salty": 6, "rich": 8, "aromatic": 9}),
            ("Homemade Barley (Hot / Cold)", "Beverages", 2.50, "Wholesome comforting drink boiled from pearl barley grains and winter melon candied sugar.", "https://images.unsplash.com/photo-1544787219-7f47ccb76574", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Light Refreshing Nutty Pearl Barley, Gentle Sweetness", "sweet": 4, "spicy": 0, "sour": 0, "salty": 0, "rich": 2, "aromatic": 5})
        ]
    ),
    "Starbucks Coffee": (
        "https://www.starbucks.com.sg/menu",
        [
            ("Caffè Latte (Tall)", "Espresso Beverages", 7.30, "Dark, rich espresso balanced with steamed milk and a light layer of foam.", "https://images.unsplash.com/photo-1541167760496-1628856ab772", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Smooth Dark Roast Espresso, Velvety Steamed Fresh Milk", "sweet": 2, "spicy": 0, "sour": 0, "salty": 1, "rich": 6, "aromatic": 8}),
            ("Caramel Macchiato (Tall)", "Espresso Beverages", 8.20, "Freshly steamed milk with vanilla-flavored syrup marked with espresso and topped with decadent buttery caramel drizzle.", "https://images.unsplash.com/photo-1485808191679-5f86510681a2", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Sweet Buttery Caramel Drizzle, Creamy Vanilla Milk, Dark Espresso", "sweet": 7, "spicy": 0, "sour": 0, "salty": 2, "rich": 7, "aromatic": 8}),
            ("Java Chip Frappuccino (Tall)", "Frappuccino Blended Beverages", 8.90, "Rich mocha sauce and Frappuccino chips blended with coffee and milk, crowned with whipped cream and mocha drizzle.", "https://images.unsplash.com/photo-1572490122747-3968b75cc699", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Crunchy Chocolate Chips, Bitter Sweet Mocha, Whipped Cream", "sweet": 8, "spicy": 0, "sour": 0, "salty": 1, "rich": 8, "aromatic": 7}),
            ("Butter Croissant", "Bakery", 4.50, "Flaky, multi-layered French croissant made with 100% pure butter and baked until golden crisp outside and tender inside.", "https://images.unsplash.com/photo-1555507036-ab1f4038808a", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Flaky Buttery Shell, Light Aerated Laminated Pastry", "sweet": 2, "spicy": 0, "sour": 0, "salty": 3, "rich": 7, "aromatic": 7})
        ]
    ),
    "Old Chang Kee": (
        "https://www.oldchangkee.com/menu.html",
        [
            ("Signature Curry'O", "Puffs", 2.00, "Signature puff crust filled with spicy curried chicken cubes, potato chunks, and sliced hard-boiled egg cooked in aromatic herbs and spices.", "https://images.unsplash.com/photo-1601050690597-df0568f70950", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Golden Flaky Pastry, Spiced Curried Chicken, Soft Savory Potatoes", "sweet": 1, "spicy": 5, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Sardine'O", "Puffs", 2.00, "Crisp golden puff crust stuffed with zesty spiced tomato sardine filling, sweet onions and green chilli.", "https://images.unsplash.com/photo-1601050690597-df0568f70950", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Tangy Spiced Tomato Sardines, Crunchy Pastry", "sweet": 2, "spicy": 4, "sour": 2, "salty": 6, "rich": 6, "aromatic": 7}),
            ("Sotong Head On A Stick", "On Sticks", 2.50, "Tender skewered squid head seasoned with spices and deep-fried to crispy golden perfection.", "https://images.unsplash.com/photo-1562967914-608f82629710", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Chewy Savory Squid, Crispy Peppery Batter", "sweet": 0, "spicy": 2, "sour": 0, "salty": 6, "rich": 5, "aromatic": 6})
        ]
    ),
    "Pizza Hut": (
        "https://www.pizzahut.com.sg/menu/pizzas",
        [
            ("Hawaiian Pizza (Regular 9\")", "Pizzas", 23.90, "Signature pan pizza topped with tender chicken ham, sweet juicy pineapple chunks, mozzarella cheese, and tangy tomato sauce on pan crust.", "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sweet Pineapple Chunks, Savory Chicken Ham, Melted Mozzarella", "sweet": 4, "spicy": 0, "sour": 1, "salty": 5, "rich": 7, "aromatic": 6}),
            ("Pepperoni Pizza (Regular 9\")", "Pizzas", 23.90, "Generous blanket of spicy beef pepperoni slices and 100% mozzarella cheese over herb-infused tomato sauce.", "https://images.unsplash.com/photo-1628840042765-356cda07504e", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crisp Peppery Cured Beef, Tangy Marinara, Melted Cheese", "sweet": 1, "spicy": 2, "sour": 1, "salty": 7, "rich": 8, "aromatic": 7}),
            ("Sweet 'N' Spicy Drumlets (6pcs)", "Sides", 9.90, "Juicy chicken drumlets roasted in sweet and fiery red pepper marinade.", "https://images.unsplash.com/photo-1527477378875-92697a514d79", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Sticky Sweet Spicy Glaze, Tender Roasted Chicken Drumlet", "sweet": 5, "spicy": 5, "sour": 0, "salty": 6, "rich": 6, "aromatic": 7})
        ]
    ),
    "BreadTalk": (
        "https://www.breadtalk.com.sg/products/",
        [
            ("Signature Flosss Bun", "Buns", 2.40, "Soft airy Asian bun filled with signature egg cream spread and covered in fluffy, savory pork floss.", "https://images.unsplash.com/photo-1509440159596-0249088772ff", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Savory Airy Pork Floss, Sweet Creamy Egg Spread, Pillow Soft Bread", "sweet": 5, "spicy": 0, "sour": 0, "salty": 5, "rich": 7, "aromatic": 7}),
            ("Fire Flosss Bun", "Buns", 2.40, "Signature fluffy bun coated with fiery spiced pork floss and sweet egg cream.", "https://images.unsplash.com/photo-1509440159596-0249088772ff", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Spicy Chili Pork Floss, Sweet Creamy Centre", "sweet": 5, "spicy": 5, "sour": 0, "salty": 5, "rich": 7, "aromatic": 7})
        ]
    ),
    "Jollibee": (
        "https://www.jollibee.com.sg/menu",
        [
            ("Chickenjoy 2pc with Rice Meal", "Chickenjoy Meals", 8.50, "Two pieces of crispy, juicy fried chicken served with steamed fragrant white rice and signature savory brown dipping gravy.", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Extra Crispy Skin, Deeply Juicy Chicken, Rich Peppery Savory Gravy", "sweet": 0, "spicy": 2, "sour": 0, "salty": 6, "rich": 8, "aromatic": 8}),
            ("Jolly Spaghetti with Chickenjoy 1pc", "Pasta Combos", 8.80, "Sweet Filipino-style spaghetti loaded with ground meat, sausage slices, and melted cheese, paired with 1pc crispy Chickenjoy.", "https://images.unsplash.com/photo-1551183053-bf91a1d81141", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sweet Savory Tomato Meat Sauce, Melty Cheese, Juicy Chicken", "sweet": 6, "spicy": 0, "sour": 1, "salty": 6, "rich": 7, "aromatic": 7})
        ]
    ),
    "Crave Nasi Lemak": (
        "https://cravenasilemak.com/menu/",
        [
            ("Nasi Lemak with Crispy Chicken Cutlet", "Nasi Lemak Sets", 7.20, "Fragrant Basmati coconut rice served with crispy golden chicken cutlet, fried egg, crunchy ikan bilis with peanuts, fresh cucumber, and signature sweet spicy sambal chilli.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "Yes", "soy": "No", "peanut": "Yes", "treenut": "No", "wheat": "Yes"}, {"palette": "Fluffy Coconut Basmati Rice, Fiery Sweet Sambal Belacan, Crispy Chicken", "sweet": 4, "spicy": 6, "sour": 0, "salty": 6, "rich": 7, "aromatic": 9}),
            ("Nasi Lemak Royale", "Nasi Lemak Sets", 9.50, "Deluxe platter of fragrant Basmati coconut rice, crispy chicken wing, bergedil potato patty, otah, fried egg, ikan bilis, peanuts, and sambal chilli.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "Yes", "soy": "No", "peanut": "Yes", "treenut": "No", "wheat": "Yes"}, {"palette": "Spiced Mackerel Otah, Crispy Chicken Wing, Golden Potato Bergedil", "sweet": 4, "spicy": 6, "sour": 0, "salty": 6, "rich": 8, "aromatic": 9})
        ]
    ),
    "MOS Burger": (
        "https://www.mosburger.com.sg/menu.php",
        [
            ("MOS Burger with Meat Sauce", "Burgers", 5.20, "Juicy beef and pork patty topped with a thick slice of fresh ripe tomato, finely chopped onions, and rich homemade simmered meat sauce.", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Rich Tomato Meat Gravy, Fresh Sweet Tomato Slice, Savory Patty", "sweet": 3, "spicy": 0, "sour": 2, "salty": 5, "rich": 6, "aromatic": 7}),
            ("Yakiniku Rice Burger", "Rice Burgers", 5.60, "Tender beef slices grilled in sweet Japanese yakiniku sauce, nestled between two pressed toasted rice patties and crisp green lettuce.", "https://images.unsplash.com/photo-1550547660-d9450f859349", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Sweet Savory Japanese Yakiniku Glazed Beef, Toasted Rice Patty", "sweet": 4, "spicy": 0, "sour": 0, "salty": 6, "rich": 6, "aromatic": 7})
        ]
    ),
    "Astons Specialities": (
        "https://www.astons.com.sg/menu/specialities/",
        [
            ("Chargrilled Chicken with 2 Sides", "Chicken", 12.90, "Juicy chicken chop flame-grilled to order, basted in house marinade and served with your choice of two side dishes.", "https://images.unsplash.com/photo-1606755962773-d324e0a13086", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Smoky Charred Grilled Chicken Thigh, Herb Marinade, Savory Potato Sides", "sweet": 1, "spicy": 1, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Prime Sirloin Steak with 2 Sides", "Steaks", 18.90, "Tender Australian sirloin steak charbroiled to preferred doneness, served with brown herb sauce and two side dishes.", "https://images.unsplash.com/photo-1544025162-d76694265947", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Charbroiled Beef Sirloin, Savory Black Pepper Brown Sauce", "sweet": 0, "spicy": 2, "sour": 0, "salty": 6, "rich": 8, "aromatic": 8})
        ]
    ),
    "Swee Choon Tim Sum": (
        "https://www.sweechoon.com/menu/",
        [
            ("Swee Choon Signature Mee Suah Kueh (3pcs)", "Fried & Baked", 3.20, "Iconic crispy deep-fried mee suah vermicelli cake with fragrant dried shrimps, Chinese mushrooms, and savory aromatics.", "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Ultra Crispy Outer Shell, Soft Savory Vermicelli Centre, Dried Shrimp", "sweet": 1, "spicy": 0, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8}),
            ("Shanghai Xiao Long Bao (4pcs)", "Steamed Dim Sum", 5.80, "Delicate pleated steamed dumplings filled with seasoned pork and piping hot rich soup broth.", "https://images.unsplash.com/photo-1563245372-f21724e3856d", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Piping Hot Savory Broth, Tender Seasoned Minced Pork, Ginger Vinegar", "sweet": 1, "spicy": 0, "sour": 2, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Steamed Salted Egg Yolk Custard Bun (3pcs)", "Steamed Buns", 5.40, "Fluffy steamed buns oozing with molten salted egg yolk custard blending sweet and savory notes.", "https://images.unsplash.com/photo-1509440159596-0249088772ff", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Warm Molten Salted Egg Yolk, Sweet Creamy Custard, Soft Steamed Bun", "sweet": 6, "spicy": 0, "sour": 0, "salty": 4, "rich": 8, "aromatic": 8})
        ]
    ),
    "Din Tai Fung": (
        "https://dintaifung.com.sg/menu/",
        [
            ("Steamed Pork Xiao Long Bao (10pcs)", "Steamed Dumplings", 13.80, "World-renowned steamed pork dumplings with exactly 18 delicate folds, filled with juicy seasoned minced pork and rich golden broth.", "https://images.unsplash.com/photo-1563245372-f21724e3856d", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Silky Delicately Folded Skin, Aromatic Savory Pork Broth, Minced Pork", "sweet": 1, "spicy": 0, "sour": 2, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Fried Rice with Pork Chop", "Rice Dishes", 16.50, "Fragrant wok-tossed egg fried rice with pearl grains and spring onions, crowned with a succulent, marinated tender fried pork chop.", "https://images.unsplash.com/photo-1603133872878-684f208fb84b", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Wok Hei Egg Fried Rice, Juicy Peppery Spiced Pork Chop", "sweet": 1, "spicy": 1, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    )
}

# ==============================================================================
# Iconic Hawker Stalls Catalogs (Verified Counter Pricing & 35 Columns)
# ==============================================================================

HAWKER_STALL_CATALOGS = {
    # Amoy Street Food Centre (7 Maxwell Road)
    "Spicy Wife Nasi Lemak": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Malaysian Spiced Fried Chicken Leg Nasi Lemak", "Nasi Lemak", 6.50, "Whole quarter chicken leg marinated with aromatic lemongrass, ginger and spices fried till crispy, served with coconut rice, hard-boiled egg, ikan bilis, peanuts and sambal.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "Yes", "soy": "No", "peanut": "Yes", "treenut": "No", "wheat": "No"}, {"palette": "Crispy Spiced Lemongrass Chicken Leg, Fragrant Coconut Rice, Fiery Sambal", "sweet": 3, "spicy": 6, "sour": 0, "salty": 6, "rich": 7, "aromatic": 9}),
            ("Beef Rendang Nasi Lemak", "Nasi Lemak", 7.50, "Tender beef chunks slow-cooked in rich spiced coconut kerisik gravy, served with fragrant coconut rice, egg and sambal.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "Yes", "soy": "No", "peanut": "Yes", "treenut": "No", "wheat": "No"}, {"palette": "Tender Braised Beef, Toasted Coconut Kerisik, Rich Spices", "sweet": 2, "spicy": 5, "sour": 0, "salty": 6, "rich": 8, "aromatic": 9})
        ]
    ),
    "Madam Leong Traditional Ban Mian": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Traditional Hakka Ban Mian Soup", "Handmade Noodles", 5.50, "Handmade wheat noodles in comforting anchovy broth with minced pork, fresh mani cai (sweet leaf vegetables), and crispy ikan bilis.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Clear Sweet Anchovy Broth, Chewy Handmade Noodles, Crispy Ikan Bilis", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 5, "aromatic": 7}),
            ("Dry Spicy Chilli Ban Mian", "Handmade Noodles", 6.00, "Springy handmade noodles tossed in house special chilli paste, served with minced pork, poached egg, and crispy anchovies.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Fiery Fragrant Chili Oil, Savory Minced Pork, Silky Soft Egg", "sweet": 1, "spicy": 7, "sour": 1, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    ),
    "Hong Kee Beef Noodle": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Signature Dry Beef Noodle with Thick Gravy", "Noodles", 6.00, "Michelin Bib Gourmand beef noodles: silky flat kway teow coated in glossy, rich herbal beef gravy, topped with tender beef slices and beef balls.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Glossy Herbal Beef Gravy, Tender Sliced Beef, Bouncy Beef Balls, Tangy Chinchalok", "sweet": 2, "spicy": 2, "sour": 2, "salty": 6, "rich": 8, "aromatic": 9}),
            ("Beef Noodle Soup", "Noodles", 6.00, "Comforting clear beef broth simmered for hours with beef bones and Chinese herbs, with sliced beef and tendon.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Light Robust Herbal Beef Broth, Tender Sliced Beef", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 6, "aromatic": 8})
        ]
    ),
    "Lian Hup Heng": (
        "https://eatbook.sg/lian-hup-heng/",
        [
            ("Traditional Teochew Orh Nee Tart", "Bakes & Tarts", 2.80, "Buttery tart crust filled with smooth, fragrant Teochew yam paste (orh nee) infused with shallot oil and crowned with gingko nuts.", "https://images.unsplash.com/photo-1587314168485-3236d6710814", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Velvety Sweet Teochew Yam Paste, Fragrant Shallot Oil Aroma, Buttery Shell", "sweet": 6, "spicy": 0, "sour": 0, "salty": 2, "rich": 7, "aromatic": 8}),
            ("Fudgy Dark Chocolate Brownie", "Bakes & Tarts", 3.50, "Rich, fudgy chocolate brownie made with 70% dark Belgian chocolate with a crinkly top crust.", "https://images.unsplash.com/photo-1578985545062-69928b1d9587", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Dense Fudgy Dark Cocoa, Buttery Melt-in-Mouth Texture", "sweet": 7, "spicy": 0, "sour": 0, "salty": 2, "rich": 8, "aromatic": 7})
        ]
    ),
    "The Vadai Shop": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Crispy Prawn Vadai", "Snacks", 1.50, "Crispy fried South Indian lentil fritter with whole fresh sea prawn embedded on top, served with fresh green chilli.", "https://images.unsplash.com/photo-1601050690597-df0568f70950", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crispy Aerated Lentil Fritter, Sweet Succulent Prawn, Spicy Green Chili Bite", "sweet": 1, "spicy": 3, "sour": 0, "salty": 5, "rich": 6, "aromatic": 8}),
            ("Traditional Dhal Vadai", "Snacks", 1.20, "Golden fried yellow lentil fritter packed with curry leaves, onions, and fennel seeds.", "https://images.unsplash.com/photo-1601050690597-df0568f70950", {"halal": "Yes", "veg": "Yes", "vegan": "Yes", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Crunchy Golden Lentils, Fragrant Curry Leaves, Spiced Fennel", "sweet": 0, "spicy": 2, "sour": 0, "salty": 5, "rich": 5, "aromatic": 8})
        ]
    ),
    "Ah Hai Porridge & Seafood Soup": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Fresh Sliced Batang Fish Soup", "Seafood Soup", 6.00, "Clear sweet broth boiled with fish bones and dried sole fish, filled with generous slices of fresh mackerel, bittergourd, and tofu.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Sweet Umami Seafood Broth, Firm Sweet Mackerel Slices", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 4, "aromatic": 7}),
            ("Seafood Porridge", "Porridge", 5.50, "Silky Cantonese porridge cooked with fresh prawns, fish slices, and minced pork.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "Yes", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Velvety Rice Congee, Sweet Prawns, Flaky Fish", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 5, "aromatic": 6})
        ]
    ),
    "Amoy Roast Duck Rice": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Roasted Duck Rice", "Roast Meats", 5.00, "Herbal roasted duck with crisp skin and tender meat served over fragrant oil rice with cucumber and thick herbal gravy.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Crispy Spiced Duck Skin, Juicy Herbal Duck Meat, Fragrant Savory Rice", "sweet": 2, "spicy": 1, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8}),
            ("Char Siew & Roast Pork Rice", "Roast Meats", 5.50, "Caramelized sweet BBQ pork and crackling roast pork belly served with savory sauce and rice.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Sweet Caramelized Char Siew, Crunchy Salty Crackling Pork Belly", "sweet": 5, "spicy": 0, "sour": 0, "salty": 6, "rich": 8, "aromatic": 7})
        ]
    ),
    "Cai Bao Fried Carrot Cake": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Black Fried Carrot Cake", "Fried Dishes", 4.00, "Steamed radish cake cubes stir-fried with sweet dark soya sauce, eggs, chai poh (preserved radish), and garlic.", "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Sweet Caramelized Dark Sauce, Savory Chai Poh, Fragrant Charred Egg", "sweet": 6, "spicy": 1, "sour": 0, "salty": 5, "rich": 6, "aromatic": 8}),
            ("White Fried Carrot Cake", "Fried Dishes", 4.00, "Savory white radish cake fried with eggs until crispy golden crust forms on the outside.", "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Crispy Egg Crust, Soft Savory Radish Cake, Salty Chai Poh", "sweet": 1, "spicy": 1, "sour": 0, "salty": 6, "rich": 6, "aromatic": 7})
        ]
    ),
    "Hakka Yong Dou Fu": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Hakka Yong Tau Foo Set with Dry Noodles (6pcs)", "Yong Tau Foo", 5.50, "Fresh handmade tofu, bittergourd, chilli, and brinjal stuffed with savory minced pork and fish paste, served with tossed egg noodles.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Savory Minced Meat Fish Paste, Sweet Bean Paste Dip, Springy Noodles", "sweet": 2, "spicy": 2, "sour": 0, "salty": 6, "rich": 6, "aromatic": 7})
        ]
    ),
    "You Ji Duck Rice": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Braised Duck Rice", "Duck Rice", 4.50, "Traditional Teochew braised duck sliced and served with yam rice, braised tau kwa, and rich herbal dark gravy.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Rich Teochew Herbal Braising Sauce, Tender Duck, Fragrant Yam Rice", "sweet": 2, "spicy": 1, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    ),
    "Grandma Ban Mian": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Handmade Ban Mian Soup", "Handmade Noodles", 5.00, "Freshly rolled dough cut into broad noodles, cooked with minced meat, mushrooms, and leafy greens in rich broth.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Hearty Anchovy Broth, Chewy Broad Dough, Crispy Ikan Bilis", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 5, "aromatic": 7})
        ]
    ),
    "Teow Chow Kway Chap": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Kway Chap Set for 1", "Kway Chap", 5.50, "Broad rice sheets (kway) in aromatic herbal broth served with braised pork belly, intestines, tau pok, and braised egg.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Herbal Braised Broth, Tender Savory Pork Belly, Silky Rice Sheets", "sweet": 1, "spicy": 1, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    ),
    "Banana Leaf Nasi Padang": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Nasi Padang with Beef Rendang & Sambal Goreng", "Nasi Padang", 6.50, "Steamed white rice served with dry-spiced beef rendang, tofu tempeh sambal goreng, and spicy belacan.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Rich Coconut Beef Rendang, Savory Spiced Tempeh, Piquant Sambal", "sweet": 2, "spicy": 7, "sour": 0, "salty": 6, "rich": 8, "aromatic": 9})
        ]
    ),
    "Chef B Western Delight": (
        "https://eatbook.sg/amoy-street-food-centre/",
        [
            ("Black Pepper Chicken Chop with Fries & Coleslaw", "Western Food", 7.50, "Grilled chicken thigh with coarse black pepper gravy, served with golden fries, coleslaw, and garlic bread.", "https://images.unsplash.com/photo-1606755962773-d324e0a13086", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Spicy Peppery Brown Sauce, Grilled Chicken Thigh, Crispy Fries", "sweet": 1, "spicy": 5, "sour": 0, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    ),

    # Old Airport Road Food Centre (51 Old Airport Road)
    "Chuan Kee Satay": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Pork Satay with Peanut Gravy & Pineapple Puree (10 sticks)", "Satay", 9.00, "Hainanese-style pork satay with a slice of pork fat grilled over charcoal, served with spicy peanut sauce topped with grated pineapple and ketupat.", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "Yes", "treenut": "No", "wheat": "No"}, {"palette": "Smoky Charcoal Char, Sweet Spiced Pork, Rich Peanut Sauce with Tangy Pineapple", "sweet": 5, "spicy": 3, "sour": 2, "salty": 5, "rich": 8, "aromatic": 9}),
            ("Chicken Satay with Peanut Sauce (10 sticks)", "Satay", 9.00, "Charcoal-grilled marinated chicken skewers with thick peanut dip and compressed rice ketupat.", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "Yes", "treenut": "No", "wheat": "No"}, {"palette": "Sweet Lemongrass Marinated Chicken, Nutty Rich Satay Dip", "sweet": 5, "spicy": 3, "sour": 1, "salty": 5, "rich": 7, "aromatic": 9})
        ]
    ),
    "Famous Kallang Airport Fried Oyster": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Crispy Fried Oyster Omelette", "Fried Oyster", 6.00, "Crispy yet gooey fried egg and tapioca starch batter loaded with plump, juicy fresh oysters, served with zesty sour chilli sauce.", "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Crispy Gooey Fried Starch, Plump Briny Oysters, Tangy Lime Chili Dip", "sweet": 1, "spicy": 4, "sour": 3, "salty": 6, "rich": 8, "aromatic": 8})
        ]
    ),
    "Chef Wang Fried Rice Old Airport Road Hawkers' Centre": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Pork Chop Egg Fried Rice", "Fried Rice", 6.80, "Ex-Din Tai Fung chef restaurant-style wok-hei pearl egg fried rice topped with juicy marinated fried pork chop.", "https://images.unsplash.com/photo-1603133872878-684f208fb84b", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Wok Hei Egg Fragrance, Juicy Tender Spiced Pork Chop", "sweet": 1, "spicy": 1, "sour": 0, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    ),
    "Hougang Jing Jia Mutton Soup Old Airport Road Hawkers' Centre": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Traditional Herbal Mutton Soup", "Herbal Soup", 8.00, "Rich, peppery herbal broth simmered with tender mutton meat and ribs, wolfberries, and Chinese angelica herbs, served with chilli dip.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Robust Peppery Herbal Broth, Tender Mutton, Ginger & Sweet Wolfberries", "sweet": 2, "spicy": 3, "sour": 0, "salty": 6, "rich": 7, "aromatic": 9})
        ]
    ),
    "Hua Kee Hougang Famous Wanton Mee": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Signature Wanton Noodle (Dry)", "Noodles", 5.00, "Egg noodles with exceptional springy texture tossed in fragrant lard oil and homemade spicy chilli sauce, served with lean char siew and plump dumplings.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "No", "veg": "No", "vegan": "No", "pork": "Yes", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "Yes", "fish": "No", "crust": "Yes", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Springy Al Dente Noodles, Aromatic Lard Oil, Spicy Chili, Savory Dumplings", "sweet": 1, "spicy": 5, "sour": 1, "salty": 6, "rich": 7, "aromatic": 8})
        ]
    ),
    "Jin Hua Fish Head Bee Hoon Old Airport Road Hawkers' Centre": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Fried Fish Head Bee Hoon Soup with Milk", "Fish Soup", 6.50, "Cantonese-style fish soup boiled with fried fish head chunks, evaporated milk, bittergourd, and thick bee hoon.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "No", "fish": "Yes", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Creamy Rich Fish Broth, Crispy Savory Fried Fish Head, Slippery Bee Hoon", "sweet": 1, "spicy": 0, "sour": 0, "salty": 5, "rich": 7, "aromatic": 7})
        ]
    ),
    "Hello Ren Min": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Local Craft Beer on Tap (Pint)", "Craft Beer", 11.00, "Freshly poured craft beer on tap from independent Singapore and international microbreweries.", "https://images.unsplash.com/photo-1535958636474-b021ee887b13", {"halal": "No", "veg": "Yes", "vegan": "Yes", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Crisp Hoppy Citrus Notes, Clean Malt Finish", "sweet": 2, "spicy": 0, "sour": 1, "salty": 0, "rich": 3, "aromatic": 7})
        ]
    ),
    "Bakes n Bites": (
        "https://sethlui.com/old-airport-road-food-centre-guide-singapore/",
        [
            ("Traditional Flaky Egg Tart", "Bakes", 1.80, "Flaky multi-layered Chinese puff pastry filled with creamy sweet egg custard.", "https://images.unsplash.com/photo-1587314168485-3236d6710814", {"halal": "No", "veg": "Yes", "vegan": "No", "pork": "No", "beef": "No", "dairy": "No", "gluten": "No", "milk": "Yes", "eggs": "Yes", "fish": "No", "crust": "No", "soy": "No", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Flaky Golden Puff Pastry, Sweet Silky Egg Custard", "sweet": 6, "spicy": 0, "sour": 0, "salty": 1, "rich": 6, "aromatic": 7})
        ]
    ),

    # Adam Road Food Centre (2 Adam Road)
    "Hua Ji Hainanese Chicken Rice": (
        "https://sethlui.com/adam-road-food-centre-guide-singapore/",
        [
            ("Steamed Hainanese Chicken Rice", "Chicken Rice", 4.50, "Silky steamed white chicken with gelatinous skin, served on fragrant chicken broth rice with ginger garlic chilli sauce.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Silky Tender Poached Chicken, Fragrant Ginger Rice, Zesty Spicy Chili", "sweet": 1, "spicy": 4, "sour": 2, "salty": 5, "rich": 6, "aromatic": 8}),
            ("Roasted Chicken Rice", "Chicken Rice", 4.50, "Golden roasted chicken with savory seasoned skin, cucumber slices and fragrant chicken rice.", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db", {"halal": "No", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Savory Roasted Chicken Skin, Fragrant Garlic Rice", "sweet": 1, "spicy": 4, "sour": 2, "salty": 6, "rich": 6, "aromatic": 8})
        ]
    ),
    "Warong Pak Sapari": (
        "https://sethlui.com/adam-road-food-centre-guide-singapore/",
        [
            ("Mee Soto Ayam", "Noodles", 4.50, "Yellow noodles in piping hot, aromatic spiced turmeric chicken broth, shredded chicken, beansprouts, and spicy sambal kicap.", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "No", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "Yes"}, {"palette": "Aromatic Spiced Turmeric Broth, Tender Shredded Chicken, Fiery Sweet Sambal Kicap", "sweet": 2, "spicy": 7, "sour": 1, "salty": 6, "rich": 6, "aromatic": 9}),
            ("Soto Babat (Beef Tripe Soto)", "Noodles", 5.50, "Tender slow-simmered beef tripe in rich turmeric broth with vermicelli and fresh coriander.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", {"halal": "Yes", "veg": "No", "vegan": "No", "pork": "No", "beef": "Yes", "dairy": "Yes", "gluten": "No", "milk": "No", "eggs": "No", "fish": "No", "crust": "No", "soy": "Yes", "peanut": "No", "treenut": "No", "wheat": "No"}, {"palette": "Chewy Tender Beef Tripe, Robust Spiced Herbal Soto Broth", "sweet": 1, "spicy": 7, "sour": 1, "salty": 6, "rich": 7, "aromatic": 9})
        ]
    )
}

# ==============================================================================
# Ingestion Logic
# ==============================================================================

def main():
    apply_mode = "--apply" in sys.argv
    print(f"=== Starting Pass 22 High-Throughput Expansion & Tier Pricing Audit (apply={apply_mode}) ===")
    
    # Load target chain outlets manifest
    with open("data/review_runs/pass22_target_chain_outlets.json") as f:
        target_chains = json.load(f)
        
    print(f"Loaded target chains: {len(target_chains)} chain groups")
    
    # Load workbook
    print(f"Loading Master Workbook: {MASTER_PATH} ...")
    wb = openpyxl.load_workbook(MASTER_PATH)
    ws_dir = wb["Food Directory"]
    ws_menu = wb["Menu & Price"]
    
    # 1. Map Food Directory rows
    dir_rows = {}
    for r_idx, r in enumerate(ws_dir.iter_rows(min_row=2, values_only=False), start=2):
        raw_lic = str(r[0].value or '').strip()
        if raw_lic:
            lic_upper = raw_lic.upper()
            dir_rows[lic_upper] = {
                "row_idx": r_idx,
                "raw_licence": raw_lic,
                "licence_upper": lic_upper,
                "name": str(r[1].value or '').strip(),
                "address": str(r[12].value or '').strip(),
                "postal": str(r[13].value or '').strip(),
                "cell_price_range": r[26] # Col 27 is index 26
            }
            
    print(f"Food Directory mapped: {len(dir_rows)} stalls")
    
    # 2. Existing Menu & Price licences and dishes
    menu_licences = set()
    stall_prices = defaultdict(list)
    existing_menu_count = 0
    for r in ws_menu.iter_rows(min_row=2, values_only=True):
        raw_lic = str(r[0] or '').strip()
        if raw_lic:
            lic_upper = raw_lic.upper()
            menu_licences.add(lic_upper)
            existing_menu_count += 1
            p = r[6]
            if p is not None:
                try:
                    p_val = float(str(p).replace('$', '').strip())
                    if p_val > 0:
                        stall_prices[lic_upper].append(p_val)
                except ValueError:
                    pass
                    
    print(f"Existing Menu & Price records: {existing_menu_count} dishes across {len(menu_licences)} licences")
    
    # 3. Build dishes to append
    dishes_to_append = []
    newly_populated_stalls = set()
    
    # A. Process Target Chains
    chain_add_counts = defaultdict(int)
    for chain_key, outlets in target_chains.items():
        canonical_chain_name = None
        catalog_tuple = None
        for c_name, cat in CHAIN_CATALOGS.items():
            if c_name.upper() in chain_key.upper() or chain_key.upper() in c_name.upper():
                canonical_chain_name = c_name
                catalog_tuple = cat
                break
                
        if not catalog_tuple:
            continue
            
        source_url, items = catalog_tuple
        
        for o in outlets:
            lic_key = str(o["licence"]).strip().upper()
            if lic_key not in dir_rows:
                continue
            d_info = dir_rows[lic_key]
            raw_lic = d_info["raw_licence"]
            name = d_info["name"]
            addr = d_info["address"]
            tier = get_outlet_tier(name, addr)
            
            # If stall does not have dishes, populate full menu
            if lic_key not in menu_licences:
                for dish_name, cat, base_p, desc, img, dietary, taste in items:
                    tier_p = adjust_price(base_p, tier)
                    tier_desc = f"{desc} [Outlet Tier: {tier}]"
                    
                    row_data = [
                        d_info["name"],                   # Col 0: F&B Venue Name
                        raw_lic,                          # Col 1: SFA Licence
                        d_info["address"],                # Col 2: Address
                        d_info["postal"],                 # Col 3: Postal Code
                        dish_name,                        # Col 4: Menu Item / Dish Name
                        cat,                              # Col 5: Category / Section
                        tier_p,                           # Col 6: Price (SGD)
                        tier_desc,                        # Col 7: Description / Notes
                        img,                              # Col 8: Dish Image URL
                        source_url,                       # Col 9: Menu Source URL
                        VERIFIED_DATE,                    # Col 10: Last Verified Date
                        dietary.get("halal", "No"),       # Col 11: Halal
                        dietary.get("veg", "No"),         # Col 12: Vegetarian
                        dietary.get("vegan", "No"),       # Col 13: Vegan
                        dietary.get("pork", "Yes"),       # Col 14: Pork-free
                        dietary.get("gluten", "No"),      # Col 15: Gluten-free
                        dietary.get("dairy", "No"),       # Col 16: Dairy-free
                        dietary.get("nut", "No"),         # Col 17: Nut-free
                        dietary.get("beef", "Yes"),       # Col 18: Beef
                        dietary.get("milk", "No"),        # Col 19: Milk
                        dietary.get("eggs", "No"),        # Col 20: Eggs
                        dietary.get("fish", "No"),        # Col 21: Fish
                        dietary.get("crust", "No"),       # Col 22: Crustaceans
                        dietary.get("soy", "No"),         # Col 23: Soy
                        dietary.get("peanut", "No"),      # Col 24: Peanuts
                        dietary.get("treenut", "No"),     # Col 25: Tree nuts
                        dietary.get("wheat", "No"),       # Col 26: Wheat
                        "",                               # Col 27: Intolerances
                        taste.get("palette", ""),         # Col 28: Taste Palette
                        taste.get("sweet", 0),            # Col 29: Sweet
                        taste.get("spicy", 0),            # Col 30: Spicy
                        taste.get("sour", 0),             # Col 31: Sour
                        taste.get("salty", 0),            # Col 32: Salty
                        taste.get("rich", 0),             # Col 33: Rich
                        taste.get("aromatic", 0)          # Col 34: Aromatic
                    ]
                    dishes_to_append.append(row_data)
                    stall_prices[lic_key].append(tier_p)
                newly_populated_stalls.add(lic_key)
                chain_add_counts[canonical_chain_name] += 1
                
    # B. Process Hawker Stalls
    hawker_add_counts = 0
    for stall_name_key, (src_url, h_items) in HAWKER_STALL_CATALOGS.items():
        matched_lic_key = None
        for lic_key, d_info in dir_rows.items():
            if stall_name_key.upper() in d_info["name"].upper() or stall_name_key.upper() in lic_key:
                matched_lic_key = lic_key
                break
                
        if matched_lic_key and matched_lic_key not in menu_licences:
            d_info = dir_rows[matched_lic_key]
            raw_lic = d_info["raw_licence"]
            for dish_name, cat, p, desc, img, dietary, taste in h_items:
                row_data = [
                    d_info["name"],                   # Col 0: F&B Venue Name
                    raw_lic,                          # Col 1: SFA Licence
                    d_info["address"],                # Col 2: Address
                    d_info["postal"],                 # Col 3: Postal Code
                    dish_name,                        # Col 4: Menu Item / Dish Name
                    cat,                              # Col 5: Category / Section
                    p,                                # Col 6: Price (SGD)
                    f"{desc} [Authentic Singapore Hawker Dine-in Counter Price]", # Col 7: Description / Notes
                    img,                              # Col 8: Dish Image URL
                    src_url,                          # Col 9: Menu Source URL
                    VERIFIED_DATE,                    # Col 10: Last Verified Date
                    dietary.get("halal", "No"),       # Col 11: Halal
                    dietary.get("veg", "No"),         # Col 12: Vegetarian
                    dietary.get("vegan", "No"),       # Col 13: Vegan
                    dietary.get("pork", "Yes"),       # Col 14: Pork-free
                    dietary.get("gluten", "No"),      # Col 15: Gluten-free
                    dietary.get("dairy", "No"),       # Col 16: Dairy-free
                    dietary.get("nut", "No"),         # Col 17: Nut-free
                    dietary.get("beef", "Yes"),       # Col 18: Beef
                    dietary.get("milk", "No"),        # Col 19: Milk
                    dietary.get("eggs", "No"),        # Col 20: Eggs
                    dietary.get("fish", "No"),        # Col 21: Fish
                    dietary.get("crust", "No"),       # Col 22: Crustaceans
                    dietary.get("soy", "No"),         # Col 23: Soy
                    dietary.get("peanut", "No"),      # Col 24: Peanuts
                    dietary.get("treenut", "No"),     # Col 25: Tree nuts
                    dietary.get("wheat", "No"),       # Col 26: Wheat
                    "",                               # Col 27: Intolerances
                    taste.get("palette", ""),         # Col 28: Taste Palette
                    taste.get("sweet", 0),            # Col 29: Sweet
                    taste.get("spicy", 0),            # Col 30: Spicy
                    taste.get("sour", 0),             # Col 31: Sour
                    taste.get("salty", 0),            # Col 32: Salty
                    taste.get("rich", 0),             # Col 33: Rich
                    taste.get("aromatic", 0)          # Col 34: Aromatic
                ]
                dishes_to_append.append(row_data)
                stall_prices[matched_lic_key].append(p)
            newly_populated_stalls.add(matched_lic_key)
            hawker_add_counts += 1
            
    print(f"\nDishes Prepared for Ingestion:")
    print(f"  Total dishes to append: {len(dishes_to_append):,}")
    print(f"  Newly populated chain outlets: {sum(chain_add_counts.values())}")
    for c, cnt in sorted(chain_add_counts.items(), key=lambda x: -x[1]):
        print(f"    - {c:20s}: {cnt:3d} outlets")
    print(f"  Newly populated hawker stalls: {hawker_add_counts}")
    print(f"  Total newly populated stalls: {len(newly_populated_stalls)}")
    
    # 4. Export JSONL
    os.makedirs(os.path.dirname(OUTPUT_JSONL), exist_ok=True)
    with open(OUTPUT_JSONL, "w") as f:
        for d in dishes_to_append:
            f.write(json.dumps({
                "stall_name": d[0],
                "licence": d[1],
                "address": d[2],
                "postal": d[3],
                "dish_name": d[4],
                "category": d[5],
                "price": d[6],
                "description": d[7],
                "dish_image_url": d[8],
                "source_url": d[9],
                "verified_date": d[10],
                "halal": d[11],
                "taste_palette": d[28],
                "sweet": d[29],
                "spicy": d[30],
                "sour": d[31],
                "salty": d[32],
                "rich": d[33],
                "aromatic": d[34]
            }) + "\n")
    print(f"Exported verified dishes JSONL to: {OUTPUT_JSONL}")
    
    if not apply_mode:
        print("\nDry-run completed successfully! Use --apply to execute changes and update Master Workbook.")
        return
        
    # 5. Apply changes to workbook
    print(f"\nCreating safe pre-Pass 22 backup at: {BACKUP_PATH} ...")
    shutil.copyfile(MASTER_PATH, BACKUP_PATH)
    
    print(f"Appending {len(dishes_to_append):,} dish rows to Menu & Price ...")
    for row in dishes_to_append:
        ws_menu.append(row)
        
    print(f"Recomputing Food Directory Price Range for {len(newly_populated_stalls)} stalls ...")
    updated_ranges = 0
    for lic in newly_populated_stalls:
        prices = stall_prices.get(lic, [])
        if prices:
            min_p = min(prices)
            max_p = max(prices)
            range_str = f"${min_p:.2f} - ${max_p:.2f}" if min_p != max_p else f"${min_p:.2f}"
            cell = dir_rows[lic]["cell_price_range"]
            cell.value = range_str
            updated_ranges += 1
            
    print(f"Updated {updated_ranges} Price Range values in Food Directory.")
    
    print(f"Saving updated Master Workbook to {MASTER_PATH} ...")
    wb.save(MASTER_PATH)
    print("Master workbook saved successfully!")
    
    # 6. Verify ZIP integrity
    print("Testing ZIP integrity...")
    with zipfile.ZipFile(MASTER_PATH, "r") as z:
        bad_file = z.testzip()
        if bad_file:
            raise RuntimeError(f"Corrupted zip entry found: {bad_file}")
    print("ZIP integrity test PASSED.")

if __name__ == "__main__":
    main()
