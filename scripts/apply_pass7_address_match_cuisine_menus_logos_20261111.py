#!/usr/bin/env python3
"""
scripts/apply_pass7_address_match_cuisine_menus_logos_20261111.py

Pass 7 Comprehensive Stall Enrichment & Linking across Master Workbook:
1. Match Stall Details by Address + Unit Number + Postal Code (instead of requiring name similarity):
   - Links Google Maps crawl records (33,728 unique places across 18 crawl JSONLs),
     Foodpanda Singapore vendor catalog (16,214 vendors in scratch/foodpanda_sg_all_vendors.json),
     Mall Directories (4,979 F&B units in data/malls/*.json),
     Canonical Singapore Food Businesses CSV (32,253 rows), and SFA Crosswalk snapshots
     using exact (Postal Code, Normalized Unit Number) and standalone/small-building Postal Code.
   - Obtains/upgrades missing, placeholder ('SFA Licensed Stall ...'), stall-number-only, or
     raw corporate ('... PTE. LTD.') F&B Names while preserving Registered Business Name (Gate 1).
   - Populates missing Google Place ID, Google Maps URL (1-to-1 parity), Opening Hours / Closed Days,
     Contact Details, Website (Gate 3 filtered), Rating / Review Count, Price Range,
     Secondary Categories, Service Options, Accessibility & Amenities, Payment Methods, and Reviews Summary.
2. Fill Cuisine Tag Across Food Directory:
   - Multi-layer cuisine inference from:
     (a) Matched Foodpanda vendor cuisines
     (b) Dishes sold by the stall in Menu & Price
     (c) Google Maps category / Secondary Categories / Mall category / Canonical CSV Cuisine
     (d) Comprehensive Singapore F&B Name + Registered Business Name + Chain Brand classifier
     (e) Business Type / venue context fallback so 100% of active stalls have a valid Cuisine tag.
3. Expand Menu URL Coverage in Food Directory & Fill Remaining Stall Details for All Stalls with Menu URL:
   - Preserves all existing valid foodpanda.sg and food.grab.com links.
   - Links missing Menu URLs via:
     (a) Exact SFA Licence crosswalks (verified_crosswalk_menu_urls, resolved_brand_menu_urls,
         foodpanda_goal_targets, foodpanda_supplied_stalls, foodpanda_unrepresented_targets,
         foodpanda_api_cache, Supabase Venues/Dishes)
     (b) Address + Unit + Postal Code match against scratch/foodpanda_sg_all_vendors.json
     (c) Brand/Stall Name + Location/Street/Mall/Area slug match against
         data/foodpanda/foodpanda_singapore_storefront_urls.json (20,975 URLs) and
         data/grab/grab_singapore_storefront_urls.json (22,676 URLs)
     (d) Chain/Brand canonical menu URL propagation across multi-outlet brands
     (e) Google Maps menu.link / order_online / verified first-party website links
   - Synchronizes Menu / Price label 100% with Menu URL host(s).
4. Link Stall Logos & Storefront Images to Respective Stalls (Approved Image URL):
   - Links stall logos and storefront images from:
     (a) Uploaded public Supabase brand logos (data/stall_logos/brand_logo_upload_report.csv)
     (b) data/stall_logos/stall-logo-candidates-foodpanda-first.xlsx (Candidates + Foodpanda Logos)
         and data/source_snapshots/foodpanda_singapore_logos_20261019.json
     (c) Foodpanda vendor logo / hero_listing_image (scratch/foodpanda_sg_all_vendors.json &
         deterministic DeliveryHero listing image CDN by 4-char Foodpanda vendor code)
     (d) First-party Image Candidates (Hungry F&B Cleaned Database - 21 Oct 2026.xlsx &
         first_party_image_url_review_only_audit_20261018.json) & Supabase Venues/Dishes
     (e) Verified dish image from Menu & Price for that stall
     (f) Matched Google Maps place image / thumbnail & brand-level image propagation.
"""

import argparse
import csv
import glob
import hashlib
import json
import os
import re
import shutil
import sys
import time
import zipfile
from collections import Counter, defaultdict
import openpyxl

MASTER_XLSX = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
BACKUP_XLSX = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass7_enrichment_2026-11-11.xlsx"
MANIFEST_CSV = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/change_manifest_pass7_2026-11-11.csv"

UNIT_RE = re.compile(r"#\s*([B0-9]{1,3})\s*-\s*([0-9A-Z/&-]+)", re.I)
STALL_UNIT_RE = re.compile(r"\(\s*STALL\s+#\s*([B0-9]{1,3})\s*-\s*([0-9A-Z/&-]+)\s*\)", re.I)
POSTAL_RE = re.compile(r"\b(\d{6})\b")
SG_5DIGIT_RE = re.compile(r"\bS(?:ingapore)?\s*(\d{5})\b", re.I)
FP_CODE_RE = re.compile(r"foodpanda\.sg/restaurant/([a-z0-9]{4,5})\b", re.I)
LH_CODE_RE = re.compile(r"/LH/([a-z0-9]{4,5})-listing\.", re.I)

MALL_DOMAINS = (
    "capitaland.com", "frasersproperty.com", "fareastmalls.com.sg", "paragon.com.sg",
    "ionorchard.com", "vivocity.com.sg", "jewelchangiairport.com", "changiairport.com",
    "marinabaysands.com", "sunteccity.com.sg", "313somerset.com.sg", "nex.com.sg",
    "lendlease.com", "greatworld.com.sg", "unitedsquare.com.sg", "velocitynovena.com",
    "jurongpoint.com.sg", "amkhub.com.sg", "swingby.com.sg", "parkwayparade.com.sg",
    "jem.sg", "wismaonline.com"
)

AGGREGATOR_DOMAINS = (
    "oddle.me", "foodpanda.sg", "foodpanda.com", "grab.com", "deliveroo.com.sg",
    "chope.co", "inline.app", "tabsquare.com", "tablecheck.com", "quandoo.sg",
    "burpple.com", "eatbook.sg", "sethlui.com", "danielfooddiary.com", "tripadvisor.com",
    "yelp.com", "hungrygowhere.com", "sevenrooms.com", "weeloy.com", "alacarte.sg"
)

SOCIAL_DOMAINS = (
    "facebook.com", "fb.com", "instagram.com", "t.me", "telegram.me",
    "tiktok.com", "linktr.ee", "twitter.com", "x.com", "wa.me", "linkedin.com",
    "youtube.com", "xiaohongshu.com", "lemon8-app.com", "wechat.com"
)

MALL_POSTALS = {
    "plazasingapura": ["238839"],
    "bugisjunction": ["188021"],
    "westgate": ["608532"],
    "tampinesmall": ["529510"],
    "the centrepoint": ["238843"],
    "white sands": ["518457"],
    "tampines 1": ["529536"],
    "tiong bahru plaza": ["168732"],
    "causeway point": ["738099"],
    "northpoint city": ["769098", "768019"],
    "century square": ["529509"],
    "eastpoint mall": ["528833"],
    "hougang mall": ["538766"],
    "waterway point": ["828761"],
    "313 somerset": ["238895"],
    "parkway parade": ["449269"],
    "vivocity": ["098585"],
    "wisma atria": ["238877"],
    "jurong point": ["648886", "648331"],
}

NON_FNB_CATS = {
    "shopping mall", "subway station", "transit station", "bus stop", "bus station",
    "train station", "light rail station", "apartment building", "condominium complex",
    "housing development", "housing complex", "public housing", "corporate office",
    "business center", "office building", "industrial building", "warehouse",
    "parking lot", "parking garage", "hair salon", "beauty salon", "nail salon",
    "barber shop", "spa", "massage", "medical clinic", "dental clinic", "dentist",
    "doctor", "hospital", "pharmacy", "drugstore", "optician", "bank", "atm",
    "money transfer service", "laundry", "dry cleaner", "auto repair shop",
    "car wash", "gas station", "school", "preschool", "primary school",
    "secondary school", "university", "college", "training centre", "gym",
    "fitness center", "yoga studio", "place of worship", "church", "mosque",
    "buddhist temple", "hindu temple", "taoist temple", "synagogue", "park",
    "playground", "community center", "civic center", "government office",
    "police station", "post office", "library", "cinema", "movie theater",
    "clothing store", "shoe store", "jewelry store", "electronics store",
    "cell phone store", "furniture store", "home goods store", "hardware store",
    "book store", "stationery store", "pet store", "florist", "gift shop",
    "toy store", "department store", "real estate agency", "travel agency",
    "insurance agency", "accounting firm", "law firm"
}

FNB_KEYWORDS = {
    "restaurant", "cafe", "coffee", "bakery", "bistro", "bar", "pub", "food",
    "hawker", "stall", "eating", "eatery", "diner", "dining", "kitchen", "canteen",
    "noodle", "rice", "seafood", "chicken", "duck", "pork", "beef", "mutton",
    "fish", "soup", "porridge", "congee", "prata", "briyani", "biryani", "curry",
    "mala", "hotpot", "steamboat", "bbq", "barbecue", "grill", "roast", "satay",
    "dim sum", "tim sum", "sushi", "ramen", "japanese", "korean", "chinese",
    "malay", "indian", "thai", "vietnamese", "western", "italian", "mexican",
    "vegetarian", "vegan", "halal", "dessert", "ice cream", "gelato", "cake",
    "pastry", "bread", "toast", "tea", "bubble tea", "juice", "smoothie",
    "snack", "kiosk", "takeaway", "delivery", "catering", "caterer", "izakaya",
    "yakiniku", "teppanyaki", "omakase", "tonkatsu", "udon", "donburi", "bento",
    "taco", "pizza", "burger", "pasta", "steak", "tapas", "wine", "beer",
    "cocktail", "lounge", "kopitiam", "kopi", "teh", "zi char", "tze char",
    "yong tau foo", "laksa", "ban mian", "bak kut teh", "nasi", "mee", "warung",
    "mamak", "tiffin", "tandoori", "kebab", "shawarma", "acai", "salad", "poke",
    "waffle", "pancake", "crepe", "churros", "donut", "doughnut", "cookie",
    "chocolate", "confectionery", "patisserie", "boulangerie", "deli", "sandwich",
    "bagel", "broth", "claypot", "wok", "fried", "crispy"
}

