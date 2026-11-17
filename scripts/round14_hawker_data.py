#!/usr/bin/env python3
"""
Round 14 hawker and food court enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers iconic stalls across:
- Tanjong Pagar Plaza (081006)
- Beauty World Centre (588177)
- Berseh Food Centre (208877)
- Dunman Food Centre (424768)
- Pasir Panjang Food Centre (118543)
- Zion Riverside Food Centre (247792)
"""

NEW_LICENCE_ENTRIES_ROUND14 = {
    # ==========================================
    # 1. TANJONG PAGAR PLAZA (081006)
    # ==========================================
    "TJ20215003": {
        "name": "Rolina Traditional Hainanese Curry Puff",
        "hours": "Tue–Sun 07:00–15:00; Mon: Closed",
        "cuisine": "Michelin Bib Gourmand Hainanese Handmade Curry Puff",
        "menu_price": "Signature: Michelin Bib Gourmand Traditional Hainanese Curry Chicken Puff & Sardine Puff | Menu: Curry Chicken Puff, Sardine Puff | Price: SGD 1.80–2.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9235 8093"
    },
    "TJ20220004": {
        "name": "Kueh Ho Jiak",
        "hours": "Daily 07:30–14:00",
        "cuisine": "Michelin Selected Halal Traditional Nanyang Peranakan Kueh",
        "menu_price": "Signature: Michelin Selected Sweet Potato Ang Ku Kueh, Rainbow Lapis, Kueh Salat & Yam Cake | Menu: Ang Ku Kueh (Peanut, Green Bean, Yam, Durian), Kueh Salat, Ondeh Ondeh, Kueh Lapis, Yam Cake, Chee Cheong Fun | Price: SGD 1.60–4.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly",
        "contact": "+65 8721 1169",
        "website": "https://kuehhojiak.com"
    },
    "TJ20214004": {
        "name": "Generation Coffee Roasters",
        "hours": "Mon–Sat 07:30–10:30, 11:00–15:00; Sun: Closed",
        "cuisine": "Specialty Coffee & Nanyang Kopi Fusion",
        "menu_price": "Signature: Dirty White, Kopi C, Flat White & Biscoff Latte | Menu: Espresso, Americano, Flat White, Dirty Matcha, Traditional Kopi O, Kopi C, Cold Brew | Price: SGD 2.00–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly",
        "website": "https://generationcoffee.sg"
    },
    "TJ20237003": {
        "name": "Fu Hai Curry Chicken Noodle",
        "hours": "Sat–Thu 07:30–14:00; Fri: Closed",
        "cuisine": "Hainanese Curry Chicken Noodle",
        "menu_price": "Signature: Aromatic Hainanese Curry Chicken Noodle with Tau Pok & Potatoes | Menu: Curry Chicken Noodle, Curry Chicken Bee Hoon, Curry Chicken Rice | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "TJ20221003": {
        "name": "Traditional Hakka Rice",
        "hours": "Mon–Fri 09:30–15:00; Sat 09:30–14:00; Sun: Closed",
        "cuisine": "Traditional Hakka Lei Cha (Thunder Tea Rice)",
        "menu_price": "Signature: Authentic Hakka Thunder Tea Rice (Lei Cha) with Brown Rice & Handmade Yong Tau Foo | Menu: Thunder Tea Rice (White / Brown Rice), Bittergourd Yong Tau Foo, Stuffed Tofu, Meatball Soup | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "TJ20229003": {
        "name": "Blue Star Fishball Mushroom Minced Meat Noodle",
        "hours": "Mon–Fri 08:00–20:00; Sat 08:00–16:00; Sun: Closed",
        "cuisine": "Teochew Fishball & Bak Chor Mee",
        "menu_price": "Signature: Handmade Fishball Noodle, Teochew Minced Meat Noodle (Bak Chor Mee) & Fish Cake | Menu: Fishball Noodle (Dry / Soup), Minced Meat Noodle, Meatball Soup, Fish Dumpling Noodle | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "TJ20204003": {
        "name": "Rong Xing Cooked Food",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Handmade Hakka Yong Tau Foo",
        "menu_price": "Signature: Handmade Hakka Yong Tau Foo with Bittergourd, Chilli, Tau Pok & Meatballs in Clear Broth or Dry Sweet Sauce | Menu: Yong Tau Foo Set with Bee Hoon, Yellow Noodles, Kway Teow, Stuffed Tauhu, Bittergourd | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9625 2147"
    },
    "TJ20252004": {
        "name": "Wei Wei Carrot Cake",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Teochew Fried Carrot Cake",
        "menu_price": "Signature: Fragrant Wok Hei Black & White Fried Carrot Cake with Chai Poh & Eggs | Menu: White Fried Carrot Cake, Black Fried Carrot Cake, Yuan Yang Carrot Cake | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "TJ20223002": {
        "name": "Ah Teck Coffee Stall",
        "hours": "Sat–Thu 06:00–15:00; Fri: Closed",
        "cuisine": "Traditional Nanyang Kopi & Toast",
        "menu_price": "Signature: Hand-Brewed Traditional Nanyang Kopi, Teh Tarik & Charcoal Toasted Kaya Butter Bread | Menu: Kopi O, Kopi C, Teh O, Teh C, Milo, Kaya Butter Toast, Soft-Boiled Eggs | Price: SGD 1.20–3.00",
        "halal": "No",
        "vegan": "No"
    },
    "TJ20201006": {
        "name": "Two Guys",
        "hours": "Mon–Fri 09:00–15:00; Sat–Sun: Closed",
        "cuisine": "Western & Japanese Rice Bowls",
        "menu_price": "Signature: Crispy Fried Chicken Cutlet Rice Bowl, Teriyaki Chicken Don & Grilled Pork Chop | Menu: Chicken Cutlet Don, Pork Chop Rice, Teriyaki Salmon Don, Chicken Chop Western Set | Price: SGD 6.50–9.90",
        "halal": "No",
        "vegan": "No"
    },
    "TJ20205002": {
        "name": "Yao Japanese Rice House",
        "hours": "Mon–Fri 09:30–15:30; Sat–Sun: Closed",
        "cuisine": "Japanese Donburi & Curry Rice",
        "menu_price": "Signature: Japanese Chicken Katsu Curry Rice, Salmon Teriyaki Don & Oyako Don | Menu: Chicken Katsu Don, Pork Katsu Curry, Teriyaki Salmon Don, Gyoza | Price: SGD 5.80–8.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9188 5650"
    },
    "TJ20213002": {
        "name": "Sunny Vegetarian",
        "hours": "Wed–Mon 07:00–14:30; Tue: Closed",
        "cuisine": "Vegetarian & Vegan Chinese Hawker Food",
        "menu_price": "Signature: Vegetarian Bee Hoon with Crispy Beancurd Skin, Mock Char Siew & Spring Roll | Menu: Vegetarian Economical Bee Hoon, Vegetarian Chicken Rice, Vegetarian Laksa, Lor Mee | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "Yes",
        "contact": "+65 9181 3341"
    },
    "TJ20234003": {
        "name": "Ipoh Zai Prawn Mee",
        "hours": "Daily 08:00–14:30",
        "cuisine": "Ipoh Style Prawn Noodles & Pork Ribs Soup",
        "menu_price": "Signature: Rich Ipoh Prawn Noodle Broth with Big Prawns, Pork Ribs & Fried Pork Lard | Menu: Ipoh Prawn Noodle (Dry / Soup), Big Prawn Noodle, Pork Ribs Prawn Noodle, Prawn Soup | Price: SGD 5.00–9.00",
        "halal": "No",
        "vegan": "No"
    },
    "TJ20251003": {
        "name": "Koffee Kollective",
        "hours": "Daily 08:30–15:00",
        "cuisine": "Artisanal Specialty Coffee & Matcha",
        "menu_price": "Signature: Handcrafted Flat White, Iced Oat Dirty Matcha, Einspanner & Espresso | Menu: Espresso, Long Black, Latte, Flat White, Dirty Matcha, Cold Brew, Oat Milk options | Price: SGD 3.00–6.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
        "website": "https://koffeekollectivesg.com"
    },
    "TJ20239003": {
        "name": "Makan Sutera Nasi Lemak Pandan Rice",
        "hours": "Mon–Sat 06:30–14:00; Sun: Closed",
        "cuisine": "Fragrant Pandan Nasi Lemak",
        "menu_price": "Signature: Natural Pandan Fragrant Coconut Rice with Crispy Chicken Wing, Otah, Fish Fillet & Sambal | Menu: Chicken Wing Set, Fish Set, Otah Set, Begedil, Sambal Egg | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 2. BEAUTY WORLD CENTRE (588177)
    # ==========================================
    "C02105A018": {
        "name": "Top 1 Home Made Noodle",
        "hours": "Thu–Tue 11:00–18:30; Wed: Closed",
        "cuisine": "Handmade Ban Mian & Mee Hoon Kueh",
        "menu_price": "Signature: Handmade Ban Mian, Mee Hoon Kueh, You Mian with Minced Meat, Prawn & Fish Maw | Menu: Ban Mian (Dry / Soup), Mee Hoon Kueh, Tom Yum Ban Mian, Mala Ban Mian, Clam Abalone Noodle | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 8299 8755"
    },
    "C02105A011": {
        "name": "Buta Kin",
        "hours": "Mon–Fri 10:00–21:10; Sat–Sun 09:30–21:10",
        "cuisine": "Japanese Tonkotsu Ramen & Curry Rice",
        "menu_price": "Signature: Tonkotsu Special Ramen with Chashu, Black Garlic Ramen & Japanese Curry Pork Katsu Rice | Menu: Tonkotsu Ramen, Tonkotsu Red Ramen, Tonkotsu Black Ramen, Japanese Curry Rice, Ajitama Egg | Price: SGD 6.00–9.90",
        "halal": "No",
        "vegan": "No"
    },
    "C02105A006": {
        "name": "You Peng Dumpling House",
        "hours": "Thu–Tue 10:30–21:00; Wed: Closed",
        "cuisine": "Handmade Northern Chinese Dumplings & La Mian",
        "menu_price": "Signature: Handmade Xiao Long Bao, Pan-Fried Guo Tie Dumplings & Spicy Sour Soup La Mian | Menu: Steamed Xiao Long Bao, Pan-Fried Pork Dumplings (Guo Tie), Zha Jiang Mian, Dan Dan Mian, Hot & Sour Soup | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9798 2211"
    },
    "SW26F66E000": {
        "name": "Ye Tang Chendol",
        "hours": "Wed–Sun 11:00–20:45; Mon–Tue: Closed",
        "cuisine": "Michelin Selected Artisanal Traditional Chendol",
        "menu_price": "Signature: Michelin Selected Traditional Chendol with Gula Melaka, Red Bean Chendol & D24 Durian Chendol | Menu: Original Chendol, Red Bean Chendol, Sweet Corn Chendol, D24 Durian Chendol | Price: SGD 2.50–4.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "C02105A033": {
        "name": "Pink Candy",
        "hours": "Wed–Mon 10:30–14:30, 17:00–21:30; Tue: Closed",
        "cuisine": "Authentic Korean Hawker Cuisine",
        "menu_price": "Signature: Rooftop Garden Korean Army Stew, Apple Wood Smoked Pork Belly & Kimchi Pancake | Menu: Budae Jjigae (Army Stew), Kimchi Fried Rice, Bibimbap, Japchae, Seafood Pancake, Ginseng Chicken Soup | Price: SGD 7.90–19.90",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9170 2365"
    },
    "C02105A002": {
        "name": "Beauty World Wanton Noodle",
        "hours": "Daily 10:30–21:00",
        "cuisine": "Traditional Wanton Noodle",
        "menu_price": "Signature: Springy Egg Noodles with Tender Char Siew, Plump Dumplings & Crispy Fried Wantons | Menu: Wanton Mee (Dry / Soup), Dumpling Noodle, Shredded Chicken Hor Fun | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "C83269E000": {
        "name": "Eng Kee Chicken Wings",
        "hours": "Tue–Sun 08:00–20:00; Mon: Closed",
        "cuisine": "Iconic Crispy Fried Chicken Wings & Economic Bee Hoon",
        "menu_price": "Signature: Famous Crispy Fried Chicken Wings & Stir-Fried Economic Bee Hoon | Menu: Fried Chicken Wing, Economic Bee Hoon, Fried Kway Teow, Otah, Fishcake, Fried Egg | Price: SGD 1.60–4.50",
        "halal": "No",
        "vegan": "No"
    },
    "SW16G35C000": {
        "name": "Beauty World Niang Re Gao",
        "hours": "Mon–Sat 09:00–19:00; Sun 09:00–15:00",
        "cuisine": "Traditional Nyonya Handmade Kueh",
        "menu_price": "Signature: Handmade Ang Ku Kueh, Kueh Salat, Ondeh Ondeh, Yam Cake & Tapioca Cake | Menu: Ang Ku Kueh (Peanut, Bean Paste), Kueh Salat, Kueh Lapis, Yam Cake, Pulut Inti, Soon Kueh | Price: SGD 1.20–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "C02105A041": {
        "name": "Hong Lim Curry Puff",
        "hours": "Daily 10:00–19:00",
        "cuisine": "Handmade Crispy Layered Crust Curry Puff",
        "menu_price": "Signature: Crispy Flaky Pastry Curry Chicken Puff with Egg & Sardine Puff | Menu: Curry Chicken Puff, Sardine Puff, Yam Puff | Price: SGD 1.80–2.20",
        "halal": "No",
        "vegan": "No"
    },
    "C02105A023": {
        "name": "Kopifellas Express",
        "hours": "Thu–Tue 07:30–16:30; Wed: Closed",
        "cuisine": "Modern Nanyang Kopi & Butter Toast",
        "menu_price": "Signature: Nanyang Kopi Gu You (Butter Coffee), Honey Butter Toast & Smoked Duck Lor Mee | Menu: Kopi, Kopi C, Kopi O, Teh, Butter Toast, Matcha Toast, Half Boiled Eggs | Price: SGD 1.60–4.00",
        "halal": "No",
        "vegan": "No",
        "website": "https://kopifellas.com.sg"
    },
    "C02105A003": {
        "name": "Hong Wen Mutton Soup",
        "hours": "Thu–Tue 11:00–15:30; Wed: Closed",
        "cuisine": "Hainanese Herbal Mutton Soup",
        "menu_price": "Signature: Rich Hainanese Herbal Mutton Soup with Tender Ribs & Tau Pok | Menu: Herbal Mutton Soup, Mutton Ribs Soup, Mutton Tendon Soup, White Rice | Price: SGD 7.00–12.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 3. BERSEH FOOD CENTRE (208877)
    # ==========================================
    "BSF034004": {
        "name": "Fu Zhou Poh Hwa Oyster Cake",
        "hours": "Wed–Mon 10:30–18:00; Tue: Closed",
        "cuisine": "Heritage Fuzhou Deep-Fried Oyster Cake",
        "menu_price": "Signature: Heritage Crispy Fuzhou Oyster Cake with Pork, Prawns, Oysters & Peanuts | Menu: Traditional Oyster Cake | Price: SGD 2.80–3.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 8112 5286"
    },
    "BSF040005": {
        "name": "Fu He Delights",
        "hours": "Sat–Thu 11:00–20:00; Fri: Closed",
        "cuisine": "Michelin Selected Herbal Turtle Soup & Herbal Soups",
        "menu_price": "Signature: Michelin Selected Herbal Turtle Soup, Ten Tonic Black Chicken Soup & Frog Legs Herbal Soup | Menu: Herbal Turtle Soup, Herbal Frog Legs Soup, Black Chicken Soup, Yam Rice | Price: SGD 9.00–25.00",
        "halal": "No",
        "vegan": "No"
    },
    "BSF043002": {
        "name": "Coffee Hut",
        "hours": "Mon–Fri 07:00–13:30; Sun 07:00–12:00; Sat: Closed",
        "cuisine": "Traditional Nanyang Kopi & Kaya Toast",
        "menu_price": "Signature: Aromatic Sock-Pulled Traditional Kopi, Kaya Butter Baguette & French Toast | Menu: Kopi, Kopi C, Kopi O, Teh, Kaya Butter Toast, French Toast, Half-Boiled Eggs | Price: SGD 1.20–3.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9798 2596"
    },
    "BSF009003": {
        "name": "Aunty Sham Ayam Penyet",
        "hours": "Tue–Sat 08:00–19:00; Sun–Mon: Closed",
        "cuisine": "Halal Indonesian Ayam Penyet & Nasi Padang",
        "menu_price": "Signature: Crispy Smashed Fried Chicken Ayam Penyet with Sambal Belacan & Ikan Penyet | Menu: Ayam Penyet, Ikan Kembong Penyet, Ayam Panggang, Nasi Goreng, Tahu Tempe | Price: SGD 5.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "BSF039003": {
        "name": "Kelantan Kway Chap • Pig's Organ Soup",
        "hours": "Tue–Sun 07:30–19:00; Mon: Closed",
        "cuisine": "Michelin Selected Teochew Kway Chap & Pig's Organ Soup",
        "menu_price": "Signature: Michelin Selected Teochew Kway Chap Set with Braised Pork Belly, Intestines, Tau Pok, Egg & Peppery Pig's Organ Soup | Menu: Kway Chap Set, Pig's Organ Soup, Braised Pig Trotter, Preserved Vegetables | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 8299 8755"
    },
    "BSF044003": {
        "name": "Mei Xiang Black & White Fish Soup",
        "hours": "Sun–Fri 11:30–14:30; Sat: Closed",
        "cuisine": "Teochew Black & White Sliced and Fried Fish Soup",
        "menu_price": "Signature: Black & White Fish Soup (Fried Fish & Sliced Fresh Fish) with Special Chilli Dip & Yam Rice | Menu: Black & White Fish Soup, Sliced Fish Soup, Fried Fish Soup, Yam Rice | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9789 6079"
    },
    "BSF037003": {
        "name": "Lao Liang",
        "hours": "Tue–Sun 11:00–14:30; Mon: Closed",
        "cuisine": "Heritage Teochew Pig Trotter Jelly & Shark Meat",
        "menu_price": "Signature: Heritage Chilled Teochew Pig Trotter Jelly, Shark Meat with Plum Sauce & Braised Duck Rice | Menu: Pig Trotter Jelly, Shark Meat Platter, Braised Duck Rice, Braised Pork Belly | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "BSF008003": {
        "name": "Sedap Thai",
        "hours": "Mon–Sat 16:30–21:30; Sun: Closed",
        "cuisine": "Halal Thai Mookata BBQ & Steamboat",
        "menu_price": "Signature: Halal Certified Thai Mookata Platter with Marinated Chicken, Beef, Prawns & Tom Yum Soup | Menu: 2-Pax Mookata Platter, Beef Slices, Chicken Slices, Garlic Chicken, Prawns, Enoki, Cheese Tofu, Mama Tom Yum Noodles | Price: SGD 15.00–35.00",
        "halal": "Yes",
        "vegan": "No",
        "contact": "+65 8298 3579"
    },
    "BSF057003": {
        "name": "New World Mutton Soup",
        "hours": "Wed–Mon 10:30–19:30; Tue: Closed",
        "cuisine": "Traditional Chinese Herbal Mutton Soup",
        "menu_price": "Signature: Heritage Teochew Herbal Mutton Ribs Soup, Mutton Tendon & Stomach Soup | Menu: Mutton Ribs Soup, Mutton Meatball Soup, Mutton Tendon Soup, Mutton Tripe Soup, White Rice | Price: SGD 7.00–14.00",
        "halal": "No",
        "vegan": "No"
    },
    "BSF045004": {
        "name": "Sheng Kee Curry Chicken Noodle",
        "hours": "Tue–Sun 06:00–15:30; Mon: Closed",
        "cuisine": "Hainanese Curry Chicken Noodle",
        "menu_price": "Signature: Fragrant Hainanese Curry Chicken Noodles with Sliced Potatoes & Sponge Tau Pok | Menu: Curry Chicken Noodle, Curry Chicken Bee Hoon, Curry Chicken Rice | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "BSF035003": {
        "name": "Jin You Yuan Healthy Vegetarian",
        "hours": "Tue–Sun 11:30–19:30; Mon: Closed",
        "cuisine": "Vegetarian & Vegan Chinese Zi Char",
        "menu_price": "Signature: Vegetarian Claypot Rice, Vegetarian Wok Hei Hor Fun & Sambal Sweet Potato Leaves | Menu: Vegetarian Hor Fun, Vegetarian Fried Rice, Claypot Rice, Tom Yum Soup, Sweet & Sour Mock Meat | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "Yes",
        "contact": "+65 9625 2147"
    },
    "BSF017002": {
        "name": "Special Chilli Yong Tau Foo",
        "hours": "Sat–Wed 06:00–12:30; Thu–Fri: Closed",
        "cuisine": "Handmade Hakka Yong Tau Foo with Signature Chilli",
        "menu_price": "Signature: Handmade Fresh Fish Paste Yong Tau Foo with Fiery Grinded Chilli Paste & Clear Soy Broth | Menu: Yong Tau Foo (Min 6 pieces), Bittergourd, Chilli, Tauhu, Fishball, Chee Cheong Fun, Kway Teow | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "BSF013004": {
        "name": "Nasi Lemak Ayam Taliwang",
        "hours": "Tue–Sun 07:30–19:30; Mon: Closed",
        "cuisine": "Michelin Bib Gourmand Halal Indonesian Nasi Lemak Ayam Taliwang",
        "menu_price": "Signature: Michelin Bib Gourmand Grilled Ayam Taliwang Nasi Lemak with Spicy Sambal & Peanut Anchovies | Menu: Nasi Lemak Ayam Taliwang, Nasi Lemak Ayam Bakar Kecap, Nasi Lemak Sambal Fish, Begedil | Price: SGD 6.50–9.90",
        "halal": "Yes",
        "vegan": "No",
        "contact": "+65 8750 5240"
    },

    # ==========================================
    # 4. DUNMAN FOOD CENTRE (424768)
    # ==========================================
    "DUF0219002": {
        "name": "Dunman Road Char Siew Wanton Noodle",
        "hours": "Thu–Tue 09:30–16:30; Wed: Closed",
        "cuisine": "Heritage Spicy Char Siew Wanton Mee",
        "menu_price": "Signature: Springy Egg Noodles with Fiery Chili Sauce, Caramelized Char Siew & Plump Boiled Wantons | Menu: Char Siew Wanton Mee (Dry / Soup), Fried Wanton, Dumpling Soup | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9187 0698"
    },
    "DUF0214003": {
        "name": "Lau Hong Ser Rojak",
        "hours": "Mon–Sat 16:30–01:30; Sun: Closed",
        "cuisine": "Charcoal-Grilled Traditional Chinese Rojak",
        "menu_price": "Signature: Charcoal-Toasted You Tiao & Tau Pok Chinese Rojak with Crushed Peanuts, Century Egg & Hand-Stirred Hae Ko (Prawn Paste) | Menu: Traditional Rojak, Extra You Tiao, Extra Century Egg, Extra Cuttlefish | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6346 6515"
    },
    "DUF0106004": {
        "name": "Gina's Vadai",
        "hours": "Wed–Fri 09:00–15:00; Sat–Sun 09:00–15:30; Mon–Tue: Closed",
        "cuisine": "Halal Crispy Crispy Prawn Vadai & Traditional Vadai",
        "menu_price": "Signature: Heritage Crispy Prawn Vadai, Dhal Vadai, Ikan Bilis Vadai & Cheese Vadai with Fresh Green Chili | Menu: Crispy Prawn Vadai, Vegetable Vadai, Dhal Vadai, Ikan Bilis Vadai, Cheese Vadai | Price: SGD 1.20–2.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly",
        "contact": "+65 8577 0000",
        "website": "https://ginasvadai.com"
    },
    "DUF0110003": {
        "name": "Dunman Duck Rice",
        "hours": "Sat–Thu 09:00–18:00; Fri: Closed",
        "cuisine": "Teochew Braised Duck Rice & Porridge",
        "menu_price": "Signature: Tender Teochew Braised Duck Rice with Braised Egg, Tau Pok & Herbal Soup | Menu: Braised Duck Rice, Duck Porridge, Duck Kway Teow, Braised Duck Platter | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9819 1238"
    },
    "DUF0217002": {
        "name": "Jia Dong Shu Shi",
        "hours": "Tue–Sun 11:30–18:00; Mon: Closed",
        "cuisine": "Traditional Handmade Popiah & Fried Carrot Cake",
        "menu_price": "Signature: Handmade Skin Nonya Popiah with Turnip, Crispy Bits, Egg & Sweet Bean Sauce | Menu: Traditional Popiah, White Fried Carrot Cake, Black Fried Carrot Cake | Price: SGD 2.50–5.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "DUF0229005": {
        "name": "Lin's Braised",
        "hours": "Sun–Fri 11:00–20:00; Sat: Closed",
        "cuisine": "Taiwanese Lu Rou Fan & Teochew Fish Soup",
        "menu_price": "Signature: Taiwanese Braised Pork Rice (Lu Rou Fan) with Lava Egg & Sliced Batang Fish Soup | Menu: Lu Rou Fan, Braised Pork Belly Rice, Batang Fish Soup, Seafood Soup, Fried Fish Soup | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 8868 6238"
    },
    "DUF0104003": {
        "name": "Joo Chiat Ah Huat Wanton Noodle",
        "hours": "Tue–Sun 07:00–15:00; Mon: Closed",
        "cuisine": "Old-School Wanton Mee",
        "menu_price": "Signature: Springy Egg Noodles with Lard Oil, Sliced Char Siew & Fried Wanton Dumplings | Menu: Wanton Mee (Dry / Soup), Dumpling Soup, Fried Wantons | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "DUF0108003": {
        "name": "First Delight 一品佳",
        "hours": "Wed–Sun 09:00–16:00; Tue 10:00–16:00; Mon: Closed",
        "cuisine": "Traditional Handmade Teochew Kueh & Chee Cheong Fun",
        "menu_price": "Signature: Handmade Soon Kueh, Ku Chai Kueh (Chives), Yam Cake & Fresh Chee Cheong Fun | Menu: Soon Kueh, Ku Chai Kueh, Yam Cake, Pumpkin Cake, Chee Cheong Fun, Glutinous Rice | Price: SGD 1.30–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 5. PASIR PANJANG FOOD CENTRE (118543)
    # ==========================================
    "PPF0114007": {
        "name": "Ivy's Hainanese Herbal Mutton Soup",
        "hours": "Mon–Fri 11:30–19:30; Sat 11:30–15:00; Sun: Closed",
        "cuisine": "Heritage Hainanese Herbal Mutton Soup",
        "menu_price": "Signature: Fragrant Traditional Hainanese Herbal Mutton Soup with Tau Pok, Black Fungus & Wolfberries | Menu: Herbal Mutton Ribs Soup, Mutton Meatballs Soup, Mutton Tendon Soup, White Rice | Price: SGD 9.00–16.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9818 8019"
    },
    "PPF0101003": {
        "name": "Al-Ehsan",
        "hours": "Mon–Fri 05:00–14:00; Sat–Sun: Closed",
        "cuisine": "Halal Malay Nasi Padang & Lontong",
        "menu_price": "Signature: Fragrant Lontong with Sayur Lodeh, Sambal Goreng, Beef Rendang & Nasi Padang | Menu: Lontong, Mee Rebus, Mee Siam, Nasi Lemak, Beef Rendang, Ayam Masak Merah | Price: SGD 3.50–6.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "PPF0104003": {
        "name": "Lucky BBQ Seafood",
        "hours": "Daily 17:00–00:30",
        "cuisine": "Zichar & BBQ Sambal Seafood",
        "menu_price": "Signature: Sambal BBQ Stingray on Banana Leaf, Sambal Lala Clams & Cereal Prawns | Menu: BBQ Stingray, BBQ Sotong, Sambal Kang Kong, Gong Gong, Fried Rice | Price: SGD 12.00–30.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9845 2828"
    },
    "PPF0109009": {
        "name": "Ah Tiam Curry Rice",
        "hours": "Mon–Fri 06:30–15:00; Sat–Sun: Closed",
        "cuisine": "Hainanese Curry Rice",
        "menu_price": "Signature: Crispy Hainanese Pork Chop Curry Rice with Braised Cabbage, Fried Egg & Chap Chye | Menu: Hainanese Curry Rice with Pork Chop, Braised Pork Belly, Curry Chicken Wing, Braised Cabbage | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "PPF0121003": {
        "name": "Yusoff Haji Jalal Satay",
        "hours": "Wed–Sun 18:00–22:00; Mon–Tue: Closed",
        "cuisine": "Halal Malay Charcoal-Grilled Satay",
        "menu_price": "Signature: Heritage Charcoal-Grilled Chicken, Mutton, Beef Satay & Tripe with Peanut Sauce & Ketupat | Menu: Chicken Satay, Mutton Satay, Beef Satay, Babat (Tripe) Satay, Ketupat | Price: SGD 0.90–1.20 per stick (min 10 sticks)",
        "halal": "Yes",
        "vegan": "No",
        "contact": "+65 9005 3858"
    },
    "PPF0127003": {
        "name": "Hajjah Syed Meeral",
        "hours": "Daily 24 Hours",
        "cuisine": "Halal Indian Muslim & Mamak Cuisine",
        "menu_price": "Signature: Crispy Roti Prata, Mee Goreng Mamak, Murtabak & Teh Tarik | Menu: Plain Prata, Egg Prata, Cheese Prata, Mutton Murtabak, Mee Goreng, Nasi Goreng, Maggi Goreng, Teh Tarik | Price: SGD 1.50–8.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 6. ZION RIVERSIDE FOOD CENTRE (247792)
    # ==========================================
    "ZRF0120003": {
        "name": "Riverside Good Food",
        "hours": "Wed–Mon 11:30–22:30; Tue 11:30–18:00",
        "cuisine": "Wok Hei Fried Hokkien Mee & Oyster Omelette",
        "menu_price": "Signature: Wok Hei Fried Hokkien Prawn Mee with Rich Broth & Crispy Oyster Omelette | Menu: Fried Hokkien Prawn Mee, White Char Kway Teow, Oyster Omelette, Fried Carrot Cake | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    }
}
