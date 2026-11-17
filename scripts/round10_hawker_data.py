#!/usr/bin/env python3
"""
Round 10 hawker enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers:
- Amoy Street Food Centre (069111)
- Newton Food Centre (229495)
- Hong Lim Complex (051531)
- Adam Road Food Centre (289876)
- Bukit Merah View Market & Hawker Centre (151115)
- Commonwealth Crescent Market (149644)
- Clementi 448 (120448)
- Changi Village (500002)
- Bedok 85 Fengshan (460085)
"""

NEW_LICENCE_ENTRIES_ROUND10 = {
    # ==========================================
    # 1. AMOY STREET FOOD CENTRE (069111)
    # ==========================================
    "AMO021002": {
        "name": "J2 Famous Crispy Curry Puff",
        "hours": "Mon–Fri 08:00–15:00; Sat–Sun: Closed",
        "cuisine": "Traditional Crispy Pastries",
        "menu_price": "Signature: Michelin Bib Gourmand Crispy Layered Curry Puff | Menu: Crispy Curry Chicken Puff, Crispy Black Pepper Chicken Puff, Crispy Sardine Puff, Crispy Yam Paste Puff | Price: SGD 1.60–2.00",
        "halal": "No",
        "vegan": "No"
    },
    "AMO014003": {
        "name": "Ah Ter Teochew Fishball Noodles",
        "hours": "Mon–Sat 07:00–14:00; Sun: Closed",
        "cuisine": "Teochew Fishball & Minced Meat Noodle",
        "menu_price": "Signature: Teochew Bak Chor Mee with Fishball Soup | Menu: Minced Meat Noodle with Soup (Prawns, Pork Liver, Meatballs, Fishballs), Fishball Noodles Dry, Meatball Soup | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "AMO095002": {
        "name": "Ah Seng (Hai Nam) Coffee",
        "hours": "Tue–Sun 05:30–14:30; Mon: Closed",
        "cuisine": "Traditional Hainanese Coffee & Toast",
        "menu_price": "Signature: Charcoal-Toasted Kaya Toast & Hainanese French Toast | Menu: Traditional Kopi, Kopi C, Teh, Charcoal Grilled Kaya Butter Toast, French Toast with Kaya, Half-Boiled Eggs | Price: SGD 1.20–3.50",
        "halal": "No",
        "vegan": "No"
    },
    "AMO122002": {
        "name": "Ah Liang Ipoh Hor Fun",
        "hours": "Mon–Fri 11:00–14:30; Sat–Sun: Closed",
        "cuisine": "Ipoh Hor Fun",
        "menu_price": "Signature: Silky Ipoh Hor Fun in Herbal Mushroom Gravy | Menu: Shredded Chicken & Prawn Ipoh Hor Fun, Fried Fish Dumpling Hor Fun, Braised Mushroom & Chicken Hor Fun | Price: SGD 4.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "AMO114003": {
        "name": "Chun Feng Man Mian",
        "hours": "Mon–Fri 08:30–14:30; Sat–Sun: Closed",
        "cuisine": "Modern Truffle Wanton Noodle",
        "menu_price": "Signature: Modern Truffle Char Siew Wanton Mee | Menu: Signature Char Siew Wanton Noodle with Iberian Pork, Truffle Wanton Noodle, Iberico Pork Collar Noodle, Fried Wantons | Price: SGD 6.00–9.50",
        "halal": "No",
        "vegan": "No"
    },
    "AMO007004": {
        "name": "Grandma Ban Mian",
        "hours": "Mon–Fri 10:30–14:00; Sat–Sun: Closed",
        "cuisine": "Handmade Ban Mian",
        "menu_price": "Signature: Handmade Chili Ban Mian & Ban Mian Soup | Menu: Dry Chili Ban Mian with Crispy Ikan Bilis & Poached Egg, Ban Mian Soup with Minced Meat, Handmade Mee Hoon Kueh | Price: SGD 4.50–6.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 2. NEWTON FOOD CENTRE (229495)
    # ==========================================
    "NTF0111002": {
        "name": "Hai Yan BBQ Seafood",
        "hours": "Tue–Sun 16:00–23:00; Mon: Closed",
        "cuisine": "Seafood Barbecue & Crabs",
        "menu_price": "Signature: BBQ Sambal Stingray & Singapore Chili Crab | Menu: Sambal Stingray, Chili Crab, Black Pepper Crab, BBQ Tiger Prawns, Sambal Sotong, Cereal Prawns, Fried Mantou | Price: SGD 15.00–45.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0123003": {
        "name": "Takara Grilled Seafood",
        "hours": "Daily 17:00–23:30",
        "cuisine": "Seafood Barbecue",
        "menu_price": "Signature: BBQ Sambal Seafood & Grilled Jumbo Prawns | Menu: Sambal Stingray, Grilled Butter Garlic Lobster, Sambal Lala Clams, Black Pepper Crab, Kang Kong Belacan | Price: SGD 16.00–48.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0125003": {
        "name": "Newton Old Signboard 25",
        "hours": "Daily 11:00–22:30",
        "cuisine": "Seafood Barbecue & Live Crabs",
        "menu_price": "Signature: Signature Chili Crab & Cereal Prawns | Menu: Singapore Chili Crab, Black Pepper Crab, Cereal Prawns, Salted Egg Calamari, BBQ Stingray, Fried Mantou | Price: SGD 18.00–50.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 3. HONG LIM COMPLEX (051531)
    # ==========================================
    "UC10158003": {
        "name": "Heng Kee Curry Chicken Bee Hoon Mee",
        "hours": "Tue–Sat 10:00–15:30; Sun–Mon: Closed",
        "cuisine": "Hainanese Curry Noodles",
        "menu_price": "Signature: Michelin Bib Gourmand Hainanese Curry Chicken Noodle | Menu: Curry Chicken Noodles (Bee Hoon / Yellow Noodles / Kway Teow) with tender poached chicken, spongy tau pok and braised potatoes | Price: SGD 6.00–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "UC10145002": {
        "name": "Hiong Kee Dumplings",
        "hours": "Mon–Sat 09:00–18:00; Sun: Closed",
        "cuisine": "Traditional Bak Chang",
        "menu_price": "Signature: Michelin Recommended Traditional Handmade Bak Chang | Menu: Pork Dumpling with Salted Egg Yolk & Chestnut, Nyonya Dumpling, Chicken Dumpling, Kee Chang with Kaya | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "UC10156003": {
        "name": "Teo Heng Porridge Stall",
        "hours": "Mon–Sat 07:00–13:30; Sun: Closed",
        "cuisine": "Teochew Porridge",
        "menu_price": "Signature: Authentic Traditional Teochew Porridge with Fresh Fish | Menu: Teochew Steamed Rabbitfish / Pomfret, Braised Pork Belly, Braised Tau Pok, Salted Vegetables, Plain Rice Porridge | Price: SGD 4.00–10.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 4. ADAM ROAD FOOD CENTRE (289876)
    # ==========================================
    "ADF0111003": {
        "name": "ADAM'S DELIGHTS",
        "hours": "Daily 09:00–22:00",
        "cuisine": "Indian Muslim Comfort Food",
        "menu_price": "Signature: Indian Muslim Mee Goreng & Maggi Goreng Pattaya | Menu: Mee Goreng, Maggi Goreng Pattaya with Egg, Nasi Goreng USA, Mutton Murtabak, Roti John | Price: SGD 4.50–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "ADF0123003": {
        "name": "Hua Ji Hainanese Chicken Rice",
        "hours": "Daily 12:00–20:00",
        "cuisine": "Hainanese Chicken Rice",
        "menu_price": "Signature: Hainanese Steamed & Roasted Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Liver, Braised Egg, Oyster Sauce Vegetables | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 5. BUKIT MERAH VIEW (151115)
    # ==========================================
    "BM30137003": {
        "name": "Bukit Merah View Carrot Cake",
        "hours": "Daily 07:00–13:30, 16:30–01:30",
        "cuisine": "Teochew Fried Carrot Cake",
        "menu_price": "Signature: Michelin Selected Traditional Hand-Milled Carrot Cake | Menu: Black Fried Carrot Cake with Sweet Molasses Sauce, Crispy White Fried Carrot Cake, Extra Chai Poh & Egg | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9689 8696"
    },
    "BM30107003": {
        "name": "Hong Xing Handmade Fishball Meatball Noodle",
        "hours": "Thu–Tue 05:30–13:30; Wed: Closed",
        "cuisine": "Handmade Fishball Noodles",
        "menu_price": "Signature: Handmade Fishballs & Meatballs with Springy Mee Pok | Menu: Handmade Fishball Noodles (Dry/Soup), Meatball Noodles, Fish Cake, Fish Dumpling (Her Kiao) Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "BM30105003": {
        "name": "Kim Huat Wanton Mee",
        "hours": "Tue–Sun 06:00–14:00; Mon: Closed",
        "cuisine": "Cantonese Wanton Noodles",
        "menu_price": "Signature: Traditional Char Siew Wanton Noodles & Fried Wantons | Menu: Wanton Mee (Dry/Soup), Chicken Feet Noodles, Mushroom Shredded Chicken Hor Fun, Crispy Fried Wantons | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 6. BLOCK 31 COMMONWEALTH CRESCENT (149644)
    # ==========================================
    "CW3090005": {
        "name": "Foong Kee Traditional Charcoal Roaster",
        "hours": "Tue–Sat 11:00–14:00; Sun–Mon: Closed",
        "cuisine": "Charcoal Roasted Delights",
        "menu_price": "Signature: Charcoal Roasted Char Siew & Crispy Roast Pork Belly | Menu: Char Siew Rice, Roasted Pork Belly Rice, Roasted Duck Noodle, Wanton Mee | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "CW3089003": {
        "name": "Hong Kee Porridge",
        "hours": "Tue–Sun 06:00–14:30; Mon: Closed",
        "cuisine": "Hainanese Porridge",
        "menu_price": "Signature: Hainanese Pork & Fish Congee with Century Egg | Menu: Pork Congee with Minced Pork & Liver, Sliced Fish Congee, Century Egg & Pork Congee, Raw Egg | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "CW3074003": {
        "name": "Fai Kee Fish Head Bee Hoon",
        "hours": "Tue–Sat 15:00–21:00; Sun–Mon: Closed",
        "cuisine": "Fish Head Bee Hoon Soup",
        "menu_price": "Signature: Cantonese Fried Fish Head Bee Hoon Soup with Milk | Menu: Fried Fish Head Bee Hoon Soup, Sliced Fish Soup, Sliced Fish Bittergourd Soup, Fish Roe Soup | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 7. CLEMENTI 448 (120448)
    # ==========================================
    "CL30123004": {
        "name": "Yong Fa Hainanese Curry Rice & Curry Fish Head",
        "hours": "Daily 10:00–14:30",
        "cuisine": "Hainanese Curry Rice",
        "menu_price": "Signature: Hainanese Crispy Pork Cutlet Curry Rice & Curry Fish Head | Menu: Crispy Pork Chop, Braised Cabbage (Chap Chye), Braised Pork Belly, Curry Squid, Claypot Curry Fish Head | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "CL30146003": {
        "name": "Cheng Ji Braised Duck Rice. Noodle. Porridge",
        "hours": "Daily 07:30–20:00",
        "cuisine": "Teochew Braised Duck",
        "menu_price": "Signature: Teochew Braised Duck Rice & Porridge | Menu: Braised Duck Rice Set, Braised Duck Kway Teow, Braised Duck Porridge, Braised Tofu, Lava Braised Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 8. CHANGI VILLAGE (500002)
    # ==========================================
    "CV10118003": {
        "name": "Weng Lee Ipoh Hor Fun",
        "hours": "Mon–Fri 10:30–23:00, Sat–Sun 08:00–00:00",
        "cuisine": "Ipoh Hor Fun",
        "menu_price": "Signature: Crispy Fried Chicken Cutlet Ipoh Hor Fun | Menu: Chicken Cutlet Ipoh Hor Fun, Shredded Chicken & Prawn Hor Fun, Braised Mushroom Chicken Feet Hor Fun | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "CV10142004": {
        "name": "Hougang Jing Jia Mutton Soup",
        "hours": "Tue–Sun 10:00–14:00; Mon: Closed",
        "cuisine": "Hainanese Herbal Mutton Soup",
        "menu_price": "Signature: Traditional Hainanese Herbal Mutton Soup | Menu: Mutton Ribs Soup, Sliced Mutton Soup, Mutton Tripe & Meatballs, Herbal Broth with Chinese Herbs & Ginger | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "CV10143004": {
        "name": "Wong Hing Kitchenette",
        "hours": "Fri–Wed 11:00–15:00, 17:00–21:00; Thu: Closed",
        "cuisine": "Cantonese Roasted Delights",
        "menu_price": "Signature: Cantonese Roast Meats & Wanton Noodles | Menu: Roasted Duck Noodle, Char Siew & Sio Bak Rice, Hong Kong Style Dumpling Soup, Sliced Beef Hor Fun | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "CV10127004": {
        "name": "Hafiz Nasi Ayam Penyet",
        "hours": "Daily 10:00–23:00",
        "cuisine": "Indonesian Ayam Penyet",
        "menu_price": "Signature: Authentic Smashed Fried Chicken Nasi Ayam Penyet | Menu: Nasi Ayam Penyet with Sambal Belacan, Nasi Ikan Bawal Penyet, Nasi Keli Penyet, Fried Tofu & Tempeh | Price: SGD 6.00–8.50",
        "halal": "Yes",
        "vegan": "No"
    },

    # ==========================================
    # 9. BEDOK 85 FENGSHAN (460085)
    # ==========================================
    "BN40109004": {
        "name": "Bedok 85 Fried Oyster",
        "hours": "Daily 16:00–02:00",
        "cuisine": "Teochew Fried Oyster Omelette",
        "menu_price": "Signature: Crispy Fried Oyster Omelette & Oyster Egg | Menu: Fried Oyster Omelette (Orh Luak), Oyster Egg, Pan-Fried White Carrot Cake, Black Carrot Cake | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "BN40110004": {
        "name": "Bedok 85 Fried Oyster",
        "hours": "Daily 16:00–02:00",
        "cuisine": "Teochew Fried Oyster Omelette",
        "menu_price": "Signature: Crispy Fried Oyster Omelette & Oyster Egg | Menu: Fried Oyster Omelette (Orh Luak), Oyster Egg, Pan-Fried White Carrot Cake, Black Carrot Cake | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "BN40114003": {
        "name": "85 Ngoh Hiang Hei Biar",
        "hours": "Fri–Wed 11:00–23:00; Thu: Closed",
        "cuisine": "Traditional Ngoh Hiang",
        "menu_price": "Signature: Traditional Five-Spice Meat Rolls & Crispy Prawn Crackers | Menu: Handmade Ngoh Hiang, Crispy Prawn Cracker (Hei Biar), Liver Roll, Century Egg, Fried Bee Hoon | Price: SGD 4.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "BN40106004": {
        "name": "Soon Lee Heng Satay, Chicken Wings",
        "hours": "Daily 17:30–01:00",
        "cuisine": "Charcoal Satay & Chicken Wings",
        "menu_price": "Signature: Charcoal-Grilled Pork & Chicken Satay | Menu: Pork Satay with Peanut Gravy, Chicken Satay, Mutton Satay, BBQ Chicken Wings, Ketupat | Price: SGD 0.80–1.00 per stick",
        "halal": "No",
        "vegan": "No"
    }
}
