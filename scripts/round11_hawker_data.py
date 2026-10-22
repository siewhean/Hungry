#!/usr/bin/env python3
"""
Round 11 hawker enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers:
- Ang Mo Kio 724 (560724)
- Whampoa Makan Place Blk 90 (320090)
- Whampoa Makan Place Blk 91 (320091)
"""

NEW_LICENCE_ENTRIES_ROUND11 = {
    # ==========================================
    # 1. ANG MO KIO 724 (560724)
    # ==========================================
    "AM90112003": {
        "name": "Centre Satay Beehoon",
        "hours": "Wed–Mon 10:30–20:30; Tue: Closed",
        "cuisine": "Traditional Satay Bee Hoon",
        "menu_price": "Signature: Traditional Satay Bee Hoon with Rich Peanut Gravy | Menu: Satay Bee Hoon with Cuttlefish, Prawns, Pork Slices, Cockles and Kang Kong | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM90102004": {
        "name": "Din family Muslim Food",
        "hours": "Daily 07:00–20:30",
        "cuisine": "Malay Nasi Padang & Lontong",
        "menu_price": "Signature: Traditional Malay Nasi Padang & Lontong Sayur | Menu: Nasi Padang with Beef Rendang, Sambal Goreng, Ayam Masak Merah, Sayur Lodeh, Mee Rebus, Lontong | Price: SGD 4.00–7.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "AM90104003": {
        "name": "AL-ZAMIRA RESTAURANT",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Indian Muslim Prata & Briyani",
        "menu_price": "Signature: Indian Muslim Roti Prata & Briyani | Menu: Crispy Roti Prata, Murtabak (Chicken/Mutton), Mutton Briyani, Mee Goreng, Tulang Merah | Price: SGD 3.00–9.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 2. WHAMPOA MAKAN PLACE BLK 90 (320090)
    # ==========================================
    "WD40114001": {
        "name": "3B-Three Bowls",
        "hours": "Wed–Mon 13:00–21:00; Tue: Closed",
        "cuisine": "Sarawak Kolo Mee",
        "menu_price": "Signature: Authentic Sarawak Kolo Mee by Ex-Din Tai Fung Chef | Menu: Classic Sarawak Kolo Mee (Red / White / Black), Pork Ribs Kolo Mee, Fried Wantons, Wonton Soup | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD40142002": {
        "name": "QINDE Egg Tarts & Pastries",
        "hours": "Daily 09:30–19:00",
        "cuisine": "Hong Kong Pastries & Egg Tarts",
        "menu_price": "Signature: Hong Kong Style Flaky Egg Tarts & Traditional Pastries | Menu: Traditional Egg Tart (Flaky / Cookie Crust), Portuguese Egg Tart, Wife Cake (Lou Po Beng), Char Siew Sou, Lotus Paste Puff | Price: SGD 1.60–2.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 3. WHAMPOA MAKAN PLACE BLK 91 (320091)
    # ==========================================
    "WD50112001": {
        "name": "Heng Kee Cooked Food",
        "hours": "Sat–Wed 05:00–13:30; Thu–Fri: Closed",
        "cuisine": "Hainanese Curry Rice",
        "menu_price": "Signature: Traditional Hainanese Curry Rice & Stewed Pork Belly | Menu: Hainanese Curry Rice with Crispy Pork Chop, Braised Pork Belly, Braised Cabbage, Fried Egg, Tau Pok | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    }
}
