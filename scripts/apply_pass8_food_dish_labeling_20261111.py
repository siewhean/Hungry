#!/usr/bin/env python3
"""
Pass 8 — Canonical Searchable Food & Dish Type Labeling + Dish Taste Palette (6-Axis Vector & Tags)
===================================================================================================
1. Labels 100% of active verified rows in `Menu & Price` (`Col 6: Category / Section`)
   with canonical, user-searchable Singapore food and dish labels (e.g. `Chicken Rice`,
   `Laksa`, `Nasi Lemak`, `Wanton Mee`, `Bak Chor Mee & Fishball Noodles`,
   `Ban Mian & La Mian`, `Hokkien Mee`, `Char Kway Teow`, `Prawn Noodles`, `Fish Soup`,
   `Bak Kut Teh`, `Roti Prata, Thosai & Murtabak`, `Biryani`, etc.).
2. Adds Dish Taste Palette columns to `Menu & Price` (`Col 29` to `Col 35`):
   - `Col 29: Taste Palette` (descriptive culinary & Singapore hawker taste tags per dish)
   - `Col 30: Sweet` (0–10)
   - `Col 31: Spicy` (0–10)
   - `Col 32: Sour` (0–10)
   - `Col 33: Salty` (0–10)
   - `Col 34: Rich` (0–10)
   - `Col 35: Aromatic` (0–10)
   computed per dish from its food category baseline + dish-name/description culinary modifiers.
3. Enriches `Food Directory` (`Col 7: Cuisine` and `Col 26: Secondary Categories`) across
   41,627 active stalls using exact `SFA Licence` and `F&B Name` dish matching so stalls with
   broad umbrella tags (`Local / Hawker Delights`, `Chinese`, `Local & Multi-Cuisine`, etc.)
   are upgraded to their specific searchable food/dish specialty (`Chicken Rice`, `Laksa`,
   `Nasi Lemak`, etc.) and carry their dish specialties in `Secondary Categories`.
"""
import argparse
import csv
import hashlib
import os
import re
import shutil
import sys
import time
import zipfile
from collections import Counter, defaultdict
import openpyxl

WB_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass8_food_labeling_2026-11-11.xlsx"
MANIFEST_CSV = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/change_manifest_pass8_2026-11-11.csv"

BEVERAGE_LABELS = {
    "Bubble Tea, Milk Tea & Teh",
    "Coffee & Kopi",
    "Juices, Smoothies & Shakes",
    "Tea & Herbal Drinks",
    "Soft Drinks & Water",
    "Beer, Wine & Spirits",
}

BROAD_DIRECTORY_CUISINES = {
    "local / hawker delights",
    "local & multi-cuisine",
    "chinese",
    "singaporean",
    "local hawker, chinese noodles",
    "chinese, noodles",
    "chinese, rice dishes",
    "chinese, traditional & soup",
    "chinese, singaporean",
    "chinese, seafood",
    "chinese, soups",
    "asian & international dining",
    "asian, noodles",
    "western",
    "western & european",
    "indian",
    "malay",
    "malay / indonesian & halal",
    "japanese",
    "korean",
    "thai",
    "vietnamese",
    "indonesian",
    "beverages",
    "drinks and coffee",
    "cafe & coffee",
    "cafe & beverages",
    "bakery",
    "bakery & pastry",
    "bakery, desserts & local toast",
    "desserts",
    "snacks & light bites",
    "fast food",
    "cafe & brunch",
    "seafood",
    "noodles",
    "halal",
    "vegetarian",
    "food court",
    "hawker",
    "restaurant",
    "bar, pub & bistro",
}

