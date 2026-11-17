#!/usr/bin/env python3
"""
Round 17 hawker and food court enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers 75 iconic stalls across:
- Chomp Chomp Food Centre (557269)
- East Coast Lagoon Food Village (468960)
- Redhill Food Centre (150085)
- Tampines Round Market & Food Centre (521137)
- Chong Pang Market & Food Centre (760105)
"""

NEW_LICENCE_ENTRIES_ROUND17 = {
    # =========================================================================
    # 1. CHOMP CHOMP FOOD CENTRE (557269)
    # =========================================================================
    "CCF0127004": {
        "name": "Ah Hock Fried Hokkien Noodle (亚福炒福建虾面)",
        "hours": "Tue–Fri 17:30–22:00; Sat 16:30–22:00; Sun 16:30–21:00; Mon: Closed",
        "cuisine": "Michelin Plate Traditional Hokkien Prawn Mee",
        "menu_price": "Signature: Robust Dry-Style Fried Hokkien Prawn Mee simmered in Rich Prawn Broth with Squid & Fiery Sambal | Menu: Fried Hokkien Noodle (Small / Medium / Large), Extra Sambal Chilli | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0102003": {
        "name": "Chia Keng Fried Hokkien Prawn Noodle (谢庆炒福建虾面)",
        "hours": "Wed–Mon 17:00–23:30; Tue: Closed",
        "cuisine": "Traditional Wet-Style Fried Hokkien Mee",
        "menu_price": "Signature: Wok-Hei Wet Style Hokkien Mee with Fresh Prawns, Pork Belly Strips & Crispy Pork Lard | Menu: Fried Hokkien Prawn Noodle (Small / Medium / Large) | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0132002": {
        "name": "Chomp Chomp Satay (忠忠沙爹)",
        "hours": "Mon–Thu 17:30–22:30; Fri–Sun 16:30–23:00",
        "cuisine": "Michelin Selected Charcoal Grilled Satay & Pineapple Peanut Gravy",
        "menu_price": "Signature: Charcoal Grilled Pork, Chicken & Mutton Satay with Grated Pineapple Peanut Sauce & Steamed Ketupat | Menu: Pork Satay, Chicken Satay, Mutton Satay, Beef Satay, Ketupat | Price: SGD 0.80 per stick (min 10 sticks)",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0129003": {
        "name": "Good Luck BBQ Chicken Wings and Satay (好运烧烤鸡翅沙爹)",
        "hours": "Daily 16:30–00:30",
        "cuisine": "Charcoal Grilled BBQ Chicken Wings & Satay",
        "menu_price": "Signature: Golden Caramelised BBQ Chicken Wings glazed with Lime Juice & Sweet Chilli Dip | Menu: BBQ Chicken Wings (min 2 pcs), Pork Satay, Chicken Satay, Ketupat | Price: SGD 1.50 per wing",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0118005": {
        "name": "Fu BBQ Seafood (宏富烧烤海鲜)",
        "hours": "Daily 16:30–23:30",
        "cuisine": "Charcoal Grilled Sambal Seafood & BBQ Stingray",
        "menu_price": "Signature: Sizzling Sambal Stingray on Banana Leaf, Sambal Sotong & Garlic Butter Lala Clams | Menu: Sambal Stingray (Small / Medium / Large), Sambal Kang Kong, BBQ Prawns, Black Pepper Crab | Price: SGD 12.00–35.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0120003": {
        "name": "Fu BBQ Seafood (宏富烧烤海鲜)",
        "hours": "Daily 16:30–23:30",
        "cuisine": "Charcoal Grilled Sambal Seafood & BBQ Stingray",
        "menu_price": "Signature: Sizzling Sambal Stingray on Banana Leaf, Sambal Sotong & Garlic Butter Lala Clams | Menu: Sambal Stingray, Sambal Cockles, Cereal Prawns, Chili Crab | Price: SGD 12.00–35.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0106002": {
        "name": "Lucy BBQ (露西烧烤)",
        "hours": "Tue–Sun 17:00–23:30; Mon: Closed",
        "cuisine": "Famous Sambal Stingray & BBQ Seafood",
        "menu_price": "Signature: Banana Leaf Sambal Stingray with Spicy Belacan Dip, Sambal Clams & BBQ Crayfish | Menu: Sambal Stingray, Sambal Lala, Sambal Sotong, BBQ Tiger Prawns | Price: SGD 12.00–30.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0124003": {
        "name": "Chomp Chomp Fried Oyster (忠忠炒蚝煎)",
        "hours": "Daily 16:30–23:30",
        "cuisine": "Traditional Crispy Fried Oyster Omelette",
        "menu_price": "Signature: Golden Crispy Oyster Omelette (Orh Luak) with Plump Succulent Oysters & Tangy Chilli Sauce | Menu: Fried Oyster Omelette (Small / Medium / Large), Oyster Egg | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0133002": {
        "name": "Hong Sha Li Hao Jian (红砂厘蚝煎)",
        "hours": "Daily 17:00–23:30",
        "cuisine": "Teochew Fried Oyster Omelette & Fried Carrot Cake",
        "menu_price": "Signature: Starchy Crispy Teochew Oyster Omelette & Black Sweet Fried Carrot Cake | Menu: Fried Oyster Omelette, White Carrot Cake, Black Carrot Cake | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0101003": {
        "name": "Hai Wei Yuen BBQ Chicken Wings (海味园烧烤鸡翅)",
        "hours": "Daily 17:00–23:30",
        "cuisine": "Charcoal Roasted BBQ Chicken Wings",
        "menu_price": "Signature: Crispy Skin Roasted Chicken Wings infused with Honey, Soy & Calamansi Lime | Menu: BBQ Chicken Wings (min 2 pcs), Fresh Lime | Price: SGD 1.50 per wing",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0121004": {
        "name": "Dinghao Sugarcane Juice (鼎好甘蔗汁)",
        "hours": "Daily 16:00–00:30",
        "cuisine": "Giant Tower Fresh Sugarcane Juice & Local Drinks",
        "menu_price": "Signature: Giant 1-Litre Freshly Pressed Sugarcane Juice with Lemon / Sour Plum | Menu: Fresh Sugarcane Juice (Regular / Giant / Tower), Fresh Coconut Water, Calamansi Juice | Price: SGD 2.50–15.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "CCF0117002": {
        "name": "Chomp Chomp Satay Bee Hoon (忠忠沙爹米粉)",
        "hours": "Wed–Mon 17:30–23:00; Tue: Closed",
        "cuisine": "Traditional Teochew Satay Bee Hoon",
        "menu_price": "Signature: Warm Rice Vermicelli drenched in Creamy Nutty Spiced Satay Gravy with Cuttlefish, Prawns & Pork Slices | Menu: Satay Bee Hoon (Small / Medium / Large), Cuttlefish Kang Kong | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0128008": {
        "name": "Bedok 511 BBQ Wings & Satay (Chomp Chomp)",
        "hours": "Daily 16:30–23:30",
        "cuisine": "Charcoal Grilled Chicken Wings & Skewered Satay",
        "menu_price": "Signature: Golden Roasted Chicken Wings & Smoky Pork Satay with Ketupat | Menu: BBQ Chicken Wings, Pork Satay, Chicken Satay, Ketupat | Price: SGD 1.50 per wing, SGD 0.80 per satay",
        "halal": "No",
        "vegan": "No"
    },
    "CCF0131003": {
        "name": "Wang BBQ - Lok Lok, Chicken Wing & Satay",
        "hours": "Daily 17:00–00:00",
        "cuisine": "Malaysian Style Deep-Fried & Grilled Lok Lok Skewers",
        "menu_price": "Signature: Fried & Grilled Lok Lok Skewers with Satay Sauce, BBQ Wings & Grilled Seafood | Menu: Lok Lok Skewers (Broccoli, Enoki Bacon, Cheese Tofu, Sausages), BBQ Chicken Wings | Price: SGD 1.20–2.00 per stick",
        "halal": "No",
        "vegan": "No"
    },

    # =========================================================================
    # 2. EAST COAST LAGOON FOOD VILLAGE (468960)
    # =========================================================================
    "ECF014004": {
        "name": "Ah Hwee BBQ Chicken Wings & Spring Chicken",
        "hours": "Mon–Tue, Thu–Sat 15:00–22:00; Sun 15:00–20:00; Wed: Closed",
        "cuisine": "Michelin Selected Charcoal BBQ Chicken Wings",
        "menu_price": "Signature: Michelin Selected Smoky Caramelised BBQ Chicken Wings with Tangy Garlic Chilli & Crispy Spring Chicken | Menu: BBQ Chicken Wings (min 2 pcs), Whole Spring Chicken, Fried Rice | Price: SGD 1.60 per wing, SGD 12.00 whole chicken",
        "halal": "No",
        "vegan": "No"
    },
    "ECF058003": {
        "name": "Ahmad Spring Satay & BBQ Wing",
        "hours": "Mon, Wed–Sun 16:00–23:00; Tue: Closed",
        "cuisine": "Halal Charcoal Grilled Satay & BBQ Chicken Wings",
        "menu_price": "Signature: Juicy Mutton, Beef, Chicken & Tripe (Babat) Satay with Rich Spiced Peanut Sauce & Ketupat | Menu: Mutton Satay, Beef Satay, Chicken Satay, Babat Satay, BBQ Chicken Wings | Price: SGD 0.90 per stick (min 10 sticks)",
        "halal": "Yes",
        "vegan": "No"
    },
    "ECF046003": {
        "name": "Choon Hiang (春香)",
        "hours": "Daily 12:00–22:30",
        "cuisine": "Heritage Wok-Hei Fried Hokkien Mee & Char Kway Teow",
        "menu_price": "Signature: Traditional Wet Wok-Hei Hokkien Prawn Mee & Savoury Smoky Char Kway Teow with Cockles | Menu: Fried Hokkien Prawn Mee, Char Kway Teow, Fried Rice | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    "ECF056004": {
        "name": "Adimann Seafood & Satay Specialist",
        "hours": "Daily 15:00–23:00",
        "cuisine": "Halal Sambal Seafood & Satay Specialist",
        "menu_price": "Signature: BBQ Sambal Stingray on Banana Leaf, Sambal Tiger Prawns & Mutton Satay | Menu: Sambal Stingray, BBQ Squid, Sambal Clams, Mixed Satay Platter | Price: SGD 14.00–32.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "ECF038002": {
        "name": "38 Barbeque Seafood",
        "hours": "Daily 16:00–23:00",
        "cuisine": "Seaside BBQ Seafood & Sambal Fish",
        "menu_price": "Signature: Thick-Cut BBQ Sambal Stingray with Cincalok & Sambal Kangkong | Menu: Sambal Stingray (Small / Medium / Large), Cereal Prawns, Sambal Sotong, Salted Egg Crab | Price: SGD 12.00–35.00",
        "halal": "No",
        "vegan": "No"
    },
    "ECF027003": {
        "name": "27 Shao Kao Zhu Chao (27烧烤煮炒)",
        "hours": "Daily 16:00–23:00",
        "cuisine": "Zi Char Seafood & Sizzling Hotplate Dishes",
        "menu_price": "Signature: Hotplate Tofu with Minced Meat, Chilli Crab & Salted Egg Pork Ribs | Menu: Chilli Crab, Black Pepper Crab, Sambal Lala, Prawn Paste Chicken, Hor Fun | Price: SGD 10.00–45.00",
        "halal": "No",
        "vegan": "No"
    },
    "ECF004003": {
        "name": "BBQ Seafood Kitchen",
        "hours": "Daily 16:00–23:30",
        "cuisine": "Lagoon Seafood & BBQ Sambal Delicacies",
        "menu_price": "Signature: Grilled Sambal Stingray, Butter Prawns & Crispy Baby Squid | Menu: Sambal Stingray, Black Pepper Crab, Fried Baby Squid, Sambal Kang Kong | Price: SGD 12.00–32.00",
        "halal": "No",
        "vegan": "No"
    },
    "ECF059002": {
        "name": "Al-Yusra Muslim Seafood & Satay",
        "hours": "Daily 15:30–23:30",
        "cuisine": "Halal Coastal Seafood & Mixed Satay",
        "menu_price": "Signature: Halal BBQ Sambal Fish, Butter Garlic Crab & Skewered Chicken Satay | Menu: Sambal Stingray, Black Pepper Prawns, Chicken Satay, Beef Satay, Nasi Goreng Seafood | Price: SGD 12.00–35.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "ECF061002": {
        "name": "Ali Lagoon Corner Drink Stall",
        "hours": "Daily 12:00–23:30",
        "cuisine": "Halal Tropical Fruit Juices & Fresh Coconut",
        "menu_price": "Signature: Fresh Whole Thai Coconut, Giant Sugarcane Juice with Lemon & Calamansi Juice | Menu: Fresh Coconut, Sugarcane Juice, Bandung, Teh Tarik, Mango Juice | Price: SGD 2.50–6.00",
        "halal": "Yes",
        "vegan": "Yes"
    },
    "ECF003002": {
        "name": "East Coast Seafood (Stall 003)",
        "hours": "Daily 16:00–23:00",
        "cuisine": "Coastal Live Seafood & Shellfish",
        "menu_price": "Signature: Live Sri Lankan Crab (Chilli / Black Pepper), Gong Gong (Sea Snails) & Sambal Cockles | Menu: Chilli Crab, Black Pepper Crab, Steamed Gong Gong, Sambal Kangkong | Price: SGD 14.00–45.00",
        "halal": "No",
        "vegan": "No"
    },
    "ECF037002": {
        "name": "Eastern Red Seafood",
        "hours": "Daily 16:00–23:30",
        "cuisine": "Lagoon Wok-Hei Seafood & BBQ Fish",
        "menu_price": "Signature: BBQ Sambal Pomfret, Salted Egg Calamari & Wok-Fried Mee Goreng | Menu: Sambal Pomfret, Sambal Stingray, Cereal Prawns, Seafood Hor Fun | Price: SGD 12.00–30.00",
        "halal": "No",
        "vegan": "No"
    },
    "ECF013002": {
        "name": "Fresh Sugar Cane, Coconut, Beer (Stall 013)",
        "hours": "Daily 11:30–23:30",
        "cuisine": "Cold Drinks, Fresh Juice & Seaside Beverages",
        "menu_price": "Signature: Fresh Sweet Sugarcane Juice with Calamansi & Cold Draught Beer | Menu: Sugarcane Juice, Young Coconut, Soursop Juice, Cold Canned Beverages | Price: SGD 2.50–5.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "ECF002003": {
        "name": "245 Beer Places",
        "hours": "Daily 14:00–23:30",
        "cuisine": "Beverages, Cold Beer & Soft Drinks",
        "menu_price": "Signature: Ice-Cold Bottled Beer, Sparkling Mineral Water & Fresh Coconut | Menu: Local & Imported Beer, Soft Drinks, Mineral Water | Price: SGD 2.00–8.50",
        "halal": "No",
        "vegan": "Yes"
    },
    "ECF001004": {
        "name": "Beer Corner (Stall 001)",
        "hours": "Daily 14:00–23:30",
        "cuisine": "Seaside Beverage Counter & Cold Refreshments",
        "menu_price": "Signature: Chilled Tiger Beer, Fresh Lime Juice & Iced Lemon Tea | Menu: Bottled Beer, Iced Tea, Cold Canned Drinks | Price: SGD 2.00–8.00",
        "halal": "No",
        "vegan": "Yes"
    },

    # =========================================================================
    # 3. REDHILL FOOD CENTRE (150085)
    # =========================================================================
    "RH20182003": {
        "name": "Shi Le Yuan Kway Chap . Pig's Organ Soup (世乐园粿汁猪杂汤)",
        "hours": "Tue–Thu, Sat–Sun 07:00–13:00; Mon, Fri: Closed",
        "cuisine": "Michelin Bib Gourmand Teochew Kway Chap & Pig's Organ Soup",
        "menu_price": "Signature: Michelin Bib Gourmand Silky Smooth Kway Chap in Dark Herbal Broth with Braised Pork Belly & Intestines | Menu: Kway Chap Set for 1 / 2, Pig's Organ Soup, Braised Tau Pok & Egg | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "RH20140002": {
        "name": "Bak Kee Teochew Satay Bee Hoon (峇记潮州沙爹米粉)",
        "hours": "Tue–Fri 07:30–19:45; Sat 07:30–18:00; Sun 07:30–15:00; Mon: Closed",
        "cuisine": "Michelin Recommended Teochew Satay Bee Hoon",
        "menu_price": "Signature: Springy Bee Hoon drenched in Fragrant Spiced Peanut Gravy with Pork Liver, Cuttlefish & Tau Pok | Menu: Satay Bee Hoon (Small / Medium / Large), Cuttlefish Kang Kong | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No"
    },
    "RH20149002": {
        "name": "Fu Ming Cooked Food (福明熟食)",
        "hours": "Wed–Sat 12:30–19:30; Sun 07:30–13:30; Mon–Tue: Closed",
        "cuisine": "Michelin Bib Gourmand Traditional Fried Carrot Cake",
        "menu_price": "Signature: Michelin Bib Gourmand Handmade Steamed Radish Cake fried with Eggs, Fish Sauce & Sweet Dark Molasses | Menu: Black Fried Carrot Cake, White Fried Carrot Cake, Yuan Yang Carrot Cake | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "RH20125003": {
        "name": "Ru Ji Kitchen (如记小厨)",
        "hours": "Tue–Sun 06:30–13:00; Mon: Closed",
        "cuisine": "Michelin Selected Handmade Fishball & Minced Meat Noodles",
        "menu_price": "Signature: Springy Mee Pok tossed in Fiery Chilli & Vinegar with Handmade Bouncy Fishballs & Fish Cake | Menu: Fishball Noodle (Dry / Soup), Minced Meat Noodle, Fishball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "RH20128002": {
        "name": "Seng Heng Braised Duck (成兴卤鸭)",
        "hours": "Mon–Sat 07:00–10:30; Sun: Closed",
        "cuisine": "Heritage Teochew Braised Duck Rice & Noodles",
        "menu_price": "Signature: Tender Braised Duck Noodle tossed in Savoury Dark Herbal Sauce with Crispy Lard (Sells out in 3 hours) | Menu: Braised Duck Noodle, Braised Duck Rice, Duck Gizzard / Tofu | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "RH20146003": {
        "name": "Redhill Pork Porridge (红山熟食猪肉粥)",
        "hours": "Daily 06:00–12:30",
        "cuisine": "Traditional Thick Hainanese Pork Porridge",
        "menu_price": "Signature: Thick Starchy Grain Porridge loaded with Marinated Minced Pork Balls, Pork Liver & Intestine | Menu: Pork Congee with Egg, Century Egg Pork Porridge, Fish Porridge, Extra Crispy You Tiao | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "RH20166004": {
        "name": "Hock-Shun Home-made Claypot Curry (福顺家乡砂煲咖喱)",
        "hours": "Tue–Sun 09:30–20:00; Mon: Closed",
        "cuisine": "Sizzling Claypot Curry Fish Head & Chicken",
        "menu_price": "Signature: Bubbling Claypot Assam Curry Fish Head with Tau Pok & Lady's Finger & Claypot Curry Chicken | Menu: Claypot Curry Fish Head (Half / Whole), Claypot Curry Chicken, Braised Cabbage | Price: SGD 6.00–26.00",
        "halal": "No",
        "vegan": "No"
    },
    "RH20177004": {
        "name": "Rong Xing Lamian Xiao Long Bao (荣兴拉面小笼包)",
        "hours": "Tue–Sun 09:00–20:00; Mon: Closed",
        "cuisine": "Handmade Northern Chinese Xiao Long Bao & Guo Tie",
        "menu_price": "Signature: Steamed Juicy Soup Dumplings (Xiao Long Bao) & Crispy Pan-Fried Dumplings (Guo Tie) | Menu: Steamed Xiao Long Bao (6 pcs), Pan-Fried Guo Tie (8 pcs), Dan Dan Noodles, Zha Jiang Mian | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "RH20161002": {
        "name": "Granny's Pancake (Redhill)",
        "hours": "Tue–Sun 06:00–14:00; Mon: Closed",
        "cuisine": "Traditional Min Jiang Kueh & Peanut Pancakes",
        "menu_price": "Signature: Fluffy Min Jiang Kueh with Roasted Crushed Peanuts, Red Bean & Grated Coconut | Menu: Peanut Pancake, Red Bean Pancake, Coconut Pancake, Peanut Butter Pancake | Price: SGD 1.20–1.60",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "RH20107003": {
        "name": "Soon Lee Vegetarian Food (顺利素食)",
        "hours": "Thu–Tue 06:00–13:30; Wed: Closed",
        "cuisine": "Traditional Chinese Vegetarian & Vegan Breakfast",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon with Crispy Zhai Er (Beancurd Crackers) & Mock Char Siew | Menu: Vegetarian Bee Hoon / Noodles, Mock Duck, Spring Roll, Vegetarian Laksa, Vegetarian Lor Mee | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "RH20131003": {
        "name": "Ji Xiang Ru Yi Vegetarian (吉祥如意素食)",
        "hours": "Tue–Sun 06:30–14:00; Mon: Closed",
        "cuisine": "Traditional Chinese Vegetarian Fare",
        "menu_price": "Signature: Vegetarian Economic Bee Hoon with Stewed Cabbage, Mock Meats & Fried Beancurd Skin | Menu: Vegetarian Bee Hoon, Vegetarian Hor Fun, Braised Mock Meat Rice | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "RH20101002": {
        "name": "Ali Fatimah Food Stall",
        "hours": "Daily 06:00–20:00",
        "cuisine": "Indian Muslim Cuisine & Crispy Roti Prata",
        "menu_price": "Signature: Crispy Plain Prata with Mutton Curry Dalcha, Egg Onion Prata & Mee Goreng | Menu: Plain Prata, Egg Prata, Murtabak (Chicken / Mutton), Nasi Biryani, Teh Tarik | Price: SGD 1.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "RH20178002": {
        "name": "Fatimah Muslim Food",
        "hours": "Tue–Sun 06:00–15:00; Mon: Closed",
        "cuisine": "Traditional Malay Breakfast & Nasi Padang",
        "menu_price": "Signature: Comforting Lontong Sayur Lodeh, Mee Rebus & Nasi Lemak with Sambal Ikan Bilis | Menu: Lontong, Mee Rebus, Mee Siam, Nasi Lemak Chicken Wing, Bergedil | Price: SGD 3.50–6.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "RH20124003": {
        "name": "Sufyan Indian Muslim Food",
        "hours": "Daily 06:30–20:30",
        "cuisine": "Halal Indian Muslim Dishes & Roti Prata",
        "menu_price": "Signature: Crispy Coin Prata with Fish Curry, Maggi Goreng Pattaya & Mutton Murtabak | Menu: Roti Prata, Mee Goreng Mamak, Nasi Goreng Merah, Mutton Biryani | Price: SGD 1.50–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "RH20158002": {
        "name": "Khoon Kee Tasty Prawn Mee",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Traditional Hokkien Prawn Noodle Soup",
        "menu_price": "Signature: Rich Umami Prawn Soup with Fresh Halved Prawns, Tender Pork Ribs & Fragrant Pork Lard | Menu: Prawn Noodle (Dry / Soup), Pork Rib Prawn Noodle, Tail Prawn Noodle | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "RH20180002": {
        "name": "(QuanSheng) Jin Liang Prawn Noodles",
        "hours": "Wed–Mon 06:30–14:00; Tue: Closed",
        "cuisine": "Traditional Prawn & Pork Rib Noodles",
        "menu_price": "Signature: Savoury Prawn Noodle Dry tossed in Fragrant Chilli Paste with Pig's Tail & Pork Ribs | Menu: Prawn Noodle (Soup / Dry), Pork Rib Noodle, Pig's Tail Prawn Noodle | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "RH20115002": {
        "name": "Red Hill Chwee Kueh (红山水粿)",
        "hours": "Daily 06:00–13:30",
        "cuisine": "Traditional Steamed Chwee Kueh",
        "menu_price": "Signature: Steamed Rice Cakes topped with Fragrant Stewed Preserved Radish (Chai Poh) & Sambal Dip | Menu: Chwee Kueh (4 pcs / 6 pcs / 8 pcs) | Price: SGD 2.00–4.00",
        "halal": "No",
        "vegan": "No"
    },
    "RH20160002": {
        "name": "Qing Tian Cold & Hot Dessert (晴天冷热甜品)",
        "hours": "Wed–Sun 11:30–19:30; Mon–Tue: Closed",
        "cuisine": "Traditional Local Hot & Cold Sweets",
        "menu_price": "Signature: Shaved Ice Kachang with Sweet Red Beans, Attap Chee & Hot Tau Suan with Crispy You Tiao | Menu: Ice Kachang, Chendol, Tau Suan, Cheng Tng (Hot/Cold), Bo Bo Cha Cha | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },

    # =========================================================================
    # 4. TAMPINES ROUND MARKET & FOOD CENTRE (521137)
    # =========================================================================
    "TA10135003": {
        "name": "Xing Ji Wanton Mee (星记云吞面)",
        "hours": "Thu–Mon 06:00–12:30; Tue–Wed: Closed",
        "cuisine": "Traditional Springy Wanton Noodles",
        "menu_price": "Signature: Springy Egg Noodles tossed in Dark Savoury Lard Sauce with Char Siew & Plump Dumpling Soup | Menu: Wanton Noodle (Dry / Soup), Dumpling Noodle (Sui Kow), Shredded Chicken Hor Fun | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "TA10139003": {
        "name": "Chai Chee Pork Porridge (柴船头猪肉粥)",
        "hours": "Daily 06:00–13:00",
        "cuisine": "Traditional Silky Hainanese Pork Porridge",
        "menu_price": "Signature: Velvety Hainanese Pork Congee with Homemade Minced Meat Balls, Pork Slices & Crispy You Tiao | Menu: Pork Congee, Century Egg & Pork Porridge, Shredded Chicken Porridge, Extra Raw Egg | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    "TA10107003": {
        "name": "Song Han Carrot Cake (松汉菜头粿)",
        "hours": "Tue–Wed, Fri–Sun 06:00–12:00; Mon, Thu: Closed",
        "cuisine": "Unique Curry Powder Fried Carrot Cake",
        "menu_price": "Signature: Fragrant Fried Carrot Cake infused with Aromatic Curry Powder, Prawns & Preserved Radish (Chai Poh) | Menu: Black Carrot Cake, White Carrot Cake (with Curry Powder) | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "TA10133003": {
        "name": "Rajarani Thosai (拉贾拉尼多踩)",
        "hours": "Thu–Tue 07:00–13:30; Wed: Closed",
        "cuisine": "Michelin Bib Gourmand South Indian Thosai & Appam",
        "menu_price": "Signature: Michelin Bib Gourmand Crispy Masala Thosai with Spiced Potato Filling, Coconut Chutney & Fresh Appam with Orange Sugar | Menu: Plain Thosai, Masala Thosai, Egg Onion Thosai, Appam, Uttapam | Price: SGD 2.00–4.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "TA10109004": {
        "name": "137 Lor Mee Prawn Mee (137卤面虾面)",
        "hours": "Tue–Sun 06:30–14:00; Mon: Closed",
        "cuisine": "Heritage Traditional Lor Mee & Prawn Noodles",
        "menu_price": "Signature: Thick Starchy Lor Mee with Braised Pork Belly, Fried Fish Nuggets & Prawn Noodle Soup | Menu: Traditional Lor Mee, Prawn Noodle (Dry / Soup), Pork Rib Prawn Mee | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "TA10140003": {
        "name": "Armenian Street Fried Kway Teow (亚米尼亚街炒粿条)",
        "hours": "Fri–Wed 11:30–19:30; Thu: Closed",
        "cuisine": "Heritage Smoky Charcoal Wok Hei Char Kway Teow",
        "menu_price": "Signature: Traditional Smoky Char Kway Teow fried with Cockles, Lup Cheong, Fishcake & Crunchy Pork Lard | Menu: Char Kway Teow (Small / Medium / Large), Extra Cockles | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "TA10103003": {
        "name": "Hai Chang Fishhead Steamboat (海昌鱼头炭炉)",
        "hours": "Wed–Sun 17:00–21:00; Mon–Tue: Closed",
        "cuisine": "Charcoal-Fired Teochew Fish Head Steamboat & Zi Char",
        "menu_price": "Signature: Bubbling Charcoal Pomfret & Red Garoupa Fish Head Steamboat with Yam, Tofu & Cabbage | Menu: Fish Head Steamboat (Pomfret / Red Garoupa), Prawn Paste Chicken, Sambal Kang Kong | Price: SGD 25.00–65.00",
        "halal": "No",
        "vegan": "No"
    },
    "TA10105003": {
        "name": "Teo Kee Mushroom Minced Pork Noodle (潮记香菇肉脞面)",
        "hours": "Wed–Sun 06:00–14:00; Mon–Tue: Closed",
        "cuisine": "Teochew Mushroom Minced Meat Noodle & Braised Pork Ribs",
        "menu_price": "Signature: Mee Pok Dry tossed with Stewed Mushrooms, Braised Pork Ribs & Crispy Pork Lard | Menu: Mushroom Minced Pork Noodle, Pork Rib Noodle, Meatball Soup | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "TA10114002": {
        "name": "Nasi Lemak Specialist (Tampines Round Market)",
        "hours": "Tue–Sun 06:30–13:30; Mon: Closed",
        "cuisine": "Halal Fragrant Coconut Nasi Lemak",
        "menu_price": "Signature: Coconut Pandan Nasi Lemak with Crispy Spiced Fried Chicken Wing, Otah & Sweet-Spicy Sambal | Menu: Nasi Lemak Sets (Chicken Wing / Fish / Selar), Sambal Long Bean, Bergedil | Price: SGD 3.50–6.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "TA10136003": {
        "name": "Tok Ayah Delights",
        "hours": "Tue–Sun 06:30–14:00; Mon: Closed",
        "cuisine": "Traditional Malay Breakfast Delicacies",
        "menu_price": "Signature: Fragrant Lontong with Rich Sayur Lodeh, Mee Rebus & Mee Soto with Sambal Kicap | Menu: Lontong, Mee Rebus, Mee Siam, Mee Soto Ayam, Epok-Epok | Price: SGD 3.50–5.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "TA10137004": {
        "name": "Kayat (Tampines Round Market)",
        "hours": "Daily 06:00–20:00",
        "cuisine": "Indian Muslim Cuisine & Crispy Prata",
        "menu_price": "Signature: Fresh Hand-Tossed Crispy Plain Prata with Fish Curry, Murtabak & Mee Goreng Mamak | Menu: Plain Prata, Egg Onion Prata, Coin Prata, Chicken Murtabak, Mee Goreng | Price: SGD 1.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "TA10138003": {
        "name": "Tiong Bahru Fried Fishball (Tampines Round Market)",
        "hours": "Tue–Sun 06:30–13:30; Mon: Closed",
        "cuisine": "Handmade Fishballs & Teochew Fishball Noodles",
        "menu_price": "Signature: Bouncy Fresh Teochew Fishballs, Crispy Deep-Fried Fishballs & Minced Meat Noodles | Menu: Fishball Noodle (Dry / Soup), Fried Fishball (5 pcs), Fish Cake | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    "TA10142003": {
        "name": "De Fa Vegetarian (德发素食)",
        "hours": "Tue–Sun 06:00–13:00; Mon: Closed",
        "cuisine": "Traditional Chinese Vegetarian & Vegan Breakfast",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon with Crispy Zhai Er, Mock Char Siew & Stewed Cabbage | Menu: Vegetarian Economic Bee Hoon / Kway Teow, Mock Duck, Spring Roll, Vegetarian Lor Mee | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes"
    },
    "TA10145003": {
        "name": "Yummy Sarawak Kolo Mee (美味砂拉越哥罗面)",
        "hours": "Tue–Sun 06:00–14:00; Mon: Closed",
        "cuisine": "Authentic Kuching Sarawak Kolo Mee",
        "menu_price": "Signature: Springy Curly Egg Noodles tossed in Fragrant Lard / Shallot Oil with Char Siew & Seasoned Minced Pork | Menu: Sarawak Kolo Mee (Red / White / Black Sauce), Wanton Soup | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },

    # =========================================================================
    # 5. CHONG PANG MARKET & FOOD CENTRE (760105)
    # =========================================================================
    "YR401161002": {
        "name": "Chuan Kee Boneless Braised Duck (全记无骨卤鸭)",
        "hours": "Sun–Fri 10:00–20:00; Sat: Closed",
        "cuisine": "Michelin Bib Gourmand Teochew Boneless Braised Duck Rice",
        "menu_price": "Signature: Michelin Bib Gourmand Tender Boneless Braised Duck with Fragrant Herbal Rice & Duck Porridge | Menu: Boneless Duck Rice Set, Duck Porridge, Duck Noodle, Braised Bean Curd & Egg | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    "YR401152002": {
        "name": "Ji De Lai Hainanese Chicken Rice (记得来海南鸡饭)",
        "hours": "Daily 08:30–20:00",
        "cuisine": "Hainanese Steamed & Roasted Chicken Rice",
        "menu_price": "Signature: Tender Poached White Chicken Rice & Crispy Roasted Chicken with Fragrant Garlic Chili | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Half / Whole Chicken | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "YR401125002": {
        "name": "Chong Pang Pig Organ's Soup & Mutton Soup (忠邦猪杂汤与羊肉汤)",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Traditional Peppery Pig's Organ Soup & Chinese Herbal Mutton Soup",
        "menu_price": "Signature: Peppery Salted Vegetable Pig's Organ Soup with Sliced Pork & Herbal Mutton Rib Soup | Menu: Pig's Organ Soup, Meatball Soup, Herbal Mutton Soup, Braised Pig's Trotter | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "YR401142002": {
        "name": "Bedok Chwee Kueh (Chong Pang)",
        "hours": "Daily 06:30–19:30",
        "cuisine": "Michelin Bib Gourmand Steamed Rice Chwee Kueh",
        "menu_price": "Signature: Steamed Rice Cakes topped with Savoury Stewed Preserved Radish (Chai Poh) & Sambal Chilli | Menu: Chwee Kueh (2 pcs / 4 pcs / 6 pcs) | Price: SGD 1.60–3.60",
        "halal": "No",
        "vegan": "No"
    },
    "YR401144002": {
        "name": "Fu Qiang Spinach Soup (富强苋菜汤)",
        "hours": "Daily 08:30–20:00",
        "cuisine": "Double-Boiled Fresh Spinach Soup & Seafood Broth",
        "menu_price": "Signature: Nourishing Fresh Spinach Soup with Century Egg, Salted Egg, Minced Pork & Fresh Prawns | Menu: Spinach Minced Pork Soup, Spinach Seafood Soup, Sliced Fish Spinach Soup | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "YR401147002": {
        "name": "Chong Pang 105 Teochew Fish Porridge",
        "hours": "Daily 07:00–19:30",
        "cuisine": "Teochew Fresh Sliced Fish Soup & Fish Porridge",
        "menu_price": "Signature: Clear Batang Fish Soup with Bittergourd & Sliced Pomfret Porridge | Menu: Sliced Fish Soup, Fried Fish Soup, Seafood Tom Yum Soup, Sliced Fish Porridge | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    "YR401154002": {
        "name": "Nee Soon Fish Head Mee Hoon (义顺鱼头米粉)",
        "hours": "Daily 09:00–20:30",
        "cuisine": "Rich Milky Fish Head Bee Hoon & Fried Fish Soup",
        "menu_price": "Signature: Deep-Fried Fish Head Bee Hoon in Rich Milky Broth with Cognac & Tomatoes | Menu: Fried Fish Head Bee Hoon, Sliced Fish Soup, Seafood Soup | Price: SGD 6.00–9.00",
        "halal": "No",
        "vegan": "No"
    },
    "YR401170002": {
        "name": "Super Penyet (Chong Pang)",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Halal Indonesian Ayam Penyet & Grilled Delights",
        "menu_price": "Signature: Smashed Fried Chicken (Ayam Penyet) with Fiery Sambal Terasi, Fried Tofu & Tempeh | Menu: Ayam Penyet, Ikan Penyet, Ayam Bakar, Nasi Goreng Penyet | Price: SGD 6.00–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "YR401171002": {
        "name": "Haji Ali Cooked Food",
        "hours": "Daily 06:00–20:30",
        "cuisine": "Halal Indian Muslim Cuisine & Roti Prata",
        "menu_price": "Signature: Crispy Prata with Mutton Curry, Mee Goreng Mamak & Chicken Biryani | Menu: Plain Prata, Egg Prata, Murtabak (Mutton / Chicken), Mee Goreng, Nasi Biryani | Price: SGD 1.50–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    "YR401172002": {
        "name": "Alsafaz Makan Stall",
        "hours": "Daily 06:00–21:00",
        "cuisine": "Halal Indian Muslim Cuisine & Roti John",
        "menu_price": "Signature: Hand-Tossed Roti Prata, Spiced Mutton Roti John & Mee Kuah | Menu: Roti Prata, Roti John, Maggi Goreng, Nasi Goreng Merah | Price: SGD 1.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "YR401173002": {
        "name": "Sinar Suria (Chong Pang)",
        "hours": "Tue–Sun 06:30–15:00; Mon: Closed",
        "cuisine": "Traditional Halal Malay Breakfast & Nasi Padang",
        "menu_price": "Signature: Fragrant Nasi Lemak Kukus, Lontong Sayur Lodeh & Mee Soto Ayam | Menu: Nasi Lemak Sets, Lontong, Mee Rebus, Mee Siam, Bergedil | Price: SGD 3.50–6.00",
        "halal": "Yes",
        "vegan": "No"
    },
    "YR401162002": {
        "name": "Nyonya Chendol (Chong Pang)",
        "hours": "Daily 09:30–20:30",
        "cuisine": "Traditional Gula Melaka Chendol",
        "menu_price": "Signature: Pure Melaka Gula Melaka Shaved Ice Chendol with Fresh Pandan Jelly & Red Beans | Menu: Original Chendol, Red Bean Chendol, Sweet Corn Chendol, D24 Durian Chendol | Price: SGD 2.50–4.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    "YR401138002": {
        "name": "Xi Jia Yuen Curry Rice (喜家园咖喱饭)",
        "hours": "Daily 09:30–19:30",
        "cuisine": "Hainanese Curry Rice & Stewed Pork Belly",
        "menu_price": "Signature: Crispy Hainanese Pork Chop Curry Rice drenched in Gooey Curry Sauce & Braised Cabbage | Menu: Hainanese Curry Rice, Pork Chop, Chap Chye, Curry Chicken Drumstick, Braised Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    "YR401127002": {
        "name": "Pow Huat Dim Sum (宝发点心)",
        "hours": "Daily 06:00–14:00",
        "cuisine": "Traditional Handmade Steamed Pau & Dim Sum",
        "menu_price": "Signature: Handmade Big Pork Pau, Savoury Char Siew Pau & Steamed Siew Mai | Menu: Big Pau, Char Siew Pau, Lian Rong Pau, Siew Mai, Har Gao, Fan Choy | Price: SGD 1.00–2.50",
        "halal": "No",
        "vegan": "No"
    },
    "YR401179002": {
        "name": "Foo Hing Handmade Fishball & Meatball Noodle",
        "hours": "Tue–Sun 06:30–14:00; Mon: Closed",
        "cuisine": "Handmade Bouncy Fishball & Meatball Noodles",
        "menu_price": "Signature: Springy Mee Pok Dry with Fresh Handmade Fishballs, Seasoned Meatballs & Crispy Lard | Menu: Fishball Noodle (Dry / Soup), Meatball Noodle, Mixed Fishball Meatball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    }
}
