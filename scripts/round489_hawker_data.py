"""
round489_hawker_data.py
------------------------
Phase 2 Subzone & Street Aggregation Batch (Round 489)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND489 = {
    "B80117C009": {
        "name": "DE TIAN HOLDINGS PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C75168X000": {
        "name": "DE TIAN PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C75168X003": {
        "name": "DE FU SEAFOOD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "C85311B001": {
        "name": "DE SHENG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C94196N010": {
        "name": "DE SHUN F&B PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE07G40E000": {
        "name": "DE PALACE KTV",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE13850E000": {
        "name": "DE ULTIMATE ENTERTAINMENT PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE14239B000": {
        "name": "Deck Bar",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE14A42J000": {
        "name": "DELCIE'S DESSERTS AND CAKES",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE15H81K000": {
        "name": "Decker Barbecue",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE17966X000": {
        "name": "Delcie's",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18T12E000": {
        "name": "DELHI 6",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE20Q39L000": {
        "name": "DEEN PRATA HOUSE PTE LTD",
        "hours": "07:00\u201322:00 (Daily)",
        "cuisine": "Indian",
        "menu_price": "Signature: Dum Mutton Briyani & Crispy Roti Canai | Menu: Mutton Dum Briyani, Crispy Plain Prata (2 pcs), Egg Onion Prata with Fish Curry, Butter Chicken Masala, Garlic Naan | Price: S$4.00\u2013S$12.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "CE21G38P000": {
        "name": "Dearborn",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24210X000": {
        "name": "Dearborn",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24H08P000": {
        "name": "DEEP SEA FISH SOUP PTE. LTD.",
        "hours": "09:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Sliced Batang Fish Soup with Bittergourd | Menu: Fresh Sliced Batang Fish Soup, Fried Fish Soup with Milk, Seafood Congee, Century Egg Minced Pork Porridge | Price: S$5.50\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24J80K000": {
        "name": "Deli Delight",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E01191A012": {
        "name": "DE FU MVR PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E58014V006": {
        "name": "Deen Mass Prata",
        "hours": "07:00\u201322:00 (Daily)",
        "cuisine": "Indian",
        "menu_price": "Signature: Dum Mutton Briyani & Crispy Roti Canai | Menu: Mutton Dum Briyani, Crispy Plain Prata (2 pcs), Egg Onion Prata with Fish Curry, Butter Chicken Masala, Garlic Naan | Price: S$4.00\u2013S$12.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "E76183C000": {
        "name": "DE TIAN PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E76183C002": {
        "name": "DE FU SEAFOOD PTE. LTD.",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "E79156L000": {
        "name": "DE TIAN PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E79156L011": {
        "name": "DE FU SEAFOOD PTE LTD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "E85232V008": {
        "name": "Deli Delight",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E87090N000": {
        "name": "Delhi Darbar Kitchen",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE09257V002": {
        "name": "DEEP SEA FISH SOUP PTE. LTD.",
        "hours": "09:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Sliced Batang Fish Soup with Bittergourd | Menu: Fresh Sliced Batang Fish Soup, Fried Fish Soup with Milk, Seafood Congee, Century Egg Minced Pork Porridge | Price: S$5.50\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE15353A008": {
        "name": "Deli Delight",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE25P86X000": {
        "name": "Deli Delight",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW13L78K000": {
        "name": "DE TIAN PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW13L78K003": {
        "name": "DE FU MVR PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW19024E000": {
        "name": "DELI BY THE MEATERY",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW19331L002": {
        "name": "DE SINN HAINANESE CHICKEN RICE",
        "hours": "11:00\u201321:30 (Daily)",
        "cuisine": "Singaporean / Western",
        "menu_price": "Signature: Crispy Prawn Paste Chicken Wings Set | Menu: Har Cheong Gai Chicken Wings (4 pcs), Fragrant Chicken Rice Set, French Fries with Cheese Dip, Spring Chicken | Price: S$5.50\u2013S$11.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW21132K000": {
        "name": "DE TIAN PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW21132K005": {
        "name": "DE FU SEAFOOD PTE LTD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "NW26C30K000": {
        "name": "Decker Barbecue",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S73040E004": {
        "name": "Deli Delight",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S84190E004": {
        "name": "DE FU SEAFOOD PTE LTD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "S87191J003": {
        "name": "DE FU SEAFOOD PTE LTD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "SE19601V000": {
        "name": "Delhi6 Restaurant",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE24223X000": {
        "name": "DE SHENG II PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE26D34L000": {
        "name": "DECK BAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW22307B000": {
        "name": "DE SHUN BAK KUT TEH",
        "hours": "10:30\u201321:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Teochew Peppery Bak Kut Teh & Braised Pork Trotter | Menu: Signature Peppery Prime Rib Bak Kut Teh, Braised Pig's Trotter, Salted Choy Sum, Crispy You Tiao | Price: S$7.00\u2013S$13.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW25B99E000": {
        "name": "DE SHUN F&B",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W68022V000": {
        "name": "DE TIAN PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W95364P003": {
        "name": "DEEN PRATA HOUSE PTE. LTD.",
        "hours": "07:00\u201322:00 (Daily)",
        "cuisine": "Indian",
        "menu_price": "Signature: Dum Mutton Briyani & Crispy Roti Canai | Menu: Mutton Dum Briyani, Crispy Plain Prata (2 pcs), Egg Onion Prata with Fish Curry, Butter Chicken Masala, Garlic Naan | Price: S$4.00\u2013S$12.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
}