RULES = [
    # 1. Iconic Singapore Hawker & Local Rice / Noodle Dishes
    ("Chicken Rice", re.compile(r"\b(chicken rice|hainanese chicken|steamed chicken|poached chicken|roasted? chicken|soy sauce chicken|soya sauce chicken|kampong chicken|white cut chicken|chicken drumstick rice|chicken thigh rice|chicken breast rice|chicken wing rice|half chicken|whole chicken|lemon chicken rice|thai style chicken rice|boneless chicken rice|chicken cutlet rice|emperor herbal chicken|duo chicken|abang gemuk|tian tian hainanese|boon tong kee|nam kee chicken|tong fong fatt|ming kee chicken)\b|白切鸡|烧鸡|油鸡|海南鸡|鸡饭|药材皇帝鸡", re.I)),
    ("Laksa", re.compile(r"\b(laksa|katong laksa|assam laksa|asam laksa|sarawak laksa|curry laksa|laksa yong tau foo|nyonya laksa|janggut laksa|sungei road laksa|328 katong)\b|叻沙", re.I)),
    ("Nasi Lemak", re.compile(r"\b(nasi lemak|coconut rice|crave|ponggol nasi lemak|boon lay power|mizzy corner|selera rasa|chong pang nasi lemak)\b|椰浆饭", re.I)),
    ("Wanton Mee", re.compile(r"\b(wanton mee|wonton mee|wanton noodles?|wonton noodles?|wantan mee|wantan noodles?|dumpling noodles?|shui jiao noodles?|shui jiao mee|sui kow noodles?|char siew wanton|pontian wanton|eng.?s wanton|kok kee wanton|ji ji wanton)\b|云吞面|水饺面", re.I)),
    ("Bak Chor Mee & Fishball Noodles", re.compile(r"\b(bak chor mee|minced meat noodles?|minced pork noodles?|bcm|fishball noodles?|fish ball noodles?|fishball mee|fishball kway teow|fishball bee hoon|mee pok|mee kia|teochew noodles?|fish dumpling noodles?|her kiao|fish maw noodles?|mushroom minced meat|fishballs?|fish balls?|meatballs? soup|ah ma chi mian|tai wah|song fa fishball|ming fa|li xin|thye hong|ru ji)\b|肉脞面|鱼圆面|鱼丸面|面薄|面仔", re.I)),
    ("Ban Mian & La Mian", re.compile(r"\b(ban mian|banmian|you mian|youmian|ee mian|eemian|yi mian|yee mian|ee mee|dai lok mee|mee sua|ke kou mian|koka noodles?|mee hoon kueh|mhk|hand[- ]?made noodles?|hand[- ]?pulled noodles?|knife[- ]?shaved noodles?|dao xiao mian|la mian|lamian|dan dan mian|dan dan noodles?|zha jiang mian|biang biang|beef la mian|sichuan noodles?|chongqing noodles?|suan la fen|hot and sour noodles?|dry tossed noodles?|qiu lian|poon nah city)\b|板面|幼面|伊面|面粉粿|面线|大碌面|拉面|刀削面|担担面|炸酱面|酸辣粉", re.I)),
    ("Hokkien Mee", re.compile(r"\b(hokkien mee|hokkien prawn mee|fried hokkien|hokkien noodles?|kl hokkien|white hokkien|nam sing|geylang lor 29|come daily|xiao di|swee guan)\b|福建面|福建虾面", re.I)),
    ("Char Kway Teow", re.compile(r"\b(char kway teow|char kuay teow|fried kway teow|fried kuay teow|cockles kway teow|penang char kway teow|ckt|hill street fried kway teow|outram park fried kway teow|no\.? 18 zion road|meng记)\b|炒粿条", re.I)),
    ("Prawn Noodles", re.compile(r"\b(prawn mee|prawn noodles?|hae mee|har mee|pork rib prawn|big prawn noodles?|jumbo prawn noodles?|king prawn noodles?|lobster prawn|blanco court prawn|beach road prawn|whitley road big prawn|da dong prawn)\b|虾面|排骨虾面", re.I)),
    ("Lor Mee", re.compile(r"\b(lor mee|braised noodles?|xin mei xiang|fengshan lor mee|178 lor mee|yuan chun)\b|卤面", re.I)),
    ("Kway Chap", re.compile(r"\b(kway chap|kuay chap|braised pig organ|pig.?s? organ|braised large intestine|braised pig.?s? trotter|pickled pig trotters?|braised meat platter|blanco court kway chap|garden street kway chap|to-ricos)\b|粿汁|卤猪脚|卤大肠|卤味", re.I)),
    ("Beef Noodles", re.compile(r"\b(beef noodles?|beef kway teow|beef hor fun|beef horfun|beef brisket noodles?|beef tendon noodles?|beef ball noodles?|taiwanese beef noodles?|sliced beef noodles?|stewed beef noodles?|seremban beef|beef brisket w/ radish|hock lam beef|hai nan xing zhou|authentic hock lam)\b|牛肉面|牛腩面|牛河|萝卜牛腩", re.I)),
    ("Mee Rebus, Mee Soto & Mee Siam", re.compile(r"\b(mee rebus|mi rebus|mee soto|mi soto|soto ayam|mee siam|mi siam|lontong|mee goreng mamak|maggi goreng|indian mee goreng|mamak mee|bee hoon soto|kway teow soto|indomie|indo mee|maggi|hj waliti|inspirasi)\b", re.I)),
    ("Yong Tau Foo", re.compile(r"\b(yong tau foo|yong tau fu|yong tahu|ytf|ampong yong tau foo|hakka yong tau foo|stuffed tofu|stuffed bean ?curd|cheong fun ytf|koo kee|fu lin|xiu ji|bai nian|my favourite cafe)\b|酿豆腐", re.I)),
    ("Duck Rice & Braised Duck", re.compile(r"\b(duck rice|braised duck|roast(ed)? duck|peking duck|teochew duck|herbal duck|marinated duck|duck noodles?|duck kway teow|duck porridge|duck leg|duck drumstick|duck wing|duck head|duck web|duck gizzard|boneless duck|smoked duck|yu kee|chuan kee|jin ji|ah xiao|heng gi|sia kee)\b|鸭饭|卤鸭|烧鸭|卤水鸭", re.I)),
    ("Char Siew & Roast Meat", re.compile(r"\b(char siew|char siu|siew yoke|siu yuk|roast(ed)? pork|crispy pork belly|roast meat|suckling( roasted)? pig|bbq pork|cantonese roast|three treasure rice|triple roast|dual roast|lechon|crispy pata|kay lee|foong kee|fatty cheong|88 hong kong roast)\b|叉烧|烧肉|烧腊|乳猪", re.I)),
    ("Carrot Cake (Chye Tow Kway)", re.compile(r"\b(fried carrot cake|chye tow kway|chai tow kway|black carrot cake|white carrot cake|carrot cake \(black|carrot cake \(white|xo carrot cake|radish cake|turnip cake|heng carrot cake|chey sua|fu ming|song zhou|ghim moh carrot cake)\b|菜头粿|萝卜糕", re.I)),
    ("Satay & Otah", re.compile(r"\b(satays?|satay bee hoon|ketupat|otah|otak[- ]?otak|haron satay|chuan kee satay|lau pa sat satay|lee wee)\b|沙爹|乌达", re.I)),
    ("Rojak & Popiah", re.compile(r"\b(rojak|indian rojak|penang rojak|fruit rojak|popiah|kueh pie tee|pie tee|muah chee|balestier rojak|soon heng rojak|ann chin popiah|qiji)\b|罗惹|薄饼|麻糍", re.I)),
    ("Oyster Omelette (Orh Luak)", re.compile(r"\b(oyster omelette|orh luak|oh luak|fried oyster|oyster egg|lim.?s fried oyster|huat heng|ang sa lee)\b|蚝煎|蚝烙", re.I)),
    ("Fish Soup", re.compile(r"\b(fish soup|sliced fish|fried fish soup|batang fish|red grouper|promfret|pomfret|fish head bee hoon|fish bee hoon|fish porridge|double fish|bittergourd fish|fish maw soup|seafood soup|fish head steamboat|han kee|blanco court fish|piao ji|arcade fish soup|first street teochew)\b|鱼汤|鱼片汤|鱼头米粉", re.I)),
    ("Bak Kut Teh", re.compile(r"\b(bak kut teh|pork rib soup|bkt|peppery pork|herbal bak kut teh|klang bak kut teh|dry bak kut teh|pig trotter|braised pork trotter|pig stomach soup|pig kidney|song fa|ng ah sio|founder bak kut teh|ya hua|legendary bak kut teh|outram park ya hua|tuan yuan)\b|肉骨茶|猪肚汤", re.I)),
    ("Claypot Rice & Dishes", re.compile(r"\b(claypot|clay pot|sapo|lian he ben ji|new lucky claypot|geylang claypot)\b|砂煲|瓦煲", re.I)),
    ("Porridge & Congee", re.compile(r"\b(porridge|congee|teochew muay|frog porridge|century egg porridge|pork porridge|chicken porridge|bubur|zhen zhen|ah chiang|soon lee porridge|eminent frog|geylang lor 9)\b|粥|田鸡粥", re.I)),
    ("Thunder Tea Rice (Lei Cha)", re.compile(r"\b(thunder tea|lei cha|hakka lei cha|sunnychoice)\b|擂茶", re.I)),

    # 2. Chinese / Zi Char / Mala / Hotpot / Dim Sum
    ("Mala Xiang Guo & Sichuan", re.compile(r"\b(ma ?la|mala xiang guo|mala tang|malatang|sichuan|szechuan|chongqing|laziji|la zi ji|boiled fish|shui zhu|suan cai yu|sauerkraut fish|grilled fish|kao yu|mapo tofu|ma po tofu|fuqi feipian|mouth[- ]?water(ing|y) chicken|kou shui ji|pickled fish|northeast barbecue|skewers?|chuanr?|lamb skewer|beef skewer|pork belly skewer|enoki mushroom|grilled eggplant|grilled chives|grilled taiwan sausage|grilled chicken gizzard|crawfish|pickled pepper frog|salt & pepper frog|ginger & scallion frog|a hot hideout|6ix 6ix|ri ri hong|wan xing|chuan grill|tai er)\b|麻辣|川菜|酸菜鱼|烤鱼|水煮|辣子鸡|口水鸡|小龙虾|泡椒田鸡|东北烧烤", re.I)),
    ("Hotpot & Steamboat", re.compile(r"\b(hot ?pot|steamboat|shabu[- ]?shabu|sukiyaki|suki[- ]?ya|mookata|soup base|collagen soup|lok lok|skewer pot|poon cai|haidilao|hai di lao|beauty in the pot|shi li fang|city hot pot|coucou|little sheep)\b|火锅|盆菜|刷刷锅", re.I)),
    ("Dim Sum & Dumplings", re.compile(r"\b(dim sum|dimsum|har gow|har gao|ha kau|siew mai|siu mai|xiao long bao|xlb|cheong fun|rice rolls?|char siew bao|liu sha bao|salted egg bun|steamed buns?|pau|baozi|mantou|gyoza|potstickers?|guotie|dumplings?|shui jiao|wanton soup|wonton soup|wantons?|wontons?|lo mai gai|glutinous|spring rolls?|samosas?|wu kok|yam ring|beancurd skin rolls?|phoenix claw|chicken feet|spare ribs?|custard bun|lotus bun|red bean bun|big pau|tau sar pau|ngo hiang|ngor hiang|prawn roll|hae zho|five spice|din tai fung|swee choon|tim ho wan|victor.?s kitchen|crystal jade|paradise dynasty|nam kee pau|teck kee tanglin)\b|点心|虾饺|烧卖|小笼包|肠粉|包点|糯米鸡|云吞|锅贴|春卷|五香", re.I)),
    ("Zi Char & Seafood", re.compile(r"\b(zi char|zhi char|tze char|chilli crab|black pepper crab|salted egg crab|crab bee hoon|cereal prawns?|butter prawns?|har lok|sambal stingray|steamed stingray|bbq stingray|stingray|sambal sotong|sambal kangkong|kangkong|coffee pork|sweet and sour|gu lou yuk|pork rib king|champagne pork|moonlight hor fun|san lou|wat tan|mui fan|mui fun|hui fan|sheng mian|crispy noodles?|ee fu|yi fu|la la|lala|clams?|gong gong|crayfish|sea cucumber|abalone|broccoli|scallops?|four heavenly king|mixed bean|french beans?|spinach|bean ?curd|tofu|toufu|hotplate|hot plate|sizzling|deer meat|venison|frog legs?|curry fish head|assam fish head|steamed fish|seabass|siakap|soon hock|garoupa|grouper|snapper|tilapia|cod fish|pating fish|mackerel|fried calamari|sotong|squid|prawn paste chicken|har cheong gai|oyster sauce|kai lan|kailan|xiao bai cai|baby cabbage|cabbage|bitter ?gourd|lady.?s? finger|okra|brinjal|eggplant|luffa|loofah|beansprouts?|taugeh|omelette|fu yong|fuyong|steamed egg|braised egg|minced pork|minced meat|black pepper|ginger & onion|ginger and spring onion|onion & ginger|kung pao|kungpo|gong bao|cashew nut|almond chicken|lemon chicken|salted egg|cereal fish|cereal chicken|yam basket|chili chicken|chilli chicken|chili fish|ginger chili|stir[- ]?fried|stir fry|mixed vegetables?|seasonal vegetables?|luo han|lo han chye|chap chai|salted vegetables?|braised peanuts?|braised groundnuts?|fried egg|century eggs?|salted fish|petai|sambal|assam|asam|kam heong|mongolian|thai style|sweet spicy|three cup|san bei|dried chilli|spring onion|garlic|butter|cream sauce|white pepper|crab|lobster|prawns?|shrimps?|mussels?|cockles?|hum|chut chut|shellout|fish maw|fish head|fish fillet|dory fish|sliced beef|sliced pork|pork slice|pork belly|diced chicken|drunken chicken|golden phoenix chicken|shark.?s? fin|yusheng|asparagus|52 seafood|21 seafood|yi pin xiang|a kitchen|57 eatery|89\.7 supper|jumbo seafood|imperial treasure|mackenzie rex|zi yean|siong bbq|28 bbq|401 hougang|new fut kai|150 green vegetarian|keng eng kee|kok sen|jb ah meng|two chefs|mellben|no signboard|putien)\b|煮炒|家常小炒|海鲜|蔬菜|时蔬|罗汉斋|四大天王|鱼片|巴丁鱼|鲍翅|捞鱼生|烧烤套餐|卤蛋|咸菜|花生", re.I)),

    # 3. Indian / Mamak / Malay / Indonesian / Middle Eastern
    ("Roti Prata, Thosai & Murtabak", re.compile(r"\b(prata|roti prata|murtabak|thosai|dosai|dosa|idli|idly|vadai|vada|uttapam|appam|putu mayam|roti john|chapati|chappathi|poori|puri|bhatura|parotta|kothu|coin prata|plaster|tissue prata|uthappam|pongal|upma|uppuma|rava|masala thosai|paper thosai|ghee|oothappam|springleaf prata|casuarina curry|mr and mrs mohgan|sin ming roti prata|zam zam|victory restaurant)\b", re.I)),
    ("Biryani", re.compile(r"\b(briyani|biryani|dum biryani|hyderabadi|bamboo biryani|pulao|pilaf|jeera rice|ghee rice|kushka|kuska|saffron rice|basmati|tamarind rice|bismillah|allabbak|yakader|hamidiyah)\b", re.I)),
    ("Indian Curry, Naan & Tandoori", re.compile(r"\b(tandoori|tikka|masala|butter chicken|makhani|palak|paneer|vindaloo|korma|kurma|rogan josh|dal |dhal|daal|chana|rajma|aloo|gobi|bhindi|baingan|keema|mutton mysore|chicken 65|manchurian|naan|kulcha|roti |papadum|papad|raita|lassi|gulab jamun|rasmalai|jalebi|laddu|barfi|halwa|payasam|kheer|kulfi|thali|chettinad|madras|fish head curry|mutton curry|chicken curry|prawn curry|egg curry|mushroom curry|fish curry|curry sauce|chicken varuval|varuval|peratal|masala chicken|do piaza|do piyaza|jalfrezi|jalfrezie|saag|gosht|kadai|karahi|kadhai|kashmiri|amritsari|goan|mughlai|peshawari|peshawar|hundi|seekh|hariyali|malai|achari|afghani|reshmi|tangdi|pakora|bhaji|bonda|bajji|chaat|pani puri|bhel|sev|pav bhaji|vada pav|chole|mattar|methi|kebab|sizzler|indian|tangra|a2b|al amaan|al barakaath|brindas|ananda bhavan|abc d corner|hannan mannal|komala|muthu.?s|banana leaf apolo|samymuthu|saravanaa|kailash parbat|puli kulambu|muruku|chicken meal|fish meal|mutton meal|veg meal)\b", re.I)),
    ("Ayam Penyet & Ayam Bakar", re.compile(r"\b(ayam penyet|ayam geprek|ayam bakar|ayam goreng|ayam taliwang|bebek goreng|bebek bakar|ikan bakar|ikan penyet|pecel lele|empal|tahu telor|gado[- ]?gado|indonesian|indo |bawal|udang penyet|sambal ijo|sambal belacan|sotong bakar|udang bakar|kerang bakar|ria ayam penyet|president ayam penyet|uncle penyet|d.?penyetz)\b", re.I)),
    ("Nasi Padang & Malay Dishes", re.compile(r"\b(nasi padang|nasi ambeng|nasi campur|nasi goreng|nasi rawon|nasi kerabu|nasi dagang|nasi ayam|nasi sambal|rendang|beef rendang|mutton rendang|ayam masak merah|asam pedas|sayur lodeh|sambal goreng|begedil|bergedil|paru|babat|limpa|serunding|lemak cili padi|masak lemak|opor|gulai|dendeng|sambal tumis|kampung|rasa istimewa|salmaan|sabar menanti|warong nasi pariaman|hajjah maimunah|ruma makan minang|sinar pagi|kway teow goreng|bihun goreng|mee hong kong|mee bandung|mee hailam|mee pataya|nasi paprik|paprik|nasi pattaya|nasi usa|tomyam campur|sup ayam|sup daging|sup campur|telur dadar|telur mata|kailan ikan masin|halia|kunyit|3 rasa|kare kare)\b", re.I)),
    ("Sup Tulang & Mutton Soup", re.compile(r"\b(sup tulang|tulang merah|gearbox|sup kambing|mutton soup|kambing soup|sup ekor|oxtail soup|sup buntut|soto|mutton stomach|bahrakath|haji m abdul)\b", re.I)),
    ("Kebab, Shawarma & Middle Eastern", re.compile(r"\b(kebabs?|kebaba|shawarma|falafel|hummus|pita|baba ?ganoush|babaganush|muttabbale|tabbouleh|kofta|shish|shaslik|boti|mandi|kabsa|kunafa|baklava|turkish|lebanese|mediterranean|arab|greek|gyro|souvlaki|mezze|halloumi|moussaka|tagine|couscous|bar\.?b ?q tonight|476 istanbul|epikebab|shiraz|alaturka)\b", re.I)),

    # 4. General Chinese Rice & Noodles
    ("Hor Fun, Bee Hoon & Fried Noodles", re.compile(r"\b(bee hoon|beehoon|bihun|vermicelli|mee hoon|kway teow|kuay teow|hor fun|horfun|hofun|mee goreng|fried noodles?|chow mein|lo mein|hong kong noodles?|hk noodles?|tang hoon|glass noodles?|silver needle|laksa goreng|xingzhou|sin chew|xinghua|vegetarian bee hoon|economic bee hoon|economy bee hoon|fried bee hoon|seafood noodles?|noodle soup|dry noodles?|laifen|rice noodles?|mixian|mi xian|crossing bridge|yunnan noodles?|guilin noodles?|hakka noodles?|noodles?)\b|河粉|米粉|炒面|面条|老鼠粉|米线", re.I)),
    ("Fried Rice", re.compile(r"\b(fried rice|fried ri\b|yang chow|yangzhou|kampong fried rice|sambal fried rice|salted fish fried rice|xo fried rice|egg fried rice|pineapple fried rice|kimchi fried rice|garlic fried rice|chaulafan|chahan|yakimeshi|olive fried rice|tom yum fried rice|king of fried rice|wok hey)\b|炒饭", re.I)),
    ("Curry Rice", re.compile(r"\b(curry rice|hainanese curry|scissor[- ]?cut|scissors[- ]?cut|katsu curry|japanese curry|curry chicken rice|curry pork rice|curry pork chop|curry cutlet|curry chicken|curry diced chicken|curry pork|loo.?s hainanese|beo crescent curry|beach road scissor)\b|咖喱饭|咖喱猪肉饭|咖喱鸡", re.I)),
    ("Economy & Mixed Veg Rice", re.compile(r"\b(cai png|cai fan|mixed veg(etable)? rice|econom(y|ic) rice|chap chye|luo han zhai|braised pork belly rice|lu rou fan|kong bak|mui fan|rice with|w/ rice|steamed rice|white rice|brown rice|fragrant rice|plain rice|jasmine rice|rice set|bento set|meal box|value meal)\b|饭类|盖饭|套餐|卤肉饭|经济饭|杂菜饭", re.I)),
    ("Traditional & Herbal Soups", re.compile(r"\b(herbal soup|tonic soup|double[- ]?boiled|lotus root soup|abc soup|watercress soup|old cucumber soup|winter melon soup|black chicken soup|ginseng chicken|cordyceps|buddha jump|ten tonic|imperial soup|pork rib soup|mutton soup|chicken soup|pig.?s? organ soup|salted vegetable soup|seaweed soup|tofu soup|egg drop soup|soup|soup spoon|lao huo tang|ah er herbal)\b|炖汤|老火汤|药材汤", re.I)),

    # 5. Japanese / Korean / Thai / Vietnamese
    ("Ramen", re.compile(r"\b(ramen|tonkotsu|shoyu ramen|miso ramen|tsukemen|mazesoba|abura soba|chashu|ajitsuke|tantanmen|ippudo|ichiran|keisuke|ajisen|marutama|santouka|tsuta|bari[- ]?uma|sanpoutei|takagi ramen)\b|日式拉面", re.I)),
    ("Sushi & Sashimi", re.compile(r"\b(sushi|sashimi|maki|handrolls?|temaki|nigiri|gunkan|chirashi|california roll|salmon roll|tuna roll|unagi roll|inari|omakase|mentai|aburi|ikura|tobiko|hamachi|maguro|hotate|negitoro|kaisen|carpaccio|nama gaki|awabi|genki sushi|sushiro|sushi tei|sushi express|sakae sushi|standing sushi|itacho|ichiban boshi|ichiban sushi|sen[- ]?ryo)\b|寿司|刺身", re.I)),
    ("Donburi & Japanese Rice Bowls", re.compile(r"\b(donburi|gyudon|oyakodon|katsudon|tendon|unadon|unagi|unagiya|salmon don|bara chirashi|butadon|stamina don|chashu don|teriyaki chicken don|japanese rice|wagyu don|sukiyaki don|curry don|rice bowls?|salmon bowl|beef bowl|pork bowl|chicken bowl|lunch bowls?|\bdon\b|yakiniku|sukiya|yoshinoya|man man|hitsumabushi)\b", re.I)),
    ("Udon & Soba", re.compile(r"\b(udon|soba|cha soba|zaru soba|yaki udon|yakisoba|kitsune|kake udon|sanuki|inaniwa|marugame|tamoya|shimbashi|nadai fujisoba)\b|乌冬面|荞麦面", re.I)),
    ("Japanese Bento, Tempura & Sides", re.compile(r"\b(tempura|takoyaki|okonomiyaki|yakitori|kushiyaki|edamame|chawanmushi|agedashi|karaage|tonkatsu|katsu|ebi fry|ebi\b|croquettes?|korokke|tamagoyaki|tamago|teppanyaki|shishamo|ikayaki|miso soup|japanese|bento|onigiri|musubi|izakaya|kakushin|bonjiri|tontoro|hatsu|sunagimo|tsukune|yaki eihire|hokke|chikuwa|katsuo shuto|shishito|eringi|shiitake|shioyaki|saba fish|tonkatsu by ma maison|saboten|ginza bairin|yayoi|ootoya|tenya)\b", re.I)),
    ("Korean BBQ, Tteokbokki & Korean", re.compile(r"\b(korean|kimchi|bibimbap|tteokbokki|topokki|rabokki|bulgogi|galbi|kalbi|samgyeopsal|army stew|budae jjigae|jjigae|soondubu|sundubu|kimchi stew|ginseng chicken soup|samgyetang|japchae|kimbap|gimbap|korean fried chicken|yangnyeom|dakgalbi|jjajangmyeon|jajangmyeon|jjamppong|naengmyeon|bingsu|hotteok|corndog|k-dog|odeng|eomuk|banchan|bossam|jokbal|doenjang|gochujang|ramyeon|shin ramyun|buldak|jeon|ajumma|taste of korea|bb\.?q chicken|bonchon|chir chir|kyochon|neNe chicken|paik.?s|seoul garden)\b", re.I)),
    ("Thai Tom Yum, Pad Thai & Thai", re.compile(r"\b(thai|tom yum|tomyam|tom yam|tom kha|pad thai|phad thai|pad kra pao|basil chicken|basil pork|minced basil|green curry|red curry|panang|massaman|som tum|papaya salad|mango salad|mango sticky rice|red ruby|tub tim krob|boat noodles?|kuay teow reua|pad see ew|drunken noodles?|pad kee mao|moo ping|pandan chicken|thai fish cake|tod mun|glass noodle salad|yum woon sen|khao soi|khao kluk kapi|olive rice|thai iced|cha yen|thai milk tea|nakhon kitchen|sanook kitchen|jai thai|ah loy thai|diandin leluks|beer thai|soi 47|bangkok jam|bali thai)\b", re.I)),
    ("Vietnamese Pho & Banh Mi", re.compile(r"\b(vietnamese|pho |phở|banh mi|bánh mì|bun cha|bun bo|bun thit nuong|dry vermicelli|fresh spring rolls?|goi cuon|summer rolls?|cha gio|vietnamese drip|ca phe|banh xeo|hu tieu|mi quang|com tam|broken rice|nam nam|mrs pho|so pho|long phung|co chung|banh mi saigon)\b", re.I)),

    # 6. Western / Fast Food / Cafe
    ("Burgers", re.compile(r"\b(burgers?|cheeseburgers?|smashburgers?|whopper|mcspicy|big mac|filet[- ]?o[- ]?fish|quarter pounder|mcchicken|buttermilk crispy|zinger|double down|sliders?|patty melt|carl.?s jr|mcdonald|mos burger|shake shack|five guys|burger king|a&w|fatburger|wolf burgers?|veganburg|25 degrees|ramly)\b", re.I)),
    ("Fried Chicken & Wings", re.compile(r"\b(fried chicken|crispy chicken|spring chicken|chicken wings?|crispy wings?|fried wings?|roasted wings?|bbq wings?|suicide wings?|buffalo wings?|mid[- ]?wings?|wing stick|drumlets?|drumettes?|popcorn chicken|chicken pop ?corn|chicken poppers?|chicken tenders?|chicken nuggets?|nuggets?|mcnuggets?|mccrispy|chicken strips?|hot wings?|chicken in basket|seaweed chicken|4fingers|jollibee|chickenjoy|texas chicken|kfc|wingstop|arnold.?s|har cheong|crispy tenders|golden aroma chicken|roast chicken|rotisserie chicken|peri[- ]?peri|nando.?s|tenderfresh|tenderbest|276 f&b|popeyes|chic[- ]?a[- ]?boo)\b", re.I)),
    ("Pizza", re.compile(r"\b(pizzas?|margherita|pepperoni|hawaiian|calzone|flatbread|garlic bread|focaccia|domino.?s|in piazza|cheese volcano|pizza hut|pezzo|little caesars|canadian 2 for 1|sarpino|spizza|plank sourdough)\b", re.I)),
    ("Pasta, Lasagna & Baked Rice", re.compile(r"\b(pastas?|spaghetti|spaghettini|casarecce|linguine|fettuccine|penne|macaroni|mac & cheese|mac and cheese|fusilli|rigatoni|tagliatelle|lasagna|lasagne|ravioli|gnocchi|risotto|carbonara|bolognese|aglio olio|bacon aglio|vongole|marinara|arrabbiata|alfredo|pesto|pomodoro|baked rice|gratin|doria|saizeriya|pastamania|tipo|kucina|da paolo)\b", re.I)),
    ("Steak, Chops & Western Grill", re.compile(r"\b(steaks?|isteaks?|steakville|ribeye|rib[- ]?eye|sirloin|tenderloin|filet mignon|t[- ]?bone|tomahawk|wagyu|prime rib|rump|striploin|beef cubes?|beef bourguignon|beef stew|beef fillet|chicken chop|chicken cutlet|pork chop|iberico pork|pulled pork|pork strips?|lamb chop|lamb shank|lamb rack|baby back ribs?|pork ribs?|bbq ribs?|mixed grill|grilled chicken|barbeque chicken|herb grill|bbq grill|cajun grill|char grill|grilled fish|grilled salmon|honey miso salmon|salmon trout|salmon fillet|dory fillet|breaded fish|whitebait|bangers and mash|bangers & mashed|sausages?|bratwurst|frankfurter|hot ?dogs?|corn ?dogs?|schnitzel|parmigiana|cordon bleu|roast beef|wellington|duck confit|foie gras|charcuterie|prosciutto|jamon|serrano|capocollo|caviar|sospiri|5 grill kitchen|8 plus food house|coastal settlement|southwest tavern|13 miles|astons|collin.?s|jack.?s place|bizen|feather blade|stirling steaks|tony roma|morganfield)\b|西式煎牛扒|鸡扒|法式鹅肝", re.I)),
    ("Fish & Chips", re.compile(r"\b(fish & chips|fish and chips|battered fish|calamari rings?|calamari chunks?|frittura di calamari|fish & co|manhattan fish|long john silver|lad & dad|smith marine)\b", re.I)),
    ("Tacos, Burritos & Mexican", re.compile(r"\b(tacos?|burritos?|quesadillas?|nachos|enchiladas?|chimichangas?|guacamole|salsa|churros?|mexican|tex[- ]?mex|chipotle|carnitas|birria|elote|fajitas?|guzman y gomez|muchachos|papi.?s tacos|vamo|chimichanga|senor taco)\b", re.I)),
    ("Kaya Toast & Eggs", re.compile(r"\b(kaya|toast set|butter toast|peanut toast|french toast|soft[- ]?boiled eggs?|half[- ]?boiled eggs?|cage[- ]?free eggs?|quail egg|traditional toast|steamed bread|kopi & toast|ya kun|toast box|killiney|fun toast|kopitiam breakfast|tong ah|heap seng leong|chin mee chin)\b", re.I)),
    ("Sandwiches, Wraps & Bagels", re.compile(r"\b(sandwiches|sandwich|sand\b|sando|sub |subs|submarine|subway|sarnie|panini|ciabatta|baguette|croissant sandwich|club sandwich|blt|reuben|grilled cheese|melt|toastie|wraps?|tortilla|burrito bowl|bagels?|open[- ]?faced|smashed avocado|avocado toast|bruschetta|crostini|pita pocket|footlong|two men bagel|cedele|o.?briens|kebabs faktory)\b", re.I)),
    ("Acai, Poke & Grain Bowls", re.compile(r"\b(acai|açaí|poke |poké|grain bowls?|protein bowls?|superfood|quinoa|couscous bowl|buddha bowl|guzmann|daily cut|saladstop|stuff.?d|omnivore|haakon|an acai affair|project acai|coocaça|aloha poke|poke theory)\b", re.I)),
    ("Salads", re.compile(r"\b(salads?|insalate|insalata|caprese|caesar|cesare|greek salad|cobb salad|waldorf|nicoise|coleslaw|slaw|greens|mesclun|kale|arugula|rocket|garden salad)\b", re.I)),
    ("Breakfast & Brunch", re.compile(r"\b(breakfast|brunch|eggs benedict|scrambled eggs?|poached eggs?|sunny side|omelets?|shakshuka|pancakes?|hotcakes?|hash ?browns?|tater tots?|pop[- ]?a[- ]?corn tots?|muesli|granola|oatmeal|porridge oats|all[- ]?day breakfast|big breakfast|english breakfast|rosti|rösti|monte cristo|frittata|quiche|mcmuffin|smoked salmon|bacon|luncheon meat|ps cafe|han.?s cafe|flock cafe|mosanco|001 cafe|bark cafe|wala wala|wild honey|common man|symmetry|atlas coffeehouse|forty hands|tiong bahru bakery)\b", re.I)),
    ("Western Soups & Sides", re.compile(r"\b(fries|french fries|truffle fries|cheese fries|curly fries|sweet potato fries|straight cut chips|chips|wedges|onion rings?|mashed potato|duck fat potatoes|sweet potato|baked potato|jacket potato|potato salad|garlic bread|soup of the day|mushroom soup|cream of mushroom|sauteed mushrooms?|roasted mushrooms?|grilled cherry tomatoes|fried brussels|clam chowder|tomato soup|pumpkin soup|minestrone|lobster bisque|corn soup|french onion|broccoli soup|cauliflower|mozzarella sticks?|cheese ?sticks?|jalapeno poppers?|corn on the cob|corn cup|sauces?|toppings?)\b", re.I)),

    # 7. Bakery, Desserts & Snacks
    ("Local Kueh, Min Jiang Kueh & Snacks", re.compile(r"\b(kueh|kuih|min jiang kueh|mjk|munchi|apam balik|ban jian kueh|ondeh[- ]?ondeh|kueh lapis|lapis|ang ku kueh|soon kueh|png kueh|kueh tutu|tutu kueh|putu piring|chwee kueh|water rice cake|kueh salat|seri muka|kueh kosui|kueh dadar|kueh bangkit|love letters?|pineapple tarts?|goreng pisang|pisang goreng|banana fritters?|epok[- ]?epok|curry puffs?|curry.?o|spring.?o|sardine.?o|turnip k8|old chang kee|tip top curry puff|j2 famous|rolina|sardine puffs?|yam cake|orh kueh|or nee|radish cake|pumpkin cake|nian gao|you tiao|youtiao|dough fritters?|hum chim peng|butterfly bun|hamok|tau suan|cheng tng|ah balling|tang yuan|red bean soup|green bean soup|black sesame|almond paste|walnut paste|pulut hitam|bubur cha cha|bo bo cha cha|orach|chendol|cendol|ice kachang|ais kacang|tau huay|beancurd|soya beancurd|grass jelly|chin chow|aiyu|sago|gula melaka|mango pomelo|durian mousse|snow ice|tau sar piah|tau sha piah|pia|heong peah|egg tarts?|portuguese tarts?|bengawan solo|ji xiang|kim choo|harrianns|lek lim|jian bo|bedok chwee kueh)\b|芋泥|年糕|仙草|老婆饼", re.I)),
    ("Cakes & Tarts", re.compile(r"\b(cakes?|cheesecakes?|tarts?|tartlets?|tiramisu|brownies?|blondies?|mille crepe|crepe cakes?|sponge cakes?|chiffon|swiss rolls?|sugar rolls?|red velvet|black forest|shortcakes?|fudge|ganache|macarons?|eclairs?|choux|profiteroles?|cream puffs?|cupcakes?|muffins?|scones?|pound cakes?|fruit cakes?|pandan cakes?|layer cakes?|log cakes?|bento cakes?|whole cakes?|sliced cakes?|mousse|panna cotta|creme brulee|souffle|flan|pudding|trifle|parfait|basque burnt|speculoos|biscoff|ondé|gateau|entremet|patisserie|despicable me|chibi dc|tokidoki|sanrio|disney|paw patrol|peppa pig|pokemon|crayon shinchan|bubbly buu|banana pie|pecan pie|apple pie|crumble|bonbons?|2am: dessertbar|lady m|chateraise|awfully chocolate|lana cake|cat & the fiddle|chalk farm|rive gauche|paris baguette)\b", re.I)),
    ("Bread, Pastries & Bakery", re.compile(r"\b(breads?|buns?|loafs?|loaves|toast|sourdough|baguettes?|ciabatta|focaccia|brioche|croissants?|pain au|danish|pastries|pastry|puffs?|strudels?|pretzels?|auntie anne|bagels?|donuts?|doughnuts?|bomboloni|cinnamon rolls?|babka|floss|polo bun|bo lo|bolo|pineapple bun|garlic bun|butter sugar|sausage rolls?|chicken pie|beef pie|shepherd.?s pie|quiches?|cookies?|biscuits?|palmiers?|madeleines?|financiers?|canele|kouign[- ]?amann|waffles?|crepes?|galettes?|churros?|bakgua|bakkwa|crackers|breadtalk|barcook|four leaves|swee heng|polar puffs|prima deli|primadeli|dona manis|balmoral bakery|bakery|savouries|sweets)\b", re.I)),
    ("Ice Cream, Gelato & Froyo", re.compile(r"\b(ice[- ]?cream|gelato|sorbet|sherbet|froyo|frozen yogurt|soft serve|sundaes?|banana split|affogato|mcflurry|float|milkshakes?|shakes?|popsicles?|paleta|bingsu|kakigori|shaved ice|swensen|haagen[- ]?dazs|ben & jerry|baskin|llaollao|yole|oreo|birds of paradise|creamier|uddin.?s|apiary|tom.?s palette|merely ice cream|salted caramel|island creamery)\b", re.I)),
    ("Local & Asian Desserts", re.compile(r"\b(desserts?|sweet soup|tong shui|tang shui|beancurd|tau huay|grass jelly|sago|chendol|cendol|ice kachang|bingsu|mochi|warabimochi|daifuku|taiyaki|dorayaki|dango|matcha parfait|shibuya toast|honey toast|mango sticky rice|snow ice|taro ball|chilled longan|sea coconut|ninefresh|blackball|meet fresh|ji de chi|mei heong yuen|yat ka yan|ah chew|tian wang|jin yu man tang)\b|龙眼海底椰|甜品|糖水", re.I)),

    # 8. Beverages
    ("Bubble Tea, Milk Tea & Teh", re.compile(r"\b(bubble tea|boba|milk tea|pearl|brown sugar|cheese foam|macchiato|taro milk|matcha latte|hojicha|oolong|jasmine green tea|earl grey tea|black tea|green tea|fruit tea|yakult|aloe vera|konjac|aiyu|grass jelly drink|teh\b|teh o|teh c|teh tarik|teh peng|teh halia|yuan yang|yuanyang|thai milk tea|cha yen|liho|koi |gong cha|chicha|playmade|each a cup|sweet talk|itea|heytea|chagee|nayuki|sharetea|tiger sugar|r&b tea|hollin|milksha|kebuke|machimachi|the alley|xing fu tang)\b", re.I)),
    ("Coffee & Kopi", re.compile(r"\b(coffee|kopi|kopi o|kopi c|kopi peng|espresso|americano|long black|latte|cappuccino|flat white|mocha|macchiato|cortado|piccolo|cold brew|affogato|frappuccino|frappe|vietnamese coffee|einspanner|dalgona|white coffee|nescafe|starbucks|coffee bean|luckin|flash coffee|huggs|arabica|bacha coffee|nylon coffee|alchemist|ppp coffee|tag espresso)\b", re.I)),
    ("Juices, Smoothies & Shakes", re.compile(r"\b(juices?|smoothies?|milkshakes?|shakes?|slush|slushie|ice blended|crush|cooler|quenchers?|lemonade|lime juice|calamansi|sugarcane|sugar cane|coconut shake|coconut water|fresh coconut|watermelon|orange|apple|carrot|celery|beetroot|abc juice|avocado|soursop|mango|passionfruit|passion fruit|dragonfruit|pineapple|guava|bandung|milo|horlicks|ovaltine|ribena|chocolate drink|hot chocolate|ice chocolate|cocoa|matcha|lassi|yoghurt drink|yogurt drink|milk\b|boost|mr coconut|fruit paradise|juicy)\b", re.I)),
    ("Tea & Herbal Drinks", re.compile(r"\b(tea|chrysanthemum|water chestnut|barley|luo han guo|red date|herbal tea|cooling water|ginseng|winter melon|roselle|hibiscus|lemongrass|pandan|ginger tea|lemon ginger|lemon honey|honey lemon|honey citron|yuja|yuzu|peppermint|chamomile|earl grey|english breakfast|darjeeling|pu[- ]?erh|pu er|tie guan yin|sencha|genmaicha|kombucha|zall|twg)\b", re.I)),
    ("Soft Drinks & Water", re.compile(r"\b(coke|coca[- ]?cola|pepsi|sprite|7[- ]?up|fanta|mirinda|mountain dew|100 ?plus|pocari|ayataka|pokka|heaven & earth|seasons|oishi|green tea canned|ice lemon tea|root ?beer|a&w|ginger ale|tonic water|tonic\b|soda water|soda\b|cream soda|lemon lime bitter|calpis|sparkling water|perrier|san pellegrino|mineral water|drinking water|distilled water|still water|dasani|evian|ice mountain|red ?bull|monster|kickapoo|sarsi|qoo|minute maid|schweppes|vitagen|yakult|soya milk|soy milk|mr bean|jollibean|beverages?|drinks?|cold drinks?|hot and cold drinks?|soft drinks?)\b", re.I)),
    ("Beer, Wine & Spirits", re.compile(r"\b(beer|lager|ale|ipa|stout|pilsner|draught|hoppy|heineken|tiger|carlsberg|guinness|asahi|sapporo|kirin|corona|hoegaarden|kronenbourg|stella artois|budweiser|erdinger|somersby|cider|wine|merlot|cabernet|shiraz|syrah|pinot|chardonnay|sauvignon|gewürztraminer|demi sec|prosecco|champagne|moscato|malbec|provence|minuty|moet|chandon|sake|daiginjyo|ginjyo|junmai|umeshu|shochu|takara mio|dassai|soju|makgeolli|highball|whisky|whiskey|bourbon|scotch|single malt|vodka|gin|rum|tequila|cognac|brandy|liqueur|cocktail|shots?|b52|mojito|margarita|martini|negroni|old fashioned|sangria|aperol|bacardi|baileys|belvedere|bombay sapphire|captain morgan|chivas|glenfiddich|glenmorangie|gordon.?s|grey goose|hennessy|jack daniel|jameson|johnnie walker|jose cuervo|macallan|martell|patron|absolut|smirnoff|tanqueray|hendrick|monkey shoulder|balvenie|singleton|jagermeister|jim beam|laphroaig|malibu|myers|roku|san miguel|sambuca|barrels entertainment)\b", re.I)),
]

