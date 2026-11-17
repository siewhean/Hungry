#!/usr/bin/env python3
"""
Round 9 hawker enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers:
- Old Airport Road Food Centre (390051)
- Maxwell Food Centre (069184)
- Bedok 85 Fengshan (460085)
- ABC Brickworks (150006)
- Alexandra Village (150120)
- Clementi 448 (120448)
- Ghim Moh Market (270020)
- Changi Village (500002)
- Zion Riverside Food Centre (247792)
- Pek Kio Market & Food Centre (211041)
- Teck Ghee Court Blk 341 (560341)
- Marine Parade Central (440084)
- Chinatown Complex (050335)
- Golden Mile Food Centre (199583)
- Tekka Centre (210665)
"""

NEW_HAWKER_ENTRIES_ROUND9 = {
    # ==========================================
    # 1. OLD AIRPORT ROAD FOOD CENTRE (390051)
    # ==========================================
    ("390051", (1, 126)): {
        "name": "Wang Wang Crispy Curry Puff",
        "hours": "Tue–Sun 10:00–16:00; Mon: Closed",
        "cuisine": "Traditional Pastries & Snacks",
        "menu_price": "Signature: Crispy Flaky Curry Puff | Menu: Crispy Curry Chicken & Potato Puff, Crispy Sardine Puff, Crispy Black Pepper Chicken Puff, Crispy Yam Paste Puff | Price: SGD 1.60–2.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9090 7009"
    },
    ("390051", (1, 121)): {
        "name": "Roast Paradise (Old Airport Road)",
        "hours": "Tue–Sun 11:00–16:00; Mon: Closed",
        "cuisine": "KL Roast Delights",
        "menu_price": "Signature: KL-style Caramelized Char Siew & Crispy Roast Pork | Menu: Char Siew Rice, Roast Pork Rice, Premium Kurobuta Char Siew, Hakka Egg Noodles | Price: SGD 5.50–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("390051", (1, 73)): {
        "name": "Yi Ji Fried Hokkien Prawn Noodle",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Hokkien Prawn Mee",
        "menu_price": "Signature: Spicy Fried Hokkien Mee | Menu: Fried Hokkien Prawn Mee (Small/Medium/Large) with rich prawn broth and signature fiery sambal chili | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("390051", (1, 161)): {
        "name": "Yummy Thai",
        "hours": "Tue–Sun 11:30–21:15; Mon: Closed",
        "cuisine": "Thai Cuisine",
        "menu_price": "Signature: Authentic Seafood Pad Thai & Basil Pork Rice | Menu: Seafood Pad Thai, Basil Minced Pork Rice with Fried Egg, Tom Yum Seafood Soup, Green Curry Chicken | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 2. MAXWELL FOOD CENTRE (069184)
    # ==========================================
    ("069184", (1, 26)): {
        "name": "Hock Lai Seng Teochew Fishball Bak Chor Mee",
        "hours": "Mon–Wed, Fri 07:30–17:30, Sat–Sun 07:30–14:30; Thu: Closed",
        "cuisine": "Teochew Fishball & Minced Meat Noodle",
        "menu_price": "Signature: Traditional Teochew Bak Chor Mee with Handmade Fishballs | Menu: Minced Meat Noodles (Dry/Soup), Teochew Fishball Noodles, Fish Cake, Meatball Soup | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    ("069184", (1, 71)): {
        "name": "Fu Shun Jinji Roasted House",
        "hours": "Mon–Sat 11:30–17:00; Sun: Closed",
        "cuisine": "Cantonese Roasted Delights",
        "menu_price": "Signature: Charcoal Roasted Duck & Caramelized Char Siew | Menu: Roasted Duck Noodle, Char Siew & Sio Bak Rice, Roasted Pork Belly, Wanton Soup | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("069184", (1, 97)): {
        "name": "Hup Kee Wu Xiang Guan Chang",
        "hours": "Thu–Tue 12:00–18:00; Wed: Closed",
        "cuisine": "Hokkien Ngoh Hiang",
        "menu_price": "Signature: Traditional Handmade Ngoh Hiang & Liver Roll | Menu: Five-Spice Meat Roll, Crispy Prawn Fritter, Handmade Liver Roll, Pink Sausage (Guan Chang), Fried Bee Hoon | Price: SGD 4.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    ("069184", (1, 30)): {
        "name": "Lakeview (Upper Thomson) Kim Goreng Pisang",
        "hours": "Tue–Sun 07:00–17:00; Mon: Closed",
        "cuisine": "Traditional Fried Snacks",
        "menu_price": "Signature: Crispy Traditional Goreng Pisang & 3-in-1 Nian Gao | Menu: Crispy Banana Fritters (Goreng Pisang), Fried Cempedak, Fried 3-in-1 Nian Gao with Yam and Sweet Potato | Price: SGD 1.50–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 3. BEDOK 85 FENGSHAN (460085)
    # ==========================================
    ("460085", (1, 11)): {
        "name": "Lin Yuan Satay",
        "hours": "Tue–Sun 16:30–02:00; Mon: Closed",
        "cuisine": "Hainanese Satay",
        "menu_price": "Signature: Charcoal Grilled Pork & Chicken Satay | Menu: Pork Satay with Pineapple Peanut Gravy, Chicken Satay, Mutton Satay, Ketupat | Price: SGD 0.80–1.00 per stick",
        "halal": "No",
        "vegan": "No"
    },
    ("460085", (1, 24)): {
        "name": "Chan BBQ",
        "hours": "Daily 17:00–01:00",
        "cuisine": "Seafood Barbecue",
        "menu_price": "Signature: Sambal BBQ Stingray & Sambal Sotong | Menu: Hotplate Sambal Stingray, BBQ Sambal Sotong, Sambal Lala, Sambal Kang Kong, Gong Gong | Price: SGD 12.00–25.00",
        "halal": "No",
        "vegan": "No"
    },
    ("460085", (1, 25)): {
        "name": "Tong Feng Peanut Soup with Ah Balling",
        "hours": "Daily 11:00–22:30",
        "cuisine": "Traditional Desserts",
        "menu_price": "Signature: Ah Balling Peanut Soup | Menu: Traditional Peanut Soup, Ginger Soup, Longan Red Date Soup with Peanut / Sesame / Yam / Red Bean Glutinous Rice Balls | Price: SGD 2.50–4.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    ("460085", (1, 39)): {
        "name": "Fu Zhou Oyster Cake",
        "hours": "Tue–Sun 08:00–20:00; Mon: Closed",
        "cuisine": "Fuzhou Traditional Snacks",
        "menu_price": "Signature: Traditional Deep-Fried Fuzhou Oyster Cake | Menu: Deep Fried Oyster Cake filled with Fresh Oysters, Minced Pork, Prawns, Peanuts & Coriander | Price: SGD 3.50–4.00",
        "halal": "No",
        "vegan": "No"
    },
    ("460085", (1, 64)): {
        "name": "Chai Chee Pork Porridge",
        "hours": "Tue–Sun 16:00–01:00; Mon: Closed",
        "cuisine": "Hainanese Porridge",
        "menu_price": "Signature: Smooth Hainanese Pork Porridge with Minced Meat Balls | Menu: Pork Porridge with Egg, Century Egg & Pork Porridge, Fish Porridge, Crispy You Tiao | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("460085", (1, 12)): {
        "name": "Sin Bedok North BBQ . Chicken Wing",
        "hours": "Tue–Sun 16:00–01:00; Mon: Closed",
        "cuisine": "Barbecue Chicken Wings",
        "menu_price": "Signature: Charcoal Grilled BBQ Chicken Wings | Menu: BBQ Chicken Wings, Calamansi Lime & Tangy Garlic Chili Sauce | Price: SGD 1.60–1.80 per wing",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 4. ABC BRICKWORKS (150006)
    # ==========================================
    ("150006", (1, 52)): {
        "name": "Fatty Cheong",
        "hours": "Fri–Wed 11:00–19:00; Thu: Closed",
        "cuisine": "Cantonese Roasted Delights",
        "menu_price": "Signature: Bu Jian Tian (Armpit Cut) Char Siew | Menu: Famous Char Siew Rice, Crispy Roast Pork Belly Rice, Roasted Duck Noodle, Wanton Soup | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("150006", (1, 135)): {
        "name": "Bao Zai (Guang Ji Bao Zai)",
        "hours": "Fri–Tue 11:00–19:00; Wed–Thu: Closed",
        "cuisine": "Traditional Dim Sum & Buns",
        "menu_price": "Signature: Handmade Petite Char Siew Bao | Menu: Petite Char Siew Bao, Big Pork Bun (Da Bao), Lotus Seed Paste Bun, Handmade Siew Mai | Price: SGD 0.90–2.00",
        "halal": "No",
        "vegan": "No"
    },
    ("150006", (1, 38)): {
        "name": "Yuan Yuan Claypot Rice",
        "hours": "Thu–Tue 16:00–23:00; Wed: Closed",
        "cuisine": "Cantonese Claypot Rice",
        "menu_price": "Signature: Traditional Charcoal Claypot Chicken Rice | Menu: Claypot Chicken Rice with Salted Fish & Waxed Sausage, Herbal Black Chicken Soup, Watercress Rib Soup | Price: SGD 15.00–30.00",
        "halal": "No",
        "vegan": "No"
    },
    ("150006", (1, 112)): {
        "name": "Jason Penang Cuisine",
        "hours": "Wed–Sun 11:00–14:00, 17:30–20:00; Mon–Tue: Closed",
        "cuisine": "Penang Hawker Cuisine",
        "menu_price": "Signature: Authentic Penang Wok-Hei Char Kway Teow | Menu: Penang Fried Kway Teow with Duck Egg, Penang Assam Laksa, Penang Prawn Mee, Penang Chee Cheong Fun | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 5. ALEXANDRA VILLAGE (150120)
    # ==========================================
    ("150120", (1, 83)): {
        "name": "AJ Delights",
        "hours": "Tue–Sat 09:00–18:30; Sun–Mon: Closed",
        "cuisine": "Halal Artisan Bakery",
        "menu_price": "Signature: Freshly Baked Gourmet Streusel Muffins | Menu: Walnut Banana Muffin, Chocolate Streusel Muffin, Green Tea Monster Muffin, Apple Cinnamon Muffin | Price: SGD 2.60–3.60",
        "halal": "Yes",
        "vegan": "No"
    },
    ("150120", (1, 20)): {
        "name": "Lau Phua Chay Roasted Delicacies",
        "hours": "Sun–Fri 11:00–19:00; Sat: Closed",
        "cuisine": "Teochew-Style Roasted Delights",
        "menu_price": "Signature: Roasted Duck & Char Siew with Thick Herbal Dark Sauce | Menu: Roasted Duck Rice, Char Siew & Sio Bak Rice, Herbal Duck Broth | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("150120", (1, 18)): {
        "name": "Leon Kee Claypot Pork Ribs Soup",
        "hours": "Wed–Mon 09:00–21:00; Tue: Closed",
        "cuisine": "Herbal Bak Kut Teh",
        "menu_price": "Signature: Claypot Herbal Bak Kut Teh | Menu: Claypot Herbal Pork Ribs Soup, Pig's Tail Soup, Braised Pig's Trotter, Preserved Vegetables, You Tiao | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("150120", (1, 16)): {
        "name": "Soon Lee Fire-Pot Stew Beef",
        "hours": "Tue–Sun 11:00–20:00; Mon: Closed",
        "cuisine": "Hainanese Stewed Beef",
        "menu_price": "Signature: Claypot Fire-Pot Stewed Beef & Tendon | Menu: Claypot Stew Beef Tendon & Brisket Soup, Braised Beef Kway Teow (Dry/Soup), Beef Tripe Soup | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("150120", (1, 68)): {
        "name": "Tai Liok Claypot Chicken Rice",
        "hours": "Wed–Sun 17:00–22:00; Mon–Tue: Closed",
        "cuisine": "Cantonese Claypot Rice",
        "menu_price": "Signature: Charcoal Fired Claypot Chicken Rice | Menu: Claypot Chicken Rice with Salted Fish & Lup Cheong, Herbal Black Chicken Soup, Pig Stomach Pepper Soup | Price: SGD 15.00–30.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6474 7422"
    },

    # ==========================================
    # 6. CLEMENTI 448 (120448)
    # ==========================================
    ("120448", (1, 10)): {
        "name": "Chai Ho Satay & Dried Pork",
        "hours": "Wed–Sun 14:00–20:00; Mon–Tue: Closed",
        "cuisine": "Traditional Satay & Bak Kwa",
        "menu_price": "Signature: Charcoal Grilled Pork & Chicken Satay | Menu: Pork Satay with Pineapple Puree Peanut Gravy, Chicken Satay, Mutton Satay, Pork Belly Satay, Ketupat, Traditional Bak Kwa | Price: SGD 0.60–0.90 per stick",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 7. GHIM MOH MARKET (270020)
    # ==========================================
    ("270020", (1, 54)): {
        "name": "Ghim Moh Chwee Kueh",
        "hours": "Daily 06:30–17:00",
        "cuisine": "Teochew Traditional Kueh",
        "menu_price": "Signature: Handmade Steamed Chwee Kueh with Savory Chai Poh | Menu: Chwee Kueh (4 pcs / 6 pcs / 8 pcs) with fragrant preserved radish and house-made sambal chili | Price: SGD 2.40–4.80",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    ("270020", (1, 26)): {
        "name": "HEAVENS",
        "hours": "Tue–Sun 06:00–13:30; Mon: Closed",
        "cuisine": "Traditional South Indian Breads",
        "menu_price": "Signature: Fresh Princess Appam & Thosai | Menu: Princess Appam (Egg and Cheese), Classic Sweet Appam (Coconut Milk & Orange Sugar), Masala Thosai, Plain Thosai | Price: SGD 2.50–4.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    ("270020", (1, 64)): {
        "name": "THE HEADLESS BAKER",
        "hours": "Wed–Sun 08:00–14:00; Mon–Tue: Closed",
        "cuisine": "Artisanal French & British Pastries",
        "menu_price": "Signature: Freshly Baked Scones & Tea Cakes | Menu: Earl Grey Scone with Clotted Cream & Jam, Sea Salt Dark Chocolate Cookie, Lemon Bundt Cake, Pandan Canelé, Butter Croissant | Price: SGD 3.00–6.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 8. CHANGI VILLAGE (500002)
    # ==========================================
    ("500002", (1, 23)): {
        "name": "Mizzy Corner Nasi Lemak",
        "hours": "Daily 08:30–22:00",
        "cuisine": "Malay Nasi Lemak",
        "menu_price": "Signature: Basmati Rice Nasi Lemak with Crispy Chicken Wing & Sweet Sambal | Menu: Set A (Chicken Wing, Fried Egg, Ikan Bilis, Sambal), Set B (Fried Fish), Sambal Sotong, Otah | Price: SGD 4.50–7.50",
        "halal": "Yes",
        "vegan": "No"
    },
    ("500002", (1, 49)): {
        "name": "Million Star Fried Banana",
        "hours": "Thu–Tue 10:00–17:00; Wed: Closed",
        "cuisine": "Traditional Fried Snacks",
        "menu_price": "Signature: Golden Crispy King Goreng Pisang | Menu: Crispy Fried Banana (Raja Pisang), Fried Cempedak, Fried Yam, Fried Sweet Potato Fritters | Price: SGD 1.50–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    ("500002", (1, 20)): {
        "name": "Changi Village Satay",
        "hours": "Daily 10:30–22:00",
        "cuisine": "Malay Satay",
        "menu_price": "Signature: Charcoal Grilled Chicken & Mutton Satay | Menu: Chicken Satay, Mutton Satay, Beef Satay, Ketupat, Thick Spiced Peanut Gravy | Price: SGD 0.90–1.20 per stick",
        "halal": "Yes",
        "vegan": "No"
    },
    ("500002", (1, 67)): {
        "name": "Ah Nam B.B.Q Seafood - Steamed Fish",
        "hours": "Tue–Sun 17:30–22:30; Mon: Closed",
        "cuisine": "Seafood Barbecue & Steamed Fish",
        "menu_price": "Signature: Hotplate Sambal Stingray & Hong Kong Style Steamed Seabass | Menu: Sambal Stingray, Teochew Steamed Pomfret, BBQ Sambal Sotong, Cereal Prawns, Sambal Lala | Price: SGD 14.00–35.00",
        "halal": "No",
        "vegan": "No"
    },
    ("500002", (1, 68)): {
        "name": "Ah Nam B.B.Q Seafood - Steamed Fish",
        "hours": "Tue–Sun 17:30–22:30; Mon: Closed",
        "cuisine": "Seafood Barbecue & Steamed Fish",
        "menu_price": "Signature: Hotplate Sambal Stingray & Hong Kong Style Steamed Seabass | Menu: Sambal Stingray, Teochew Steamed Pomfret, BBQ Sambal Sotong, Cereal Prawns, Sambal Lala | Price: SGD 14.00–35.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 9. ZION RIVERSIDE FOOD CENTRE (247792)
    # ==========================================
    ("247792", (1, 6)): {
        "name": "KANG'S Wanton Noodle",
        "hours": "Fri–Wed 08:00–13:30; Thu: Closed",
        "cuisine": "Cantonese Wanton Noodles",
        "menu_price": "Signature: Traditional Charcoal Roasted Char Siew Wanton Noodles | Menu: Wanton Noodles (Dry/Soup), Dumpling Noodles, Shredded Chicken Hor Fun, Fried Wanton | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    ("247792", (1, 8)): {
        "name": "Yan Kee Hainanese Boneless Chicken Rice",
        "hours": "Daily 10:30–20:30",
        "cuisine": "Hainanese Chicken Rice",
        "menu_price": "Signature: Fragrant Boneless Steamed & Roasted Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg, Oyster Sauce Gai Lan | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 10. PEK KIO MARKET & FOOD CENTRE (211041)
    # ==========================================
    ("211041", (1, 40)): {
        "name": "Sheng Seng Fried Prawn Noodle",
        "hours": "Tue–Sun 10:00–15:00; Mon: Closed",
        "cuisine": "Traditional Hokkien Mee",
        "menu_price": "Signature: Traditional Wet-style Fried Prawn Mee with Fragrant Broth | Menu: Fried Hokkien Prawn Mee (Small/Medium/Large) with fresh prawns, pork belly slices, sotong and house sambal | Price: SGD 3.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("211041", (1, 45)): {
        "name": "Heritage Tanglin Puff (Pek Kio)",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Traditional Crispy Pastries",
        "menu_price": "Signature: Flaky Hand-Crimped Chicken Potato Curry Puff | Menu: Traditional Chicken Potato Curry Puff with Egg, Spicy Sardine Puff, Otah Puff | Price: SGD 2.00–2.50",
        "halal": "No",
        "vegan": "No"
    },
    ("211041", (1, 20)): {
        "name": "Good Spice Carrot Cake",
        "hours": "Thu–Tue 06:00–13:00; Wed: Closed",
        "cuisine": "Teochew Fried Carrot Cake",
        "menu_price": "Signature: Pan-fried White & Sweet Black Carrot Cake | Menu: Crispy Egg-Crusted White Carrot Cake, Sweet Black Carrot Cake with Dark Soya Sauce, Extra Egg / Extra Chai Poh | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 11. TECK GHEE COURT BLK 341 (560341)
    # ==========================================
    ("560341", (1, 27)): {
        "name": "Belinda's Traditional Pancake",
        "hours": "Tue–Wed, Fri–Sun 06:00–12:00; Mon, Thu: Closed",
        "cuisine": "Traditional Min Jiang Kueh",
        "menu_price": "Signature: Fluffy Min Jiang Kueh & Crispy Cone Pancake | Menu: Crispy Cone Pancake (Peanut / Chocolate / Cheese), Traditional Thick Min Jiang Kueh (Red Bean / Peanut / Coconut) | Price: SGD 1.20–2.20",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 12. MARINE PARADE CENTRAL (440084)
    # ==========================================
    ("440084", (1, 2)): {
        "name": "AZIZA PUTU PIRING",
        "hours": "Daily 08:30–19:30",
        "cuisine": "Traditional Malay Kueh",
        "menu_price": "Signature: Fresh Steamed Putu Piring with Molten Gula Melaka | Menu: Traditional Putu Piring (3 pcs / 4 pcs) with premium melted palm sugar, fresh salted grated coconut | Price: SGD 2.50–3.20",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    ("440084", (1, 22)): {
        "name": "TIP TOP WESTERN FOOD",
        "hours": "Tue–Wed, Fri–Sun 10:00–22:00; Mon, Thu: Closed",
        "cuisine": "Hainanese Western Food",
        "menu_price": "Signature: Crispy Hainanese Chicken Cutlet & Pork Chop | Menu: Chicken Cutlet with Crinkle-Cut Fries & Baked Beans, Pork Chop with Brown Gravy, Ribeye Beef Steak, Fish & Chips | Price: SGD 6.50–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("440084", (1, 36)): {
        "name": "D'AUTHENTIC NASI LEMAK",
        "hours": "Sat–Thu 07:00–14:30; Fri: Closed",
        "cuisine": "Malay Nasi Lemak",
        "menu_price": "Signature: Fragrant Coconut Rice Nasi Lemak with Sambal Sotong | Menu: Nasi Lemak Set (Crispy Chicken Wing, Fried Egg, Ikan Bilis, Sambal), Sambal Cumi/Sotong, Beef Rendang, Bergedil | Price: SGD 4.00–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    ("440084", (1, 55)): {
        "name": "Katong Keah Kee Fried Oyster Carrot cake",
        "hours": "Tue–Sun 07:00–16:00; Mon: Closed",
        "cuisine": "Teochew Fried Oyster & Carrot Cake",
        "menu_price": "Signature: Crispy Fried Oyster Omelette (Orh Luak) | Menu: Crispy Fried Oyster Omelette, Oyster Egg, White Carrot Cake, Sweet Black Carrot Cake | Price: SGD 5.00–9.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 13. CHINATOWN COMPLEX (050335)
    # ==========================================
    ("050335", (2, 216)): {
        "name": "Duo Ji",
        "hours": "Tue–Sun 07:00–09:30; Mon: Closed",
        "cuisine": "Traditional Cantonese Dim Sum",
        "menu_price": "Signature: Traditional Handmade Chee Cheong Fun & Yam Cake | Menu: Cantonese Steamed Chee Cheong Fun with Sweet Red Sauce, Sesame & Chili, Traditional Yam Cake | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 188)): {
        "name": "Kent Thong Turtle Soup",
        "hours": "Tue–Sun 11:30–18:00; Mon: Closed",
        "cuisine": "Traditional Herbal Soups",
        "menu_price": "Signature: Heritage Claypot Herbal Turtle Soup since 1970 | Menu: Claypot Herbal Turtle Soup, Herbal Crocodile Paw Soup, Herbal Black Chicken Soup, Fragrant Yam Rice | Price: SGD 12.00–35.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 224)): {
        "name": "Er Gu Tang Shui",
        "hours": "Mon–Sat 10:30–21:30; Sun: Closed",
        "cuisine": "Traditional Cantonese Desserts",
        "menu_price": "Signature: Traditional Stone-Ground Sweet Pastes | Menu: Rich Black Sesame Paste, Walnut Paste, Almond Paste, Peanut Paste, Steamed Yam Paste with Ginkgo Nuts | Price: SGD 2.50–4.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 14. GOLDEN MILE FOOD CENTRE (199583)
    # ==========================================
    ("199583", (1, 19)): {
        "name": "Wedang",
        "hours": "Tue–Sun 12:00–20:30; Mon: Closed",
        "cuisine": "Indonesian Muslim Cuisine",
        "menu_price": "Signature: Michelin Bib Gourmand Tahu Telur & Satay | Menu: Crispy Tahu Telur with Spicy Sweet Soy Peanut Sauce, Gado Gado, Mee Rebus, Soto Ayam, Chicken Satay, Mutton Satay | Price: SGD 4.00–8.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    ("199583", (1, 49)): {
        "name": "kopi more",
        "hours": "Daily 10:00–16:00",
        "cuisine": "Artisanal Espresso Nanyang Coffee",
        "menu_price": "Signature: Espresso Machine Extracted Nanyang Kopi | Menu: Espresso-brewed Kopi, Kopi O, Kopi C, Teh, Teh C, Iced Double Shot Kopi with Condensed Milk | Price: SGD 1.80–3.20",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    ("199583", (1, 51)): {
        "name": "Mr Baguette (By Wee Bake Bakery)",
        "hours": "Tue–Fri 12:00–16:30, Sat–Sun 12:00–18:00; Mon: Closed",
        "cuisine": "Artisanal Bakery & Lava Baguettes",
        "menu_price": "Signature: Crispy Mini Lava Baguettes | Menu: Chocolate Lava Baguette, Cheese Lava Baguette, Hazelnut Lava Baguette, Garlic Butter Baguette, Carbonara Baguette | Price: SGD 2.50–3.80",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 79)): {
        "name": "Xin Kee Hong Kong Cheong Fun",
        "hours": "Tue–Sun 08:00–14:30; Mon: Closed",
        "cuisine": "Cantonese Steamed Cheong Fun",
        "menu_price": "Signature: Freshly Steamed Stone-Ground Hong Kong Cheong Fun | Menu: Fresh Prawn Cheong Fun, Char Siew Cheong Fun, Hong Kong Style Scallop Cheong Fun, Plain Cheong Fun | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    ("199583", (1, 101)): {
        "name": "SL II Muffin",
        "hours": "Daily 09:00–16:30",
        "cuisine": "Freshly Baked Gourmet Muffins",
        "menu_price": "Signature: Freshly Baked Gourmet Muffins & Egg Tarts | Menu: Chocolate Chip Muffin, Blueberry Muffin, Walnut Muffin, Apple Cinnamon Muffin, Cheese Muffin, Traditional Egg Tart | Price: SGD 1.60–2.20",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 15. TEKKA CENTRE (210665)
    # ==========================================
    ("210665", (1, 247)): {
        "name": "AR Rahman Cafe",
        "hours": "Tue–Sun 07:00–22:00; Mon: Closed",
        "cuisine": "South Indian Muslim & Prata",
        "menu_price": "Signature: Crispy Coin Prata Set with Rich Mutton Curry | Menu: Coin Prata Set, Egg Onion Prata, Cheese Mushroom Prata, Chicken Murtabak, Mutton Murtabak, Teh Tarik | Price: SGD 3.00–9.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    ("210665", (1, 248)): {
        "name": "Fatimah Stall AR Rahman Royal Prata",
        "hours": "Tue–Sun 07:00–22:00; Mon: Closed",
        "cuisine": "South Indian Muslim & Prata",
        "menu_price": "Signature: Royal Crispy Coin Prata & Murtabak | Menu: Coin Prata Set, Plain Prata, Egg Prata, Chicken/Mutton Murtabak, Indian Mee Goreng, Teh Halia | Price: SGD 3.00–9.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    ("210665", (1, 259)): {
        "name": "Yakader",
        "hours": "Wed–Mon 10:00–19:00; Tue: Closed",
        "cuisine": "Indian Muslim Dum Briyani",
        "menu_price": "Signature: Fragrant Tekka Mutton & Chicken Dum Briyani | Menu: Mutton Dum Briyani, Chicken Dum Briyani, Fish Briyani, Dalcha, Hard Boiled Egg, Achar | Price: SGD 6.50–10.00",
        "halal": "Yes",
        "vegan": "No"
    },
    ("210665", (1, 319)): {
        "name": "Yan Seng Traditional Teochew Kueh",
        "hours": "Daily 07:00–14:00",
        "cuisine": "Traditional Teochew Kueh",
        "menu_price": "Signature: Handmade Teochew Soon Kueh & Peng Kueh | Menu: Handmade Soon Kueh (Turnip & Mushroom), Ku Chai Kueh (Chives), Teochew Red Peach Rice Kueh (Peng Kueh), Yam Kueh | Price: SGD 1.30–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    }
}
