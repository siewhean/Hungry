"""
round505_hawker_data.py
------------------------
Phase 2 Subzone & Street Aggregation Batch (Round 505)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND505 = {
    "B03103B009": {
        "name": "FANG YUAN SEAFOOD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "B03103B010": {
        "name": "Fang Yuan Seafood",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "B80118B009": {
        "name": "FANG FANG FOOD PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "B93005B008": {
        "name": "Famous Hong Kong Style Roasted Delight",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "C79137L007": {
        "name": "Fang Xiang wanton noodle",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "C84316P003": {
        "name": "Famous Hong Kong Style Roasted Delight",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "C89200E011": {
        "name": "Fan Xiang Yuan",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C97142N011": {
        "name": "FAT BELLY WESTERN DELIGHTS",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE09D51B000": {
        "name": "FAT BOY'S",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE15437J000": {
        "name": "Fas",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE19430L000": {
        "name": "FAT B BAKERY",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE19I10B003": {
        "name": "Farhanaa's Cafe",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE19M53A000": {
        "name": "Farhanaa's Cafe",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CE22453A000": {
        "name": "FANGKO HOUSE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE22469E000": {
        "name": "Fat Belly Western Delight",
        "hours": "11:30\u201321:30 (Daily)",
        "cuisine": "Western",
        "menu_price": "Signature: Char-Grilled Chicken Chop & Crispy Fish and Chips | Menu: Grilled Black Pepper Chicken Chop, Crispy Beer-Battered Fish & Chips, Creamy Truffle Carbonara, Beef Bolognese Pasta | Price: S$7.50\u2013S$15.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE23422E000": {
        "name": "Fam Traditional Roasted",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24M34C000": {
        "name": "FAMILY MOOKATA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE26412J000": {
        "name": "Family Hakata",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE26735V000": {
        "name": "Farm Coffee",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "E86191N007": {
        "name": "FAR EAST CHICKEN RICE",
        "hours": "11:00\u201321:30 (Daily)",
        "cuisine": "Singaporean / Western",
        "menu_price": "Signature: Crispy Prawn Paste Chicken Wings Set | Menu: Har Cheong Gai Chicken Wings (4 pcs), Fragrant Chicken Rice Set, French Fries with Cheese Dip, Spring Chicken | Price: S$5.50\u2013S$11.50",
        "halal": "No",
        "vegan": "No"
    },
    "J86046B001": {
        "name": "Fang Lin Vegetarian",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "J86046B002": {
        "name": "Fang Lin Vegetarian",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "J86046B003": {
        "name": "Fang Lin Vegetarian",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "NE05101B000": {
        "name": "FAT BAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE15121E006": {
        "name": "FAM Roasted",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE22635A007": {
        "name": "FAT BABY PRIVATE LIMITED",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE23C94J000": {
        "name": "Famous Hong Kong Style Roasted Delight",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW19Z08X000": {
        "name": "Famous Hong Kong Style Roasted Delight",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW21D23A000": {
        "name": "FAMILY MOOKATA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW22L66C003": {
        "name": "FANG FANG DELIGHT PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW25O61E000": {
        "name": "Fan Lai Le",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW25P17C000": {
        "name": "FANG FANG DELIGHT PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE25G36C000": {
        "name": "Famous Food Court",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW07B86N000": {
        "name": "Fan Ji Noodles",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "SW16105X000": {
        "name": "FAME2 MUSIC & ENTERTAINMENT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW18A58K000": {
        "name": "FAMOUS JB 101 SEAFOOD",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "SW22F15P003": {
        "name": "Fang Delights",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW24L22E000": {
        "name": "Farasha",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW25Q06K000": {
        "name": "FAMILY MOOKATA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW25Q53J000": {
        "name": "Fan Xiang Yuan",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW25Q64B000": {
        "name": "Fan Xiang Yuan",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW26I29C000": {
        "name": "FAT & LEAN GROUP PTE. LTD.",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W02189N000": {
        "name": "FARMERS AND CHEFS",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W64001N000": {
        "name": "FARHANA'S CAFE",
        "hours": "07:30\u201321:00 (Daily)",
        "cuisine": "Cafe & Bakery",
        "menu_price": "Signature: Traditional Nanyang Kopi & Kaya Toast Set | Menu: Hot Kopi-O, Iced Teh-C, Traditional Charcoal Kaya Butter Toast, Soft-Boiled Kampung Eggs, Butter Croissant | Price: S$1.60\u2013S$6.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "W74055V007": {
        "name": "FAM Roasted",
        "hours": "10:00\u201320:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Authentic Hainanese Steamed Chicken Rice | Menu: Steamed Hainanese Chicken Rice, Crispy Roasted Pork Belly (Sio Bak), Honey Glazed Char Siew, Roast Duck Rice | Price: S$4.50\u2013S$7.50",
        "halal": "No",
        "vegan": "No"
    },
}
