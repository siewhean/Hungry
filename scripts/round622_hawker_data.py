"""
round622_hawker_data.py
------------------------
Final Completion Pipeline Batch (Round 622)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND622 = {
    "B87058V005": {
        "name": "One Ocean",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "B95038L011": {
        "name": "ong wai kwong",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C85315K002": {
        "name": "Ong Lok Lok",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C90090P000": {
        "name": "One Thing Kids Cafe",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE09649K000": {
        "name": "ONLY ONE3",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE10E52L006": {
        "name": "OOH LA LA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE11370A000": {
        "name": "OOPEN PASTA AND GRILL RESTAURANT",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE11I82L000": {
        "name": "OPEN DOOR POLICY PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE15793X000": {
        "name": "OPENFIELDS PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18620L000": {
        "name": "ONG POH SING",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE19Y59E000": {
        "name": "Onori",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE22G39E000": {
        "name": "Opensourced",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE23525P000": {
        "name": "Open Secret",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24280L000": {
        "name": "OPAH SATAY",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24B22L000": {
        "name": "ONI FOODS",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E03026J004": {
        "name": "One Pot",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E84090N001": {
        "name": "ONG THIAM SENG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E85223P001": {
        "name": "ONG CHOW KEONG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E93128L000": {
        "name": "ONE.85 Big Prawn Mee",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "E98087E000": {
        "name": "ONG I TING",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "J86046B004": {
        "name": "ONG HWEE CHENG",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE25073A000": {
        "name": "One Way Beer Garden",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE26894A000": {
        "name": "One Palate",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW21636P000": {
        "name": "Oops Bistro Cafe",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "NW22524A000": {
        "name": "ONG KEE SEAFOOD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "NW22G12J000": {
        "name": "ONE OCEAN PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S00105L000": {
        "name": "ONG LEE KEOW",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S76025B003": {
        "name": "ONG YEOW WEE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S82080K009": {
        "name": "Orange Roaster",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "S97157X000": {
        "name": "One18 Bakery",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "SE04131A000": {
        "name": "ONZ 24 Seven Eatery by Bijan",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE08155X000": {
        "name": "ONWARD HOSPITALITY PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE10421J000": {
        "name": "ONI KIMBAP",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE13V93K000": {
        "name": "ONG SONG KWAN LLP",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE24440C000": {
        "name": "ONE PALATE PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW08B77J000": {
        "name": "One Thing Cafe",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "SW21C78A000": {
        "name": "Opah Corner",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW24E40B000": {
        "name": "OOTY DRINKS",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W00278J000": {
        "name": "OOTORI CLUB",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W67037L006": {
        "name": "ONG KWEE SUAN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W73087A000": {
        "name": "ONE NANYANG FOODCOURT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W74101L000": {
        "name": "ORCHARD RENDEZVOUS HOTEL,SINGAPORE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W92272A000": {
        "name": "ORCHARD CAFE",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "W94272B000": {
        "name": "OPUS GRILL RESTURANT",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "W98174A000": {
        "name": "orchard grand court",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
}
