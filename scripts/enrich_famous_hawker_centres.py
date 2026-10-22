#!/usr/bin/env python3
"""
Enrich famous Singapore hawker stalls in Hungry_Database_Food_Only_2026-10-21.csv and .xlsx
with authentic verified opening hours, cuisines, signatures, menus, prices, contact details, and dietary tags.
"""

import csv
import re
import os
import openpyxl

def extract_stall_num(text):
    m = re.search(r"#?B?0?([1-3])-0?(\d+)", text)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    m2 = re.search(r"KADAYANALLUR STREET 0?(\d+)", text)
    if m2:
        return (1, int(m2.group(1)))
    m3 = re.search(r"#0?(\d+)", text)
    if m3:
        return (1, int(m3.group(1)))
    return None

# Registry of verified stalls
# Key: (Postal_Code, (Floor, Stall_Number))
# Value dict: name, hours, cuisine, menu_price, halal, vegan, contact, website
HAWKER_REGISTRY = {
    # ==========================================
    # 1. MAXWELL FOOD CENTRE (069184)
    # ==========================================
    ("069184", (1, 10)): {
        "name": "Tian Tian Hainanese Chicken Rice",
        "hours": "Tue–Sun 10:00–19:30; Mon: Closed",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Hainanese Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Oyster Sauce Vegetables | Price: SGD 4.00–8.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6225 5506",
        "website": "https://www.facebook.com/TianTianChickenRice/"
    },
    ("069184", (1, 7)): {
        "name": "Ah Tai Hainanese Chicken Rice",
        "hours": "Wed–Mon 11:00–19:30; Tue: Closed",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Hainanese Chicken Rice | Menu: Chicken Rice, Chicken Liver, Braised Egg, Bean Sprouts | Price: SGD 3.80–7.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 8690 9226",
    },
    ("069184", (1, 5)): {
        "name": "Maxwell Fuzhou Oyster Cake",
        "hours": "Mon–Sat 09:00–20:00; Sun: Closed",
        "cuisine": "Fuzhou",
        "menu_price": "Signature: Traditional Fuzhou Oyster Cake | Menu: Traditional Oyster Cake, Prawn & Meat Cake | Price: SGD 2.50–3.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9386 0583",
    },
    ("069184", (1, 54)): {
        "name": "Zhen Zhen Porridge",
        "hours": "Wed–Mon 05:30–14:30; Tue: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Century Egg & Chicken Porridge | Menu: Century Egg & Shredded Chicken Porridge, Fish Porridge, Sliced Pork Congee, Century Egg & Pork Porridge | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No",
    },
    ("069184", (1, 77)): {
        "name": "Jin Hua Fish Head Bee Hoon",
        "hours": "Thu–Tue 11:00–20:30; Wed: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Fried Fish Meat Bee Hoon Soup | Menu: Sliced Fish Soup, Fried Fish Meat Bee Hoon, Fried Fish Head Soup, Fish Roe Soup | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("069184", (1, 57)): {
        "name": "75 China Street Peanut Soup",
        "hours": "Thu–Tue 08:00–16:00; Wed: Closed",
        "cuisine": "Chinese Desserts",
        "menu_price": "Signature: Traditional Peanut Soup with Ah Balling | Menu: Peanut Soup, Red Bean Soup, Tau Suan, Glutinous Rice Balls (Peanut/Sesame) | Price: SGD 1.60–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("069184", (1, 92)): {
        "name": "Tong Xin Ju Special Shanghai Dim Sum",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Shanghainese",
        "menu_price": "Signature: Shanghai Fried Guo Tie | Menu: Steamed Pork Dumplings, Fried Dumplings (Guo Tie), Shanghai Hot & Sour Soup, Beijing Noodles | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9662 3501",
    },
    ("069184", (1, 14)): {
        "name": "Danlao 蛋佬",
        "hours": "Daily 11:00–17:00",
        "cuisine": "Hong Kong",
        "menu_price": "Signature: Scrambled Egg Rice Bowl | Menu: Char Siew Scrambled Egg Rice, Luncheon Meat Egg Rice, Prawn Scrambled Egg Rice, Tomato Egg Rice | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("069184", (1, 60)): {
        "name": "Fu Shun Jin Ji Shao La Mian Jia",
        "hours": "Thu–Tue 11:00–20:00; Wed: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Roasted Pork & Char Siew Rice | Menu: Roast Duck Noodle, Char Siew Roast Pork Rice, Soy Sauce Chicken Noodle | Price: SGD 4.00–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("069184", (1, 94)): {
        "name": "Ye Lai Xiang Tasty Barbecue",
        "hours": "Mon–Fri 12:00–14:30, 18:00–20:30; Sat–Sun: Closed",
        "cuisine": "Hainanese Western",
        "menu_price": "Signature: Hainanese Chicken Chop | Menu: Pork Chop, Chicken Chop with Special Brown Gravy, Sirloin Steak, Fish & Chips | Price: SGD 7.50–14.00",
        "halal": "No",
        "vegan": "No",
    },
    ("069184", (1, 73)): {
        "name": "Aftertaste Traditional Tutu Cake",
        "hours": "Daily 10:30–19:30",
        "cuisine": "Singaporean Desserts",
        "menu_price": "Signature: Steamed Traditional Tutu Cake | Menu: Coconut Tutu Cake, Peanut Tutu Cake, Chocolate Tutu Cake | Price: SGD 3.50–5.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("069184", (1, 64)): {
        "name": "Rojak, Popiah & Cockle",
        "hours": "Daily 11:30–20:30",
        "cuisine": "Singaporean",
        "menu_price": "Signature: Traditional Chinese Rojak | Menu: Fruit Rojak with You Tiao, Popiah, Boiled Cockles | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 2. OLD AIRPORT ROAD FOOD CENTRE (390051)
    # ==========================================
    ("390051", (1, 4)): {
        "name": "Cho Kee Noodle",
        "hours": "Daily 10:00–20:00",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Handmade Wanton Noodles | Menu: Wanton Mee (Dry/Soup), Fried Wanton, Dumpling Soup, Beetroot / Spinach Wanton Noodle | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 12)): {
        "name": "Lao Fu Zi Fried Kway Teow",
        "hours": "Sun–Fri 11:45–22:00; Sat: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Black Fried Kway Teow | Menu: Black Char Kway Teow, White Char Kway Teow (With Cockles, Lup Cheong & Bean Sprouts) | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 18)): {
        "name": "Mama Recipe Briyani Rice",
        "hours": "Daily 10:30–20:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Dum Briyani | Menu: Mutton Briyani, Chicken Dum Briyani, Fish Briyani, Dalcha Curry | Price: SGD 6.50–10.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("390051", (1, 32)): {
        "name": "Nam Sing Hokkien Fried Mee",
        "hours": "Daily 07:00–15:00",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Traditional Hokkien Fried Mee | Menu: Hokkien Mee with Prawn & Squid (Thin Bee Hoon & Yellow Noodles) | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 51)): {
        "name": "To-Wan Beancurd (Zuowan Douhua)",
        "hours": "Daily 06:00–23:00",
        "cuisine": "Local Desserts",
        "menu_price": "Signature: Traditional Silky Beancurd | Menu: Hot/Cold Tau Huay, Grass Jelly, Soya Bean Milk, Almond Beancurd | Price: SGD 1.50–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("390051", (1, 53)): {
        "name": "Western Barbeque",
        "hours": "Wed–Sun 11:00–22:00; Mon–Tue: Closed",
        "cuisine": "Hainanese Western",
        "menu_price": "Signature: Pork Chop with Signature Garlic Sauce | Menu: Chicken Chop, Pork Chop, Mixed Grill, Fish & Chips | Price: SGD 7.50–15.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 64)): {
        "name": "Qiu Rong Ban Mian",
        "hours": "Mon–Sat 11:30–16:00; Sun: Closed",
        "cuisine": "Chinese",
        "menu_price": "Signature: Handmade Ban Mian Soup | Menu: Minced Meat Ban Mian, Sliced Fish Mee Hoon Kway, Tom Yum Ban Mian, You Mian | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 81)): {
        "name": "Xiang Ji Lor Mee",
        "hours": "Thu–Tue 06:00–14:00; Wed: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Traditional Lor Mee | Menu: Traditional Braised Lor Mee, Fried Fish Lor Mee, Braised Pork Belly Noodles | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 85)): {
        "name": "Chuan Kee Satay",
        "hours": "Daily 17:00–22:30",
        "cuisine": "Singaporean",
        "menu_price": "Signature: Hainanese Pork Satay with Pineapple Puree Dip | Menu: Pork Satay, Chicken Satay, Mutton Satay, Ketupat | Price: SGD 0.90/stick",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 98)): {
        "name": "Whitley Road Big Prawn Noodle",
        "hours": "Tue–Sun 09:30–21:00; Mon: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Big Prawn Noodle (Dry/Soup) | Menu: Big Prawn Pork Rib Noodle, Prawn Noodle Soup, Pork Tail Prawn Noodle | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 107)): {
        "name": "Lao Ban Soya Beancurd",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Local Desserts",
        "menu_price": "Signature: Chilled Soya Beancurd | Menu: Original Chilled Soya Beancurd, Almond Soya Beancurd, Fresh Soya Milk | Price: SGD 2.00–2.80",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("390051", (1, 108)): {
        "name": "Toa Payoh Rojak",
        "hours": "Wed–Sun 11:00–20:00; Mon–Tue: Closed",
        "cuisine": "Singaporean",
        "menu_price": "Signature: Traditional Chinese Fruit & Dough Rojak | Menu: Classic Chinese Rojak with Crushed Peanuts & Toasted You Tiao | Price: SGD 4.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 116)): {
        "name": "Xin Mei Xiang Zheng Zong Lor Mee",
        "hours": "Thu–Tue 06:00–14:45; Wed: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Traditional Braised Lor Mee with Flaked Fish | Menu: Signature Lor Mee, Fried Fish Lor Mee, Braised Egg & Pork Belly | Price: SGD 5.00–9.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 122)): {
        "name": "Roast Paradise",
        "hours": "Tue–Sun 10:00–18:00; Mon: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Caramelized KL-Style Char Siew | Menu: Char Siew Rice, Roasted Pork Belly, Hakka Noodles with Char Siew | Price: SGD 5.00–9.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 135)): {
        "name": "To-Ricos Kway Chap (Blanco Court)",
        "hours": "Wed–Sun 11:00–20:00; Mon–Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Herbal Kway Chap Platter | Menu: Kway Chap Platter (Braised Pork Belly, Intestines, Tau Pok, Egg), Silky Rice Sheets | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 138)): {
        "name": "Dong Ji Fried Kway Teow",
        "hours": "Thu–Tue 08:00–14:00; Wed: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Individually Wok-Fried Char Kway Teow | Menu: Traditional Fried Kway Teow with Cockles, Egg & Prawns | Price: SGD 4.50–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 155)): {
        "name": "Freshly Made Chee Cheong Fun",
        "hours": "Thu–Tue 07:00–15:00; Wed: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Hand-Rolled Chee Cheong Fun | Menu: Prawn Chee Cheong Fun, Char Siew Chee Cheong Fun, Mushroom Chee Cheong Fun, Century Egg Porridge | Price: SGD 3.00–5.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 3. AMOY STREET FOOD CENTRE (069111)
    # ==========================================
    ("069111", (1, 1)): {
        "name": "Amoy Street Fried Kway Teow",
        "hours": "Mon–Fri 09:30–14:30; Sat–Sun: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Char Kway Teow | Menu: Fried Kway Teow with Cockles and Lap Cheong | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("069111", (1, 2)): {
        "name": "Xiang Xiang Hainanese Chicken Rice",
        "hours": "Mon–Fri 10:30–14:30; Sat–Sun: Closed",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Hainanese Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("069111", (1, 39)): {
        "name": "A Noodle Story",
        "hours": "Mon–Fri 11:15–14:30, 17:30–19:30; Sat 10:30–13:30; Sun: Closed",
        "cuisine": "Singapore Modern Fusion",
        "menu_price": "Signature: Singapore Style Ramen | Menu: Singapore Style Ramen with Sous-Vide Cha Shu, Potato Prawn & Onsen Egg | Price: SGD 9.80–13.80",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9027 6289",
    },
    ("069111", (1, 32)): {
        "name": "J2 Famous Crispy Curry Puff",
        "hours": "Mon–Sat 08:00–15:00; Sun: Closed",
        "cuisine": "Singaporean Snacks",
        "menu_price": "Signature: Crispy Flaky Curry Chicken Puff | Menu: Crispy Curry Chicken Puff, Crispy Sardine Puff, Black Pepper Chicken Puff, Yam Paste Puff | Price: SGD 1.60–2.20",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9475 8428",
    },
    ("069111", (2, 129)): {
        "name": "Han Kee Fish Soup",
        "hours": "Mon–Fri 11:00–14:30; Sat–Sun: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Sliced Fish Soup | Menu: Sliced Fish Soup, Sliced Fish Bee Hoon, Fish Head Soup, Fish Porridge | Price: SGD 6.00–11.00",
        "halal": "No",
        "vegan": "No",
    },
    ("069111", (2, 100)): {
        "name": "Piao Ji Fish Porridge",
        "hours": "Fri–Wed 10:30–15:00; Thu: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Pomfret Fish Soup with Prawns | Menu: Sliced Pomfret Soup, Red Grouper Soup, Fish Porridge with Fresh Chili Dip | Price: SGD 8.00–15.00",
        "halal": "No",
        "vegan": "No",
    },
    ("069111", (2, 95)): {
        "name": "Ah Seng (Hai Nam) Coffee",
        "hours": "Mon–Sat 05:30–16:00; Sun: Closed",
        "cuisine": "Traditional Hainanese Coffee & Toast",
        "menu_price": "Signature: Charcoal Grilled French Toast with Kaya | Menu: Traditional Kopi, Teh, Charcoal Grilled Kaya Butter Toast, French Toast, Half-Boiled Eggs | Price: SGD 1.40–3.50",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 9710 2907",
    },
    ("069111", (2, 78)): {
        "name": "Coffee Break",
        "hours": "Mon–Fri 07:30–14:30; Sat–Sun: Closed",
        "cuisine": "Artisanal Coffee & Toast",
        "menu_price": "Signature: Sea Salt Mint Kopi & Black Sesame Toast | Menu: Infused Kopi / Teh (Sea Salt Mint, Earl Grey, Macadamia), Matcha / Black Sesame Toast | Price: SGD 2.00–4.20",
        "halal": "No",
        "vegan": "No",
    },
    ("069111", (2, 90)): {
        "name": "Big Bowls Project",
        "hours": "Mon–Fri 11:30–14:00; Sat–Sun: Closed",
        "cuisine": "Healthy Japanese Rice Bowls",
        "menu_price": "Signature: Mentaiko Salmon Rice Bowl | Menu: Mentaiko Salmon Bowl, Truffle Oil Salmon Bowl, Sichuan Black Bean Salmon Bowl | Price: SGD 9.50–12.50",
        "halal": "Yes",
        "vegan": "No",
    },
    ("069111", (2, 107)): {
        "name": "Mad Roaster",
        "hours": "Mon–Fri 08:00–15:00; Sat–Sun: Closed",
        "cuisine": "Specialty Coffee & Brioche",
        "menu_price": "Signature: Cold Brew Coffee & Babka | Menu: Espresso, Flat White, Honey Butter Cold Brew, Chocolate Babka | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 4. CHINATOWN COMPLEX (050335)
    # ==========================================
    ("050335", (2, 126)): {
        "name": "Liao Fan Hawker Chan (Original)",
        "hours": "Mon–Sat 10:30–15:30; Sun: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Soya Sauce Chicken Rice | Menu: Soya Sauce Chicken Noodle, Char Siew Rice, Roasted Pork Belly, Soya Sauce Chicken (Whole/Half) | Price: SGD 3.50–16.00",
        "halal": "No",
        "vegan": "No",
    },
    ("050335", (2, 135)): {
        "name": "Zhong Guo La Mian Xiao Long Bao",
        "hours": "Daily 11:00–20:30",
        "cuisine": "Northern Chinese / Shanghainese",
        "menu_price": "Signature: Handmade Xiao Long Bao | Menu: Steamed Mini Juicy Buns (Xiao Long Bao), Szechuan Spicy Wanton, Beef La Mian, Dan Dan Mian | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("050335", (2, 198)): {
        "name": "Lian He Ben Ji Claypot Rice",
        "hours": "Fri–Wed 16:30–22:30; Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Mixed Charcoal Claypot Rice | Menu: Claypot Chicken Rice, Claypot Sausage & Salted Fish Rice, Mixed Claypot Rice | Price: SGD 9.00–28.00",
        "halal": "No",
        "vegan": "No",
        "contact": "+65 6227 2470",
    },
    ("050335", (2, 205)): {
        "name": "Shang Hai Fried Xiao Long Bao",
        "hours": "Thu–Tue 10:30–15:30, 17:30–20:30; Wed: Closed",
        "cuisine": "Shanghainese",
        "menu_price": "Signature: Sheng Jian Bao (Pan Fried Buns) | Menu: Pan-Fried Pork Buns, Steamed Dumplings, Crab Roe Sheng Jian Bao | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No",
    },
    ("050335", (2, 96)): {
        "name": "Fatty Ox HK Kitchen",
        "hours": "Wed–Sun 06:30–14:30; Mon–Tue: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Beef Brisket & Tendon Noodles | Menu: Braised Beef Brisket Noodle, Soy Sauce Chicken, Soya Sauce Hor Fun | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("050335", (2, 84)): {
        "name": "Old Amoy Chendol",
        "hours": "Wed–Sun 07:30–14:30; Mon–Tue: Closed",
        "cuisine": "Traditional Desserts",
        "menu_price": "Signature: Charcoal Cold-Pressed Chendol | Menu: Traditional Chendol with Gula Melaka, Kidney Beans & Fresh Coconut Milk | Price: SGD 2.50–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("050335", (2, 56)): {
        "name": "Woo Ji Cooked Food",
        "hours": "Wed–Sat 06:00–09:30; Sun–Tue: Closed",
        "cuisine": "Cantonese Breakfast",
        "menu_price": "Signature: Traditional Morning Yam Cake & Chee Cheong Fun | Menu: Yam Cake, Rice Noodle Rolls, Economical Fried Noodles | Price: SGD 2.00–3.50",
        "halal": "No",
        "vegan": "No",
    },
    ("050335", (2, 166)): {
        "name": "Jia Ji Mei Shi",
        "hours": "Daily 06:00–22:00",
        "cuisine": "Local Heritage Snacks",
        "menu_price": "Signature: Chee Cheong Fun & Yam Cake | Menu: Traditional Yam Cake, Glutinous Rice, Economical Bee Hoon, Porridge | Price: SGD 2.50–4.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 5. TIONG BAHRU MARKET (168898)
    # ==========================================
    ("168898", (2, 5)): {
        "name": "Jian Bo Shui Kueh (Tiong Bahru)",
        "hours": "Daily 06:30–15:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Traditional Chwee Kueh | Menu: Chwee Kueh (Steamed Rice Cakes with Chye Poh & Chili), Chee Cheong Fun, Yam Cake | Price: SGD 3.20–5.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("168898", (2, 11)): {
        "name": "Tiong Bahru Fried Kway Teow",
        "hours": "Sat–Mon 11:00–20:00; Tue–Fri: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Charcoal Fried Kway Teow | Menu: Fried Kway Teow with Cockles, Sausage and Crispy Pork Lard | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("168898", (2, 17)): {
        "name": "Ali Corner",
        "hours": "Mon–Sat 07:00–14:00; Sun: Closed",
        "cuisine": "Malay",
        "menu_price": "Signature: Nasi Lemak & Lontong | Menu: Nasi Lemak with Fried Chicken Wing, Lontong Sayur Lodeh, Mee Rebus, Mee Soto | Price: SGD 3.50–5.50",
        "halal": "Yes",
        "vegan": "No",
    },
    ("168898", (2, 18)): {
        "name": "Tiong Bahru Pau",
        "hours": "Wed–Sun 06:00–14:00; Mon–Tue: Closed",
        "cuisine": "Cantonese Dim Sum",
        "menu_price": "Signature: Traditional Steamed Big Pork Pau | Menu: Da Pau, Char Siew Pau, Siew Mai, Glutinous Rice with Chicken | Price: SGD 1.20–3.00",
        "halal": "No",
        "vegan": "No",
    },
    ("168898", (2, 25)): {
        "name": "HarriAnns Nonya Table (Tiong Bahru)",
        "hours": "Daily 06:00–14:00",
        "cuisine": "Peranakan Snacks",
        "menu_price": "Signature: Handmade Nonya Kueh | Menu: Rainbow Lapis, Ondeh Ondeh, Kueh Salat, Glutinous Rice with Dried Shrimp | Price: SGD 1.30–3.50",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("168898", (2, 30)): {
        "name": "Zhong Yu Yuan Wei Wanton Noodle",
        "hours": "Wed–Sun 07:00–14:00; Mon–Tue: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Bu Jian Tian (Armpit) Char Siew Wanton Mee | Menu: Premium Char Siew Noodle, Braised Pork Rib Noodle, Wanton Soup | Price: SGD 5.50–12.00",
        "halal": "No",
        "vegan": "No",
    },
    ("168898", (2, 31)): {
        "name": "Min Nan Pork Ribs Prawn Noodle",
        "hours": "Daily 07:30–14:00",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Pork Ribs Prawn Noodles (Soup/Dry) | Menu: Prawn Noodle Soup, Pork Rib Prawn Mee, Pork Tail Noodle | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("168898", (2, 49)): {
        "name": "Qing Yuan Fish Soup",
        "hours": "Tue–Sun 09:30–19:30; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Clear Sliced Fish Soup | Menu: Sliced Batang Fish Soup, Fish Head Soup, Seafood Bee Hoon | Price: SGD 5.50–9.00",
        "halal": "No",
        "vegan": "No",
    },
    ("168898", (2, 60)): {
        "name": "Tiong Bahru Lee Hong Kee Cantonese Roasted",
        "hours": "Fri–Wed 09:00–20:00; Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Roasted Duck & Char Siew Rice | Menu: Roast Duck, Char Siew, Roasted Pork Belly, Dumpling Soup | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("168898", (2, 67)): {
        "name": "Loo's Hainanese Curry Rice",
        "hours": "Fri–Wed 08:00–14:45; Thu: Closed",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Crispy Hainanese Pork Chop Curry Rice | Menu: Pork Chop Curry Rice, Braised Pork Belly, Chap Chye, Curry Squid | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("168898", (2, 69)): {
        "name": "Teck Seng Soya Bean Milk",
        "hours": "Daily 07:00–14:00",
        "cuisine": "Local Desserts",
        "menu_price": "Signature: Fresh Warm Soya Bean Milk & Beancurd | Menu: Soya Bean Milk, Silky Beancurd, Grass Jelly Drink | Price: SGD 1.20–2.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("168898", (2, 82)): {
        "name": "Tiong Bahru Hainanese Boneless Chicken Rice",
        "hours": "Tue–Sun 10:00–16:00; Mon: Closed",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Boneless Hainanese Chicken Rice | Menu: Steamed Boneless Chicken Rice, Roasted Chicken Rice, Chicken Gizzard | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 6. HONG LIM COMPLEX (051531)
    # ==========================================
    ("051531", (2, 48)): {
        "name": "Ji Ji Wanton Noodle Specialist",
        "hours": "Fri–Wed 09:30–15:00, 17:00–19:00; Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Ji Ji Signature Charcoal Char Siew Wanton Mee | Menu: Wanton Noodle, Dumpling Noodle, Shredded Chicken & Mushroom Noodle, Fried Wanton | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("051531", (2, 16)): {
        "name": "High Street Tai Wah Pork Noodle",
        "hours": "Tue, Thu, Sun 09:30–19:30; Mon, Wed: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Traditional Bak Chor Mee | Menu: Minced Pork Noodle (Dry/Soup), Meatball Soup, Sole Fish Dumpling Soup | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No",
    },
    ("051531", (2, 58)): {
        "name": "Ah Heng Curry Chicken Bee Hoon Mee",
        "hours": "Daily 08:45–20:00",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Hainanese Curry Chicken Noodle | Menu: Curry Chicken Bee Hoon Mee with Tau Pok, Fish Cake & Tender Chicken Chunks | Price: SGD 5.50–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("051531", (2, 30)): {
        "name": "Hong Xing Handmade Fishball & Meatball Noodle",
        "hours": "Tue–Sat 07:30–14:00; Sun–Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Handmade Fishball & Meatball Noodle | Menu: Fishball Mee Pok, Meatball Soup, Her Giao (Fish Dumpling) | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("051531", (2, 13)): {
        "name": "Eddy's",
        "hours": "Mon–Fri 10:30–14:00; Sat–Sun: Closed",
        "cuisine": "Western Fusion",
        "menu_price": "Signature: Duck Confit with Mashed Potatoes | Menu: Duck Confit, Mala Pork Spaghetti, Salmon Fillet | Price: SGD 10.00–15.00",
        "halal": "No",
        "vegan": "No",
    },
    ("051531", (2, 9)): {
        "name": "Nanyang Fried Chicken Rice",
        "hours": "Mon–Fri 11:00–19:00; Sat 11:00–17:00; Sun: Closed",
        "cuisine": "Singaporean",
        "menu_price": "Signature: Crispy Fried Chicken Cutlet Rice | Menu: Fried Chicken Rice with Sambal, Curry Chicken Cutlet Rice | Price: SGD 5.50–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("051531", (2, 37)): {
        "name": "Hiong Kee Dumplings",
        "hours": "Mon–Sat 08:00–19:00; Sun: Closed",
        "cuisine": "Chinese Heritage",
        "menu_price": "Signature: Traditional Bak Chang (Rice Dumplings) | Menu: Salted Egg Pork Dumpling, Nonya Dumpling, Kee Chang | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 7. GOLDEN MILE FOOD CENTRE (199583)
    # ==========================================
    ("199583", (1, 59)): {
        "name": "Chung Cheng Chilli Prawn Noodles",
        "hours": "Thu–Tue 07:00–14:00; Wed: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Signature Belachan Chilli Prawn Noodles | Menu: Dry Prawn Mee, Prawn Rib Noodle, Prawn Soup | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("199583", (1, 63)): {
        "name": "Keng Heng (Whampoa) Teochew Lor Mee",
        "hours": "Thu–Tue 07:30–13:30; Wed: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Teochew Lor Mee with Deep Fried Fish Nugget | Menu: Traditional Lor Mee, Braised Pork Lor Mee | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("199583", (1, 65)): {
        "name": "Wen Li Taiwanese Food",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Taiwanese",
        "menu_price": "Signature: Taiwanese Lu Rou Fan (Braised Pork Rice) | Menu: Lu Rou Fan, Taiwanese Oyster Mee Sua, Fried Chicken Cutlet | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("199583", (1, 73)): {
        "name": "Yew Chuan Claypot Rice",
        "hours": "Tue–Wed, Fri–Sun 12:00–20:30; Mon, Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Charcoal Claypot Chicken Rice | Menu: Claypot Chicken Rice with Salted Fish & Chinese Sausage | Price: SGD 10.00–25.00",
        "halal": "No",
        "vegan": "No",
    },
    ("199583", (1, 75)): {
        "name": "75 Ah Balling Peanut Soup (Golden Mile)",
        "hours": "Daily 11:00–20:30",
        "cuisine": "Chinese Desserts",
        "menu_price": "Signature: Glutinous Rice Balls in Peanut Soup | Menu: Ah Balling in Peanut / Almond / Ginger Soup (Peanut, Sesame, Red Bean, Matcha) | Price: SGD 2.50–3.80",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("199583", (1, 89)): {
        "name": "Kheng Fatt Hainanese Beef Noodles",
        "hours": "Thu–Tue 11:30–19:30; Wed: Closed",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Traditional Hainanese Beef Noodle | Menu: Sliced Beef Kway Teow (Dry/Soup), Beef Ball Soup, Tendon Noodle | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("199583", (1, 91)): {
        "name": "91 Fried Kway Teow Mee",
        "hours": "Tue–Sun 11:00–14:00; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Healthier Wok-Hei Fried Kway Teow | Menu: Fried Kway Teow Topped with Chye Sim Greens & Cockles | Price: SGD 4.50–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("199583", (1, 104)): {
        "name": "Braise Lu Zhi Jia",
        "hours": "Thu–Tue 11:30–18:30; Wed: Closed",
        "cuisine": "Taiwanese",
        "menu_price": "Signature: Braised Pork Belly Rice | Menu: Lu Rou Fan, Braised Pork Rib Rice, Lava Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 8. NEWTON FOOD CENTRE (229495)
    # ==========================================
    ("229495", (1, 10)): {
        "name": "XO Minced Meat Noodles",
        "hours": "Daily 24 Hours",
        "cuisine": "Teochew",
        "menu_price": "Signature: 24-Hour Bak Chor Mee | Menu: Minced Meat Noodles (Dry/Soup), XO Sauce Fishball Noodle, Meatball Soup | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("229495", (1, 27)): {
        "name": "Alliance Seafood",
        "hours": "Thu–Tue 11:30–23:30; Wed: Closed",
        "cuisine": "Seafood / BBQ",
        "menu_price": "Signature: Singapore Chilli Crab & Sambal Stingray | Menu: Chilli Crab, Black Pepper Crab, BBQ Sambal Stingray, Cereal Prawns | Price: SGD 15.00–65.00",
        "halal": "No",
        "vegan": "No",
    },
    ("229495", (1, 28)): {
        "name": "Heng Carrot Cake & Oyster Omelette",
        "hours": "Wed–Mon 17:00–23:00; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Steamed White Carrot Cake | Menu: Homemade White Carrot Cake, Black Sweet Carrot Cake, Crispy Fried Oyster Omelette | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No",
    },
    ("229495", (1, 73)): {
        "name": "Hup Kee Fried Oyster Omelette",
        "hours": "Wed–Sat 17:30–00:00; Sun–Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Crispy Starchy Fried Oyster Omelette | Menu: Classic Orh Luak with Plump Oysters & Tangy Chilli Sauce | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No",
    },
    ("229495", (1, 13)): {
        "name": "Kwee Heng Duck Noodle",
        "hours": "Thu–Tue 09:00–21:00; Wed: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Braised Duck Rice & Noodles | Menu: Boneless Braised Duck Noodle, Braised Duck Rice, Herbal Duck Soup | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("229495", (1, 33)): {
        "name": "TKR Satay",
        "hours": "Wed–Mon 16:00–00:30; Tue: Closed",
        "cuisine": "Singaporean",
        "menu_price": "Signature: Charcoal Grilled Satay & Chicken Wings | Menu: Chicken Satay, Pork Satay, Mutton Satay, BBQ Chicken Wings | Price: SGD 0.90/stick",
        "halal": "No",
        "vegan": "No",
    },
    ("229495", (1, 69)): {
        "name": "Soon Wah Fishball Kway Teow Mee",
        "hours": "Thu–Tue 17:50–00:00; Wed: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Handmade Fish Dumpling (Her Giao) Noodle | Menu: Fishball Kway Teow Noodle, Handmade Her Giao Soup | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("229495", (1, 83)): {
        "name": "Hajah Monah Kitchen",
        "hours": "Daily 06:00–15:00",
        "cuisine": "Malay / Nasi Padang",
        "menu_price": "Signature: Nasi Padang with Beef Rendang | Menu: Beef Rendang, Sambal Goreng, Ayam Masak Merah, Sayur Lodeh | Price: SGD 5.00–9.00",
        "halal": "Yes",
        "vegan": "No",
    },

    # ==========================================
    # 9. TEKKA CENTRE (210665)
    # ==========================================
    ("210665", (1, 229)): {
        "name": "Allauddin's Briyani",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Traditional Mutton Briyani | Menu: Mutton Briyani, Chicken Briyani, Fish Briyani, Dalcha, Achar | Price: SGD 6.50–10.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("210665", (1, 266)): {
        "name": "Delhi Lahori",
        "hours": "Wed–Mon 11:00–23:00; Tue: Closed",
        "cuisine": "North Indian / Pakistani",
        "menu_price": "Signature: Fresh Tandoori Naan & Butter Chicken | Menu: Garlic Naan, Butter Chicken, Mutton Rogan Josh, Tandoori Chicken | Price: SGD 4.50–9.50",
        "halal": "Yes",
        "vegan": "No",
    },
    ("210665", (1, 254)): {
        "name": "Temasek Indian Rojak",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Crispy Indian Rojak with Sweet Nutty Dip | Menu: Prawn Fritters, Crispy Dough, Tofu, Cuttlefish, Egg Fritter | Price: SGD 5.00–12.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("210665", (1, 276)): {
        "name": "Ar-Rahman Cafe & Royal Prata",
        "hours": "Daily 24 Hours",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Crispy Roti Prata & Teh Tarik | Menu: Plain Prata, Egg Prata, Coin Prata with Mutton Curry, Murtabak | Price: SGD 1.30–7.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("210665", (1, 280)): {
        "name": "Raja Bojun Sri Lankan Food",
        "hours": "Tue–Sun 09:30–21:30; Mon: Closed",
        "cuisine": "Sri Lankan",
        "menu_price": "Signature: Authentic Sri Lankan Crab Curry & Rice | Menu: Sri Lankan Rice & Curry Set, Devilled Chicken, Pol Sambol, Dhal Curry | Price: SGD 5.50–12.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("210665", (1, 326)): {
        "name": "545 Whampoa Prawn Noodles (Tekka)",
        "hours": "Tue–Sun 10:00–21:00; Mon: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Traditional Heritage Prawn Mee | Menu: Sliced Prawn Noodle (Dry/Soup), Pork Tail Prawn Noodle | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 10. ZION RIVERSIDE FOOD CENTRE (247792)
    # ==========================================
    ("247792", (1, 4)): {
        "name": "Zion Road Big Prawn Mee (Zhi Wei Xian)",
        "hours": "Tue–Sun 11:30–15:00, 18:30–22:00; Mon: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Big Prawn Noodle in Rich Crustacean Broth | Menu: Big Prawn Noodle (Dry/Soup), Pork Rib Big Prawn Noodle, Prawn Tail Noodle | Price: SGD 8.00–18.00",
        "halal": "No",
        "vegan": "No",
    },
    ("247792", (1, 17)): {
        "name": "No. 18 Zion Road Fried Kway Teow",
        "hours": "Daily 12:30–15:00, 15:30–21:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Char Kway Teow with Intense Wok Hei | Menu: Char Kway Teow with Fresh Cockles, Lup Cheong & Crispy Lard | Price: SGD 5.00–9.00",
        "halal": "No",
        "vegan": "No",
    },
    ("247792", (1, 26)): {
        "name": "Lau Goh Teochew Chye Thow Kway",
        "hours": "Wed–Mon 12:00–21:00; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Classic White & Black Fried Carrot Cake | Menu: White Carrot Cake, Black Carrot Cake, Mixed Yin-Yang Carrot Cake | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("247792", (1, 24)): {
        "name": "Boon Tong Kee Kway Chap Braised Duck",
        "hours": "Daily 10:00–20:30",
        "cuisine": "Teochew",
        "menu_price": "Signature: Braised Duck Kway Chap Platter | Menu: Braised Duck Rice, Kway Chap Combo (Pork Belly, Intestines, Tau Pok, Egg) | Price: SGD 5.00–9.50",
        "halal": "No",
        "vegan": "No",
    },
    ("247792", (1, 22)): {
        "name": "Ah Wang La Mian Xiao Long Bao Shanghai Guo Tie",
        "hours": "Daily 11:00–21:00",
        "cuisine": "Shanghainese",
        "menu_price": "Signature: Handmade Xiao Long Bao & Guo Tie | Menu: Steamed Pork Dumplings, Pan-Fried Potstickers, Dan Dan La Mian | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 11. ADAM ROAD FOOD CENTRE (289876)
    # ==========================================
    ("289876", (1, 2)): {
        "name": "Selera Rasa Nasi Lemak",
        "hours": "Mon–Thu 07:00–17:00, Sat–Sun 07:00–15:00; Fri: Closed",
        "cuisine": "Malay",
        "menu_price": "Signature: Basmati Rice Nasi Lemak (Royal Flush Set) | Menu: Royal Flush Set (Chicken Wing, Otah, Begedil, Egg, Ikan Bilis), Basmati Rice with Otah / Fish | Price: SGD 4.00–6.50",
        "halal": "Yes",
        "vegan": "No",
        "contact": "+65 9843 4509",
    },
    ("289876", (1, 1)): {
        "name": "No. 1 Adam's Nasi Lemak",
        "hours": "Wed–Mon 08:00–14:00; Tue: Closed",
        "cuisine": "Malay",
        "menu_price": "Signature: Traditional Nasi Lemak with Mutton Rendang | Menu: Nasi Lemak Set, Chicken Wing Set, Mutton Rendang Set | Price: SGD 4.00–6.50",
        "halal": "Yes",
        "vegan": "No",
    },
    ("289876", (1, 5)): {
        "name": "Adam's Indian Rojak",
        "hours": "Tue–Sun 10:00–20:30; Mon: Closed",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Crispy Indian Rojak with Peanut Dip | Menu: Prawn Fritters, Coconut Fritters, Tofu, Cuttlefish, Egg | Price: SGD 5.00–12.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("289876", (1, 7)): {
        "name": "Zaiton Satay",
        "hours": "Daily 08:00–21:00",
        "cuisine": "Malay",
        "menu_price": "Signature: Charcoal Grilled Chicken & Mutton Satay | Menu: Chicken Satay, Beef Satay, Mutton Satay, Ketupat with Peanut Gravy | Price: SGD 0.90/stick",
        "halal": "Yes",
        "vegan": "No",
    },
    ("289876", (1, 8)): {
        "name": "Adam Chicken Rice / Ayam Penyet",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Indonesian / Malay",
        "menu_price": "Signature: Crispy Ayam Penyet with Sambal Terasi | Menu: Ayam Penyet Rice, Ayam Panggang, Tahu Tempe Set | Price: SGD 5.50–8.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("289876", (1, 9)): {
        "name": "Selamat Datang Warong Pak Sapari",
        "hours": "Sat–Thu 08:00–16:00; Fri: Closed",
        "cuisine": "Malay",
        "menu_price": "Signature: Authentic Mee Soto & Mee Rebus | Menu: Mee Soto Ayam with Begedil, Mee Rebus, Soto Babat (Tripe Soup) | Price: SGD 4.00–6.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("289876", (1, 10)): {
        "name": "Bahrakath Mutton Soup King",
        "hours": "Daily 11:00–23:30",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Spiced Sup Kambing (Mutton Soup) | Menu: Mutton Rib Soup, Mutton Leg Soup, Mutton Tongue Soup, French Loaf Roti | Price: SGD 6.00–12.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("289876", (1, 27)): {
        "name": "Adam Rd Noo Cheng Big Prawn Noodle",
        "hours": "Tue–Sun 09:30–16:00, 18:30–02:00; Mon: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Deep Umami Big Prawn Noodle | Menu: Big Prawn Noodle (Dry/Soup), Pork Rib Prawn Mee, Tail & Skin Noodle | Price: SGD 6.00–14.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 12. BEDOK 85 (FENGSHAN) (460085)
    # ==========================================
    ("460085", (1, 7)): {
        "name": "Xing Ji Rou Cuo Mian",
        "hours": "Fri–Wed 11:00–00:30; Thu: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Soup Bak Chor Mee with Handmade Meatballs | Menu: Minced Pork Noodle Soup, Meatball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("460085", (1, 8)): {
        "name": "Seng Hiang Bak Chor Mee",
        "hours": "Daily 16:30–01:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Garlic & Pork Lard Bak Chor Mee Soup | Menu: Soup Bak Chor Mee, Dry Minced Meat Noodle | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("460085", (1, 41)): {
        "name": "Shi Wei Da Satay Bee Hoon",
        "hours": "Wed–Mon 16:00–23:00; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Rich Peanut Satay Bee Hoon | Menu: Satay Bee Hoon with Cuttlefish, Pork Slices, Prawns & Cockles | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No",
    },
    ("460085", (1, 61)): {
        "name": "Sing Soon Lee Hainanese Boneless Chicken Rice",
        "hours": "Sat–Thu 11:00–19:00; Fri: Closed",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Boneless Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("460085", (1, 72)): {
        "name": "Soon Mong Duck Rice & Porridge",
        "hours": "Tue–Sun 10:00–19:00; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Braised Duck Rice & Porridge | Menu: Teochew Braised Duck Rice, Duck Porridge, Kway Chap | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 13. ABC BRICKWORKS (150006)
    # ==========================================
    ("150006", (1, 141)): {
        "name": "Ah Er Soup (阿2老火汤)",
        "hours": "Tue, Thu–Fri 11:00–14:00, 17:00–20:00; Wed, Sat–Sun 16:00–20:00; Mon: Closed",
        "cuisine": "Cantonese Herbal Soup",
        "menu_price": "Signature: Ten Tonic Ginseng Chicken Soup | Menu: Herbal Ginseng Chicken Soup, Buddha Jumps Over The Wall, Lotus Root Pork Rib Soup, Olive Rice | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("150006", (1, 120)): {
        "name": "Fatty Cheong",
        "hours": "Fri–Wed 11:00–19:00; Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Bu Jian Tian (Armpit) Char Siew Rice | Menu: Char Siew Rice, Roasted Pork Belly, Roasted Duck Noodle | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("150006", (1, 117)): {
        "name": "Wah Leng Wanton Noodle",
        "hours": "Thu–Mon 06:00–14:00; Tue–Wed: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Springy Egg Wanton Mee | Menu: Traditional Wanton Noodle (Dry/Soup), Fried Wanton, Dumpling Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 14. ALEXANDRA VILLAGE (150120)
    # ==========================================
    ("150120", (1, 75)): {
        "name": "Depot Road Zhen Shan Mei Claypot Laksa",
        "hours": "Mon–Tue, Thu–Sat 09:00–15:00; Wed, Sun: Closed",
        "cuisine": "Peranakan",
        "menu_price": "Signature: Boiling Claypot Laksa | Menu: Claypot Laksa with Cockles, Prawns, Shredded Chicken & Tau Pok | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("150120", (1, 77)): {
        "name": "Xiang Jiang Soya Sauce Chicken",
        "hours": "Wed–Sun 08:00–14:00; Mon–Tue: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Hong Kong Style Soya Sauce Chicken Noodle | Menu: Soya Sauce Chicken Rice, Chicken Noodles, Roasted Meats | Price: SGD 4.00–7.00",
        "halal": "No",
        "vegan": "No",
    },
    ("150120", (1, 82)): {
        "name": "AJ Delights (Muffins)",
        "hours": "Tue–Sat 09:00–18:30; Sun–Mon: Closed",
        "cuisine": "Halal Bakery",
        "menu_price": "Signature: Freshly Baked Gourmet Muffins | Menu: Double Chocolate Muffin, Green Tea Monster Muffin, Walnut Banana Muffin | Price: SGD 2.20–3.50",
        "halal": "Yes",
        "vegan": "No",
    },
    ("150120", (1, 19)): {
        "name": "Mr Avocado Exotic Fruit Juice",
        "hours": "Daily 11:30–18:00",
        "cuisine": "Fresh Juices",
        "menu_price": "Signature: Creamy Avocado Shake | Menu: Avocado Juice with Gula Melaka, Durian Avocado Shake, Fresh Coconut Shake | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },

    # ==========================================
    # 15. GHIM MOH MARKET (270020)
    # ==========================================
    ("270020", (1, 4)): {
        "name": "Chuan Kee Boneless Braised Duck",
        "hours": "Fri–Wed 10:00–20:00; Thu: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Boneless Braised Duck Rice | Menu: Braised Duck Rice Set, Duck Porridge, Kway Chap with Braised Egg & Tau Pok | Price: SGD 4.50–7.00",
        "halal": "No",
        "vegan": "No",
    },
    ("270020", (1, 5)): {
        "name": "Kong Shang Hua Wanton Noodles",
        "hours": "Sat–Wed 06:30–13:30; Thu–Fri: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Springy Egg Wanton Mee | Menu: Wanton Noodle (Dry/Soup), Dumpling Soup, Fried Wanton | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("270020", (1, 15)): {
        "name": "Heavens Indian Curry",
        "hours": "Daily 06:00–14:00",
        "cuisine": "South Indian",
        "menu_price": "Signature: Fresh Princess Appam & Thosai | Menu: Appam with Orange Sugar & Grated Coconut, Masala Thosai, Putu Mayam | Price: SGD 2.50–4.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("270020", (1, 19)): {
        "name": "Guan Kee Fried Kway Teow",
        "hours": "Mon, Wed, Fri–Sat 07:00–18:00; Tue, Thu, Sun: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Master Wok-Hei Fried Kway Teow | Menu: Fried Kway Teow with Cockles, Sausage & Pork Lard | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("270020", (1, 56)): {
        "name": "Hin Fried Hor Fun",
        "hours": "Tue–Sun 10:00–15:00, 17:00–20:00; Mon: Closed",
        "cuisine": "Cantonese Zi Char",
        "menu_price": "Signature: Silky Egg Gravy Beef Hor Fun | Menu: Beef Hor Fun, Sliced Fish Hor Fun, Prawn Hor Fun with Charred Flat Noodles | Price: SGD 5.50–8.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 16. CHANGI VILLAGE HAWKER CENTRE (500002)
    # ==========================================
    ("500002", (1, 3)): {
        "name": "International Muslim Food Stall (Nasi Lemak)",
        "hours": "Tue–Sat 07:00–14:00, 18:00–00:00; Sun–Mon: Closed",
        "cuisine": "Malay",
        "menu_price": "Signature: Fragrant Pandan Nasi Lemak | Menu: Nasi Lemak with Crispy Chicken Wing, Fish Fillet, Otah, Sambal Chili | Price: SGD 4.00–6.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("500002", (1, 26)): {
        "name": "Mizzy Corner Nasi Lemak",
        "hours": "Daily 08:30–22:00",
        "cuisine": "Malay",
        "menu_price": "Signature: Basmati Rice Nasi Lemak with Tender Chicken Wing | Menu: Nasi Lemak Sets with Chicken Wing, Fish, Begedil & Signature Sambal | Price: SGD 4.50–7.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("500002", (1, 19)): {
        "name": "Weng Kee Original Taste Ipoh Hor Fun",
        "hours": "Mon–Fri 10:30–23:00; Sat–Sun 08:00–00:00",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Crispy Chicken Cutlet Ipoh Hor Fun | Menu: Chicken Cutlet Hor Fun, Sliced Chicken & Prawn Hor Fun, Braised Mushroom Hor Fun | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("500002", (1, 34)): {
        "name": "Amigo Chicken Chop Hor Fun",
        "hours": "Wed–Mon 11:00–20:00; Tue: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Deep Fried Chicken Chop Hor Fun | Menu: Chicken Cutlet Hor Fun, Wanton Noodles, Braised Duck Hor Fun | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("500002", (1, 35)): {
        "name": "Million Star Fried Banana",
        "hours": "Thu–Tue 10:00–17:00; Wed: Closed",
        "cuisine": "Singaporean Snacks",
        "menu_price": "Signature: Crispy Pisang Raja Goreng Pisang | Menu: Fried Banana (Goreng Pisang), Fried Cempedak, Green Bean Cake, Sweet Potato Fritter | Price: SGD 1.50–2.80",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },

    # ==========================================
    # 17. WHAMPOA MAKAN PLACE (320090 / 320091)
    # ==========================================
    ("320091", (1, 24)): {
        "name": "China Whampoa Home Made Noodles",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Chinese",
        "menu_price": "Signature: Handmade Ban Mian with Prawns & Mani Cai | Menu: Ban Mian (Dry/Soup), You Mian, Mee Hoon Kway with Sliced Fish & Abalone Clams | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("320091", (1, 28)): {
        "name": "Granny's Pancake (Whampoa)",
        "hours": "Mon–Sat 05:30–13:30; Sun: Closed",
        "cuisine": "Traditional Snacks",
        "menu_price": "Signature: Fluffy Traditional Min Jiang Kueh | Menu: Peanut Pancake, Coconut Pancake, Red Bean Pancake, Peanut Butter Pancake | Price: SGD 1.20–1.60",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("320091", (1, 46)): {
        "name": "Beach Road Fish Head Bee Hoon",
        "hours": "Tue, Thu, Sat–Sun 09:00–14:00; Mon, Wed, Fri: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Deep Fried Fish Head Soup | Menu: Fried Fish Meat Bee Hoon, Sliced Fish Soup, Fish Roe Porridge | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("320090", (1, 6)): {
        "name": "Balestier Road Hoover Rojak",
        "hours": "Wed–Sun 10:30–16:00; Mon–Tue: Closed",
        "cuisine": "Singaporean",
        "menu_price": "Signature: Traditional Chinese Rojak with Century Egg & Jellyfish | Menu: Classic Chinese Rojak with Crushed Peanuts, Cucumber, Pineapple & You Tiao | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("320090", (1, 7)): {
        "name": "Liang Zhao Ji Duck Rice",
        "hours": "Wed–Mon 10:30–14:00; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Herbal Braised Duck Rice | Menu: Braised Duck Rice, Duck Porridge, Herbal Braised Duck Soup | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("320090", (1, 21)): {
        "name": "Nan Xiang Chicken Rice",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Hainanese Steamed Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 18. ANG MO KIO 724 (560724)
    # ==========================================
    ("560724", (1, 1)): {
        "name": "Yunos N Family",
        "hours": "Mon–Thu, Sat 11:00–21:00; Fri, Sun: Closed",
        "cuisine": "Malay",
        "menu_price": "Signature: Thick Gravy Mee Rebus with Chicken Wing / Beef Ribs | Menu: Mee Rebus, Mee Soto, Satay (Chicken, Mutton, Beef), Gado Gado | Price: SGD 4.50–8.50",
        "halal": "Yes",
        "vegan": "No",
    },
    ("560724", (1, 9)): {
        "name": "Lim Hai Sheng Cooked Food",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Crispy Pan-Fried White Carrot Cake | Menu: White Carrot Cake, Black Carrot Cake | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("560724", (1, 23)): {
        "name": "Xi Xiang Feng Yong Tau Foo",
        "hours": "Mon–Sat 07:00–19:00; Sun: Closed",
        "cuisine": "Hakka",
        "menu_price": "Signature: Hakka Yong Tau Foo in Rich Laksa Soup | Menu: Handmade Yong Tau Foo Pieces with Chee Cheong Fun or Yellow Noodles | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 19. TECK GHEE SQUARE BLK 409 (560409)
    # ==========================================
    ("560409", (1, 1)): {
        "name": "Xin Yun Seafood Fish Head Steamboat",
        "hours": "Wed–Mon 08:30–15:00, 17:30–22:00; Tue: Closed",
        "cuisine": "Teochew Zi Char",
        "menu_price": "Signature: Charcoal Pomfret Fish Head Steamboat | Menu: Fish Head Steamboat, Prawn Paste Chicken, Sambal Kangkong | Price: SGD 18.00–45.00",
        "halal": "No",
        "vegan": "No",
    },
    ("560409", (1, 24)): {
        "name": "Shi Xian (Mee Siam / Mee Rebus)",
        "hours": "Wed–Sun 07:00–12:30; Mon–Tue: Closed",
        "cuisine": "Malay / Singaporean",
        "menu_price": "Signature: Tangy Traditional Mee Siam | Menu: Mee Siam with Boiled Egg, Traditional Mee Rebus | Price: SGD 3.50–4.50",
        "halal": "No",
        "vegan": "No",
    },
    ("560409", (1, 34)): {
        "name": "Eng Ho Fried Hokkien Mee",
        "hours": "Wed–Mon 16:00–22:00; Tue: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Rich Gravy Hokkien Prawn Mee | Menu: Hokkien Mee with Fresh Prawns, Squid & Crispy Lard | Price: SGD 5.00–8.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 20. TECK GHEE COURT BLK 341 (560341)
    # ==========================================
    ("560341", (1, 4)): {
        "name": "Eng Kee Bak Kut Teh",
        "hours": "Daily 07:00–14:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Peppery Teochew Pork Rib Soup | Menu: Bak Kut Teh (Pork Rib Soup), Braised Pig's Trotters, You Tiao, Salted Vegetables | Price: SGD 6.00–9.50",
        "halal": "No",
        "vegan": "No",
    },
    ("560341", (1, 5)): {
        "name": "Vegetarian Food Om Mani Padme Hum",
        "hours": "Daily 07:00–13:00, Fri–Sun 17:00–20:00",
        "cuisine": "Chinese Vegetarian",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon | Menu: Economical Vegetarian Bee Hoon, Vegetarian Char Siew, Mock Duck, Vegetarian Mee Rebus | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes",
    },
    ("560341", (1, 20)): {
        "name": "Fatty Ang Wanton Noodle",
        "hours": "Daily 06:00–14:00",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Old-School Dark Sauce Wanton Mee | Menu: Wanton Noodle (Dry/Soup), Fried Wanton, Dumpling Soup | Price: SGD 4.00–5.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 21. CLEMENTI 448 (120448)
    # ==========================================
    ("120448", (1, 40)): {
        "name": "Boon Kee Wanton Mee",
        "hours": "Mon–Sat 06:30–16:00; Sun: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Traditional Egg Wanton Noodle | Menu: Wanton Noodle (Dry/Soup), Dumpling Soup, Shredded Chicken Hor Fun | Price: SGD 4.00–5.50",
        "halal": "No",
        "vegan": "No",
    },
    ("120448", (1, 45)): {
        "name": "Fried Carrot Cake (Clementi 448)",
        "hours": "Tue–Sun 06:00–18:00; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Crispy Traditional White & Sweet Black Carrot Cake | Menu: White Carrot Cake, Black Sweet Carrot Cake | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No",
    },
    ("120448", (1, 43)): {
        "name": "Kee Hock Beef Hor Fun",
        "hours": "Fri–Wed 11:00–20:30; Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Tender Beef Hor Fun in Black Bean Gravy | Menu: Sliced Beef Hor Fun, Beef Fried Rice, Ginger Spring Onion Beef | Price: SGD 5.50–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("120448", (1, 28)): {
        "name": "Kian Seng Lor Mee",
        "hours": "Daily 05:30–14:00",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Traditional Lor Mee with Crispy Batter Bits | Menu: Lor Mee with Braised Pork & Egg, Prawn Noodle Soup, Laksa | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 22. PEK KIO MARKET (211041)
    # ==========================================
    ("211041", (1, 13)): {
        "name": "Heng Leong Carrot Cake",
        "hours": "Tue–Sun 07:30–15:30; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Crispy White & Black Chai Tow Kway | Menu: White Fried Carrot Cake, Black Sweet Carrot Cake | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "No",
    },
    ("211041", (1, 15)): {
        "name": "Wah Kee Big Prawn Noodles",
        "hours": "Wed–Sun 09:00–14:00; Mon–Tue: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Legendary Big Prawn Noodle in Peppery Prawn Soup | Menu: Big Prawn Noodle (Dry/Soup), Pork Tail Noodle, Deep Sea Prawns | Price: SGD 6.00–20.00",
        "halal": "No",
        "vegan": "No",
    },
    ("211041", (1, 25)): {
        "name": "Pin Wei Hong Kong Style Chee Cheong Fun",
        "hours": "Tue–Sun 06:30–14:00; Mon: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Freshly Steamed Silk Chee Cheong Fun | Menu: Prawn Chee Cheong Fun, Char Siew Chee Cheong Fun, Scallop Chee Cheong Fun | Price: SGD 3.50–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("211041", (1, 41)): {
        "name": "Lai Hiang Pork Rib Prawn Mee",
        "hours": "Sat–Tue 06:00–13:30; Wed–Fri: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Pork Rib Prawn Noodle | Menu: Pork Rib Prawn Noodle (Dry/Soup), Tail Noodle, Prawn Soup | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 23. BUKIT MERAH VIEW (151115)
    # ==========================================
    ("151115", (1, 47)): {
        "name": "Na Na Homemade Curry (Bukit Merah View)",
        "hours": "Mon–Sat 11:00–19:00; Sun: Closed",
        "cuisine": "Peranakan",
        "menu_price": "Signature: Fiery Peranakan Curry Fish Head | Menu: Curry Fish Head, Curry Chicken Drumstick, Curry Mutton, Curry Pork Ribs | Price: SGD 4.50–22.00",
        "halal": "No",
        "vegan": "No",
    },
    ("151115", (1, 51)): {
        "name": "Chai Chuan Tou Yang Rou Tang",
        "hours": "Tue–Sat 11:00–13:30; Sun–Mon: Closed",
        "cuisine": "Teochew Mutton Soup",
        "menu_price": "Signature: Herbal Peppery Mutton Soup | Menu: Mutton Rib Soup, Sliced Mutton Soup, Mutton Tripe & Ball Soup | Price: SGD 6.00–10.00",
        "halal": "No",
        "vegan": "No",
    },
    ("151115", (1, 56)): {
        "name": "Yong Chun Wan Ton Noodle",
        "hours": "Fri–Wed 05:30–12:30; Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Traditional Egg Wanton Noodle | Menu: Wanton Mee (Dry/Soup), Shredded Chicken Hor Fun, Dumpling Noodle | Price: SGD 3.50–5.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 24. COMMONWEALTH CRESCENT (141088)
    # ==========================================
    ("141088", (2, 90)): {
        "name": "Foong Kee Traditional Charcoal Roast",
        "hours": "Tue–Sat 11:00–14:00; Sun–Mon: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Charcoal Roast Duck & Caramelized Char Siew | Menu: Char Siew Roast Pork Rice, Roast Duck Noodle, Wanton Soup | Price: SGD 4.50–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("141088", (2, 94)): {
        "name": "Huang Da Fu Bak Chor Mee",
        "hours": "Tue–Sun 08:00–15:00; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Springy Bak Chor Mee | Menu: Minced Meat Noodle, Meatball Soup, Fish Dumpling Mee Pok | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # 25. MARINE PARADE CENTRAL (440084)
    # ==========================================
    ("440084", (1, 24)): {
        "name": "Tip Top Vegetarian",
        "hours": "Fri–Wed 06:00–14:00; Thu: Closed",
        "cuisine": "Vegetarian",
        "menu_price": "Signature: Traditional Vegetarian Bee Hoon | Menu: Vegetarian Fried Bee Hoon, Mock Char Siew, Crispy Zai Er, Vegetarian Kway Chap | Price: SGD 3.00–4.80",
        "halal": "No",
        "vegan": "Yes",
    },
    ("440084", (1, 27)): {
        "name": "Apollo Fresh Cockle Fried Kway Teow",
        "hours": "Wed–Mon 11:30–14:30; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Wet-Style Garlic Fried Kway Teow | Menu: Fried Kway Teow with Fresh Cockles, Egg & Garlic Chives | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("440084", (1, 30)): {
        "name": "Emmanuel Peranakan Cuisine",
        "hours": "Fri–Tue 09:00–15:00; Wed–Thu: Closed",
        "cuisine": "Peranakan",
        "menu_price": "Signature: Blue Pea Flower Nasi Lemak | Menu: Blue Pea Nasi Lemak with Ayam Berempah, Otah, Beef Rendang | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # OLD AIRPORT ROAD ADDITIONAL STALLS (390051)
    # ==========================================
    ("390051", (1, 1)): {
        "name": "Rong Yi Local Handmade Pau",
        "hours": "Daily 07:00–18:00",
        "cuisine": "Cantonese Dim Sum",
        "menu_price": "Signature: Handmade Big Pau | Menu: Da Pau, Char Siew Pau, Siew Mai, Glutinous Rice Chicken | Price: SGD 1.20–2.80",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 2)): {
        "name": "Hua Kee Wanton Mee",
        "hours": "Tue–Sun 10:00–22:00; Mon: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Old-School Wanton Mee | Menu: Wanton Noodles (Dry/Soup), Fried Wanton, Dumpling Soup | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 3)): {
        "name": "Teck Huat Coffee",
        "hours": "Daily 06:00–18:00",
        "cuisine": "Traditional Coffee & Toast",
        "menu_price": "Signature: Traditional Nanyang Kopi | Menu: Kopi O, Teh, Kaya Butter Toast, Half Boiled Eggs | Price: SGD 1.30–3.20",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 5)): {
        "name": "Victor's Japanese Delights",
        "hours": "Tue–Sun 11:30–20:30; Mon: Closed",
        "cuisine": "Japanese",
        "menu_price": "Signature: Teriyaki Chicken Bento | Menu: Teriyaki Chicken Don, Saba Fish Bento, Chicken Katsu Curry | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 6)): {
        "name": "Kim Satay",
        "hours": "Daily 16:30–22:30",
        "cuisine": "Singaporean",
        "menu_price": "Signature: Charcoal Grilled Pork Satay | Menu: Pork Satay with Pineapple Gravy, Chicken Satay, Mutton Satay, Ketupat | Price: SGD 0.90/stick",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 7)): {
        "name": "Xin Xin Yong Tau Fu",
        "hours": "Tue–Sun 07:00–14:00; Mon: Closed",
        "cuisine": "Hakka",
        "menu_price": "Signature: Handmade Yong Tau Foo Soup | Menu: Tofu Stuffed with Fish Paste, Bittergourd, Chilli, Kang Kong, Bean Curd Sheets | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 8)): {
        "name": "Tian Tian You Yu",
        "hours": "Wed–Mon 10:00–20:00; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Fresh Sliced Fish Soup | Menu: Batang Sliced Fish Soup, Seafood Soup, Fish Head Bee Hoon | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 9)): {
        "name": "Pasta Risotto",
        "hours": "Daily 11:30–21:00",
        "cuisine": "Western / Italian",
        "menu_price": "Signature: Creamy Seafood Risotto | Menu: Carbonara, Aglio Olio, Mushroom Risotto, Grilled Chicken Chop | Price: SGD 6.50–11.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 10)): {
        "name": "Albert Street Prawn Noodle (Old Airport Road)",
        "hours": "Tue–Sun 06:00–14:30; Mon: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Traditional Prawn Noodle Soup | Menu: Big Prawn Noodle, Pork Rib Prawn Mee, Tail Noodle | Price: SGD 5.50–9.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 15)): {
        "name": "136 Fish Soup",
        "hours": "Daily 11:00–20:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Sliced Batang Fish Soup | Menu: Sliced Fish Soup, Fried Fish Meat Bee Hoon, Seafood Porridge | Price: SGD 5.50–8.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 16)): {
        "name": "Hei Po Po Crayfish Ipoh Hor Fun",
        "hours": "Daily 10:30–20:30",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Fresh Crayfish Ipoh Hor Fun | Menu: Crayfish Hor Fun, Shredded Chicken & Prawn Hor Fun, Chicken Cutlet Hor Fun | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 17)): {
        "name": "Shan Dong Dong Ji La Mian Xiao Long Bao",
        "hours": "Daily 10:30–21:00",
        "cuisine": "Northern Chinese",
        "menu_price": "Signature: Steamed Xiao Long Bao | Menu: Xiao Long Bao (Juicy Meat Buns), Pan Fried Dumplings, Spicy Oil Wanton, Dan Dan Mian | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 19)): {
        "name": "Jack's Kitchen (Western Food)",
        "hours": "Daily 11:30–21:30",
        "cuisine": "Western",
        "menu_price": "Signature: Grilled Chicken Chop with Black Pepper Sauce | Menu: Chicken Chop, Pork Chop, Fish & Chips, Ribeye Steak | Price: SGD 7.00–13.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 20)): {
        "name": "Choo Zai Zhai Vegetarian Food",
        "hours": "Daily 07:00–14:00",
        "cuisine": "Chinese Vegetarian",
        "menu_price": "Signature: Vegetarian Fried Bee Hoon | Menu: Economical Vegetarian Bee Hoon with Crispy Zai Er, Mock Char Siew, Veg Spring Rolls | Price: SGD 3.00–4.50",
        "halal": "No",
        "vegan": "Yes",
    },
    ("390051", (1, 21)): {
        "name": "Ah Wen Lao Huo Tang",
        "hours": "Daily 11:00–20:30",
        "cuisine": "Cantonese Herbal Soup",
        "menu_price": "Signature: Slow-Boiled Watercress Pork Rib Soup | Menu: Watercress Soup, Lotus Root Soup, Herbal Ginseng Chicken Soup | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 22)): {
        "name": "Hock Lam Street Popular Beef Kway Teow",
        "hours": "Tue–Sun 10:30–20:00; Mon: Closed",
        "cuisine": "Hainanese Beef Noodles",
        "menu_price": "Signature: Thick Gravy Beef Kway Teow | Menu: Sliced Beef Noodle (Dry/Soup), Beef Tendon & Brisket Kway Teow, Beef Ball Soup | Price: SGD 6.00–9.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 25)): {
        "name": "Kheng Hai Hui Boneless Chicken Rice",
        "hours": "Daily 10:00–19:30",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Boneless Hainanese Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard, Braised Egg | Price: SGD 4.00–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 27)): {
        "name": "Holy Grill",
        "hours": "Daily 11:30–21:00",
        "cuisine": "Western",
        "menu_price": "Signature: Grilled Chicken Chop with 2 Sides | Menu: Grilled Chicken Chop, Black Pepper Steak, Prime Rib, Fish & Chips | Price: SGD 7.50–14.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 28)): {
        "name": "Xing Li Cooked Food",
        "hours": "Wed–Mon 16:30–23:00; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Traditional Eggy Oyster Omelette | Menu: Crispy Fried Oyster Omelette (Orh Luak) | Price: SGD 6.00–12.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 29)): {
        "name": "Seng Kee Ngo Hiang Prawn Cracker",
        "hours": "Daily 11:30–20:30",
        "cuisine": "Hokkien / Teochew",
        "menu_price": "Signature: Crispy Prawn Crackers & Ngo Hiang | Menu: Ngo Hiang Roll, Prawn Fritter, Guan Chang, Fried Tofu, Century Egg | Price: SGD 5.00–12.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 35)): {
        "name": "Hougang Traditional Famous Wanton Noodle",
        "hours": "Wed–Mon 07:00–14:00; Tue: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Classic Singapore Wanton Mee | Menu: Wanton Noodle (Dry/Soup), Fried Wanton, Shredded Chicken Mushroom Noodle | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 37)): {
        "name": "Ru Ji Kitchen (如记小厨)",
        "hours": "Tue–Sun 07:00–13:00; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Handmade Bouncy Fishball Noodles | Menu: Fishball Mee Pok, Fish Cake, Meatball Soup | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 38)): {
        "name": "Jie Sheng Economic Bee Hoon Nasi Lemak",
        "hours": "Daily 06:00–13:00",
        "cuisine": "Singaporean Breakfast",
        "menu_price": "Signature: Economical Fried Bee Hoon with Crispy Chicken Wing | Menu: Fried Bee Hoon, Nasi Lemak, Luncheon Meat, Fried Egg | Price: SGD 2.50–4.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 42)): {
        "name": "Arabiano Kebab",
        "hours": "Daily 11:30–21:30",
        "cuisine": "Middle Eastern",
        "menu_price": "Signature: Chicken Shawarma & Mandi Rice | Menu: Chicken Kebab Roll, Lamb Mandi Rice, Falafel Wrap, Kunafa | Price: SGD 6.00–12.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("390051", (1, 46)): {
        "name": "AM Mohamed Food",
        "hours": "Daily 07:00–21:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Roti Prata & Murtabak | Menu: Plain Prata, Egg Prata, Mutton Murtabak, Mee Goreng | Price: SGD 1.30–7.50",
        "halal": "Yes",
        "vegan": "No",
    },
    ("390051", (1, 55)): {
        "name": "Famous Kallang Airport Fried Oyster",
        "hours": "Tue–Sun 11:30–21:30; Mon: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Crispy Starchy Fried Oyster Omelette | Menu: Fried Oyster, Fried Carrot Cake (White/Black) | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 57)): {
        "name": "Geylang Lor 20 Banana Fritters",
        "hours": "Daily 10:30–18:00",
        "cuisine": "Traditional Snacks",
        "menu_price": "Signature: Golden Fried Goreng Pisang | Menu: Fried Banana, Fried Sweet Potato, 3-in-1 Nian Gao, Green Bean Fritter | Price: SGD 1.50–2.50",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("390051", (1, 58)): {
        "name": "Yan Ci Xin Vegetarian",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Chinese Vegetarian",
        "menu_price": "Signature: Vegetarian Bee Hoon & Brown Rice Set | Menu: Vegetarian Fried Bee Hoon, Mock Drumstick, Curry Vegetables, Braised Tofu | Price: SGD 3.00–5.00",
        "halal": "No",
        "vegan": "Yes",
    },
    ("390051", (1, 63)): {
        "name": "Mattar Road Seafood BBQ",
        "hours": "Thu–Sun 15:00–23:00; Mon–Wed: Closed",
        "cuisine": "Seafood / BBQ",
        "menu_price": "Signature: White Pepper Crab & Sambal Stingray | Menu: White Pepper Crab, Chilli Crab, Sambal Stingray, BBQ Sotong | Price: SGD 18.00–65.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 65)): {
        "name": "Old Amoy Chendol (Old Airport Road)",
        "hours": "Wed–Sun 08:30–19:30; Mon–Tue: Closed",
        "cuisine": "Traditional Desserts",
        "menu_price": "Signature: Cold-Pressed Coconut Chendol | Menu: Traditional Chendol with Gula Melaka & Red Beans | Price: SGD 2.50–3.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("390051", (1, 70)): {
        "name": "Yi Fa Kway Chap",
        "hours": "Wed–Mon 07:00–14:30; Tue: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Herbal Kway Chap Set | Menu: Kway Chap Platter (Pork Belly, Intestines, Tau Pok, Egg), Silky Kway Sheets | Price: SGD 4.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 101)): {
        "name": "Famous Old Airport Fried Oyster",
        "hours": "Daily 11:30–21:30",
        "cuisine": "Teochew",
        "menu_price": "Signature: Crispy Fried Oyster Omelette | Menu: Fried Oyster, Fried Carrot Cake | Price: SGD 5.00–10.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 103)): {
        "name": "Meng Kee Minced Meat Noodle",
        "hours": "Daily 07:00–14:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Minced Pork Mee Pok | Menu: Bak Chor Mee (Dry/Soup), Meatball Soup, Fish Dumpling Noodle | Price: SGD 4.00–6.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 109)): {
        "name": "Wang Ji Shanghai Xiao Long Bao",
        "hours": "Daily 10:30–20:30",
        "cuisine": "Shanghainese",
        "menu_price": "Signature: Steamed Pork Xiao Long Bao | Menu: Xiao Long Bao, Pan-Fried Guo Tie, Hot & Sour Soup, Dan Dan Noodles | Price: SGD 5.00–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 110)): {
        "name": "Aunty Oats Pancake",
        "hours": "Daily 06:30–14:00",
        "cuisine": "Traditional Snacks",
        "menu_price": "Signature: Oat Min Jiang Kueh | Menu: Peanut Pancake, Red Bean Pancake, Coconut Pancake | Price: SGD 1.30–1.80",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("390051", (1, 113)): {
        "name": "Minced Pork Bros",
        "hours": "Wed–Mon 09:30–17:30; Tue: Closed",
        "cuisine": "Teochew Fusion",
        "menu_price": "Signature: Seafood Minced Meat Noodles | Menu: Classic Bak Chor Mee, Scallop Minced Meat Noodle, Ramen-Style Pork Noodle | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 115)): {
        "name": "Nyonya Chendol",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Peranakan Desserts",
        "menu_price": "Signature: Traditional Nyonya Chendol | Menu: Original Chendol, Red Bean Chendol, Sweet Corn Chendol, Durian Chendol | Price: SGD 2.50–4.50",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("390051", (1, 118)): {
        "name": "Jun Yuan House Of Fish",
        "hours": "Thu–Tue 10:30–20:00; Wed: Closed",
        "cuisine": "Teochew",
        "menu_price": "Signature: Herbal Sliced Fish Soup | Menu: Batang Sliced Fish Soup, Fried Fish Meat Soup, Fish Roe Soup | Price: SGD 6.00–9.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 120)): {
        "name": "Jin Hua Fish Head Bee Hoon (Old Airport Road)",
        "hours": "Fri–Wed 10:30–20:00; Thu: Closed",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Fried Fish Meat Milky Bee Hoon | Menu: Sliced Fish Soup, Fried Fish Head Bee Hoon, Fish Roe Soup | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 124)): {
        "name": "Tiong Bahru Lor Mee (Old Airport Road)",
        "hours": "Daily 08:30–15:30",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Traditional Braised Lor Mee | Menu: Traditional Lor Mee, Fried Fish Lor Mee, Braised Egg & Pork Belly | Price: SGD 4.50–6.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 128)): {
        "name": "SALT.",
        "hours": "Daily 11:30–20:30",
        "cuisine": "Western Fusion",
        "menu_price": "Signature: Sous-Vide Chicken Chop & Fried Rice | Menu: Salted Egg Chicken Fried Rice, Grilled Chicken Cutlet, Garlic Butter Prawn Rice | Price: SGD 6.80–11.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 139)): {
        "name": "Tai Seng Herbal Soup",
        "hours": "Wed–Mon 11:00–20:00; Tue: Closed",
        "cuisine": "Cantonese Herbal Soup",
        "menu_price": "Signature: Herbal Black Chicken Soup | Menu: Ginseng Chicken Soup, Lotus Root Pork Rib Soup, Ten Tonic Herbal Soup | Price: SGD 5.00–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 144)): {
        "name": "Ren Min (Craft Beer)",
        "hours": "Tue–Fri 16:30–23:00; Sat–Sun 12:00–23:00; Mon: Closed",
        "cuisine": "Craft Beer & Beverages",
        "menu_price": "Signature: Fresh Tap Craft Beers | Menu: Local and International Craft IPAs, Stouts, Sours on Tap | Price: SGD 10.00–16.00",
        "halal": "No",
        "vegan": "Vegan-friendly",
    },
    ("390051", (1, 147)): {
        "name": "Wen Wen Pork Rib Big Prawn Mee",
        "hours": "Tue–Sun 12:00–21:00; Mon: Closed",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Seafood Pork Rib Big Prawn Hotpot | Menu: Big Prawn Noodle, Pork Rib Prawn Mee, Seafood Claypot Hotpot | Price: SGD 6.00–35.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 156)): {
        "name": "Qing Carrot Cake",
        "hours": "Daily 07:00–15:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Crispy Fried White Carrot Cake | Menu: White Carrot Cake, Black Sweet Carrot Cake, Popiah | Price: SGD 3.50–5.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 157)): {
        "name": "My Genie Gourmet",
        "hours": "Daily 07:30–17:00",
        "cuisine": "Singaporean Pastries",
        "menu_price": "Signature: Traditional Epok Epok & Soon Kueh | Menu: Chicken Curry Puff, Sardine Puff, Soon Kueh, Peng Kueh | Price: SGD 1.40–2.20",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 158)): {
        "name": "Tong Xing Roasted Meats",
        "hours": "Daily 09:30–19:30",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Roasted Duck & Char Siew Rice | Menu: Roast Duck, Crispy Roast Pork Belly, Char Siew Noodle | Price: SGD 4.50–7.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 160)): {
        "name": "Fort Canning Big Prawn Noodle",
        "hours": "Daily 08:00–15:00",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Heritage Big Prawn Noodle Soup | Menu: Prawn Noodle (Dry/Soup), Pork Rib Prawn Noodle | Price: SGD 5.50–9.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 162)): {
        "name": "J & J Special Beef Noodle",
        "hours": "Tue–Sun 10:30–16:00; Mon: Closed",
        "cuisine": "Taiwanese / Western Beef",
        "menu_price": "Signature: Braised Wagyu Beef Noodle | Menu: Wagyu Beef Noodle, Braised Beef Shank Noodle, Beef Tendon Soup | Price: SGD 8.50–16.00",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 163)): {
        "name": "Hin Fried Hor Fun (Old Airport Road)",
        "hours": "Daily 11:00–21:00",
        "cuisine": "Cantonese Zi Char",
        "menu_price": "Signature: Smoky Beef Hor Fun | Menu: Beef Hor Fun, Sliced Fish Mui Fan, Prawn Hor Fun with Rich Egg Gravy | Price: SGD 5.50–8.50",
        "halal": "No",
        "vegan": "No",
    },
    ("390051", (1, 164)): {
        "name": "Bakes n Bites",
        "hours": "Tue–Sun 08:30–16:00; Mon: Closed",
        "cuisine": "Traditional Bakery",
        "menu_price": "Signature: Fluffy Chilled Muffins & Egg Tarts | Menu: Chocolate Chip Muffin, Banana Walnut Muffin, Egg Tart, Kaya Tart | Price: SGD 1.60–2.50",
        "halal": "No",
        "vegan": "No",
    },

    # ==========================================
    # LAU PA SAT CARTS (048582)
    # ==========================================
    ("048582", (1, 1)): {
        "name": "KOPI KIOSK (FOOD CART 1)",
        "hours": "Daily 07:00–22:00",
        "cuisine": "Traditional Coffee & Toast",
        "menu_price": "Signature: Traditional Kopi & Kaya Butter Toast | Menu: Kopi O, Teh C, Kaya Butter Toast, Half Boiled Eggs | Price: SGD 1.40–3.50",
        "halal": "No",
        "vegan": "No",
    },
    ("048582", (1, 18)): {
        "name": "Briyani Point @ Lau Pa Sat",
        "hours": "Daily 10:00–22:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Dum Briyani | Menu: Chicken Dum Briyani, Mutton Briyani, Fish Briyani, Dalcha | Price: SGD 6.50–10.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 3)): {
        "name": "Power Satay (Cart 3)",
        "hours": "Mon–Fri 19:00–03:00; Sat–Sun 15:00–03:00",
        "cuisine": "Halal Satay",
        "menu_price": "Signature: Charcoal Grilled Satay | Menu: Chicken Satay, Beef Satay, Mutton Satay, Ketupat with Peanut Gravy | Price: SGD 0.90/stick",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 4)): {
        "name": "Best Satay (Cart 4)",
        "hours": "Mon–Fri 19:00–03:00; Sat–Sun 15:00–03:00",
        "cuisine": "Halal Satay",
        "menu_price": "Signature: Boon Tat Street Charcoal Satay | Menu: Chicken Satay, Beef Satay, Mutton Satay, BBQ Prawns | Price: SGD 0.90/stick",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 5)): {
        "name": "BEST SATAY NO.8 (CART 5)",
        "hours": "Mon–Fri 19:00–03:00; Sat–Sun 15:00–03:00",
        "cuisine": "Halal Satay",
        "menu_price": "Signature: Satay Street Signature Satay Set | Menu: Mixed Satay Sets (Chicken, Beef, Mutton, Prawns) with Ketupat & Cucumber | Price: SGD 15.00–45.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 6)): {
        "name": "Teh Tarik (Cart 6)",
        "hours": "Daily 11:00–23:00",
        "cuisine": "Local Beverages",
        "menu_price": "Signature: Hand-Pulled Teh Tarik | Menu: Teh Tarik, Kopi Tarik, Milo Dinosaur, Ginger Tea | Price: SGD 1.60–3.00",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 7)): {
        "name": "Lau Pa Sat Satay (Cart 7)",
        "hours": "Mon–Fri 19:00–03:00; Sat–Sun 15:00–03:00",
        "cuisine": "Halal Satay",
        "menu_price": "Signature: Charcoal Satay | Menu: Chicken Satay, Beef Satay, Mutton Satay | Price: SGD 0.90/stick",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 8)): {
        "name": "Geylang Serai Satay (Cart 8)",
        "hours": "Mon–Fri 19:00–03:00; Sat–Sun 15:00–03:00",
        "cuisine": "Halal Satay",
        "menu_price": "Signature: Malay Heritage Satay | Menu: Chicken Satay, Mutton Satay, Beef Satay, Ketupat | Price: SGD 0.90/stick",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 9)): {
        "name": "Warisan Satay (Cart 9)",
        "hours": "Mon–Fri 19:00–03:00; Sat–Sun 15:00–03:00",
        "cuisine": "Halal Satay",
        "menu_price": "Signature: Traditional Charcoal Satay | Menu: Chicken Satay, Mutton Satay, Beef Satay, Ketupat | Price: SGD 0.90/stick",
        "halal": "Yes",
        "vegan": "No",
    },
    ("048582", (1, 10)): {
        "name": "Ina Satay (Cart 10)",
        "hours": "Mon–Fri 19:00–03:00; Sat–Sun 15:00–03:00",
        "cuisine": "Halal Satay",
        "menu_price": "Signature: Fragrant Peanut Gravy Satay | Menu: Chicken, Beef, Mutton & Prawn Satay | Price: SGD 0.90/stick",
        "halal": "Yes",
        "vegan": "No",
    },
}


LICENCE_REGISTRY = {
    # Lau Pa Sat Stalls by Licence
    "W91119C001": {
        "name": "Sugar Cane & Drink Stall",
        "hours": "Daily 24 Hours",
        "cuisine": "Local Beverages",
        "menu_price": "Signature: Fresh Sugar Cane Juice | Menu: Sugar Cane Juice with Lemon, Fresh Coconut, Ice Lemon Tea | Price: SGD 2.00–4.00",
        "halal": "No", "vegan": "Vegan-friendly"
    },
    "W91119C009": {
        "name": "DELHI EXPRESS INDIAN CUISINE",
        "hours": "Daily 10:00–22:00",
        "cuisine": "North Indian",
        "menu_price": "Signature: Butter Chicken & Naan | Menu: Garlic Naan, Butter Chicken, Mutton Rogan Josh, Palak Paneer | Price: SGD 5.50–12.00",
        "halal": "Yes", "vegan": "No"
    },
    "W91119C031": {
        "name": "Delhi Kitchen",
        "hours": "Daily 10:00–22:00",
        "cuisine": "North Indian",
        "menu_price": "Signature: Tandoori Chicken Set | Menu: Tandoori Chicken, Biryani Rice, Dhal Makhani | Price: SGD 6.00–12.00",
        "halal": "Yes", "vegan": "No"
    },
    "W91119C043": {
        "name": "NJ CLASSIC INDIAN CUISINE",
        "hours": "Daily 10:00–22:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Prata & Curry Set | Menu: Plain Prata, Egg Prata, Murtabak, Fish Curry | Price: SGD 1.50–8.00",
        "halal": "Yes", "vegan": "No"
    },
    "CE14D49V000": {
        "name": "HALAL HONG KONG STREET",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Halal Zi Char",
        "menu_price": "Signature: Halal Cereal Prawns & Sambal Kang Kong | Menu: Sweet & Sour Fish, Black Pepper Beef, Fried Rice | Price: SGD 6.50–16.00",
        "halal": "Yes", "vegan": "No"
    },
    "W91119C027": {
        "name": "Turkish Lezzet Express",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Turkish / Middle Eastern",
        "menu_price": "Signature: Doner Kebab Platter | Menu: Chicken Kebab Wrap, Lamb Doner Rice, Hummus with Pita, Baklava | Price: SGD 7.50–14.00",
        "halal": "Yes", "vegan": "No"
    },
    "W91119C062": {
        "name": "AL-Gabei Yemeni Cuisine",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Middle Eastern / Yemeni",
        "menu_price": "Signature: Yemeni Lamb Mandi Rice | Menu: Lamb Mandi, Chicken Mandi, Shakshuka, Arabic Salad | Price: SGD 8.50–18.00",
        "halal": "Yes", "vegan": "No"
    },
    "W91119C028": {
        "name": "NASI CAMPUR (Lau Pa Sat)",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Indonesian / Malay",
        "menu_price": "Signature: Nasi Padang Mixed Rice | Menu: Beef Rendang, Ayam Panggang, Sayur Lodeh, Sambal Goreng | Price: SGD 5.50–10.00",
        "halal": "Yes", "vegan": "No"
    },
    "W91119C012": {
        "name": "CHICKEN RICE (Lau Pa Sat)",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Hainanese",
        "menu_price": "Signature: Steamed Hainanese Chicken Rice | Menu: Steamed Chicken Rice, Roasted Chicken Rice, Chicken Gizzard | Price: SGD 5.00–7.50",
        "halal": "No", "vegan": "No"
    },
    "W91119C022": {
        "name": "CHANGANJI BEEF ROTI",
        "hours": "Daily 10:30–21:30",
        "cuisine": "Chinese Street Food",
        "menu_price": "Signature: Shaanxi Crispy Beef Mo | Menu: Braised Beef Mo (Chinese Burger), Hand-Pulled Beef Noodles | Price: SGD 5.50–8.50",
        "halal": "No", "vegan": "No"
    },
    "W91119C019": {
        "name": "FUZHOU DUMPLING",
        "hours": "Daily 10:30–21:30",
        "cuisine": "Fuzhou / Chinese",
        "menu_price": "Signature: Handmade Fuzhou Fishball & Dumplings | Menu: Fuzhou Fishball Soup, Meat Dumplings, Wanton Noodles | Price: SGD 5.00–7.50",
        "halal": "No", "vegan": "No"
    },
    "W91119C046": {
        "name": "Shanghai Fried Xiao Long Bao (Lau Pa Sat)",
        "hours": "Daily 10:30–21:30",
        "cuisine": "Shanghainese",
        "menu_price": "Signature: Pan-Fried Pork Buns (Sheng Jian Bao) | Menu: Pan-Fried Dumplings, Xiao Long Bao, Sour & Spicy Soup | Price: SGD 5.50–8.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C005": {
        "name": "Fu Xiao Fish Soup",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Teochew",
        "menu_price": "Signature: Sliced Batang Fish Soup | Menu: Sliced Fish Soup, Fried Fish Soup, Fish Head Bee Hoon | Price: SGD 6.00–9.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C040": {
        "name": "Kallang Airport Wanton Noodle",
        "hours": "Daily 09:30–21:30",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Traditional Wanton Mee | Menu: Wanton Noodles (Dry/Soup), Fried Wanton, Dumpling Soup | Price: SGD 5.00–7.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C008": {
        "name": "SENG KEE FRIED HOKKIEN NOODLES",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Hokkien",
        "menu_price": "Signature: Fried Hokkien Prawn Mee | Menu: Hokkien Prawn Noodles with Squid, Pork Belly & Sambal | Price: SGD 5.50–8.50",
        "halal": "No", "vegan": "No"
    },
    "CE14D53E000": {
        "name": "LAO FU ZI FRIED KWAY TEOW (Lau Pa Sat)",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Black & White Char Kway Teow | Menu: Fried Kway Teow with Cockles, Lap Cheong & Pork Lard | Price: SGD 5.50–8.50",
        "halal": "No", "vegan": "No"
    },
    "W91119C050": {
        "name": "HEYYA BRAISED DUCK & KWAY CHAP",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Teochew",
        "menu_price": "Signature: Teochew Braised Duck Rice | Menu: Braised Duck Rice, Kway Chap Platter, Braised Pork Belly | Price: SGD 5.50–9.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C011": {
        "name": "TEOCHEW PORRIDGE/RICE",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Teochew",
        "menu_price": "Signature: Teochew Porridge with Side Dishes | Menu: Steamed Fish, Braised Tau Pok, Salted Vegetables, Minced Pork | Price: SGD 4.50–10.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C023": {
        "name": "Teck Ee Econ Rice",
        "hours": "Daily 10:00–20:30",
        "cuisine": "Chinese Mixed Rice",
        "menu_price": "Signature: Economical Mixed Rice | Menu: 2 Veg 1 Meat Rice, Sweet & Sour Pork, Stir Fried Vegetables | Price: SGD 4.00–6.50",
        "halal": "No", "vegan": "No"
    },
    "W91119C044": {
        "name": "RI RI HONG MALA HOT POT",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Sichuan Mala",
        "menu_price": "Signature: Fragrant Mala Xiang Guo | Menu: Custom Stir-Fried Mala Hot Pot with Choice of Meats & Greens | Price: SGD 8.00–20.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C038": {
        "name": "NEW STYLE MALA",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Sichuan Mala",
        "menu_price": "Signature: Sichuan Mala Tang | Menu: Mala Tang Soup, Mala Xiang Guo | Price: SGD 8.00–18.00",
        "halal": "No", "vegan": "No"
    },
    "CE22323X000": {
        "name": "Pu Tian Heng Hwa Cuisine",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Fujian / Putian",
        "menu_price": "Signature: Putian Lor Mee | Menu: Heng Hwa Fried Bee Hoon, Putian Lor Mee, Lychee Pork | Price: SGD 6.50–12.00",
        "halal": "No", "vegan": "No"
    },
    "CE22K70C000": {
        "name": "THAI KITCHEN MR TOM YUM",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Thai",
        "menu_price": "Signature: Seafood Tom Yum Soup with Rice | Menu: Tom Yum Soup, Pad Thai, Green Curry Chicken, Basil Pork Rice | Price: SGD 6.00–10.50",
        "halal": "No", "vegan": "No"
    },
    "W91119C051": {
        "name": "Japanese & Korean Cuisine",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Japanese & Korean",
        "menu_price": "Signature: Kimchi Fried Rice & Chicken Katsu | Menu: Salmon Teriyaki Bento, Hotplate Beef Saba, Kimchi Jjigae | Price: SGD 6.50–11.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C056": {
        "name": "King Dae Bak Korean & Japanese",
        "hours": "Daily 11:00–21:30",
        "cuisine": "Korean",
        "menu_price": "Signature: Hotplate Bibimbap & BBQ Chicken | Menu: Dolsot Bibimbap, Korean Spicy Pork, Ginseng Chicken Soup | Price: SGD 6.50–12.00",
        "halal": "No", "vegan": "No"
    },
    "CE23F35P000": {
        "name": "Kokoro Izakaya",
        "hours": "Daily 11:30–22:00",
        "cuisine": "Japanese Izakaya",
        "menu_price": "Signature: Charcoal Yakitori & Ramen | Menu: Yakitori Skewers, Tonkotsu Ramen, Salmon Don | Price: SGD 7.50–15.00",
        "halal": "No", "vegan": "No"
    },
    "W02206B000": {
        "name": "Yamamoto No Hamburg",
        "hours": "Daily 11:30–21:30",
        "cuisine": "Japanese Hamburg Steak",
        "menu_price": "Signature: Classic Demi-Glace Hamburg Steak | Menu: Japanese Hamburg Steak Set, Cheese Hamburg, Omu Hamburg | Price: SGD 12.00–18.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C048": {
        "name": "GERRY'S EXPRESS",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Filipino",
        "menu_price": "Signature: Crispy Pata & Sisig | Menu: Pork Sisig, Lechon Kawali, Chicken Inasal with Garlic Rice | Price: SGD 7.50–15.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C015": {
        "name": "MOON CHAY VEGETARIAN RESTAURANT",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Vietnamese Vegetarian",
        "menu_price": "Signature: Vegetarian Pho & Spring Rolls | Menu: Veggie Beef Pho, Lemongrass Tofu Rice, Fresh Summer Rolls | Price: SGD 6.50–10.00",
        "halal": "No", "vegan": "Yes"
    },
    "W91119C061": {
        "name": "The Crowded Bowl & The Gentle Leaf",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Healthy Vegetarian Bowls",
        "menu_price": "Signature: Custom Salad & Grain Bowls | Menu: Quinoa Grain Bowl with Roasted Sweet Potato, Tofu & Pesto | Price: SGD 6.50–9.50",
        "halal": "No", "vegan": "Yes"
    },
    "W91119C059": {
        "name": "Creme and Cone",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Artisan Gelato & Desserts",
        "menu_price": "Signature: Pistachio & Dark Chocolate Gelato | Menu: Handcrafted Gelato Scoops, Waffle Cones, Affogato | Price: SGD 4.50–8.00",
        "halal": "No", "vegan": "Vegan-friendly"
    },
    "W91119C047": {
        "name": "PARTEA EXPRESS",
        "hours": "Daily 10:30–21:30",
        "cuisine": "Fruit Teas & Beverages",
        "menu_price": "Signature: Fresh Fruit Infused Tea | Menu: Rainbow Fruit Tea, Jasmine Green Tea with Cheese Foam, Peach Oolong | Price: SGD 3.80–6.50",
        "halal": "No", "vegan": "Vegan-friendly"
    },
    "W91119C060": {
        "name": "Coffee and Bear",
        "hours": "Daily 08:00–20:00",
        "cuisine": "Specialty Coffee",
        "menu_price": "Signature: Espresso & Latte | Menu: Flat White, Cold Brew, Iced Americano, Croissants | Price: SGD 3.50–6.00",
        "halal": "No", "vegan": "No"
    },
    "CE21U06V000": {
        "name": "SATAY NOODZ",
        "hours": "Daily 11:00–22:00",
        "cuisine": "Singapore Modern Fusion",
        "menu_price": "Signature: Satay Bee Hoon Bowls | Menu: Satay Pork Belly Noodles, Satay Beef Noodle Bowl | Price: SGD 6.50–9.50",
        "halal": "No", "vegan": "No"
    },
    "CE21S57X000": {
        "name": "Maya's Kitchen",
        "hours": "Daily 10:00–21:30",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Chicken Briyani & Roti Canai | Menu: Briyani Rice, Curry Chicken, Prata, Teh Tarik | Price: SGD 4.50–8.50",
        "halal": "Yes", "vegan": "No"
    },
    "CE14D47B000": {
        "name": "CHAN KE MEI SHI",
        "hours": "Daily 10:00–21:00",
        "cuisine": "Cantonese",
        "menu_price": "Signature: Roast Duck & Char Siew Rice | Menu: Roast Duck, Char Siew, Roast Pork Rice | Price: SGD 5.00–8.00",
        "halal": "No", "vegan": "No"
    },
    "CE14D50L000": {
        "name": "Ming Yen Restaurant",
        "hours": "Daily 11:00–21:00",
        "cuisine": "Chinese Zi Char",
        "menu_price": "Signature: Sweet & Sour Pork & Fried Rice | Menu: Yang Zhou Fried Rice, Black Pepper Beef, Hokkien Mee | Price: SGD 6.00–12.00",
        "halal": "No", "vegan": "No"
    },
    "W91119C053": {
        "name": "City Satay (Lau Pa Sat)",
        "hours": "Daily 17:00–01:00",
        "cuisine": "Satay",
        "menu_price": "Signature: Satay Street Skewers | Menu: Chicken Satay, Pork Satay, Mutton Satay, Beef Satay | Price: SGD 0.90/stick",
        "halal": "No", "vegan": "No"
    },

    # Standalone Legendary Heritage Stalls
    "W84231K002": {
        "name": "Hill Street Tai Hwa Pork Noodle",
        "hours": "Mon–Sun 09:30–20:30; 1st & 3rd Mon: Closed",
        "cuisine": "Teochew Bak Chor Mee",
        "menu_price": "Signature: Michelin Star Bak Chor Mee | Menu: Minced Pork Noodles (Dry/Soup), Meatball Soup, Sole Fish Dumpling Soup | Price: SGD 6.00–10.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6292 7477",
        "website": "http://www.taihwa.com.sg/"
    },
    "E79039L009": {
        "name": "Sungei Road Laksa",
        "hours": "Thu–Tue 09:30–16:00; Wed: Closed",
        "cuisine": "Traditional Laksa",
        "menu_price": "Signature: Traditional Charcoal Cooked Laksa | Menu: Katong Style Spoon-Only Laksa with Fresh Cockles & Tau Pok | Price: SGD 4.00",
        "halal": "No", "vegan": "No"
    },
    "E83107V000": {
        "name": "328 Katong Laksa (Original)",
        "hours": "Daily 09:30–21:30",
        "cuisine": "Peranakan Laksa",
        "menu_price": "Signature: Famous Katong Laksa | Menu: Katong Laksa with Prawns, Cockles & Fish Cake, Otah Otah, Nasi Lemak | Price: SGD 6.30–8.30",
        "halal": "No", "vegan": "No",
        "contact": "+65 9732 4165"
    },
    "E45243J000": {
        "name": "Chin Mee Chin Confectionery",
        "hours": "Tue–Sun 08:00–16:00; Mon: Closed",
        "cuisine": "Hainanese Heritage Bakery",
        "menu_price": "Signature: Charcoal Toasted Kaya Buns | Menu: Kaya Toast Bun, Custard Puff, Sugee Cake, Egg Tart, Kopi | Price: SGD 1.60–3.50",
        "halal": "No", "vegan": "No"
    },
    "W45320E000": {
        "name": "Singapore Zam Zam Restaurant",
        "hours": "Daily 07:00–23:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Legendary Mutton / Deer Murtabak | Menu: Deer Murtabak, Mutton Murtabak, Chicken Briyani, Roti Prata | Price: SGD 6.00–18.00",
        "halal": "Yes", "vegan": "No",
        "contact": "+65 6298 6620",
        "website": "https://zamzamsingapore.com/"
    },
    "W71067V000": {
        "name": "Swee Choon Tim Sum Restaurant",
        "hours": "Wed–Mon 07:00–04:00; Tue: Closed",
        "cuisine": "Hong Kong Dim Sum",
        "menu_price": "Signature: Mee Suan Kueh & Salted Egg Yolk Custard Bun | Menu: Steamed Siew Mai, Har Kow, Xiao Long Bao, Mee Suan Kueh | Price: SGD 2.80–6.50",
        "halal": "No", "vegan": "No",
        "contact": "+65 6225 7788",
        "website": "https://www.sweechoon.com/"
    },
    "W01378P000": {
        "name": "Ah Chew Desserts",
        "hours": "Mon, Wed–Thu 12:30–00:00; Fri 12:30–01:00; Sat 13:30–01:00; Sun 13:30–00:00; Tue: Closed",
        "cuisine": "Traditional Chinese Desserts",
        "menu_price": "Signature: Mango Sago with Pomelo | Menu: Durian Mango Sago, Hashima with Red Dates, Yam Paste with Gingko Nuts | Price: SGD 3.50–8.50",
        "halal": "No", "vegan": "Vegan-friendly",
        "contact": "+65 6339 8198"
    },
    "CE12Y34L000": {
        "name": "The Coconut Club",
        "hours": "Tue–Sun 11:00–22:30; Mon: Closed",
        "cuisine": "Peranakan / Nasi Lemak",
        "menu_price": "Signature: Signature Ayam Goreng Berempah Nasi Lemak | Menu: Ayam Goreng Nasi Lemak, Beef Rendang, Otah, Chendol | Price: SGD 18.00–28.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6631 8520",
        "website": "https://thecoconutclub.sg/"
    },
    "CE15J69L000": {
        "name": "National Kitchen by Violet Oon",
        "hours": "Daily 12:00–15:00, 18:00–22:30",
        "cuisine": "Peranakan Fine Dining",
        "menu_price": "Signature: Beef Rendang & Dry Laksa | Menu: Kuay Pie Tee, Dry Laksa, Buah Keluak Ayam, Chap Chye | Price: SGD 22.00–48.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 9834 9935",
        "website": "https://violetoon.com/"
    },
    "W03274N000": {
        "name": "Herbivore Japanese Vegetarian",
        "hours": "Daily 11:30–14:30, 17:30–21:30",
        "cuisine": "Japanese Vegetarian",
        "menu_price": "Signature: Vegan Sushi & Bento | Menu: Vegan Salmon Sashimi, Unagi Bento, Teriyaki Chicken Set, Tempura Udon | Price: SGD 12.00–25.00",
        "halal": "No", "vegan": "Yes",
        "contact": "+65 6333 1612",
        "website": "https://herbivore.sg/"
    },
    "S96058J000": {
        "name": "The Roti Prata House",
        "hours": "Sun–Thu 07:00–02:00; Fri–Sat 07:00–04:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Crispy Coin Prata & Bomb Kaya Prata | Menu: Crispy Plain Prata, Egg Onion Prata, Mutton Murtabak, Maggi Goreng | Price: SGD 1.30–8.00",
        "halal": "Yes", "vegan": "No",
        "contact": "+65 6459 5260"
    },
    "B03004E000": {
        "name": "Springleaf Prata Place (Thong Soon)",
        "hours": "Daily 08:00–23:00",
        "cuisine": "Indian Muslim",
        "menu_price": "Signature: Murtaburger & Prata Alfredo | Menu: Coin Prata with Fish Curry, Murtaburger, Plaster Blaster, Teh Tarik | Price: SGD 1.50–9.80",
        "halal": "Yes", "vegan": "No",
        "contact": "+65 6458 8779",
        "website": "https://spplace.com/"
    },
    "C00020B000": {
        "name": "Al-Azhar Eating Restaurant",
        "hours": "Daily 24 Hours",
        "cuisine": "Indian Muslim / Mamak",
        "menu_price": "Signature: Butter Chicken Naan & Maggi Pattaya | Menu: Garlic Naan, Butter Chicken, Roti John, Murtabak, Nasi Goreng USA | Price: SGD 2.00–12.00",
        "halal": "Yes", "vegan": "No",
        "contact": "+65 6466 5052"
    },
    "CE05500P000": {
        "name": "Keng Eng Kee Seafood (Alexandra)",
        "hours": "Daily 11:30–14:00, 17:00–22:00",
        "cuisine": "Zi Char",
        "menu_price": "Signature: Moonlight Hor Fun & Coffee Pork Ribs | Menu: Moonlight Hor Fun, Coffee Pork Ribs, Mingzhu Roll, Claypot Pig Liver | Price: SGD 10.00–35.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6272 1038",
        "website": "https://kek.com.sg/"
    },
    "CE09G22P000": {
        "name": "Kok Sen Restaurant",
        "hours": "Tue–Sun 12:00–14:15, 17:30–20:45; Mon: Closed",
        "cuisine": "Cantonese Zi Char",
        "menu_price": "Signature: Big Prawn Crispy Noodles | Menu: Big Prawn Bee Hoon, Claypot Yong Tau Foo, Black Pepper Beef | Price: SGD 18.00–45.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6223 2005"
    },
    "CE15N69K000": {
        "name": "Founder Bak Kut Teh",
        "hours": "Tue–Sun 09:00–05:00; Mon: Closed",
        "cuisine": "Teochew Bak Kut Teh",
        "menu_price": "Signature: Peppery Founder Pork Ribs Soup | Menu: Premium Ribs Soup, Braised Pig's Trotter, You Tiao, Salted Vegetables | Price: SGD 9.80–18.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6352 6192",
        "website": "https://founderbakkutteh.com/"
    },
    "CE13M16N000": {
        "name": "Song Fa Bak Kut Teh",
        "hours": "Daily 10:30–21:00",
        "cuisine": "Teochew Bak Kut Teh",
        "menu_price": "Signature: Peppery Bak Kut Teh with Free Soup Refills | Menu: Pork Ribs Soup, Tender Sliced Pork Soup, Braised Pork Belly, Dough Fritters | Price: SGD 8.50–15.00",
        "halal": "No", "vegan": "No",
        "website": "https://songfa.com.sg/"
    },
    "CE15G87C000": {
        "name": "Odette",
        "hours": "Tue–Sat 12:00–13:15, 18:30–20:15; Sun–Mon: Closed",
        "cuisine": "Modern French Fine Dining",
        "menu_price": "Signature: 3-Michelin-Starred Degustation Menu | Menu: Multi-Course Modern French Tasting Menu | Price: SGD 350.00–498.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6385 0498",
        "website": "https://www.odetterestaurant.com/"
    },
    "W94340N000": {
        "name": "Les Amis",
        "hours": "Mon–Sun 12:00–14:00, 18:30–21:00",
        "cuisine": "Classic French Fine Dining",
        "menu_price": "Signature: 3-Michelin-Starred French Haute Cuisine | Menu: Classic French Degustation Menu | Price: SGD 325.00–460.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6733 2225",
        "website": "https://www.lesamis.com.sg/"
    },
    "CE16I63A000": {
        "name": "Candlenut",
        "hours": "Daily 12:00–15:00, 18:00–22:00",
        "cuisine": "Peranakan Fine Dining",
        "menu_price": "Signature: Michelin Star Ah-ma-kase Menu | Menu: Wagyu Beef Rendang, Blue Swimmer Crab Curry, Babi Pongteh | Price: SGD 35.00–128.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6474 1300",
        "website": "https://www.comodining.sg/candlenut"
    },
    "W02380V000": {
        "name": "Restaurant Labyrinth",
        "hours": "Wed–Sun 12:00–14:30, 18:30–23:00; Mon–Tue: Closed",
        "cuisine": "New Singaporean Fine Dining",
        "menu_price": "Signature: Michelin Star Mod-Sin Tasting Menu | Menu: Chilli Crab Ice Cream, Hainanese Chicken Rice Interpretation | Price: SGD 208.00–298.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6223 4098",
        "website": "https://www.restaurantlabyrinth.com/"
    },
    "CE19D64C000": {
        "name": "Cloudstreet",
        "hours": "Tue–Sat 12:00–15:00, 18:30–23:00; Sun–Mon: Closed",
        "cuisine": "2-Michelin-Starred Contemporary",
        "menu_price": "Signature: Progressive Tasting Menu | Menu: Multi-Course Seasonal Tasting Menu | Price: SGD 248.00–398.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6513 7868",
        "website": "https://cloudstreet.com.sg/"
    },
    "CE14369E000": {
        "name": "Shinji by Kanesaka",
        "hours": "Tue–Sat 12:00–15:00, 18:00–22:30; Sun–Mon: Closed",
        "cuisine": "Edomae Sushi Fine Dining",
        "menu_price": "Signature: Michelin Star Edomae Omakase | Menu: Seasonal Omakase Nigiri Sushi, Sashimi & Cooked Dishes | Price: SGD 250.00–550.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6338 6131",
        "website": "https://www.shinjibykanesaka.com/"
    },
    "W03361X000": {
        "name": "Nae:um",
        "hours": "Tue–Sat 18:00–22:30; Sun–Mon: Closed",
        "cuisine": "Contemporary Korean Fine Dining",
        "menu_price": "Signature: Michelin Star Episodic Korean Tasting Menu | Menu: Episodic Contemporary Korean Tasting Menu | Price: SGD 198.00–258.00",
        "halal": "No", "vegan": "No",
        "contact": "+65 6327 8338",
        "website": "https://www.naeum.sg/"
    },
}

def main():
    try:
        from scripts.round8_hawker_data import NEW_HAWKER_ENTRIES
        HAWKER_REGISTRY.update(NEW_HAWKER_ENTRIES)
        print(f"Loaded {len(NEW_HAWKER_ENTRIES)} entries from round8_hawker_data")
    except ImportError:
        try:
            from round8_hawker_data import NEW_HAWKER_ENTRIES
            HAWKER_REGISTRY.update(NEW_HAWKER_ENTRIES)
            print(f"Loaded {len(NEW_HAWKER_ENTRIES)} entries from round8_hawker_data")
        except Exception as e:
            print("Notice: round8_hawker_data not loaded:", e)

    try:
        from scripts.round9_hawker_data import NEW_HAWKER_ENTRIES_ROUND9
        HAWKER_REGISTRY.update(NEW_HAWKER_ENTRIES_ROUND9)
        print(f"Loaded {len(NEW_HAWKER_ENTRIES_ROUND9)} entries from round9_hawker_data")
    except ImportError:
        try:
            from round9_hawker_data import NEW_HAWKER_ENTRIES_ROUND9
            HAWKER_REGISTRY.update(NEW_HAWKER_ENTRIES_ROUND9)
            print(f"Loaded {len(NEW_HAWKER_ENTRIES_ROUND9)} entries from round9_hawker_data")
        except Exception as e:
            print("Notice: round9_hawker_data not loaded:", e)

    try:
        from scripts.round10_hawker_data import NEW_LICENCE_ENTRIES_ROUND10
        LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND10)
        print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND10)} entries from round10_hawker_data")
    except ImportError:
        try:
            from round10_hawker_data import NEW_LICENCE_ENTRIES_ROUND10
            LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND10)
            print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND10)} entries from round10_hawker_data")
        except Exception as e:
            print("Notice: round10_hawker_data not loaded:", e)

    try:
        from scripts.round11_hawker_data import NEW_LICENCE_ENTRIES_ROUND11
        LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND11)
        print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND11)} entries from round11_hawker_data")
    except ImportError:
        try:
            from round11_hawker_data import NEW_LICENCE_ENTRIES_ROUND11
            LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND11)
            print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND11)} entries from round11_hawker_data")
        except Exception as e:
            print("Notice: round11_hawker_data not loaded:", e)

    try:
        from scripts.round12_hawker_data import NEW_LICENCE_ENTRIES_ROUND12
        LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND12)
        print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND12)} entries from round12_hawker_data")
    except ImportError:
        try:
            from round12_hawker_data import NEW_LICENCE_ENTRIES_ROUND12
            LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND12)
            print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND12)} entries from round12_hawker_data")
        except Exception as e:
            print("Notice: round12_hawker_data not loaded:", e)

    try:
        from scripts.round13_hawker_data import NEW_LICENCE_ENTRIES_ROUND13
        LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND13)
        print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND13)} entries from round13_hawker_data")
    except ImportError:
        try:
            from round13_hawker_data import NEW_LICENCE_ENTRIES_ROUND13
            LICENCE_REGISTRY.update(NEW_LICENCE_ENTRIES_ROUND13)
            print(f"Loaded {len(NEW_LICENCE_ENTRIES_ROUND13)} entries from round13_hawker_data")
        except Exception as e:
            print("Notice: round13_hawker_data not loaded:", e)

    csv_path = "data/Hungry_Database_Food_Only_2026-10-21.csv"
    xlsx_path = "data/Hungry_Database_Food_Only_2026-10-21.xlsx"

    with open(csv_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        rows = list(reader)

    print(f"Total rows read: {len(rows)}")
    applied_count = 0

    for r in rows:
        post = r.get("Postal Code", "").strip().zfill(6)
        addr = r.get("Full Address", "").strip()
        unit = extract_stall_num(addr)
        
        lic = r.get("SFA Licence", "").strip()
        key = (post, unit)
        data = None
        if lic in LICENCE_REGISTRY:
            data = LICENCE_REGISTRY[lic]
        elif key in HAWKER_REGISTRY:
            data = HAWKER_REGISTRY[key]

        if data:
            
            # 1. Update F&B Name if blank or if data['name'] is more accurate
            current_name = r.get("F&B Name", "").strip()
            if not current_name or len(current_name) < 4 or any(g in current_name.upper() for g in ["INDIAN CUISINE", "SOMERSET", "DELICACIES", "DRINKS", "FOOD", "STALL"]):
                r["F&B Name"] = data["name"]
            elif current_name.upper() == data["name"].upper():
                r["F&B Name"] = data["name"]

            # 2. Opening hours
            r["Opening Hours / Closed Days"] = data["hours"]

            # 3. Cuisine
            r["Cuisine"] = data["cuisine"]

            # 4. Menu / Price
            r["Menu / Price"] = data["menu_price"]

            # 5. Halal Certified
            r["Halal Certified"] = data["halal"]

            # 6. Vegan
            r["Vegan"] = data["vegan"]

            # 7. Contact Details
            if "contact" in data and not r.get("Contact Details", "").strip():
                r["Contact Details"] = data["contact"]

            # 8. Website
            if "website" in data and not r.get("Website", "").strip():
                r["Website"] = data["website"]

            applied_count += 1

    print(f"Enriched famous hawker stalls: {applied_count}")

    # Write back to CSV
    with open(csv_path, mode="w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved updated CSV to {csv_path}")

    # Write back to XLSX
    print(f"Updating XLSX at {xlsx_path}...")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Public F&B Directory"
    ws.append(fieldnames)
    for r in rows:
        ws.append([r.get(fn, "") for fn in fieldnames])
    wb.save(xlsx_path)
    print("XLSX updated successfully.")

if __name__ == "__main__":
    main()
