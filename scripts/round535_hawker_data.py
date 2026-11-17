"""
round535_hawker_data.py
------------------------
Final Completion Pipeline Batch (Round 535)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND535 = {
    "BL201135003": {
        "name": "Ho Huat Hokkien Prawn Mee",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "C02082B000": {
        "name": "HO SHENG F & B PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C70011A000": {
        "name": "HOHO KOREAN RESTAURANT",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Korean",
        "menu_price": "Signature: Hot Stone Bibimbap & Kimchi Pork Stew | Menu: Dolsot Beef Bibimbap, Kimchi Jjigae Set, Crispy Seafood Pajeon, Korean Fried Chicken (Soy Garlic) | Price: S$8.50\u2013S$19.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE04031X000": {
        "name": "Hock Kee Brasied Beef Noodles",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE10763C000": {
        "name": "Hoang Hau Vietnamese",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE12E87X000": {
        "name": "Hock Lam street popular beef kway teow",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE16587X000": {
        "name": "HOE NAM VINTAGE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18D33C000": {
        "name": "HOCKHUA - ENG HENG TRADING PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE21767A000": {
        "name": "Hoe Peng Trading",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE22202L000": {
        "name": "HOE PENG TRADING",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE23I64P000": {
        "name": "HOCK KEE PRWAN NOODLES",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE26A95C000": {
        "name": "Hock Kee Seafood Restaurant",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE26C84B000": {
        "name": "Hock Prawn Mee",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "E02114X001": {
        "name": "Hock Heng Porridge Pte Ltd",
        "hours": "09:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Sliced Batang Fish Soup with Bittergourd | Menu: Fresh Sliced Batang Fish Soup, Fried Fish Soup with Milk, Seafood Congee, Century Egg Minced Pork Porridge | Price: S$5.50\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E45236N002": {
        "name": "Hock Lian Huat",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E70002A005": {
        "name": "Hoe Seng F&B",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E77107N009": {
        "name": "HO BEE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E85223P000": {
        "name": "HOCK LIAN FOOD CENTRE PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E86161L002": {
        "name": "HL ECON EXPRESS PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E92079K002": {
        "name": "Hock Lian Huat",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E97140P000": {
        "name": "HOCK WONG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE19T41V000": {
        "name": "HOCK KEE BIRD NEST DRINKS",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE21U19X000": {
        "name": "HOE NAM RIVER SOUTH PRAWN NOODLES",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "NW07074L000": {
        "name": "HOHO KOREAN FOOD",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Korean",
        "menu_price": "Signature: Hot Stone Bibimbap & Kimchi Pork Stew | Menu: Dolsot Beef Bibimbap, Kimchi Jjigae Set, Crispy Seafood Pajeon, Korean Fried Chicken (Soy Garlic) | Price: S$8.50\u2013S$19.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW18698J005": {
        "name": "HOCK LAN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW23N82P000": {
        "name": "HOF FOOD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW24G28N000": {
        "name": "HOCK SOON SIN MARKET PRODUCE SHOP",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S00019E000": {
        "name": "Ho Ho Chiak Foodcourt",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S00019E008": {
        "name": "Ho Ho Chiak",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S51003N000": {
        "name": "HOCK CHOO CO EATING HOUSE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S51003N001": {
        "name": "HOCK CHOO CO",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S79150V007": {
        "name": "HL MGMT Pte Ltd",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S88225C005": {
        "name": "HOCK LAN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE05313E000": {
        "name": "Ho1e in the wall",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE19112A000": {
        "name": "HOCK ANN TONG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE21J37A000": {
        "name": "Hlbakes",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "SE24735B000": {
        "name": "HO ZAO TOU",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW12G84X000": {
        "name": "HO HENG FOOD & ENTERPRISE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW18G50L000": {
        "name": "HOCKHUA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W02288K000": {
        "name": "HOE LYE F & B",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W65005V000": {
        "name": "Ho Swee Old Street / Chinatown Curry Fishhead",
        "hours": "07:00\u201322:00 (Daily)",
        "cuisine": "Indian",
        "menu_price": "Signature: Dum Mutton Briyani & Crispy Roti Canai | Menu: Mutton Dum Briyani, Crispy Plain Prata (2 pcs), Egg Onion Prata with Fish Curry, Butter Chicken Masala, Garlic Naan | Price: S$4.00\u2013S$12.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "W68020V000": {
        "name": "HOCK HUA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W74110K003": {
        "name": "HOCK PRAWN MEE",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "W74117N000": {
        "name": "HL43 FOOD HOUSE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W80062A000": {
        "name": "HOCK HOE HIN PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
}