# Base 6-axis TasteVector (Sweet, Spicy, Sour, Salty, Rich, Aromatic) [0-10] + Base Taste Palette tags per category
CATEGORY_TASTE_BASELINES = {
    "Chicken Rice": ((3, 2, 1, 7, 6, 9), ["Fragrant", "Savory", "Juicy", "Comforting"]),
    "Laksa": ((3, 8, 2, 7, 9, 9), ["Spicy", "Lemak", "Rich", "Aromatic"]),
    "Nasi Lemak": ((4, 6, 1, 6, 8, 9), ["Lemak", "Fragrant", "Spicy", "Rich"]),
    "Wanton Mee": ((4, 3, 1, 7, 5, 6), ["Savory", "QQ", "Springy", "Sweet-Savory"]),
    "Bak Chor Mee & Fishball Noodles": ((2, 5, 6, 7, 6, 7), ["Savory", "Tangy", "QQ", "Umami"]),
    "Ban Mian & La Mian": ((2, 2, 1, 6, 5, 6), ["Comforting", "Umami", "QQ", "Savory"]),
    "Hokkien Mee": ((3, 5, 2, 7, 8, 9), ["Wok Hei", "Umami", "Rich", "Savory"]),
    "Char Kway Teow": ((6, 4, 1, 8, 8, 9), ["Wok Hei", "Smoky", "Sweet-Savory", "Rich"]),
    "Prawn Noodles": ((4, 4, 1, 8, 8, 9), ["Umami", "Rich", "Savory", "Aromatic"]),
    "Lor Mee": ((4, 3, 4, 7, 9, 7), ["Gao", "Rich", "Savory", "Tangy"]),
    "Kway Chap": ((5, 2, 2, 8, 8, 8), ["Braised", "Savory", "Rich", "Herbal"]),
    "Beef Noodles": ((3, 2, 1, 8, 8, 8), ["Rich", "Savory", "Aromatic", "Hearty"]),
    "Mee Rebus, Mee Soto & Mee Siam": ((5, 6, 5, 7, 7, 8), ["Spicy", "Tangy", "Sweet-Savory", "Aromatic"]),
    "Yong Tau Foo": ((3, 2, 1, 6, 4, 5), ["Light", "Clean", "Savory", "Comforting"]),
    "Duck Rice & Braised Duck": ((5, 2, 1, 8, 8, 8), ["Braised", "Savory", "Rich", "Aromatic"]),
    "Char Siew & Roast Meat": ((7, 1, 1, 8, 8, 8), ["Sweet-Savory", "Smoky", "Crispy", "Rich"]),
    "Carrot Cake (Chye Tow Kway)": ((5, 3, 1, 7, 7, 8), ["Wok Hei", "Savory", "Fragrant", "Soft"]),
    "Satay & Otah": ((7, 5, 1, 6, 7, 9), ["Smoky", "Nutty", "Sweet-Spicy", "Aromatic"]),
    "Rojak & Popiah": ((7, 4, 5, 6, 5, 7), ["Sweet", "Tangy", "Crispy", "Nutty"]),
    "Oyster Omelette (Orh Luak)": ((2, 4, 3, 7, 8, 8), ["Crispy", "Savory", "Umami", "Rich"]),
    "Fish Soup": ((2, 1, 1, 6, 4, 7), ["Clean", "Light", "Umami", "Fresh"]),
    "Bak Kut Teh": ((2, 6, 1, 7, 7, 9), ["Peppery", "Savory", "Rich", "Aromatic"]),
    "Claypot Rice & Dishes": ((5, 2, 1, 8, 8, 9), ["Smoky", "Chao Ta", "Savory", "Fragrant"]),
    "Porridge & Congee": ((2, 1, 1, 6, 4, 6), ["Soft", "Comforting", "Light", "Savory"]),
    "Thunder Tea Rice (Lei Cha)": ((1, 1, 1, 5, 4, 9), ["Herbal", "Clean", "Light", "Aromatic"]),
    "Mala Xiang Guo & Sichuan": ((2, 9, 2, 8, 8, 9), ["Spicy", "Hiam", "Aromatic", "Savory"]),
    "Hotpot & Steamboat": ((3, 5, 2, 7, 8, 8), ["Hearty", "Rich", "Umami", "Comforting"]),
    "Dim Sum & Dumplings": ((4, 2, 1, 7, 6, 7), ["Savory", "Juicy", "Umami", "Soft"]),
    "Zi Char & Seafood": ((4, 4, 2, 8, 7, 8), ["Wok Hei", "Savory", "Umami", "Hearty"]),
    "Roti Prata, Thosai & Murtabak": ((3, 5, 2, 6, 8, 8), ["Crispy", "Rich", "Spicy", "Savory"]),
    "Biryani": ((3, 6, 2, 7, 8, 10), ["Aromatic", "Fragrant", "Rich", "Spiced"]),
    "Indian Curry, Naan & Tandoori": ((3, 7, 3, 7, 8, 9), ["Spicy", "Rich", "Aromatic", "Smoky"]),
    "Ayam Penyet & Ayam Bakar": ((4, 8, 2, 7, 7, 8), ["Crispy", "Spicy", "Hiam", "Savory"]),
    "Nasi Padang & Malay Dishes": ((4, 7, 2, 7, 8, 9), ["Lemak", "Spicy", "Rich", "Sedap"]),
    "Sup Tulang & Mutton Soup": ((4, 6, 2, 8, 9, 9), ["Rich", "Spiced", "Hearty", "Savory"]),
    "Kebab, Shawarma & Middle Eastern": ((3, 4, 3, 7, 7, 8), ["Smoky", "Spiced", "Savory", "Aromatic"]),
    "Hor Fun, Bee Hoon & Fried Noodles": ((3, 3, 1, 7, 6, 8), ["Wok Hei", "Savory", "Comforting", "Fragrant"]),
    "Fried Rice": ((3, 3, 1, 7, 6, 8), ["Wok Hei", "Fragrant", "Savory", "Comforting"]),
    "Curry Rice": ((4, 6, 2, 7, 8, 8), ["Gao", "Rich", "Spicy", "Comforting"]),
    "Economy & Mixed Veg Rice": ((3, 2, 1, 6, 5, 5), ["Savory", "Balanced", "Comforting"]),
    "Traditional & Herbal Soups": ((3, 1, 1, 6, 5, 9), ["Herbal", "Clean", "Aromatic", "Comforting"]),
    "Ramen": ((2, 3, 1, 8, 9, 8), ["Rich", "Umami", "Savory", "QQ"]),
    "Sushi & Sashimi": ((3, 1, 4, 5, 5, 4), ["Fresh", "Clean", "Umami", "Light"]),
    "Donburi & Japanese Rice Bowls": ((6, 2, 1, 7, 7, 6), ["Sweet-Savory", "Umami", "Comforting", "Rich"]),
    "Udon & Soba": ((3, 1, 1, 6, 4, 5), ["Clean", "QQ", "Light", "Umami"]),
    "Japanese Bento, Tempura & Sides": ((4, 2, 2, 7, 6, 6), ["Crispy", "Umami", "Savory", "Balanced"]),
    "Korean BBQ, Tteokbokki & Korean": ((5, 7, 4, 7, 7, 8), ["Spicy", "Sweet-Savory", "Tangy", "Rich"]),
    "Thai Tom Yum, Pad Thai & Thai": ((5, 8, 8, 7, 6, 9), ["Spicy", "Sour", "Tangy", "Aromatic"]),
    "Vietnamese Pho & Banh Mi": ((3, 3, 4, 6, 5, 9), ["Herbal", "Fresh", "Aromatic", "Clean"]),
    "Burgers": ((4, 3, 3, 8, 8, 6), ["Savory", "Juicy", "Rich", "Hearty"]),
    "Fried Chicken & Wings": ((3, 5, 1, 8, 8, 7), ["Crispy", "Juicy", "Savory", "Rich"]),
    "Pizza": ((3, 2, 4, 8, 8, 7), ["Savory", "Rich", "Tangy", "Cheesy"]),
    "Pasta, Lasagna & Baked Rice": ((3, 2, 3, 7, 8, 7), ["Rich", "Creamy", "Savory", "Comforting"]),
    "Steak, Chops & Western Grill": ((2, 3, 1, 8, 8, 8), ["Smoky", "Juicy", "Savory", "Rich"]),
    "Fish & Chips": ((2, 1, 3, 7, 7, 5), ["Crispy", "Savory", "Light", "Fresh"]),
    "Tacos, Burritos & Mexican": ((3, 6, 5, 7, 7, 8), ["Spicy", "Tangy", "Zesty", "Savory"]),
    "Kaya Toast & Eggs": ((8, 0, 0, 4, 7, 8), ["Sweet", "Fragrant", "Rich", "Comforting"]),
    "Sandwiches, Wraps & Bagels": ((3, 2, 2, 6, 6, 5), ["Fresh", "Savory", "Crispy", "Balanced"]),
    "Acai, Poke & Grain Bowls": ((6, 2, 5, 4, 4, 5), ["Fresh", "Light", "Sweet", "Clean"]),
    "Salads": ((3, 1, 5, 4, 3, 5), ["Fresh", "Light", "Crispy", "Tangy"]),
    "Breakfast & Brunch": ((4, 1, 2, 6, 7, 6), ["Rich", "Savory", "Comforting", "Fresh"]),
    "Western Soups & Sides": ((2, 2, 1, 7, 7, 5), ["Savory", "Crispy", "Rich", "Comforting"]),
    "Local Kueh, Min Jiang Kueh & Snacks": ((7, 1, 1, 4, 7, 8), ["Sweet", "Lemak", "Fragrant", "Soft"]),
    "Cakes & Tarts": ((9, 0, 2, 2, 8, 7), ["Sweet", "Rich", "Creamy", "Soft"]),
    "Bread, Pastries & Bakery": ((6, 0, 1, 4, 7, 8), ["Fragrant", "Sweet", "Rich", "Crispy"]),
    "Ice Cream, Gelato & Froyo": ((9, 0, 2, 1, 8, 6), ["Sweet", "Creamy", "Rich", "Smooth"]),
    "Local & Asian Desserts": ((8, 0, 1, 2, 6, 7), ["Sweet", "Refreshing", "Smooth", "Comforting"]),
    "Bubble Tea, Milk Tea & Teh": ((8, 0, 1, 2, 7, 8), ["Sweet", "Creamy", "QQ", "Fragrant"]),
    "Coffee & Kopi": ((5, 0, 2, 1, 6, 9), ["Aromatic", "Gao", "Rich", "Fragrant"]),
    "Juices, Smoothies & Shakes": ((7, 0, 5, 1, 4, 7), ["Sweet", "Sour", "Fresh", "Refreshing"]),
    "Tea & Herbal Drinks": ((4, 0, 1, 0, 2, 8), ["Aromatic", "Light", "Clean", "Refreshing"]),
    "Soft Drinks & Water": ((6, 0, 2, 1, 1, 3), ["Light", "Refreshing", "Clean"]),
    "Beer, Wine & Spirits": ((3, 1, 3, 1, 4, 8), ["Aromatic", "Crisp", "Rich"]),
}

