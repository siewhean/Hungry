#!/usr/bin/env python3
"""
Round 15 hawker and food court enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers iconic stalls across:
- ABC Brickworks (150006)
- Alexandra Village (150120)
- Bukit Merah View (151115)
- Whampoa Makan Place Blk 90 & 91 (320090 & 320091)
- Tekka Centre (210665)
- People's Park Food Centre (050032)
"""

NEW_LICENCE_ENTRIES_ROUND15 = {
    # ==========================================
    # 1. ABC BRICKWORKS (150006)
    # ==========================================
    "BM501112003": {
        "name": "Jason Penang Cuisine",
        "hours": "Wed–Sun 11:00–14:00, 17:30–20:00; Mon–Tue: Closed",
        "cuisine": "Michelin Bib Gourmand Penang Street Food",
        "menu_price": "Signature: Michelin Bib Gourmand Penang Fried Kway Teow with Duck Egg & Penang Assam Laksa with Mackerel Broth | Menu: Penang Fried Kway Teow (Chicken / Duck Egg), Penang Assam Laksa, Penang Prawn Noodle, Penang Chee Cheong Fun | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "BM50152003": {
        "name": "Fatty Cheong",
        "hours": "Fri–Wed 11:00–19:30; Thu: Closed",
        "cuisine": "Heritage Hong Kong Roast Meats & Bu Jian Tian Char Siew",
        "menu_price": "Signature: Famous Caramelized Bu Jian Tian (Armpit Cut) Char Siew, Crispy Roast Pork Belly & Roast Duck Rice | Menu: Char Siew Rice, Roast Pork Rice, Roast Duck Rice, Wanton Noodle, Roast Meat Platter | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9882 4849"
    },
    "BM50138003": {
        "name": "Yuan Yuan Claypot Rice",
        "hours": "Fri–Mon 16:30–20:30; Tue–Thu: Closed",
        "cuisine": "Traditional Charcoal Claypot Chicken Rice",
        "menu_price": "Signature: Charcoal-Cooked Claypot Chicken Rice with Salted Fish, Lup Cheong & Crispy Rice Crust | Menu: Claypot Chicken Rice (Small / Medium / Large), Extra Salted Fish, Herbal Duck Soup | Price: SGD 10.00–25.00",
        "halal": "No",
        "vegan": "No"
    },
    "BM501110004": {
        "name": "Heng Kee Hainanese Curry Rice",
        "hours": "Mon–Fri 10:30–14:30; Sat–Sun: Closed",
        "cuisine": "Hainanese Curry Rice",
        "menu_price": "Signature: Crispy Hainanese Pork Chop Curry Rice with Braised Cabbage & Braised Pork Belly Gravy | Menu: Hainanese Curry Rice, Crispy Pork Chop, Braised Cabbage, Curry Squid, Fried Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM50110003": {
        "name": "Y.R Ahmad Roti Prata . Indian Rojak",
        "hours": "Fri–Wed 10:00–19:00; Thu: Closed",
        "cuisine": "Michelin Selected Halal Indian Muslim Roti Prata & Murtabak",
        "menu_price": "Signature: Michelin Selected Crispy Coin Prata, Mutton Murtabak & Crispy Indian Rojak with Sweet Peanut Dip | Menu: Plain Prata, Egg Prata, Coin Prata, Cheese Prata, Mutton Murtabak, Indian Rojak Platter | Price: SGD 1.50–8.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "BM50111004": {
        "name": "Mohd Zaid (Kueh Mueh)",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Halal Traditional Malay Handmade Kueh & Fritters",
        "menu_price": "Signature: Crispy Goreng Pisang (Fried Banana), Curry Puffs, Epok Epok, Kuih Dadar, Jemput-Jemput & Ondeh Ondeh | Menu: Goreng Pisang, Curry Puff, Sardine Puff, Kuih Lapis, Kuih Keria, Jemput-Jemput | Price: SGD 0.80–2.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "BM501101003": {
        "name": "Heng Heng Hot & Cold Dessert",
        "hours": "Wed–Mon 16:00–00:00; Tue: Closed",
        "cuisine": "Traditional Chinese Hot & Cold Desserts",
        "menu_price": "Signature: Traditional Chendol, Ice Kachang, Cheng Tng, Gingko Nut Barley & Tau Suan | Menu: Ice Kachang, Chendol, Mango Ice, Cheng Tng, Tau Suan with You Tiao, Red Bean Soup | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "BM50101004": {
        "name": "Ayam Bakar by Abang Botak",
        "hours": "Mon–Sat 09:00–21:00; Sun: Closed",
        "cuisine": "Halal Indonesian Charcoal Grilled Ayam Bakar & Nasi Padang",
        "menu_price": "Signature: Smoky Charcoal-Grilled Indonesian Ayam Bakar with Sweet Kecap Manis & Sambal Terasi | Menu: Ayam Bakar Set, Ayam Penyet Set, Ikan Bakar, Nasi Goreng, Tahu Tempe | Price: SGD 5.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "BM501114003": {
        "name": "Fu Yuan Vegetarian",
        "hours": "Mon–Fri 06:00–14:00; Sat 06:00–13:00; Sun 06:00–11:30",
        "cuisine": "Vegetarian & Vegan Chinese Hawker Food",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon with Crispy Zai Er, Sweet Mock Char Siew & Cabbage | Menu: Economical Bee Hoon, Vegetarian Lor Mee, Vegetarian Laksa, Mock Duck Rice | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "BM501115003": {
        "name": "Chinatown Beef King",
        "hours": "Thu–Tue 11:00–21:00; Wed: Closed",
        "cuisine": "Traditional Hainanese Beef Noodles & Braised Beef Brisket",
        "menu_price": "Signature: Fragrant Thick Gravy Beef Noodles with Tender Braised Beef Brisket, Beef Slices & Beef Balls | Menu: Beef Brisket Noodle (Dry / Soup), Sliced Beef Noodle, Beef Ball Soup, Mixed Beef Noodle | Price: SGD 6.00–9.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 2. ALEXANDRA VILLAGE (150120)
    # ==========================================
    "BM20177003": {
        "name": "Xiang Jiang Soya Sauce Chicken",
        "hours": "Wed–Sun 08:00–14:00; Mon–Tue: Closed",
        "cuisine": "Cantonese Soya Sauce Chicken & Roasted Meats",
        "menu_price": "Signature: Fragrant Soya Sauce Chicken Noodle with Springy Egg Noodles & Glazed Roast Pork Belly | Menu: Soya Sauce Chicken Rice, Soya Sauce Chicken Noodle, Roast Pork Noodle, Char Siew Noodle | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM20151003": {
        "name": "Hong Kong Yummy Soup",
        "hours": "Mon–Fri 12:00–14:30, 15:15–20:30; Sat–Sun: Closed",
        "cuisine": "Michelin Bib Gourmand Cantonese Double-Boiled Herbal Soup",
        "menu_price": "Signature: Michelin Bib Gourmand Spareribs Soup with Cordyceps Flower, Night-Blooming Cereus Spareribs Soup & Apple Snow Pear Pork Ribs Soup | Menu: Cordyceps Flower Spareribs Soup, Pepper Pig Stomach Soup, Apple Snow Pear Spareribs Soup, Pumpkin Rice | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM20109002": {
        "name": "Dover Road Kai Kee Wanton Noodles",
        "hours": "Wed–Mon 07:00–15:30; Tue: Closed",
        "cuisine": "Heritage Traditional Wanton Noodle",
        "menu_price": "Signature: Heritage Springy Wanton Noodles with Char Siew, Boiled Wantons & Fried Wantons | Menu: Wanton Noodle (Dry / Soup), Dumpling Noodle, Shredded Chicken Hor Fun, Fried Wanton Platter | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM20152003": {
        "name": "Old Punggol Satay",
        "hours": "Mon–Fri 16:00–20:30; Sat–Sun 12:00–20:30",
        "cuisine": "Hainanese Pork Satay & Chicken Satay",
        "menu_price": "Signature: Heritage Hainanese Charcoal-Grilled Pork Satay with Pineapple Peanut Gravy & Ketupat | Menu: Pork Satay, Chicken Satay, Mutton Satay, Ketupat, Pineapple Peanut Sauce | Price: SGD 0.80–1.00 per stick (min 10 sticks)",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9676 0044"
    },
    "BM20173003": {
        "name": "Green Grass Garden (Grass Jelly)",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Traditional Herbal Grass Jelly & Chinese Desserts",
        "menu_price": "Signature: Handmade Herbal Chin Chow (Grass Jelly) with Sea Coconut, Longan, Attap Chee & Calamansi | Menu: Grass Jelly with Longan, Grass Jelly with Sea Coconut, Almond Jelly, Bird's Nest Chin Chow | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "BM20181002": {
        "name": "Lucky Vegetarian Food",
        "hours": "Sun–Fri 07:00–15:00; Sat: Closed",
        "cuisine": "Vegetarian & Vegan Chinese Hawker Food",
        "menu_price": "Signature: Vegetarian Economical Bee Hoon with Crispy Zai Er, Sweet Mock Char Siew & Cabbage | Menu: Vegetarian Bee Hoon, Vegetarian Lor Mee, Vegetarian Laksa, Vegetarian Chicken Rice | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "BM20115002": {
        "name": "Zi Jin Cheng Hainanese Boneless Chicken Rice",
        "hours": "Wed–Sat 10:30–14:30; Sun–Tue: Closed",
        "cuisine": "Michelin Recommended Hainanese Steamed & Roasted Chicken Rice",
        "menu_price": "Signature: Silky Steamed Boneless Chicken Rice with Fragrant Chicken Broth Rice, Chilli Sauce & Ginger Dip | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg, Bean Sprouts | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM20113004": {
        "name": "Chef Goo Red Sea Prawns Fried Hokkien Mee",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Fried Hokkien Mee with Wild Red Sea Prawns",
        "menu_price": "Signature: Wok Hei Fried Hokkien Mee with Wild Red Sea Prawns, Squid & Crispy Pork Lard | Menu: Red Sea Prawn Fried Hokkien Mee (Small / Medium / Large), Extra Prawns, Extra Lard | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9771 9772"
    },

    # ==========================================
    # 3. BUKIT MERAH VIEW (151115)
    # ==========================================
    "BM30156003": {
        "name": "Yong Chun Wan Ton Noodle",
        "hours": "Thu–Sun 05:30–12:30; Mon–Wed: Closed",
        "cuisine": "Michelin Bib Gourmand Traditional Wanton Mee",
        "menu_price": "Signature: Michelin Bib Gourmand Springy Egg Noodles with Tender Char Siew & Water Chestnut Pork Wantons | Menu: Wanton Noodle (Dry / Soup), Dumpling Noodle, Shredded Chicken Noodle, Fried Wanton | Price: SGD 3.50–5.00",
        "halal": "No",
        "vegan": "No"
    },
    "BM30137003": {
        "name": "Bukit Merah View Carrot Cake",
        "hours": "Daily 07:00–14:00, 16:30–01:30",
        "cuisine": "Heritage Handmade Black & White Fried Carrot Cake",
        "menu_price": "Signature: Handmade Radish Cake Fried with Sweet Dark Sauce, Chye Poh & Crispy Eggs | Menu: White Carrot Cake, Black Carrot Cake, Yuan Yang Carrot Cake | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "BM30171002": {
        "name": "71 Lor Mee",
        "hours": "Wed–Sun 06:00–13:00; Mon–Tue: Closed",
        "cuisine": "Traditional Lor Mee",
        "menu_price": "Signature: Fragrant Starchy Gravy Lor Mee with Crispy Fried Fish, Braised Pork Belly & Half Egg | Menu: Traditional Lor Mee, Fried Fish Lor Mee, Braised Pork Lor Mee | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30162003": {
        "name": "Cai Mao Fried Kway Teow (Bukit Merah View Hawker Centre)",
        "hours": "Tue–Sun 09:30–17:00; Mon: Closed",
        "cuisine": "Old-School Charcoal-Style Char Kway Teow",
        "menu_price": "Signature: Wok Hei Rich Char Kway Teow with Fresh Cockles, Lup Cheong, Fish Cake & Crispy Pork Lard | Menu: Fried Kway Teow (Small / Medium / Large), Extra Cockles | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30145004": {
        "name": "Bukit Merah View Fishball Minced Meat Noodle",
        "hours": "Wed–Mon 06:30–14:30; Tue: Closed",
        "cuisine": "Teochew Fishball & Bak Chor Mee",
        "menu_price": "Signature: Springy Handmade Fishballs, Fish Cake & Minced Meat Noodle in Spicy Vinegar Sauce | Menu: Fishball Noodle (Dry / Soup), Bak Chor Mee, Fish Dumpling Soup, Meatball Noodle | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30126004": {
        "name": "XING JI FRIED HOKKIEN NOODLE",
        "hours": "Tue–Sun 11:00–21:30; Mon: Closed",
        "cuisine": "Wok Hei Fried Hokkien Prawn Mee",
        "menu_price": "Signature: Wok Hei Fried Hokkien Prawn Noodle with Rich Prawn Stock, Pork Belly, Squid & Sambal | Menu: Fried Hokkien Prawn Mee (Small / Medium / Large), Extra Pork Lard, Extra Prawns | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 4. WHAMPOA MAKAN PLACE BLK 90 & 91 (320090 & 320091)
    # ==========================================
    "WD40132001": {
        "name": "Singapore Fried Hokkien Mee",
        "hours": "Fri–Wed 15:30–23:00; Thu: Closed",
        "cuisine": "Michelin Bib Gourmand Fried Hokkien Prawn Mee",
        "menu_price": "Signature: Michelin Bib Gourmand Wok Hei Wet-Style Fried Hokkien Prawn Mee with Pork Belly, Squid & Sambal | Menu: Fried Hokkien Mee (Small / Medium / Large), Extra Prawns, Extra Pork Lard | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD40105001": {
        "name": "Whampoa Banana Leaf (Whampoa Drive)",
        "hours": "Daily 10:00–19:00",
        "cuisine": "Halal Indian Muslim Banana Leaf Rice & Briyani",
        "menu_price": "Signature: Banana Leaf Rice with Chicken Curry, Mutton Masala, Crispy Papadum & Rasam | Menu: Banana Leaf Rice Set, Chicken Briyani, Mutton Briyani, Fried Fish, Vegetable Curry | Price: SGD 5.00–8.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "WD40140001": {
        "name": "Whampoa Traditional Fried Oyster (90 Whampoa Dr)",
        "hours": "Daily 12:00–21:30",
        "cuisine": "Crispy Teochew Fried Oyster Omelette",
        "menu_price": "Signature: Crispy Starchy Fried Oyster Omelette (Orh Luak) with Plump Fresh Oysters & Tangy Chilli | Menu: Fried Oyster Omelette (Small / Medium / Large), Oyster Egg, Fried Carrot Cake | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD40139001": {
        "name": "Swee Traditional Prawn Noodle (90 Whampoa Dr)",
        "hours": "Tue–Sun 06:00–14:00; Mon: Closed",
        "cuisine": "Traditional Prawn Noodle & Pork Ribs Soup",
        "menu_price": "Signature: Traditional Yellow Noodle & Bee Hoon with Wild Prawns & Rich Prawn Pork Broth | Menu: Prawn Noodle (Dry / Soup), Big Prawn Noodle, Pork Ribs Prawn Noodle | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 5. TEKKA CENTRE (210665)
    # ==========================================
    "BF101326003": {
        "name": "545 Whampoa Prawn Noodles",
        "hours": "Mon–Fri 07:00–13:30; Sat–Sun: Closed",
        "cuisine": "Michelin Selected Traditional Prawn Noodles",
        "menu_price": "Signature: Michelin Selected Traditional Prawn Noodle with Rich Umami Prawn Broth & Fresh Ocean Prawns | Menu: Prawn Noodle (Dry / Soup), Pork Ribs Prawn Noodle, Prawn Soup | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "BF101232005": {
        "name": "Allauddin's Briyani Specialist",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Michelin Bib Gourmand Halal South Indian Mutton & Chicken Briyani",
        "menu_price": "Signature: Michelin Bib Gourmand Fragrant Basmati Mutton Briyani, Chicken Briyani & Fish Briyani with Achar & Dalcha | Menu: Mutton Briyani Set, Chicken Briyani Set, Fish Briyani Set, Hard Boiled Egg, Papadum | Price: SGD 6.00–9.00",
        "halal": "Yes",
        "vegan": "No",
        "contact": "+65 6296 6103"
    },
    "BF101258003": {
        "name": "Prata Saga Sambal Berlada",
        "hours": "Daily 07:00–13:00",
        "cuisine": "Halal Crispy Roti Prata with Unique Spicy Sambal",
        "menu_price": "Signature: Crispy Fluffy Roti Prata served with Fiery Homemade Sambal Tumis & Dhal Curry | Menu: Plain Prata, Egg Prata, Onion Prata, Coin Prata, Murtabak, Teh Tarik | Price: SGD 1.30–7.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly",
        "contact": "+65 9069 9507"
    },
    "BF101254003": {
        "name": "Temasek Indian Rojak",
        "hours": "Thu–Tue 09:00–18:30; Wed: Closed",
        "cuisine": "Halal Indian Muslim Rojak Fritters",
        "menu_price": "Signature: Crispy Coconut Fritters, Prawn Fritters, Tahu, Egg, Cuttlefish & Warm Nutty Sweet-Spicy Peanut Sauce | Menu: Indian Rojak Platter (Prawn Vadai, Egg Fritters, Potato, Parpu Vadai, Tempeh, Fish Cake) | Price: SGD 4.00–9.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly",
        "contact": "+65 9187 7750"
    },
    "BF101256002": {
        "name": "Hanifa's Briyani Specialist",
        "hours": "Tue–Sun 07:00–22:00; Mon: Closed",
        "cuisine": "Halal Indian Muslim Dum Briyani",
        "menu_price": "Signature: Aromatic Dum Briyani with Mutton, Chicken Masala, Dalcha & Achar | Menu: Mutton Briyani, Chicken Briyani, Fish Briyani, Beef Rendang, Mutton Korma | Price: SGD 6.00–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "BF101251004": {
        "name": "Ajimer Sharif. Famous Satay Club Mee Goreng",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Halal Indian Muslim Mee Goreng Mamak & Roti John",
        "menu_price": "Signature: Spicy Wok-Fried Indian Mee Goreng Mamak with Mutton, Crispy Cucur Fritters & Roti John Special | Menu: Mee Goreng, Nasi Goreng, Maggi Goreng, Bee Hoon Goreng, Roti John, Sup Tulang | Price: SGD 4.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },

    # ==========================================
    # 6. PEOPLE'S PARK FOOD CENTRE (050032)
    # ==========================================
    "NMF011042003": {
        "name": "Ri Ri Hong Mala Xiang Guo",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Famous Sichuan Mala Xiang Guo (Spicy Stir-Fry Pot)",
        "menu_price": "Signature: Custom Wok-Fried Spicy Numbing Mala Xiang Guo with Lotus Root, Pork Belly, Luncheon Meat & Instant Noodles | Menu: Mala Xiang Guo (Mild / Medium / Extra Spicy), Mala Soup, Vegetables, Meats, Seafood | Price: SGD 6.00–15.00",
        "halal": "No",
        "vegan": "No"
    },
    "NMF011052002": {
        "name": "Ri Ri Hong Mala Xiang Guo",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Famous Sichuan Mala Xiang Guo (Spicy Stir-Fry Pot)",
        "menu_price": "Signature: Custom Wok-Fried Spicy Numbing Mala Xiang Guo with Lotus Root, Pork Belly, Luncheon Meat & Instant Noodles | Menu: Mala Xiang Guo (Mild / Medium / Extra Spicy), Mala Soup, Vegetables, Meats, Seafood | Price: SGD 6.00–15.00",
        "halal": "No",
        "vegan": "No"
    },
    "NMF011066003": {
        "name": "Poy Kee Yong Tau Foo",
        "hours": "Daily 11:00–19:00",
        "cuisine": "Heritage Hakka Handmade Yong Tau Foo",
        "menu_price": "Signature: Handmade Fresh Fish Paste Yong Tau Foo with Bittergourd, Chili, Tau Pok & Springy Yellow Noodles | Menu: Yong Tau Foo Soup, Yong Tau Foo Dry, Fishball Noodle, Bittergourd Soup | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "NMF011022004": {
        "name": "Kim Hua Guan (Bak Kwa)",
        "hours": "Daily 09:00–18:00",
        "cuisine": "Heritage Traditional Charcoal-Grilled Bak Kwa",
        "menu_price": "Signature: Heritage Charcoal-Grilled Minced Pork Bak Kwa, Sliced Pork Bak Kwa & Crispy Pork Floss | Menu: Minced Pork Bak Kwa, Sliced Pork Bak Kwa, Gold Coin Bak Kwa, Crispy Pork Floss | Price: SGD 30.00–60.00/kg",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6535 1064",
        "website": "https://www.khg.com.sg"
    },
    "NMF011104003": {
        "name": "Lek Kee Authentic Teochew Braised Duck",
        "hours": "Mon–Sat 11:00–14:30; Sun: Closed",
        "cuisine": "Michelin Selected Authentic Teochew Braised Duck",
        "menu_price": "Signature: Michelin Selected Traditional Teochew Braised Duck Rice with Braised Tofu, Peanuts, Egg & Herbal Broth | Menu: Braised Duck Rice, Braised Duck Porridge, Braised Duck Kway Teow, Braised Duck Platter | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "NMF011030003": {
        "name": "Lau Chong Kee Mini (Pastries)",
        "hours": "Daily 12:30–20:30",
        "cuisine": "Traditional Cantonese Pastries & Baked Custard Buns",
        "menu_price": "Signature: Famous Mini Custard Buns, Char Siew Sou, Egg Tarts & Coconut Buns | Menu: Mini Custard Bun, Char Siew Pastry, Egg Tart, Wife Cake, Red Bean Pastry | Price: SGD 1.00–2.50",
        "halal": "No",
        "vegan": "No"
    },
    "NMF011008004": {
        "name": "Fortune Food (Homemade Springroll Skin)",
        "hours": "Daily 08:30–18:00",
        "cuisine": "Halal Certified Traditional Handmade Popiah & Springroll Skin",
        "menu_price": "Signature: Fresh Handmade Popiah Skin, Crispy Springrolls, Muah Chee & Kueh Pie Tee | Menu: Fresh Popiah Skin (Pack), Crispy Fried Springrolls, Kueh Pie Tee Cups, Muah Chee | Price: SGD 2.50–8.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly",
        "website": "https://fortunefood.sg"
    }
}
