#!/usr/bin/env python3
"""Structured cuisine and taste profiles for common Singapore dishes.

The table is intentionally deterministic and source-controlled.  It gives the
catalog exporter a precise first pass while leaving its broader keyword
fallback available for dishes that are not represented here.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


TasteVector = dict[str, int]


@dataclass(frozen=True)
class DishTaxonomyEntry:
    canonical_name: str
    aliases: tuple[str, ...]
    cuisine_category: str
    taste_tags: tuple[str, ...]
    taste_vector: TasteVector


TASTE_PROFILES: dict[str, tuple[tuple[str, ...], TasteVector]] = {
    "aromatic_rice": (("Aromatic", "Savoury", "Comforting"), {"sweet": 3, "spicy": 3, "sour": 2, "salty": 6, "rich": 6, "aromatic": 8}),
    "coconut_rice": (("Lemak", "Aromatic", "Savoury"), {"sweet": 4, "spicy": 5, "sour": 2, "salty": 6, "rich": 8, "aromatic": 8}),
    "spicy_noodle": (("Spicy", "Rich", "Aromatic"), {"sweet": 3, "spicy": 8, "sour": 4, "salty": 7, "rich": 8, "aromatic": 8}),
    "fried_noodle": (("Wok Hei", "Savoury", "Umami"), {"sweet": 3, "spicy": 3, "sour": 2, "salty": 8, "rich": 7, "aromatic": 7}),
    "soup_noodle": (("Comforting", "Savoury", "Aromatic"), {"sweet": 3, "spicy": 3, "sour": 2, "salty": 6, "rich": 5, "aromatic": 7}),
    "tangy_noodle": (("Tangy", "Savoury", "Aromatic"), {"sweet": 4, "spicy": 5, "sour": 7, "salty": 6, "rich": 5, "aromatic": 7}),
    "curry": (("Spiced", "Rich", "Aromatic"), {"sweet": 3, "spicy": 7, "sour": 3, "salty": 6, "rich": 8, "aromatic": 9}),
    "clear_soup": (("Light", "Comforting", "Umami"), {"sweet": 2, "spicy": 2, "sour": 2, "salty": 6, "rich": 3, "aromatic": 5}),
    "braised": (("Rich", "Savoury", "Herbal"), {"sweet": 4, "spicy": 2, "sour": 2, "salty": 7, "rich": 8, "aromatic": 8}),
    "grilled": (("Smoky", "Savoury", "Juicy"), {"sweet": 4, "spicy": 4, "sour": 2, "salty": 7, "rich": 7, "aromatic": 8}),
    "seafood": (("Umami", "Savoury", "Rich"), {"sweet": 4, "spicy": 5, "sour": 3, "salty": 8, "rich": 7, "aromatic": 7}),
    "toast": (("Toasty", "Sweet", "Comforting"), {"sweet": 7, "spicy": 1, "sour": 1, "salty": 4, "rich": 6, "aromatic": 7}),
    "coffee": (("Aromatic", "Roasted", "Bold"), {"sweet": 5, "spicy": 1, "sour": 3, "salty": 1, "rich": 5, "aromatic": 9}),
    "tea": (("Aromatic", "Refreshing", "Smooth"), {"sweet": 5, "spicy": 1, "sour": 2, "salty": 1, "rich": 3, "aromatic": 8}),
    "cold_drink": (("Refreshing", "Sweet", "Creamy"), {"sweet": 8, "spicy": 1, "sour": 3, "salty": 1, "rich": 5, "aromatic": 5}),
    "dessert": (("Sweet", "Refreshing", "Indulgent"), {"sweet": 9, "spicy": 1, "sour": 3, "salty": 2, "rich": 6, "aromatic": 6}),
    "steamed": (("Delicate", "Savoury", "Umami"), {"sweet": 3, "spicy": 2, "sour": 2, "salty": 6, "rich": 4, "aromatic": 6}),
    "fried": (("Crispy", "Savoury", "Rich"), {"sweet": 3, "spicy": 3, "sour": 2, "salty": 7, "rich": 8, "aromatic": 6}),
    "fresh": (("Fresh", "Balanced", "Umami"), {"sweet": 3, "spicy": 2, "sour": 3, "salty": 5, "rich": 3, "aromatic": 5}),
    "western": (("Hearty", "Savoury", "Rich"), {"sweet": 3, "spicy": 2, "sour": 2, "salty": 7, "rich": 8, "aromatic": 6}),
}


def _entry(
    canonical_name: str,
    cuisine_category: str,
    profile: str,
    *aliases: str,
) -> DishTaxonomyEntry:
    tags, vector = TASTE_PROFILES[profile]
    return DishTaxonomyEntry(
        canonical_name=canonical_name,
        aliases=(canonical_name, *aliases),
        cuisine_category=cuisine_category,
        taste_tags=tags,
        taste_vector=vector,
    )


# More than the initial 50 common dish types are included so adjacent common
# variants resolve without adding broad, error-prone single-word rules.
DISH_TAXONOMY: tuple[DishTaxonomyEntry, ...] = (
    _entry("Hainanese Chicken Rice", "Singaporean", "aromatic_rice", "chicken rice", "steamed chicken rice", "roasted chicken rice"),
    _entry("Nasi Lemak", "Malay", "coconut_rice"),
    _entry("Laksa", "Singaporean", "spicy_noodle", "katong laksa", "curry laksa"),
    _entry("Char Kway Teow", "Singaporean", "fried_noodle", "char kuay teow", "fried kway teow"),
    _entry("Hokkien Mee", "Singaporean", "fried_noodle", "fried hokkien prawn mee", "prawn hokkien mee"),
    _entry("Bak Chor Mee", "Singaporean", "soup_noodle", "minced meat noodle", "minced pork noodle"),
    _entry("Wanton Mee", "Chinese", "soup_noodle", "wonton mee", "wanton noodle", "wonton noodle"),
    _entry("Fishball Noodles", "Chinese", "soup_noodle", "fish ball noodle", "fishball noodle"),
    _entry("Mee Rebus", "Malay", "tangy_noodle"),
    _entry("Mee Siam", "Malay", "tangy_noodle"),
    _entry("Mee Soto", "Malay", "soup_noodle"),
    _entry("Roti Prata", "Indian", "fried", "roti canai", "plain prata", "egg prata"),
    _entry("Nasi Briyani", "Indian", "aromatic_rice", "nasi biryani", "chicken briyani", "mutton briyani", "biryani"),
    _entry("Nasi Padang", "Malay", "coconut_rice"),
    _entry("Economy Rice", "Chinese", "aromatic_rice", "economic rice", "mixed vegetable rice", "cai png", "chap chye png"),
    _entry("Hainanese Curry Rice", "Singaporean", "curry", "curry rice"),
    _entry("Yong Tau Foo", "Chinese", "clear_soup", "yong tofu"),
    _entry("Fish Soup", "Chinese", "clear_soup", "sliced fish soup", "fried fish soup", "fish head soup"),
    _entry("Bak Kut Teh", "Singaporean", "braised", "pork rib tea", "pork rib soup"),
    _entry("Kway Chap", "Chinese", "braised", "kuay chap"),
    _entry("Lor Mee", "Chinese", "soup_noodle"),
    _entry("Prawn Noodles", "Singaporean", "soup_noodle", "prawn mee", "har mee"),
    _entry("Ban Mian", "Chinese", "soup_noodle", "mee hoon kueh", "handmade noodle"),
    _entry("Curry Chicken", "Singaporean", "curry", "chicken curry"),
    _entry("Satay", "Malay", "grilled", "chicken satay", "beef satay", "mutton satay"),
    _entry("Sambal Stingray", "Singaporean", "seafood", "bbq stingray", "ikan pari"),
    _entry("Chilli Crab", "Singaporean", "seafood", "chili crab"),
    _entry("Black Pepper Crab", "Singaporean", "seafood", "pepper crab"),
    _entry("Oyster Omelette", "Singaporean", "fried", "orh luak", "oyster egg"),
    _entry("Chai Tow Kway", "Singaporean", "fried_noodle", "fried carrot cake", "radish cake"),
    _entry("Kaya Toast", "Singaporean", "toast"),
    _entry("Kopi", "Singaporean Beverage", "coffee", "kopi o", "kopi c"),
    _entry("Teh Tarik", "Malay Beverage", "tea", "pulled tea"),
    _entry("Milo Dinosaur", "Singaporean Beverage", "cold_drink", "iced milo", "milo drink"),
    _entry("Bubble Tea", "Taiwanese Beverage", "cold_drink", "boba tea", "pearl milk tea"),
    _entry("Ice Kachang", "Singaporean Dessert", "dessert", "ais kacang"),
    _entry("Chendol", "Singaporean Dessert", "dessert", "cendol"),
    _entry("Tau Huay", "Chinese Dessert", "dessert", "soy beancurd", "soya beancurd", "dou hua"),
    _entry("Dim Sum", "Cantonese", "steamed", "siew mai", "siu mai", "har gow"),
    _entry("Dumplings", "Chinese", "steamed", "jiaozi", "guo tie", "potstickers"),
    _entry("Fried Rice", "Chinese", "fried_noodle", "yangzhou fried rice", "yang chow fried rice"),
    _entry("Claypot Rice", "Chinese", "braised", "clay pot rice"),
    _entry("Congee", "Chinese", "clear_soup", "rice porridge", "chicken porridge", "fish porridge"),
    _entry("Murtabak", "Indian Muslim", "fried", "martabak"),
    _entry("Tandoori Chicken", "Indian", "grilled"),
    _entry("Butter Chicken", "Indian", "curry", "murgh makhani"),
    _entry("Masala Dosa", "Indian", "fried", "dosai", "thosai"),
    _entry("Bibimbap", "Korean", "aromatic_rice", "stone pot bibimbap"),
    _entry("Bulgogi", "Korean", "grilled", "bulgogi beef", "bulgogi chicken"),
    _entry("Korean Fried Chicken", "Korean", "fried", "yangnyeom chicken"),
    _entry("Sushi", "Japanese", "fresh", "sushi platter", "nigiri"),
    _entry("Sashimi", "Japanese", "fresh", "sashimi platter"),
    _entry("Ramen", "Japanese", "soup_noodle", "tonkotsu ramen", "shoyu ramen", "miso ramen"),
    _entry("Udon", "Japanese", "soup_noodle", "udon noodle", "kitsune udon"),
    _entry("Tempura", "Japanese", "fried", "prawn tempura", "vegetable tempura"),
    _entry("Tonkatsu", "Japanese", "fried", "pork katsu", "chicken katsu"),
    _entry("Donburi", "Japanese", "aromatic_rice", "gyudon", "oyakodon", "rice bowl"),
    _entry("Teriyaki Chicken", "Japanese", "grilled", "chicken teriyaki"),
    _entry("Thai Green Curry", "Thai", "curry", "green curry"),
    _entry("Tom Yum", "Thai", "tangy_noodle", "tom yam", "tom yum soup"),
    _entry("Pad Thai", "Thai", "fried_noodle"),
    _entry("Mango Sticky Rice", "Thai Dessert", "dessert"),
    _entry("Pho", "Vietnamese", "soup_noodle", "beef pho", "chicken pho"),
    _entry("Banh Mi", "Vietnamese", "toast", "vietnamese sandwich"),
    _entry("Beef Noodles", "Chinese", "soup_noodle", "beef noodle soup", "taiwan beef noodle"),
    _entry("Burger", "Western", "western", "cheeseburger", "chicken burger", "beef burger"),
    _entry("Pizza", "Italian", "western", "margherita pizza", "pepperoni pizza"),
    _entry("Pasta", "Italian", "western", "spaghetti", "carbonara", "aglio olio", "bolognese"),
    _entry("Fish and Chips", "Western", "fried", "fish & chips"),
    _entry("Steak", "Western", "grilled", "beef steak", "sirloin steak", "ribeye steak"),
    _entry("Waffles", "Western Dessert", "dessert", "waffle"),
    _entry("Pancakes", "Western Dessert", "dessert", "pancake"),
    _entry("Cheesecake", "Western Dessert", "dessert", "cheese cake"),
    _entry("Chocolate Cake", "Western Dessert", "dessert", "chocolate fudge cake"),
)


def normalize_dish_name(value: str) -> str:
    """Normalize punctuation and accents while preserving token boundaries."""

    ascii_text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.lower()).strip()


_ALIAS_INDEX: tuple[tuple[str, DishTaxonomyEntry], ...] = tuple(
    sorted(
        (
            (normalize_dish_name(alias), entry)
            for entry in DISH_TAXONOMY
            for alias in entry.aliases
            if normalize_dish_name(alias)
        ),
        key=lambda item: len(item[0]),
        reverse=True,
    )
)


def lookup_dish_taxonomy(dish_name: str) -> DishTaxonomyEntry | None:
    """Return the most specific taxonomy entry contained in a dish name."""

    normalized = normalize_dish_name(dish_name)
    if not normalized:
        return None
    padded = f" {normalized} "
    for alias, entry in _ALIAS_INDEX:
        if normalized == alias or f" {alias} " in padded:
            return entry
    return None