RE_SPICY_HIGH = re.compile(r"\b(ma ?la|sichuan|szechuan|chongqing|laziji|shui zhu|fire|fiery|volcano|suicide|buldak|devil|ghost pepper|chili padi|chilli padi|sambal|ayam penyet|ayam geprek|tom yum|tomyam|green curry|red curry|vindaloo|madras|chettinad|mcspicy|zinger|hot & spicy|extra spicy|spicy)\b|麻辣|香辣|水煮|酸辣|泡椒|辣子", re.I)
RE_SPICY_MED = re.compile(r"\b(chili|chilli|curry|masala|tandoori|tikka|kimchi|wasabi|pepper|black pepper|white pepper|jalapeno|buffalo|peri[- ]?peri|cajun|xo|otah|laksa|rendang|asam pedas|arrabbiata|gochujang|dan dan|tantanmen|harissa|ginger)\b|咖喱|黑椒|胡椒|辣椒|姜", re.I)
RE_NON_SPICY = re.compile(r"\b(non[- ]?spicy|no spicy|mild|clear soup|plain|kids|white hokkien|white carrot cake)\b|不辣|无辣|清汤", re.I)

RE_SOUR_HIGH = re.compile(r"\b(sour|assam|asam|tom yum|tomyam|lemon|lime|calamansi|tamarind|vinegar|suan cai|sauerkraut|pickled|kimchi|yuzu|passion ?fruit|soursop|green apple|pineapple|plum|berry|strawberry|raspberry|cranberry|grapefruit|hibiscus|roselle|ceviche|vinaigrette|pomodoro)\b|酸菜|酸甜|酸辣|柠檬|酸梅|百香果", re.I)
RE_SWEET_HIGH = re.compile(r"\b(sweet|honey|caramel|brown sugar|gula melaka|maple|chocolate|choco|oreo|nutella|biscoff|speculoos|vanilla|strawberry|mango|durian|red bean|kaya|condensed milk|teriyaki|char siew|rojak|satay|sweet & sour|sweet and sour|ribena|milo|bandung|frappuccino|sundae|cake|tart|brownie|macaron|mochi|cendol|chendol|ice kachang|bingsu)\b|蜜汁|甜|红豆|巧克力|焦糖|黑糖|椰糖", re.I)
RE_UNSWEETENED = re.compile(r"\b(unsweetened|no sugar|zero sugar|sugar[- ]?free|kosong|siew dai|americano|long black|espresso|cold brew|mineral water|still water|drinking water|distilled water|sparkling water|perrier|san pellegrino|ayataka|oolong tea|green tea|pu[- ]?erh)\b|无糖", re.I)

