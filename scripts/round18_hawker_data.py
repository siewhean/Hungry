#!/usr/bin/env python3
"""
Round 18 hawker and food court enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers 66 iconic stalls across:
- Beo Crescent Market & Food Centre (169982)
- Shunfu Mart Food Centre (570320)
- Mei Ling Market & Food Centre (140159)
- Kovan Hougang 209 Market & Food Centre (530209)
- Telok Blangah Crescent Market & Food Centre (090011)
- Whampoa Makan Place Blk 90 (320090)
- Bukit Merah View Market & Hawker Centre (151115)
"""

NEW_LICENCE_ENTRIES_ROUND18 = {
    # =========================================================================
    # 1. BEO CRESCENT MARKET & FOOD CENTRE (169982)
    # =========================================================================
    "BCM0188003": {
        "name": "Kia Xiang Du Du Nyonya Kueh (吉香嘟嘟南洋糕点)",
        "hours": "Tue–Sun 06:30–14:00; Mon: Closed",
        "cuisine": "Traditional Steamed Tutu Kueh & Heritage Nyonya Kueh",
        "menu_price": "Signature: Freshly Steamed Fragrant Coconut & Peanut Tutu Kueh on Pandan Leaves | Menu: Coconut Tutu Kueh (3 pcs / 5 pcs), Peanut Tutu Kueh, Traditional Ang Ku Kueh, Tapioca Kueh | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "BCM0168003": {
        "name": "Nan Yuan Since 1961 (南园云吞面)",
        "hours": "Wed–Mon 05:00–14:00; Tue: Closed",
        "cuisine": "Heritage Teochew Fishball Noodles & Wanton Mee since 1961",
        "menu_price": "Signature: Springy Egg Noodles tossed in Chilli Vinegar Sauce with Handmade Fishballs, Char Siew & Wantons | Menu: Fishball Noodle (Dry / Soup), Wanton Mee, Dumpling Soup, Fish Cake | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "BCM0175005": {
        "name": "Hai Zhou Yu Tang (海舟鱼汤)",
        "hours": "Mon–Sat 09:00–19:30; Sun: Closed",
        "cuisine": "Teochew Fresh Fish Soup & Seafood Porridge",
        "menu_price": "Signature: Sliced Batang Fish Soup with Bittergourd & Deep-Fried Fish Head Bee Hoon | Menu: Sliced Fish Soup, Fried Fish Soup, Seafood Tom Yum Soup, Sliced Fish Porridge | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "BCM0176004": {
        "name": "Mei Jing Su Shi (美景素食)",
        "hours": "Tue–Sun 06:00–13:30; Mon: Closed",
        "cuisine": "Traditional Chinese Vegetarian & Vegan Breakfast",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon with Crispy Zhai Er (Beancurd Crackers) & Mock Char Siew | Menu: Vegetarian Bee Hoon, Vegetarian Lor Mee, Vegetarian Laksa, Spring Roll, Mock Duck | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "BCM0187003": {
        "name": "Fu Hua Soya Bean (富华豆花)",
        "hours": "Daily 06:00–14:00",
        "cuisine": "Traditional Fresh Beancurd & Soya Bean Milk",
        "menu_price": "Signature: Silky Warm Traditional Douhua with Sugar Syrup & Fresh Soya Milk | Menu: Traditional Beancurd, Fresh Soya Milk, Grass Jelly Drink, Soya Bean with Grass Jelly | Price: SGD 1.30–2.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "BCM0173003": {
        "name": "Leek Hainanese Chicken Rice",
        "hours": "Tue–Sun 09:30–14:30; Mon: Closed",
        "cuisine": "Traditional Hainanese Chicken Rice",
        "menu_price": "Signature: Steamed White Chicken Rice with Fragrant Rice & Garlic Chilli Sauce | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Rice Set with Oyster Sauce Greens | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "BCM0169002": {
        "name": "Seng Kee Cooked Food (成记熟食)",
        "hours": "Wed–Mon 06:30–13:30; Tue: Closed",
        "cuisine": "Traditional Economic Mixed Rice & Teochew Porridge",
        "menu_price": "Signature: Teochew Porridge with Braised Pork Belly, Salted Egg, Fried Fish & Braised Cabbage | Menu: Economic Rice Dishes, Teochew Porridge, Braised Bean Curd, Steamed Minced Meat | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "BCM0186003": {
        "name": "Porridge Kiosk (Beo Crescent)",
        "hours": "Tue–Sun 06:00–12:30; Mon: Closed",
        "cuisine": "Traditional Cantonese Pork & Fish Porridge",
        "menu_price": "Signature: Smooth Cantonese Pork Porridge with Minced Meatballs & Sliced Fish Congee | Menu: Pork Congee, Century Egg Porridge, Sliced Fish Porridge, Crispy You Tiao | Price: SGD 3.50–5.00",
        "halal": "No",
        "vegan": "No"
    },
    "BCM0182003": {
        "name": "A & M Coffee Stall (Beo Crescent)",
        "hours": "Daily 05:30–15:00",
        "cuisine": "Traditional Nanyang Kopi, Teh & Toast",
        "menu_price": "Signature: Traditional Nanyang Kopi O, Teh C & Kaya Butter Toast with Soft-Boiled Eggs | Menu: Kopi, Teh, Charcoal Toast (Kaya Butter), Soft-Boiled Eggs (2 pcs) | Price: SGD 1.20–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # =========================================================================
    # 2. SHUNFU MART FOOD CENTRE (570320)
    # =========================================================================
    "SU10212003": {
        "name": "Chocolat N' Spice (Muffins)",
        "hours": "Tue–Sat 07:30–14:30; Sun–Mon: Closed",
        "cuisine": "Artisan Freshly Baked Gourmet Muffins & Pastries",
        "menu_price": "Signature: Chocolate Chip Muffin, Blueberry Muffin, Banana Walnut Muffin & Mocha Cheese Muffin | Menu: Fresh Muffins (Chocolate Chip, Blueberry, Banana Walnut, Orange Choc, Cheese), Brownies | Price: SGD 1.80–2.20 per muffin",
        "halal": "No",
        "vegan": "No"
    },
    "SU10213002": {
        "name": "Chocolat N' Spice (Cakes)",
        "hours": "Tue–Sat 08:30–14:30; Sun–Mon: Closed",
        "cuisine": "Artisan Cheesecakes & Chocolate Desserts",
        "menu_price": "Signature: Marble Cheesecake, Classic Carrot Cake & Dark Chocolate Fudge Brownies | Menu: Sliced Cheesecakes, Chocolate Brownies, Carrot Cake, Fruit Tarts | Price: SGD 3.50–5.50 per slice",
        "halal": "No",
        "vegan": "No"
    },
    "SU10204003": {
        "name": "Dong Nan Wanton Noodle (东南云吞面)",
        "hours": "Wed–Mon 06:00–14:00; Tue: Closed",
        "cuisine": "Malaysian Style Dark Sauce Wanton Mee",
        "menu_price": "Signature: Springy Egg Noodles tossed in Dark Caramelised Soy Sauce with Char Siew & Fried Wantons | Menu: Wanton Noodle (Dry / Soup), Dumpling Noodle, Fried Wanton Platter | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "SU10203003": {
        "name": "He Cheng Cooked Food (合成熟食)",
        "hours": "Tue–Sun 06:00–13:30; Mon: Closed",
        "cuisine": "Local Breakfast Fried Bee Hoon & Crispy Curry Puffs",
        "menu_price": "Signature: Fragrant Economical Fried Bee Hoon with Crispy Chicken Wings, Handmade Curry Puff & Otah | Menu: Fried Bee Hoon / Mee, Curry Puff (Potato / Sardine), Chicken Wing, Fried Egg, Ngoh Hiang | Price: SGD 2.50–5.00",
        "halal": "No",
        "vegan": "No"
    },
    "SU10205003": {
        "name": "Heng Heng Fishball Noodle (恒恒鱼圆面)",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Traditional Teochew Handmade Fishball Noodles",
        "menu_price": "Signature: Bouncy Fresh Fishballs with Minced Meat Mee Pok tossed in Chilli & Lard | Menu: Fishball Noodle (Dry / Soup), Meatball Noodle, Fishball Soup | Price: SGD 4.00–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "SU10209003": {
        "name": "Huat Heng Fried Prawn Mee (发兴炒虾面)",
        "hours": "Fri–Wed 10:00–13:30, 17:00–20:00; Thu: Closed",
        "cuisine": "Wok-Hei Fried Hokkien Prawn Mee & Prawn Noodle Soup",
        "menu_price": "Signature: Smoky Fried Hokkien Prawn Mee simmered in Rich Prawn Stock & Traditional Prawn Noodle Soup | Menu: Fried Hokkien Mee (Small / Medium / Large), Prawn Noodle (Dry / Soup) | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "SU10217004": {
        "name": "Gu Cheng Soya Sauce Chicken Rice & Noodle (古城油鸡饭)",
        "hours": "Tue–Sun 08:30–14:30; Mon: Closed",
        "cuisine": "Cantonese Soya Sauce Chicken & Roasted Meats",
        "menu_price": "Signature: Tender Soya Sauce Chicken with Fragrant Rice & Char Siew Roast Pork Noodle | Menu: Soya Sauce Chicken Rice, Char Siew Roast Pork Rice, Dumpling Soup | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "SU10222003": {
        "name": "Hainanese Chicken Rice (Shunfu Mart)",
        "hours": "Tue–Sun 09:00–15:00; Mon: Closed",
        "cuisine": "Traditional Hainanese Steamed & Roasted Chicken Rice",
        "menu_price": "Signature: Poached White Chicken Rice & Roasted Chicken with Spicy Ginger Chilli Dip | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Rice Set with Greens | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "SU10227003": {
        "name": "Bake-Fresh Home Made Specialities",
        "hours": "Tue–Sun 07:30–14:00; Mon: Closed",
        "cuisine": "Traditional Baked Buns & Nonya Pastries",
        "menu_price": "Signature: Freshly Baked Curry Chicken Buns, Red Bean Buns & Custard Buns | Menu: Baked Buns, Egg Tarts, Chiffon Cake, Banana Cake | Price: SGD 1.30–2.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "SU10230003": {
        "name": "Economic Bee Hoon . Nasi Lemak (Shunfu Mart)",
        "hours": "Daily 06:00–13:00",
        "cuisine": "Heartland Breakfast Bee Hoon & Nasi Lemak",
        "menu_price": "Signature: Fragrant Fried Bee Hoon with Crispy Chicken Wing & Coconut Nasi Lemak | Menu: Fried Bee Hoon / Kway Teow, Nasi Lemak, Luncheon Meat, Fish Fillet, Fried Egg | Price: SGD 2.50–5.00",
        "halal": "No",
        "vegan": "No"
    },

    # =========================================================================
    # 3. MEI LING MARKET & FOOD CENTRE (140159)
    # =========================================================================
    "MC10206005": {
        "name": "Amoy St Boon Kee Prawn Noodle (厦门街文记肉骨虾面)",
        "hours": "Tue–Sat 07:00–13:30; Sun–Mon: Closed",
        "cuisine": "Heritage Robust Prawn Noodle Soup & Pork Rib Noodles",
        "menu_price": "Signature: Rich Umami Prawn Broth with Fresh Sea Prawns & Fall-off-the-bone Pork Ribs | Menu: Prawn Noodle (Dry / Soup), Pork Rib Prawn Mee, Pig's Tail Noodle | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "MC10221003": {
        "name": "Ah Pang Steamboat Seafood (亚邦生锅小厨)",
        "hours": "Thu–Mon 15:00–22:00; Tue–Wed: Closed",
        "cuisine": "Traditional Teochew Charcoal Steamboat & Zi Char",
        "menu_price": "Signature: Traditional Charcoal Fish Head Steamboat with Fresh Fish, Yam & Tofu & Salted Egg Prawns | Menu: Fish Head Steamboat (Pomfret / Red Garoupa), Sambal Kang Kong, Prawn Paste Chicken | Price: SGD 20.00–55.00",
        "halal": "No",
        "vegan": "No"
    },
    "MC10211002": {
        "name": "Ho Kee Roasted Duck . Chicken Rice . Noodle (豪记烧鸭鸡饭)",
        "hours": "Tue–Sun 09:00–19:30; Mon: Closed",
        "cuisine": "Cantonese Roasted Duck & Roasted Meats",
        "menu_price": "Signature: Crispy Roasted Duck Rice with Savoury Dark Sauce & Caramelised Char Siew | Menu: Roast Duck Rice, Char Siew Roast Pork Noodle, Wanton Soup, Whole Roast Duck | Price: SGD 4.50–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "MC10218002": {
        "name": "Hill View Yong Tau Foo (山景酿豆腐)",
        "hours": "Daily 07:00–14:30",
        "cuisine": "Handmade Hakka Yong Tau Foo",
        "menu_price": "Signature: Handmade Fishpaste Stuffed Bittergourd, Tofu & Chilli in Savoury Clear Soup or Dry Sweet Sauce | Menu: Yong Tau Foo (Soup / Dry with Noodle / Bee Hoon), Chee Cheong Fun YTF | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "MC10230002": {
        "name": "Dong Cheng Soya Bean Drink (东盛豆花水)",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Traditional Fresh Beancurd & Soya Milk",
        "menu_price": "Signature: Silky Smooth Warm Douhua & Freshly Ground Soya Bean Milk | Menu: Traditional Beancurd, Fresh Soya Milk, Grass Jelly Drink | Price: SGD 1.30–2.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "MC10229003": {
        "name": "He Le Fried Beehoon (合乐炒米粉)",
        "hours": "Daily 06:00–13:30",
        "cuisine": "Traditional Breakfast Economic Bee Hoon",
        "menu_price": "Signature: Traditional Fried Bee Hoon with Crispy Chicken Wings, Otah & Fried Egg | Menu: Fried Bee Hoon / Mee, Crispy Chicken Wing, Fish Cake, Luncheon Meat, Cabbage | Price: SGD 2.50–5.00",
        "halal": "No",
        "vegan": "No"
    },
    "MC10242003": {
        "name": "Heng Long BBQ Chicken Rice",
        "hours": "Daily 09:30–19:30",
        "cuisine": "Roasted Chicken Rice & BBQ Char Siew",
        "menu_price": "Signature: Crispy Roasted Chicken Rice & Honey Glazed Char Siew with Ginger Chilli | Menu: Roasted Chicken Rice, Char Siew Rice, Roasted Pork Belly Rice | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "MC10213003": {
        "name": "Claypot Zhi Char (Mei Ling)",
        "hours": "Daily 11:30–21:00",
        "cuisine": "Claypot Zi Char & Wok-Fried Delicacies",
        "menu_price": "Signature: Sizzling Claypot Tofu with Seafood, Claypot Curry Fish Head & Beef Hor Fun | Menu: Claypot Tofu, Claypot Curry Chicken, Beef Hor Fun, Sambal Kang Kong | Price: SGD 6.00–25.00",
        "halal": "No",
        "vegan": "No"
    },
    "MC10202003": {
        "name": "D Bento (Mei Chin Road)",
        "hours": "Daily 10:30–20:00",
        "cuisine": "Japanese & Korean Hawker Bento Bowls",
        "menu_price": "Signature: Teriyaki Chicken Donburi, Salmon Bento Set & Kimchi Fried Rice | Menu: Teriyaki Chicken Bento, Saba Fish Bento, Beef Yakiniku Don, Kimchi Soup | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },

    # =========================================================================
    # 4. KOVAN HOUGANG 209 MARKET (530209)
    # =========================================================================
    "HG30104003": {
        "name": "Chun Fu Fishball Minced Meat Noodle . Laksa (春福鱼圆肉脞面)",
        "hours": "Wed–Mon 11:00–20:30; Tue: Closed",
        "cuisine": "Teochew Minced Meat Noodles & Coconut Laksa",
        "menu_price": "Signature: Springy Bak Chor Mee tossed in Chilli Vinegar with Fishballs & Rich Fragrant Laksa | Menu: Minced Meat Noodle (Mee Pok / Mee Kia), Fishball Noodle, Laksa, Meatball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "HG30130003": {
        "name": "85 Bedok North Fried Oyster (Kovan 209)",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Traditional Crispy Fried Oyster Omelette",
        "menu_price": "Signature: Crispy Starchy Oyster Omelette (Orh Luak) with Plump Oysters & Tangy Chilli Sauce | Menu: Fried Oyster Omelette (Small / Medium / Large), Oyster Egg | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "HG30116002": {
        "name": "A1 Hainanese Chicken Rice (Kovan)",
        "hours": "Daily 09:30–20:00",
        "cuisine": "Hainanese Steamed & Roasted Chicken Rice",
        "menu_price": "Signature: Silky Steamed White Chicken Rice with Aromatic Rice & Fragrant Ginger Chilli | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Half / Whole Chicken | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "HG30147002": {
        "name": "Fa Ji Dessert (发记甜品)",
        "hours": "Tue–Sun 10:00–21:30; Mon: Closed",
        "cuisine": "Traditional Local Hot & Cold Desserts",
        "menu_price": "Signature: Shaved Ice Kachang with Sweet Red Beans, Attap Chee & Cold Cheng Tng | Menu: Ice Kachang, Chendol, Cheng Tng, Tau Suan with You Tiao, Red Bean Soup | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "HG30114003": {
        "name": "Cold Soya Beancurd (Kovan 209)",
        "hours": "Daily 06:30–21:00",
        "cuisine": "Fresh Chilled Beancurd & Soya Milk",
        "menu_price": "Signature: Chilled Silky Almond Douhua & Fresh Soya Bean Milk Drink | Menu: Traditional Beancurd, Chilled Beancurd, Fresh Soya Milk, Grass Jelly Drink | Price: SGD 1.50–2.80",
        "halal": "No",
        "vegan": "Yes"
    },
    "HG30162004": {
        "name": "Cowboy Charcoal Grill (Kovan 209)",
        "hours": "Daily 11:30–21:30",
        "cuisine": "Hawker Charcoal Grilled Western Food",
        "menu_price": "Signature: Grilled Chicken Chop with Black Pepper Sauce, Garlic Bread & Crinkle-Cut Fries | Menu: Chicken Chop, Pork Chop, Fish & Chips, Prime Sirloin Steak | Price: SGD 7.00–13.50",
        "halal": "No",
        "vegan": "No"
    },
    "HG30132002": {
        "name": "Bedok Cooked Food (Kovan 209)",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Traditional Economic Mixed Rice & Porridge",
        "menu_price": "Signature: Teochew Porridge with Braised Meats, Steamed Fish & Stir-Fried Greens | Menu: Mixed Vegetable Rice, Teochew Porridge, Braised Pork Belly, Fried Fish | Price: SGD 3.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "HG30151002": {
        "name": "Dong Fang Lao Jie Fang (东方老街坊)",
        "hours": "Tue–Sun 07:00–14:30; Mon: Closed",
        "cuisine": "Traditional Cantonese Roasted Meats & Duck Rice",
        "menu_price": "Signature: Crispy Roasted Pork Belly & Roast Duck Rice with Herbal Dark Sauce | Menu: Roast Duck Rice, Char Siew Rice, Roasted Pork Rice, Wanton Soup | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "HG30149002": {
        "name": "Creative Home Dishes (Kovan 209)",
        "hours": "Daily 10:30–20:00",
        "cuisine": "Comforting Chinese Home-Style Dishes",
        "menu_price": "Signature: Steamed Minced Meat with Salted Fish, Sweet & Sour Pork & Lotus Root Soup | Menu: Mixed Rice Dishes, Cantonese Soups, Steamed Egg | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },

    # =========================================================================
    # 5. TELOK BLANGAH CRESCENT MARKET (090011)
    # =========================================================================
    "TB101131003": {
        "name": "ABC Hawker Ah Hua Fishball Noodle (亚华鱼圆面)",
        "hours": "Wed–Mon 07:00–14:00; Tue: Closed",
        "cuisine": "Traditional Teochew Handmade Fishball & Meatball Noodle",
        "menu_price": "Signature: Springy Mee Pok Dry with Fresh Bouncy Fishballs, Seasoned Meatballs & Crispy Lard | Menu: Fishball Noodle (Dry / Soup), Meatball Noodle, Mixed Fishball Meatball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "TB101125003": {
        "name": "Ah Boon Handmade Fishcake (阿文手工鱼饼)",
        "hours": "Tue–Sun 07:00–12:00; Mon: Closed",
        "cuisine": "Heritage Handmade Fresh Fishcakes & Fishballs since 1975",
        "menu_price": "Signature: Freshly Fried Bouncy Handmade Yellowtail Fishcake & Fishballs | Menu: Fried Fishcake (per piece), Steamed Fishcake, Raw Fishballs | Price: SGD 1.50–2.00 per piece",
        "halal": "No",
        "vegan": "No"
    },
    "TB10195003": {
        "name": "Al-Amin Food Stall",
        "hours": "Daily 06:00–20:30",
        "cuisine": "Halal Indian Muslim Cuisine & Roti Prata",
        "menu_price": "Signature: Freshly Tossed Crispy Roti Prata with Mutton Dalcha, Murtabak & Mee Goreng Mamak | Menu: Plain Prata, Egg Prata, Chicken Murtabak, Mee Goreng, Nasi Biryani | Price: SGD 1.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "TB10189003": {
        "name": "BB Curry Rice (BB咖喱饭)",
        "hours": "Tue–Sun 10:30–14:30; Mon: Closed",
        "cuisine": "Traditional Hainanese Curry Rice",
        "menu_price": "Signature: Crispy Hainanese Pork Chop Curry Rice with Stewed Cabbage & Dark Braising Sauce | Menu: Hainanese Curry Rice Set, Crispy Pork Chop, Chap Chye, Curry Chicken | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "TB101127003": {
        "name": "Bou Mun Hong Kong Noodle & Rice (保文香港面饭)",
        "hours": "Wed–Mon 08:00–14:30; Tue: Closed",
        "cuisine": "Cantonese Roasted Meats & Soy Sauce Chicken",
        "menu_price": "Signature: Tender Cantonese Soy Sauce Chicken Noodle & Honey Glazed Char Siew Rice | Menu: Soy Sauce Chicken Rice / Noodle, Char Siew Roast Pork Noodle, Dumpling Soup | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "TB101130003": {
        "name": "Chin Hung Braised Noodles (进丰卤面)",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Traditional Rich Gravy Hokkien Lor Mee",
        "menu_price": "Signature: Thick Spiced Gravy Lor Mee with Fried Fish Nuggets, Ngoh Hiang & Braised Pork Belly | Menu: Lor Mee (Small / Medium / Large), Extra Fried Fish, Braised Egg | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "TB101110003": {
        "name": "Edmond Chicken Rice (爱德蒙鸡饭)",
        "hours": "Daily 09:30–15:30",
        "cuisine": "MUIS Halal Certified Hainanese Chicken Rice",
        "menu_price": "Signature: Halal Certified Steamed White Chicken Rice with Fragrant Chicken Broth Rice & Piquant Chilli | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Rice Set with Greens | Price: SGD 4.00–6.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "TB101128004": {
        "name": "128 Dessert Stall (128冷热甜品)",
        "hours": "Tue–Sun 10:00–19:30; Mon: Closed",
        "cuisine": "Traditional Hot & Cold Shaved Ice Desserts",
        "menu_price": "Signature: Shaved Ice Kachang with Sweet Corn & Attap Chee & Hot Tau Suan with You Tiao | Menu: Ice Kachang, Chendol, Tau Suan, Cheng Tng, Red Bean Soup | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "TB10182003": {
        "name": "Chin Sin Coffee Stall",
        "hours": "Daily 05:30–15:00",
        "cuisine": "Traditional Nanyang Kopi, Teh & Charcoal Toast",
        "menu_price": "Signature: Traditional Nanyang Kopi O, Teh Tarik & Crispy Kaya Butter Toast with Soft-Boiled Eggs | Menu: Kopi, Teh, Charcoal Toast, Soft-Boiled Eggs (2 pcs) | Price: SGD 1.20–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "TB101121002": {
        "name": "Dai Ming Cooked Food (大明熟食)",
        "hours": "Tue–Sun 06:30–13:30; Mon: Closed",
        "cuisine": "Traditional Economic Mixed Rice & Porridge",
        "menu_price": "Signature: Teochew Porridge with Braised Meats, Steamed Egg & Stir-Fried Cabbage | Menu: Economic Mixed Rice, Teochew Porridge, Braised Bean Curd | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "TB101112003": {
        "name": "Economy Snacks (Telok Blangah)",
        "hours": "Daily 06:00–13:00",
        "cuisine": "Traditional Breakfast Fried Bee Hoon & Carrot Cake",
        "menu_price": "Signature: Economical Fried Bee Hoon with Crispy Chicken Wings & Fried Carrot Cake | Menu: Fried Bee Hoon / Mee, Chicken Wing, Fish Cake, Luncheon Meat | Price: SGD 2.50–5.00",
        "halal": "No",
        "vegan": "No"
    },

    # =========================================================================
    # 6. WHAMPOA MAKAN PLACE BLK 90 (320090)
    # =========================================================================
    "WD40138001": {
        "name": "Whampoa Satay Bee Hoon (黄埔沙爹米粉)",
        "hours": "Sat–Thu 12:00–22:00; Fri: Closed",
        "cuisine": "Traditional Rich Nutty Satay Bee Hoon",
        "menu_price": "Signature: Rice Vermicelli drenched in Creamy Spiced Peanut Satay Sauce with Pork Slices, Cuttlefish & Tau Pok | Menu: Satay Bee Hoon (Small / Medium / Large), Cuttlefish Kang Kong | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "WD40135001": {
        "name": "Xinji Congee (新记粥品)",
        "hours": "Daily 06:00–13:30",
        "cuisine": "Traditional Silky Cantonese Porridge",
        "menu_price": "Signature: Smooth Cantonese Pork Porridge with Minced Meatballs & Sliced Fish Congee | Menu: Pork Congee, Century Egg Lean Meat Congee, Fish Porridge, Crispy You Tiao | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD40136001": {
        "name": "Simmer Soup (深火靓汤)",
        "hours": "Daily 11:00–20:30",
        "cuisine": "Traditional Cantonese Double-Boiled Herbal Soups",
        "menu_price": "Signature: Slow-Simmered Lotus Root Pork Rib Soup, Herbal Black Chicken Soup & Watercress Pork Rib Soup | Menu: Lotus Root Rib Soup, Herbal Chicken Soup, Old Cucumber Soup, Steamed White Rice | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD40150001": {
        "name": "Vietnamese Cuisine (Whampoa)",
        "hours": "Daily 10:30–20:30",
        "cuisine": "Authentic Vietnamese Pho & Spring Rolls",
        "menu_price": "Signature: Traditional Beef Sliced Pho Noodle Soup, Grilled Pork Banh Mi & Fresh Summer Spring Rolls | Menu: Beef Pho, Chicken Pho, Banh Mi, Fried Spring Rolls | Price: SGD 6.00–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "WD40108001": {
        "name": "Whampoa Soya Bean (Whampoa Blk 90)",
        "hours": "Daily 06:30–21:30",
        "cuisine": "Michelin Selected Traditional Beancurd & Fresh Soya Milk",
        "menu_price": "Signature: Silky Smooth Fresh Douhua with Sugar Syrup & Fresh Soya Bean Milk Drink | Menu: Traditional Beancurd, Fresh Soya Milk, Grass Jelly Drink, Soya Bean with Grass Jelly | Price: SGD 1.50–3.00",
        "halal": "No",
        "vegan": "Yes"
    },

    # =========================================================================
    # 7. BUKIT MERAH VIEW (151115)
    # =========================================================================
    "BM30178003": {
        "name": "Double Happiness Fried Hokkien Mee (双喜炒福建面)",
        "hours": "Tue–Sun 10:00–14:00; Mon: Closed",
        "cuisine": "Wok-Hei Traditional Fried Hokkien Prawn Mee",
        "menu_price": "Signature: Traditional Fried Hokkien Prawn Mee simmered in Fragrant Prawn Broth with Squid & Sambal | Menu: Fried Hokkien Prawn Mee (Small / Medium / Large) | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30138003": {
        "name": "Happy Duck Braised Duck Rice . Kway Chap (快乐鸭)",
        "hours": "Fri–Wed 08:30–20:00 (Sun 08:30–13:30); Thu: Closed",
        "cuisine": "Teochew Braised Duck Rice & Traditional Kway Chap",
        "menu_price": "Signature: Tender Braised Duck Rice with Dark Herbal Sauce & Kway Chap Platter with Braised Pork Belly | Menu: Braised Duck Rice Set, Kway Chap, Braised Tofu & Egg, Duck Porridge | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30134003": {
        "name": "Weng Kee Hainan Boneless Chicken Rice (荣记海南鸡饭)",
        "hours": "Tue–Sun 09:30–19:30; Mon: Closed",
        "cuisine": "Hainanese Boneless Steamed & Roasted Chicken Rice",
        "menu_price": "Signature: Silky Boneless Steamed Chicken with Fragrant Rice & Fiery Ginger Chilli Sauce | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Rice Set with Greens | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30136003": {
        "name": "Hock Ann Prawn Noodle / Lor Mee (福安虾面卤面)",
        "hours": "Daily 07:00–14:30",
        "cuisine": "Traditional Prawn Noodles & Rich Starchy Lor Mee",
        "menu_price": "Signature: Robust Prawn Noodle Soup with Sea Prawns & Dark Gravy Lor Mee with Crispy Ngoh Hiang | Menu: Prawn Noodle (Dry / Soup), Lor Mee, Pork Rib Noodle | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30177003": {
        "name": "Hong Kee Porridge (鸿记粥品)",
        "hours": "Daily 05:00–11:00",
        "cuisine": "Early Morning Traditional Silky Cantonese Porridge",
        "menu_price": "Signature: Thick Cantonese Grain Porridge with Handmade Meatballs, Century Egg & Sliced Fish | Menu: Pork Congee with Egg, Century Egg Lean Meat Porridge, Fish Porridge, Crispy You Tiao | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "BM30102003": {
        "name": "Yusoff Indian Muslim Food",
        "hours": "Daily 06:00–20:30",
        "cuisine": "Halal Indian Muslim Mutton Soup, Mee & Briyani",
        "menu_price": "Signature: Peppery Sup Kambing (Mutton Soup) with French Loaf, Mee Goreng & Mutton Nasi Biryani | Menu: Sup Kambing, Mee Goreng Mamak, Nasi Biryani (Chicken / Mutton), Roti Prata | Price: SGD 2.00–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "BM30175003": {
        "name": "Yamin Nasi Padang",
        "hours": "Tue–Sun 07:00–15:00; Mon: Closed",
        "cuisine": "Authentic Halal Malay Nasi Padang",
        "menu_price": "Signature: Authentic Nasi Padang with Beef Rendang, Sambal Goreng, Ayam Masak Merah & Bergedil | Menu: Nasi Padang Dishes, Sayur Lodeh, Sambal Sotong, Telur Belado | Price: SGD 4.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "BM30152002": {
        "name": "Fahzilaah Halal Food",
        "hours": "Daily 06:30–19:30",
        "cuisine": "Halal Malay Breakfast & Mee Rebus",
        "menu_price": "Signature: Comforting Mee Rebus with Sweet Potato Gravy, Lontong & Nasi Lemak with Sambal Ikan Bilis | Menu: Mee Rebus, Mee Siam, Lontong, Nasi Lemak Chicken Wing | Price: SGD 3.50–5.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "BM30125006": {
        "name": "Xishifu Vegetarian Food Court (喜师父素食)",
        "hours": "Daily 06:00–14:00",
        "cuisine": "Traditional Chinese Vegetarian & Vegan Bee Hoon",
        "menu_price": "Signature: Vegetarian Economic Bee Hoon with Crispy Zhai Er, Mock Char Siew & Stir-Fried Cabbage | Menu: Vegetarian Bee Hoon, Vegetarian Lor Mee, Vegetarian Laksa, Spring Roll | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "BM30166003": {
        "name": "Vegetarian (Bukit Merah View)",
        "hours": "Tue–Sun 06:30–13:30; Mon: Closed",
        "cuisine": "Traditional Chinese Vegetarian Breakfast",
        "menu_price": "Signature: Fried Vegetarian Bee Hoon with Mock Duck & Beancurd Crackers | Menu: Vegetarian Bee Hoon / Noodles, Mock Meats, Stewed Cabbage | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "BM30113004": {
        "name": "Gu Zao Cuo Bing (古早锉冰)",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Traditional Old-School Shaved Ice Desserts",
        "menu_price": "Signature: Mountain Shaved Ice Kachang with Sweet Red Beans, Attap Chee & Classic Chendol | Menu: Ice Kachang, Chendol, Grass Jelly with Longan, Tau Suan | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "BM30142003": {
        "name": "Qing Tian Leng Re Tian Pin (晴天冷热甜品)",
        "hours": "Wed–Sun 11:30–19:30; Mon–Tue: Closed",
        "cuisine": "Traditional Hot & Cold Sweets",
        "menu_price": "Signature: Refreshing Cold Cheng Tng with Ginkgo Nuts & Hot Tau Suan with Crispy You Tiao | Menu: Cheng Tng, Tau Suan, Red Bean Soup, Ice Kachang | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "BM30180003": {
        "name": "Wrap 8 Roll Pancake",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Traditional Min Jiang Kueh & Crispy Waffles",
        "menu_price": "Signature: Fluffy Traditional Min Jiang Kueh with Crushed Peanuts & Red Bean Paste | Menu: Peanut Pancake, Red Bean Pancake, Coconut Pancake | Price: SGD 1.20–1.60",
        "halal": "No",
        "vegan": "Vegan-friendly"
    }
}
