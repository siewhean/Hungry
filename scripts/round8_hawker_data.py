#!/usr/bin/env python3
"""
Round 8 hawker enrichment data to integrate into scripts/enrich_famous_hawker_centres.py
Covers Chinatown Complex (050335), Golden Mile Food Centre (199583), Tekka Centre (210665),
Newton Food Centre (229495), and Tiong Bahru Market (168898).
"""

NEW_HAWKER_ENTRIES = {
    # ==========================================
    # CHINATOWN COMPLEX (050335)
    # ==========================================
    ("050335", (2, 198)): {
        "name": "Lian He Ben Ji Claypot Rice",
        "hours": "Fri–Wed 15:00–21:00; Thu: Closed",
        "cuisine": "Cantonese Claypot Rice",
        "menu_price": "Signature: Charcoal Cooked Claypot Rice | Menu: Mixed Claypot Rice (Chicken, Waxed Meat, Lup Cheong), Salted Fish Claypot, Herbal Soup | Price: SGD 15.00–30.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6227 2470"
    },
    ("050335", (2, 199)): {
        "name": "Lian He Ben Ji Claypot Rice",
        "hours": "Fri–Wed 15:00–21:00; Thu: Closed",
        "cuisine": "Cantonese Claypot Rice",
        "menu_price": "Signature: Charcoal Cooked Claypot Rice | Menu: Mixed Claypot Rice (Chicken, Waxed Meat, Lup Cheong), Salted Fish Claypot, Herbal Soup | Price: SGD 15.00–30.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6227 2470"
    },
    ("050335", (2, 156)): {
        "name": "Jin Ji Teochew Braised Duck & Kway Chap",
        "hours": "Sat–Thu 10:30–18:00; Fri: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: The Bento Braised Duck Rice | Menu: Braised Duck Rice, Kway Chap Set, Duck Rice Bento, Lava Egg, Pork Belly | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 88)): {
        "name": "Xiu Ji Ikan Bilis Yong Tau Fu",
        "hours": "Tue–Sun 05:45–13:30; Mon: Closed",
        "cuisine": "Hakka Yong Tau Foo",
        "menu_price": "Signature: Yong Tau Foo with Crispy Ikan Bilis & Bee Hoon | Menu: Yong Tau Foo (6 pcs with Bee Hoon/Noodles), Fishcake, Stuffed Bitter Gourd, Stuffed Tofu | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 87)): {
        "name": "Xiu Ji Ikan Bilis Yong Tau Fu",
        "hours": "Tue–Sun 05:45–13:30; Mon: Closed",
        "cuisine": "Hakka Yong Tau Foo",
        "menu_price": "Signature: Yong Tau Foo with Crispy Ikan Bilis & Bee Hoon | Menu: Yong Tau Foo (6 pcs with Bee Hoon/Noodles), Fishcake, Stuffed Bitter Gourd, Stuffed Tofu | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 62)): {
        "name": "Smith Street Taps",
        "hours": "Tue–Thu 18:00–22:30, Fri 18:00–23:00, Sat 14:00–23:00; Sun, Mon: Closed",
        "cuisine": "Craft Beer & Beverages",
        "menu_price": "Signature: Local & International Craft Beers on Tap | Menu: Fresh Draft Beers, IPA, Stout, Sour Ale, Cider | Price: SGD 10.00–18.00",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    ("050335", (2, 213)): {
        "name": "Pang's Satay",
        "hours": "Mon, Tue, Fri 17:00–21:00, Sat, Sun 16:30–21:00; Wed, Thu: Closed",
        "cuisine": "Hainanese Satay",
        "menu_price": "Signature: Traditional Hainanese Pork Satay with Pineapple Peanut Sauce | Menu: Pork Satay, Chicken Satay, Mutton Satay, Ketupat | Price: SGD 0.80–1.00 per stick",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 20)): {
        "name": "Ye Ji Cooked Food",
        "hours": "Mon–Fri 08:30–14:30; Sat, Sun: Closed",
        "cuisine": "Cantonese Economic Rice",
        "menu_price": "Signature: Cantonese Economic Rice (Cai Fan) | Menu: Steamed Minced Meat, Sweet & Sour Pork, Braised Cabbage, Steamed Fish | Price: SGD 3.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 8)): {
        "name": "Old Amoy Chendol",
        "hours": "Daily 10:30–20:30",
        "cuisine": "Traditional Desserts",
        "menu_price": "Signature: Traditional Cold Chendol | Menu: Cold Chendol with Red Bean and Pure Gula Melaka | Price: SGD 2.50–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly"
    },
    ("050335", (2, 48)): {
        "name": "The 1950s Coffee",
        "hours": "Tue–Sun 07:00–16:30; Mon: Closed",
        "cuisine": "Traditional Coffee & Toast",
        "menu_price": "Signature: Traditional Nanyang Kopi O & Kaya Toast | Menu: Kopi O, Kopi C, Teh, Half-Boiled Eggs, Traditional Kaya Butter Toast | Price: SGD 1.20–3.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 112)): {
        "name": "Ann Chin Popiah",
        "hours": "Daily 08:00–19:00",
        "cuisine": "Singaporean Popiah",
        "menu_price": "Signature: Handmade Fresh Popiah | Menu: Traditional Popiah, Kueh Pie Tee, Fried Spring Roll, Deep Fried Yam Roll | Price: SGD 2.20–4.50",
        "halal": "Yes",
        "vegan": "No",
        "website": "https://annchinpopiah.com.sg/"
    },
    ("050335", (2, 7)): {
        "name": "Chef Sham H.K. Vinegar Trotter",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Cantonese Herbal Soups",
        "menu_price": "Signature: Hong Kong Vinegar Pig's Trotters | Menu: Black Vinegar Pork Trotter, Fish Maw Herbal Chicken Soup, Old Cucumber Soup | Price: SGD 6.00–9.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 11)): {
        "name": "Poh Preserved Veg Hor Fun",
        "hours": "Tue–Sun 11:00–15:00; Mon: Closed",
        "cuisine": "Cantonese Zi Char",
        "menu_price": "Signature: Preserved Radish Hor Fun (Chai Poh Hor Fun) | Menu: Chai Poh Hor Fun, Beef Hor Fun, Black Bean Bitter Gourd Fish Head, Prawn Paste Chicken | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 206)): {
        "name": "115 Tang Shui",
        "hours": "Wed–Sun 07:30–15:30; Mon, Tue: Closed",
        "cuisine": "Traditional Cantonese Desserts",
        "menu_price": "Signature: Traditional Stone-Ground Sesame & Almond Paste | Menu: Black Sesame Paste, Almond Paste, Walnut Paste, Peanut Paste | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "Yes"
    },
    ("050335", (2, 113)): {
        "name": "75 Ah Balling Peanut Soup",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Traditional Desserts",
        "menu_price": "Signature: Tang Yuan in Peanut Soup | Menu: Ah Balling Tang Yuan (Peanut, Sesame, Red Bean, Yam, Matcha), Peanut Soup, Ginger Soup, Almond Milk | Price: SGD 2.60–4.00",
        "halal": "No",
        "vegan": "Yes"
    },
    ("050335", (2, 110)): {
        "name": "Chang Ji Gourmet",
        "hours": "Wed–Sun 06:30–14:00; Mon, Tue: Closed",
        "cuisine": "Cantonese Breakfast",
        "menu_price": "Signature: Economic Fried Bee Hoon & Fish Porridge | Menu: Fried Bee Hoon, Fried Mee, Raw Fish Porridge, Peanut Porridge | Price: SGD 1.50–3.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 59)): {
        "name": "Chai Wee Cuttlefish",
        "hours": "Tue–Sat 07:30–15:00; Sun, Mon: Closed",
        "cuisine": "Traditional Preserved Snacks",
        "menu_price": "Signature: Shredded Cuttlefish & Roasted Cuttlefish | Menu: Cuttlefish, Crispy Silver Fish, BBQ Sweet Cuttlefish | Price: SGD 5.00–15.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 65)): {
        "name": "Chai Wee Cuttlefish",
        "hours": "Tue–Sat 07:30–15:00; Sun, Mon: Closed",
        "cuisine": "Traditional Preserved Snacks",
        "menu_price": "Signature: Shredded Cuttlefish & Roasted Cuttlefish | Menu: Cuttlefish, Crispy Silver Fish, BBQ Sweet Cuttlefish | Price: SGD 5.00–15.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 78)): {
        "name": "Pan Ji Cooked Food",
        "hours": "Daily 08:00–15:00",
        "cuisine": "Traditional Chinese Pastries",
        "menu_price": "Signature: Handmade Sachima (Sha Qi Ma) | Menu: Sachima, Egg Twists (Dan San), Honey Twists | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 131)): {
        "name": "Heng Ji Chicken Rice",
        "hours": "Tue–Sun 15:00–20:00; Mon: Closed",
        "cuisine": "Hainanese Chicken Rice",
        "menu_price": "Signature: Hainanese Steamed White Chicken Rice | Menu: Steamed Chicken Rice, Chicken Gizzard, Braised Egg, Oyster Sauce Vegetables | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 97)): {
        "name": "Hong Kong Mongkok Tim Sum",
        "hours": "Wed–Sun 11:00–16:00; Mon, Tue: Closed",
        "cuisine": "Cantonese Dim Sum",
        "menu_price": "Signature: Fresh Handmade Char Siew Bao & Har Gao | Menu: Har Gao, Siew Mai, Char Siew Bao, Steamed Pork Ribs, Century Egg Porridge | Price: SGD 2.50–4.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 56)): {
        "name": "Woo Ji Cooked Food",
        "hours": "Wed–Sat 06:00–09:30; Sun, Mon, Tue: Closed",
        "cuisine": "Singaporean Laksa & Prawn Noodles",
        "menu_price": "Signature: Traditional Hawker Laksa & Prawn Noodles | Menu: Laksa, Prawn Noodle Soup, Dry Prawn Mee | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 94)): {
        "name": "Ah Qing Traditional Lor Mee",
        "hours": "Daily 07:30–15:00",
        "cuisine": "Hokkien Lor Mee",
        "menu_price": "Signature: Traditional Lor Mee with Braised Pork & Crispy Bits | Menu: Traditional Lor Mee, Fried Fish Lor Mee, Braised Egg, Ngoh Hiang | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 32)): {
        "name": "Hill Street Fried Kway Teow",
        "hours": "Tue, Thu 11:00–18:30, Sat 10:00–17:00; Mon, Wed, Fri, Sun: Closed",
        "cuisine": "Teochew Char Kway Teow",
        "menu_price": "Signature: Traditional Char Kway Teow with Cockles & Chinese Sausage | Menu: Char Kway Teow (Regular/Large) | Price: SGD 4.00–5.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 205)): {
        "name": "Shang Hai Fried Xiao Long Bao",
        "hours": "Thu–Tue 10:30–15:30, 17:30–20:30; Wed: Closed",
        "cuisine": "Shanghainese",
        "menu_price": "Signature: Sheng Jian Bao (Pan-Fried Pork Buns) | Menu: Pan-Fried Pork Buns, Xiao Long Bao, Dan Dan Noodles, Hot and Sour Soup | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 135)): {
        "name": "Zhong Guo La Mian Xiao Long Bao",
        "hours": "Wed–Sun 11:30–15:00, 17:00–20:30; Mon, Tue: Closed",
        "cuisine": "Northern Chinese",
        "menu_price": "Signature: Handmade Xiao Long Bao & Szechuan Spicy Wanton | Menu: Steamed Mini Juicy Buns (Xiao Long Bao), Szechuan Spicy Oil Wanton, Beijing La Mian, Fried Dumplings | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 126)): {
        "name": "Liao Fan Hawker Chan",
        "hours": "Mon–Sat 10:30–15:30; Sun: Closed",
        "cuisine": "Cantonese Roasted Meat",
        "menu_price": "Signature: Soya Sauce Chicken Rice & Soya Sauce Chicken Noodle | Menu: Soya Sauce Chicken Rice, Char Siew Noodle, Roasted Pork Noodle, Half/Whole Soya Sauce Chicken | Price: SGD 3.80–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 219)): {
        "name": "1030 Breakfast Shop 一零三零",
        "hours": "Wed–Sun 07:30–14:00; Mon, Tue: Closed",
        "cuisine": "Taiwanese Breakfast",
        "menu_price": "Signature: Taiwanese Egg Crepe Roll (Dan Bing) & Peanut Thick Toast | Menu: Bacon Egg Crepe, Cheese Egg Roll, Pork Floss Dan Bing, Taiwanese Milk Tea | Price: SGD 3.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 169)): {
        "name": "169 Hainanese Chicken Rice",
        "hours": "Thu–Tue 11:00–15:00; Wed: Closed",
        "cuisine": "Hainanese Chicken Rice",
        "menu_price": "Signature: Traditional Hainanese Steamed White Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg | Price: SGD 3.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 166)): {
        "name": "Jia Ji Mei Shi",
        "hours": "Thu–Tue 06:00–22:00; Wed: Closed",
        "cuisine": "Cantonese Dim Sum & Porridge",
        "menu_price": "Signature: Chee Cheong Fun & Yam Cake | Menu: Chee Cheong Fun, Yam Cake, Soon Kueh, Century Egg Porridge, Fried Bee Hoon | Price: SGD 1.50–3.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 193)): {
        "name": "An Ji Cooked Food",
        "hours": "Thu–Tue 11:00–14:00, 16:30–21:30; Wed: Closed",
        "cuisine": "Cantonese Zi Char",
        "menu_price": "Signature: Crispy Beef Noodles & Claypot Fish Head | Menu: Crispy Beef Noodles, Fish Head Bee Hoon, Sliced Fish Hor Fun, Sambal Kang Kong | Price: SGD 6.00–18.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 194)): {
        "name": "An Ji",
        "hours": "Thu–Tue 11:00–14:00, 16:30–21:30; Wed: Closed",
        "cuisine": "Cantonese Zi Char",
        "menu_price": "Signature: Crispy Beef Noodles & Claypot Fish Head | Menu: Crispy Beef Noodles, Fish Head Bee Hoon, Sliced Fish Hor Fun, Sambal Kang Kong | Price: SGD 6.00–18.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 151)): {
        "name": "Yuet Loy Cooked Food",
        "hours": "Fri–Tue 11:30–13:30, 17:30–20:00; Wed, Thu: Closed",
        "cuisine": "Cantonese Zi Char",
        "menu_price": "Signature: Sweet and Sour Pork & Cantonese Beef Hor Fun | Menu: Sweet and Sour Pork, Cantonese Beef Hor Fun, Sambal Kangkong, Prawn Paste Chicken | Price: SGD 7.00–16.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9170 4152"
    },
    ("050335", (2, 186)): {
        "name": "You Fu Fried Hokkien Prawn Noodle",
        "hours": "Mon–Sat 10:30–20:00; Sun: Closed",
        "cuisine": "Hokkien Mee",
        "menu_price": "Signature: Wok-Hei Fried Hokkien Prawn Mee | Menu: Fried Hokkien Prawn Noodles (Thin/Thick Bee Hoon with Yellow Noodles) | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 168)): {
        "name": "168 CMY Satay",
        "hours": "Tue–Sun 09:00–19:00; Mon: Closed",
        "cuisine": "Hainanese Satay",
        "menu_price": "Signature: Hainanese Pork Satay with Pineapple Puree | Menu: Pork Satay, Chicken Satay, Mutton Satay, Pork Belly Satay, Ketupat | Price: SGD 0.80–1.00 per stick",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9475 2907"
    },
    ("050335", (2, 82)): {
        "name": "Weng Kiang Kee Porridge",
        "hours": "Wed–Sun 07:00–13:30; Mon, Tue: Closed",
        "cuisine": "Cantonese Porridge",
        "menu_price": "Signature: Hainanese Claypot Porridge with Century Egg & Pork Innards | Menu: Mixed Pork Porridge, Fish Porridge, Century Egg & Lean Meat Porridge, Cuttlefish & Peanut Porridge | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 79)): {
        "name": "Shi Xiang Satay",
        "hours": "Tue–Sun 12:30–20:30; Mon: Closed",
        "cuisine": "Hainanese Satay",
        "menu_price": "Signature: Hainanese Pork Satay with Pineapple Gravy | Menu: Pork Satay, Chicken Satay, Mutton Satay, Ketupat | Price: SGD 0.80–1.00 per stick",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 84)): {
        "name": "Fatty Ox HK Kitchen",
        "hours": "Wed–Sun 07:30–14:30; Mon, Tue: Closed",
        "cuisine": "Hong Kong Roasted Delights",
        "menu_price": "Signature: Hong Kong Beef Brisket & Roast Duck Noodles | Menu: Braised Beef Brisket Noodle, Roast Duck Rice, Char Siew & Sio Bak, Wanton Soup | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 96)): {
        "name": "Fatty Ox HK Kitchen",
        "hours": "Wed–Sun 07:30–14:30; Mon, Tue: Closed",
        "cuisine": "Hong Kong Roasted Delights",
        "menu_price": "Signature: Hong Kong Beef Brisket & Roast Duck Noodles | Menu: Braised Beef Brisket Noodle, Roast Duck Rice, Char Siew & Sio Bak, Wanton Soup | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 221)): {
        "name": "Alif Nasi Padang",
        "hours": "Mon–Sat 07:00–15:30; Sun: Closed",
        "cuisine": "Malay Nasi Padang",
        "menu_price": "Signature: Nasi Padang with Beef Rendang & Sambal Goreng | Menu: Beef Rendang, Ayam Masak Merah, Sayur Lodeh, Sambal Goreng, Begedil | Price: SGD 4.50–8.00",
        "halal": "Yes",
        "vegan": "No"
    },
    ("050335", (2, 180)): {
        "name": "Teo Kee Hainanese Chicken Rice",
        "hours": "Wed–Mon 10:00–20:00; Tue: Closed",
        "cuisine": "Hainanese Chicken Rice",
        "menu_price": "Signature: Steamed White Chicken Rice & Roasted Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 209)): {
        "name": "SohGood Bak Chang",
        "hours": "Wed–Sat 09:30–17:00, Tue 14:30–17:00; Sun, Mon: Closed",
        "cuisine": "Traditional Rice Dumplings",
        "menu_price": "Signature: Traditional Hokkien Salted Egg Pork Bak Chang | Menu: Traditional Hokkien Meat Dumpling, Nyonya Bak Chang, Vegetarian Dumpling | Price: SGD 3.80–6.50",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 187)): {
        "name": "Guan Heng Claypot Chicken Rice",
        "hours": "Mon–Sat 11:00–21:00; Sun: Closed",
        "cuisine": "Cantonese Claypot Rice",
        "menu_price": "Signature: Charcoal Claypot Chicken Rice with Salted Fish & Lup Cheong | Menu: Claypot Chicken Rice, Sesame Oil Chicken, Salted Vegetable Duck Soup | Price: SGD 5.50–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("050335", (2, 154)): {
        "name": "Hainan Gor Singapore Curry Rice",
        "hours": "Thu–Tue 10:00–16:00; Wed: Closed",
        "cuisine": "Hainanese Curry Rice",
        "menu_price": "Signature: Hainanese Crispy Pork Chop Curry Rice | Menu: Crispy Pork Chop, Braised Pork Belly (Kong Bak), Chap Chye, Fried Egg with Hainanese Curry | Price: SGD 4.00–7.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # GOLDEN MILE FOOD CENTRE (199583)
    # ==========================================
    ("199583", (1, 43)): {
        "name": "Ah Xiao Teochew Braised Duck",
        "hours": "Tue, Wed, Fri–Sun 10:30–14:00; Mon, Thu: Closed",
        "cuisine": "Teochew Braised Duck",
        "menu_price": "Signature: Teochew Braised Duck Rice & Duck Porridge | Menu: Braised Duck Rice, Duck Porridge, Braised Pork Belly, Braised Tau Pok & Egg | Price: SGD 4.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 45)): {
        "name": "Chef Choo Signature",
        "hours": "Tue–Sun 11:30–19:30; Mon: Closed",
        "cuisine": "Western",
        "menu_price": "Signature: Sizzling Seafood Spaghetti & Chicken Chop | Menu: Garlic Prawn Pasta, Pork Chop with Mushroom Sauce, Chicken Chop with Black Pepper Sauce | Price: SGD 6.50–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 34)): {
        "name": "Hainan Fried Hokkien Prawn Mee",
        "hours": "Thu–Tue 10:00–17:00 (Mon 10:00–15:00); Wed: Closed",
        "cuisine": "Hokkien Mee",
        "menu_price": "Signature: Traditional Dry-Style Fried Hokkien Mee | Menu: Fried Hokkien Prawn Mee (Small/Medium/Large) | Price: SGD 5.00–9.00",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 85)): {
        "name": "Flourful Delight",
        "hours": "Tue–Sat 10:30–20:00; Sun, Mon: Closed",
        "cuisine": "Northern Chinese",
        "menu_price": "Signature: Xiao Long Bao & Dan Dan Mian | Menu: Steamed Pork Dumplings (Xiao Long Bao), Dan Dan Noodles, Spicy Wanton in Red Oil, Fried Pork Chop | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 13)): {
        "name": "Haji Kadir Food Chains",
        "hours": "Daily 11:30–23:00",
        "cuisine": "Indian-Muslim",
        "menu_price": "Signature: Sup Tulang Merah (Mutton Bone Marrow Soup) | Menu: Sup Tulang Merah, Mee Goreng, Mutton Chop, Roti John | Price: SGD 6.00–18.00",
        "halal": "Yes",
        "vegan": "No",
        "website": "https://hajikadirfoodchains.sg"
    },
    ("199583", (1, 14)): {
        "name": "Haji Kadir Food Chains",
        "hours": "Daily 11:30–23:00",
        "cuisine": "Indian-Muslim",
        "menu_price": "Signature: Sup Tulang Merah (Mutton Bone Marrow Soup) | Menu: Sup Tulang Merah, Mee Goreng, Mutton Chop, Roti John | Price: SGD 6.00–18.00",
        "halal": "Yes",
        "vegan": "No",
        "website": "https://hajikadirfoodchains.sg"
    },
    ("199583", (1, 53)): {
        "name": "Da Po Hainanese Chicken Rice & Curry Chicken Noodle",
        "hours": "Tue–Sun 10:30–19:30; Mon: Closed",
        "cuisine": "Hainanese Curry Chicken Noodle",
        "menu_price": "Signature: Hainanese Curry Chicken Noodles & Steamed Chicken Rice | Menu: Curry Chicken Noodles, Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 74)): {
        "name": "Choon Kee Roasted Delights",
        "hours": "Thu–Tue 10:30–15:00; Wed: Closed",
        "cuisine": "Cantonese Roast Meats",
        "menu_price": "Signature: Roast Duck, Char Siew & Crispy Sio Bak | Menu: Roasted Duck Rice/Noodles, Char Siew Rice, Roasted Pork Belly, Wanton Soup | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 86)): {
        "name": "86 Lor Mee",
        "hours": "Sun–Fri 08:30–15:30; Sat: Closed",
        "cuisine": "Hokkien Lor Mee",
        "menu_price": "Signature: Signature Lor Mee with Fried Chicken Cutlet & Ebi Prawn | Menu: Fried Fish Lor Mee, Chicken Cutlet Lor Mee, Traditional Lor Mee, Ngoh Hiang | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 35)): {
        "name": "Hainanese Boneless Chicken Rice",
        "hours": "Mon–Sat 11:00–19:30; Sun: Closed",
        "cuisine": "Hainanese Chicken Rice",
        "menu_price": "Signature: Hainanese Steamed Boneless Chicken Rice | Menu: Boneless Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 30)): {
        "name": "Charlie's Peranakan Food",
        "hours": "Daily 11:30–19:30",
        "cuisine": "Peranakan",
        "menu_price": "Signature: Ayam Buah Keluak & Babi Ponteh | Menu: Ayam Buah Keluak, Babi Ponteh, Beef Rendang, Chap Chye, Ikan Assam Pedas | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 106)): {
        "name": "Cat in the Hat",
        "hours": "Wed–Sun 11:00–15:00; Mon, Tue: Closed",
        "cuisine": "French Pastries & Artisanal Bakes",
        "menu_price": "Signature: Brown Butter Financiers & Lemon Tarts | Menu: French Pastries, Financiers, Madeleines, Lemon Meringue Tart, Chocolate Tart | Price: SGD 2.50–5.50",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 73)): {
        "name": "Yew Chuan Claypot Rice",
        "hours": "Tue, Wed, Fri–Sun 12:00–20:00; Mon, Thu: Closed",
        "cuisine": "Cantonese Claypot Rice",
        "menu_price": "Signature: Traditional Charcoal Claypot Chicken Rice | Menu: Claypot Chicken Rice with Salted Fish & Chinese Sausage | Price: SGD 14.00–30.00",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 57)): {
        "name": "YouFu Fried Hokkien Prawn Noodles",
        "hours": "Tue–Sun 10:00–21:00; Mon: Closed",
        "cuisine": "Hokkien Mee",
        "menu_price": "Signature: Crispy Pork Lard Wok-Hei Fried Hokkien Mee | Menu: Fried Hokkien Prawn Mee (Small/Medium/Large with Thick/Thin Bee Hoon) | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    ("199583", (1, 58)): {
        "name": "Zhao An Granny Grass Jelly",
        "hours": "Daily 11:30–19:30",
        "cuisine": "Traditional Desserts",
        "menu_price": "Signature: Traditional Handmade Grass Jelly (Chin Chow) | Menu: Grass Jelly with Longan, Sea Coconut, Nata de Coco, Grass Jelly Drink | Price: SGD 2.00–3.50",
        "halal": "Muslim-friendly",
        "vegan": "Yes"
    },
    ("199583", (1, 59)): {
        "name": "Chung Cheng Chilli Mee",
        "hours": "Wed–Mon 10:00–15:00; Tue: Closed",
        "cuisine": "Sarawak Chilli Mee",
        "menu_price": "Signature: Sarawak-Style Chilli Mee & Prawn Noodles | Menu: Signature Chilli Mee, Prawn Noodle Soup, Pork Ribs Noodle | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # TEKKA CENTRE (210665)
    # ==========================================
    ("210665", (1, 232)): {
        "name": "Allauddin's Briyani Specialist",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Indian-Muslim",
        "menu_price": "Signature: Mutton Briyani & Chicken Briyani with Dalcha & Achar | Menu: Mutton Briyani, Chicken Briyani, Fish Briyani, Hard Boiled Egg, Papadum | Price: SGD 6.00–9.00",
        "halal": "Yes",
        "vegan": "No"
    },
    ("210665", (1, 321)): {
        "name": "Generation Coffee",
        "hours": "Mon–Sat 07:30–15:00; Sun: Closed",
        "cuisine": "Specialty Coffee",
        "menu_price": "Signature: Specialty Kopi & Flat White | Menu: Kopi, Kopi O, Kopi C, Dirty Matcha, Flat White, Latte, Filter Coffee | Price: SGD 2.20–4.50",
        "halal": "Muslim-friendly",
        "vegan": "Vegan-friendly",
        "website": "https://generationcoffee.sg"
    },
    ("210665", (1, 335)): {
        "name": "Heng Gi Goose and Duck Rice",
        "hours": "Mon–Sat 08:00–14:30; Sun: Closed",
        "cuisine": "Teochew Braised Duck",
        "menu_price": "Signature: Teochew Braised Duck Rice & Braised Pork Belly | Menu: Braised Duck Rice, Braised Duck Porridge, Braised Tofu, Tau Pok, Braised Egg | Price: SGD 4.00–7.50",
        "halal": "No",
        "vegan": "No"
    },
    ("210665", (1, 258)): {
        "name": "Prata Saga Sambal Berlauk",
        "hours": "Daily 07:00–13:00",
        "cuisine": "Indian-Muslim",
        "menu_price": "Signature: Crispy Roti Prata with Sambal Tumis & Curry | Menu: Plain Prata, Egg Prata, Coin Prata, Cheese Prata, Teh Tarik | Price: SGD 1.30–4.00",
        "halal": "Yes",
        "vegan": "No"
    },
    ("210665", (1, 254)): {
        "name": "Temasek Indian Rojak",
        "hours": "Thu–Tue 10:30–20:00; Wed: Closed",
        "cuisine": "Indian Rojak",
        "menu_price": "Signature: Fresh Indian Rojak with Homemade Sweet Potato Dip | Menu: Crispy Prawn Fritters, Coconut Fritters, Potato, Egg, Cuttlefish, Tofu | Price: SGD 4.00–12.00",
        "halal": "Yes",
        "vegan": "No"
    },
    ("210665", (1, 284)): {
        "name": "Zhu Jiao Shu Shi",
        "hours": "Daily 07:00–14:30",
        "cuisine": "Traditional Cantonese Breakfast",
        "menu_price": "Signature: Savoury Glutinous Rice & Peanut Porridge | Menu: Savoury Glutinous Rice, Peanut Porridge, Chee Cheong Fun, Yam Cake | Price: SGD 2.00–4.00",
        "halal": "No",
        "vegan": "No"
    },
    ("210665", (1, 311)): {
        "name": "Grandma Mee Siam",
        "hours": "Wed–Mon 08:00–15:00; Tue: Closed",
        "cuisine": "Singaporean Nyonya Mee Siam",
        "menu_price": "Signature: Traditional Gravy Mee Siam & Grandma Mee Rebus | Menu: Nyonya Mee Siam, Mee Rebus, Lontong, Curry Chicken | Price: SGD 3.50–5.50",
        "halal": "Muslim-friendly",
        "vegan": "No"
    },
    ("210665", (1, 256)): {
        "name": "Hanifa's Briyani Specialist",
        "hours": "Tue–Sun 07:00–22:00; Mon: Closed",
        "cuisine": "Indian-Muslim",
        "menu_price": "Signature: Dum Briyani (Mutton & Chicken) | Menu: Mutton Briyani, Chicken Briyani, Fish Briyani, Dalcha, Hard Boiled Egg | Price: SGD 6.50–9.50",
        "halal": "Yes",
        "vegan": "No"
    },
    ("210665", (1, 251)): {
        "name": "Ajimer Sharif Famous Satay Club Mee Goreng",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Indian-Muslim",
        "menu_price": "Signature: Indian Mee Goreng & Sup Kambing | Menu: Mee Goreng, Maggi Goreng, Nasi Goreng Merah, Sup Kambing, Sup Tulang | Price: SGD 4.50–8.50",
        "halal": "Yes",
        "vegan": "No"
    },
    ("210665", (1, 301)): {
        "name": "Handmade Carrot Cake",
        "hours": "Mon–Sat 07:00–14:30; Sun: Closed",
        "cuisine": "Teochew Carrot Cake",
        "menu_price": "Signature: Traditional Handmade White & Black Fried Carrot Cake | Menu: Black Carrot Cake, White Carrot Cake, Crispy Carrot Cake | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # NEWTON FOOD CENTRE (229495)
    # ==========================================
    ("229495", (1, 20)): {
        "name": "Kwang Kee Teochew Fish Porridge",
        "hours": "Tue–Sun 11:00–20:00; Mon: Closed",
        "cuisine": "Teochew Sliced Fish Soup",
        "menu_price": "Signature: Dual Fish Soup (Sliced & Fried Fish) & Teochew Fish Porridge | Menu: Sliced Fish Soup, Fried Fish Soup, Fish Head Soup, Fish Porridge | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No"
    },
    ("229495", (1, 47)): {
        "name": "Tanglin Oyster Omelette",
        "hours": "Daily 12:00–21:00",
        "cuisine": "Teochew Oyster Omelette",
        "menu_price": "Signature: Crispy Fried Oyster Omelette (Orh Luak) | Menu: Fried Oyster Omelette, Oyster Egg, Fried Carrot Cake | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No"
    },
    ("229495", (1, 22)): {
        "name": "22 Best Satay",
        "hours": "Tue–Sun 15:30–23:30; Mon: Closed",
        "cuisine": "Hainanese Satay & BBQ",
        "menu_price": "Signature: Charcoal Grilled Pork, Chicken & Mutton Satay | Menu: Pork Satay, Chicken Satay, Mutton Satay, BBQ Chicken Wings, Ketupat | Price: SGD 0.90–1.00 per stick",
        "halal": "No",
        "vegan": "No"
    },

    # ==========================================
    # TIONG BAHRU MARKET (168898)
    # ==========================================
    ("168898", (2, 29)): {
        "name": "Koh Brother Pig's Organ Soup",
        "hours": "Tue–Sun 09:30–14:30, 17:00–19:30; Mon: Closed",
        "cuisine": "Teochew Pig's Organ Soup",
        "menu_price": "Signature: Pig's Organ Soup & Handmade Glutinous Rice Intestine | Menu: Pig's Organ Soup, Meatball & Liver Soup, Glutinous Rice Stuffed Intestine | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 68)): {
        "name": "Loo's Hainanese Curry Rice",
        "hours": "Fri–Wed 08:30–14:45; Thu: Closed",
        "cuisine": "Hainanese Curry Rice",
        "menu_price": "Signature: Hainanese Crispy Pork Chop Curry Rice & Braised Pork Belly | Menu: Pork Chop, Sambal Sotong, Braised Cabbage (Chap Chye), Egg, Curry Rice | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 16)): {
        "name": "Hock Hai Curry Chicken Noodle",
        "hours": "Daily 08:30–14:30",
        "cuisine": "Hainanese Curry Chicken Noodle",
        "menu_price": "Signature: Rich Curry Chicken Noodles with Tau Pok & Potato | Menu: Curry Chicken Noodles (Yellow Mee / Bee Hoon), Fish Cake, Tau Pok | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 19)): {
        "name": "Tiong Bahru Pau",
        "hours": "Mon–Sat 05:00–19:00, Sun 05:00–15:00",
        "cuisine": "Cantonese Dim Sum & Pau",
        "menu_price": "Signature: Handmade Big Pau & Char Siew Pau | Menu: Da Pau, Char Siew Pau, Siew Mai, Glutinous Rice Chicken (Lo Mai Gai) | Price: SGD 1.20–2.60",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 6)): {
        "name": "Tow Kwar Pop",
        "hours": "Tue–Sun 09:30–15:00; Mon: Closed",
        "cuisine": "Traditional Singaporean Rojak",
        "menu_price": "Signature: Charcoal-Grilled Stuffed Beancurd Puffs (Tow Kwar Pop) | Menu: Hand-stuffed Tow Kwar Pop (with Cucumber, Bean Sprouts, Fish Cake, Crispy Dough Fritters & Prawn Paste Sauce) | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 2)): {
        "name": "Tiong Bahru Teochew Kueh",
        "hours": "Tue–Sun 07:30–14:00; Mon: Closed",
        "cuisine": "Teochew Traditional Kueh",
        "menu_price": "Signature: Handmade Png Kueh & Soon Kueh | Menu: Png Kueh (Pink/White Rice Cake), Soon Kueh, Ku Cai Kueh (Chive Kueh), Black Bean Kueh | Price: SGD 1.30–2.00",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 74)): {
        "name": "Hwa Yuen Porridge",
        "hours": "Tue–Sun 07:00–15:00; Mon: Closed",
        "cuisine": "Cantonese Porridge",
        "menu_price": "Signature: Traditional Cantonese Congee with Century Egg & Pork Innards | Menu: Mixed Pork Porridge, Fish Porridge, Century Egg & Lean Meat Congee, You Tiao | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 1)): {
        "name": "Hong Heng Fried Sotong Prawn Mee",
        "hours": "Tue–Sat 11:00–15:00, 16:30–19:30; Sun, Mon: Closed",
        "cuisine": "Hokkien Mee",
        "menu_price": "Signature: Wok-Hei Fried Sotong Prawn Mee | Menu: Fried Hokkien Prawn Mee (Small/Medium/Large with Fresh Prawns & Squid) | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 66)): {
        "name": "Skirt & Dirt",
        "hours": "Tue–Sun 11:30–20:00; Mon: Closed",
        "cuisine": "Gourmet Burgers",
        "menu_price": "Signature: Cheese Skirt Beef Burger & Truffle Mushroom Burger | Menu: Cheese Skirt Burger, Big Skirt Double Beef, Dirt Fries, Cajun Chicken Burger | Price: SGD 6.80–12.50",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 32)): {
        "name": "Grandpa Homemade Cheung Fun",
        "hours": "Daily 07:00–14:00",
        "cuisine": "Cantonese Dim Sum",
        "menu_price": "Signature: Stone-Milled Steamed Rice Rolls (Cheung Fun) | Menu: Prawn Cheung Fun, Char Siew Rice Roll, Mushroom & Minced Meat Cheung Fun, Century Egg Porridge | Price: SGD 3.00–5.50",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 80)): {
        "name": "Tiong Bahru Lor Mee",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Hokkien Lor Mee",
        "menu_price": "Signature: Traditional Lor Mee with Deep Fried Fish Nuggets & Braised Pork | Menu: Traditional Lor Mee, Fried Fish Lor Mee, Braised Egg, Crispy Fritters | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No"
    },
    ("168898", (2, 71)): {
        "name": "Granny's Pancake",
        "hours": "Tue, Wed, Fri–Sun 06:30–13:00; Mon, Thu: Closed",
        "cuisine": "Traditional Min Jiang Kueh",
        "menu_price": "Signature: Traditional Min Jiang Kueh (Peanut / Red Bean / Coconut) | Menu: Peanut Pancake, Red Bean Pancake, Coconut Pancake, Peanut Butter Pancake | Price: SGD 1.20–1.60",
        "halal": "Muslim-friendly",
        "vegan": "Vegan-friendly"
    },
    ("168898", (2, 22)): {
        "name": "Zhong Zhong Fine Food",
        "hours": "Tue–Sun 09:30–20:30; Mon: Closed",
        "cuisine": "Ngoh Hiang Prawn Crackers",
        "menu_price": "Signature: Traditional Five-Spice Ngoh Hiang Roll & Crispy Prawn Crackers | Menu: Ngoh Hiang, Crispy Prawn Cracker, Fried Tofu, Century Egg, Water Chestnut Cake | Price: SGD 4.50–10.00",
        "halal": "No",
        "vegan": "No"
    }
}
