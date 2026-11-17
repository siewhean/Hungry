"""
round583_hawker_data.py
------------------------
Final Completion Pipeline Batch (Round 583)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND583 = {
    "B90059V005": {
        "name": "LITTLE TOWKAY",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "B92006J000": {
        "name": "lit lit xin cold & hot dessert",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "B92019V003": {
        "name": "LITTLE BOWL PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "BS20129004": {
        "name": "Lit Lit Sin Deserts",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C78118C003": {
        "name": "LITTLE MYANMAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE08377E000": {
        "name": "LITTLE PART 1 CAFE",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE14I29V000": {
        "name": "Lingzhi Greens",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "CE14M79V000": {
        "name": "Little Farms Valley Point Cafe",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE15820B000": {
        "name": "LINO",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE17880E000": {
        "name": "LINKEDIN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18E68V000": {
        "name": "LINJI TRADING",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18Q69L000": {
        "name": "Little Spoon",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE20C84V000": {
        "name": "LINJI cafe",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE20I94B000": {
        "name": "Ling Hui Delights",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE21478L000": {
        "name": "LITTLE EASY BISTRO",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE21Q43P000": {
        "name": "Little Barn",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE21T37A000": {
        "name": "LINKEDIN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE22776L000": {
        "name": "Ling's Patisseries",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24325V000": {
        "name": "LITTLE PRINCE NASI LEMAK",
        "hours": "07:30\u201320:00 (Daily)",
        "cuisine": "Malay / Indonesian",
        "menu_price": "Signature: Aromatic Coconut Nasi Lemak with Ayam Goreng Berempah | Menu: Nasi Lemak Kukus with Fried Chicken, Ayam Penyet with Sambal Terasi, Beef Rendang Set, Mee Rebus, Sayur Lodeh | Price: S$4.50\u2013S$8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "CE24J99C000": {
        "name": "LITTLE RITUALS",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E01023J000": {
        "name": "little vietnam",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E45084V000": {
        "name": "Lion City Chicken Rice & Hotpot",
        "hours": "11:00\u201321:30 (Daily)",
        "cuisine": "Singaporean / Western",
        "menu_price": "Signature: Crispy Prawn Paste Chicken Wings Set | Menu: Har Cheong Gai Chicken Wings (4 pcs), Fragrant Chicken Rice Set, French Fries with Cheese Dip, Spring Chicken | Price: S$5.50\u2013S$11.50",
        "halal": "No",
        "vegan": "No"
    },
    "E45245K001": {
        "name": "LING HAN MEE",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "E58014V000": {
        "name": "LINJI EATING HOUSE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E58014V001": {
        "name": "Linji Eating House",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E74033V003": {
        "name": "LING JI HANDMADE YONG TAU FOO",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "ML201118002": {
        "name": "Lion City Teo Chew Kway Teow Soup",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "NE08064V006": {
        "name": "LING HEQIN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE13P38N000": {
        "name": "LITTLE TOKIO",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE21J70B000": {
        "name": "Little little little kitchen",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S79151B004": {
        "name": "LITTLE PRINCE NASI LEMAK",
        "hours": "07:30\u201320:00 (Daily)",
        "cuisine": "Malay / Indonesian",
        "menu_price": "Signature: Aromatic Coconut Nasi Lemak with Ayam Goreng Berempah | Menu: Nasi Lemak Kukus with Fried Chicken, Ayam Penyet with Sambal Terasi, Beef Rendang Set, Mee Rebus, Sayur Lodeh | Price: S$4.50\u2013S$8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "SE07097L000": {
        "name": "LITTLE NOLA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE21A41A000": {
        "name": "LITTLE ITALY SALUMERIA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW15E28A000": {
        "name": "Little Glass",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW23K74K000": {
        "name": "Little Island Brewing Co.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW25G63P000": {
        "name": "LittleBitesSg",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W03155C000": {
        "name": "Lira Resto Bar",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W46017B000": {
        "name": "LITTLE ELEPHANT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W46017B002": {
        "name": "Little Elephant Thai Food",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W46017B003": {
        "name": "LITTLE ELEPHANT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W79165P000": {
        "name": "LING ZHI VEGETARIAN RESTAURANT",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "W85287L000": {
        "name": "Liquid Alchemy",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W93095N000": {
        "name": "LIT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W97151A000": {
        "name": "LITTLE SAIGON",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W97433J000": {
        "name": "LION BREWERY CO",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
}
