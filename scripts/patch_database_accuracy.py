#!/usr/bin/env python3
"""Patch the Hungry F&B Excel workbook with accurate menu, image, and metadata.

This script performs:
1. Brand-specific overrides for the 10 audited F&B brands.
2. Contextual default Unsplash image mapping for dishes based on cuisine and keywords.
3. Storefront image mapping based on stall type.
4. Smart detection and flagging of non-consumer entities.
"""

import os
import shutil
import openpyxl
from pathlib import Path

# Paths
ROOT = Path(__file__).resolve().parents[1]
WORKBOOK_PATH = ROOT / "data" / "Hungry F&B Database.xlsx"
BACKUP_PATH = ROOT / "data" / "Hungry F&B Database.xlsx.bak"

def backup_workbook():
    if not WORKBOOK_PATH.exists():
        raise FileNotFoundError(f"Workbook not found at {WORKBOOK_PATH}")
    print(f"Backing up workbook to {BACKUP_PATH}...")
    shutil.copyfile(WORKBOOK_PATH, BACKUP_PATH)

def check_non_consumer(name, g_name):
    name_lower = str(name or "").lower()
    g_name_lower = str(g_name or "").lower()

    # If the Google name is empty, we fall back to name
    check_name = g_name_lower if g_name_lower else name_lower

    # Truly non-consumer keywords
    non_consumer_keywords = [
        "school", "canteen", "primary school", "secondary school", "junior college", "polytechnic",
        "university", "campus", "hall of residence", "ministry of education", "secondary sch", "primary sch",
        "logistics", "warehouse club", "warehouse singapore", "singapura logistics",
        "processing factory", "poultry processing", "chemical", "construction", "engineering",
        "holding pte", "holdings pte", "group holdings", "management pte", "investment pte", "investments pte"
    ]

    for keyword in non_consumer_keywords:
        if keyword in check_name:
            return True, f"Non-Consumer keyword '{keyword}' found in name"

    # Catering check
    if "catering" in check_name:
        exceptions = ["cafe", "restaurant", "bistro", "eathouse", "food", "dining", "house", "kopitiam", "hawker", "stall", "hub"]
        if not any(ex in check_name for ex in exceptions):
            return True, "Catering entity without dining/food keywords"

    # Trading check
    if "trading" in check_name:
        exceptions = ["cafe", "restaurant", "bistro", "eathouse", "food", "coffee", "bakery", "pastry"]
        if not any(ex in check_name for ex in exceptions):
            return True, "Trading/wholesale entity without dining keywords"

    # Import/Export/Wholesale check
    if any(kw in check_name for kw in ["import & export", "import/export", "export import", "wholesale"]):
        exceptions = ["cafe", "restaurant", "bistro", "food", "coffee"]
        if not any(ex in check_name for ex in exceptions):
            return True, "Import/Export/Wholesale entity without dining keywords"

    return False, ""

def get_contextual_dish_image(cuisine, signature, name):
    cuisine_lower = str(cuisine or "").lower()
    sig_lower = str(signature or "").lower()
    name_lower = str(name or "").lower()

    combined = f"{cuisine_lower} {sig_lower} {name_lower}"

    # Mapping rules
    if "chicken rice" in combined or "chicken-rice" in combined:
        return "https://images.unsplash.com/photo-1626947346165-4c2288dadc2a?w=600&auto=format&fit=crop&q=60"
    elif "laksa" in combined:
        return "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=60"
    elif "nasi lemak" in combined or "nasi-lemak" in combined:
        return "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&auto=format&fit=crop&q=60"
    elif "bak kut teh" in combined or "bak-kut-teh" in combined:
        return "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["bubble tea", "boba", "milk tea", "liho", "koi", "gong cha"]):
        return "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["juice", "smoothie", "boost juice"]):
        return "https://images.unsplash.com/photo-1553530979-7ee52a2670c4?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["steak", "sirloin", "ribeye", "grill", "astons"]):
        return "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["pizza", "pasta", "spaghetti", "saizeriya"]):
        return "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&w=800&q=80"
    elif "burger" in combined:
        return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["bread", "croissant", "muffin", "bakery", "pastry", "breadtalk"]):
        return "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["curry", "prata", "biryani", "naan", "roti"]):
        return "https://images.unsplash.com/photo-1585938338392-50a592202c7b?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["sushi", "ramen", "sashimi", "donburi"]):
        return "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["noodle", "noodles", "hokkien mee", "char kway teow", "dim sum"]):
        return "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["coffee", "toast", "kopi", "teh"]):
        return "https://images.unsplash.com/photo-1588644525287-f273b6dc0b43?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["ice cream", "dessert", "sweet", "waffle", "cake"]):
        return "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["fish", "seafood", "crab", "lobster", "prawn"]):
        return "https://images.unsplash.com/photo-1534080391025-09795d197a5b?w=600&auto=format&fit=crop&q=60"
    elif any(x in combined for x in ["salad", "vegetables", "vegetarian"]):
        return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80&w=800"

    # Fallbacks by cuisine category
    if "singaporean" in cuisine_lower:
        return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60"
    elif "western" in cuisine_lower:
        return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=60"
    elif "malay" in cuisine_lower:
        return "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&auto=format&fit=crop&q=60"
    elif "indian" in cuisine_lower:
        return "https://images.unsplash.com/photo-1585938338392-50a592202c7b?w=600&auto=format&fit=crop&q=60"
    elif "japanese" in cuisine_lower:
        return "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=60"
    elif "beverages" in cuisine_lower:
        return "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=600&auto=format&fit=crop&q=60"
    elif "bakery" in cuisine_lower:
        return "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=60"

    return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=60"

