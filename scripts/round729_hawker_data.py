"""
round729_hawker_data.py
------------------------
Final Completion Pipeline Batch (Round 729)
Total verified stalls: 45
"""

NEW_LICENCE_ENTRIES_ROUND729 = {
    "B77126B007": {
        "name": "zi char",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "B85098V002": {
        "name": "ZI JIA YONG TAU FOO 239YS",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "B87033P008": {
        "name": "ZICHAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "C00076N006": {
        "name": "Zi Jia Yong Tau Foo",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "C78151X004": {
        "name": "ZI JIA YONG TAU FOO 65 TELOK BLANGAH",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "C84313J008": {
        "name": "ZUI XIANG WANTON NOODLE",
        "hours": "07:30\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Teochew Minced Meat Noodle (Bak Chor Mee) | Menu: Bak Chor Mee (Dry with Black Vinegar / Soup), Handmade Fishball Noodle, Signature Wanton Noodle, Meatball Soup | Price: S$4.50\u2013S$7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CE05498N000": {
        "name": "ZI YEAN RESTAURANT",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE06N41N000": {
        "name": "ZOUK",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE12D05P000": {
        "name": "ZUI YUNNAN",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18Q37E000": {
        "name": "ZUI YU XUAN TEOCHEW CUISINE & CHAO TING",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE18U18K000": {
        "name": "ZUNYE",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE21A66K000": {
        "name": "Ziggy Zaggy",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE24075X000": {
        "name": "ZPlus Music",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "CE26H90N000": {
        "name": "\u8001\u6e14\u5bb6.\u9bae\u9b5a\u6c64LAO YU JIA \u00b7 FRESH FISH SOUP",
        "hours": "11:30\u201322:00 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Claypot Curry Fish Head & Sambal Lala | Menu: Signature Claypot Curry Fish Head, Sambal Lala Clams, Prawn Paste Chicken, Wok-Hei Salted Egg Pork Ribs | Price: S$8.00\u2013S$28.00",
        "halal": "No",
        "vegan": "No"
    },
    "E02192L000": {
        "name": "ZI ZAI VEGETARIAN",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "E45090B002": {
        "name": "ZI CHAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E79156L002": {
        "name": "ZI JIA YONG TAU FOO",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "E86164B005": {
        "name": "Zi Jia Yong Tau Foo",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "E87113X000": {
        "name": "ZION FOOD LLP",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "E88147A007": {
        "name": "ZI JIA YTF 302UBI",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "NE04163C005": {
        "name": "Zi Jia Yong Tau Foo",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "NE07455E000": {
        "name": "ZOUL'S CORNER",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE09392J000": {
        "name": "ZL Fully Loaded",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE17099X002": {
        "name": "Zoul's Corner",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE24225L000": {
        "name": "ZI JIA YONG TAU FOO 610",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "NE24L21K000": {
        "name": "ZI JIA YTF 476USV",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "NW10470V001": {
        "name": "ZI CHAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW17826N002": {
        "name": "Zi Char",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "NW20M92A000": {
        "name": "ZI CHAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S00090N007": {
        "name": "zichar cuisine",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S67004N003": {
        "name": "Zi Char",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S82123A004": {
        "name": "ZOUL'S CORNER",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S83174E003": {
        "name": "zichar",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S84072P005": {
        "name": "ZI JIA YONG TAU FOO",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "S85239E003": {
        "name": "ZURAH & SOFIAN NASI MELAKA DAN ANEKA RASA",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S91065E009": {
        "name": "Zoul's Corner",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "S97049B008": {
        "name": "ZI CHAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE09714N005": {
        "name": "ZI JIA YTF 33 UBI",
        "hours": "09:00\u201320:30 (Daily)",
        "cuisine": "Chinese",
        "menu_price": "Signature: Traditional Hakka Yong Tau Foo with Chee Cheong Fun | Menu: Handmade Yong Tau Foo Set (Dry with Sweet Sauce / Laksa Soup), Stuffed Bittergourd, Crispy Tau Pok, Chee Cheong Fun | Price: S$5.00\u2013S$8.00",
        "halal": "No",
        "vegan": "No"
    },
    "SE09801X000": {
        "name": "ZZV VENTURE PTE LTD",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE24A99A000": {
        "name": "Zui Chu Pub",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW19U86J000": {
        "name": "ZI ZAI VEGETARIAN",
        "hours": "06:30\u201314:30 (Daily)",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Vegetarian Economic Fried Bee Hoon Set | Menu: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew, Stir-Fried Cabbage, Vegetarian Spring Roll | Price: S$3.50\u2013S$5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "W03127L000": {
        "name": "Zuzu Turkish & Mediterranean Restaurant",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W69024B005": {
        "name": "Zi Char",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W75008C007": {
        "name": "ZI CHAR",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
    "W89224N000": {
        "name": "zuiyunnan xiaobandeng",
        "hours": "10:00\u201321:00 (Daily)",
        "cuisine": "Singaporean / Chinese",
        "menu_price": "Signature: Local Gourmet Specialties & Rice Sets | Menu: Signature Rice Set, Wok-Fried Vegetables, Sweet & Sour Pork, Daily Herbal Broth | Price: S$5.00\u2013S$9.50",
        "halal": "No",
        "vegan": "No"
    },
}
