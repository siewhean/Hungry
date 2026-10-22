#!/usr/bin/env python3
"""
Round 13 hawker and food court enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers iconic stalls across:
- ABC Brickworks (150006)
- Alexandra Village (150120)
- Whampoa Makan Place Blk 90 & 91 (320090 & 320091)
- Bukit Merah View (151115)
- Ghim Moh Market (270020)
- Ang Mo Kio 724 (560724)
- Marine Parade Central (440084)
- Tekka Centre (210665)
- Commonwealth Crescent Blk 31 (149644)
- People's Park Food Centre (050032)
- Food Court multi-outlet stalls (Riverside Indonesian BBQ, Qiu Lian Ban Mian)
"""

NEW_LICENCE_ENTRIES_ROUND13 = {
    # ==========================================
    # 1. ABC BRICKWORKS (150006)
    # ==========================================
    "BM501141002": {
        "name": "Ah Er Soup",
        "hours": "Tue, Thu–Fri 11:00–14:00, 17:00–20:00; Wed, Sat–Sun 16:00–20:00; Mon: Closed",
        "cuisine": "Michelin Bib Gourmand Cantonese Herbal Double-Boiled Soup",
        "menu_price": "Signature: Michelin Bib Gourmand Herbal Chicken Soup with Ginseng, Ten Tonic Ginseng Pork Rib Soup & Lotus Root Peanut Pork Ribs Soup | Menu: Herbal Ginseng Chicken Soup, Ten Tonic Pork Ribs Soup, Buddha Jumps Over the Wall, Watercress Pork Ribs Soup, Pumpkin Rice | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "BM501133003": {
        "name": "Wow Wow West Genuine",
        "hours": "Daily 10:30–14:30, 16:30–20:30",
        "cuisine": "Old School Hainanese Western Food",
        "menu_price": "Signature: Massive Chicken Cutlet, Crispy Fish and Chips & Grilled Pork Chop with Baked Beans | Menu: Chicken Cutlet, Pork Chop, Fish & Chips, Beef Ribeye Steak, Chicken Chop, Cheese Sausage | Price: SGD 7.00–14.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 8068 3133",
        "website": "https://wowwowwest.com"
    },

    # ==========================================
    # 2. ALEXANDRA VILLAGE (150120)
    # ==========================================
    "BM20175003": {
        "name": "Depot Road Zhen Shan Mei Claypot Laksa",
        "hours": "Thu–Tue 09:00–15:00; Wed: Closed",
        "cuisine": "Michelin Bib Gourmand Claypot Laksa",
        "menu_price": "Signature: Michelin Bib Gourmand Thick Coconut Claypot Laksa with Cockles, Prawns & Shredded Chicken | Menu: Claypot Laksa (Small / Medium / Large), Extra Cockles, Extra Tau Pok | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "BM20119002": {
        "name": "Mr Avocado Exotic Fruit Juice",
        "hours": "Tue–Fri 11:30–21:30; Sun 11:30–21:30; Mon & Sat: Closed",
        "cuisine": "Fresh Avocado Shakes & Exotic Fruit Juices",
        "menu_price": "Signature: Famous Thick Creamy Gula Melaka Avocado Shake & Fresh Fruit Juices | Menu: Avocado Juice with Gula Melaka, Avocado with Chocolate, Soursop Juice, Durian Shake | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 3. WHAMPOA MAKAN PLACE BLK 90 & 91 (320090 & 320091)
    # ==========================================
    "WD40106001": {
        "name": "Balestier Road Hoover Rojak",
        "hours": "Wed–Sun 10:00–16:00; Mon–Tue: Closed",
        "cuisine": "Michelin Bib Gourmand Traditional Chinese Rojak",
        "menu_price": "Signature: Michelin Bib Gourmand Traditional Rojak with Century Egg, Cuttlefish & Jellyfish | Menu: Traditional Fruit & Vegetable Rojak, Crispy You Tiao & Tau Pok, Century Egg Rojak | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD40107001": {
        "name": "Liang Zhao Ji Duck Rice",
        "hours": "Wed–Sun 10:30–15:00; Mon–Tue: Closed",
        "cuisine": "Teochew Braised Duck Rice & Porridge",
        "menu_price": "Signature: Fragrant Herbal Braised Duck Rice with Peanuts & Herbal Braised Duck Porridge | Menu: Braised Duck Rice Set, Braised Duck Porridge, Braised Tofu & Hard Boiled Egg, Duck Wings | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD50146001": {
        "name": "Beach Road Fish Head Bee Hoon",
        "hours": "Tue, Thu, Sat–Sun 09:00–14:00; Mon, Wed, Fri: Closed",
        "cuisine": "Michelin Bib Gourmand Fried Fish Head Bee Hoon",
        "menu_price": "Signature: Michelin Bib Gourmand Fried Fish Head Bee Hoon with Evaporated Milk Broth & Sliced Fish Soup | Menu: Fried Fish Head Bee Hoon, Sliced Fish Bee Hoon, Mixed Fish Soup, Fish Porridge | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD50124001": {
        "name": "China Whampoa Home Made Noodles",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Michelin Recommended Handmade Ban Mian",
        "menu_price": "Signature: Handmade Ban Mian Soup with Prawns, Clams & Crispy Ikan Bilis | Menu: Handmade Ban Mian (Dry / Soup), You Mian, Mee Hoon Kway, Abalone Clams Ban Mian | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 4. BUKIT MERAH VIEW (151115)
    # ==========================================
    "BM30151004": {
        "name": "Chai Chuan Tou Yang Rou Tang",
        "hours": "Tue–Sat 11:00–13:30; Sun–Mon: Closed",
        "cuisine": "Michelin Bib Gourmand Teochew Herbal Mutton Soup",
        "menu_price": "Signature: Michelin Bib Gourmand Herbal Mutton Soup (Mutton Meat, Ribs, Tendons & Tripe) | Menu: Mutton Meat Soup, Mutton Ribs Soup, Mutton Tendon Soup, Mutton Tripe Soup | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 5. GHIM MOH MARKET (270020)
    # ==========================================
    "GM20156002": {
        "name": "Hin Fried Horfun With Prawn Beef Sliced Fish",
        "hours": "Tue–Sat 10:00–15:00, 17:00–20:30; Sun 10:30–15:00; Mon: Closed",
        "cuisine": "Cantonese Wok-Hei Fried Hor Fun",
        "menu_price": "Signature: Wok-Hei Sliced Beef Hor Fun, Sliced Fish Mui Fan & Prawn Hor Fun in Silky Egg Gravy | Menu: Beef Hor Fun, Sliced Fish Hor Fun, Prawn Hor Fun, Seafood Mui Fan | Price: SGD 6.00–9.00",
        "halal": "No",
        "vegan": "No"
    },
    "GM20136002": {
        "name": "Thye Hong Handmade Fishball Noodle",
        "hours": "Tue–Wed, Fri–Sun 06:00–11:00; Mon & Thu: Closed",
        "cuisine": "Traditional Handmade Teochew Fishball Noodles",
        "menu_price": "Signature: Traditional Handmade Teochew Fishballs & Fish Cake with Mee Pok / Kway Teow | Menu: Fishball Noodle (Dry/Soup), Fish Cake Noodle, Fishball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 6. ANG MO KIO 724 (560724)
    # ==========================================
    "AM90123003": {
        "name": "Xi Xiang Feng",
        "hours": "Mon–Sat 07:00–19:00; Sun: Closed",
        "cuisine": "Traditional Hakka Yong Tau Foo & Chee Cheong Fun",
        "menu_price": "Signature: Handmade Hakka Yong Tau Foo with Chee Cheong Fun & Sweet Gravy | Menu: Yong Tau Foo (Soup / Dry with Sweet Sauce & Chilli), Chee Cheong Fun, Crispy Fried Meatballs, Stuffed Bittergourd, Tau Pok | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM90105003": {
        "name": "House of Desserts",
        "hours": "Daily 09:30–21:00",
        "cuisine": "Traditional Chinese Hot & Cold Desserts",
        "menu_price": "Signature: Famous Traditional Cheng Tng, Black Sesame Paste & Watermelon Sago | Menu: Traditional Cheng Tng (Hot/Cold), Black Sesame Paste, Tau Suan with You Tiao, Red Bean Soup, Bobo Chacha | Price: SGD 2.00–4.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 7. MARINE PARADE CENTRAL (440084)
    # ==========================================
    "MPC0148001": {
        "name": "FUKUDON",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Modern Japanese Donburi & Rice Bowls",
        "menu_price": "Signature: Pork Belly Donburi, Salmon Mentai Don & Gyu Don (Beef Bowl) | Menu: Pork Belly Don, Salmon Mentai Don, Chicken Teriyaki Don, Gyu Don, Onsen Egg | Price: SGD 6.50–12.00",
        "halal": "No",
        "vegan": "No"
    },
    "MPC0138001": {
        "name": "D'AUTHENTIC MEE REBUS",
        "hours": "Sat–Thu 07:30–14:00; Fri: Closed",
        "cuisine": "Traditional Malay Mee Rebus & Lontong",
        "menu_price": "Signature: Authentic Malay Mee Rebus with Thick Sweet Potato Gravy & Lontong Sayur Lodeh | Menu: Mee Rebus, Mee Siam, Lontong, Begedil, Hard-boiled Egg | Price: SGD 3.50–5.50",
        "halal": "Yes",
        "vegan": "No"
    },

    # ==========================================
    # 8. TEKKA CENTRE (210665)
    # ==========================================
    "BF101231002": {
        "name": "Buni's Tiffin Corner",
        "hours": "Daily 06:30–18:30",
        "cuisine": "South Indian Tiffin & Prata",
        "menu_price": "Signature: Crispy Masala Dosa, Idli Sambar & Medu Vadai | Menu: Plain Dosa, Masala Dosa, Onion Uttapam, Steamed Idli, Medu Vada, Coconut Chutney | Price: SGD 2.50–5.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "BF101236003": {
        "name": "Chettinad Specialist",
        "hours": "Daily 07:00–20:00",
        "cuisine": "Chettinad South Indian Cuisine & Briyani",
        "menu_price": "Signature: Spicy Chettinad Chicken Masala, Mutton Sukka & Fish Curry with Steamed Rice | Menu: Chettinad Chicken Briyani, Mutton Masala, Fish Cutlet, Rasam, Sambar Rice | Price: SGD 4.00–8.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "BF101308002": {
        "name": "308 Yong Tau Foo",
        "hours": "Daily 07:00–14:30",
        "cuisine": "Handmade Hakka Yong Tau Foo",
        "menu_price": "Signature: Handmade Fish Paste Stuffed Beancurd, Bittergourd & Crispy Fried Tau Pok | Menu: Yong Tau Foo (Soup / Dry with Sweet Sauce & Chilli), Chee Cheong Fun, Yellow Noodles, Bee Hoon | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 9. COMMONWEALTH CRESCENT BLK 31 (149644)
    # ==========================================
    "CW3097004": {
        "name": "Kian Meng Kway Chap. Pig's Organ Soup",
        "hours": "Sun–Fri 07:30–14:00; Sat: Closed",
        "cuisine": "Teochew Kway Chap & Pig's Organ Soup",
        "menu_price": "Signature: Traditional Teochew Kway Chap Set & Pig's Organ Soup | Menu: Kway Chap Set (Braised Pork Belly, Tau Pok, Intestines, Egg), Silky Kway Soup, Pig's Organ Soup | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CW3078004": {
        "name": "Seng Kee Chicken Rice",
        "hours": "Tue–Thu, Sat–Sun 07:30–13:15; Mon & Fri: Closed",
        "cuisine": "Traditional Hainanese Chicken Rice",
        "menu_price": "Signature: Traditional Steamed White Chicken Rice & Roasted Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg, Oyster Sauce Vegetables | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "CW3088003": {
        "name": "Jia Yuan Vegetarian Food",
        "hours": "Daily 07:00–14:00",
        "cuisine": "Chinese Vegetarian Bee Hoon & Dishes",
        "menu_price": "Signature: Vegetarian Economical Fried Bee Hoon with Crispy Zha Er, Mock Char Siew & Curry Vegetables | Menu: Vegetarian Fried Bee Hoon, Vegetarian Laksa, Vegetarian Lor Mee, Mock Duck Rice | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },

    # ==========================================
    # 10. PEOPLE'S PARK FOOD CENTRE (050032)
    # ==========================================
    "NMF011114005": {
        "name": "Koo Kee Yong Tow Foo Mee",
        "hours": "Daily 08:00–22:00",
        "cuisine": "Heritage Hakka Yong Tau Foo Noodles",
        "menu_price": "Signature: Heritage Koo Kee Special Noodle & Clear Yong Tau Foo Soup | Menu: Signature Yong Tau Foo Set, Yong Tau Foo Soup, Chee Cheong Fun, Fried Tau Kee, Kang Kong with Cuttlefish | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No",
        "website": "https://gaojifood.com"
    },
    "NMF011012009": {
        "name": "Fatt Soon Kueh",
        "hours": "Tue–Sun 10:00–19:00; Mon: Closed",
        "cuisine": "Traditional Teochew Handmade Soon Kueh",
        "menu_price": "Signature: Traditional Teochew Soon Kueh (Turnip & Dried Shrimp), Ku Cai Kueh (Chives) & Rice Kueh (Peng Kueh) | Menu: Soon Kueh, Ku Cai Kueh, Peng Kueh, Bamboo Shoot Kueh, Steamed Yam Cake | Price: SGD 1.50–2.50 per piece",
        "halal": "No",
        "vegan": "Vegan-friendly",
        "website": "https://fattsoonkueh.com"
    },
    "NMF011010003": {
        "name": "Bee Kim Heng",
        "hours": "Tue–Sun 10:00–17:00; Mon: Closed",
        "cuisine": "Traditional Charcoal Grilled Bak Kwa",
        "menu_price": "Signature: Handcrafted Traditional Charcoal Grilled Sliced Pork Bak Kwa & Minced Pork Bak Kwa | Menu: Sliced Pork Bak Kwa, Minced Pork Bak Kwa, Chilli Pork Bak Kwa, Pork Floss | Price: SGD 30.00–60.00 per kg",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 8852 9921",
        "website": "https://beekimheng.com"
    },
    "NMF011136003": {
        "name": "Amoy Street Fried Oyster",
        "hours": "Tue–Sun 09:00–21:00; Mon: Closed",
        "cuisine": "Traditional Crispy Fried Oyster Omelette",
        "menu_price": "Signature: Crispy Fried Oyster Omelette (Orh Luak) with Plump Oysters & Chilli Sauce | Menu: Fried Oyster Omelette, Oyster Egg, Fried Carrot Cake (Black / White) | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "NMF011110005": {
        "name": "Dong Dong Hainanese Chicken Rice",
        "hours": "Daily 10:00–19:00",
        "cuisine": "Traditional Hainanese Chicken Rice",
        "menu_price": "Signature: Steamed White Chicken Rice, Roasted Chicken Rice & Braised Tofu / Egg | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg, Oyster Sauce Vegetables | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 11. FOOD COURT STALLS (RIVERSIDE INDONESIAN BBQ & QIU LIAN)
    # ==========================================
    "C99161N004": {
        "name": "Riverside Indonesian BBQ",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Halal Indonesian BBQ & Grilled Chicken (Ayam Panggang)",
        "menu_price": "Signature: Famous Indonesian Ayam Panggang (Grilled Chicken) Set with Sweet Black Sauce, Curry Gravy & Omelette | Menu: Ayam Panggang Set, Ikan Panggang (Grilled Fish) Set, Sotong Panggang Set, Curry Rice | Price: SGD 6.80–9.80",
        "halal": "Yes",
        "vegan": "No"
    },
    "NE16576K011": {
        "name": "Riverside Indonesian BBQ",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Halal Indonesian BBQ & Grilled Chicken (Ayam Panggang)",
        "menu_price": "Signature: Famous Indonesian Ayam Panggang (Grilled Chicken) Set with Sweet Black Sauce, Curry Gravy & Omelette | Menu: Ayam Panggang Set, Ikan Panggang (Grilled Fish) Set, Sotong Panggang Set, Curry Rice | Price: SGD 6.80–9.80",
        "halal": "Yes",
        "vegan": "No"
    },
    "SE10643E013": {
        "name": "Riverside Indonesian BBQ",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Halal Indonesian BBQ & Grilled Chicken (Ayam Panggang)",
        "menu_price": "Signature: Famous Indonesian Ayam Panggang (Grilled Chicken) Set with Sweet Black Sauce, Curry Gravy & Omelette | Menu: Ayam Panggang Set, Ikan Panggang (Grilled Fish) Set, Sotong Panggang Set, Curry Rice | Price: SGD 6.80–9.80",
        "halal": "Yes",
        "vegan": "No"
    },
    "SW22F28A000": {
        "name": "Riverside Indonesian BBQ",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Halal Indonesian BBQ & Grilled Chicken (Ayam Panggang)",
        "menu_price": "Signature: Famous Indonesian Ayam Panggang (Grilled Chicken) Set with Sweet Black Sauce, Curry Gravy & Omelette | Menu: Ayam Panggang Set, Ikan Panggang (Grilled Fish) Set, Sotong Panggang Set, Curry Rice | Price: SGD 6.80–9.80",
        "halal": "Yes",
        "vegan": "No"
    },
    "NE09257V010": {
        "name": "Qiu Lian Ban Mian",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Traditional Handmade Ban Mian",
        "menu_price": "Signature: Handmade Ban Mian Soup with Minced Meat, Egg, Ikan Bilis & Chye Sim | Menu: Traditional Ban Mian (Soup/Dry), You Mian, Mee Hoon Kway, Tom Yum Ban Mian | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "NE13O50E000": {
        "name": "Qiu Lian Ban Mian",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Traditional Handmade Ban Mian",
        "menu_price": "Signature: Handmade Ban Mian Soup with Minced Meat, Egg, Ikan Bilis & Chye Sim | Menu: Traditional Ban Mian (Soup/Dry), You Mian, Mee Hoon Kway, Tom Yum Ban Mian | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "SE19914N007": {
        "name": "Qiu Lian Ban Mian",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Traditional Handmade Ban Mian",
        "menu_price": "Signature: Handmade Ban Mian Soup with Minced Meat, Egg, Ikan Bilis & Chye Sim | Menu: Traditional Ban Mian (Soup/Dry), You Mian, Mee Hoon Kway, Tom Yum Ban Mian | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    }
}