def get_storefront_image(stall_type):
    st_type = str(stall_type or "").strip()

    # Storefront mappings
    mappings = {
        "Restaurant": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=60",
        "Chain Outlet": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&auto=format&fit=crop&q=60",
        "Cafe": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=60",
        "Bar / Bistro": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=60",
        "Hawker Stall": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop&q=60",
        "Food Court Stall": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=60",
        "Zi Char": "https://images.unsplash.com/photo-1534080391025-09795d197a5b?w=600&auto=format&fit=crop&q=60",
        "Other": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=60"
    }
    return mappings.get(st_type, "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=60")

def main():
    backup_workbook()

    print("Loading workbook...")
    wb = openpyxl.load_workbook(WORKBOOK_PATH)
    ws = wb.active

    # Map headers to column letters
    headers = [cell.value for cell in ws[1]]
    col_idx = {h: idx + 1 for idx, h in enumerate(headers) if h}

    # Helper to write cell safely
    def write_cell(row_num, col_name, value):
        if col_name in col_idx:
            ws.cell(row=row_num, column=col_idx[col_name]).value = value

    total_rows = ws.max_row
    print(f"Total rows to process: {total_rows - 1}")

    brand_counts = {
        "ya_kun": 0, "astons": 0, "breadtalk": 0, "liho": 0, "boost": 0,
        "saizeriya": 0, "tian_tian": 0, "katong_laksa": 0, "song_fa": 0, "selera_rasa": 0
    }
    non_consumer_count = 0
    contextual_image_count = 0

    for row_num in range(2, total_rows + 1):
        # Read key fields
        name = ws.cell(row=row_num, column=col_idx["Stall / Restaurant Name"]).value
        g_name = ws.cell(row=row_num, column=col_idx["Google Display Name"]).value if "Google Display Name" in col_idx else None
        cuisine = ws.cell(row=row_num, column=col_idx["Cuisine"]).value if "Cuisine" in col_idx else None
        sig_dish = ws.cell(row=row_num, column=col_idx["Signature Dish"]).value if "Signature Dish" in col_idx else None
        address = ws.cell(row=row_num, column=col_idx["Address"]).value if "Address" in col_idx else None
        building = ws.cell(row=row_num, column=col_idx["Hawker Centre / Building"]).value if "Hawker Centre / Building" in col_idx else None
        stall_type = ws.cell(row=row_num, column=col_idx["Stall Type"]).value if "Stall Type" in col_idx else None

        name_lower = str(name or "").lower()
        g_name_lower = str(g_name or "").lower()

        # 1. Non-Consumer check
        is_nc, nc_reason = check_non_consumer(name, g_name)
        if is_nc:
            write_cell(row_num, "Coverage Status", "out_of_scope")
            write_cell(row_num, "Notes", f"Excluded: {nc_reason}")
            non_consumer_count += 1
            continue  # Skip further updates for non-consumer rows

        # 2. Audited Brands Overrides
        is_brand = False

        # YA KUN
        if "ya kun" in name_lower or "ya kun" in g_name_lower:
            write_cell(row_num, "Cuisine", "Singaporean")
            write_cell(row_num, "Price Min (SGD)", 3.00)
            write_cell(row_num, "Price Max (SGD)", 10.00)
            write_cell(row_num, "Price", "$3.00 - $10.00")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "Kaya Toast Set A")
            write_cell(row_num, "Menu", "Kaya Toast Set A, Kaya Toast, Butter Sugar Toast, French Toast, Steamed Kaya Butter Bread, Toastwich, Laksa, Mee Rebus, Chicken Curry")
            write_cell(row_num, "Menu Items", "Kaya Toast Set A (Kaya Toast, Soft-boiled eggs, Kopi/Teh), Traditional Kaya Toast, Butter Sugar Toast, French Toast with Kaya, Steamed Kaya Butter Bread, Toastwich, Laksa, Mee Rebus, Chicken Curry")
            write_cell(row_num, "Menu Source", "official_online_seed: https://yakun.com/menu/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1600096194534-95cf5ece04cf?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1588644525287-f273b6dc0b43?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")
            brand_counts["ya_kun"] += 1
            is_brand = True

        # ASTONS
        elif "astons" in name_lower or "astons" in g_name_lower:
            write_cell(row_num, "Cuisine", "Western")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "Prime Sirloin Steak")
            write_cell(row_num, "Menu", "Prime Sirloin Steak, Chargrilled Chicken, Ribeye Steak, Black Pepper Chicken, Fish & Chips, Supreme Salad Buffet, Grill Fish with Herbs")
            write_cell(row_num, "Menu Items", "Prime Sirloin Steak, Chargrilled Chicken, Ribeye Steak, Black Pepper Chicken, Fish & Chips, Supreme Salad Buffet, Grill Fish with Herbs")
            write_cell(row_num, "Menu Source", "official_online_seed: https://www.astons.com.sg/menu/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")

            # Check if Steak & Salad
            is_steak_salad = "steak & salad" in name_lower or "steak & salad" in g_name_lower or "steak and salad" in name_lower
            if is_steak_salad or "marina square" in str(address or building).lower():
                write_cell(row_num, "Price Min (SGD)", 24.50)
                write_cell(row_num, "Price Max (SGD)", 59.90)
                write_cell(row_num, "Price", "$24.50 - $59.90")
            else:
                write_cell(row_num, "Price Min (SGD)", 12.00)
                write_cell(row_num, "Price Max (SGD)", 30.00)
                write_cell(row_num, "Price", "$12.00 - $30.00")

            brand_counts["astons"] += 1
            is_brand = True

        # BREADTALK
        elif "breadtalk" in name_lower or "breadtalk" in g_name_lower:
            write_cell(row_num, "Cuisine", "Bakery")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "Flosss Bun")
            write_cell(row_num, "Menu", "Flosss Bun, Fire Flosss, Sunflower Bun, Cheese Boat, Sausage Standard, Earthy Yam, Sourdough Loaf, Butter Croissant, Egg Tart")
            write_cell(row_num, "Menu Items", "Flosss Bun, Fire Flosss, Sunflower Bun, Cheese Boat, Sausage Standard, Earthy Yam, Sourdough Loaf, Butter Croissant, Egg Tart")
            write_cell(row_num, "Menu Source", "official_online_seed: https://www.breadtalk.com.sg/menu")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=60")

            # Suntec City branch check
            if "suntec" in str(address or building).lower() and "cafe" in name_lower:
                write_cell(row_num, "Coverage Status", "out_of_scope")
                write_cell(row_num, "Notes", "Permanently closed. Shuttered and replaced by Toast Box.")
            else:
                write_cell(row_num, "Price Min (SGD)", 2.00)
                write_cell(row_num, "Price Max (SGD)", 10.00)
                write_cell(row_num, "Price", "$2.00 - $10.00")
                write_cell(row_num, "Coverage Status", "Complete")

            brand_counts["breadtalk"] += 1
            is_brand = True

        # LIHO
        elif "liho" in name_lower or "liho" in g_name_lower:
            write_cell(row_num, "Cuisine", "Beverages")
            write_cell(row_num, "Price Min (SGD)", 4.00)
            write_cell(row_num, "Price Max (SGD)", 8.50)
            write_cell(row_num, "Price", "$4.00 - $8.50")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "Classic Milk Tea with Golden Pearls")
            write_cell(row_num, "Menu", "Classic Milk Tea, Brown Sugar Pearl Fresh Milk, Golden Avocado, Orchid Tie Guan Yin, Winter Melon Tea, Jasmine Green Tea, Cheese Tea")
            write_cell(row_num, "Menu Items", "Classic Milk Tea, Brown Sugar Pearl Fresh Milk, Golden Avocado, Orchid Tie Guan Yin, Winter Melon Tea, Jasmine Green Tea, Cheese Tea")
            write_cell(row_num, "Menu Source", "official_online_seed: https://www.lihotea.sg/menu")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")
            brand_counts["liho"] += 1
            is_brand = True

        # BOOST JUICE BAR
        elif "boost juice" in name_lower or "boost juice" in g_name_lower:
            write_cell(row_num, "Cuisine", "Beverages")
            write_cell(row_num, "Price Min (SGD)", 5.50)
            write_cell(row_num, "Price Max (SGD)", 9.00)
            write_cell(row_num, "Price", "$5.50 - $9.00")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "All Berry Bang")
            write_cell(row_num, "Menu", "All Berry Bang, Mango Magic, Strawberry Squeeze, Cookies & Cream, Superfruit Energy, 5 A Day Juice, Strawberry Melon Crush")
            write_cell(row_num, "Menu Items", "All Berry Bang, Mango Magic, Strawberry Squeeze, Cookies & Cream, Superfruit Energy, 5 A Day Juice, Strawberry Melon Crush")
            write_cell(row_num, "Menu Source", "official_online_seed: https://www.boostjuicebars.com.sg/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1553530979-7ee52a2670c4?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")
            brand_counts["boost"] += 1
            is_brand = True

        # SAIZERIYA
        elif "saizeriya" in name_lower or "saizeriya" in g_name_lower:
            write_cell(row_num, "Cuisine", "Japanese-Italian Fusion")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "Milano Gratin")
            write_cell(row_num, "Menu", "Milano Gratin, Carbonara Pasta, Margherita Pizza, Chicken Wings, Hamburg Steak, Black Pepper Beef Doria, Tiramisu")
            write_cell(row_num, "Menu Items", "Milano Gratin, Carbonara Pasta, Margherita Pizza, Chicken Wings, Hamburg Steak, Black Pepper Beef Doria, Tiramisu")
            write_cell(row_num, "Menu Source", "official_online_seed: https://www.saizeriya.com.sg/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=60")

            # Liang Court branch check
            if "liang court" in str(address or building).lower():
                write_cell(row_num, "Coverage Status", "out_of_scope")
                write_cell(row_num, "Notes", "Permanently closed in November 2019 due to the Liang Court redevelopment.")
            else:
                write_cell(row_num, "Price Min (SGD)", 4.00)
                write_cell(row_num, "Price Max (SGD)", 12.00)
                write_cell(row_num, "Price", "$4.00 - $12.00")
                write_cell(row_num, "Coverage Status", "Complete")

            brand_counts["saizeriya"] += 1
            is_brand = True

        # TIAN TIAN CHICKEN RICE
        elif ("tian tian" in name_lower or "tian tian" in g_name_lower) and "chicken" in name_lower:
            write_cell(row_num, "Cuisine", "Singaporean")
            write_cell(row_num, "Price Min (SGD)", 5.00)
            write_cell(row_num, "Price Max (SGD)", 10.00)
            write_cell(row_num, "Price", "$5.00 - $10.00")
            write_cell(row_num, "Closed Days", "Monday")
            write_cell(row_num, "Signature Dish", "Hainanese Chicken Rice")
            write_cell(row_num, "Menu", "Steamed Hainanese Chicken Rice, Half Chicken, Whole Chicken, Oyster Sauce Vegetables, Chicken Gizzard, Chicken Liver")
            write_cell(row_num, "Menu Items", "Steamed Hainanese Chicken Rice, Half Chicken, Whole Chicken, Oyster Sauce Vegetables, Chicken Gizzard, Chicken Liver")
            write_cell(row_num, "Menu Source", "official_online_seed: http://www.tiantianchickenrice.com/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1626947346165-4c2288dadc2a?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")
            brand_counts["tian_tian"] += 1
            is_brand = True

        # 328 KATONG LAKSA
        elif "328 katong" in name_lower or "328 laksa" in name_lower or "katong laksa" in name_lower:
            write_cell(row_num, "Cuisine", "Singaporean")
            write_cell(row_num, "Price Min (SGD)", 5.50)
            write_cell(row_num, "Price Max (SGD)", 10.00)
            write_cell(row_num, "Price", "$5.50 - $10.00")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "Katong Laksa")
            write_cell(row_num, "Menu", "Katong Laksa (Small), Katong Laksa (Large), Otah, Lime Juice, Laksa Hotpot, Cooked Prawns")
            write_cell(row_num, "Menu Items", "Katong Laksa (Small), Katong Laksa (Large), Otah, Lime Juice, Laksa Hotpot, Cooked Prawns")
            write_cell(row_num, "Menu Source", "official_online_seed: https://www.328katonglaksa.com.sg/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")
            brand_counts["katong_laksa"] += 1
            is_brand = True

        # SONG FA BAK KUT TEH
        elif "song fa" in name_lower or "song fa" in g_name_lower:
            write_cell(row_num, "Cuisine", "Teochew")
            write_cell(row_num, "Price Min (SGD)", 8.00)
            write_cell(row_num, "Price Max (SGD)", 20.00)
            write_cell(row_num, "Price", "$8.00 - $20.00")
            write_cell(row_num, "Closed Days", "None")
            write_cell(row_num, "Signature Dish", "Pork Ribs Soup")
            write_cell(row_num, "Menu", "Pork Ribs Soup, Premium Loin Ribs Soup, Braised Pig's Trotter, Braised Beancurd Skin, Salted Vegetables, You Tiao, Braised Peanuts")
            write_cell(row_num, "Menu Items", "Pork Ribs Soup, Premium Loin Ribs Soup, Braised Pig's Trotter, Braised Beancurd Skin, Salted Vegetables, You Tiao, Braised Peanuts")
            write_cell(row_num, "Menu Source", "official_online_seed: https://songfa.com.sg/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")
            brand_counts["song_fa"] += 1
            is_brand = True

        # SELERA RASA NASI LEMAK
        elif "selera rasa" in name_lower or "selera rasa" in g_name_lower:
            write_cell(row_num, "Cuisine", "Malay")
            write_cell(row_num, "Price Min (SGD)", 2.50)
            write_cell(row_num, "Price Max (SGD)", 6.00)
            write_cell(row_num, "Price", "$2.50 - $6.00")
            write_cell(row_num, "Closed Days", "Friday")
            write_cell(row_num, "Signature Dish", "Royal Rumble Nasi Lemak Set")
            write_cell(row_num, "Menu", "Royal Rumble Set, Royal Flush Set, Full House Set, Nasi Lemak with Ayam Goreng, Sambal Ikan Bilis")
            write_cell(row_num, "Menu Items", "Royal Rumble Set (Chicken Wing, Otah, Begedil, Egg, Hashfry, Iced Tea), Royal Flush Set, Full House Set, Nasi Lemak with Ayam Goreng, Sambal Ikan Bilis")
            write_cell(row_num, "Menu Source", "official_online_seed: https://www.selerarasa.com/")
            write_cell(row_num, "Image URL", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Dishes Image URL", "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&auto=format&fit=crop&q=60")
            write_cell(row_num, "Coverage Status", "Complete")
            brand_counts["selera_rasa"] += 1
            is_brand = True

        # 3. If not one of the 10 audited brands, perform global image contextualization
        if not is_brand:
            # storefront image based on stall type
            sf_img = get_storefront_image(stall_type)
            write_cell(row_num, "Image URL", sf_img)

            # dishes image based on keyword analysis
            dish_img = get_contextual_dish_image(cuisine, sig_dish, name)
            write_cell(row_num, "Dishes Image URL", dish_img)
            contextual_image_count += 1

    print("Saving workbook modifications...")
    wb.save(WORKBOOK_PATH)
    print("Workbook successfully saved!")

    print("\n--- Execution Summary ---")
    print(f"Non-consumer entities flagged: {non_consumer_count}")
    print(f"Contextual dish images applied: {contextual_image_count}")
    for brand, count in brand_counts.items():
        print(f"Brand '{brand}' corrected occurrences: {count}")
    print("--------------------------")

if __name__ == "__main__":
    main()
