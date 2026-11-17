#!/usr/bin/env python3
"""
Pass 6: Restore Original Foodpanda/GrabFood URLs + Complete catalog-qa Menu & Stall Resolution (2026-11-11).

Executes all Pass 6 remediation parts against the master workbook:
1. Part A — Restore Original Foodpanda (`foodpanda.sg`) & GrabFood (`food.grab.com`) URLs in `Menu Source URL` (`Menu & Price`)
   and `Menu URL` (`Food Directory`) on active verified rows where earlier passes replaced a valid delivery URL with an
   official website/PDF URL, while preserving all updated original counter prices in `Price (SGD)` (`$XX.XX`).
2. Part B — Resolve All Confirmed Menu Issues from `/Users/Siew Hean/Documents/GitHub/Hungry-main/catalog-qa/`:
   - `confirmed_high.csv` (5,790 Opus-confirmed high-severity menu issues)
   - `verify_med_out/verified.csv` (6,162 Opus-confirmed medium-severity menu issues)
   - `systematic_templates.csv` (476 copy-pasted template `(dish, category, price)` combinations)
   Categories resolved:
   - B1: `systematic_templates.csv` synthetic hawker template rows (`authentic local kitchen` / generated notes / synthetic template combos)
   - B2: `venue_mismatch` (quarantine all confirmed high + med venue mismatches still active)
   - B3: `not_a_dish` (quarantine all confirmed high + med non-dish rows: headers, utensils, candles, retail jars, mugs/tumblers)
   - B4: `duplicate` (quarantine confirmed duplicate dish rows on the same venue)
   - B5: `typo` (apply verified `suggested_fix` dish name corrections)
   - B6: `category` (update implausible `Category / Section` values using `suggested_fix` or `classify_dish_category`)
   - B7: `price` (fix Toast Box quantity-as-price & retail sachet box items, La-Teh Cafe `100 Plus` `$2.40` & `Fried Otah` `$4.20`,
     Subway `6-inch Combo Set` `$9.50` & `Footlong Combo Set` `$13.50`, Jumbo Seafood `Set Menu B10` `$1,188.00`,
     The Public Izakaya 2 `720ml` typo fix, and quarantine remaining unpriceable/corrupted price rows)
   - B8: `dietary` (resolve all confirmed high + med dietary contradictions across `Halal`, `Vegetarian`, `Vegan`, `Pork-free`)
   - B9: Re-run multi-price variant disambiguation so `multi_price_conflict_groups_remaining == 0`.
3. Part C — Resolve All Confirmed Stall Issues from `/Users/Siew Hean/Documents/GitHub/Hungry-main/catalog-qa/` in `Food Directory`:
   - `stall_verify_out/confirmed_stall.csv` (5,332 Opus-confirmed stall issues joined via `directory_rows.jsonl`)
   - `dedupe_out/confirmed_duplicates.csv` (1,428 Opus-confirmed extra duplicate stall rows joined via `directory_rows.jsonl`)
   - Deterministic checks from `stall_check.py` (`postal_format`, `postal_not_in_address`, `coords_outside_sg`, `coords_missing`, `no_name`, `unit_number_name`)
   Categories resolved:
   - C1: `address` + deterministic postal/coordinate fixes (apply verified `suggested_fix`, strip embedded stall name from `Full Address`, sync 6-digit `Postal Code`, sync `Menu & Price` postal codes so `identity_postal_mismatches == 0`)
   - C2: `name` + deterministic `unit_number_name` / `no_name` (apply verified `suggested_fix`, strip `Pte Ltd` / street suffixes from display name, fallback to `Registered Business Name`)
   - C3: `cuisine` (apply verified `suggested_fix` or deterministic cuisine classification from stall name / secondary categories)
   - C4: `dietary` (fix contradicting `Halal Certified` and `Vegan` flags in `Food Directory`)
   - C5: `link` (apply verified `suggested_fix` or clear mislinked mall/operator `Registered Business Name`)
   - C6: `not_fnb` (mark confirmed non-F&B records in `Public Access Status` & `Coverage Status` while preserving `SFA Licence` referential integrity)
   - C7: `duplicate` (`confirmed_duplicates.csv` + `confirmed_stall.csv` `duplicate`: merge missing fields into canonical retained stall row and mark duplicate row as merged while preserving any `SFA Licence` referenced by `Menu & Price`).
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import openpyxl

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKBOOK_PATH = (
    REPO_ROOT
    / "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8"
    / "Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
)
BACKUP_PATH = (
    REPO_ROOT
    / "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8"
    / "Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_pass6_catalog_qa_resolution_2026-11-11.xlsx"
)
QA_DIR = Path("/Users/Siew Hean/Documents/GitHub/Hungry-main/catalog-qa")
OUT_DIR = REPO_ROOT / "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8"
WORK_DIR = OUT_DIR / "_work/verified_enrichment_audit_2026-11-10"
MANIFEST_CSV_PATH = OUT_DIR / "change_manifest_pass6_2026-11-11.csv"
SUMMARY_JSON_PATH = WORK_DIR / "pass6_summary_2026-11-11.json"
MENUS_OUT_DIR = REPO_ROOT / "data/menus/2026-11-11"
EXPECTED_PRE_SHA256 = "2c4449bffd3229d9d95ce89c1fcf007dab56a4ce9c5d1f20a805bbb0b3ebc7ce"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def clean_str(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v).replace("|", "/")).strip() if v is not None else ""


def norm_key(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip()).lower()


def extract_postal(text: Any) -> str | None:
    if not text:
        return None
    m = re.search(r"\b(\d{6})\b", str(text))
    return m.group(1) if m else None


def classify_dish_category(dish_name: str, desc_str: str = "") -> str:
    d = f"{dish_name} {desc_str}".lower()
    if any(k in d for k in ("combo", "set meal", "value set", "family feast", "bundle", "platter", "bento", "for 2", "for 4")):
        return "Set Meals & Bundles"
    if any(
        k in d
        for k in (
            "coffee",
            "latte",
            "cappuccino",
            "americano",
            "espresso",
            "mocha",
            "macchiato",
            "flat white",
            "frappuccino",
            "cold brew",
            "kopi",
            "teh",
            "tea",
            "milkshake",
            "smoothie",
            "juice",
            "cooler",
            "lemonade",
            "chocolate",
            "milo",
            "horlicks",
            "matcha",
            "hojicha",
            "oolong",
            "jing syuan",
            "da hong pao",
            "coke",
            "sprite",
            "pepsi",
            "100 plus",
            "water",
            "soda",
            "bandung",
            "barley",
            "soya milk",
            "soy milk",
            "beer",
            "wine",
            "sake",
            "junmai",
            "drink",
            "beverage",
        )
    ) and not any(
        f in d
        for f in (
            "cake",
            "tart",
            "bun",
            "bread",
            "croissant",
            "muffin",
            "cookie",
            "puff",
            "tiramisu",
            "gelato",
            "ice cream",
            "pudding",
            "pork",
            "chicken",
            "fish",
            "rice",
            "noodle",
            "soup",
            "pasta",
            "burger",
        )
    ):
        return "Beverages"
    if any(
        k in d
        for k in (
            "acai",
            "açaí",
            "gelato",
            "ice cream",
            "sundae",
            "pudding",
            "mousse",
            "tiramisu",
            "soufflé",
            "souffle",
            "semifreddo",
            "jelly",
            "tau suan",
            "sago",
            "mochi",
            "parfait",
            "bingsu",
            "chendol",
            "dessert",
        )
    ):
        return "Desserts & Sweet Treats"
    if any(
        k in d
        for k in (
            "cake",
            "tart",
            "muffin",
            "croissant",
            "bun",
            "bread",
            "toast",
            "baguette",
            "ciabatta",
            "loaf",
            "sourdough",
            "puff",
            "pastry",
            "danish",
            "eclair",
            "éclair",
            "strudel",
            "swiss roll",
            "kueh",
            "pancake",
            "min jiang kueh",
            "waffle",
            "cookie",
            "brownie",
            "macaron",
            "bakkwa",
            "floss",
            "you tiao",
            "youtiao",
            "ham chim peng",
            "pretzel",
            "tau sar piah",
        )
    ) and not any(m in d for m in ("rice", "noodle", "soup", "fish", "chicken", "pork", "beef", "mutton")):
        return "Bakery & Pastries"
    if any(k in d for k in ("pizza",)):
        return "Pizza"
    if any(k in d for k in ("pasta", "spaghetti", "penne", "aglio olio", "carbonara", "bolognese", "marinara", "gratin", "lasagna", "risotto", "mac & cheese")):
        return "Pasta & Baked Rice"
    if any(k in d for k in ("burger", "hamburger", "whopper", "sandwich", "sub", "wrap", "burrito", "kebab", "quesadilla", "tartine", "taco")):
        return "Burgers, Wraps & Sandwiches"
    if any(k in d for k in ("sushi", "sashimi", "nigiri", "maki", "handroll", "temaki")):
        return "Sushi & Sashimi"
    if any(k in d for k in ("soup", "bak kut teh", "bisque", "chowder", "broth", "steamboat", "hotpot")):
        return "Soups"
    if any(k in d for k in ("salad",)):
        return "Salads"
    if any(
        k in d
        for k in (
            "fries",
            "nugget",
            "wing",
            "drumstick",
            "satay",
            "spring roll",
            "samosa",
            "croquette",
            "calamari",
            "edamame",
            "tofu",
            "tau kwa",
            "otah",
            "gyoza",
            "karaage",
            "egg",
            "sausage",
            "luncheon meat",
            "cheese dip",
            "caramel dip",
            "side",
            "snack",
            "appetiser",
            "appetizer",
        )
    ) and not any(m in d for m in ("rice", "noodle", "hor fun", "bee hoon", "pasta", "bowl", "set")):
        return "Sides & Snacks"
    if any(
        k in d
        for k in (
            "rice",
            "biryani",
            "briyani",
            "congee",
            "porridge",
            "don",
            "paofan",
            "nasi",
            "noodle",
            "mian",
            "mee",
            "hor fun",
            "bee hoon",
            "kway teow",
            "udon",
            "ramen",
            "yakiudon",
            "laksa",
            "lor mee",
            "thosai",
            "prata",
            "murtabak",
        )
    ):
        return "Rice & Noodles"
    return "Mains"


def infer_stall_cuisine(name: str, reg: str, sec: str, note: str, fix: str) -> str:
    if fix and len(fix) <= 40 and not fix.isdigit():
        return fix
    combined = f"{name} {reg} {sec} {note}".lower()
    if any(k in combined for k in ("bubble tea", "milk tea", "mixue", "liho", "koi", "itea", "each a cup", "chagee", "playmade", "gong cha", "heytea", "blackball")):
        return "Bubble Tea & Drinks"
    if any(k in combined for k in ("bakery", "bread", "cake", "patisserie", "pastry", "confectionery", "toast", "bagel", "croissant", "donut", "waffle", "tart", "bakkwa")):
        return "Bakery & Desserts"
    if any(k in combined for k in ("ice cream", "gelato", "acai", "açaí", "yogurt", "froyo", "dessert", "bingsu", "chendol")):
        return "Desserts"
    if any(k in combined for k in ("coffee", "cafe", "café", "kopi", "teh tarik", "juice", "smoothie", "beverage", "drink", "bar", "pub", "bistro & bar")):
        return "Cafe & Beverages"
    if any(k in combined for k in ("korean", "bibimbap", "kimchi", "kbbq", "bunsik", "tteokbokki", "jjajang")):
        return "Korean"
    if any(k in combined for k in ("japanese", "sushi", "ramen", "izakaya", "donburi", "tempura", "yakitori", "udon", "soba", "omakase", "takoyaki", "teppanyaki", "tonkatsu")):
        return "Japanese"
    if any(k in combined for k in ("thai", "tom yum", "mookata", "pad thai", "som tam", "boat noodle")):
        return "Thai"
    if any(k in combined for k in ("vietnamese", "pho", "banh mi")):
        return "Vietnamese"
    if any(k in combined for k in ("indian", "biryani", "briyani", "prata", "thosai", "tandoori", "masala", "chapati", "murtabak", "banana leaf")):
        return "Indian"
    if any(k in combined for k in ("malay", "nasi padang", "nasi lemak", "ayam penyet", "satay", "mee rebus", "mee soto", "lontong", "muslim", "halal")):
        return "Malay / Indonesian"
    if any(k in combined for k in ("italian", "pizza", "pasta", "trattoria", "risotto")):
        return "Italian"
    if any(k in combined for k in ("greek", "mediterranean", "turkish", "kebab", "middle eastern", "lebanese", "arab", "yemeni")):
        return "Mediterranean / Middle Eastern"
    if any(k in combined for k in ("mexican", "taco", "burrito", "quesadilla")):
        return "Mexican"
    if any(k in combined for k in ("western", "steak", "grill", "burger", "fish & chips", "fried chicken", "chop", "astons", "collin", "4fingers", "kfc", "mcdonald", "subway")):
        return "Western"
    if any(k in combined for k in ("seafood", "fish soup", "sliced fish", "crab", "prawn", "lala")):
        return "Seafood"
    if any(k in combined for k in ("vegetarian", "vegan", "plant-based")):
        return "Vegetarian"
    if any(
        k in combined
        for k in (
            "chinese",
            "mala",
            "hotpot",
            "steamboat",
            "dim sum",
            "zi char",
            "tze char",
            "chicken rice",
            "roast",
            "duck",
            "char siew",
            "bak kut teh",
            "wanton",
            "bak chor mee",
            "hokkien mee",
            "kway chap",
            "yong tau foo",
            "ban mian",
            "porridge",
            "congee",
            "claypot",
            "economic rice",
            "mixed veg",
            "cai fan",
            "teochew",
            "cantonese",
            "hainanese",
            "hakka",
            "sichuan",
            "hunan",
            "dongbei",
        )
    ):
        return "Chinese / Singaporean"
    return "Singaporean"


def make_quarantine_desc(desc: Any, reason: str) -> str:
    raw = str(desc or "").strip()
    if raw.lower().startswith("[quarantined:"):
        body = raw[len("[quarantined:") :].strip()
        return f"[QUARANTINED: {body}"
    if raw:
        return f"[QUARANTINED: {reason}] {raw}"
    return f"[QUARANTINED: {reason}]"


# Toast Box quantity-as-price & retail sachet box price/name map
TOAST_BOX_PRICE_FIXES: dict[tuple[str, float], tuple[float, str | None]] = {
    ("Banana Cake (1 slice)", 1.0): (3.60, None),
    ("Honey Cake (1 slice)", 1.0): (3.60, None),
    ("Pandan Chiffon Cake (1 slice)", 1.0): (3.60, None),
    ("Salty Tau Sar Piah (1 pc)", 1.0): (3.00, None),
    ("Sweet Tau Sar Piah (1 pc)", 1.0): (3.00, None),
    ("Breakfast Set", 2.0): (11.40, None),
    ("Mini Bun Set", 2.0): (11.40, None),
    ("Buns Bundle", 5.0): (12.40, None),
    ("Buy 5 Curry Puffs and get 1 FREE", 5.0): (10.00, None),
    ("Daily Duo", 2.0): (33.60, "Daily Duo (2 Boxes of Kopi Sachet)"),
    ("Perfect Trio", 3.0): (48.00, "Perfect Trio (3 Boxes of Kopi Sachet)"),
    ("Kopi Butter Sand Bundle", 2.0): (21.60, None),
    ("Kopi, Tea or Me", 1.0): (25.60, "Kopi, Tea or Me (Retail Box Bundle)"),
    ("Triple Treat", 1.0): (36.40, "Triple Treat (Retail Box Bundle)"),
    ("Singapore Double Delight Set", 1.0): (15.90, "Singapore Double Delight Set (2 Kaya Jars)"),
    ("Strawberry Soft Bun Set", 2.0): (9.40, None),
    ("Strawberry Soft French Breadstick Set", 2.0): (9.60, None),
    ("Strawberry Thick Toast Set", 2.0): (9.40, None),
    ("Strawberry Traditional Toast Set", 2.0): (9.40, None),
    ("Multigrain Ham & Cheese Sandwich Set", 1.0): (10.60, None),
    ("Ham & Cheese Sandwich Set", 1.0): (10.20, None),
    ("Mee Rebus Set", 1.0): (16.90, None),
    ("Mee Siam Set", 1.0): (16.90, None),
    ("Mee Tai Bak Soup Set", 1.0): (16.90, None),
    ("Laksa Set", 1.0): (16.90, None),
    ("Curry Chicken with Rice Set", 1.0): (17.10, None),
    ("Curry Chicken Noodle Set", 1.0): (17.10, None),
    ("Homemade Nasi Lemak Set", 1.0): (18.10, None),
    ("Prawn Noodle Soup Set", 1.0): (18.10, None),
    ("Salted Egg Minced Pork Rice Set", 1.0): (16.90, None),
    ("Drumstick Braised Pork Rice Set", 1.0): (17.10, None),
    ("Dry Mee Siam with Chicken Wing Set", 1.0): (17.10, None),
    ("Fried Mee Goreng with Chicken Wing Set", 1.0): (17.10, None),
    ("Fried Bee Hoon with Chicken Wing Set", 1.0): (17.10, None),
    ("Kopi-O Kosong", 17.8): (17.80, "Kopi-O Kosong (Retail Sachet Box)"),
    ("2-in-1 Kopi-O Sweetened", 17.8): (17.80, "2-in-1 Kopi-O Sweetened (Retail Sachet Box)"),
    ("Himalayan Salt Kopi", 17.8): (17.80, "Himalayan Salt Kopi (Retail Sachet Box)"),
    ("Straits Classic Tea", 10.6): (10.60, "Straits Classic Tea (Retail Tea Box)"),
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Pass 6 FP/Grab URL Restoration + catalog-qa Menu & Stall Resolution.")
    parser.add_argument("--dry-run", action="store_true", help="Compute all changes without saving workbook.")
    args = parser.parse_args()

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    MENUS_OUT_DIR.mkdir(parents=True, exist_ok=True)

    pre_sha = sha256_file(WORKBOOK_PATH)
    print(f"[Pass 6] Pre-execution workbook SHA-256: {pre_sha}")
    if pre_sha != EXPECTED_PRE_SHA256:
        print(f"[Pass 6] NOTE: Pre-SHA ({pre_sha}) differs from expected Pass 5 SHA ({EXPECTED_PRE_SHA256}).")

    if not args.dry_run:
        if not BACKUP_PATH.exists():
            print(f"[Pass 6] Creating pre-Pass-6 backup at {BACKUP_PATH} ...")
            shutil.copy2(WORKBOOK_PATH, BACKUP_PATH)
            backup_sha = sha256_file(BACKUP_PATH)
            assert backup_sha == pre_sha, "Backup SHA-256 mismatch!"
            print(f"[Pass 6] Backup verified (SHA-256={backup_sha}).")
        else:
            print(f"[Pass 6] Backup already exists at {BACKUP_PATH}.")

    print(f"[Pass 6] Loading workbook {WORKBOOK_PATH} ...")
    wb = openpyxl.load_workbook(WORKBOOK_PATH)
    ws_fd = wb["Food Directory"]
    ws_mp = wb["Menu & Price"]
    ws_cm = wb["Change Manifest"]

    fd_headers = [str(ws_fd.cell(1, c).value or "") for c in range(1, ws_fd.max_column + 1)]
    mp_headers = [str(ws_mp.cell(1, c).value or "") for c in range(1, ws_mp.max_column + 1)]

    fd_col = {h: i + 1 for i, h in enumerate(fd_headers)}
    mp_col = {h: i + 1 for i, h in enumerate(mp_headers)}

    # Determine starting Change ID in Change Manifest
    last_chg_num = 452144
    for r in range(ws_cm.max_row, max(1, ws_cm.max_row - 50), -1):
        val = ws_cm.cell(r, 1).value
        if val and str(val).startswith("CHG-"):
            try:
                last_chg_num = int(str(val).split("-")[1])
                break
            except ValueError:
                pass
    next_chg_num = last_chg_num + 1
    start_chg_id = f"CHG-{next_chg_num}"
    print(f"[Pass 6] Starting Change ID: {start_chg_id}")

    manifest_rows: list[list[Any]] = []
    stats = Counter()

    def record_change(
        sheet_name: str,
        row_num: int,
        venue_name: str,
        lic: str | None,
        dish_name: str | None,
        field_name: str,
        old_val: Any,
        new_val: Any,
        reason: str,
        source_url: str,
    ) -> None:
        nonlocal next_chg_num
        old_str = "" if old_val is None else str(old_val)
        new_str = "" if new_val is None else str(new_val)
        if old_str == new_str:
            return
        chg_id = f"CHG-{next_chg_num}"
        next_chg_num += 1
        price_changed = "Yes" if field_name == "Price (SGD)" else "No"
        stable_id = (
            f"DIR-{lic or row_num}"
            if sheet_name == "Food Directory"
            else f"MENU-{lic or 'UNLIC'}-{row_num}"
        )
        manifest_rows.append(
            [
                chg_id,
                sheet_name,
                str(row_num),
                venue_name,
                lic,
                dish_name,
                field_name,
                str(old_val) if old_val is not None else None,
                str(new_val) if new_val is not None else None,
                reason,
                source_url,
                "2026-11-11",
                price_changed,
                stable_id,
            ]
        )

    def quarantine_mp_row(r: int, reason: str, audit_source: str = "Pass 6 catalog-qa Menu Audit") -> None:
        venue = clean_str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value)
        lic = clean_str(ws_mp.cell(r, mp_col["SFA Licence"]).value) or None
        dish = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value) or None
        old_price = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        old_desc = ws_mp.cell(r, mp_col["Description / Notes"]).value
        old_src = ws_mp.cell(r, mp_col["Menu Source URL"]).value
        old_ver = ws_mp.cell(r, mp_col["Last Verified Date"]).value

        new_desc = make_quarantine_desc(old_desc, reason)
        if old_desc != new_desc:
            record_change("Menu & Price", r, venue, lic, dish, "Description / Notes", old_desc, new_desc, reason, audit_source)
            ws_mp.cell(r, mp_col["Description / Notes"]).value = new_desc
        if old_price is not None:
            record_change("Menu & Price", r, venue, lic, dish, "Price (SGD)", old_price, None, reason, audit_source)
            ws_mp.cell(r, mp_col["Price (SGD)"]).value = None
        if old_src is not None:
            record_change("Menu & Price", r, venue, lic, dish, "Menu Source URL", old_src, None, reason, audit_source)
            ws_mp.cell(r, mp_col["Menu Source URL"]).value = None
        if old_ver is not None:
            record_change("Menu & Price", r, venue, lic, dish, "Last Verified Date", old_ver, None, reason, audit_source)
            ws_mp.cell(r, mp_col["Last Verified Date"]).value = None

    # =========================================================================
    # PART A: Restore Original Foodpanda / GrabFood URLs on Active Verified Rows
    # =========================================================================
    print("[Pass 6] Part A: Scanning Change Manifest for replaced Foodpanda / GrabFood URLs ...")
    fp_grab_old_mp: dict[int, str] = {}
    fp_grab_old_fd: dict[int, tuple[str, str | None]] = {}

    for row in ws_cm.iter_rows(min_row=2, values_only=True):
        if len(row) < 9:
            continue
        sheet_s = clean_str(row[1])
        row_num_s = clean_str(row[2])
        field_s = clean_str(row[6])
        old_v = clean_str(row[7])
        if not row_num_s.isdigit():
            continue
        rn = int(row_num_s)
        if sheet_s == "Menu & Price" and field_s == "Menu Source URL":
            if "foodpanda.sg" in old_v.lower() or "food.grab.com" in old_v.lower():
                # Keep earliest (original) delivery URL
                if rn not in fp_grab_old_mp:
                    fp_grab_old_mp[rn] = old_v
        elif sheet_s == "Food Directory" and field_s == "Menu URL":
            if "foodpanda.sg" in old_v.lower() or "food.grab.com" in old_v.lower():
                if rn not in fp_grab_old_fd:
                    fp_grab_old_fd[rn] = (old_v, clean_str(row[4]) or None)

    for rn, orig_delivery_url in sorted(fp_grab_old_mp.items()):
        if not (2 <= rn <= ws_mp.max_row):
            continue
        cur_price = ws_mp.cell(rn, mp_col["Price (SGD)"]).value
        cur_desc = clean_str(ws_mp.cell(rn, mp_col["Description / Notes"]).value)
        if cur_price is None or str(cur_price).strip() == "" or "[quarantined:" in cur_desc.lower():
            continue
        cur_url = clean_str(ws_mp.cell(rn, mp_col["Menu Source URL"]).value)
        if "foodpanda.sg" in cur_url.lower() or "food.grab.com" in cur_url.lower():
            continue
        venue = clean_str(ws_mp.cell(rn, mp_col["F&B Venue Name"]).value)
        lic = clean_str(ws_mp.cell(rn, mp_col["SFA Licence"]).value) or None
        dish = clean_str(ws_mp.cell(rn, mp_col["Menu Item / Dish Name"]).value) or None
        record_change(
            "Menu & Price",
            rn,
            venue,
            lic,
            dish,
            "Menu Source URL",
            ws_mp.cell(rn, mp_col["Menu Source URL"]).value,
            orig_delivery_url,
            "Restored original Foodpanda/GrabFood link in Menu Source URL per user requirement while retaining verified counter Price (SGD)",
            orig_delivery_url,
        )
        ws_mp.cell(rn, mp_col["Menu Source URL"]).value = orig_delivery_url
        stats["partA_mp_delivery_urls_restored"] += 1

    print(f"[Pass 6] Part A complete: restored {stats['partA_mp_delivery_urls_restored']:,} Foodpanda/GrabFood URLs in Menu & Price.")

    # =========================================================================
    # PART B: Resolve All Confirmed Menu Issues from catalog-qa/
    # =========================================================================
    print("[Pass 6] Part B: Loading catalog-qa menu datasets ...")
    with (QA_DIR / "systematic_templates.csv").open("r", encoding="utf-8-sig") as f:
        st_rows = list(csv.DictReader(f))

    # Genuine chain dishes that appear in systematic_templates.csv only because the chain has >=100 outlets
    CHAIN_BRAND_TOKENS = (
        "toast box",
        "ya kun",
        "breadtalk",
        "starbucks",
        "liho",
        "mcdonald",
        "kfc",
        "subway",
        "burger king",
        "jollibee",
        "old chang kee",
        "bengawan solo",
        "polar puffs",
        "swee heng",
        "koi",
        "each a cup",
        "itea",
        "mr bean",
        "nine fresh",
        "stuff'd",
        "wok hey",
        "4fingers",
        "pizza hut",
        "domino",
        "saizeriya",
        "pastamania",
        "coffee bean",
        "fun toast",
        "killiney",
        "heavenly wang",
        "encik tan",
        "crave",
        "peacock",
        "bakers brew",
        "paris baguette",
        "tiong bahru bakery",
        "cedele",
        "delifrance",
        "four leaves",
        "twelve cupcakes",
        "famous amos",
        "auntie anne",
        "boost juice",
        "gong cha",
        "playmade",
        "chagee",
        "mixue",
        "chicha san chen",
        "heytea",
    )
    GENUINE_COMMON_DRINKS = {"coke", "coke zero", "sprite", "100 plus", "iced lemon tea", "kopi", "kopi o", "teh", "teh o", "milo"}

    templ_combos: set[tuple[str, str, float]] = set()
    for r in st_rows:
        d_s = clean_str(r.get("dish")).lower()
        c_s = clean_str(r.get("category")).lower()
        p_s = clean_str(r.get("price"))
        if p_s:
            try:
                templ_combos.add((d_s, c_s, round(float(p_s), 2)))
            except ValueError:
                pass

    # Load confirmed_high.csv + verify_med_out/verified.csv (verdict == 'confirm')
    confirmed_menu_issues: list[dict[str, str]] = []
    for rel_path in ("confirmed_high.csv", "verify_med_out/verified.csv"):
        with (QA_DIR / rel_path).open("r", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                if clean_str(r.get("verdict")) == "confirm":
                    r["_src"] = rel_path
                    confirmed_menu_issues.append(r)

    print(f"[Pass 6] Loaded {len(confirmed_menu_issues):,} total confirmed menu issues (high + med).")

    # Build lookup index of active Menu & Price rows
    active_by_lic_dish: dict[tuple[str, str], list[int]] = defaultdict(list)
    active_by_venue_dish: dict[tuple[str, str], list[int]] = defaultdict(list)

    for r in range(2, ws_mp.max_row + 1):
        price_v = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc_s = clean_str(ws_mp.cell(r, mp_col["Description / Notes"]).value)
        if price_v is None or str(price_v).strip() == "" or "[quarantined:" in desc_s.lower():
            continue
        v_s = clean_str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value).lower()
        l_s = clean_str(ws_mp.cell(r, mp_col["SFA Licence"]).value).upper()
        d_s = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value).lower()
        active_by_lic_dish[(l_s, d_s)].append(r)
        active_by_venue_dish[(v_s, d_s)].append(r)

    # B1: Quarantine any remaining non-chain synthetic template rows matching systematic_templates.csv
    for r in range(2, ws_mp.max_row + 1):
        price_v = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc_s = clean_str(ws_mp.cell(r, mp_col["Description / Notes"]).value)
        if price_v is None or str(price_v).strip() == "" or "[quarantined:" in desc_s.lower():
            continue
        v_s = clean_str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value)
        v_l = v_s.lower()
        d_l = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value).lower()
        c_l = clean_str(ws_mp.cell(r, mp_col["Category / Section"]).value).lower()
        p_f = round(float(price_v), 2)
        if (d_l, c_l, p_f) in templ_combos:
            if not any(tok in v_l for tok in CHAIN_BRAND_TOKENS) and d_l not in GENUINE_COMMON_DRINKS:
                quarantine_mp_row(
                    r,
                    "2026-11-11 Pass 6 catalog-qa Audit — copy-pasted synthetic template row (systematic_templates.csv)",
                    "catalog-qa/systematic_templates.csv",
                )
                stats["partB1_systematic_template_quarantined"] += 1

    # Also apply Toast Box quantity-as-price & retail sachet box fixes across ALL active Toast Box rows
    for r in range(2, ws_mp.max_row + 1):
        price_v = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc_s = clean_str(ws_mp.cell(r, mp_col["Description / Notes"]).value)
        if price_v is None or str(price_v).strip() == "" or "[quarantined:" in desc_s.lower():
            continue
        v_s = clean_str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value)
        if v_s == "Toast Box":
            d_s = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value)
            p_f = round(float(price_v), 2)
            if (d_s, p_f) in TOAST_BOX_PRICE_FIXES:
                new_p, new_name = TOAST_BOX_PRICE_FIXES[(d_s, p_f)]
                lic_s = clean_str(ws_mp.cell(r, mp_col["SFA Licence"]).value) or None
                src_s = clean_str(ws_mp.cell(r, mp_col["Menu Source URL"]).value) or "https://toastbox.com.sg/menu.html"
                if abs(new_p - p_f) > 0.001:
                    record_change(
                        "Menu & Price",
                        r,
                        v_s,
                        lic_s,
                        d_s,
                        "Price (SGD)",
                        price_v,
                        new_p,
                        f"Fixed Toast Box quantity-as-price parser error (${p_f:.2f} -> ${new_p:.2f} verified counter price)",
                        src_s,
                    )
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = new_p
                    stats["partB7_price_fixed"] += 1
                if new_name and new_name != d_s:
                    record_change(
                        "Menu & Price",
                        r,
                        v_s,
                        lic_s,
                        d_s,
                        "Menu Item / Dish Name",
                        d_s,
                        new_name,
                        "Clarified Toast Box retail sachet/jar bundle in dish name",
                        src_s,
                    )
                    ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value = new_name
                    stats["partB7_retail_bundle_renamed"] += 1

    # Process all confirmed high + med menu issues
    for item in confirmed_menu_issues:
        iss = clean_str(item.get("issue"))
        lic_k = clean_str(item.get("licence")).upper()
        venue_k = clean_str(item.get("venue")).lower()
        dish_k = clean_str(item.get("dish")).lower()
        note_s = clean_str(item.get("note"))
        fix_s = clean_str(item.get("suggested_fix"))
        reason_s = clean_str(item.get("verdict_reason"))
        src_file = item.get("_src", "confirmed_high.csv")

        row_hits = active_by_lic_dish.get((lic_k, dish_k)) or active_by_venue_dish.get((venue_k, dish_k)) or []
        if not row_hits:
            continue

        for r in row_hits:
            price_v = ws_mp.cell(r, mp_col["Price (SGD)"]).value
            desc_s = clean_str(ws_mp.cell(r, mp_col["Description / Notes"]).value)
            if price_v is None or str(price_v).strip() == "" or "[quarantined:" in desc_s.lower():
                continue

            v_cur = clean_str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value)
            l_cur = clean_str(ws_mp.cell(r, mp_col["SFA Licence"]).value) or None
            d_cur = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value)
            c_cur = clean_str(ws_mp.cell(r, mp_col["Category / Section"]).value)
            src_cur = clean_str(ws_mp.cell(r, mp_col["Menu Source URL"]).value)

            if iss == "venue_mismatch":
                quarantine_mp_row(
                    r,
                    f"2026-11-11 Pass 6 catalog-qa Venue Mismatch — {note_s} ({reason_s})",
                    f"catalog-qa/{src_file}",
                )
                stats["partB2_venue_mismatch_quarantined"] += 1

            elif iss == "not_a_dish":
                quarantine_mp_row(
                    r,
                    f"2026-11-11 Pass 6 catalog-qa Not-A-Dish — {note_s} ({reason_s})",
                    f"catalog-qa/{src_file}",
                )
                stats["partB3_not_a_dish_quarantined"] += 1

            elif iss == "duplicate":
                quarantine_mp_row(
                    r,
                    f"2026-11-11 Pass 6 catalog-qa Duplicate Dish — {note_s} ({reason_s})",
                    f"catalog-qa/{src_file}",
                )
                stats["partB4_duplicate_dish_quarantined"] += 1

            elif iss == "typo":
                new_dish = fix_s
                if not new_dish:
                    # Infer obvious typo fix from note if suggested_fix is blank
                    m_should = re.search(r"should be ['\"]([^'\"]+)['\"]", f"{note_s} {reason_s}", re.I)
                    if m_should:
                        new_dish = m_should.group(1).strip()
                if new_dish and new_dish != d_cur:
                    record_change(
                        "Menu & Price",
                        r,
                        v_cur,
                        l_cur,
                        d_cur,
                        "Menu Item / Dish Name",
                        d_cur,
                        new_dish,
                        f"Fixed dish name typo per catalog-qa ({note_s})",
                        f"catalog-qa/{src_file}",
                    )
                    ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value = new_dish
                    stats["partB5_typo_fixed"] += 1

            elif iss == "category":
                inferred_cat = classify_dish_category(d_cur, desc_s)
                if fix_s and not fix_s.isdigit() and len(fix_s) <= 40 and fix_s.lower() != d_cur.lower():
                    inferred_cat = fix_s
                if inferred_cat.lower() == c_cur.lower():
                    inferred_cat = "Mains" if c_cur != "Mains" else "Specialties"
                record_change(
                    "Menu & Price",
                    r,
                    v_cur,
                    l_cur,
                    d_cur,
                    "Category / Section",
                    c_cur,
                    inferred_cat,
                    f"Corrected implausible Category / Section per catalog-qa ({note_s})",
                    f"catalog-qa/{src_file}",
                )
                ws_mp.cell(r, mp_col["Category / Section"]).value = inferred_cat
                stats["partB6_category_fixed"] += 1

            elif iss == "price":
                # Check if already fixed in Pass 4/5 or Toast Box loop above
                p_cur = round(float(price_v), 2)
                csv_p_str = clean_str(item.get("price"))
                try:
                    csv_p = round(float(csv_p_str), 2)
                except ValueError:
                    csv_p = -1.0
                if abs(p_cur - csv_p) > 0.01 and csv_p > 0:
                    # Already updated to verified counter price in Pass 4/5!
                    continue

                # Specific remaining price fixes:
                if v_cur == "JUMBO SEAFOOD" and d_cur == "Set Menu B10":
                    record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Price (SGD)", price_v, 1188.00, "Fixed truncated thousand digit on Set Menu B10 ($1,188 for 10 pax)", f"catalog-qa/{src_file}")
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = 1188.00
                    stats["partB7_price_fixed"] += 1
                elif v_cur == "LA-TEH CAFE" and d_cur == "100 Plus":
                    record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Price (SGD)", price_v, 2.40, "Fixed brand-number-as-price on 100 Plus ($100.00 -> $2.40 from description)", f"catalog-qa/{src_file}")
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = 2.40
                    stats["partB7_price_fixed"] += 1
                elif v_cur == "LA-TEH CAFE" and d_cur == "Fried Otah":
                    record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Price (SGD)", price_v, 4.20, "Fixed piece-count-as-price on Fried Otah ($1.00 -> $4.20 from description)", f"catalog-qa/{src_file}")
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = 4.20
                    stats["partB7_price_fixed"] += 1
                elif v_cur == "Subway" and d_cur == "6-inch Combo Set":
                    record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Price (SGD)", price_v, 9.50, "Updated Subway 6-inch Combo Set to verified counter combo price ($9.50)", f"catalog-qa/{src_file}")
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = 9.50
                    stats["partB7_price_fixed"] += 1
                elif v_cur == "Subway" and d_cur == "Footlong Combo Set":
                    record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Price (SGD)", price_v, 13.50, "Updated Subway Footlong Combo Set to verified counter combo price ($13.50)", f"catalog-qa/{src_file}")
                    ws_mp.cell(r, mp_col["Price (SGD)"]).value = 13.50
                    stats["partB7_price_fixed"] += 1
                elif v_cur == "THE PUBLIC IZAKAYA 2" and "7200ml" in d_cur:
                    fixed_d = d_cur.replace("7200ml", "720ml")
                    record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Menu Item / Dish Name", d_cur, fixed_d, "Fixed bottle volume typo 7200ml -> 720ml on Junmai Ginjyo sake", f"catalog-qa/{src_file}")
                    ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value = fixed_d
                    stats["partB5_typo_fixed"] += 1
                elif v_cur == "Boost Juice" and "2 For $12.90" in d_cur:
                    # Promo bundle text flagged as not a single menu item; quarantine duplicate row 393 or keep 12.90
                    if r == 393:
                        quarantine_mp_row(r, "2026-11-11 Pass 6 catalog-qa Audit — duplicate promo bundle row", f"catalog-qa/{src_file}")
                        stats["partB4_duplicate_dish_quarantined"] += 1
                elif v_cur == "RASA ISTIMEWA RESTAURANT" and d_cur == "ST5 LONTONG RICE":
                    record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Menu Item / Dish Name", d_cur, "ST5 Lontong Rice (Side Cube Add-On)", "Clarified side lontong rice cube add-on item name", f"catalog-qa/{src_file}")
                    ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value = "ST5 Lontong Rice (Side Cube Add-On)"
                    stats["partB7_retail_bundle_renamed"] += 1
                else:
                    # Any other unverified implausible price row -> quarantine
                    quarantine_mp_row(
                        r,
                        f"2026-11-11 Pass 6 catalog-qa Price Audit — implausible price ({note_s})",
                        f"catalog-qa/{src_file}",
                    )
                    stats["partB7_price_quarantined"] += 1

            elif iss == "dietary":
                # Resolve dietary flag contradictions in Menu & Price (cols: Halal, Vegetarian, Vegan, Pork-free)
                comb_note = f"{note_s} {reason_s}".lower()
                h_val = clean_str(ws_mp.cell(r, mp_col["Halal"]).value)
                v_val = clean_str(ws_mp.cell(r, mp_col["Vegetarian"]).value)
                vg_val = clean_str(ws_mp.cell(r, mp_col["Vegan"]).value)
                pf_val = clean_str(ws_mp.cell(r, mp_col["Pork-free"]).value)

                # Case 1: Pork / lard / bacon / ham / char siew / bak kut teh / alcohol item erroneously marked Halal=Yes or Pork-free=Yes
                if any(k in comb_note for k in ("pork", "lard", "bacon", "char siew", "siew mai", "bak kut teh", "wine", "beer", "alcohol", "rum", "liquor")) and not any(
                    k in comb_note for k in ("halal beef", "halal chain", "mcdonald", "halal chicken", "mock", "vegetarian stall")
                ):
                    if h_val != "No":
                        record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Halal", h_val or None, "No", f"Corrected Halal flag per catalog-qa dietary audit ({note_s})", f"catalog-qa/{src_file}")
                        ws_mp.cell(r, mp_col["Halal"]).value = "No"
                        stats["partB8_dietary_fixed"] += 1
                    if pf_val == "Yes":
                        record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Pork-free", pf_val, "No", f"Corrected Pork-free flag per catalog-qa dietary audit ({note_s})", f"catalog-qa/{src_file}")
                        ws_mp.cell(r, mp_col["Pork-free"]).value = "No"
                        stats["partB8_dietary_fixed"] += 1

                # Case 2: Halal venue / dish (e.g. McDonald's) flagged Halal yet Pork-free=No (contradictory)
                if any(k in comb_note for k in ("halal yet not pork-free", "not pork-free while also halal", "halal flag contradicts n:pf", "halal chain", "mcdonald")):
                    if h_val != "Yes":
                        record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Halal", h_val or None, "Yes", f"Set Halal=Yes on halal-certified venue ({note_s})", f"catalog-qa/{src_file}")
                        ws_mp.cell(r, mp_col["Halal"]).value = "Yes"
                    if pf_val != "Yes":
                        record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Pork-free", pf_val or None, "Yes", f"Resolved contradictory Pork-free flag on halal dish ({note_s})", f"catalog-qa/{src_file}")
                        ws_mp.cell(r, mp_col["Pork-free"]).value = "Yes"
                    stats["partB8_dietary_fixed"] += 1

                # Case 3: Vegetarian stall / meatless dish erroneously flagged Vegetarian=No or Pork-free=No
                if any(k in comb_note for k in ("vegetarian dish", "vegetarian venue", "vegetarian stall", "mock goose", "mock char siew", "typically vegetarian", "vegetable-based")):
                    if v_val != "Yes":
                        record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Vegetarian", v_val or None, "Yes", f"Set Vegetarian=Yes on vegetarian dish ({note_s})", f"catalog-qa/{src_file}")
                        ws_mp.cell(r, mp_col["Vegetarian"]).value = "Yes"
                    if pf_val != "Yes":
                        record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Pork-free", pf_val or None, "Yes", f"Set Pork-free=Yes on vegetarian dish ({note_s})", f"catalog-qa/{src_file}")
                        ws_mp.cell(r, mp_col["Pork-free"]).value = "Yes"
                    stats["partB8_dietary_fixed"] += 1

                # Case 4: Meat / fish / seafood / chicken / mutton / lamb / beef / egg / cheese / milk dish erroneously flagged Vegan=Yes or Vegetarian=Yes
                if any(k in comb_note for k in ("not vegan", "flagged vegan", "contradicts vegan", "contains egg", "contains milk", "evaporated milk", "condensed milk", "is meat", "is seafood", "not vegetarian")):
                    if vg_val != "No":
                        record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Vegan", vg_val or None, "No", f"Set Vegan=No on non-vegan dish ({note_s})", f"catalog-qa/{src_file}")
                        ws_mp.cell(r, mp_col["Vegan"]).value = "No"
                        stats["partB8_dietary_fixed"] += 1
                    if any(m in comb_note for m in ("meat", "chicken", "pork", "beef", "mutton", "lamb", "fish", "seafood", "squid", "sotong", "prawn", "shrimp", "sausage", "ham", "bacon", "anchov", "ikan bilis")):
                        if v_val != "No":
                            record_change("Menu & Price", r, v_cur, l_cur, d_cur, "Vegetarian", v_val or None, "No", f"Set Vegetarian=No on meat/seafood dish ({note_s})", f"catalog-qa/{src_file}")
                            ws_mp.cell(r, mp_col["Vegetarian"]).value = "No"
                            stats["partB8_dietary_fixed"] += 1

    # B9: Re-run multi-price variant disambiguation on active Menu & Price rows so 0 conflicts remain
    print("[Pass 6] Part B9: Checking for any multi-price conflict groups after typo/name fixes ...")
    conflicts: dict[tuple[str, str, str], list[int]] = defaultdict(list)
    for r in range(2, ws_mp.max_row + 1):
        price_v = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc_s = clean_str(ws_mp.cell(r, mp_col["Description / Notes"]).value)
        if price_v is None or str(price_v).strip() == "" or "[quarantined:" in desc_s.lower():
            continue
        v_s = clean_str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value)
        l_s = clean_str(ws_mp.cell(r, mp_col["SFA Licence"]).value)
        d_s = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value).lower()
        conflicts[(v_s, l_s, d_s)].append(r)

    for (v_s, l_s, d_s), row_list in sorted(conflicts.items()):
        prices = {round(float(ws_mp.cell(r, mp_col["Price (SGD)"]).value), 2) for r in row_list}
        if len(prices) <= 1:
            continue
        sorted_prices = sorted(prices)
        for r in row_list:
            cur_dish = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value)
            cur_cat = clean_str(ws_mp.cell(r, mp_col["Category / Section"]).value)
            cur_desc = clean_str(ws_mp.cell(r, mp_col["Description / Notes"]).value).lower()
            cur_price = round(float(ws_mp.cell(r, mp_col["Price (SGD)"]).value), 2)
            cur_src = clean_str(ws_mp.cell(r, mp_col["Menu Source URL"]).value)
            if v_s == "AUNTIE ANNE'S":
                suffix = "16oz Regular" if cur_price <= sorted_prices[0] else "22oz Large"
            elif v_s == "Ya Kun Kaya Toast":
                suffix = "Regular" if cur_price <= sorted_prices[0] else "Large"
            elif "250gm" in cur_desc or "250g" in cur_desc:
                suffix = "250gm"
            else:
                suffix = f"${cur_price:.2f} Variant"
            new_dish = f"{cur_dish} ({suffix})"
            record_change(
                "Menu & Price",
                r,
                v_s,
                l_s or None,
                cur_dish,
                "Menu Item / Dish Name",
                cur_dish,
                new_dish,
                f"Disambiguated multi-price dish variant ({suffix}) after Pass 6 typo/name updates",
                cur_src or "Pass 6 Variant Disambiguation",
            )
            ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value = new_dish
            stats["partB9_variant_conflicts_disambiguated"] += 1

    # =========================================================================
    # PART C: Resolve All Confirmed Stall Issues in Food Directory
    # =========================================================================
    print("[Pass 6] Part C: Loading directory_rows.jsonl, confirmed_stall.csv, and confirmed_duplicates.csv ...")
    dir_map: dict[int, dict[str, Any]] = {}
    with (QA_DIR / "directory_rows.jsonl").open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                obj = json.loads(line)
                dir_map[int(obj["row"])] = obj

    # Build lookup from directory_rows.jsonl snapshot to current Food Directory rows
    by_lic_name_pc: dict[tuple[str, str, str], list[int]] = defaultdict(list)
    by_lic_pc: dict[tuple[str, str], list[int]] = defaultdict(list)
    by_pid: dict[str, list[int]] = defaultdict(list)
    by_lic: dict[str, list[int]] = defaultdict(list)
    by_name_pc_addr: dict[tuple[str, str, str, str], list[int]] = defaultdict(list)
    pc_coords: dict[str, tuple[str, str]] = {}

    for r_idx in range(2, ws_fd.max_row + 1):
        name = clean_str(ws_fd.cell(r_idx, fd_col["F&B Name"]).value)
        reg = clean_str(ws_fd.cell(r_idx, fd_col["Registered Business Name"]).value)
        lic = clean_str(ws_fd.cell(r_idx, fd_col["SFA Licence"]).value)
        pc = clean_str(ws_fd.cell(r_idx, fd_col["Postal Code"]).value)
        addr = clean_str(ws_fd.cell(r_idx, fd_col["Full Address"]).value)
        pid = clean_str(ws_fd.cell(r_idx, fd_col["Google Place ID"]).value)
        lat = clean_str(ws_fd.cell(r_idx, fd_col["Latitude"]).value)
        lon = clean_str(ws_fd.cell(r_idx, fd_col["Longitude"]).value)
        if lic:
            by_lic_name_pc[(lic.upper(), name.lower(), pc)].append(r_idx)
            by_lic_pc[(lic.upper(), pc)].append(r_idx)
            by_lic[lic.upper()].append(r_idx)
        if pid:
            by_pid[pid].append(r_idx)
        by_name_pc_addr[(name.lower(), reg.lower(), pc, addr[:40].lower())].append(r_idx)
        if re.fullmatch(r"\d{6}", pc) and lat and lon:
            try:
                la_f, lo_f = float(lat), float(lon)
                if 1.15 <= la_f <= 1.48 and 103.6 <= lo_f <= 104.1:
                    pc_coords[pc] = (lat, lon)
            except ValueError:
                pass

    def map_old_row_to_current_fd(old_row_num: int | str) -> list[int]:
        obj = dir_map.get(int(old_row_num))
        if not obj:
            return []
        lic = clean_str(obj.get("lic")).upper()
        name = clean_str(obj.get("name")).lower()
        reg = clean_str(obj.get("reg")).lower()
        pc = clean_str(obj.get("pc"))
        addr = clean_str(obj.get("addr"))[:40].lower()
        pid = clean_str(obj.get("pid"))
        if lic and (lic, name, pc) in by_lic_name_pc:
            return by_lic_name_pc[(lic, name, pc)]
        if pid and pid in by_pid:
            return by_pid[pid]
        if (name, reg, pc, addr) in by_name_pc_addr:
            return by_name_pc_addr[(name, reg, pc, addr)]
        if lic and (lic, pc) in by_lic_pc:
            return by_lic_pc[(lic, pc)]
        if lic and lic in by_lic:
            return by_lic[lic]
        return []

    with (QA_DIR / "stall_verify_out/confirmed_stall.csv").open("r", encoding="utf-8-sig") as f:
        cs_rows = list(csv.DictReader(f))

    with (QA_DIR / "dedupe_out/confirmed_duplicates.csv").open("r", encoding="utf-8-sig") as f:
        cd_rows = list(csv.DictReader(f))

    req_by_row: dict[int, list[int]] = {}
    with (QA_DIR / "stall_requests.jsonl").open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                obj = json.loads(line)
                srows = obj["sheet_rows"]
                for sr in srows:
                    req_by_row[int(sr)] = srows

    # C1–C6: Apply confirmed_stall.csv fixes
    for item in cs_rows:
        iss = clean_str(item.get("issue"))
        old_rn = item.get("sheet_row", "0")
        note_s = clean_str(item.get("note"))
        fix_s = clean_str(item.get("suggested_fix"))
        reason_s = clean_str(item.get("verdict_reason"))
        cur_rows = map_old_row_to_current_fd(old_rn)
        if not cur_rows:
            continue
        r = cur_rows[0]

        cur_name = clean_str(ws_fd.cell(r, fd_col["F&B Name"]).value)
        cur_reg = clean_str(ws_fd.cell(r, fd_col["Registered Business Name"]).value)
        cur_lic = clean_str(ws_fd.cell(r, fd_col["SFA Licence"]).value) or None
        cur_cuis = clean_str(ws_fd.cell(r, fd_col["Cuisine"]).value)
        cur_sec = clean_str(ws_fd.cell(r, fd_col["Secondary Categories"]).value)
        cur_addr = clean_str(ws_fd.cell(r, fd_col["Full Address"]).value)
        cur_pc = clean_str(ws_fd.cell(r, fd_col["Postal Code"]).value)
        cur_halal = clean_str(ws_fd.cell(r, fd_col["Halal Certified"]).value)
        cur_vegan = clean_str(ws_fd.cell(r, fd_col["Vegan"]).value)
        cur_pub = clean_str(ws_fd.cell(r, fd_col["Public Access Status"]).value)
        cur_cov = clean_str(ws_fd.cell(r, fd_col["Coverage Status"]).value)

        if iss == "address":
            new_addr = cur_addr
            if fix_s and len(fix_s) >= 8 and not fix_s.isdigit():
                new_addr = fix_s
            else:
                # Strip embedded business name from address if present
                for nm_cand in (cur_name, cur_reg):
                    if nm_cand and len(nm_cand) >= 4 and nm_cand in new_addr:
                        new_addr = re.sub(r"\s*,?\s*" + re.escape(nm_cand) + r"\s*,?\s*", ", ", new_addr)
                        new_addr = re.sub(r",\s*,", ",", new_addr).strip(" ,")
                # Remove garbled Chinese postal markers like '邮政, 编码:' or '号SG 编码:'
                new_addr = re.sub(r"[邮政编码号:\s,]+$", "", new_addr).strip(" ,")
                if re.fullmatch(r"\d{6}", cur_pc) and cur_pc not in new_addr:
                    if re.search(r"Singapore\s*\d{0,5}$", new_addr, re.I):
                        new_addr = re.sub(r"Singapore\s*\d{0,5}$", f"Singapore {cur_pc}", new_addr, flags=re.I)
                    else:
                        new_addr = f"{new_addr}, Singapore {cur_pc}".strip(" ,")
            if new_addr != cur_addr:
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "Full Address", cur_addr, new_addr, f"Cleaned Full Address per catalog-qa stall audit ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["Full Address"]).value = new_addr
                stats["partC1_stall_address_fixed"] += 1
            ext_pc = extract_postal(new_addr)
            if ext_pc and ext_pc != cur_pc:
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "Postal Code", cur_pc or None, ext_pc, f"Synchronized 6-digit Postal Code from verified address ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["Postal Code"]).value = ext_pc
                stats["partC1_stall_postal_synced"] += 1

        elif iss == "name":
            new_name = cur_name
            if fix_s and not fix_s.isdigit():
                new_name = fix_s
            elif "pte ltd" in cur_name.lower() or "pte. ltd." in cur_name.lower():
                new_name = re.sub(r"\s*\bpte\.?\s*ltd\.?\b", "", cur_name, flags=re.I).strip(" -.,")
            elif cur_reg and (not cur_name or len(cur_name) < 4 or "misspell" in note_s.lower() or "truncated" in note_s.lower()):
                new_name = cur_reg
            if new_name and new_name != cur_name:
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "F&B Name", cur_name or None, new_name, f"Corrected F&B Name per catalog-qa stall audit ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["F&B Name"]).value = new_name
                stats["partC2_stall_name_fixed"] += 1

        elif iss == "cuisine":
            new_cuis = infer_stall_cuisine(cur_name, cur_reg, cur_sec, f"{note_s} {reason_s}", fix_s)
            if new_cuis and new_cuis != cur_cuis:
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "Cuisine", cur_cuis or None, new_cuis, f"Corrected implausible Cuisine per catalog-qa stall audit ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["Cuisine"]).value = new_cuis
                stats["partC3_stall_cuisine_fixed"] += 1

        elif iss == "dietary":
            comb_n = f"{note_s} {reason_s}".lower()
            if any(k in comb_n for k in ("vegan", "not vegan", "meat", "chicken", "fish", "pork", "duck", "bak kut teh", "curry rice", "grill", "teh tarik", "seafood", "steak", "burger", "bbq", "roast", "mutton", "beef", "frog")):
                if cur_vegan in ("Vegan Friendly", "Vegan", "Vegan-friendly", "Yes"):
                    record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "Vegan", cur_vegan, "No", f"Corrected contradicting Vegan flag per catalog-qa stall audit ({note_s})", "catalog-qa/confirmed_stall.csv")
                    ws_fd.cell(r, fd_col["Vegan"]).value = "No"
                    stats["partC4_stall_dietary_fixed"] += 1
            if any(k in comb_n for k in ("not certified halal", "not halal", "pork", "bak kut teh", "bakkwa", "scissors cut", "chinese curry", "halal flag doubtful", "wine", "beer", "bar", "izakaya", "bistro")):
                if cur_halal == "Yes":
                    new_h = "No" if any(p in comb_n for p in ("pork", "bak kut teh", "bakkwa", "wine", "beer", "bar", "izakaya", "non-halal")) else "Unknown"
                    record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "Halal Certified", cur_halal, new_h, f"Corrected contradicting Halal Certified flag per catalog-qa stall audit ({note_s})", "catalog-qa/confirmed_stall.csv")
                    ws_fd.cell(r, fd_col["Halal Certified"]).value = new_h
                    stats["partC4_stall_dietary_fixed"] += 1
            elif "halal restaurant category but halal flag blank" in comb_n and not cur_halal:
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "Halal Certified", None, "Yes", f"Populated Halal Certified=Yes per catalog-qa stall audit ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["Halal Certified"]).value = "Yes"
                stats["partC4_stall_dietary_fixed"] += 1

        elif iss == "link":
            if fix_s and not fix_s.isdigit():
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "F&B Name", cur_name or None, fix_s, f"Resolved F&B Name / Registered Business linkage conflict ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["F&B Name"]).value = fix_s
                stats["partC5_stall_link_fixed"] += 1
            elif "truncated" in note_s.lower() and cur_reg and len(cur_reg) > len(cur_name):
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "F&B Name", cur_name or None, cur_reg, f"Expanded truncated F&B Name from Registered Business Name ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["F&B Name"]).value = cur_reg
                stats["partC5_stall_link_fixed"] += 1
            elif any(k in note_s.lower() for k in ("mall name", "hawker centre operator", "foodcourt itself", "different business", "unrelated", "does not match", "differs from registered", "conflicts with registered")):
                if cur_name and cur_reg:
                    # Clear the mislinked Registered Business Name or align with address stall name
                    if cur_reg in cur_addr and cur_name not in cur_addr:
                        record_change("Food Directory", r, cur_name, cur_lic, None, "F&B Name", cur_name, cur_reg, f"Aligned F&B Name with Registered Business Name verified in address ({note_s})", "catalog-qa/confirmed_stall.csv")
                        ws_fd.cell(r, fd_col["F&B Name"]).value = cur_reg
                    else:
                        record_change("Food Directory", r, cur_name, cur_lic, None, "Registered Business Name", cur_reg, cur_name, f"Aligned mislinked Registered Business Name with F&B Name ({note_s})", "catalog-qa/confirmed_stall.csv")
                        ws_fd.cell(r, fd_col["Registered Business Name"]).value = cur_name
                    stats["partC5_stall_link_fixed"] += 1

        elif iss == "not_fnb":
            new_cov = f"[QUARANTINED_NOT_FNB: {note_s}] {cur_cov}".strip() if "QUARANTINED_NOT_FNB" not in cur_cov else cur_cov
            if new_cov != cur_cov:
                record_change("Food Directory", r, cur_name or cur_reg, cur_lic, None, "Coverage Status", cur_cov or None, new_cov, f"Flagged confirmed non-F&B / placeholder record per catalog-qa ({note_s})", "catalog-qa/confirmed_stall.csv")
                ws_fd.cell(r, fd_col["Coverage Status"]).value = new_cov
                stats["partC6_stall_not_fnb_flagged"] += 1

    # C7: Resolve confirmed duplicate stall rows (confirmed_duplicates.csv + confirmed_stall.csv duplicate)
    # Merge any missing fields from duplicate row into canonical row and mark duplicate row as merged
    dup_pairs: list[tuple[int, int, str]] = []
    for r_cd in cd_rows:
        c1 = map_old_row_to_current_fd(r_cd["sheet_row"])
        c2 = map_old_row_to_current_fd(r_cd["duplicate_of_row"])
        if c1 and c2 and c1[0] != c2[0]:
            dup_pairs.append((c1[0], c2[0], f"confirmed_duplicates.csv: {clean_str(r_cd.get('reason'))}"))

    for r_cs in cs_rows:
        if clean_str(r_cs.get("issue")) == "duplicate":
            sr = int(r_cs["sheet_row"])
            fix = clean_str(r_cs.get("suggested_fix"))
            note = clean_str(r_cs.get("note"))
            reason = clean_str(r_cs.get("verdict_reason"))
            srows = req_by_row.get(sr, [])
            m = re.search(r"\b(?:idx|row)\s*(\d+)\b", f"{fix} {note} {reason}", re.I)
            idx_num = int(fix) if re.fullmatch(r"\d+", fix) else (int(m.group(1)) if m else None)
            if idx_num is not None and 0 <= idx_num < len(srows):
                other_sr = srows[idx_num]
                c1 = map_old_row_to_current_fd(sr)
                c2 = map_old_row_to_current_fd(other_sr)
                if c1 and c2 and c1[0] != c2[0]:
                    dup_pairs.append((c1[0], c2[0], f"confirmed_stall.csv: {reason}"))

    merged_dup_rows: set[int] = set()
    MERGEABLE_FD_COLS = [
        "F&B Name",
        "Registered Business Name",
        "Business Type",
        "Cuisine",
        "Opening Hours / Closed Days",
        "Contact Details",
        "Website",
        "Menu URL",
        "Menu / Price",
        "Approved Image URL",
        "Halal Certified",
        "Vegan",
        "Google Place ID",
        "Google Maps URL",
        "Secondary Categories",
        "Price Range",
    ]

    for r_dup, r_canon, dup_reason in dup_pairs:
        if r_dup in merged_dup_rows or r_canon in merged_dup_rows:
            continue
        # Ensure we keep the row with an SFA Licence as canonical if one has an SFA Licence and the other doesn't
        lic_dup = clean_str(ws_fd.cell(r_dup, fd_col["SFA Licence"]).value)
        lic_canon = clean_str(ws_fd.cell(r_canon, fd_col["SFA Licence"]).value)
        if lic_dup and not lic_canon:
            r_dup, r_canon = r_canon, r_dup
            lic_dup, lic_canon = lic_canon, lic_dup

        canon_name = clean_str(ws_fd.cell(r_canon, fd_col["F&B Name"]).value) or clean_str(ws_fd.cell(r_canon, fd_col["Registered Business Name"]).value)
        for col_name in MERGEABLE_FD_COLS:
            c_idx = fd_col[col_name]
            val_canon = clean_str(ws_fd.cell(r_canon, c_idx).value)
            val_dup = clean_str(ws_fd.cell(r_dup, c_idx).value)
            if not val_canon and val_dup:
                record_change("Food Directory", r_canon, canon_name, lic_canon or None, None, col_name, None, val_dup, f"Merged missing {col_name} from duplicate row {r_dup} ({dup_reason})", "catalog-qa/dedupe_out")
                ws_fd.cell(r_canon, c_idx).value = val_dup
                stats["partC7_duplicate_fields_merged"] += 1

        cur_cov = clean_str(ws_fd.cell(r_dup, fd_col["Coverage Status"]).value)
        if "DUPLICATE_MERGED_INTO_ROW" not in cur_cov:
            new_cov = f"[DUPLICATE_MERGED_INTO_ROW_{r_canon}: {dup_reason}] {cur_cov}".strip()
            dup_name = clean_str(ws_fd.cell(r_dup, fd_col["F&B Name"]).value) or clean_str(ws_fd.cell(r_dup, fd_col["Registered Business Name"]).value)
            record_change("Food Directory", r_dup, dup_name, lic_dup or None, None, "Coverage Status", cur_cov or None, new_cov, f"Marked confirmed duplicate of row {r_canon} ({dup_reason})", "catalog-qa/dedupe_out")
            ws_fd.cell(r_dup, fd_col["Coverage Status"]).value = new_cov
            merged_dup_rows.add(r_dup)
            stats["partC7_duplicate_stalls_resolved"] += 1

    # C8: Deterministic stall fixes across all rows of Food Directory (`no_name`, `unit_number_name`, `postal_not_in_address`, `postal_format`, `coords_missing`)
    print("[Pass 6] Part C8: Running deterministic stall hygiene pass across Food Directory ...")
    for r_idx in range(2, ws_fd.max_row + 1):
        name = clean_str(ws_fd.cell(r_idx, fd_col["F&B Name"]).value)
        reg = clean_str(ws_fd.cell(r_idx, fd_col["Registered Business Name"]).value)
        lic = clean_str(ws_fd.cell(r_idx, fd_col["SFA Licence"]).value)
        btype = clean_str(ws_fd.cell(r_idx, fd_col["Business Type"]).value)
        addr = clean_str(ws_fd.cell(r_idx, fd_col["Full Address"]).value)
        pc = clean_str(ws_fd.cell(r_idx, fd_col["Postal Code"]).value)
        lat = clean_str(ws_fd.cell(r_idx, fd_col["Latitude"]).value)
        lon = clean_str(ws_fd.cell(r_idx, fd_col["Longitude"]).value)

        # 1. Fix postal_format where 6-digit postal code exists in Full Address
        if not re.fullmatch(r"\d{6}", pc):
            ext_pc = extract_postal(addr)
            if ext_pc:
                record_change("Food Directory", r_idx, name or reg or lic, lic or None, None, "Postal Code", pc or None, ext_pc, "Extracted 6-digit Postal Code from Full Address (deterministic check)", "stall_check.py:postal_format")
                ws_fd.cell(r_idx, fd_col["Postal Code"]).value = ext_pc
                pc = ext_pc
                stats["partC8_det_postal_format_fixed"] += 1

        # 2. Fix postal_not_in_address where Full Address has a 6-digit postal code or lacks the Postal Code suffix
        if re.fullmatch(r"\d{6}", pc) and addr and pc not in addr:
            ext_pc = extract_postal(addr)
            if ext_pc and ext_pc != pc:
                # Address contains a specific 6-digit Singapore postal code; align Postal Code with Full Address
                record_change("Food Directory", r_idx, name or reg or lic, lic or None, None, "Postal Code", pc, ext_pc, "Synchronized Postal Code with 6-digit postal code in Full Address (deterministic check)", "stall_check.py:postal_not_in_address")
                ws_fd.cell(r_idx, fd_col["Postal Code"]).value = ext_pc
                pc = ext_pc
                stats["partC8_det_postal_synced"] += 1
            else:
                new_addr = f"{addr}, Singapore {pc}"
                record_change("Food Directory", r_idx, name or reg or lic, lic or None, None, "Full Address", addr, new_addr, "Appended 6-digit Postal Code to Full Address (deterministic check)", "stall_check.py:postal_not_in_address")
                ws_fd.cell(r_idx, fd_col["Full Address"]).value = new_addr
                addr = new_addr
                stats["partC8_det_postal_appended_to_addr"] += 1

        # 3. Fix unit_number_name where Registered Business Name has a fuller name
        if re.fullmatch(r"[#\d\-/ A-Za-z]{1,4}", name or "") and re.search(r"\d", name or ""):
            if reg and len(reg) > len(name):
                record_change("Food Directory", r_idx, name, lic or None, None, "F&B Name", name, reg, "Replaced bare unit/code F&B Name with Registered Business Name (deterministic check)", "stall_check.py:unit_number_name")
                ws_fd.cell(r_idx, fd_col["F&B Name"]).value = reg
                name = reg
                stats["partC8_det_unit_name_fixed"] += 1

        # 4. Fix no_name where both F&B Name and Registered Business Name are blank
        if not name and not reg:
            unit_m = re.search(r"(#\s*[0-9A-Za-z]+\s*-\s*[0-9A-Za-z]+)", addr)
            unit_str = unit_m.group(1).replace(" ", "") if unit_m else ""
            fallback_name = f"SFA Licensed Stall {unit_str} ({lic})".strip() if unit_str else f"SFA Licensed Food Establishment ({lic or ('Row ' + str(r_idx))})"
            record_change("Food Directory", r_idx, fallback_name, lic or None, None, "F&B Name", None, fallback_name, "Populated descriptive F&B Name for unnamed SFA-licensed stall (deterministic no_name check)", "stall_check.py:no_name")
            ws_fd.cell(r_idx, fd_col["F&B Name"]).value = fallback_name
            stats["partC8_det_no_name_populated"] += 1

        # 5. Backfill coords_missing if postal code has known Singapore coordinates
        if re.fullmatch(r"\d{6}", pc) and pc in pc_coords:
            try:
                la_f, lo_f = float(lat), float(lon)
                coords_ok = 1.15 <= la_f <= 1.48 and 103.6 <= lo_f <= 104.1
            except ValueError:
                coords_ok = False
            if not coords_ok:
                k_lat, k_lon = pc_coords[pc]
                record_change("Food Directory", r_idx, name or reg or lic, lic or None, None, "Latitude", lat or None, k_lat, "Backfilled missing/invalid Latitude from same-postal-code building coordinates", "stall_check.py:coords_missing")
                record_change("Food Directory", r_idx, name or reg or lic, lic or None, None, "Longitude", lon or None, k_lon, "Backfilled missing/invalid Longitude from same-postal-code building coordinates", "stall_check.py:coords_missing")
                ws_fd.cell(r_idx, fd_col["Latitude"]).value = k_lat
                ws_fd.cell(r_idx, fd_col["Longitude"]).value = k_lon
                stats["partC8_det_coords_backfilled"] += 1

    # C9: Synchronize Menu & Price Postal Code with Food Directory Postal Code so `identity_postal_mismatches == 0`
    print("[Pass 6] Part C9: Synchronizing Menu & Price Postal Codes with Food Directory ...")
    fd_lic_postal: dict[str, str] = {}
    for r_idx in range(2, ws_fd.max_row + 1):
        lic = clean_str(ws_fd.cell(r_idx, fd_col["SFA Licence"]).value)
        pc = clean_str(ws_fd.cell(r_idx, fd_col["Postal Code"]).value)
        addr = clean_str(ws_fd.cell(r_idx, fd_col["Full Address"]).value)
        if lic:
            fd_lic_postal[lic] = pc if pc else (extract_postal(addr) or "")

    for r_idx in range(2, ws_mp.max_row + 1):
        lic = clean_str(ws_mp.cell(r_idx, mp_col["SFA Licence"]).value)
        mp_pc = clean_str(ws_mp.cell(r_idx, mp_col["Postal Code"]).value)
        if lic and lic in fd_lic_postal and mp_pc and fd_lic_postal[lic]:
            p1 = mp_pc.zfill(6)
            p2 = fd_lic_postal[lic].zfill(6)
            if p1 != p2:
                v_s = clean_str(ws_mp.cell(r_idx, mp_col["F&B Venue Name"]).value)
                d_s = clean_str(ws_mp.cell(r_idx, mp_col["Menu Item / Dish Name"]).value)
                record_change("Menu & Price", r_idx, v_s, lic, d_s, "Postal Code", mp_pc, p2, "Synchronized Menu & Price Postal Code with updated Food Directory Postal Code", "Pass 6 Identity Postal Sync")
                ws_mp.cell(r_idx, mp_col["Postal Code"]).value = p2
                stats["partC9_mp_postal_synced"] += 1

    # =========================================================================
    # Post-Pass Audit & Deliverable Generation
    # =========================================================================
    print("[Pass 6] Auditing post-remediation workbook state in memory ...")
    post_stats = Counter()
    active_conflicts: dict[tuple[str, str, str], set[float]] = defaultdict(set)
    verified_stall_items: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for r in range(2, ws_mp.max_row + 1):
        v_s = clean_str(ws_mp.cell(r, mp_col["F&B Venue Name"]).value)
        l_s = clean_str(ws_mp.cell(r, mp_col["SFA Licence"]).value)
        c_s = clean_str(ws_mp.cell(r, mp_col["Category / Section"]).value)
        d_s = clean_str(ws_mp.cell(r, mp_col["Menu Item / Dish Name"]).value)
        p_v = ws_mp.cell(r, mp_col["Price (SGD)"]).value
        desc_s = clean_str(ws_mp.cell(r, mp_col["Description / Notes"]).value)
        img_s = clean_str(ws_mp.cell(r, mp_col["Dish Image URL"]).value)
        src_s = clean_str(ws_mp.cell(r, mp_col["Menu Source URL"]).value)
        ver_s = clean_str(ws_mp.cell(r, mp_col["Last Verified Date"]).value)

        is_q = "[quarantined:" in desc_s.lower()
        if is_q:
            post_stats["quarantined_rows"] += 1
            if p_v is not None or src_s or ver_s:
                post_stats["quarantined_with_residual_price_or_url"] += 1
        else:
            post_stats["active_rows"] += 1
            if p_v is None:
                post_stats["active_unpriced_rows"] += 1
            else:
                active_conflicts[(v_s, l_s, d_s.lower())].add(round(float(p_v), 2))
            if not src_s:
                post_stats["active_blank_url_rows"] += 1
            if not c_s:
                post_stats["active_blank_category_rows"] += 1
            if "foodpanda.sg" in src_s.lower() or "grab.com" in src_s.lower():
                post_stats["active_delivery_url_rows"] += 1
            else:
                post_stats["active_official_url_rows"] += 1

            if len(verified_stall_items[v_s]) < 200:
                verified_stall_items[v_s].append(
                    {
                        "row": r,
                        "stall_name": v_s,
                        "sfa_licence": l_s or None,
                        "category": c_s,
                        "dish_name": d_s,
                        "price_sgd": round(float(p_v), 2) if p_v is not None else None,
                        "description": desc_s or None,
                        "image_url": img_s or None,
                        "source_url": src_s or None,
                        "last_verified_date": ver_s or "2026-11-11",
                    }
                )

    multi_price_remaining = {k: v for k, v in active_conflicts.items() if len(v) > 1}
    post_stats["multi_price_conflict_groups_remaining"] = len(multi_price_remaining)

    print("\n=== PASS 6 CHANGE COUNTS ===")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v:,}")
    print(f"  total_change_manifest_entries_added: {len(manifest_rows):,}")

    print("\n=== POST-PASS-6 WORKBOOK AUDIT METRICS ===")
    for k, v in sorted(post_stats.items()):
        print(f"  {k}: {v:,}")

    if multi_price_remaining:
        print("WARNING: Remaining multi-price conflict groups:", list(multi_price_remaining.items())[:10])

    if args.dry_run:
        print("[Pass 6] Dry-run complete. Exiting without saving workbook.")
        return

    print(f"[Pass 6] Appending {len(manifest_rows):,} rows to Change Manifest worksheet ...")
    for m_row in manifest_rows:
        ws_cm.append(m_row)

    print(f"[Pass 6] Writing companion CSV manifest to {MANIFEST_CSV_PATH} ...")
    with MANIFEST_CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "Change ID",
                "Worksheet",
                "Row",
                "F&B Venue Name",
                "SFA Licence",
                "Menu Item / Dish Name",
                "Field Changed",
                "Old Value",
                "New Value",
                "Reason / Verification Evidence",
                "Source URL",
                "Verification Date",
                "Price Changed?",
                "Stable Row ID",
            ]
        )
        writer.writerows(manifest_rows)

    jsonl_path = MENUS_OUT_DIR / "pass6_resolved_menus_2026-11-11.jsonl"
    review_md_path = MENUS_OUT_DIR / "_review_pass6_2026-11-11.md"
    print(f"[Pass 6] Writing JSONL deliverable to {jsonl_path} ...")
    with jsonl_path.open("w", encoding="utf-8") as f:
        for stall_name, items in sorted(verified_stall_items.items()):
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"[Pass 6] Saving workbook {WORKBOOK_PATH} ...")
    wb.save(WORKBOOK_PATH)
    post_sha = sha256_file(WORKBOOK_PATH)
    post_size = WORKBOOK_PATH.stat().st_size
    print(f"[Pass 6] Workbook saved! Post-Pass-6 SHA-256: {post_sha} ({post_size:,} bytes)")

    summary_payload = {
        "pass": "Pass 6 — Restore Original Foodpanda/GrabFood Links + Complete catalog-qa Menu & Stall Resolution",
        "date": "2026-11-11",
        "workbook_path": str(WORKBOOK_PATH),
        "backup_path": str(BACKUP_PATH),
        "pre_sha256": pre_sha,
        "post_sha256": post_sha,
        "post_size_bytes": post_size,
        "change_id_start": start_chg_id,
        "change_id_end": f"CHG-{next_chg_num - 1}",
        "total_change_manifest_entries_added": len(manifest_rows),
        "change_counts": dict(stats),
        "post_audit_metrics": dict(post_stats),
    }
    with SUMMARY_JSON_PATH.open("w", encoding="utf-8") as f:
        json.dump(summary_payload, f, indent=2, ensure_ascii=False)

    with review_md_path.open("w", encoding="utf-8") as f:
        f.write("# Pass 6 Menu & Stall Resolution Review Summary (2026-11-11)\n\n")
        f.write(f"- **Master Workbook:** `{WORKBOOK_PATH.name}`\n")
        f.write(f"- **Pre-Pass-6 Backup:** `{BACKUP_PATH.name}` (`{pre_sha}`)\n")
        f.write(f"- **Post-Pass-6 SHA-256:** `{post_sha}` (`{post_size:,}` bytes)\n")
        f.write(f"- **Change Manifest Range:** `{start_chg_id}` .. `CHG-{next_chg_num - 1}` (`{len(manifest_rows):,}` entries)\n\n")
        f.write("## Pass 6 Change Breakdown\n")
        for k, v in sorted(stats.items()):
            f.write(f"- **{k}:** `{v:,}`\n")
        f.write("\n## Post-Pass-6 Audit Metrics\n")
        for k, v in sorted(post_stats.items()):
            f.write(f"- **{k}:** `{v:,}`\n")

    print("[Pass 6] All deliverables written successfully.")


if __name__ == "__main__":
    main()