RE_RICH_HIGH = re.compile(r"\b(salted egg|butter|buttermilk|cheese|cheesy|mozzarella|parmesan|cheddar|burrata|cream|creamy|carbonara|alfredo|truffle|foie gras|wagyu|ribeye|pork belly|siew yoke|braised|lor mee|kway chap|laksa|coconut|lemak|rendang|curry|briyani|biryani|tonkotsu|avocado|durian|peanut|sesame|nutty|lava|ganache|fudge|basque|double|jumbo|king)\b|咸蛋|芝士|奶油|牛油|红烧|卤|五花肉|肥牛|榴莲", re.I)
RE_LIGHT = re.compile(r"\b(steamed|poached|clear soup|sliced fish|fish soup|porridge|congee|lei cha|thunder tea|yong tau foo|salad|greens|fresh|cold brew|mineral water|still water|herbal tea)\b|清蒸|白灼|鱼片汤|清汤", re.I)

RE_SALTY_HIGH = re.compile(r"\b(salted|salted egg|salted fish|salted vegetable|soy sauce|soya sauce|miso|shoyu|bacon|ham|prosciutto|jamon|luncheon meat|spam|anchovy|ikan bilis|seaweed|black bean|oyster sauce|belacan|shrimp paste|prawn paste|har cheong|caviar|century egg|feta|halloumi|olives?)\b|咸鱼|咸菜|咸蛋|豉油|酱油|虾酱|午餐肉|皮蛋", re.I)
RE_AROMATIC_HIGH = re.compile(r"\b(aromatic|fragrant|herbal|ginseng|angelica|cordyceps|bak kut teh|briyani|biryani|tandoori|masala|curry|laksa|nasi lemak|pandan|lemongrass|basil|thai basil|truffle|garlic|garlicky|ginger|scallion|spring onion|coriander|cilantro|sesame oil|five spice|cinnamon|cardamom|clove|star anise|saffron|coffee|kopi|espresso|matcha|hojicha|earl grey|jasmine|osmanthus|chrysanthemum|smoked|smoky|charcoal|char[- ]?grilled|bbq|barbecue|satay|claypot|fried kway teow|hokkien mee|hor fun)\b|药材|当归|人参|蒜香|姜葱|麻油|五香|香茅|斑兰|炭烧|砂煲|锅气", re.I)
RE_CRISPY = re.compile(r"\b(crispy|crunchy|fried|deep[- ]?fried|tempura|katsu|tonkatsu|karaage|cutlet|wings?|nuggets?|popcorn|fries|chips|wedges|hash ?brown|toast|prata|roti john|murtabak|puff|croissant|waffle|churro|crackling|roast pork|siew yoke|goreng|penyet|bakar|orh luak|youtiao|fritter)\b|香脆|酥脆|炸|煎|烧肉", re.I)


