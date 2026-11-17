"""
round630_hawker_data.py
------------------------
Final Completion Pipeline Batch (Round 630)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND630 = {
    "C89085N000": {
        "name": "Poh & Ann Eating House",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C89085N001": {
        "name": "Poh & Ann Eating House",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE04201X000": {
        "name": "Poh Guan Bakery",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE06684E000": {
        "name": "POCHA! KOREAN STREET DINING",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Korean",
        "menu_price": "Signature: Hot Stone Bibimbap & Kimchi Pork Stew | Menu: Dolsot Beef Bibimbap, Kimchi Jjigae Set, Crispy Seafood Pajeon, Korean Fried Chicken (Soy Garlic) | Price: S$8.50\u2013S$19.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE07498V000": {
        "name": "Poh Cheu Kitchen",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE07Q30P000": {
        "name": "Pink Guava",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE07Q38A000": {
        "name": "PocoLoco",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE08345A000": {
        "name": "PLUME",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE12A30K000": {
        "name": "PLUME",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE12T54L000": {
        "name": "PITA BAKERY",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE13619P000": {
        "name": "PIZZA STUDIO TAMAKI",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE13X78J000": {
        "name": "PLATE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE15B67V000": {
        "name": "PIXIE SG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE16K79P000": {
        "name": "PLATFORM 1094",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE16M07N000": {
        "name": "Po",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18097E000": {
        "name": "Pocket by Flip Coffee Roasters",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE19238J000": {
        "name": "PIPING HOT PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE22389C000": {
        "name": "PIZZA",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE22A57C000": {
        "name": "PLANET MELMAC CHICK 'N CHIPS",
        "hours": "11:00\u201321:30 (Daily)",
        "cuisine": "Singaporean / Western",
        "menu_price": "Signature: Crispy Prawn Paste Chicken Wings Set | Menu: Har Cheong Gai Chicken Wings (4 pcs), Fragrant Chicken Rice Set, French Fries with Cheese Dip, Spring Chicken | Price: S$5.50\u2013S$11.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24462C000": {
        "name": "POA Exclusive",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24G49J000": {
        "name": "PLATE & PALETTE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24M59J000": {
        "name": "PIXIE DUST",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE26011L000": {
        "name": "Pizzaboxx",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "E01147J000": {
        "name": "PINWEI MALA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E50003X000": {
        "name": "PL0526 PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E50003X001": {
        "name": "PL0526 PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E70013P002": {
        "name": "PINWEI",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E77119E008": {
        "name": "Planet Bakso",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E79165L014": {
        "name": "PINWEI",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "J02045E000": {
        "name": "Pinxin catering",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "J97040X003": {
        "name": "PLANET BAKSO SAMBAL BAKAR",
        "hours": "07:30\u201320:00 (Daily)",
        "cuisine": "Malay / Indonesian",
        "menu_price": "Signature: Aromatic Coconut Nasi Lemak with Ayam Goreng Berempah | Menu: Nasi Lemak Kukus with Fried Chicken, Ayam Penyet with Sambal Terasi, Beef Rendang Set, Mee Rebus, Sayur Lodeh | Price: S$4.50\u2013S$8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "NE12J50A000": {
        "name": "Pizza D'France",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "NE26043C000": {
        "name": "Pizza Nation",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "S67023J002": {
        "name": "Poh Boon Guan",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE22C50C000": {
        "name": "PITCHSIDE SOCIAL",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE25A54X000": {
        "name": "PITCH & OCHE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW04150L000": {
        "name": "PIONEER FOOD COURT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W01038E000": {
        "name": "Plama",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W01436J003": {
        "name": "POH CHER TIAN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W80174J001": {
        "name": "Poh Cheu Kitchen",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W80174J002": {
        "name": "Poh Cheu Kitchen",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W95330X000": {
        "name": "Plu Thai Restaurant",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W96275J000": {
        "name": "PITA TREE MEDITERRANEAN GRILLED KEBABS",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "W99410E000": {
        "name": "place 2 read",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W99412B000": {
        "name": "PIXY BAR & CUISINE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
}
