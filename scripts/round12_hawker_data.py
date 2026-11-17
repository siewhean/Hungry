#!/usr/bin/env python3
"""
Round 12 hawker enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers iconic stalls across:
- Newton Food Centre (229495)
- Hong Lim Complex (051531 / 51531)
- Amoy Street Food Centre (069111 / 69111)
- Zion Riverside Food Centre (247792)
- Adam Road Food Centre (289876)
- Clementi 448 (120448)
- Tiong Bahru Market (168898)
- Bedok 85 Fengshan (460085)
- Maxwell Food Centre (069184 / 69184)
- Chinatown Complex (050335 / 50335)
- Golden Mile Food Centre (199583)
- Pek Kio Market (211041)
"""

NEW_LICENCE_ENTRIES_ROUND12 = {
    # ==========================================
    # 1. NEWTON FOOD CENTRE (229495)
    # ==========================================
    "NTF0137003": {
        "name": "Newton Authentic Song Kee Teochew Fish Porridge",
        "hours": "Mon–Fri 10:30–20:00; Sat 10:30–15:00; Sun: Closed",
        "cuisine": "Teochew Fish Porridge & Seafood Soup",
        "menu_price": "Signature: Michelin Selected Teochew Sliced Fish Porridge & Fish Soup | Menu: Sliced Fish Porridge, Fish Head Soup, Pomfret Soup, Seafood Porridge | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0112003": {
        "name": "Kim Keat Satay",
        "hours": "Mon–Tue 17:00–21:00; Thu–Fri 17:00–21:00; Sat–Sun 15:30–21:00; Wed: Closed",
        "cuisine": "Hainanese Pork & Chicken Satay",
        "menu_price": "Signature: Traditional Hainanese Satay with Pineapple Puree Peanut Dip | Menu: Pork Satay, Chicken Satay, Mutton Satay, Ketupat | Price: SGD 0.90–1.20 per stick",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0116004": {
        "name": "Adam Road San Ge Prawn Noodle",
        "hours": "Mon–Sat 09:00–14:30, 18:00–22:00; Sun: Closed",
        "cuisine": "Traditional Prawn Noodles",
        "menu_price": "Signature: Big Prawn Noodle Soup & Dry Pork Ribs Prawn Mee | Menu: Big Prawn Noodle (Soup/Dry), Pork Ribs Prawn Noodle, Prawn & Tail Noodle | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0160003": {
        "name": "60 Newton Tian Xiang Big Prawn Noodle",
        "hours": "Daily 11:00–02:00",
        "cuisine": "Big Prawn Noodles",
        "menu_price": "Signature: Jumbo Big Prawn Noodle Soup & Fragrant Dry Prawn Mee | Menu: Big Prawn Noodle, Prawn & Pork Ribs Noodle, Prawn Soup | Price: SGD 7.00–15.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0161004": {
        "name": "61 Goodman BBQ Seafood",
        "hours": "Daily 17:00–02:00",
        "cuisine": "BBQ Seafood & Sambal Stingray",
        "menu_price": "Signature: Sambal Stingray on Banana Leaf & BBQ Tiger Prawns | Menu: Sambal Stingray, BBQ Tiger Prawns, Sambal Sotong, Chilli Crab, Black Pepper Crab, Kang Kong Belacan | Price: SGD 14.00–45.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0126003": {
        "name": "Al amin food paradise",
        "hours": "Daily 12:00–00:00",
        "cuisine": "Indian Muslim Briyani & Roti Prata",
        "menu_price": "Signature: Indian Muslim Mutton Briyani, Murtabak & Roti Prata | Menu: Mutton Briyani, Chicken Briyani, Crispy Roti Prata, Mutton Murtabak, Mee Goreng, Tulang Merah | Price: SGD 3.50–12.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "NTF0119003": {
        "name": "Goh Chew Kee Seafood",
        "hours": "Sun–Thu 16:30–23:30; Fri–Sat 16:30–01:30",
        "cuisine": "Seafood Tze Char & BBQ",
        "menu_price": "Signature: Singapore Chilli Crab, Black Pepper Crab & Sambal Kang Kong | Menu: Singapore Chilli Crab, Black Pepper Crab, Cereal Prawns, Sambal Lala, Sweet & Sour Pork | Price: SGD 15.00–50.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0102004": {
        "name": "Sheng Da BBQ Seafood",
        "hours": "Daily 14:30–00:00",
        "cuisine": "BBQ Seafood & Chilli Crab",
        "menu_price": "Signature: Sambal Stingray, Chilli Crab & Salted Egg Prawns | Menu: Sambal Stingray, BBQ Sotong, Garlic Clams, Chilli Crab, Fried Baby Squid | Price: SGD 14.00–45.00",
        "halal": "No",
        "vegan": "No"
    },
    "NTF0105006": {
        "name": "88 Shan Ren Cold & Hot Dessert",
        "hours": "Daily 11:30–23:30",
        "cuisine": "Traditional Local Desserts",
        "menu_price": "Signature: Traditional Cheng Tng, Durian Ice Kachang & Chendol | Menu: Cheng Tng (Hot/Cold), Ice Kachang, Mango Ice, Durian Chendol, Red Bean Soup | Price: SGD 2.50–5.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 2. HONG LIM COMPLEX (051531)
    # ==========================================
    "UC10266003": {
        "name": "Famous Sungei Road Trishaw Laksa",
        "hours": "Mon–Sat 09:30–15:00; Sun: Closed",
        "cuisine": "Michelin Bib Gourmand Laksa & Mee Siam",
        "menu_price": "Signature: Michelin Bib Gourmand Asia Delight Laksa & Fruit Juice Mee Siam | Menu: Asia Delight Laksa (with Fresh Cockles / Prawns), Fruit Juice Mee Siam, Mee Rebus | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "UC10249003": {
        "name": "Ji Ji Wanton Noodle Specialist",
        "hours": "Fri–Wed 09:30–15:00, 17:00–19:00; Thu: Closed",
        "cuisine": "Char Siew Wanton Noodles",
        "menu_price": "Signature: Michelin Recommended Ji Ji Signature Wanton Noodle & Braised Soya Sauce Chicken Noodle | Menu: Ji Ji Signature Wanton Noodle, Dumpling Noodle, Shredded Chicken & Mushroom Noodle, Fried Wanton | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "UC10250004": {
        "name": "Ji Ji Wanton Noodle Specialist",
        "hours": "Fri–Wed 09:30–15:00, 17:00–19:00; Thu: Closed",
        "cuisine": "Char Siew Wanton Noodles",
        "menu_price": "Signature: Michelin Recommended Ji Ji Signature Wanton Noodle & Braised Soya Sauce Chicken Noodle | Menu: Ji Ji Signature Wanton Noodle, Dumpling Noodle, Shredded Chicken & Mushroom Noodle, Fried Wanton | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "UC10270003": {
        "name": "Fan Ji Bittergourd Fish Soup",
        "hours": "Mon–Fri 09:30–14:00; Sat–Sun: Closed",
        "cuisine": "Teochew Bittergourd Sliced Fish Soup",
        "menu_price": "Signature: Sliced Fish Bittergourd Soup with Pig's Offal & Pork Slices | Menu: Sliced Batang Fish Soup with Bittergourd, Mixed Fish & Pork Offal Soup | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "UC10242003": {
        "name": "Ah Seng Teochew Mushroom Minced Pork Mee",
        "hours": "Mon–Fri 08:30–14:00; Sat–Sun: Closed",
        "cuisine": "Teochew Mushroom Minced Meat Noodle (Bak Chor Mee)",
        "menu_price": "Signature: Traditional Teochew Mushroom Minced Meat Mee Pok / Mee Kia | Menu: Minced Meat Noodle (Dry/Soup), Teochew Fishball Noodle, Handmade Meatball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "UC10164003": {
        "name": "Hong Lim Prawn Noodle",
        "hours": "Mon–Sat 10:00–18:30; Sun: Closed",
        "cuisine": "Traditional Prawn Noodles & Pork Ribs Soup",
        "menu_price": "Signature: Claypot Prawn Noodle Soup & Dry Pork Ribs Prawn Mee | Menu: Prawn Noodle (Soup/Dry), Pork Ribs Prawn Noodle, Pig Tail Prawn Noodle | Price: SGD 5.00–9.00",
        "halal": "No",
        "vegan": "No"
    },
    "UC10150003": {
        "name": "Mdm Zhang Fried Hokkien Mee",
        "hours": "Mon–Sat 10:00–15:00; Sun: Closed",
        "cuisine": "Traditional Fried Hokkien Mee",
        "menu_price": "Signature: Traditional Fried Hokkien Prawn Mee with Crispy Pork Lard & Sambal Chilli | Menu: Fried Hokkien Mee (SGD 5.00 / 6.00 / 8.00) | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "UC10159003": {
        "name": "GENERATION COFFEE",
        "hours": "Daily 07:30–15:00",
        "cuisine": "Specialty Coffee & Traditional Nanyang Kopi Fusion",
        "menu_price": "Signature: Specialty Espresso, Dirty Matcha & Traditional Kopi O Fusion | Menu: Espresso, Flat White, Latte, Filter Coffee, Kopi-O, Kopi-C, Cold Brew, Pastries | Price: SGD 2.00–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly",
        "website": "https://generationcoffee.sg"
    },
    "UC10253003": {
        "name": "DDSD",
        "hours": "Tue–Sat 09:30–15:30; Sun–Mon: Closed",
        "cuisine": "Artisanal Soya Beancurd & Soya Milk Dessert",
        "menu_price": "Signature: Artisanal Handmade Soybean Curd (Douhua) with Black Sesame, Ginger Sauce & Gula Melaka | Menu: Original Tau Huey, Black Sesame Tau Huey, Matcha Tau Huey, Fresh Soy Milk, Tang Yuan | Price: SGD 2.00–4.50",
        "halal": "No",
        "vegan": "Yes"
    },

    # ==========================================
    # 3. AMOY STREET FOOD CENTRE (069111)
    # ==========================================
    "AMO129003": {
        "name": "Han Kee",
        "hours": "Mon–Fri 11:00–15:00; Sat–Sun: Closed",
        "cuisine": "Michelin Selected Sliced Fish Soup & Porridge",
        "menu_price": "Signature: Michelin Selected Fresh Sliced Mackerel Fish Soup & Fish Porridge | Menu: Sliced Fish Soup, Sliced Fish Porridge, Fish Head Soup, Fish Bee Hoon | Price: SGD 6.00–11.00",
        "halal": "No",
        "vegan": "No"
    },
    "AMO018003": {
        "name": "Hoo Kee Rice Dumpling",
        "hours": "Mon–Fri 11:00–15:00; Sat–Sun: Closed",
        "cuisine": "Michelin Bib Gourmand Traditional Hokkien Bak Chang",
        "menu_price": "Signature: Michelin Bib Gourmand Traditional Bak Chang (Rice Dumpling) | Menu: Original Pork Rice Dumpling, Salted Egg Yolk Pork Dumpling, Mushroom Pork Dumpling, Deluxe Rice Dumpling | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6221 1155",
        "website": "https://hookeebakchang.sg"
    },
    "AMO107003": {
        "name": "Mad Roaster",
        "hours": "Mon–Fri 08:00–15:00; Sat 09:00–15:00; Sun: Closed",
        "cuisine": "Specialty Coffee & Laminated Brioche Bakes",
        "menu_price": "Signature: Honey Butter Laminated Brioche & Iced Aerocano | Menu: Honey Butter Brioche, Chocolate Babka, Cinnamon Roll, Flat White, Cold Brew, Aerocano | Price: SGD 3.00–6.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "AMO035003": {
        "name": "Cai Bao Fried Carrot Cake",
        "hours": "Wed–Sun 07:30–15:30; Mon–Tue: Closed",
        "cuisine": "Traditional Fried Carrot Cake",
        "menu_price": "Signature: Handcrafted White & Black Chai Tow Kway with Savoury Cai Poh | Menu: White Carrot Cake (Crispy Crust), Black Carrot Cake (Sweet Dark Soya Sauce), Yuan Yang Carrot Cake | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "AMO049003": {
        "name": "Ah Hai Porridge & Seafood Soup",
        "hours": "Mon–Fri 07:00–14:00; Sat–Sun: Closed",
        "cuisine": "Teochew Fish Porridge & Seafood Soup",
        "menu_price": "Signature: Traditional Sliced Batang Fish Porridge & Minced Pork Congee | Menu: Sliced Fish Soup, Seafood Porridge, Century Egg Minced Meat Porridge, Fish Head Bee Hoon | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "AMO020003": {
        "name": "Lian He Roasted Rice, Noodle",
        "hours": "Daily 11:30–20:00",
        "cuisine": "Hong Kong Style Charcoal Roast Meats",
        "menu_price": "Signature: Charcoal-Roasted Duck, Caramelised Char Siew & Crispy Roast Pork Belly | Menu: Roast Duck Rice, Char Siew & Roast Pork Rice, Wanton Noodles, Dumpling Soup | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 4. ZION RIVERSIDE FOOD CENTRE (247792)
    # ==========================================
    "ZRF0127002": {
        "name": "Double Happy Bak Kut Teh",
        "hours": "Tue–Sun 07:30–14:00; Mon: Closed",
        "cuisine": "Teochew Peppery Bak Kut Teh",
        "menu_price": "Signature: Traditional Teochew Peppery Pork Ribs Soup & Braised Pig's Trotter | Menu: Bak Kut Teh (Pork Ribs Soup), Braised Pork Trotters, Braised Beancurd Skin (Tau Kee), Salted Vegetables, You Tiao | Price: SGD 6.00–9.50",
        "halal": "No",
        "vegan": "No"
    },
    "ZRF0112002": {
        "name": "Seng Huat Western",
        "hours": "Tue–Sun 11:00–14:30, 17:30–21:00; Mon: Closed",
        "cuisine": "Old School Hainanese Western Food",
        "menu_price": "Signature: Crispy Chicken Cutlet & Grilled Pork Chop with Crinkle-Cut Fries | Menu: Chicken Cutlet, Pork Chop, Sirloin Steak, Fish and Chips, Chicken Chop | Price: SGD 6.50–12.00",
        "halal": "No",
        "vegan": "No"
    },
    "ZRF0121002": {
        "name": "Al-Zion Mamak",
        "hours": "Mon–Thu 09:00–19:00; Sat–Sun 08:00–15:00; Fri: Closed",
        "cuisine": "Indian Muslim Mamak Food & Prata",
        "menu_price": "Signature: Indian Muslim Mee Goreng, Roti Prata & Sup Kambing | Menu: Roti Prata (Egg/Plaster/Coin), Mee Goreng Mamak, Nasi Goreng USA, Sup Kambing, Maggi Goreng | Price: SGD 3.00–8.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 5. ADAM ROAD FOOD CENTRE (289876)
    # ==========================================
    "ADF0116004": {
        "name": "Al-Sheik Mee Stall",
        "hours": "Thu–Tue 09:30–03:00; Wed: Closed",
        "cuisine": "Indian Muslim Mee Goreng & Roti John",
        "menu_price": "Signature: Famous Crispy Roti John (Mutton / Chicken) & Spicy Mee Goreng | Menu: Roti John Special, Mee Goreng, Maggi Goreng Pattaya, Mee Kuah, Tulang Merah | Price: SGD 4.50–8.00",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "ADF0104004": {
        "name": "Ibrahim Mee Stall",
        "hours": "Tue–Sun 11:00–04:00; Mon: Closed",
        "cuisine": "Indian Muslim Mee Goreng & Sup Tulang",
        "menu_price": "Signature: Famous Indian Muslim Mee Goreng Mamak & Sup Tulang Merah | Menu: Mee Goreng, Bihun Goreng, Kuey Teow Goreng, Sup Tulang, Roti John | Price: SGD 4.00–8.50",
        "halal": "Yes",
        "vegan": "Vegan-friendly"
    },
    "ADF0114002": {
        "name": "Siti Nur Liyana Nasi Lemak",
        "hours": "Fri–Wed 06:30–22:00; Thu: Closed",
        "cuisine": "Malay Nasi Lemak",
        "menu_price": "Signature: Fragrant Basmati Nasi Lemak with Crispy Chicken Wing, Otah & Bergedil | Menu: Nasi Lemak Chicken Wing Set, Nasi Lemak Fish Set, Nasi Lemak Rendang, Otah-Otah, Bergedil | Price: SGD 4.00–7.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "ADF0113003": {
        "name": "Pondok Satay",
        "hours": "Fri–Wed 15:00–23:00; Thu: Closed",
        "cuisine": "Authentic Malay Satay & Tahu Goreng",
        "menu_price": "Signature: Charcoal-Grilled Mutton & Beef Satay with Spicy Peanut Gravy | Menu: Mutton Satay, Beef Satay, Chicken Satay, Ketupat, Tahu Goreng | Price: SGD 0.90–1.20 per stick",
        "halal": "Yes",
        "vegan": "No"
    },

    # ==========================================
    # 6. CLEMENTI 448 (120448)
    # ==========================================
    "CL30127003": {
        "name": "Chen Ji Ke Jia Niang Dou Fu",
        "hours": "Mon–Sat 12:30–16:00; Sun: Closed",
        "cuisine": "Authentic Hakka Yong Tau Foo",
        "menu_price": "Signature: Handmade Hakka Yong Tau Foo with Bittergourd, Tau Pok, Chilli & Minced Pork Filling | Menu: Hakka Yong Tau Foo Soup, Dry Yong Tau Foo with Chee Cheong Fun / Noodles, Fried Meatball | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CL30112002": {
        "name": "Nam Kee Fried Prawn Noodle",
        "hours": "Tue–Sun 11:30–14:00, 16:30–20:30; Mon: Closed",
        "cuisine": "Traditional Fried Hokkien Prawn Mee",
        "menu_price": "Signature: Wok-Hei Fried Hokkien Prawn Mee with Rich Prawn Broth & Pork Lard | Menu: Traditional Fried Prawn Mee (Small/Medium/Large) | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 7. TIONG BAHRU MARKET (168898)
    # ==========================================
    "THM0256003": {
        "name": "132 Tiong Bahru Nasi Lemak",
        "hours": "Daily 07:00–12:30",
        "cuisine": "Traditional Nasi Lemak & Economical Bee Hoon",
        "menu_price": "Signature: Fragrant Coconut Rice with Chicken Wing, Fish Fillet, Otah & Egg | Menu: Nasi Lemak Set, Economical Bee Hoon with Cabbage & Ngoh Hiang | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "THM0240002": {
        "name": "163 Fish & Chicken Porridge",
        "hours": "Daily 05:30–13:00",
        "cuisine": "Cantonese Style Fish & Chicken Congee",
        "menu_price": "Signature: Smooth Cantonese Sliced Fish Porridge & Shredded Chicken Century Egg Porridge | Menu: Sliced Fish Porridge, Chicken Porridge with Century Egg, Cuttlefish & Peanut Congee, You Tiao | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 8. BEDOK 85 FENGSHAN (460085)
    # ==========================================
    "BN40144004": {
        "name": "Chomp Chomp BBQ",
        "hours": "Tue–Sun 16:30–01:00; Mon: Closed",
        "cuisine": "Charcoal BBQ Stingray & Seafood",
        "menu_price": "Signature: Sambal Stingray on Banana Leaf, BBQ Sambal Sotong & Sambal Kang Kong | Menu: Sambal Stingray, BBQ Tiger Prawns, Sambal Lala, Gong Gong, Garlic Lala | Price: SGD 12.00–35.00",
        "halal": "No",
        "vegan": "No"
    },
    "BN40146003": {
        "name": "Beo Crescent Lor Mee",
        "hours": "Daily 07:00–15:00",
        "cuisine": "Traditional Lor Mee & Crispy Fried Fish",
        "menu_price": "Signature: Traditional Lor Mee with Braised Pork Belly, Crispy Fish Nugget & Ngoh Hiang | Menu: Traditional Lor Mee, Fried Fish Lor Mee, Crispy Fish Nugget Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "BN40143004": {
        "name": "Ah Bee Fried Prawn Mee",
        "hours": "Daily 11:00–14:00, 16:00–22:00",
        "cuisine": "Wok-Hei Fried Hokkien Prawn Mee",
        "menu_price": "Signature: Wet Style Wok-Hei Fried Hokkien Prawn Mee with Pork Lard & Sambal Chilli | Menu: Traditional Fried Hokkien Prawn Mee (Small / Medium / Large) | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 9. MAXWELL FOOD CENTRE (069184)
    # ==========================================
    "MWF045004": {
        "name": "Ho Kee Porridge",
        "hours": "Wed–Mon 07:00–16:00; Tue: Closed",
        "cuisine": "Traditional Cantonese Porridge",
        "menu_price": "Signature: Century Egg & Shredded Chicken Porridge, Sliced Fish Porridge & Pork Liver Porridge | Menu: Century Egg Pork Porridge, Sliced Fish Porridge, Meatball Porridge, You Tiao | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "MWF043004": {
        "name": "Bold x Braised",
        "hours": "Sat–Thu 11:00–20:00; Fri: Closed",
        "cuisine": "Modern Taiwanese Lu Rou Fan & Braised Pork Rice",
        "menu_price": "Signature: Bold Braised Pork Belly Rice Bowl (Lu Rou Fan) & Mentaiko Braised Pork Rice | Menu: Classic Braised Pork Belly Bowl, Braised Trotters Bowl, Braised Chicken Bowl, Braised Egg, Braised Tau Pok | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "MWF041002": {
        "name": "Ding Ding Hong Mala Xiang Guo",
        "hours": "Daily 11:30–22:00",
        "cuisine": "Sichuan Mala Xiang Guo (Spicy Stir-fry Pot)",
        "menu_price": "Signature: Custom Fragrant Mala Stir-Fry Pot with Pork Belly, Lotus Root & Quail Eggs | Menu: Mala Xiang Guo (Mild / Medium / Spicy), Fresh Meats, Seafood, Mushrooms, Vegetables, Maggi Noodles | Price: SGD 8.00–22.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # ==========================================
    # 10. CHINATOWN COMPLEX (050335)
    # ==========================================
    "SM102183003": {
        "name": "An Ji",
        "hours": "Thu–Tue 11:00–14:30, 16:30–20:30; Wed: Closed",
        "cuisine": "Michelin Recommended Fish Head Noodles & Zi Char",
        "menu_price": "Signature: Crispy Fried Fish Head Noodles, Bittergourd Pork Ribs & Fish Head Steamboat | Menu: Fish Head Thick Bee Hoon, Sliced Fish Soup, Braised Bittergourd with Pork Ribs, Sambal Kangkong | Price: SGD 6.00–18.00",
        "halal": "No",
        "vegan": "No"
    },
    "SM102197003": {
        "name": "Chang Ji Cooked Food",
        "hours": "Wed–Mon 17:00–23:30; Tue: Closed",
        "cuisine": "Charcoal BBQ Seafood & Sambal Stingray",
        "menu_price": "Signature: Sambal Stingray on Banana Leaf & BBQ Sotong | Menu: Sambal Stingray, BBQ Sotong, Sambal Lala, BBQ Chicken Wings, Sambal Kang Kong | Price: SGD 12.00–30.00",
        "halal": "No",
        "vegan": "No"
    },
    "SM102043004": {
        "name": "Bedok Chwee Kueh",
        "hours": "Daily 07:00–18:00",
        "cuisine": "Michelin Bib Gourmand Chwee Kueh",
        "menu_price": "Signature: Michelin Bib Gourmand Traditional Steamed Chwee Kueh with Savoury Cai Poh & Sambal Chilli | Menu: Chwee Kueh (2 pcs / 4 pcs / 6 pcs) | Price: SGD 1.60–3.60",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "SM102165003": {
        "name": "Chao Ji Shao La",
        "hours": "Tue–Sun 11:00–17:00; Mon: Closed",
        "cuisine": "Hong Kong Style Roast Meats",
        "menu_price": "Signature: Crispy Roasted Pork Belly (Sio Bak), Caramelised Char Siew & Roasted Duck | Menu: Char Siew Rice, Roasted Pork Rice, Roasted Duck Rice/Noodles, Wanton Noodle | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 11. GOLDEN MILE FOOD CENTRE (199583)
    # ==========================================
    "GMFB117003": {
        "name": "Deen Tulang Specialist",
        "hours": "Daily 13:00–22:30",
        "cuisine": "Indian Muslim Sup Tulang Merah",
        "menu_price": "Signature: Famous Bright Red Mutton Bone Marrow Soup (Sup Tulang Merah) with Crusty French Loaf | Menu: Sup Tulang Merah, Mee Kuah, Mee Goreng Tulang, Roti John, Sup Daging | Price: SGD 10.00–25.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "GMFB116003": {
        "name": "Deen Tiga Rasa",
        "hours": "Daily 11:00–23:00",
        "cuisine": "Indian Muslim Sup Tulang & Mee Goreng",
        "menu_price": "Signature: Sup Tulang Merah, Mee Goreng Mamak & Nasi Goreng Pattaya | Menu: Sup Tulang Merah, Mee Goreng, Maggi Goreng, Roti John, Sup Daging | Price: SGD 4.50–18.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "GMFB107002": {
        "name": "D&Z satay &chicken wing specialists",
        "hours": "Daily 12:00–20:45",
        "cuisine": "Halal Malay BBQ Chicken Wings & Satay",
        "menu_price": "Signature: Crispy Charcoal BBQ Chicken Wings & Grilled Mutton Satay with Peanut Sauce | Menu: BBQ Chicken Wings, Chicken Satay, Mutton Satay, Beef Satay, Ketupat | Price: SGD 0.90–1.60 per piece/stick",
        "halal": "Yes",
        "vegan": "No"
    },
    "GMFB106004": {
        "name": "Charred The Hawker",
        "hours": "Tue–Sun 11:30–15:00, 17:00–20:30; Mon: Closed",
        "cuisine": "Halal Gourmet Charcoal-Grilled Steaks & Burgers",
        "menu_price": "Signature: Charcoal-Grilled Wagyu Ribeye Steak, Striploin & Beef Cheeseburger | Menu: A5 Wagyu Rump, Grain-Fed Ribeye, Beef Burger with Truffle Fries, Smoked Duck | Price: SGD 12.00–28.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "GMFB140003": {
        "name": "Golden Mile Fish Porridge & Seafood Soup",
        "hours": "Thu–Tue 09:00–20:00; Wed: Closed",
        "cuisine": "Teochew Sliced Fish Porridge & Seafood Soup",
        "menu_price": "Signature: Fresh Batang Sliced Fish Porridge & Fried Fish Meat Soup | Menu: Sliced Fish Porridge, Fried Fish Soup, Seafood Soup, Fish Head Bee Hoon | Price: SGD 5.50–9.00",
        "halal": "No",
        "vegan": "No"
    },
    "GMFB147003": {
        "name": "Golden Mile Teochew Fishball Noodle",
        "hours": "Thu–Tue 08:00–16:00; Wed: Closed",
        "cuisine": "Traditional Teochew Handmade Fishball Noodles",
        "menu_price": "Signature: Handmade Springy Fishball & Fish Cake Mee Pok / Mee Kia (Dry/Soup) | Menu: Teochew Fishball Noodle, Fish Cake Noodle, Fishball Soup, Meatball Noodle | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # 12. PEK KIO MARKET (211041)
    # ==========================================
    "CR10138003": {
        "name": "Double Spring Teochew Lor Duck Kway Chap",
        "hours": "Tue 08:00–15:00; Thu–Sun 08:00–15:00; Mon & Wed: Closed",
        "cuisine": "Teochew Braised Duck Rice & Kway Chap",
        "menu_price": "Signature: Braised Duck Rice, Braised Duck Kway Chap & Herbal Braised Duck Porridge | Menu: Teochew Braised Duck Set, Kway Chap Platter (Tau Pok, Egg, Intestines, Pork Belly), Kway Soup | Price: SGD 4.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "CR10117003": {
        "name": "Farrer Park Niang Dou Fu",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Traditional Handmade Yong Tau Foo",
        "menu_price": "Signature: Handmade Fish Paste Stuffed Bittergourd, Chilli, Tauhu & Meatballs in Soya Bean Broth | Menu: Yong Tau Foo (Soup / Dry with Sweet Sauce & Chilli), Kway Teow, Bee Hoon, Yellow Noodles | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "CR10118003": {
        "name": "Cambridge Road Hong Kong Roasted Pork",
        "hours": "Sat–Thu 07:00–16:00; Fri: Closed",
        "cuisine": "Hong Kong Charcoal Roast Meats",
        "menu_price": "Signature: Crispy Roasted Pork Belly (Sio Bak), Honey Char Siew & Roasted Duck | Menu: Char Siew Rice, Roasted Pork Rice, Roasted Duck Rice, Wanton Noodle, Dumpling Soup | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "CR10121003": {
        "name": "Min Hiang",
        "hours": "Mon–Sat 08:00–18:00; Sun: Closed",
        "cuisine": "Traditional Soya Bean Milk & Grass Jelly Drinks",
        "menu_price": "Signature: Fresh Handmade Soya Bean Milk, Grass Jelly (Cincau) & Michael Jackson (Soya + Cincau) | Menu: Soya Bean Milk (Hot/Cold), Grass Jelly Drink, Michael Jackson, Rose Syrup with Chia Seeds | Price: SGD 0.80–1.80",
        "halal": "No",
        "vegan": "Yes"
    }
}