def clamp(v: int) -> int:
    return max(0, min(10, v))


def compute_dish_taste_palette(category: str, dish_name: str, desc: str) -> tuple[str, int, int, int, int, int, int]:
    base_vec, base_tags = CATEGORY_TASTE_BASELINES.get(
        category, ((4, 3, 2, 6, 6, 7), ["Savory", "Balanced", "Comforting"])
    )
    sweet, spicy, sour, salty, rich, aromatic = base_vec
    tags = list(base_tags)
    text = f"{dish_name} {desc}"

    def add_tag(t: str, front: bool = False):
        if t not in tags:
            if front:
                tags.insert(0, t)
            else:
                tags.append(t)

    # Spicy adjustments
    if RE_NON_SPICY.search(text):
        spicy = min(spicy, 1)
        tags = [t for t in tags if t not in ("Spicy", "Hiam", "Sweet-Spicy")]
        add_tag("Mild")
    elif RE_SPICY_HIGH.search(text):
        spicy = clamp(max(spicy, 7) + 2)
        add_tag("Spicy", front=True)
    elif RE_SPICY_MED.search(text):
        spicy = clamp(max(spicy, 5) + 1)
        add_tag("Spicy")

    # Sour adjustments
    if RE_SOUR_HIGH.search(text):
        sour = clamp(max(sour, 5) + 2)
        add_tag("Tangy")

    # Sweet / Unsweetened adjustments
    if RE_UNSWEETENED.search(text):
        sweet = min(sweet, 1)
        rich = min(rich, 2)
        tags = [t for t in tags if t not in ("Sweet", "Creamy", "Sweet-Savory")]
        add_tag("Clean", front=True)
    elif RE_SWEET_HIGH.search(text):
        sweet = clamp(max(sweet, 6) + 2)
        add_tag("Sweet")

    # Rich / Light adjustments
    if RE_RICH_HIGH.search(text):
        rich = clamp(max(rich, 7) + 2)
        add_tag("Rich")
    elif RE_LIGHT.search(text) and not RE_RICH_HIGH.search(text):
        rich = min(rich, 4)
        add_tag("Light")

    # Salty adjustments
    if RE_SALTY_HIGH.search(text):
        salty = clamp(max(salty, 7) + 1)
        add_tag("Savory")

    # Aromatic adjustments
    if RE_AROMATIC_HIGH.search(text):
        aromatic = clamp(max(aromatic, 7) + 2)
        add_tag("Aromatic")

    # Texture / Crispy tag
    if RE_CRISPY.search(text):
        add_tag("Crispy")

    palette_str = ", ".join(tags[:5])
    return palette_str, sweet, spicy, sour, salty, rich, aromatic