CONTAINER_TITLES = {
    "vivocity", "plaza singapura", "tampines mall", "bugis junction", "westgate",
    "causeway point", "northpoint city", "waterway point", "jewel changi airport",
    "changi airport", "ion orchard", "suntec city", "nex", "jurong point",
    "parkway parade", "313@somerset", "313 somerset", "wisma atria",
    "the centrepoint", "centrepoint", "tiong bahru plaza", "white sands",
    "century square", "hougang mall", "eastpoint mall", "bedok mall",
    "the clementi mall", "clementi mall", "imm", "jcube", "lot one",
    "junction 8", "amk hub", "compass one", "rivervale mall", "seletar mall",
    "hillion mall", "bukit panjang plaza", "far east plaza", "lucky plaza",
    "paragon", "ngee ann city", "takashimaya", "raffles city",
    "marina square", "millenia walk", "marina bay sands", "funan", "clarke quay",
    "chinatown point", "people's park complex", "peoples park complex", "peoples park centre",
    "city square mall", "velocity@novena square", "united square", "great world",
    "tanglin mall", "holland village", "star vista", "the star vista",
    "jem", "harbourfront centre", "alexandra retail centre", "one raffles place",
    "republic plaza", "lau pa sat", "maxwell food centre", "amoy street food centre",
    "old airport road food centre", "tiong bahru market", "newton food centre",
    "changi village hawker centre", "east coast lagoon food village",
    "golden mile food centre", "tekka centre", "chinatown complex",
    "hong lim market & food centre", "adam road food centre", "jia le",
    "kopitiam", "food republic", "koufu", "food junction", "foodgle",
    "kimly coffeeshop", "broadway food centre", "s-11", "chang cheng"
}

STOP_TOKENS = {
    "pte", "ltd", "llp", "inc", "corp", "company", "co", "singapore", "sg",
    "the", "and", "by", "at", "in", "of", "for", "to", "a", "an", "stall",
    "unit", "blk", "block", "road", "rd", "street", "st", "avenue", "ave",
    "drive", "dr", "lane", "ln", "jalan", "jln", "lorong", "lor", "bukit",
    "bt", "tanjong", "tg", "upper", "up", "lower", "north", "south", "east",
    "west", "central", "park", "plaza", "mall", "centre", "center", "building",
    "tower", "complex", "square", "point", "hub", "city", "junction", "view",
    "heights", "garden", "gardens", "court", "courts", "place", "way", "walk",
    "link", "crescent", "cres", "close", "terrace", "industrial", "estate",
    "food", "fnb", "f", "b", "enterprise", "enterprises", "trading", "holdings",
    "group", "international", "services", "catering", "kitchen", "restaurant",
    "restaurants", "cafe", "bistro", "bar", "dining", "eatery", "eating",
    "house", "coffeeshop", "coffee", "shop", "hawker", "canteen", "foodcourt",
    "delights", "delight", "delivery"
}

LOCATION_STOP_TOKENS = {
    "singapore", "sg", "road", "rd", "street", "st", "avenue", "ave", "drive",
    "dr", "lane", "ln", "jalan", "jln", "lorong", "lor", "blk", "block",
    "unit", "floor", "level", "part", "the", "and", "at", "in", "of", "delivery",
    "mall", "plaza", "centre", "center", "building", "tower", "complex", "square",
    "point", "hub", "city", "junction", "view", "heights", "garden", "gardens",
    "court", "courts", "place", "way", "walk", "link", "crescent", "cres", "close",
    "terrace", "park"
}

GENERIC_FOOD_TOKENS = {
    "wanton", "wonton", "noodle", "noodles", "chicken", "rice", "duck", "pork",
    "beef", "mutton", "fish", "soup", "prawn", "mee", "fried", "carrot", "cake",
    "roti", "prata", "indian", "muslim", "malay", "chinese", "thai", "vietnamese",
    "western", "japanese", "korean", "taiwanese", "indonesian", "halal",
    "vegetarian", "vegan", "seafood", "bbq", "barbecue", "grill", "hotpot",
    "hot", "pot", "steamboat", "mala", "tang", "tea", "coffee", "drinks", "drink",
    "beverage", "beverages", "juice", "smoothie", "dessert", "desserts", "bakery",
    "bread", "toast", "curry", "nasi", "lemak", "ayam", "penyet", "padang", "ban",
    "mian", "bak", "kut", "teh", "char", "kway", "teow", "siew", "roasted", "roast",
    "claypot", "porridge", "congee", "dim", "sum", "pau", "bao", "dumpling",
    "dumplings", "satay", "laksa", "yong", "tau", "foo", "economy", "economical",
    "mixed", "veg", "vegetable", "cai", "png", "zi", "tze", "hokkien", "teochew",
    "cantonese", "hainanese", "hakka", "hong", "kong", "penang", "ipoh",
    "traditional", "homemade", "famous", "original", "authentic", "special",
    "specialty", "signature", "express", "snack", "snacks", "bites", "sweet",
    "spicy", "sour", "crispy", "golden", "fresh", "daily", "classic", "corner",
    "station", "stall", "market", "cooked", "centre", "center", "food", "local"
}

JUNK_NAME_TOKENS = {
    "NIL", "NA", "N/A", "XX", "XXX", "XXXX", "TBC", "TBA", "NONE", "NULL", "-",
    "--", ".", "UNKNOWN", "UNDEFINED", "NAN", "STALL", "FOOD", "DRINKS",
    "BEVERAGES", "INDIAN", "WESTERN", "CHINESE", "MALAY", "MUSLIM", "HALAL",
    "CAFE", "RESTAURANT", "CANTEEN", "COFFEESHOP", "FOODCOURT", "EATING HOUSE",
    "MARKET", "STALL9"
}

LANDLORD_PATTERNS = (
    "sfa licensed",
    "fei siong social enterprise",
    "fairprice group hawker centre",
    "kopitiam investment",
    "koufu pte",
    "kimly coffeeshop",
    "s-11 f&b",
    "s 11 f b",
    "broadway food centre",
    "chang cheng",
    "food republic",
    "food junction",
    "capitaland",
    "frasers property",
    "frontline facilities",
    "ntuc foodfare",
)


def is_landlord_or_placeholder(text):
    if not text:
        return True
    s = str(text).strip()
    if not s or s.upper() in JUNK_NAME_TOKENS:
        return True
    s_low = s.lower()
    if any(lp in s_low for lp in LANDLORD_PATTERNS):
        return True
    if re.match(r"^(\(?\s*stall\s*#?\s*\d+|#[0-9b]|\+?\d{6,}|level\s*\d+|address:)", s_low) and "just thai" not in s_low:
        return True
    if s.isdigit() or re.match(r"^[xX]+$", s):
        return True
    return False


def strip_corporate_suffix(corp_name):
    if not corp_name:
        return None
    s = str(corp_name).strip()
    if is_landlord_or_placeholder(s):
        return None
    cleaned = re.sub(
        r"\s*\b(private\s+limited|pte\.?\s*ltd\.?|ltd\.?|llp|inc\.?|corp\.?)\s*\.?$",
        "",
        s,
        flags=re.I,
    ).strip(" ,.-")
    if not cleaned or len(cleaned) < 2 or is_landlord_or_placeholder(cleaned):
        return None
    if cleaned.isupper() and len(cleaned) > 4:
        cleaned = " ".join(w if (len(w) <= 3 and w.isalpha() and not any(v in w for v in "AEIOU")) else w.capitalize() for w in cleaned.split())
    return cleaned


def extract_unit(text):
    if not text:
        return None
    s = str(text)
    m = STALL_UNIT_RE.search(s) or UNIT_RE.search(s)
    if not m:
        return None
    fl = m.group(1).upper().lstrip("0") or "0"
    fl_norm = fl if fl.startswith("B") else fl.zfill(2)
    un = m.group(2).upper().lstrip("0") or "0"
    if un.isdigit():
        un_norm = un.zfill(2)
    else:
        m2 = re.match(r"^(\d+)([A-Z/&-].*)$", un)
        un_norm = (m2.group(1).zfill(2) + m2.group(2)) if m2 else un
    return f"#{fl_norm}-{un_norm}"


def expand_units(u):
    if not u:
        return []
    res = [u]
    m = re.match(r"^#([B0-9]+)-(\d+)[/&-](\d+)$", u)
    if m:
        fl, u1, u2 = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
        res.extend([f"#{fl}-{u1}", f"#{fl}-{u2}"])
    m2 = re.match(r"^#([B0-9]+)-(\d+)[A-Z]$", u)
    if m2:
        res.append(f"#{m2.group(1)}-{m2.group(2).zfill(2)}")
    return list(dict.fromkeys(res))


def extract_postal(text, p_col=None):
    for val in (p_col, text):
        if not val:
            continue
        s = str(val).strip()
        if s.isdigit() and len(s) == 6:
            return s
        if s.isdigit() and len(s) == 5:
            return "0" + s
        m = POSTAL_RE.search(s)
        if m:
            return m.group(1)
        m5 = SG_5DIGIT_RE.search(s)
        if m5:
            return "0" + m5.group(1)
    return None


def norm_tokens(text):
    if not text or is_landlord_or_placeholder(text):
        return set()
    s = re.sub(r"\([^)]*\)", " ", str(text).lower())
    s = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", s)
    return {t for t in s.split() if len(t) > 1 and t not in STOP_TOKENS and not t.isdigit()}


