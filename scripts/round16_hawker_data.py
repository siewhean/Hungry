#!/usr/bin/env python3
"""
Round 16 hawker and food court enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers 88 iconic stalls across:
- Ghim Moh Market & Food Centre (270020)
- Clementi 448 Market & Food Centre (120448)
- Whampoa Makan Place Blk 91 (320091)
- Teck Ghee Court Blk 341 (560341)
- Ang Mo Kio Central 724 (560724)
- Marine Parade Central Market & Food Centre (440084)
- Chinatown Complex Food Centre (050335)
"""

NEW_LICENCE_ENTRIES_ROUND16 = {
    # =========================================================================
    # 1. GHIM MOH MARKET & FOOD CENTRE (270020)
    # =========================================================================
    "GM20117002": {
        "name": "Jiu Jiang Shao La (九江燒臘)",
        "hours": "Thu–Sat 09:00–14:00; Sun–Wed: Closed",
        "cuisine": "Cantonese Roast Meats & Roasted Duck",
        "menu_price": "Signature: Roast Duck Rice / Noodle, Crispy Roast Pork Belly & Caramelised Char Siew | Menu: Roast Duck Drumstick Rice, Char Siew Roast Pork Noodle, Wanton Soup, Whole Roast Duck | Price: SGD 4.50–12.00",
        "halal": "No",
        "vegan": "No"
    },
    "GM20152002": {
        "name": "Granny's Pancake (Ghim Moh)",
        "hours": "Tue–Sun 05:30–14:00; Mon: Closed",
        "cuisine": "Traditional Min Jiang Kueh & Peanut Pancakes",
        "menu_price": "Signature: Peanut Min Jiang Kueh, Red Bean Pancake & Coconut Pancake | Menu: Thick Peanut Pancake, Red Bean Paste Pancake, Grated Coconut Pancake, Peanut Butter Pancake | Price: SGD 1.20–1.60",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "GM20129002": {
        "name": "Hock Soon Carrot Cake",
        "hours": "Tue–Sun 06:00–14:00; Mon: Closed",
        "cuisine": "Teochew Fried Carrot Cake",
        "menu_price": "Signature: Crispy White Carrot Cake with Preserved Radish (Chai Poh) & Sweet Black Fried Carrot Cake | Menu: White Carrot Cake, Black Carrot Cake, Yuan Yang (Mixed Black & White) | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "GM20108002": {
        "name": "Hong Sheng Fish Soup",
        "hours": "Daily 10:00–19:30",
        "cuisine": "Teochew Sliced Fish Soup & Seafood Soup",
        "menu_price": "Signature: Fresh Sliced Batang Fish Soup with Bittergourd & Deep Fried Fish Head Soup | Menu: Sliced Fish Bee Hoon, Fried Fish Soup, Seafood Tom Yum Soup, Fish Porridge | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "GM20146002": {
        "name": "Pallakkuoly Prata Power",
        "hours": "Mon–Fri 06:00–14:00; Sat–Sun 06:00–21:45",
        "cuisine": "South Indian Muslim & Crispy Roti Prata",
        "menu_price": "Signature: Crispy Plain Prata, Egg Onion Prata & Mutton Curry | Menu: Plain Prata, Egg Prata, Cheese Prata, Coin Prata, Murtabak (Chicken/Mutton), Masala Thosai | Price: SGD 1.50–8.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "GM20120002": {
        "name": "63 Laksa",
        "hours": "Tue–Fri 08:00–15:00; Sat–Sun 08:00–14:00; Mon: Closed",
        "cuisine": "Traditional Sungei Road Style Laksa",
        "menu_price": "Signature: Charcoal-Cooked Spoon Laksa with Fresh Cockles & Tau Pok | Menu: Laksa (Small / Large), Extra Cockles, Extra Fishcake, Otah | Price: SGD 3.00–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "GM20139002": {
        "name": "Warong Idaman",
        "hours": "Tue–Sun 06:00–14:00; Mon: Closed",
        "cuisine": "Traditional Malay Breakfast & Nasi Padang",
        "menu_price": "Signature: Mee Soto with Begedil, Lontong Sayur Lodeh & Nasi Lemak Kukus | Menu: Mee Rebus, Mee Siam, Nasi Padang (Ayam Rendang, Sambal Goreng, Bergedil) | Price: SGD 3.50–6.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "GM20134002": {
        "name": "Golden Swallow Dessert",
        "hours": "Tue–Sun 12:00–19:00; Mon: Closed",
        "cuisine": "Traditional Hot & Cold Local Desserts",
        "menu_price": "Signature: Ice Kachang with Attap Chee, Chendol & Cheng Tng | Menu: Cheng Tng (Hot/Cold), Tau Suan with You Tiao, Red Bean Soup with Lotus Seeds, Bo Bo Cha Cha | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "GM20135002": {
        "name": "Hock Lye Noodle House",
        "hours": "Mon–Sat 06:30–14:30; Sun: Closed",
        "cuisine": "Teochew Fishball & Minced Meat Noodles",
        "menu_price": "Signature: Bak Chor Mee Pok Dry with Crispy Lard & Handmade Fishball Soup | Menu: Minced Meat Noodle (Mee Pok / Mee Kia), Fishball Kway Teow Soup, Meatball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "GM20144002": {
        "name": "You Zai Heng",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Local Coffee, Tea & Traditional Toast",
        "menu_price": "Signature: Traditional Nanyang Kopi O, Teh C & Kaya Butter Charcoal Toast | Menu: Kopi, Teh, Half-Boiled Eggs (2 pcs), Kaya Butter Toast, French Toast | Price: SGD 1.30–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "GM20149003": {
        "name": "Hai Nan Hometown Curry",
        "hours": "Wed–Mon 10:30–14:30, 17:00–20:00; Tue: Closed",
        "cuisine": "Traditional Hainanese Curry Rice",
        "menu_price": "Signature: Hainanese Crispy Pork Chop with Thick Curry Gravy & Braised Pork Belly (Lor Bak) | Menu: Hainanese Curry Rice Set, Crispy Pork Chop, Chap Chye, Curry Chicken Drumstick, Braised Egg | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "GM20132002": {
        "name": "ThunderBowl (Ghim Moh)",
        "hours": "Tue–Sun 10:30–19:30; Mon: Closed",
        "cuisine": "Hakka Thunder Tea Rice & Healthy Bowls",
        "menu_price": "Signature: Traditional Hakka Thunder Tea Rice (Lei Cha) with Basil Green Tea Broth | Menu: Thunder Tea Rice (White / Brown Rice), Vegetarian Thunder Tea, Hakka Meatball Soup | Price: SGD 5.50–7.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "GM20106002": {
        "name": "Indonie Enak (Ghim Moh)",
        "hours": "Tue–Sun 07:30–14:30; Mon: Closed",
        "cuisine": "Indonesian Muslim Cuisine & Ayam Penyet",
        "menu_price": "Signature: Ayam Penyet with Fiery Sambal Belacan, Tahu & Tempeh | Menu: Ayam Penyet, Ikan Penyet, Nasi Goreng Kampung, Mee Bakso | Price: SGD 5.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "GM20114002": {
        "name": "Alexandra Village Avocado Milkshake Fruit Juice (Ghim Moh)",
        "hours": "Daily 09:30–20:30",
        "cuisine": "Fresh Fruit Juices & Avocado Milkshakes",
        "menu_price": "Signature: Fresh Creamy Avocado Milkshake with Gula Melaka | Menu: Avocado Juice, Dragonfruit Juice, Fresh Soursop, Orange Apple Juice, Watermelon Juice | Price: SGD 3.00–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "GM20101002": {
        "name": "Ice On You (Ghim Moh)",
        "hours": "Daily 11:00–21:00",
        "cuisine": "Shaved Ice Desserts & Local Cold Sweets",
        "menu_price": "Signature: Mango Shaved Snow Ice with Nata de Coco & Milo Godzilla Shaved Ice | Menu: Korean Bingsu Style Shaved Ice, Ice Kachang, Durian Chendol, Grass Jelly Longan | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # =========================================================================
    # 2. CLEMENTI 448 MARKET & FOOD CENTRE (120448)
    # =========================================================================
    "CL30150003": {
        "name": "Soon Lee Porridge (顺利粥品)",
        "hours": "Mon–Fri 06:00–19:30; Sat 06:00–16:00; Sun: Closed",
        "cuisine": "Traditional Hainanese Pork & Century Egg Porridge",
        "menu_price": "Signature: Hainanese Pork Porridge with Handmade Meatballs, Liver & Intestine | Menu: Pork Congee, Century Egg & Lean Meat Porridge, Sliced Fish Porridge, Extra Raw Egg, Crispy You Tiao | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "CL30129003": {
        "name": "Clementi Hot & Cold Desserts (Hello Dessert)",
        "hours": "Tue–Sun 09:00–20:30; Mon: Closed",
        "cuisine": "Traditional Heritage Hot & Cold Desserts",
        "menu_price": "Signature: Refreshing Cold Cheng Tng with Ginkgo Nuts & Hot Tau Suan with Crispy You Tiao | Menu: Cheng Tng, Red Bean Soup, Green Bean Soup, Ice Kachang, Chendol, Longan Sea Coconut | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "CL30119003": {
        "name": "Whampoa Soya Bean (Clementi 448)",
        "hours": "Daily 06:30–21:30",
        "cuisine": "Michelin Selected Traditional Beancurd & Fresh Soya Milk",
        "menu_price": "Signature: Silky Smooth Fresh Douhua (Traditional / Gula Melaka) & Fresh Soya Bean Milk | Menu: Traditional Beancurd, Grass Jelly Drink, Soya Bean with Grass Jelly (Michael Jackson) | Price: SGD 1.50–3.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "CL30131002": {
        "name": "Fong's Dee Curry Puff",
        "hours": "Daily 06:00–18:00",
        "cuisine": "Handmade Crispy Deep-Fried Curry Puffs",
        "menu_price": "Signature: Freshly Made Crispy Curry Chicken & Potato Puff with Hard-Boiled Egg | Menu: Curry Puff, Sardine Puff, Yam Puff | Price: SGD 1.60–2.00",
        "halal": "No",
        "vegan": "No"
    },
    "CL30149002": {
        "name": "Fong's Rojak",
        "hours": "Daily 10:00–20:00",
        "cuisine": "Traditional Chinese Fruit & Charcoal You Tiao Rojak",
        "menu_price": "Signature: Charcoal-Grilled You Tiao & Tau Pok Rojak tossed in Shrimp Paste with Crushed Peanuts | Menu: Chinese Rojak (Small / Medium / Large), Extra You Tiao, Extra Century Egg | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CL30132003": {
        "name": "Bedok Chwee Kueh (Clementi 448)",
        "hours": "Daily 06:30–18:30",
        "cuisine": "Michelin Bib Gourmand Steamed Chwee Kueh",
        "menu_price": "Signature: Steamed Rice Cakes topped with Savoury Fragrant Preserved Radish (Chai Poh) & Sambal Chilli | Menu: Chwee Kueh (2 pcs / 4 pcs / 6 pcs) | Price: SGD 1.60–3.60",
        "halal": "No",
        "vegan": "No"
    },
    "CL30136003": {
        "name": "Clementi Homemade Pau Dian (金文泰自制包点)",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Handmade Traditional Dim Sum & Steamed Buns",
        "menu_price": "Signature: Handmade Juicy Big Pork Pau & Savoury Char Siew Pau | Menu: Big Pau, Char Siew Pau, Lian Rong Pau, Dou Sha Pau, Siew Mai, Fan Choy | Price: SGD 1.00–2.50",
        "halal": "No",
        "vegan": "No"
    },
    "CL30141003": {
        "name": "Teo Chew Fish Porridge (潮州鱼粥)",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Teochew Fresh Fish Soup & Sliced Pomfret Porridge",
        "menu_price": "Signature: Clear Teochew Sliced Batang Fish Soup with Bittergourd & Pomfret Fish Porridge | Menu: Sliced Fish Soup, Fried Fish Soup, Fish Head Soup, Fish Porridge, Seafood Soup | Price: SGD 5.50–9.00",
        "halal": "No",
        "vegan": "No"
    },
    "CL30144002": {
        "name": "Ji Xiang Vegetarian Food (吉祥斋素食)",
        "hours": "Tue–Sun 06:00–13:00; Mon: Closed",
        "cuisine": "Traditional Chinese Vegetarian & Vegan Breakfast",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon with Crispy Zhai Er (Beancurd Skin), Mock Char Siew & Cabbage | Menu: Vegetarian Economic Bee Hoon / Noodles, Mock Duck, Spring Roll, Vegetarian Laksa, Vegetarian Lor Mee | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "CL30102002": {
        "name": "Sayed Aminah Muslim Food",
        "hours": "Tue–Sun 05:00–22:00; Mon: Closed",
        "cuisine": "Indian Muslim Cuisine, Roti Prata & Briyani",
        "menu_price": "Signature: Crispy Roti Prata with Mutton Dalcha, Murtabak & Mutton Nasi Biryani | Menu: Plain Prata, Egg Onion Prata, Coin Prata, Chicken Murtabak, Mee Goreng Mamak, Nasi Briyani | Price: SGD 1.50–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "CL30105002": {
        "name": "Siti Laila Muslim Food",
        "hours": "Tue–Sun 06:00–15:00; Mon: Closed",
        "cuisine": "Malay Breakfast & Nasi Lemak",
        "menu_price": "Signature: Fragrant Pandan Nasi Lemak with Crispy Fried Chicken Wing, Otah & Sambal Tumis | Menu: Nasi Lemak Sets, Mee Rebus, Mee Siam, Lontong | Price: SGD 3.50–6.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "CL30106003": {
        "name": "Wahad Muslim Satay",
        "hours": "Tue–Sun 12:00–21:00; Mon: Closed",
        "cuisine": "Charcoal-Grilled Halal Satay",
        "menu_price": "Signature: Charcoal-Grilled Chicken & Mutton Satay with Spiced Peanut Sauce & Ketupat | Menu: Chicken Satay, Mutton Satay, Beef Satay, Ketupat, Fresh Cucumber & Onion | Price: SGD 0.90 per stick (min 10 sticks)",
        "halal": "Yes",
        "vegan": "No"
    },
    "CL30133002": {
        "name": "Wan Li Xin Duck Noodle Rice",
        "hours": "Daily 09:30–20:00",
        "cuisine": "Teochew Braised Duck Rice & Duck Noodles",
        "menu_price": "Signature: Herbal Braised Duck Rice with Yam Rice & Braised Duck Kway Teow Soup | Menu: Braised Duck Rice, Duck Porridge, Kway Chap Platter, Braised Tofu & Egg | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "CL30134002": {
        "name": "Hong Xing Li Thai Style Trotter Rice",
        "hours": "Daily 10:30–20:30",
        "cuisine": "Thai Style Braised Pork Trotter Rice",
        "menu_price": "Signature: Meltingly Tender Thai Braised Pork Trotter with Salted Veg & Tangy Chilli Sauce | Menu: Pork Trotter Rice, Braised Pork Belly Rice, Braised Intestine, Lava Egg | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "CL30147003": {
        "name": "Hong Sheng Fish Soup (Clementi 448)",
        "hours": "Daily 09:30–20:30",
        "cuisine": "Teochew Sliced Fish Soup & Sliced Fish Bee Hoon",
        "menu_price": "Signature: Fresh Sliced Mackerel Batang Fish Soup & Crispy Fried Fish Soup with Milk | Menu: Sliced Fish Soup, Fried Fish Soup, Seafood Tom Yum Soup, Sliced Fish Porridge | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "CL30138003": {
        "name": "Song Fish Soup",
        "hours": "Tue–Sun 10:00–20:00; Mon: Closed",
        "cuisine": "Fish Head Steamboat Broth & Fresh Fish Soup",
        "menu_price": "Signature: Red Garoupa Sliced Fish Soup with Silken Tofu & Fried Fish Soup | Menu: Red Garoupa Fish Soup, Batang Sliced Fish Bee Hoon, Seafood Soup | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No"
    },

    # =========================================================================
    # 3. WHAMPOA MAKAN PLACE BLK 91 (320091)
    # =========================================================================
    "WD50114001": {
        "name": "Xin Heng Feng Guo Tiao Tan (新恒丰粿条摊)",
        "hours": "Wed–Mon 05:00–12:30, 16:30–21:30; Tue: Closed",
        "cuisine": "Teochew Minced Meat Fishball Noodles & Night Charcoal Fish Head Steamboat",
        "menu_price": "Signature: Morning Teochew Mee Pok Dry with Fresh Fishballs & Evening Charcoal Pomfret Fish Head Steamboat | Menu: Minced Meat Noodles, Fishball Kway Teow Soup, Charcoal Fish Head Steamboat (Evening) | Price: SGD 4.50–35.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD50115001": {
        "name": "Xin Heng Feng Guo Tiao Tan (新恒丰粿条摊)",
        "hours": "Wed–Mon 05:00–12:30, 16:30–21:30; Tue: Closed",
        "cuisine": "Teochew Minced Meat Fishball Noodles & Night Charcoal Fish Head Steamboat",
        "menu_price": "Signature: Morning Teochew Mee Pok Dry with Fresh Fishballs & Evening Charcoal Pomfret Fish Head Steamboat | Menu: Minced Meat Noodles, Fishball Kway Teow Soup, Charcoal Fish Head Steamboat (Evening) | Price: SGD 4.50–35.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD50118001": {
        "name": "Nurilah Malay Food",
        "hours": "Tue–Sun 06:00–13:30; Mon: Closed",
        "cuisine": "Traditional Malay Breakfast Staples",
        "menu_price": "Signature: Comforting Lontong with Rich Sayur Lodeh, Mee Soto & Nasi Lemak | Menu: Lontong, Mee Rebus, Mee Siam, Nasi Lemak with Sambal Ikan Bilis | Price: SGD 3.50–5.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "WD50119001": {
        "name": "Best Lu Mian In Town (最好吃卤面)",
        "hours": "Tue–Sun 08:00–14:00; Mon: Closed",
        "cuisine": "Traditional Rich Gravy Hokkien Lor Mee",
        "menu_price": "Signature: Thick Starchy Lor Mee loaded with Crispy Fried Fish Nuggets, Handmade Ngoh Hiang & Braised Pork Belly | Menu: Traditional Lor Mee (Small / Medium / Large), Extra Fried Fish, Braised Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD50121001": {
        "name": "Guang Dong Xiao Shi (廣東小食)",
        "hours": "Mon–Fri 06:30–13:30; Sat–Sun 06:30–14:00",
        "cuisine": "Cantonese Laksa Yong Tau Foo & Handmade Tofu",
        "menu_price": "Signature: Aromatic Laksa Yong Tau Foo with Crispy Fried Tofu, Eggplant & Bittergourd | Menu: Laksa Yong Tau Foo, Clear Soup Yong Tau Foo, Dry Sweet Sauce YTF with Chee Cheong Fun | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD50127001": {
        "name": "Mat Noh & Rose Authentic Ginger Fried Chicken Rice",
        "hours": "Tue–Sat 09:00–15:00; Sun–Mon: Closed",
        "cuisine": "Heritage Halal Ginger Fried Chicken Rice",
        "menu_price": "Signature: Crispy Ginger-Spiced Fried Chicken Rice topped with Golden Batter Crumbs & Punchy Garlic Chilli | Menu: Ginger Fried Chicken Rice (Drumstick / Thigh), Extra Crunchy Crumbs, Fried Gizzard | Price: SGD 4.50–6.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "WD50132001": {
        "name": "Chan's Prawn Noodles (曾的虾面)",
        "hours": "Wed–Sun 06:30–12:30; Mon–Tue: Closed",
        "cuisine": "Heritage Traditional Whampoa Prawn Noodles",
        "menu_price": "Signature: Robust Umami Prawn Noodle Soup with Fresh Prawns, Pork Ribs & Fragrant Pork Lard | Menu: Prawn Noodle (Dry / Soup), Pork Ribs Prawn Noodle, Prawn & Pig's Tail Noodle | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD50143001": {
        "name": "Robert Mee Siam Lontong",
        "hours": "Tue–Wed, Sat–Sun 07:30–14:00; Mon, Thu–Fri: Closed",
        "cuisine": "Traditional Tangy Mee Siam & Rich Lontong",
        "menu_price": "Signature: Tangy Tamarind Gravy Nyonya-Style Mee Siam with Hard-Boiled Egg & Crispy Croutons | Menu: Traditional Mee Siam, Lontong Sayur Lodeh, Extra Sambal Tumis | Price: SGD 3.50–5.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD50145001": {
        "name": "Yu Chu La Mian Xiao Long Bao (御厨拉面小笼包)",
        "hours": "Thu–Tue 06:00–14:00; Wed: Closed",
        "cuisine": "Handmade Northern Chinese Xiao Long Bao & Hand-Pulled La Mian",
        "menu_price": "Signature: Steamed Soup Dumplings (Xiao Long Bao) & Spicy Dan Dan Hand-Pulled La Mian | Menu: Steamed Xiao Long Bao (6 pcs), Pan-Fried Guo Tie, Dan Dan Noodles, Zha Jiang Mian, Hot & Sour Soup | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD50147001": {
        "name": "Hock Gooi (Changi Village) Curry Rice",
        "hours": "Daily 07:00–14:30",
        "cuisine": "Hainanese Curry Rice & Stewed Pork Belly",
        "menu_price": "Signature: Hainanese Pork Cutlet Curry Rice with Stewed Cabbage & Dark Braising Gravy | Menu: Curry Rice Sets, Crispy Pork Cutlet, Braised Pork Belly, Braised Tau Pok & Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD50110001": {
        "name": "Whampoa Ah Lim Yu Tiao (Hillview Steam Food)",
        "hours": "Tue–Sun 06:00–13:30; Mon: Closed",
        "cuisine": "Traditional Fried Dough Fritters & Steamed Delicacies",
        "menu_price": "Signature: Golden Crispy You Tiao (Fried Dough Fritters), Butterfly Buns & Red Bean Hum Chim Peng | Menu: You Tiao, Butterfly Bun, Hum Chim Peng (Salted / Red Bean), Fried Carrot Cake Stick | Price: SGD 1.20–1.60",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "WD50117001": {
        "name": "Nyonya Chendol (Whampoa)",
        "hours": "Tue–Sun 09:30–17:00; Mon: Closed",
        "cuisine": "Traditional Gula Melaka Chendol",
        "menu_price": "Signature: Thick Pure Melaka Gula Melaka Chendol with Fresh Pandan Jelly & Kidney Beans | Menu: Original Chendol, Red Bean Chendol, Sweet Corn Chendol, D24 Durian Chendol | Price: SGD 2.50–4.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # =========================================================================
    # 4. TECK GHEE COURT BLK 341 (560341)
    # =========================================================================
    "AM20101003": {
        "name": "Hock Heng Delights (福兴小炒)",
        "hours": "Tue–Sun 11:30–14:30, 16:30–21:30; Mon: Closed",
        "cuisine": "Heritage Wok-Fried Zi Char & Claypot Fish Head",
        "menu_price": "Signature: Claypot Fish Head with Yam & Rich Salted Egg Prawns | Menu: Claypot Fish Head, Salted Egg Pork Ribs, Wok-Hei Sambal Kang Kong, Claypot Yee Mee, Moonlight Hor Fun | Price: SGD 6.00–28.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM20103004": {
        "name": "Chaoshan Yuan Wei (潮汕源味小食)",
        "hours": "Wed–Mon 07:00–14:30; Tue: Closed",
        "cuisine": "Traditional Teochew Dim Sum & Steamed Snacks",
        "menu_price": "Signature: Authentic Teochew Soon Kueh, Rice Kueh (Png Kueh) & Steamed Dumplings | Menu: Soon Kueh, Png Kueh, Ku Chai Kueh, Steamed Yam Cake, Siew Mai | Price: SGD 1.30–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "AM20107003": {
        "name": "Shiok Shiok Noodles (潮极面)",
        "hours": "Sat–Tue, Thu 07:00–14:30; Wed 08:00–14:30; Fri: Closed",
        "cuisine": "Modern Heritage Bak Chor Mee & XO Black Mee Sua",
        "menu_price": "Signature: XO Black Mee Sua with Minced Pork & Fiery Mala Bak Chor Mee | Menu: XO Black Mee Sua, Mala Minced Meat Noodle, Signature Bak Chor Mee, Fishball Soup | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM20110003": {
        "name": "359 Kway Chap Duck Rice (359 粿汁卤鸭)",
        "hours": "Tue–Sun 07:00–14:30; Mon: Closed",
        "cuisine": "Teochew Braised Duck Rice & Traditional Kway Chap",
        "menu_price": "Signature: Teochew Braised Duck with Fragrant Yam Rice & Kway Chap Platter with Braised Intestines | Menu: Braised Duck Rice Set, Kway Chap (Single / Sharing), Braised Pork Belly, Braised Tau Pok & Egg | Price: SGD 4.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM20112004": {
        "name": "Fried Kway Teow . Fried Oyster . Carrot Cake (Blk 341)",
        "hours": "Tue–Sun 10:30–20:00; Mon: Closed",
        "cuisine": "Wok-Fried Char Kway Teow & Crispy Oyster Omelette",
        "menu_price": "Signature: Smoky Wok Hei Char Kway Teow & Crispy Fried Oyster Omelette with Spicy Chilli Sauce | Menu: Fried Kway Teow, Fried Oyster Omelette, White / Black Fried Carrot Cake | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM20115004": {
        "name": "Vegetable Oil Fried Carrot Cake (植物油炒菜头粿)",
        "hours": "Tue–Sun 06:00–13:30; Mon: Closed",
        "cuisine": "Vegetable Oil Fried White & Black Carrot Cake",
        "menu_price": "Signature: Fragrant Crispy White Carrot Cake fried in Vegetable Oil & Sweet Black Carrot Cake | Menu: White Carrot Cake, Black Carrot Cake, Mixed Yuan Yang Carrot Cake | Price: SGD 3.00–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "AM20116003": {
        "name": "Seng Huat Prawn Noodle Seafood Soup",
        "hours": "Wed–Mon 06:30–14:00; Tue: Closed",
        "cuisine": "Traditional Prawn Noodle Soup & Pork Rib Noodles",
        "menu_price": "Signature: Robust Traditional Prawn Noodle Soup with Pork Ribs & Fresh Sea Prawns | Menu: Prawn Noodle (Dry / Soup), Pork Rib Prawn Mee, Tail & Rib Prawn Noodle | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM20118002": {
        "name": "Sheng Ji Braised Duck",
        "hours": "Tue–Sun 07:30–14:30; Mon: Closed",
        "cuisine": "Teochew Braised Duck Rice & Porridge",
        "menu_price": "Signature: Herbal Braised Duck Rice with Dark Gravy & Steamed Duck Porridge | Menu: Braised Duck Rice, Duck Porridge, Braised Bean Curd, Duck Wing / Gizzard | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM20119003": {
        "name": "Nazeef Makan Place",
        "hours": "Daily 06:00–20:30",
        "cuisine": "Traditional Halal Malay Breakfast & Nasi Lemak",
        "menu_price": "Signature: Comforting Mee Rebus with Thick Sweet Potato Gravy & Fragrant Nasi Lemak | Menu: Mee Rebus, Mee Siam, Lontong, Nasi Lemak with Sambal Sotong / Chicken Wing | Price: SGD 3.50–6.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "AM20124002": {
        "name": "Ci Yuan Vegetarian Food (慈源素食)",
        "hours": "Thu–Tue 06:00–13:30; Wed: Closed",
        "cuisine": "Traditional Chinese Vegetarian & Vegan Bee Hoon",
        "menu_price": "Signature: Vegetarian Economic Bee Hoon with Crispy Mock Goose, Mock Char Siew & Cabbage | Menu: Vegetarian Bee Hoon, Vegetarian Lor Mee, Vegetarian Laksa, Mock Duck | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "AM20125002": {
        "name": "One Ton Mee (一吨面) / Ang Mo Kio Curry Rice",
        "hours": "Daily 06:00–15:30",
        "cuisine": "Signature Loaded Wanton Noodles & Braised Chicken Feet Mee",
        "menu_price": "Signature: Loaded Wanton Mee with Tender Braised Chicken Feet, Char Siew & Crispy Lard | Menu: Wanton Noodle (Dry / Soup), Braised Chicken Feet Noodle, Dumpling Soup | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM20126002": {
        "name": "Sweety Dessert (甜甜甜品)",
        "hours": "Tue–Sun 10:30–19:30; Mon: Closed",
        "cuisine": "Traditional Hot & Cold Shaved Ice Desserts",
        "menu_price": "Signature: Shaved Ice Kachang with Sweet Red Beans, Attap Chee & Refreshing Cold Cheng Tng | Menu: Ice Kachang, Chendol, Tau Suan with Crispy You Tiao, Red Bean Soup | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "AM20128002": {
        "name": "Selera Kampong (Teck Ghee)",
        "hours": "Tue–Sun 07:00–15:00; Mon: Closed",
        "cuisine": "Traditional Malay Village Delicacies & Nasi Padang",
        "menu_price": "Signature: Nasi Padang with Beef Rendang, Sambal Goreng & Ayam Masak Merah | Menu: Nasi Padang Selection, Soto Ayam, Mee Bakso, Sambal Telur | Price: SGD 4.00–7.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "AM20129003": {
        "name": "Kim Kim Cooked Food (金金熟食)",
        "hours": "Wed–Mon 06:30–14:00; Tue: Closed",
        "cuisine": "Economic Mixed Rice & Traditional Cantonese Porridge",
        "menu_price": "Signature: Teochew Sliced Fish Congee & Century Egg Minced Pork Porridge | Menu: Mixed Vegetable Rice, Cantonese Pork Porridge, Fish Porridge, Stir-Fried Vegetables | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM20108003": {
        "name": "Keong Kee Cooked Food (强记熟食)",
        "hours": "Tue–Sun 07:00–14:30; Mon: Closed",
        "cuisine": "Traditional Teochew Mixed Rice & Porridge",
        "menu_price": "Signature: Teochew Porridge with Braised Pork Belly, Steamed Fish & Salted Vegetables | Menu: Teochew Porridge, Braised Tau Pok, Preserved Chai Poh Omelette, Steamed Sotong | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM20130003": {
        "name": "Eng Kee Food Stall",
        "hours": "Tue–Sun 06:30–14:00; Mon: Closed",
        "cuisine": "Local Breakfast Fried Bee Hoon & Chicken Wings",
        "menu_price": "Signature: Economical Fried Bee Hoon with Crispy Chicken Wings, Fishcake & Luncheon Meat | Menu: Fried Bee Hoon / Mee, Crispy Fried Chicken Wing, Otah, Fried Egg, Cabbage | Price: SGD 2.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM20131003": {
        "name": "Lifu Coffee and Toast (利福咖啡与烤面包)",
        "hours": "Daily 05:30–17:00",
        "cuisine": "Traditional Nanyang Kopi, Teh & Charcoal Toasted Bread",
        "menu_price": "Signature: Fragrant Nanyang Kopi O, Teh Tarik & Crispy Kaya Butter Toast with Soft Boiled Eggs | Menu: Kopi, Teh, Charcoal Toast (Kaya Butter / Peanut), Soft-Boiled Eggs (2 pcs) | Price: SGD 1.30–3.80",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # =========================================================================
    # 5. ANG MO KIO CENTRAL 724 (560724)
    # =========================================================================
    "AM90122004": {
        "name": "Ang Mo Kio Char Kway Teow (Guan Heng)",
        "hours": "Tue–Sun 10:30–15:00; Mon: Closed",
        "cuisine": "Heritage Charcoal Wok Hei Char Kway Teow",
        "menu_price": "Signature: Traditional Charcoal Char Kway Teow with Cockles, Chinese Sausage (Lup Cheong) & Crispy Pork Lard | Menu: Char Kway Teow (Small / Medium / Large), Extra Cockles | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM90108003": {
        "name": "Vincent Western Food",
        "hours": "Tue–Sun 16:00–21:00; Mon: Closed",
        "cuisine": "Old-School Heritage Hawker Western Food",
        "menu_price": "Signature: Crispy Hainanese Chicken Cutlet & Sizzling Ribeye Steak with Garlic Butter Bread | Menu: Chicken Chop, Pork Chop, Fish & Chips, Sirloin Steak, Spring Chicken | Price: SGD 7.00–13.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM90121003": {
        "name": "Hong Chong Wanton Noodle (鴻昌雲吞麺)",
        "hours": "Wed–Sun 07:00–14:30; Mon–Tue: Closed",
        "cuisine": "Traditional Springy Wanton Mee & Dumpling Soup",
        "menu_price": "Signature: Springy Egg Noodles tossed in Dark Savoury Sauce with Roasted Char Siew & Plump Wanton Soup | Menu: Wanton Noodle (Dry / Soup), Dumpling Noodle (Sui Kow), Shredded Chicken Hor Fun | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM90128003": {
        "name": "Spinach Soup (鲜苋菜汤)",
        "hours": "Daily 08:30–20:00",
        "cuisine": "Healthy Double-Boiled Fresh Spinach Soup",
        "menu_price": "Signature: Nutrient-Rich Fresh Spinach Soup with Century Egg, Salted Egg, Minced Pork & Prawns | Menu: Spinach Seafood Soup, Spinach Minced Pork Soup, Sliced Fish Spinach Soup | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "AM90132003": {
        "name": "Xin Mei Congee (新美粥品)",
        "hours": "Daily 07:30–19:30",
        "cuisine": "Traditional Silky Cantonese Congee",
        "menu_price": "Signature: Silky Century Egg & Lean Pork Congee, Sliced Batang Fish Porridge & Mixed Pig's Organ Congee | Menu: Century Egg Congee, Sliced Fish Congee, Shredded Chicken Porridge, Frog Congee | Price: SGD 3.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM90135004": {
        "name": "Teochew Fish Porridge (AMK 724)",
        "hours": "Daily 09:30–20:30",
        "cuisine": "Teochew Fresh Fish Soup & Sliced Pomfret Porridge",
        "menu_price": "Signature: Clear Teochew Sliced Batang Fish Soup with Bittergourd & Sliced Pomfret Soup | Menu: Sliced Fish Soup, Fried Fish Soup, Seafood Soup, Fish Porridge | Price: SGD 5.50–9.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM90138003": {
        "name": "Whampoa Beancurd (AMK 724)",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Fresh Soya Milk & Traditional Douhua",
        "menu_price": "Signature: Traditional Silky Warm Beancurd (Tau Hui) with Sugar Syrup & Grass Jelly Drink | Menu: Traditional Beancurd, Fresh Soya Milk, Grass Jelly Drink, Soya Bean with Grass Jelly | Price: SGD 1.50–3.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "AM90117003": {
        "name": "Ci Wen Vegetarian Food (慈云素食)",
        "hours": "Thu–Tue 08:30–21:30; Wed: Closed",
        "cuisine": "Traditional Chinese Vegetarian & Vegan Fare",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon with Crispy Zhai Er & Vegetarian Laksa | Menu: Vegetarian Bee Hoon, Vegetarian Lor Mee, Vegetarian Hor Fun, Mock Meat Dishes | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "AM90141004": {
        "name": "99 Fried Hokkien Mee",
        "hours": "Daily 10:15–20:45",
        "cuisine": "Wok-Hei Fried Hokkien Prawn Mee",
        "menu_price": "Signature: Juicy Prawn Broth Braised Yellow Noodles & Thick Bee Hoon with Squid, Pork Belly & Calamansi | Menu: Fried Hokkien Prawn Mee (Small / Medium / Large), Extra Sambal Chilli | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "AM90116003": {
        "name": "Pon Tian Noodle House (笨珍云吞面)",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Pontian Style Wanton Noodles & Fried Wantons",
        "menu_price": "Signature: Pontian Style Wanton Noodle tossed in Tangy Tomato Chilli Sauce & Crispy Deep-Fried Wantons | Menu: Pontian Wanton Mee, Fried Wanton Platter, Dumpling Soup | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "AM90137003": {
        "name": "The Ice Breaker @ Ang Mo Kio",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Traditional & Modern Shaved Ice Desserts",
        "menu_price": "Signature: Shaved Ice Kachang with Gula Melaka, Durian Chendol & Mango Snow Ice | Menu: Ice Kachang, Chendol, Cheng Tng (Cold/Hot), Grass Jelly with Longan, Tau Suan | Price: SGD 2.20–4.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # =========================================================================
    # 6. MARINE PARADE CENTRAL MARKET & FOOD CENTRE (440084)
    # =========================================================================
    "MPC0153001": {
        "name": "Hup Lee Fried Bee Hoon",
        "hours": "Daily 06:00–13:00",
        "cuisine": "Famous Traditional Breakfast Economic Bee Hoon",
        "menu_price": "Signature: Fragrant Fried Bee Hoon with Crispy Chicken Wings, Luncheon Meat, Otah & Fried Egg | Menu: Fried Bee Hoon / Mee / Kway Teow, Crispy Chicken Wing, Ngoh Hiang, Fish Cake, Cabbage | Price: SGD 2.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "MPC0109001": {
        "name": "Katong Jago Teochew Mee Kuay Teow Mee",
        "hours": "Daily 07:00–16:00",
        "cuisine": "Heritage Teochew Bak Chor Mee & Fish Dumpling Noodles",
        "menu_price": "Signature: Teochew Minced Meat Mee Pok with Handmade Fish Dumplings (Her Kiao), Fishballs & Braised Mushrooms | Menu: Bak Chor Mee (Dry / Soup), Fish Dumpling Soup, Fishball Kway Teow | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "MPC0107001": {
        "name": "Yi Lu Fa Boneless Hainanese Chicken Rice",
        "hours": "Daily 09:00–20:00",
        "cuisine": "Hainanese Boneless Steamed & Roasted Chicken Rice",
        "menu_price": "Signature: Silky Boneless Steamed White Chicken Rice & Crispy Roasted Chicken with Aromatic Ginger Chilli | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Rice Set with Oyster Sauce Veg | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "MPC0116001": {
        "name": "Soon Soon Soon Wanton Noodles",
        "hours": "Daily 07:30–21:00",
        "cuisine": "Traditional Cantonese Wanton Mee & Shredded Chicken Hor Fun",
        "menu_price": "Signature: Springy Wanton Noodles with Caramelised Char Siew, Plump Wantons & Shredded Chicken Hor Fun | Menu: Wanton Mee (Dry / Soup), Dumpling Noodle, Shredded Chicken Mushroom Hor Fun | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "MPC0150001": {
        "name": "Pang Pang Western Food (Marine Parade)",
        "hours": "Daily 11:00–21:00",
        "cuisine": "Hotel-Quality Artisan Hawker Western Food",
        "menu_price": "Signature: Charcoal Grilled Chicken Chop with Fragrant Garlic Butter Fried Rice & Prime Ribeye Steak | Menu: Grilled Chicken Chop, Crispy Pork Chop, Fish & Chips, Ribeye Steak, Truffle Fries | Price: SGD 7.50–14.50",
        "halal": "No",
        "vegan": "No"
    },
    "MPC0145001": {
        "name": "New World Congee (新世界粥品)",
        "hours": "Sat–Thu 08:00–16:00; Fri: Closed",
        "cuisine": "Authentic Silky Cantonese Congee & Porridge",
        "menu_price": "Signature: Century Egg & Minced Pork Porridge, Mixed Pig's Organ Congee & Fresh Sliced Fish Porridge | Menu: Century Egg Congee, Sliced Fish Porridge, Meatball Porridge, Crispy You Tiao | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "MPC0137001": {
        "name": "Bahurdeen Biasa",
        "hours": "Wed–Sun 12:30–17:00; Mon–Tue: Closed",
        "cuisine": "Authentic Halal Indian Muslim Mee Goreng & Mee Kuah",
        "menu_price": "Signature: Fiery Wok-Fried Mutton Mee Goreng with Calamansi & Red Savoury Mee Kuah | Menu: Mee Goreng (Mutton / Chicken), Bee Hoon Goreng, Nasi Goreng Merah, Mee Kuah | Price: SGD 4.50–7.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "MPC0139001": {
        "name": "Hassbawa",
        "hours": "Fri–Wed 12:00–21:30; Thu: Closed",
        "cuisine": "Legendary Halal Indian Muslim Mee Goreng & Murtabak",
        "menu_price": "Signature: Famous Red Wok-Fried Mee Goreng Mamak, Chicken Murtabak & Roti John | Menu: Mee Goreng, Maggi Goreng, Mutton Murtabak, Nasi Goreng Kampung, Roti John | Price: SGD 4.50–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "MPC0140001": {
        "name": "IzahRahman Corner",
        "hours": "Wed–Mon 08:00–20:00; Tue: Closed",
        "cuisine": "Traditional Authentic Malay Nasi Padang",
        "menu_price": "Signature: Authentic Nasi Padang with Slow-Cooked Beef Rendang, Sambal Goreng & Ayam Masak Merah | Menu: Nasi Padang Dishes, Sayur Lodeh, Bergedil, Sambal Paru, Sotong Hitam | Price: SGD 4.50–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "MPC0119001": {
        "name": "Whampoa Soya Bean (Marine Parade Central)",
        "hours": "Daily 06:30–21:30",
        "cuisine": "Traditional Silky Beancurd & Fresh Soya Milk",
        "menu_price": "Signature: Traditional Smooth Tau Hui with Brown Sugar / Sugar Syrup & Soya Milk Drink | Menu: Traditional Beancurd, Fresh Soya Milk, Grass Jelly Drink, Beancurd with Grass Jelly | Price: SGD 1.50–3.00",
        "halal": "No",
        "vegan": "Yes"
    },

    # =========================================================================
    # 7. CHINATOWN COMPLEX FOOD CENTRE (050335)
    # =========================================================================
    "SM102067004": {
        "name": "Fatty Ox Hong Kong Kitchen (肥牛香港小厨)",
        "hours": "Wed–Sun 07:30–14:30; Mon–Tue: Closed",
        "cuisine": "Michelin Selected Authentic Hong Kong Roast Meats & Braised Beef Brisket",
        "menu_price": "Signature: Meltingly Tender Hong Kong Braised Beef Brisket & Tendon Noodle, Roast Duck & Char Siew | Menu: Braised Beef Brisket Noodle, Roast Duck Rice, Soya Sauce Chicken Noodle, Wanton Soup | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "SM102123008": {
        "name": "Hakka Fun HamCha and Yong Tou Fu (擂茶与酿豆腐)",
        "hours": "Daily 11:00–17:00",
        "cuisine": "Traditional Hakka Thunder Tea Rice & Handmade Yong Tau Foo",
        "menu_price": "Signature: Fragrant Hakka Thunder Tea Rice (HamCha / Lei Cha) with Mint-Basil Tea Broth & Handmade Yong Tau Foo | Menu: Hakka Lei Cha (Brown / White Rice), Bittergourd with Fishpaste, Tofu with Minced Pork, Tau Pok YTF | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "SM102163003": {
        "name": "Chinatown Fried Dough Stick (牛车水油条)",
        "hours": "Daily 07:30–18:00",
        "cuisine": "Traditional Freshly Fried Dough Fritters & Hum Chim Peng",
        "menu_price": "Signature: Crispy Traditional You Tiao, Red Bean Paste Hum Chim Peng & Butterfly Buns | Menu: You Tiao, Salted Hum Chim Peng, Red Bean Hum Chim Peng, Butterfly Bun, Sesame Ball | Price: SGD 1.20–1.60",
        "halal": "No",
        "vegan": "Yes"
    },
    "SM102108004": {
        "name": "Dragon Village Hainanese Curry Rice (龙城海南咖喱饭)",
        "hours": "Daily 11:00–19:00",
        "cuisine": "Traditional Hainanese Curry Rice",
        "menu_price": "Signature: Crispy Hainanese Pork Chop drenched in Gooey Curry Gravy, Braised Pork Belly (Lor Bak) & Chap Chye | Menu: Hainanese Curry Rice, Pork Chop, Braised Cabbage, Curry Chicken, Braised Tau Pok & Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "SM102102003": {
        "name": "Fuzhou Mei Wei Shou Gong Mian (福州美味手工面)",
        "hours": "Wed–Mon 07:00–14:30; Tue: Closed",
        "cuisine": "Traditional Handmade Fuzhou Ban Mian & Fishball Noodles",
        "menu_price": "Signature: Handmade Fuzhou Fishball Noodles with Minced Meat Filling & Hand-Torn Ban Mian | Menu: Fuzhou Fishball Soup / Noodle, Hand-Torn Ban Mian, Minced Meat Mee Hoon Kway | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "SM102045003": {
        "name": "Emerald Soya Sauce Chicken (翠绿油鸡)",
        "hours": "Tue–Sun 08:00–14:30; Mon: Closed",
        "cuisine": "Traditional Cantonese Soya Sauce Chicken & Roasted Meats",
        "menu_price": "Signature: Tender Cantonese Soya Sauce Chicken with Fragrant Rice & Char Siew Roast Pork Noodle | Menu: Soya Sauce Chicken Rice / Noodle, Half / Whole Soya Sauce Chicken, Char Siew Noodle | Price: SGD 4.00–18.00",
        "halal": "No",
        "vegan": "No"
    },
    "SM102044003": {
        "name": "Emerald Soya Sauce Chicken (翠绿油鸡)",
        "hours": "Tue–Sun 08:00–14:30; Mon: Closed",
        "cuisine": "Traditional Cantonese Soya Sauce Chicken & Roasted Meats",
        "menu_price": "Signature: Tender Cantonese Soya Sauce Chicken with Fragrant Rice & Char Siew Roast Pork Noodle | Menu: Soya Sauce Chicken Rice / Noodle, Half / Whole Soya Sauce Chicken, Char Siew Noodle | Price: SGD 4.00–18.00",
        "halal": "No",
        "vegan": "No"
    }
}