def classify_text(text_primary: str, text_secondary: str = "") -> str | None:
    for label, pat in RULES:
        if pat.search(text_primary):
            return label
    if text_secondary:
        for label, pat in RULES:
            if pat.search(text_secondary):
                return label
    return None


def classify_all_labels(text: str) -> list[str]:
    found = []
    for label, pat in RULES:
        if pat.search(text):
            found.append(label)
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    t0 = time.time()

    # If applying and clean pre-Pass-8 backup exists, restore from backup first for idempotency
    if args.apply and os.path.exists(BACKUP_PATH):
        shutil.copy2(BACKUP_PATH, WB_PATH)
        print(f"Restored clean baseline from {BACKUP_PATH}")
    elif args.apply and not os.path.exists(BACKUP_PATH):
        shutil.copy2(WB_PATH, BACKUP_PATH)
        print(f"Created backup: {BACKUP_PATH}")

    print(f"Loading workbook: {WB_PATH} (apply={args.apply}) ...")
    wb = openpyxl.load_workbook(WB_PATH)
    ws_menu = wb["Menu & Price"]
    ws_dir = wb["Food Directory"]

    m_idx = {str(ws_menu.cell(1, c).value or "").strip(): c for c in range(1, ws_menu.max_column + 1)}
    d_idx = {str(ws_dir.cell(1, c).value or "").strip(): c for c in range(1, ws_dir.max_column + 1)}

    col_m_vname = m_idx["F&B Venue Name"]       # 1
    col_m_lic = m_idx["SFA Licence"]            # 2
    col_m_dname = m_idx["Menu Item / Dish Name"]  # 5
    col_m_cat = m_idx["Category / Section"]     # 6
    col_m_desc = m_idx["Description / Notes"]   # 8

    # Ensure Taste Palette headers exist in Menu & Price (Cols 29..35)
    taste_headers = ["Taste Palette", "Sweet", "Spicy", "Sour", "Salty", "Rich", "Aromatic"]
    taste_cols = {}
    next_col = max(ws_menu.max_column, 28) + 1
    for th in taste_headers:
        if th in m_idx:
            taste_cols[th] = m_idx[th]
        else:
            taste_cols[th] = next_col
            if args.apply:
                ws_menu.cell(1, next_col).value = th
            next_col += 1

    c_palette = taste_cols["Taste Palette"]
    c_sweet = taste_cols["Sweet"]
    c_spicy = taste_cols["Spicy"]
    c_sour = taste_cols["Sour"]
    c_salty = taste_cols["Salty"]
    c_rich = taste_cols["Rich"]
    c_aromatic = taste_cols["Aromatic"]

    # Pass 1 on Sheet 1 (Menu & Price): direct classification + venue tally
    venue_label_counts = defaultdict(Counter)
    menu_classifications = {}
    menu_row_meta = {}
    total_menu_rows = 0
    active_count = 0
    direct_matches = 0

    for r_num in range(2, ws_menu.max_row + 1):
        vname = str(ws_menu.cell(r_num, col_m_vname).value or "").strip()
        lic = str(ws_menu.cell(r_num, col_m_lic).value or "").strip()
        dname = str(ws_menu.cell(r_num, col_m_dname).value or "").strip()
        cat = str(ws_menu.cell(r_num, col_m_cat).value or "").strip()
        desc = str(ws_menu.cell(r_num, col_m_desc).value or "").strip()

        if not dname:
            continue
        total_menu_rows += 1
        is_quarantined = "[QUARANTINED:" in desc.upper()
        if not is_quarantined:
            active_count += 1

        lbl = classify_text(f"{dname} {desc}", f"{cat} {vname}")
        if lbl:
            if not is_quarantined:
                direct_matches += 1
                if lic:
                    venue_label_counts[lic][lbl] += 1
                if vname:
                    venue_label_counts[vname.lower()][lbl] += 1
        menu_classifications[r_num] = lbl
        menu_row_meta[r_num] = (vname, lic, dname, cat, desc, is_quarantined)

    # Pass 2 on Sheet 1: resolve any remaining None via venue dominant dish label + compute Taste Palette & 6-Axis Vector
    venue_fallback_matches = 0
    final_label_dist = Counter()
    taste_palette_dist = Counter()
    manifest_rows = []
    s1_updated = 0
    s1_taste_populated = 0

    for r_num, (vname, lic, dname, old_cat, desc, is_quarantined) in menu_row_meta.items():
        lbl = menu_classifications[r_num]
        if lbl is None:
            vc = venue_label_counts.get(lic) or venue_label_counts.get(vname.lower())
            if vc:
                non_bev = [(k, v) for k, v in vc.most_common() if k not in BEVERAGE_LABELS]
                lbl = non_bev[0][0] if non_bev else vc.most_common(1)[0][0]
                if not is_quarantined:
                    venue_fallback_matches += 1
            else:
                lbl = "Zi Char & Seafood"
        if not is_quarantined:
            final_label_dist[lbl] += 1
        if old_cat != lbl:
            s1_updated += 1
            if args.apply:
                ws_menu.cell(r_num, col_m_cat).value = lbl

        # Compute Dish Taste Palette & 6-Axis Taste Vector
        palette_str, sweet, spicy, sour, salty, rich, aromatic = compute_dish_taste_palette(lbl, dname, desc)
        if not is_quarantined:
            taste_palette_dist[palette_str] += 1
        s1_taste_populated += 1
        if args.apply:
            ws_menu.cell(r_num, c_palette).value = palette_str
            ws_menu.cell(r_num, c_sweet).value = sweet
            ws_menu.cell(r_num, c_spicy).value = spicy
            ws_menu.cell(r_num, c_sour).value = sour
            ws_menu.cell(r_num, c_salty).value = salty
            ws_menu.cell(r_num, c_rich).value = rich
            ws_menu.cell(r_num, c_aromatic).value = aromatic

        if len(manifest_rows) < 15000 and not is_quarantined:
            manifest_rows.append({
                "sheet": "Menu & Price",
                "row": r_num,
                "sfa_licence": lic,
                "stall_or_dish": f"{vname} :: {dname}",
                "column": "Category / Section + Taste Palette (6-Axis)",
                "old_value": old_cat,
                "new_value": f"{lbl} | {palette_str} [Sw:{sweet} Sp:{spicy} So:{sour} Sa:{salty} Ri:{rich} Ar:{aromatic}]",
                "reason": "Pass 8 canonical searchable food label + dish 6-axis taste palette",
            })

    print(f"[Menu & Price] Total rows: {total_menu_rows:,} | Active verified rows: {active_count:,} (Direct: {direct_matches:,}, Venue-context: {venue_fallback_matches:,}) | Category updated: {s1_updated:,} | Taste Palette populated: {s1_taste_populated:,}")
    print("\nTop 35 Searchable Food Labels in Menu & Price (Active Verified Rows):")
    for k, v in final_label_dist.most_common(35):
        print(f"  {k}: {v:,}")
    print("\nTop 20 Dish Taste Palettes in Menu & Price (Active Verified Rows):")
    for k, v in taste_palette_dist.most_common(20):
        print(f"  {k}: {v:,}")

    # Process Sheet 2 (Food Directory): Cuisine & Secondary Categories
    col_d_name = d_idx["F&B Name"]                 # 1
    col_d_lic = d_idx["SFA Licence"]               # 3
    col_d_cuisine = d_idx["Cuisine"]               # 7
    col_d_mp = d_idx["Menu / Price"]               # 8
    col_d_sec = d_idx["Secondary Categories"]      # 26

    s2_cuisine_upgraded = 0
    s2_secondary_enriched = 0
    s2_cuisine_dist = Counter()

    for r_num in range(2, ws_dir.max_row + 1):
        fnb_name = str(ws_dir.cell(r_num, col_d_name).value or "").strip()
        lic = str(ws_dir.cell(r_num, col_d_lic).value or "").strip()
        old_cuisine = str(ws_dir.cell(r_num, col_d_cuisine).value or "").strip()
        menu_price_summary = str(ws_dir.cell(r_num, col_d_mp).value or "").strip()
        old_sec = str(ws_dir.cell(r_num, col_d_sec).value or "").strip()

        if not fnb_name:
            continue

        # Gather specific food labels for this stall:
        # 1) From F&B Name
        name_labels = classify_all_labels(fnb_name)
        # 2) From Menu & Price active dishes for this licence or venue name
        vc = venue_label_counts.get(lic) or venue_label_counts.get(fnb_name.lower()) or Counter()
        non_bev_menu = [k for k, _ in vc.most_common() if k not in BEVERAGE_LABELS]
        all_menu = [k for k, _ in vc.most_common()]
        # 3) From Observed delivery menu items in Menu / Price
        obs_labels = []
        if "Observed delivery menu items:" in menu_price_summary:
            obs_part = menu_price_summary.split("Observed delivery menu items:", 1)[1]
            obs_labels = classify_all_labels(obs_part)

        # Combine in priority order (non-beverage first unless stall only sells beverages/bakery)
        combined_labels = []
        for candidate in ([x for x in name_labels if x not in BEVERAGE_LABELS]
                          + non_bev_menu
                          + [x for x in obs_labels if x not in BEVERAGE_LABELS]
                          + name_labels
                          + all_menu
                          + obs_labels):
            if candidate not in combined_labels:
                combined_labels.append(candidate)

        new_cuisine = old_cuisine
        if combined_labels and (not old_cuisine or old_cuisine.lower() in BROAD_DIRECTORY_CUISINES):
            new_cuisine = combined_labels[0]
            if new_cuisine != old_cuisine:
                s2_cuisine_upgraded += 1
                if args.apply:
                    ws_dir.cell(r_num, col_d_cuisine).value = new_cuisine
                if len(manifest_rows) < 25000:
                    manifest_rows.append({
                        "sheet": "Food Directory",
                        "row": r_num,
                        "sfa_licence": lic,
                        "stall_or_dish": fnb_name,
                        "column": "Cuisine",
                        "old_value": old_cuisine,
                        "new_value": new_cuisine,
                        "reason": "Pass 8 specific searchable dish/food label upgrade",
                    })

        s2_cuisine_dist[new_cuisine] += 1

        # Enrich Secondary Categories (Col 26) with up to 4 specific food labels
        if combined_labels:
            existing_parts = [p.strip() for p in old_sec.split(";") if p.strip()]
            existing_lower = {p.lower() for p in existing_parts}
            added = False
            for lbl in combined_labels[:4]:
                if lbl.lower() not in existing_lower:
                    existing_parts.append(lbl)
                    existing_lower.add(lbl.lower())
                    added = True
            if added:
                new_sec = "; ".join(existing_parts)
                s2_secondary_enriched += 1
                if args.apply:
                    ws_dir.cell(r_num, col_d_sec).value = new_sec

    print(f"\n[Food Directory] Cuisine upgraded to specific food label: {s2_cuisine_upgraded:,} | Secondary Categories enriched with searchable food labels: {s2_secondary_enriched:,}")
    print("\nTop 35 Cuisine Labels in Food Directory:")
    for k, v in s2_cuisine_dist.most_common(35):
        print(f"  {k}: {v:,}")

    if not args.apply:
        wb.close()
        print(f"\nDry-run complete in {time.time() - t0:.2f}s. Re-run with --apply to write changes.")
        return

    with open(MANIFEST_CSV, "w", newline="", encoding="utf-8") as mf:
        writer = csv.DictWriter(mf, fieldnames=["sheet", "row", "sfa_licence", "stall_or_dish", "column", "old_value", "new_value", "reason"])
        writer.writeheader()
        writer.writerows(manifest_rows)
    print(f"Wrote manifest CSV: {MANIFEST_CSV} ({len(manifest_rows):,} sample rows)")

    if "Change Manifest" in wb.sheetnames:
        ws_cm = wb["Change Manifest"]
        start_idx = ws_cm.max_row
        now_str = "2026-11-11T14:50:00+08:00"
        for i, mrow in enumerate(manifest_rows[:5000], start=1):
            cid = f"CHG-{start_idx + i:06d}"
            ws_cm.append([cid, mrow["sheet"], f"Row {mrow['row']} ({mrow['sfa_licence']})", mrow["column"], str(mrow["old_value"])[:250], str(mrow["new_value"])[:250], mrow["reason"], "Pass 8 Food Labeling + 6-Axis Dish Taste Palette", now_str])

    print(f"Saving updated Master Workbook to {WB_PATH} ...")
    wb.save(WB_PATH)
    wb.close()

    with open(WB_PATH, "rb") as f:
        new_bytes = f.read()
        new_sha = hashlib.sha256(new_bytes).hexdigest()
    print(f"Saved {WB_PATH} ({len(new_bytes):,} bytes, SHA-256: {new_sha})")

    with zipfile.ZipFile(WB_PATH, "r") as z:
        bad = z.testzip()
        if bad is not None:
            print(f"ERROR: ZIP integrity check failed on {bad}")
            sys.exit(1)
    print(f"ZIP integrity: PASS (completed in {time.time() - t0:.2f}s)")


if __name__ == "__main__":
    main()