def addr_location_tokens(addr_text):
    if not addr_text:
        return set()
    s = str(addr_text).lower()
    s = UNIT_RE.sub(" ", s)
    s = POSTAL_RE.sub(" ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return {t for t in s.split() if len(t) >= 3 and t not in LOCATION_STOP_TOKENS}


def norm_brand_key(text):
    if not text or is_landlord_or_placeholder(text):
        return ""
    s = str(text).lower()
    s = re.sub(r"\s*\([^)]*\)\s*", " ", s)
    s = re.sub(r"\s*@\s*.*$", "", s)
    s = re.sub(r"\s+-\s+.*$", "", s)
    s = re.sub(r"\b(pte\.?\s*ltd\.?|private\s+limited|llp|enterprise|enterprises|trading|holdings|singapore|sg)\b", "", s)
    s = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", s).strip()
    if not s or is_landlord_or_placeholder(s):
        return ""
    return s


def is_valid_fnb_gmaps(r):
    title = str(r.get("title") or "").strip()
    if not title:
        return False
    t_low = title.lower()
    if t_low in CONTAINER_TITLES:
        return False
    cats = [str(c).lower() for c in (r.get("categories") or []) if c]
    cat_main = str(r.get("category") or "").lower()
    if cat_main and cat_main not in cats:
        cats.append(cat_main)
    all_cat_str = " ".join(cats)
    has_fnb_cat = any(k in all_cat_str for k in FNB_KEYWORDS)
    has_fnb_title = any(k in t_low for k in FNB_KEYWORDS)
    if cats and all(c in NON_FNB_CATS for c in cats) and not has_fnb_title:
        return False
    if cat_main in NON_FNB_CATS and not has_fnb_cat and not has_fnb_title:
        return False
    return True


def clean_website(site):
    if not site:
        return None
    s = str(site).strip()
    if not s or s.lower() in ("none", "null", "undefined", "nil", "nan", "-"):
        return None
    s_lower = s.lower()
    if "google.com/url" in s_lower and "q=" in s_lower:
        from urllib.parse import parse_qs, urlparse
        qs = parse_qs(urlparse(s).query)
        if "q" in qs and qs["q"]:
            s = qs["q"][0].strip()
            s_lower = s.lower()
    if any(m in s_lower for m in MALL_DOMAINS):
        return None
    if any(a in s_lower for a in AGGREGATOR_DOMAINS):
        return None
    if any(so in s_lower for so in SOCIAL_DOMAINS):
        return None
    if "data.gov.sg" in s_lower or "sfa.gov.sg" in s_lower:
        return None
    if not s_lower.startswith(("http://", "https://")):
        s = "https://" + s
    return s


def format_opening_hours(hours_dict):
    if not hours_dict:
        return None
    if isinstance(hours_dict, str):
        s = hours_dict.strip()
        if s and s not in ("Hours not provided", "11:30 AM – 10:00 PM", "{}", "None", "null"):
            return s
        return None
    if not isinstance(hours_dict, dict):
        return None
    parts = []
    days_order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for day in days_order:
        val = hours_dict.get(day) or hours_dict.get(day.capitalize())
        if val:
            if isinstance(val, list):
                val_str = ", ".join(str(x) for x in val if x)
            else:
                val_str = str(val).strip()
            if val_str:
                parts.append(f"{day.capitalize()}: {val_str}")
    return "; ".join(parts) if parts else None


def format_service_options(about_list):
    if not about_list or not isinstance(about_list, list):
        return None
    opts = []
    for section in about_list:
        if isinstance(section, dict) and section.get("id") in ("service_options", "offerings", "dining_options"):
            for o in (section.get("options") or []):
                if isinstance(o, dict) and o.get("enabled") and o.get("name"):
                    opts.append(str(o.get("name")))
    return ", ".join(dict.fromkeys(opts)) if opts else None


def format_amenities(about_list):
    if not about_list or not isinstance(about_list, list):
        return None
    opts = []
    for section in about_list:
        if isinstance(section, dict) and section.get("id") in ("accessibility", "amenities", "atmosphere", "crowd"):
            s_name = section.get("name") or section.get("id")
            for o in (section.get("options") or []):
                if isinstance(o, dict) and o.get("enabled") and o.get("name"):
                    opts.append(f"{s_name}: {o.get('name')}")
    return "; ".join(dict.fromkeys(opts)) if opts else None


def format_payments(about_list, cc_accepted):
    opts = []
    if cc_accepted:
        opts.append("Credit cards")
    if about_list and isinstance(about_list, list):
        for section in about_list:
            if isinstance(section, dict) and section.get("id") in ("payments", "planning"):
                for o in (section.get("options") or []):
                    if isinstance(o, dict) and o.get("enabled") and o.get("name"):
                        opts.append(str(o.get("name")))
    return ", ".join(dict.fromkeys(opts)) if opts else None


def format_reviews_summary(user_reviews):
    if not user_reviews or not isinstance(user_reviews, list):
        return None
    summaries = []
    for rev in user_reviews[:3]:
        if not isinstance(rev, dict):
            continue
        name = rev.get("Name") or "User"
        rating = rev.get("Rating") or ""
        text = str(rev.get("Description") or rev.get("text_original") or "").strip().replace("\n", " ")
        if text:
            if len(text) > 100:
                text = text[:97] + "..."
            summaries.append(f"[{rating}* {name}]: {text}")
    return " | ".join(summaries) if summaries else None


def needs_name_upgrade(fname, rbn):
    if not fname:
        return True, "blank_name"
    s = str(fname).strip()
    if not s or s.upper() in JUNK_NAME_TOKENS:
        return True, "blank_name"
    s_low = s.lower()
    if s_low.startswith("sfa licensed"):
        return True, "sfa_placeholder"
    if re.match(r"^(\(?\s*stall\s*#?\s*\d+|#[0-9b]|\+?\d{6,}|level\s*\d+|address:)", s_low) and "just thai" not in s_low:
        return True, "unit_or_phone_placeholder"
    # Check if raw ACRA corporate entity name
    if re.search(r"\b(pte\.?\s*ltd\.?|llp|private\s+limited|enterprise|enterprises|trading|holdings|investment|investments|f\s*&\s*b\s+pte|catering\s+pte)\b", s_low):
        return True, "corporate_entity_name"
    return False, None


def clean_consumer_stall_name(raw_name):
    if not raw_name:
        return None
    s = str(raw_name).strip()
    if not s or len(s) < 2:
        return None
    if is_landlord_or_placeholder(s):
        return None
    s_low = s.lower()
    if s_low in CONTAINER_TITLES:
        return None
    # Reject bare street addresses used as names (e.g. "208 Syed Alwi Rd")
    if re.match(r"^\d+[a-z]?\s+[a-z\s]+(rd|road|st|street|ave|avenue|dr|drive|ln|lane|way|walk|close|crescent|plaza|mall|hub|centre|center)\b$", s_low):
        return None
    return s


def infer_cuisine_tag(fname, rbn, sec_cats, biz_type, fp_vendor, gm_place, dish_names, canon_cuisine):
    # 1. Foodpanda vendor explicit cuisines
    if fp_vendor and fp_vendor.get("cuisines"):
        c_list = fp_vendor["cuisines"]
        main_c = [c["name"] for c in c_list if c.get("main") and c.get("name")]
        other_c = [c["name"] for c in c_list if not c.get("main") and c.get("name") and c.get("name") not in ("Asian", "Halal")]
        combined = list(dict.fromkeys(main_c + other_c))
        if combined:
            return ", ".join(combined[:2])

    # 2. Canonical CSV cuisine if specific
    if canon_cuisine and str(canon_cuisine).strip() not in ("", "None", "General", "Other", "Unknown", "[]"):
        c_clean = str(canon_cuisine).strip().strip("[]\"'")
        if c_clean:
            return c_clean

    # Combine text signals from name, rbn, secondary categories, gmaps categories, and dish names
    gm_cats = []
    if gm_place:
        if gm_place.get("category"):
            gm_cats.append(str(gm_place.get("category")))
        for c in (gm_place.get("categories") or []):
            if c and str(c) not in gm_cats:
                gm_cats.append(str(c))
    sec_str = f"{sec_cats or ''} {' '.join(gm_cats)}".lower()
    name_str = f"{fname or ''} {rbn or ''}".lower()
    dish_str = " ".join((dish_names or [])[:30]).lower()
    full_text = f"{name_str} {sec_str} {dish_str}"

    # Specific category/keyword rules in priority order
    RULES = [
        (r"\b(peranakan|nonya|nyonya|bibik|candlenut|ivins|violet oon|ayam buah keluak|babi pongteh)\b", "Peranakan / Nonya"),
        (r"\b(bak kut teh|bkt|song fa|ng ah sio|ya hua|founder bak kut teh|tuan yuan)\b", "Chinese, Bak Kut Teh"),
        (r"\b(chicken rice|hainanese chicken|boon tong kee|tian tian|chatterbox|nam kee|ming kee|katong mei wei|five star kampung|tong fong fatt|loy kee|wee nam kee|chicky fun|ok chicken rice)\b", "Chinese, Chicken Rice"),
        (r"\b(dim sum|tim sum|swee choon|tim ho wan|din tai fung|crystal jade|canton paradise|victor's kitchen|sum dim sum|yum cha|xiao long bao|har gow|siew mai|char siew bao|bao zi|pau)\b", "Chinese, Dim Sum & Dumplings"),
        (r"\b(mala|ma la|xiang guo|chongqing|sichuan|szechuan|hunan|dongbei|chuan|skewers|lok lok|acid fish|sauerkraut fish|tai er|yao yao)\b", "Chinese, Sichuan / Mala"),
        (r"\b(hotpot|hot pot|steamboat|haidilao|hai di lao|beauty in the pot|shi li fang|city hot pot|upin hot pot|coucou|shabu|sukiyaki|mookata)\b", "Hotpot / Steamboat"),
        (r"\b(zi char|tze char|zichar|tzechar|keng eng kee|jb ah meng|kok sen|new ubins|two chefs|kimly seafood|mellben|jumbo seafood|long beach|no signboard|red house seafood|palm beach|chilli crab|black pepper crab|salted egg)\b", "Chinese, Zi Char & Seafood"),
        (r"\b(mixed veg|mixed vegetable|economical rice|economy rice|cai png|cai fan|rice garden|chang cheng|pointg|tianjia|curry rice|scissors cut|hainanese curry|beo crescent curry)\b", "Chinese, Mixed Rice & Curry Rice"),
        (r"\b(wanton|wonton|bak chor mee|bcm|minced meat noodle|fishball noodle|fish ball noodle|ban mian|you mian|mee hoon kueh|hokkien mee|prawn noodle|prawn mee|lor mee|kway chap|beef noodle|hock lam|char kway teow|ckt|carrot cake|chye tow kway|laksa|katong laksa|328 katong|sungei road laksa|yong tau foo|ytf|fu lin|bai nian|encik tan|tamjai|la mian|beef kway teow)\b", "Local Hawker, Chinese Noodles"),
        (r"\b(roast|roasted|char siew|sio bak|roast duck|roast pork|kam's roast|kay lee|foong kee|88 hong kong|tian wai tian|diana delight|cantonese|teochew|hokkien|hakka|hainanese|putien|fujian|congee|porridge|frog porridge|claypot|herbal soup|turtle soup|pig's organ|mutton soup|fish soup|sliced fish|han kee|song fish soup|arcade fish soup)\b", "Chinese, Traditional & Soup"),
        (r"\b(ramen|sushi|sashimi|izakaya|omakase|yakiniku|yakitori|tonkatsu|tempura|udon|soba|donburi|tendon|unagi|takoyaki|okonomiyaki|bento|matcha|japanese|genki|sushiro|ichiban|sakae|ippudo|keisuke|ajisen|marugame|monster curry|coco ichibanya|gyu-kaku|aburi-en|sen-ryo|watami|sukiya|yoshinoya|tori-q|mos burger|pepper lunch)\b", "Japanese"),
        (r"\b(korean|kimchi|bibimbap|tteokbokki|bingsu|kbbq|dakgalbi|jjigae|army stew|bulgogi|samgyetang|jinjja|bonchon|4fingers|bbq chicken|bhc|chir chir|paik's|sbcd|seorae|bornga|wang dae bak|mukshidonna|myung rang|o.bba|ajaj|dosirak)\b", "Korean"),
        (r"\b(thai|tom yum|tomyum|pad thai|green curry|boat noodle|mango sticky rice|som tam|nakhon|soi 47|soi thai|diandin|siam kitchen|sanook|ah loy thai|thai express|bali thai|let'sat|tuk tuk cha|cha tra mue)\b", "Thai"),
        (r"\b(vietnamese|pho|banh mi|viet|spring roll|bun cha|so pho|namnam|mrs pho|lang nuong|saigon|hanoi|co chung)\b", "Vietnamese"),
        (r"\b(nasi lemak|nasi padang|ayam penyet|ayam geprek|mee rebus|mee soto|lontong|satay|otah|rendang|gado gado|tahu telur|soto|rawon|bakso|indonesian|malay|warung|dapur|sedap|rumah makan|minang|sabar menanti|hjh maimunah|hajjah|crave|ponggol nasi lemak|selera rasa|boon lay power|chong pang nasi lemak|uncleaki|penyet|kebab|turkish|lebanese|middle eastern|mediterranean|shawarma|falafel|hummus|mezze)\b", "Malay / Indonesian & Halal"),
        (r"\b(indian|prata|roti prata|murtabak|briyani|biryani|tandoori|masala|thosai|dosa|idli|uttapam|chapati|naan|tikka|vindaloo|paneer|chettinad|mutton mysore|fish head curry|mamak|muslim food|al-azhar|al-ameen|rk eating house|casuarina curry|springleaf prata|mr prata|saffrons|bismillah|zam zam|victory restaurant|komala|mtr|ananda bhavan|saravanaa bhavan|kailash parbat|muthu's|banana leaf|sammy's|kns|khansama)\b", "Indian & Indian Muslim"),
        (r"\b(vegetarian|vegan|meatless|plant-based|plant based|greendot|elemen|real food|nomvnom|sufood|eight treasures|gokul|veggie|su shi|zhai)\b", "Vegetarian & Vegan"),
        (r"\b(bubble tea|milk tea|boba|fruit tea|oolong|koi|liho|gong cha|chagee|chicha|each a cup|playmade|itea|heytea|nayuki|mixue|hollin|kebuke|milksha|r&b tea|sharetea|the alley|tiger sugar|mr coconut|coconut shake|boost juice|365 juices|fruit juice|juices|smoothie|sugar cane|sugarcane|beancurd|tau huay|mr bean|jollibean|lao ban|rochortauhuay|grass jelly|herbal tea|zall|beverage|drinks)\b", "Beverages, Bubble Tea & Desserts"),
        (r"\b(bakery|boulangerie|patisserie|cake|pastry|bread|bun|croissant|sourdough|tart|muffin|cupcake|cookie|brownie|waffle|pancake|crepe|gelato|ice cream|sorbet|froyo|llao llao|yole|baskin|haagen|ben & jerry|birds of paradise|apiary|salted caramel|uddens|breadtalk|toast box|ya kun|killiney|fun toast|heavenly wang|old chang kee|polar puffs|bengawan solo|swee heng|prima deli|four leaves|paris baguette|tiong bahru bakery|cedele|awfully chocolate|lady m|chateraise|beard papa|krispy kreme|mister donut|dunkin|j.co|cinnabon|famous amos|bake|bakers|confectionery|dessert|ah balling|chendol|cendol|ice kachang|bingsoo)\b", "Bakery, Desserts & Local Toast"),
        (r"\b(coffee|cafe|espresso|latte|cappuccino|flat white|cold brew|roasters|roastery|starbucks|coffee bean|luckin|flash coffee|arabica|% arabica|huggs|bacha|ps.cafe|common man|tiong hoe|nylon coffee|alchemist|apartment coffee|dutch colony|glasshouse|atlas coffeehouse|kopi)\b", "Cafe & Coffee"),
        (r"\b(fast food|mcdonald|kfc|burger king|subway|jollibee|popeyes|texas chicken|carl's jr|wendy's|shake shack|five guys|wingstop|a&w|long john silver|stuff'd|pizza hut|domino's|little caesars|sarpino's)\b", "Fast Food & Quick Service"),
        (r"\b(italian|pizza|pizzeria|pasta|trattoria|osteria|risotto|lasagna|gnocchi|gelateria|saizeriya|pastamania|peperoni|da paolo|tipo|supply & demand|prego|cucina)\b", "Italian & Pizza"),
        (r"\b(western|steak|steakhouse|ribeye|sirloin|burger|fish & chips|fish and chips|chop|grill|bistro|french|brasserie|mexican|taco|burrito|quesadilla|nachos|guzman|muchachos|tapas|spanish|paella|german|brotzeit|astons|collin's|jack's place|swensen's|earle swensen|hans|han's|marché|marche|poulet|saveur|josh's grill|blacktap|outback|morton's|lawry's|cut by wolfgang|feather blade|bistecca|fish & co|manhattan fish)\b", "Western & European"),
        (r"\b(bar|pub|izakaya|bistro bar|wine bar|cocktail|taproom|brewery|microbrewery|gastropub|lounge|club|liquor|beer|whisky|gin|tipsy|harry's|timbre|brewerkz)\b", "Bar, Pub & Bistro"),
        (r"\b(acai|açaí|salad|poke|grain bowl|healthy|protein bowl|omnivore|daily cut|saladstop|haakon|an acai affair|project acai|poke theory|fishbowl)\b", "Healthy Bowls, Salad & Acai"),
        (r"\b(seafood|fish|crab|prawn|lobster|oyster|shellfish|clam|cockles|bbq stingray|sambal stingray)\b", "Seafood"),
        (r"\b(chinese|cantonese|teochew|hokkien|hainanese|hakka|oriental|imperial|treasure|garden|pavilion|palace|dynasty)\b", "Chinese"),
        (r"\b(catering|caterer|banquet|food service|institutional|central kitchen)\b", "Catering & Food Services"),
    ]

    for pat, label in RULES:
        if re.search(pat, full_text):
            return label

    # Fallback by Secondary Categories or Business Type
    if "restaurant" in sec_str:
        return "Asian & International Dining"
    bt_low = str(biz_type or "").lower()
    if any(k in bt_low for k in ("hawker", "coffeeshop", "eating house", "foodcourt", "food court", "canteen", "stall")):
        return "Local / Hawker Delights"
    if "cater" in bt_low:
        return "Catering & Food Services"
    if any(k in bt_low for k in ("snack", "kiosk", "takeaway", "bakery")):
        return "Snacks & Light Bites"
    return "Local & Multi-Cuisine"


def sync_menu_price_label(menu_url):
    if not menu_url:
        return None
    u = str(menu_url).lower()
    has_fp = "foodpanda.sg" in u
    has_grab = "grab.com" in u
    if has_fp and has_grab:
        return "Delivery menus on Foodpanda and GrabFood"
    if has_fp:
        return "Delivery menu on Foodpanda"
    if has_grab:
        return "Delivery menu on GrabFood"
    return "Official website menu"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write changes to master workbook")
    ap.add_argument("--dry-run", action="store_true", help="Run full simulation and print stats only")
    args = ap.parse_args()

    t0 = time.time()
    print("=== PASS 7: ADDRESS+POSTAL STALL MATCHING, CUISINE TAGS, MENU URLS & STALL LOGOS ===")

    # 1. Load Foodpanda Singapore All Vendors (16,214 vendors)
    print("[1/7] Indexing scratch/foodpanda_sg_all_vendors.json ...")
    with open("scratch/foodpanda_sg_all_vendors.json", "r", encoding="utf-8") as f:
        fp_vendors = json.load(f)

    fp_by_code = {}
    fp_by_pu = defaultdict(list)
    fp_by_p = defaultdict(list)
    fp_by_brand = defaultdict(list)

    for code, v in fp_vendors.items():
        c_low = str(code).lower().strip()
        fp_by_code[c_low] = v
        addr = f"{v.get('address') or ''} {v.get('address_line2') or ''}"
        p = extract_postal(addr, v.get("post_code"))
        u = extract_unit(addr)
        v["_postal"] = p
        v["_unit"] = u
        v["_tokens"] = norm_tokens(v.get("name"))
        if p:
            fp_by_p[p].append(v)
            if u:
                for u_exp in expand_units(u):
                    fp_by_pu[(p, u_exp)].append(v)
        bkey = norm_brand_key(v.get("name"))
        if bkey and len(bkey) >= 3:
            fp_by_brand[bkey].append(v)
        chain_obj = v.get("chain") or {}
        if chain_obj.get("name"):
            ckey = norm_brand_key(chain_obj["name"])
            if ckey and len(ckey) >= 3:
                fp_by_brand[ckey].append(v)

    print(f"  Indexed {len(fp_by_code):,} Foodpanda vendors ({len(fp_by_pu):,} (postal, unit) keys, {len(fp_by_p):,} postals, {len(fp_by_brand):,} brand keys).")

    # 2. Load All Google Maps Crawl JSONLs
    print("[2/7] Indexing Google Maps crawl JSONL datasets ...")
    gmaps_files = [
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/gmaps_fill_12706_resume2/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/gmaps_fill_12706_resume/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/gmaps_fill_12706_full/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/gmaps_fill_12706_zero_a/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/dup_address_crawl/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/sep117_check/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/gmaps_fill_12706_nores_short/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/gmaps_fill_12706_zero_a_retry/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/gmaps_fill_12706_zero_a_retry2/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/oa_96_crawl/results.json",
        "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/oa_placeid_crawl/results.json",
        "data/scrape_results.json",
    ] + sorted(glob.glob("data/review_runs/*/results.json"))

    gm_by_pid = {}
    gm_by_pu = defaultdict(list)
    gm_by_p = defaultdict(list)
    seen_gm = set()

    for gf in gmaps_files:
        if not os.path.exists(gf):
            continue
        with open(gf, "r", encoding="utf-8", errors="replace") as f:
            first_ch = f.read(1)
            f.seek(0)
            recs = json.load(f) if first_ch == "[" else [json.loads(line) for line in f if line.strip()]
        for r in recs:
            if not isinstance(r, dict):
                continue
            pid = str(r.get("place_id") or "").strip()
            dedupe_k = pid or str(r.get("cid") or r.get("link") or "")
            if not dedupe_k or dedupe_k in seen_gm:
                continue
            seen_gm.add(dedupe_k)
            if pid.startswith("ChIJ"):
                gm_by_pid[pid] = r
            if not is_valid_fnb_gmaps(r):
                continue
            addr = str(r.get("address") or "")
            p = extract_postal(addr)
            u = extract_unit(addr)
            r["_postal"] = p
            r["_unit"] = u
            r["_tokens"] = norm_tokens(r.get("title"))
            if p:
                gm_by_p[p].append(r)
                if u:
                    for u_exp in expand_units(u):
                        gm_by_pu[(p, u_exp)].append(r)

    print(f"  Indexed {len(seen_gm):,} unique GMaps places ({len(gm_by_pu):,} F&B (postal, unit) keys, {len(gm_by_p):,} F&B postals).")

    # 3. Load Mall Directories, Canonical CSV & SFA Crosswalks
    print("[3/7] Indexing Mall Directories, Canonical CSV & SFA Crosswalks ...")
    mall_by_pu = defaultdict(list)
    for mp in ["data/malls/all_fnb.json", "data/malls/capitaland_fnb.json", "data/malls/frasers_fnb.json"]:
        if not os.path.exists(mp):
            continue
        with open(mp, "r", encoding="utf-8") as f:
            m_list = json.load(f)
        for m in m_list:
            if not isinstance(m, dict):
                continue
            m_name = str(m.get("mall") or "").strip().lower()
            u = extract_unit(m.get("unit_number"))
            postals = MALL_POSTALS.get(m_name, [])
            m["_tokens"] = norm_tokens(m.get("name"))
            if u and postals:
                for p in postals:
                    for u_exp in expand_units(u):
                        mall_by_pu[(p, u_exp)].append(m)

    sfa_cw_by_lic = {}
    if os.path.exists("data/source_snapshots/blank_fnb_name_sfa_crosswalk_proposal_20261018.json"):
        with open("data/source_snapshots/blank_fnb_name_sfa_crosswalk_proposal_20261018.json", "r", encoding="utf-8") as f:
            cw2 = json.load(f)
        for c in (cw2.get("candidates") or []):
            lic = str(c.get("sfa_licence") or "").strip()
            cname = str(c.get("candidate_licensed_business_name") or "").strip()
            if lic and cname:
                sfa_cw_by_lic[lic] = c

    canon_by_lic = {}
    canon_by_pu = defaultdict(list)
    if os.path.exists("data/singapore_food_businesses_canonical.csv"):
        with open("data/singapore_food_businesses_canonical.csv", "r", encoding="utf-8", errors="replace") as f:
            for r in csv.DictReader(f):
                lic = str(r.get("Licence No") or "").strip()
                p = extract_postal(r.get("Address"), r.get("Postal Code"))
                u = extract_unit(r.get("Unit No.") or r.get("Address"))
                if lic:
                    canon_by_lic[lic] = r
                if p and u:
                    for u_exp in expand_units(u):
                        canon_by_pu[(p, u_exp)].append(r)

    print(f"  Indexed {len(mall_by_pu):,} Mall (postal, unit) keys, {len(canon_by_lic):,} Canonical licences, {len(sfa_cw_by_lic):,} SFA crosswalks.")

    # 4. Load Menu URL Crosswalks & Storefront URLs (Foodpanda + GrabFood)
    print("[4/7] Indexing Menu URL sources (Foodpanda, GrabFood, Crosswalks, Supabase) ...")
    menu_url_by_lic = {}
    for cp, lic_col, url_col in [
        ("data/menus/quarantine-2026-11-08/verified_crosswalk_menu_urls_2026-11-08.csv", "stall_licence_no", "matched_menu_url"),
        ("data/menus/quarantine-2026-11-08/resolved_brand_menu_urls_2026-11-08.csv", "stall_licence_no", "resolved_menu_url"),
        ("data/foodpanda_goal_targets.csv", "SFA Licence", "Menu URL"),
        ("data/foodpanda_supplied_stalls.csv", "SFA Licence", "Menu URL"),
        ("data/foodpanda_unrepresented_targets.csv", "SFA Licence", "Menu URL"),
    ]:
        if os.path.exists(cp):
            with open(cp, "r", encoding="utf-8-sig", errors="replace") as f:
                for r in csv.DictReader(f):
                    lic = str(r.get(lic_col) or "").strip()
                    u = str(r.get(url_col) or "").strip()
                    if lic and u.startswith("http"):
                        menu_url_by_lic.setdefault(lic, u)

    if os.path.exists("data/foodpanda_api_cache.jsonl"):
        with open("data/foodpanda_api_cache.jsonl", "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                d = json.loads(line)
                lic = str(d.get("sfa_licence") or "").strip()
                u = str(d.get("source_url") or "").strip()
                if lic and u.startswith("http"):
                    menu_url_by_lic.setdefault(lic, u)

    # Index Foodpanda & GrabFood storefront URLs by brand/stall tokens and location tokens
    with open("data/foodpanda/foodpanda_singapore_storefront_urls.json", "r", encoding="utf-8") as f:
        fp_store_urls = json.load(f)
    with open("data/grab/grab_singapore_storefront_urls.json", "r", encoding="utf-8") as f:
        grab_store_urls = json.load(f)

    fp_url_by_code = {}
    store_urls_by_token = defaultdict(list)
    brand_menu_urls = defaultdict(list)

    for u in fp_store_urls:
        m = FP_CODE_RE.search(u)
        if m:
            fp_url_by_code[m.group(1).lower()] = u
        slug = u.rstrip("/").split("/")[-1].lower()
        slug = re.sub(r"-[a-z0-9]{4}$", "", slug)
        toks = {t for t in slug.split("-") if len(t) > 1 and t not in STOP_TOKENS and not t.isdigit()}
        all_toks = set(slug.split("-"))
        rec = ("fp", u, toks, all_toks)
        for t in (toks - GENERIC_FOOD_TOKENS):
            store_urls_by_token[t].append(rec)

    for u in grab_store_urls:
        parts = u.rstrip("/").split("/")
        slug = parts[-2].lower() if len(parts) >= 2 else parts[-1].lower()
        slug = re.sub(r"-delivery$", "", slug)
        toks = {t for t in slug.split("-") if len(t) > 1 and t not in STOP_TOKENS and not t.isdigit()}
        all_toks = set(slug.split("-"))
        rec = ("grab", u, toks, all_toks)
        for t in (toks - GENERIC_FOOD_TOKENS):
            store_urls_by_token[t].append(rec)

    print(f"  Indexed {len(menu_url_by_lic):,} licence menu URLs, {len(fp_store_urls):,} FP storefront URLs, {len(grab_store_urls):,} Grab storefront URLs.")

    # 5. Load Stall Logo & Image Sources
    print("[5/7] Indexing Stall Logo & Image datasets ...")
    uploaded_by_key = {}
    uploaded_by_name = {}
    if os.path.exists("data/stall_logos/brand_logo_upload_report.csv"):
        with open("data/stall_logos/brand_logo_upload_report.csv", "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                url = str(r.get("logo_url") or "").strip()
                src_url = str(r.get("source_url") or "").strip()
                best = url if url.startswith("http") else (src_url if src_url.startswith("http") else "")
                if best:
                    uploaded_by_key[str(r.get("brand_key") or "").strip().lower()] = best
                    uploaded_by_name[norm_brand_key(r.get("brand_name"))] = best

    logo_by_lic = {}
    logo_by_brand = dict(uploaded_by_name)

    for logo_xlsx in ["data/stall_logos/stall-logo-candidates-foodpanda-first.xlsx", "data/stall-logo-candidates-checked.xlsx"]:
        if not os.path.exists(logo_xlsx):
            continue
        wb_l = openpyxl.load_workbook(logo_xlsx, read_only=True, data_only=True)
        if "Candidates" in wb_l.sheetnames:
            ws_c = wb_l["Candidates"]
            r_iter = ws_c.iter_rows(values_only=True)
            h_c = [str(x or "").strip() for x in next(r_iter)]
            ic = {k: i for i, k in enumerate(h_c)}
            for r in r_iter:
                bkey = str(r[ic.get("brand_key", 2)] or "").strip().lower()
                bname = norm_brand_key(r[ic.get("brand_name", 1)])
                cands = [
                    uploaded_by_key.get(bkey, ""),
                    str(r[ic["foodpanda_logo_url"]] or "").strip() if "foodpanda_logo_url" in ic else "",
                    str(r[ic["logo_url_to_use"]] or "").strip() if "logo_url_to_use" in ic else "",
                    str(r[ic["final_logo_url"]] or "").strip() if "final_logo_url" in ic else "",
                    str(r[ic["repaired_logo_url"]] or "").strip() if "repaired_logo_url" in ic else "",
                    str(r[ic["icon_logo_url_for_review"]] or "").strip() if "icon_logo_url_for_review" in ic else "",
                    str(r[ic.get("logo_url", 4)] or "").strip(),
                ]
                best = next((u for u in cands if u.startswith("http")), "")
                if not best:
                    continue
                if bname:
                    logo_by_brand.setdefault(bname, best)
                if bkey:
                    logo_by_brand.setdefault(bkey, best)
                vids = str(r[0] or "").split(";")
                for v in vids:
                    v = v.strip()
                    if v.startswith("ven-"):
                        lic = v[4:].replace("SFA-", "").strip()
                        if lic:
                            logo_by_lic.setdefault(lic, best)
        if "Foodpanda Logos" in wb_l.sheetnames:
            ws_fl = wb_l["Foodpanda Logos"]
            r_iter = ws_fl.iter_rows(values_only=True)
            next(r_iter, None)
            for r in r_iter:
                cname = norm_brand_key(r[0])
                furl = str(r[3] or "").strip()
                if cname and furl.startswith("http"):
                    logo_by_brand.setdefault(cname, furl)
        wb_l.close()

    if os.path.exists("data/source_snapshots/foodpanda_singapore_logos_20261019.json"):
        with open("data/source_snapshots/foodpanda_singapore_logos_20261019.json", "r", encoding="utf-8") as f:
            fpl = json.load(f)
        for item in (fpl.get("logos") or []):
            cname = norm_brand_key(item.get("chain_name"))
            lurl = str(item.get("logo_url") or "").strip()
            if cname and lurl.startswith("http"):
                logo_by_brand.setdefault(cname, lurl)

    if os.path.exists("data/source_snapshots/first_party_image_url_review_only_audit_20261018.json"):
        with open("data/source_snapshots/first_party_image_url_review_only_audit_20261018.json", "r", encoding="utf-8") as f:
             fp_img = json.load(f)
        for c in (fp_img.get("candidates") or []):
            iurl = str(c.get("image_url") or "").strip()
            if not iurl.startswith("http"):
                continue
            bname = norm_brand_key(c.get("brand") or c.get("directory_name"))
            if bname:
                logo_by_brand.setdefault(bname, iurl)
            for lic in (c.get("sfa_licences") or []):
                logo_by_lic.setdefault(str(lic).strip(), iurl)

    if os.path.exists("data/Hungry F&B Cleaned Database - 21 Oct 2026.xlsx"):
        wb_cl = openpyxl.load_workbook("data/Hungry F&B Cleaned Database - 21 Oct 2026.xlsx", read_only=True, data_only=True)
        if "Image Candidates" in wb_cl.sheetnames:
            ws_ic = wb_cl["Image Candidates"]
            r_iter = ws_ic.iter_rows(values_only=True)
            next(r_iter, None)
            for r in r_iter:
                lic = str(r[0] or "").strip()
                bname = norm_brand_key(r[1])
                iurl = str(r[3] or "").strip()
                if iurl.startswith("http"):
                    if lic:
                        logo_by_lic.setdefault(lic, iurl)
                    if bname:
                        logo_by_brand.setdefault(bname, iurl)
        wb_cl.close()

    print(f"  Indexed {len(logo_by_lic):,} licence logos and {len(logo_by_brand):,} brand logos.")

    # 6. Load Master Workbook (use clean pre-Pass-7 backup if present)
    input_xlsx = BACKUP_XLSX if os.path.exists(BACKUP_XLSX) else MASTER_XLSX
    print(f"[6/7] Loading Workbook ({input_xlsx}) ...")
    wb = openpyxl.load_workbook(input_xlsx, read_only=not args.apply, data_only=False)
    ws_dir = wb["Food Directory"]
    ws_menu = wb["Menu & Price"]

    # First read Menu & Price to index dishes and dish images per licence/venue
    dishes_by_lic = defaultdict(list)
    dish_img_by_lic = {}
    menu_url_from_dishes_by_lic = {}

    if args.apply:
        menu_rows_iter = ws_menu.iter_rows(min_row=2, values_only=True)
    else:
        menu_rows_iter = ws_menu.iter_rows(min_row=2, values_only=True)

    for r in menu_rows_iter:
        lic = str(r[1] or "").strip()
        dname = str(r[4] or "").strip()
        cat = str(r[5] or "").strip()
        dimg = str(r[8] or "").strip()
        msrc = str(r[9] or "").strip()
        if lic:
            if dname:
                dishes_by_lic[lic].append(f"{dname} {cat}")
            if dimg.startswith("http") and lic not in dish_img_by_lic:
                dish_img_by_lic[lic] = dimg
            if msrc.startswith("http") and lic not in menu_url_from_dishes_by_lic:
                menu_url_from_dishes_by_lic[lic] = msrc

    dir_rows = list(ws_dir.iter_rows(values_only=True))
    hdr = [str(c or "").strip() for c in dir_rows[0]]
    idx = {h: i for i, h in enumerate(hdr)}

    # Pre-scan Food Directory to count postal/unit multiplicity and harvest existing brand Menu URLs & Logos
    dir_postal_counts = Counter()
    dir_pu_counts = Counter()
    active_indices = []

    for r_i, r in enumerate(dir_rows[1:], start=2):
        cov = str(r[idx["Coverage Status"]] or "")
        pub = str(r[idx["Public Access Status"]] or "")
        if "permanently_closed" in cov.lower() or "permanently closed" in pub.lower() or cov.startswith("ARCHIVED"):
            continue
        p = extract_postal(r[idx["Full Address"]], r[idx["Postal Code"]])
        u = extract_unit(r[idx["Full Address"]])
        active_indices.append((r_i, p, u))
        if p:
            dir_postal_counts[p] += 1
            if u:
                dir_pu_counts[(p, u)] += 1

        fname = str(r[idx["F&B Name"]] or "").strip()
        bkey = norm_brand_key(fname)
        murl = str(r[idx["Menu URL"]] or "").strip()
        iurl = str(r[idx["Approved Image URL"]] or "").strip()
        if bkey and len(bkey) >= 3:
            if murl.startswith("http"):
                brand_menu_urls[bkey].append(murl)
            if iurl.startswith("http") and "streetviewpixels" not in iurl:
                logo_by_brand.setdefault(bkey, iurl)

    print(f"  Active directory rows: {len(active_indices):,}")

    # Track claimed (postal, unit) candidates so multiple stalls at the same unit don't claim the same single vendor
    claimed_fp_codes = set()
    claimed_gm_pids = set()

    # Pre-mark already linked Place IDs and Foodpanda codes
    for r_i, p, u in active_indices:
        r = dir_rows[r_i - 1]
        pid = str(r[idx["Google Place ID"]] or "").strip()
        if pid:
            claimed_gm_pids.add(pid)
        murl = str(r[idx["Menu URL"]] or "").strip()
        m = FP_CODE_RE.search(murl)
        if m:
            claimed_fp_codes.add(m.group(1).lower())

    stats = Counter()
    changes = []
    upgraded_name_by_lic = {}

    print("[7/7] Running Pass 7 matching and enrichment across Food Directory ...")

    for r_i, p, u in active_indices:
        row_vals = list(dir_rows[r_i - 1])
        lic = str(row_vals[idx["SFA Licence"]] or "").strip()
        fname = str(row_vals[idx["F&B Name"]] or "").strip()
        rbn = str(row_vals[idx["Registered Business Name"]] or "").strip()
        addr = str(row_vals[idx["Full Address"]] or "").strip()
        biz_type = str(row_vals[idx["Business Type"]] or "").strip()
        cur_murl = str(row_vals[idx["Menu URL"]] or "").strip()
        cur_pid = str(row_vals[idx["Google Place ID"]] or "").strip()

        row_tokens = norm_tokens(fname) | norm_tokens(rbn)
        has_specific_identity = len(row_tokens) > 0

        # --- A1. Match Foodpanda Vendor ---
        fp_match = None
        cur_img_for_code = str(row_vals[idx["Approved Image URL"]] or "").strip()
        m_fp = FP_CODE_RE.search(cur_murl) or LH_CODE_RE.search(cur_img_for_code)
        if m_fp and m_fp.group(1).lower() in fp_by_code:
            fp_match = fp_by_code[m_fp.group(1).lower()]
        if not fp_match and p and u:
            cands = fp_by_pu.get((p, u), [])
            if cands:
                # Score by token overlap first, then unclaimed status
                scored = []
                for v in cands:
                    ov = len(row_tokens & v["_tokens"])
                    unclaimed = 1 if str(v.get("code") or "").lower() not in claimed_fp_codes else 0
                    rev = int(v.get("review_number") or 0)
                    scored.append((ov, unclaimed, rev, v))
                scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
                best_ov, best_uncl, _, best_v = scored[0]
                if best_ov > 0 or dir_pu_counts[(p, u)] == 1 or (not has_specific_identity and best_uncl == 1):
                    fp_match = best_v
                    claimed_fp_codes.add(str(best_v.get("code") or "").lower())
        if not fp_match and p:
            cands = fp_by_p.get(p, [])
            if cands:
                scored = []
                for v in cands:
                    ov = len(row_tokens & v["_tokens"])
                    v_u = v.get("_unit")
                    unit_compat = 1 if (not u or not v_u or u == v_u) else 0
                    unclaimed = 1 if str(v.get("code") or "").lower() not in claimed_fp_codes else 0
                    scored.append((ov, unit_compat, unclaimed, int(v.get("review_number") or 0), v))
                scored.sort(key=lambda x: (x[0], x[1], x[2], x[3]), reverse=True)
                best_ov, unit_compat, best_uncl, _, best_v = scored[0]
                if (best_ov >= 1 and unit_compat == 1) or (not has_specific_identity and dir_postal_counts[p] <= 2 and unit_compat == 1 and best_uncl == 1):
                    fp_match = best_v
                    claimed_fp_codes.add(str(best_v.get("code") or "").lower())

        if fp_match:
            row_tokens |= fp_match["_tokens"]

        # --- A2. Match Mall Directory & Canonical / SFA Crosswalk ---
        mall_match = None
        if p and u and (p, u) in mall_by_pu:
            mcands = mall_by_pu[(p, u)]
            mcands_sorted = sorted(mcands, key=lambda m: len(row_tokens & m["_tokens"]), reverse=True)
            if len(row_tokens & mcands_sorted[0]["_tokens"]) > 0 or dir_pu_counts[(p, u)] == 1:
                mall_match = mcands_sorted[0]
                row_tokens |= mall_match["_tokens"]

        canon_match = canon_by_lic.get(lic)
        if not canon_match and p and u and (p, u) in canon_by_pu and dir_pu_counts[(p, u)] == 1:
            canon_match = canon_by_pu[(p, u)][0]
        sfa_cw_match = sfa_cw_by_lic.get(lic)

        # --- A3. Match Google Maps Place by (Postal, Unit) or Postal ---
        gm_match = gm_by_pid.get(cur_pid) if cur_pid else None
        if not gm_match and p and u:
            cands = gm_by_pu.get((p, u), [])
            if cands:
                scored = []
                for g in cands:
                    ov = len(row_tokens & g["_tokens"])
                    pid_g = str(g.get("place_id") or "")
                    unclaimed = 1 if pid_g not in claimed_gm_pids else 0
                    rev = int(g.get("review_count") or 0)
                    scored.append((ov, unclaimed, rev, g))
                scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
                best_ov, best_uncl, _, best_g = scored[0]
                if best_ov > 0 or dir_pu_counts[(p, u)] == 1 or (not has_specific_identity and best_uncl == 1):
                    gm_match = best_g
                    if best_g.get("place_id"):
                        claimed_gm_pids.add(str(best_g["place_id"]))
        if not gm_match and p:
            cands = gm_by_p.get(p, [])
            if cands:
                scored = []
                for g in cands:
                    ov = len(row_tokens & g["_tokens"])
                    g_u = g.get("_unit")
                    unit_compat = 1 if (not u or not g_u or u == g_u) else 0
                    pid_g = str(g.get("place_id") or "")
                    unclaimed = 1 if pid_g not in claimed_gm_pids else 0
                    rev = int(g.get("review_count") or 0)
                    scored.append((ov, unit_compat, unclaimed, rev, g))
                scored.sort(key=lambda x: (x[0], x[1], x[2], x[3]), reverse=True)
                best_ov, unit_compat, best_uncl, _, best_g = scored[0]
                if (best_ov >= 1 and unit_compat == 1) or (not has_specific_identity and dir_postal_counts[p] <= 2 and unit_compat == 1 and best_uncl == 1):
                    gm_match = best_g
                    if best_g.get("place_id"):
                        claimed_gm_pids.add(str(best_g["place_id"]))

        def set_col(col_name, new_val, reason):
            if new_val is None:
                return False
            s_new = str(new_val).strip()
            if not s_new:
                return False
            c_i = idx[col_name]
            old_val = row_vals[c_i]
            s_old = str(old_val or "").strip()
            if s_old == s_new:
                return False
            row_vals[c_i] = new_val
            if args.apply:
                ws_dir.cell(r_i, c_i + 1).value = new_val
            stats[f"updated_{col_name}"] += 1
            changes.append((r_i, lic, col_name, s_old, s_new, reason))
            return True

        # Clean junk Registered Business Name (e.g. '.')
        if rbn in (".", "-", "NIL", "N/A", "na", "xx", "xxx"):
            row_vals[idx["Registered Business Name"]] = None
            if args.apply:
                ws_dir.cell(r_i, idx["Registered Business Name"] + 1).value = None
            changes.append((r_i, lic, "Registered Business Name", rbn, "", "clean_junk_rbn_token"))
            rbn = ""

        # --- B1. Obtain / Upgrade F&B Name (Col 1) & Preserve Registered Business Name (Col 2) ---
        need_name, name_reason = needs_name_upgrade(fname, rbn)
        if need_name:
            orig_corp_tokens = norm_tokens(fname) | norm_tokens(rbn)
            single_unit_stall = bool(p and u and dir_pu_counts[(p, u)] == 1)
            cand_names = []
            if mall_match and mall_match.get("name"):
                cand_names.append((clean_consumer_stall_name(mall_match["name"]), "mall_directory_unit_postal_match"))
            if fp_match and fp_match.get("name"):
                cand_names.append((clean_consumer_stall_name(fp_match["name"]), "foodpanda_unit_postal_match"))
            if gm_match and gm_match.get("title"):
                cand_names.append((clean_consumer_stall_name(gm_match["title"]), "gmaps_unit_postal_match"))
            if canon_match and canon_match.get("Stall / Restaurant Name"):
                cand_names.append((clean_consumer_stall_name(canon_match["Stall / Restaurant Name"]), "canonical_csv_match"))
            if sfa_cw_match and sfa_cw_match.get("candidate_licensed_business_name"):
                cand_names.append((clean_consumer_stall_name(sfa_cw_match["candidate_licensed_business_name"]), "sfa_crosswalk_match"))
            if name_reason == "corporate_entity_name":
                cand_names.append((strip_corporate_suffix(fname), "corporate_suffix_stripped"))
            if name_reason in ("blank_name", "sfa_placeholder", "unit_or_phone_placeholder") and rbn:
                cand_names.append((strip_corporate_suffix(rbn) or clean_consumer_stall_name(rbn), "registered_business_name_fallback"))
            if fname in (".", "-", "NIL", "N/A", "na", "xx", "xxx"):
                cand_names.append((f"SFA Licensed Food Establishment ({lic or f'Row {r_i}'})", "clean_junk_name_placeholder"))

            for c_name, c_src in cand_names:
                if c_name and c_name.lower() != fname.lower():
                    if name_reason == "corporate_entity_name":
                        if re.search(r"\b(pte\.?\s*ltd\.?|llp)\b", c_name.lower()):
                            continue
                        # At multi-stall units, only replace a corporate name with an external match if tokens overlap
                        if c_src != "corporate_suffix_stripped" and not single_unit_stall:
                            if len(orig_corp_tokens & norm_tokens(c_name)) == 0:
                                continue
                    if not rbn and fname and not is_landlord_or_placeholder(fname):
                        set_col("Registered Business Name", fname, "preserve_rbn_before_fnb_name_upgrade")
                        rbn = fname
                    if set_col("F&B Name", c_name, f"pass7_name_{name_reason}_via_{c_src}"):
                        fname = c_name
                        stats[f"name_from_{c_src}"] += 1
                        if lic:
                            upgraded_name_by_lic[lic] = c_name
                        break

        # --- B2. Populate Missing Postal Code (Col 14) ---
        if p and not str(row_vals[idx["Postal Code"]] or "").strip():
            set_col("Postal Code", p, "extracted_6digit_postal_from_address")

        # --- B3. Populate Google Place ID (Col 24) & Google Maps URL (Col 25) ---
        if gm_match:
            pid = str(gm_match.get("place_id") or "").strip()
            glink = str(gm_match.get("link") or "").strip()
            if pid.startswith("ChIJ") and not str(row_vals[idx["Google Place ID"]] or "").strip():
                set_col("Google Place ID", pid, "pass7_address_postal_gmaps_match")
                if not glink.startswith("http"):
                    glink = f"https://www.google.com/maps/search/?api=1&query=Google&query_place_id={pid}"
                set_col("Google Maps URL", glink, "pass7_address_postal_gmaps_match")
            elif str(row_vals[idx["Google Place ID"]] or "").strip().startswith("ChIJ") and not str(row_vals[idx["Google Maps URL"]] or "").strip():
                cur_p = str(row_vals[idx["Google Place ID"]]).strip()
                set_col("Google Maps URL", glink if glink.startswith("http") else f"https://www.google.com/maps/search/?api=1&query=Google&query_place_id={cur_p}", "pass7_gmaps_url_parity")

            # Coordinates if missing
            if not str(row_vals[idx["Latitude"]] or "").strip() or not str(row_vals[idx["Longitude"]] or "").strip():
                try:
                    lat = float(gm_match.get("latitude") or 0.0)
                    lng = float(gm_match.get("longitude") or gm_match.get("longtitude") or 0.0)
                    if 1.15 <= lat <= 1.48 and 103.60 <= lng <= 104.05:
                        set_col("Latitude", round(lat, 7), "pass7_gmaps_rooftop_coords")
                        set_col("Longitude", round(lng, 7), "pass7_gmaps_rooftop_coords")
                        if not str(row_vals[idx["Coordinate Precision"]] or "").strip():
                            set_col("Coordinate Precision", "ROOFTOP", "pass7_gmaps_rooftop_coords")
                except Exception:
                    pass

        # --- B4. Populate Opening Hours / Closed Days (Col 9) ---
        if not str(row_vals[idx["Opening Hours / Closed Days"]] or "").strip():
            hrs = None
            if gm_match:
                hrs = format_opening_hours(gm_match.get("open_hours"))
            if not hrs and mall_match:
                hrs = format_opening_hours(mall_match.get("opening_hours"))
            if not hrs and canon_match:
                hrs = format_opening_hours(canon_match.get("Opening Hours"))
            if hrs:
                set_col("Opening Hours / Closed Days", hrs, "pass7_address_postal_hours_match")

        # --- B5. Populate Contact Details (Col 10) ---
        if not str(row_vals[idx["Contact Details"]] or "").strip():
            phone = None
            if gm_match and gm_match.get("phone"):
                phone = str(gm_match["phone"]).strip()
            if not phone and fp_match and fp_match.get("customer_phone"):
                phone = str(fp_match["customer_phone"]).strip()
            if not phone and mall_match and mall_match.get("phone"):
                phone = str(mall_match["phone"]).strip()
            if not phone and canon_match and canon_match.get("Contact"):
                phone = str(canon_match["Contact"]).strip()
            if phone and phone not in ("None", "null", "-", "N/A") and re.search(r"\d{4}", phone):
                set_col("Contact Details", phone, "pass7_address_postal_contact_match")

        # --- B6. Populate Website (Col 11, Gate 3 filtered) ---
        if not str(row_vals[idx["Website"]] or "").strip():
            site = None
            if gm_match:
                site = clean_website(gm_match.get("web_site"))
            if not site and fp_match:
                site = clean_website(fp_match.get("website"))
            if not site and mall_match:
                site = clean_website(mall_match.get("website"))
            if site:
                set_col("Website", site, "pass7_address_postal_website_match")

        # --- B7. Populate Rating / Review Count (Col 18) ---
        if not str(row_vals[idx["Rating / Review Count"]] or "").strip():
            rat_str = None
            if gm_match:
                try:
                    rt = float(gm_match.get("review_rating") or 0.0)
                    rc = int(gm_match.get("review_count") or 0)
                    if 1.0 <= rt <= 5.0 and rc > 0:
                        rat_str = f"{rt:.1f} ({rc} reviews)"
                except Exception:
                    pass
            if not rat_str and fp_match:
                try:
                    rt = float(fp_match.get("rating") or 0.0)
                    rc = int(fp_match.get("review_number") or 0)
                    if 1.0 <= rt <= 5.0 and rc > 0:
                        rat_str = f"{rt:.1f} ({rc} reviews)"
                except Exception:
                    pass
            if rat_str:
                set_col("Rating / Review Count", rat_str, "pass7_address_postal_rating_match")

        # --- B8. Populate Secondary Categories, Price Range, Service Options, Amenities, Payments, Reviews Summary ---
        if not str(row_vals[idx["Secondary Categories"]] or "").strip():
            scats = None
            if gm_match and isinstance(gm_match.get("categories"), list) and gm_match["categories"]:
                scats = ", ".join(str(x) for x in gm_match["categories"] if x)
            elif fp_match and isinstance(fp_match.get("cuisines"), list) and fp_match["cuisines"]:
                scats = ", ".join(str(c.get("name")) for c in fp_match["cuisines"] if c.get("name"))
            elif mall_match and isinstance(mall_match.get("category"), list) and mall_match["category"]:
                scats = ", ".join(str(x) for x in mall_match["category"] if x)
            if scats:
                set_col("Secondary Categories", scats, "pass7_secondary_categories_match")

        if not str(row_vals[idx["Price Range"]] or "").strip():
            pr = None
            if gm_match and str(gm_match.get("price_range") or "").strip() in ("$", "$$", "$$$", "$$$$"):
                pr = str(gm_match["price_range"]).strip()
            elif fp_match and fp_match.get("budget") in (1, 2, 3, 4):
                pr = "$" * int(fp_match["budget"])
            if pr:
                set_col("Price Range", pr, "pass7_price_range_match")

        if gm_match:
            if not str(row_vals[idx["Service Options"]] or "").strip():
                srv = format_service_options(gm_match.get("about"))
                if srv:
                    set_col("Service Options", srv, "pass7_gmaps_service_options")
            if not str(row_vals[idx["Accessibility & Amenities"]] or "").strip():
                amen = format_amenities(gm_match.get("about"))
                if amen:
                    set_col("Accessibility & Amenities", amen, "pass7_gmaps_amenities")
            if not str(row_vals[idx["Payment Methods"]] or "").strip():
                pay = format_payments(gm_match.get("about"), gm_match.get("credit_cards_accepted"))
                if pay:
                    set_col("Payment Methods", pay, "pass7_gmaps_payments")
            if not str(row_vals[idx["Customer Reviews Summary"]] or "").strip():
                rev_s = format_reviews_summary(gm_match.get("user_reviews"))
                if rev_s:
                    set_col("Customer Reviews Summary", rev_s, "pass7_gmaps_reviews_summary")

        # --- C. Fill Cuisine Tag (Col 7) ---
        cur_cuisine = str(row_vals[idx["Cuisine"]] or "").strip()
        if not cur_cuisine or cur_cuisine.lower() in ("none", "null", "unknown", "general", "food", "restaurant", "-"):
            mp_dish_text = str(row_vals[idx["Menu / Price"]] or "").strip()
            combined_dishes = list(dishes_by_lic.get(lic, []))
            if mp_dish_text.startswith("Observed delivery menu items:"):
                combined_dishes.append(mp_dish_text)
            inferred_c = infer_cuisine_tag(
                fname=fname,
                rbn=rbn,
                sec_cats=row_vals[idx["Secondary Categories"]],
                biz_type=biz_type,
                fp_vendor=fp_match,
                gm_place=gm_match,
                dish_names=combined_dishes,
                canon_cuisine=canon_match.get("Cuisine") if canon_match else None,
            )
            if inferred_c:
                set_col("Cuisine", inferred_c, "pass7_multi_layer_cuisine_inference")

        # --- D. Expand Menu URL Coverage (Col 12) & Synchronize Menu / Price (Col 8) ---
        cur_murl = str(row_vals[idx["Menu URL"]] or "").strip()
        if not cur_murl:
            new_murl = None
            murl_src = None

            # D1. Licence crosswalks or Menu & Price dish source URLs
            if lic in menu_url_by_lic:
                new_murl = menu_url_by_lic[lic]
                murl_src = "licence_crosswalk"
            elif lic in menu_url_from_dishes_by_lic:
                new_murl = menu_url_from_dishes_by_lic[lic]
                murl_src = "menu_sheet_source_url"

            # D2. Matched Foodpanda vendor redirection_url or LH code in Approved Image URL
            if not new_murl and fp_match:
                rurl = str(fp_match.get("redirection_url") or "").strip()
                vcode = str(fp_match.get("code") or "").strip().lower()
                if rurl.startswith("http"):
                    new_murl = rurl
                    murl_src = "foodpanda_address_postal_vendor"
                elif vcode in fp_url_by_code:
                    new_murl = fp_url_by_code[vcode]
                    murl_src = "foodpanda_vendor_code_storefront"
            if not new_murl:
                m_lh = LH_CODE_RE.search(str(row_vals[idx["Approved Image URL"]] or ""))
                if m_lh:
                    lh_code = m_lh.group(1).lower()
                    if lh_code in fp_url_by_code:
                        new_murl = fp_url_by_code[lh_code]
                        murl_src = "foodpanda_lh_image_code_storefront"
                    else:
                        new_murl = f"https://www.foodpanda.sg/restaurant/{lh_code}"
                        murl_src = "foodpanda_lh_image_code_shortlink"

            # D3. Storefront URL slug match (Foodpanda 20,975 + GrabFood 22,676) by brand + location tokens
            if not new_murl:
                name_toks = norm_tokens(fname) | norm_tokens(rbn)
                dist_name_toks = name_toks - GENERIC_FOOD_TOKENS
                loc_toks = addr_location_tokens(addr)
                cand_recs = []
                seen_u = set()
                for t in list(dist_name_toks)[:4]:
                    for rec in store_urls_by_token.get(t, []):
                        if rec[1] not in seen_u:
                            seen_u.add(rec[1])
                            cand_recs.append(rec)
                best_fp_u = None
                best_grab_u = None
                best_fp_score = 0
                best_grab_score = 0
                for plat, u_str, u_name_toks, u_all_toks in cand_recs:
                    dist_u_toks = u_name_toks - GENERIC_FOOD_TOKENS
                    dist_ov = len(dist_name_toks & dist_u_toks)
                    name_ov = len(name_toks & u_name_toks)
                    loc_ov = len(loc_toks & u_all_toks)
                    # Require distinctive brand token overlap + location match
                    if dist_ov >= 1 and (
                        (dist_ov >= 2 and loc_ov >= 1)
                        or (dist_ov >= 1 and name_ov >= 2 and loc_ov >= 2)
                        or (len(dist_name_toks) >= 2 and dist_name_toks <= dist_u_toks and loc_ov >= 1)
                        or (dist_ov >= 3 and dist_ov == len(dist_u_toks))
                    ):
                        score = dist_ov * 4 + name_ov * 2 + loc_ov * 2
                        if plat == "fp" and score > best_fp_score:
                            best_fp_score = score
                            best_fp_u = u_str
                        elif plat == "grab" and score > best_grab_score:
                            best_grab_score = score
                            best_grab_u = u_str
                if best_fp_u and best_grab_u:
                    new_murl = f"{best_fp_u} | {best_grab_u}"
                    murl_src = "storefront_slug_dual_fp_grab"
                elif best_fp_u:
                    new_murl = best_fp_u
                    murl_src = "storefront_slug_fp"
                elif best_grab_u:
                    new_murl = best_grab_u
                    murl_src = "storefront_slug_grab"

            # D4. Brand / Chain Menu URL propagation
            if not new_murl:
                for b_cand in (norm_brand_key(fname), norm_brand_key(rbn)):
                    if b_cand and len(b_cand) >= 3:
                        if b_cand in brand_menu_urls:
                            new_murl = brand_menu_urls[b_cand][0]
                            murl_src = "brand_chain_menu_url"
                            break
                        elif b_cand in fp_by_brand:
                            v0 = fp_by_brand[b_cand][0]
                            rurl = str(v0.get("redirection_url") or "").strip()
                            if rurl.startswith("http"):
                                new_murl = rurl
                                murl_src = "foodpanda_brand_chain_vendor"
                                break

            # D5. Google Maps menu.link / order_online or verified first-party Website
            if not new_murl and gm_match:
                m_obj = gm_match.get("menu")
                if isinstance(m_obj, dict) and str(m_obj.get("link") or "").strip().startswith("http"):
                    m_link = clean_website(m_obj["link"]) or (str(m_obj["link"]).strip() if any(d in str(m_obj["link"]).lower() for d in ("foodpanda.sg", "grab.com", "oddle.me", "inline.app", "tabsquare.com")) else None)
                    if m_link:
                        new_murl = m_link
                        murl_src = "gmaps_menu_link"
            if not new_murl and str(row_vals[idx["Website"]] or "").strip().startswith("http"):
                new_murl = str(row_vals[idx["Website"]]).strip()
                murl_src = "verified_official_website_menu"

            if new_murl:
                set_col("Menu URL", new_murl, f"pass7_menu_url_{murl_src}")
                stats[f"menu_url_from_{murl_src}"] += 1
                cur_murl = new_murl
                # If new_murl has a Foodpanda code, link fp_match if not yet linked
                m_fp2 = FP_CODE_RE.search(cur_murl)
                if m_fp2 and not fp_match and m_fp2.group(1).lower() in fp_by_code:
                    fp_match = fp_by_code[m_fp2.group(1).lower()]

        # Ensure Menu / Price (Col 8) is synchronized when blank or when dual-host parity requires it
        if cur_murl:
            expected_mp = sync_menu_price_label(cur_murl)
            cur_mp = str(row_vals[idx["Menu / Price"]] or "").strip()
            if not cur_mp:
                set_col("Menu / Price", expected_mp, "pass7_sync_menu_price_label")
            elif "Delivery menus on Foodpanda and GrabFood" in cur_mp and not ("foodpanda.sg" in cur_murl.lower() and "grab.com" in cur_murl.lower()):
                set_col("Menu / Price", expected_mp, "pass7_fix_dual_delivery_parity_label")

        # --- E. Link Stall Logo / Storefront Image to Approved Image URL (Col 19) ---
        cur_img = str(row_vals[idx["Approved Image URL"]] or "").strip()
        is_streetview = "streetviewpixels" in cur_img.lower()
        if not cur_img or is_streetview:
            new_img = None
            img_src = None

            # E1. Licence-exact logo (Brandfetch / Foodpanda / First-Party Image Candidates)
            if lic in logo_by_lic:
                new_img = logo_by_lic[lic]
                img_src = "licence_exact_logo"

            # E2. Brand-exact logo (Uploaded Supabase brand-logos / Foodpanda chain logos / First-Party)
            if not new_img:
                for b_cand in (norm_brand_key(fname), norm_brand_key(rbn)):
                    if b_cand and b_cand in logo_by_brand:
                        new_img = logo_by_brand[b_cand]
                        img_src = "brand_exact_logo"
                        break

            # E3. Matched Foodpanda vendor logo / hero_listing_image / deterministic 4-char code CDN
            if not new_img and fp_match:
                for img_k in ("logo", "hero_listing_image", "hero_image"):
                    cand_u = str(fp_match.get(img_k) or "").strip()
                    if cand_u.startswith("http"):
                        new_img = cand_u
                        img_src = f"foodpanda_vendor_{img_k}"
                        break
            if not new_img and cur_murl:
                m_fp3 = FP_CODE_RE.search(cur_murl)
                if m_fp3:
                    code4 = m_fp3.group(1).lower()
                    if code4 in fp_by_code:
                        v_obj = fp_by_code[code4]
                        for img_k in ("logo", "hero_listing_image", "hero_image"):
                            cand_u = str(v_obj.get(img_k) or "").strip()
                            if cand_u.startswith("http"):
                                new_img = cand_u
                                img_src = f"foodpanda_code_{img_k}"
                                break
                    if not new_img:
                        new_img = f"https://images.deliveryhero.io/image/fd-sg/LH/{code4}-listing.jpg"
                        img_src = "foodpanda_cdn_listing_image"

            # E4. Verified dish image from Menu & Price for this stall
            if not new_img and lic in dish_img_by_lic:
                new_img = dish_img_by_lic[lic]
                img_src = "verified_menu_dish_image"

            # E5. Google Maps Place photo / thumbnail (only if cur_img is empty)
            if not new_img and not cur_img and gm_match:
                imgs = gm_match.get("images") or []
                if isinstance(imgs, list):
                    for im_obj in imgs:
                        im_u = str(im_obj.get("image") if isinstance(im_obj, dict) else im_obj or "").strip()
                        if im_u.startswith("http"):
                            new_img = im_u
                            img_src = "gmaps_place_photo"
                            break
                if not new_img:
                    th = str(gm_match.get("thumbnail") or "").strip()
                    if th.startswith("http"):
                        new_img = th
                        img_src = "gmaps_place_thumbnail"

            if new_img:
                set_col("Approved Image URL", new_img, f"pass7_stall_logo_{img_src}")
                stats[f"logo_from_{img_src}"] += 1
                bkey_now = norm_brand_key(fname)
                if bkey_now and len(bkey_now) >= 3 and "streetviewpixels" not in new_img:
                    logo_by_brand.setdefault(bkey_now, new_img)

    # Sync upgraded F&B Venue Names in Menu & Price sheet
    menu_name_sync_count = 0
    if upgraded_name_by_lic and args.apply:
        for m_row in range(2, ws_menu.max_row + 1):
            m_lic = str(ws_menu.cell(m_row, 2).value or "").strip()
            if m_lic in upgraded_name_by_lic:
                old_vn = str(ws_menu.cell(m_row, 1).value or "").strip()
                new_vn = upgraded_name_by_lic[m_lic]
                if old_vn != new_vn:
                    ws_menu.cell(m_row, 1).value = new_vn
                    menu_name_sync_count += 1
    stats["menu_sheet_venue_names_synced"] = menu_name_sync_count

    print("\n=== PASS 7 SUMMARY STATS ===")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v:,}")
    print(f"  total_cell_changes: {len(changes):,}")

    if not args.apply:
        wb.close()
        print(f"\nDry-run completed in {time.time() - t0:.2f}s (no files modified).")
        return

    # Backup before saving (do not overwrite existing pre-Pass-7 backup)
    if not os.path.exists(BACKUP_XLSX):
        print(f"\nCreating pre-Pass-7 backup at {BACKUP_XLSX} ...")
        shutil.copy2(MASTER_XLSX, BACKUP_XLSX)
    with open(BACKUP_XLSX, "rb") as f:
        bak_sha = hashlib.sha256(f.read()).hexdigest()
    print(f"Pre-Pass-7 Backup SHA-256: {bak_sha}")

    # Append to Change Manifest sheet and write CSV
    ws_cm = wb["Change Manifest"]
    start_chg_idx = ws_cm.max_row
    now_str = "2026-11-11T10:40:00+08:00"
    with open(MANIFEST_CSV, "w", newline="", encoding="utf-8") as mf:
        w = csv.writer(mf)
        w.writerow(["change_id", "timestamp", "sheet", "row", "sfa_licence", "column", "old_value", "new_value", "reason"])
        for i, (r_i, lic, col_name, s_old, s_new, reason) in enumerate(changes, start=1):
            cid = f"CHG-{start_chg_idx + i:06d}"
            w.writerow([cid, now_str, "Food Directory", r_i, lic, col_name, s_old, s_new, reason])
            if i <= 25000:
                ws_cm.append([cid, "Food Directory", f"Row {r_i} ({lic})", col_name, s_old[:250], s_new[:250], reason, "Pass 7 Address+Postal Enrichment", now_str])

    print(f"Saving updated Master Workbook to {MASTER_XLSX} ...")
    wb.save(MASTER_XLSX)
    wb.close()

    with open(MASTER_XLSX, "rb") as f:
        new_bytes = f.read()
        new_sha = hashlib.sha256(new_bytes).hexdigest()
    print(f"Saved {MASTER_XLSX} ({len(new_bytes):,} bytes, SHA-256: {new_sha})")

    with zipfile.ZipFile(MASTER_XLSX, "r") as z:
        bad = z.testzip()
        if bad is not None:
            print(f"ERROR: ZIP integrity check failed on {bad}")
            sys.exit(1)
    print(f"ZIP integrity: PASS (completed in {time.time() - t0:.2f}s)")


if __name__ == "__main__":
    main()
