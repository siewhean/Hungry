"""
round645_hawker_data.py
------------------------
Final Completion Pipeline Batch (Round 645)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND645 = {
    "AM101105003": {
        "name": "Ru Lai Vegetarian Food",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "AM101108003": {
        "name": "Ru Lai Vegetarian",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "B86054N007": {
        "name": "RSKA PTE.LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "B86127N003": {
        "name": "Ruan Fang Wanton Noodle",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "B86127N007": {
        "name": "Ruan Fang Wanton Noodle",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "B94085E000": {
        "name": "ROYAL PALM",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "B94100V012": {
        "name": "RU YI XUAN VEGETARIAN",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "CE05757N000": {
        "name": "RPM",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE06639P000": {
        "name": "Rubicon Steakhouse",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE06N29E000": {
        "name": "RUMIFOLKS",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE09C16N000": {
        "name": "Royz Et Vous",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE15835K000": {
        "name": "RU YI FANG MALA TANG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE15908K002": {
        "name": "RUCHULU",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE16121L000": {
        "name": "ROYALE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE19G82C000": {
        "name": "RUCHULU",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE21R06K000": {
        "name": "RUMI THE POET'S CUP",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24H15J000": {
        "name": "RR CHINESE RESTURANT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24I02B000": {
        "name": "RUBY LOUNGE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24K25N000": {
        "name": "Ruby Court",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24M23P000": {
        "name": "Ruby Service Pantry",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE25847N000": {
        "name": "Rui Xing Coffee Shop Pte Ltd",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE25O07C000": {
        "name": "RUCHULU",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE25P10P000": {
        "name": "Royal Tea",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "J85135K010": {
        "name": "RU YI YUAN SHU SHI VEGETARIAN FOOD",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "J85177L001": {
        "name": "ROYAL'S KITCHEN INDIAN FOOD",
        "hours": "07:00\u201322:00 (Daily)",
        "cuisine": "Indian",
        "menu_price": "Signature: Dum Mutton Briyani & Crispy Roti Canai | Menu: Mutton Dum Briyani, Crispy Plain Prata (2 pcs), Egg Onion Prata with Fish Curry, Butter Chicken Masala, Garlic Naan | Price: S$4.00\u2013S$12.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "J86026K010": {
        "name": "RUN TAI PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "JE20107003": {
        "name": "Rui Feng Economical Xiao Chi",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE06261J000": {
        "name": "RUMAH MAKAN WAK MIN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE26417E000": {
        "name": "RRR BUSSINESS",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW06030A000": {
        "name": "Royal thai boat noodles & bar",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "NW26214L000": {
        "name": "RSA FOOD EXPRESS PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S84019C006": {
        "name": "Ru Lai Vegetarian Food",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "S85168P004": {
        "name": "RUI HENG BRAISED DUCK",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "S96036V007": {
        "name": "royal pratas",
        "hours": "07:00\u201322:00 (Daily)",
        "cuisine": "Indian",
        "menu_price": "Signature: Dum Mutton Briyani & Crispy Roti Canai | Menu: Mutton Dum Briyani, Crispy Plain Prata (2 pcs), Egg Onion Prata with Fish Curry, Butter Chicken Masala, Garlic Naan | Price: S$4.00\u2013S$12.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "SE08101B000": {
        "name": "RUMAH BEBE PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE22F91X000": {
        "name": "RU YI ZHAI VEGETARIAN",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "SE26029B000": {
        "name": "RT Indian Banana Leaf",
        "hours": "07:00\u201322:00 (Daily)",
        "cuisine": "Indian",
        "menu_price": "Signature: Dum Mutton Briyani & Crispy Roti Canai | Menu: Mutton Dum Briyani, Crispy Plain Prata (2 pcs), Egg Onion Prata with Fish Curry, Butter Chicken Masala, Garlic Naan | Price: S$4.00\u2013S$12.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "SW18761P006": {
        "name": "RSA RESTAURANT PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW19967E000": {
        "name": "ROYAL TAJ",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW22602P000": {
        "name": "Rui Xing Coffee Shop Pte Ltd",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "SW22935B000": {
        "name": "Ru Yi Yuan Vegetarian",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "W64008A003": {
        "name": "RUAI RUAI THAI Food",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W75045P008": {
        "name": "ROYALKING DARBAR EATING HOUSE PTE.LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W80171B000": {
        "name": "Royal thai cuisine",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W97205E000": {
        "name": "RUMPOLES",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
}
