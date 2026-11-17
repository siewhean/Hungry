#!/usr/bin/env python3
"""
apply_official_website_pdf_prices_20261110.py

Pass 2 remediation on the master workbook:
  outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx

1. Official Website / Official PDF Price & URL Replacements (replacing Foodpanda / GrabFood / unverified prices):
   - Tiong Bahru Bakery (CE23M66X000, E02178J000, CE12072E000, CE13780A000, CE12Z45A000, CE12729N000):
     Applies official counter prices from the 06 Nov 2026 official PDF
     (https://cdn.shopify.com/s/files/1/0666/4948/9462/files/TBB_MENU_DIGITAL_06Nov_FA.pdf?v=1793952914),
     replacing +20% GrabFood/Foodpanda-inflated prices and 13 Oct drink prices across all 6 outlets.
   - Time Table Cafe (SW14083L000):
     Replaces GrabFood prices and URL on 155 exact-title-matched rows with the verified operator ordering menu
     prices (150 price updates) and URL (https://timetablecafe.getz.co/).
   - Cedele (SW14536X000):
     Replaces Foodpanda prices and URLs on 11 exact-matched rows with official product page prices and URLs
     (https://www.cedele.com/products/...).
   - BreadTalk (SW17A65V000, NW04065P000, CE18R59K000, CE16H49B000, CE10L01N000, CE12J42N000, CE25H76X000, SW10169L000):
     Replaces delivery-inflated drink/bakery prices and Grab/Foodpanda URLs with official https://www.breadtalk.com.sg/shop/
     prices and URL.
   - MOS Burger (SW18617J000 and x0ma Foodpanda rows):
     Replaces Foodpanda/blank prices and URLs on unambiguous single-price items with official
     https://www.mosburger.com.sg/mos-menu/ prices and URL.
   - Mr Bean (CE10B15X000, CE13V99K000, SE13185N000, CE09718X000, NE16478L000, SW13T56E000):
     Replaces Foodpanda/blank prices and URLs with official https://www.mrbean.com.sg/product-info/... prices and URLs.
   - Jollibee (Jollibee Singapore + CE07R64L000, CE15H95V000, CE13Z25A000, C00031X000, W91159B000):
     Fills unambiguous single-price official items from jollibee_live_official_delta_20261018.json and replaces
     Foodpanda-inflated prices and URLs with official https://jollibee.com.sg/our-menu prices and URL.
   - Yoshinoya (CE07611K000, SE13126N000, CE13Y77C000, NE17316P000):
     Replaces delivery/blank prices and URLs on unambiguous single-price items with official
     https://yoshinoya.com.sg/menu/ prices and URL.
   - The Coffee Bean & Tea Leaf (W95194P000, CE06N32P000, J99032B000, C98083P000):
     Replaces Foodpanda price/URL on Colombia Narino (7oz) (18.90 -> 16.90, https://www.coffeebean.com.sg/colombia-narino-7oz.html)
     and updates Homestyle Carrot Cake source URL on C98083P000 to https://www.coffeebean.com.sg/order-online/cakes.html.
   - Saizeriya (NE04054L000):
     Replaces unverified delivery-inflated prices and blank URLs on rows matching S87167P000's official PDF
     (https://www.saizeriya.com.sg/pdf/GrandMenu202609S_single.pdf) with official PDF prices and URL.
   - Fun Toast (CE05204C000, SE17709N000, SE12K92V000) & Kaffe & Toast (CE16P15X000, NW07651L000):
     Replaces GrabFood/Foodpanda prices and URLs on items matching official https://funtoast.com.sg/menu/ and
     https://www.kaffeandtoast.sg/menus menus with official prices and URLs.

2. Cross-Brand Menu & Directory Contamination Remediation:
   - Quarantines confirmed cross-brand contaminated rows in Menu & Price (Special Strawberry Shortcake on 11 non-Chateraise
     rows; chateraisesg.getz.co URL on 102 Tai Cheong Bakery rows; Toast Box Harbourfront rows on Henri Charpentier & Ya Kun;
     Han's FairPrice Hub rows on Doner Kebab Turkish & Tun Xiang; KJM Curry House rows on Samy's Kitchen & Perfect Eight;
     Mun Ting Xiang rows on Hometown Flavours; Xin Wang rows on Saizeriya SW09215P000; iSTEAKS rows on Crystal Jade NE18683L000;
     Coffee Hive rows on Kyo Kohee; La-Teh rows on Kay-Tu Myanmar; McDonald's rows on Burger King SE17398C000;
     Ichikokudo/Popeyes/Starbucks/McDonald's rows on Cafe O & SGO; Cafe O Changi T2 rows on Mona Nasi Pandan, Togi Korean Kitchen,
     and A-Roy Thai; Ya Kun rows on Paperbakes, Bugis Xin Yuan Ji, and Scissors King; Fun Toast rows on 50 Years;
     KOI The rows on Al Koithi Gourmet; Huggs Coffee rows on Bu Pin and Amarco Caffe; single-row Starbucks/McDonald's
     contaminations and blog URL danielfooddiary.com).
   - Clears confirmed cross-merchant Website and Menu URL misattributions in Food Directory.
"""

import os
import re
import csv
import json
import shutil
import hashlib
import zipfile
import openpyxl
from openpyxl.styles import Font, PatternFill

ROOT = "/Users/Siew Hean/Documents/GitHub/Hungry"
WB_PATH = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx",
)
BACKUP_PATH = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_official_price_remediation_2026-11-10.xlsx",
)
TEMP_WB_PATH = WB_PATH + ".tmp_official_price_remediation_20261110"
WORK_DIR = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/verified_enrichment_audit_2026-11-10",
)
os.makedirs(WORK_DIR, exist_ok=True)
MANIFEST_CSV_PATH = os.path.join(WORK_DIR, "change_manifest_pass2_2026-11-10.csv")

EXPECTED_INITIAL_SHA = "7df2b6cc54a374cace802c16f6fcf0df471d41f51cc55ecc080176d057f7a30f"


def calc_sha(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def norm(s) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def main():
    initial_sha = calc_sha(WB_PATH)
    print(f"Initial master workbook SHA-256: {initial_sha}")
    if initial_sha != EXPECTED_INITIAL_SHA:
        raise ValueError(f"Expected initial SHA {EXPECTED_INITIAL_SHA}, got {initial_sha}")

    if not os.path.exists(BACKUP_PATH):
        print(f"Creating backup at {BACKUP_PATH}...")
        shutil.copy2(WB_PATH, BACKUP_PATH)
        assert calc_sha(BACKUP_PATH) == initial_sha, "Backup SHA mismatch!"
        print("Backup verified.")
    else:
        print(f"Backup already exists at {BACKUP_PATH} (SHA: {calc_sha(BACKUP_PATH)})")

    print("Loading master workbook...")
    wb = openpyxl.load_workbook(WB_PATH)
    ws_dir = wb["Food Directory"]
    ws_menu = wb["Menu & Price"]
    ws_cm = wb["Change Manifest"]

    dh = {str(c or "").strip(): i for i, c in enumerate(next(ws_dir.iter_rows(min_row=1, max_row=1, values_only=True)))}
    mh = {str(c or "").strip(): i for i, c in enumerate(next(ws_menu.iter_rows(min_row=1, max_row=1, values_only=True)))}

    next_chg_num = 200145
    manifest_entries = []

    def record_change(dataset, row_num, venue, lic, dish, field, old_val, new_val, reason, evidence_url=None, price_changed="No", stable_id=None):
        nonlocal next_chg_num
        if old_val == new_val:
            return False
        if field == "Price (SGD)" and old_val is not None and new_val is not None:
            try:
                if abs(float(old_val) - float(new_val)) < 0.0001:
                    return False
            except Exception:
                pass
        chg_id = f"CHG-{next_chg_num}"
        next_chg_num += 1
        entry = (
            chg_id,
            dataset,
            str(row_num),
            venue,
            lic,
            dish,
            field,
            str(old_val) if old_val is not None else None,
            str(new_val) if new_val is not None else None,
            reason,
            evidence_url,
            "2026-11-10",
            price_changed,
            stable_id,
        )
        manifest_entries.append(entry)
        ws_cm.append(list(entry))
        return True

    # =========================================================================
    # PART 1: FOOD DIRECTORY HYGIENE & OFFICIAL URL ALIGNMENT
    # =========================================================================
    dir_stats = {
        "unit_only_wrong_websites_cleared": 0,
        "alphabetical_shift_wrong_websites_cleared": 0,
        "verified_websites_set": 0,
        "cross_brand_menu_urls_updated": 0,
    }

    col_d_fnb = dh["F&B Name"] + 1
    col_d_rbn = dh["Registered Business Name"] + 1
    col_d_lic = dh["SFA Licence"] + 1
    col_d_web = dh["Website"] + 1
    col_d_murl = dh["Menu URL"] + 1
    col_d_mprice = dh["Menu / Price"] + 1

    # 1A. Clear 37 unit-number-only cross-brand Website misattributions on blank-F&B-Name rows
    unit_only_wrong_rows = {
        218, 225, 450, 514, 545, 553, 555, 571, 574, 596, 625, 660, 694, 700,
        711, 720, 724, 731, 733, 743, 778, 785, 1361, 1372, 1382, 1608, 1633,
        1691, 1751, 1764, 1783, 1855, 1856, 1864, 1885, 2140
    }
    for r_idx in sorted(unit_only_wrong_rows):
        lic = ws_dir.cell(row=r_idx, column=col_d_lic).value
        rbn = ws_dir.cell(row=r_idx, column=col_d_rbn).value
        old_web = ws_dir.cell(row=r_idx, column=col_d_web).value
        if old_web:
            ws_dir.cell(row=r_idx, column=col_d_web).value = None
            record_change(
                "Food Directory", r_idx, rbn, lic, None,
                "Website", old_web, None,
                "Cleared cross-merchant Website misattributed by unit number alone on SFA-only row.",
                None, "No", f"DIR-{lic}" if lic else None
            )
            dir_stats["unit_only_wrong_websites_cleared"] += 1

    # Row 1474 (WING JOO LOONG GINSENG HONG, NW19171J000): replace wrong beardpapas.com with official wjl.com.sg
    old_wjl = ws_dir.cell(row=1474, column=col_d_web).value
    if old_wjl == "https://www.beardpapas.com/":
        ws_dir.cell(row=1474, column=col_d_web).value = "https://www.wjl.com.sg/"
        record_change(
            "Food Directory", 1474, ws_dir.cell(row=1474, column=col_d_rbn).value, "NW19171J000", None,
            "Website", old_wjl, "https://www.wjl.com.sg/",
            "Replaced wrong unit-matched Beard Papa's website with official Wing Joo Loong website.",
            "https://www.wjl.com.sg/", "No", "DIR-NW19171J000"
        )
        dir_stats["verified_websites_set"] += 1

    # 1B. Clear alphabetical-neighbor cross-brand Website misattributions from cross_merchant_website_review_queue.csv
    alpha_wrong_rows = {
        2841, 3094, 4257, 4327, 4340, 4435, 4534, 4558, 4620, 4839, 4997, 5074,
        5318, 5326, 5329, 5331, 5407, 5542, 5591, 5620, 5622, 5631, 5632, 5705,
        5965, 6220, 6222, 6251, 6511, 6512, 6669, 6684, 6739, 6745, 6748, 6807,
        6811, 6824, 6839, 7177, 7178, 7195, 7198, 7205, 7275, 7317, 7517, 8192,
        12935, 13104, 15059, 15951, 24773, 26044, 31741, 31746
    }
    for r_idx in sorted(alpha_wrong_rows):
        lic = ws_dir.cell(row=r_idx, column=col_d_lic).value
        venue = ws_dir.cell(row=r_idx, column=col_d_fnb).value or ws_dir.cell(row=r_idx, column=col_d_rbn).value
        old_web = ws_dir.cell(row=r_idx, column=col_d_web).value
        if old_web:
            ws_dir.cell(row=r_idx, column=col_d_web).value = None
            record_change(
                "Food Directory", r_idx, venue, lic, None,
                "Website", old_web, None,
                "Cleared cross-merchant Website misattributed from an unrelated brand (Gate 3 cross-merchant hygiene).",
                None, "No", f"DIR-{lic}" if lic else None
            )
            dir_stats["alphabetical_shift_wrong_websites_cleared"] += 1

    # Replace wrong Brewerkz website on Buddy Hoagies (row 6218, NE24610B000) and wrong Chico Loco website on Chocolate Origin (row 7402, C01066K000)
    for r_idx, exp_lic, new_web, reason in [
        (6218, "NE24610B000", "https://www.buddyhoagies.com.sg/", "Replaced wrong Brewerkz URL with official Buddy Hoagies website."),
        (7402, "C01066K000", "https://chocolate-origin.com/", "Replaced wrong Chico Loco URL with official Chocolate Origin website."),
    ]:
        lic = ws_dir.cell(row=r_idx, column=col_d_lic).value
        venue = ws_dir.cell(row=r_idx, column=col_d_fnb).value
        old_web = ws_dir.cell(row=r_idx, column=col_d_web).value
        if lic == exp_lic and old_web != new_web:
            ws_dir.cell(row=r_idx, column=col_d_web).value = new_web
            record_change(
                "Food Directory", r_idx, venue, lic, None,
                "Website", old_web, new_web, reason, new_web, "No", f"DIR-{lic}"
            )
            dir_stats["verified_websites_set"] += 1

    # 1C. Clean cross-brand Website / Menu URL cells on specific licences in Food Directory
    tbb_pdf_url = "https://cdn.shopify.com/s/files/1/0666/4948/9462/files/TBB_MENU_DIGITAL_06Nov_FA.pdf?v=1793952914"
    tbb_lics = {"CE23M66X000", "E02178J000", "CE12072E000", "CE13780A000", "CE12Z45A000", "CE12729N000"}

    cross_brand_dir_clears = {
        "CE06A62P000": ("Menu URL", None, "Cleared cross-brand Ya Kun and Royce Menu URLs from Paperbakes."),
        "CE16995P000": ("Website", None, "Cleared cross-brand LiHO website from 50 Years."),
        "CE18K72N000": ("Menu URL", None, "Cleared cross-brand Fun Toast and iTEA Menu URLs from 50 Years."),
        "SE22074B000": ("Menu URL", None, "Cleared cross-brand Fun Toast Menu URL from 50 Years."),
        "SW20V06E000": ("Menu URL", None, "Cleared cross-brand Fun Toast Menu URL from 50 Years."),
        "NE18302V000": ("Menu URL", None, "Cleared cross-brand Fun Toast and EAT Menu URLs from 50 Years."),
        "E65007A003": ("Website", None, "Cleared cross-brand KOI The website from AL KOITHI Gourmet."),
        "CE07C99N000": ("Website", None, "Cleared cross-brand Starbucks website from Buzz."),
        "SW11882L000": ("Website", None, "Cleared cross-brand Starbucks website from Cedele Bakery Cafe."),
        "CE16605C000": ("Website", None, "Cleared cross-brand Popeyes website from SGO."),
        "CE16C93B000": ("Website", None, "Cleared cross-brand Popeyes website from Cafe O Singapore."),
    }

    for r_idx in range(2, ws_dir.max_row + 1):
        lic = str(ws_dir.cell(row=r_idx, column=col_d_lic).value or "").strip()
        venue = ws_dir.cell(row=r_idx, column=col_d_fnb).value
        if lic in tbb_lics:
            old_murl = ws_dir.cell(row=r_idx, column=col_d_murl).value
            if old_murl != tbb_pdf_url:
                ws_dir.cell(row=r_idx, column=col_d_murl).value = tbb_pdf_url
                record_change(
                    "Food Directory", r_idx, venue, lic, None,
                    "Menu URL", old_murl, tbb_pdf_url,
                    "Updated Tiong Bahru Bakery Menu URL to the latest official 06 Nov 2026 PDF menu (removing delivery/cross-brand URLs).",
                    tbb_pdf_url, "No", f"DIR-{lic}"
                )
                dir_stats["cross_brand_menu_urls_updated"] += 1
            old_mp = ws_dir.cell(row=r_idx, column=col_d_mprice).value
            if old_mp and "Delivery menus on Foodpanda and GrabFood" in str(old_mp):
                ws_dir.cell(row=r_idx, column=col_d_mprice).value = "Official PDF menu"
                record_change(
                    "Food Directory", r_idx, venue, lic, None,
                    "Menu / Price", old_mp, "Official PDF menu",
                    "Aligned Menu / Price label with official Tiong Bahru Bakery PDF Menu URL.",
                    tbb_pdf_url, "No", f"DIR-{lic}"
                )
        elif lic == "SW14083L000":
            old_web = ws_dir.cell(row=r_idx, column=col_d_web).value
            old_murl = ws_dir.cell(row=r_idx, column=col_d_murl).value
            if old_web != "https://timetablecafe.getz.co/":
                ws_dir.cell(row=r_idx, column=col_d_web).value = "https://timetablecafe.getz.co/"
                record_change(
                    "Food Directory", r_idx, venue, lic, None,
                    "Website", old_web, "https://timetablecafe.getz.co/",
                    "Set verified first-party ordering website for Time Table Cafe (SW14083L000).",
                    "https://timetablecafe.getz.co/", "No", f"DIR-{lic}"
                )
                dir_stats["verified_websites_set"] += 1
            if old_murl != "https://timetablecafe.getz.co/":
                ws_dir.cell(row=r_idx, column=col_d_murl).value = "https://timetablecafe.getz.co/"
                record_change(
                    "Food Directory", r_idx, venue, lic, None,
                    "Menu URL", old_murl, "https://timetablecafe.getz.co/",
                    "Replaced GrabFood URL with verified first-party ordering menu URL for Time Table Cafe (SW14083L000).",
                    "https://timetablecafe.getz.co/", "No", f"DIR-{lic}"
                )
                dir_stats["cross_brand_menu_urls_updated"] += 1
            old_mp = ws_dir.cell(row=r_idx, column=col_d_mprice).value
            if old_mp and "Delivery menus on Foodpanda and GrabFood" in str(old_mp):
                ws_dir.cell(row=r_idx, column=col_d_mprice).value = "Official ordering menu"
                record_change(
                    "Food Directory", r_idx, venue, lic, None,
                    "Menu / Price", old_mp, "Official ordering menu",
                    "Aligned Menu / Price label with official Time Table Cafe ordering Menu URL.",
                    "https://timetablecafe.getz.co/", "No", f"DIR-{lic}"
                )
        elif lic in cross_brand_dir_clears:
            field_name, new_val, reason = cross_brand_dir_clears[lic]
            col_target = dh[field_name] + 1
            old_val = ws_dir.cell(row=r_idx, column=col_target).value
            if old_val != new_val:
                ws_dir.cell(row=r_idx, column=col_target).value = new_val
                record_change(
                    "Food Directory", r_idx, venue, lic, None,
                    field_name, old_val, new_val, reason, None, "No", f"DIR-{lic}"
                )
                dir_stats["cross_brand_menu_urls_updated"] += 1
            if lic in ("E65007A003", "CE16995P000", "CE16605C000", "CE16C93B000"):
                old_m = ws_dir.cell(row=r_idx, column=col_d_murl).value
                if old_m:
                    ws_dir.cell(row=r_idx, column=col_d_murl).value = None
                    record_change(
                        "Food Directory", r_idx, venue, lic, None,
                        "Menu URL", old_m, None,
                        "Cleared cross-brand Menu URL on contaminated directory row.",
                        None, "No", f"DIR-{lic}"
                    )
                    dir_stats["cross_brand_menu_urls_updated"] += 1
            if ws_dir.cell(row=r_idx, column=col_d_murl).value is None:
                old_mp = ws_dir.cell(row=r_idx, column=col_d_mprice).value
                if old_mp and "Delivery menus on Foodpanda and GrabFood" in str(old_mp):
                    ws_dir.cell(row=r_idx, column=col_d_mprice).value = None
                    record_change(
                        "Food Directory", r_idx, venue, lic, None,
                        "Menu / Price", old_mp, None,
                        "Cleared stale dual-delivery Menu / Price label after clearing cross-brand Menu URL.",
                        None, "No", f"DIR-{lic}"
                    )
        elif lic in ("CE17M73J000", "SE23J47B000", "SW12M82J000", "CE04437C000"):
            old_m = ws_dir.cell(row=r_idx, column=col_d_murl).value
            if old_m and any(k in str(old_m).lower() for k in ("huggs", "actioncity", "yakun")):
                ws_dir.cell(row=r_idx, column=col_d_murl).value = None
                record_change(
                    "Food Directory", r_idx, venue, lic, None,
                    "Menu URL", old_m, None,
                    "Cleared cross-brand Menu URL on contaminated directory row.",
                    None, "No", f"DIR-{lic}"
                )
                dir_stats["cross_brand_menu_urls_updated"] += 1
                old_mp = ws_dir.cell(row=r_idx, column=col_d_mprice).value
                if old_mp and "Delivery menus on Foodpanda and GrabFood" in str(old_mp):
                    ws_dir.cell(row=r_idx, column=col_d_mprice).value = None
                    record_change(
                        "Food Directory", r_idx, venue, lic, None,
                        "Menu / Price", old_mp, None,
                        "Cleared stale dual-delivery Menu / Price label after clearing cross-brand Menu URL.",
                        None, "No", f"DIR-{lic}"
                    )

    print("Food Directory updates summary:", dir_stats)

    # =========================================================================
    # PART 2: MENU & PRICE — OFFICIAL WEBSITE / PDF PRICES & CONTAMINATION CLEANUP
    # =========================================================================
    col_m_venue = mh["F&B Venue Name"] + 1
    col_m_lic = mh["SFA Licence"] + 1
    col_m_dish = mh["Menu Item / Dish Name"] + 1
    col_m_cat = mh["Category / Section"] + 1
    col_m_price = mh["Price (SGD)"] + 1
    col_m_notes = mh["Description / Notes"] + 1
    col_m_surl = mh["Menu Source URL"] + 1
    col_m_lvd = mh["Last Verified Date"] + 1

    # Pre-read all menu rows for fast reference building
    all_menu_rows = list(ws_menu.iter_rows(min_row=2, values_only=True))

    # Build Reference 1: Tiong Bahru Bakery (CE23M66X000 + 06Nov PDF updates)
    tbb_06nov_updates = {
        ("latte", "size: regular; per serving"): 6.50,
        ("latte", "size: large; per serving"): 8.50,
        ("latte", "size: iced; per serving"): 7.50,
        ("flat white", "size: regular; per serving"): 6.50,
        ("flat white", "size: large; per serving"): 8.50,
        ("cappuccino", "size: regular; per serving"): 6.50,
        ("cappuccino", "size: large; per serving"): 8.50,
        ("cappuccino", "size: iced; per serving"): 7.50,
        ("mocha", "size: regular; per serving"): 7.50,
        ("mocha", "size: large; per serving"): 9.50,
        ("mocha", "size: iced; per serving"): 8.50,
        ("long black", "size: regular; per serving"): 6.00,
        ("long black", "size: iced; per serving"): 7.00,
        ("brewed teas (pearl of the orient / lemon ginger mint / earl grey lavender / chamomile dream)", "size: regular; per serving"): 6.00,
        ("brewed teas (pearl of the orient / lemon ginger mint / earl grey lavender / chamomile dream)", "size: iced; per serving"): 7.00,
    }
    tbb_single_map = {}
    for r in all_menu_rows:
        if r[mh["SFA Licence"]] == "CE23M66X000":
            d_low = str(r[mh["Menu Item / Dish Name"]] or "").strip().lower()
            n_low = str(r[mh["Description / Notes"]] or "").strip().lower()
            p = r[mh["Price (SGD)"]]
            if (d_low, n_low) in tbb_06nov_updates:
                p = tbb_06nov_updates[(d_low, n_low)]
            if p is not None:
                tbb_single_map.setdefault(norm(d_low), set()).add(float(p))
    tbb_unambiguous = {k: list(v)[0] for k, v in tbb_single_map.items() if len(v) == 1}

    # Build Reference 2: Cedele official product matches from snapshot
    cedele_snap_path = os.path.join(ROOT, "data/source_snapshots/first_party_coffee_bakery_dessert_catalogues_refresh_20261018.json")
    with open(cedele_snap_path, encoding="utf-8") as f:
        cedele_snap = json.load(f)
    cedele_official = {}
    for m in cedele_snap.get("existing_exact_menu_matches", []):
        if m.get("brand") == "Cedele":
            p_str = str(m.get("price_as_published") or "").replace("S$", "").strip()
            u_str = m.get("official_source_url")
            if p_str and u_str:
                cedele_official[norm(m.get("menu_item"))] = (float(p_str), u_str)

    # Build Reference 3: BreadTalk official shop prices (https://www.breadtalk.com.sg/shop/)
    breadtalk_official = {
        "horlicks chocolate malt": (1.30, "https://www.breadtalk.com.sg/shop/"),
        "milk tea 370ml": (3.60, "https://www.breadtalk.com.sg/shop/"),
        "soya milk 300ml": (3.60, "https://www.breadtalk.com.sg/shop/"),
        "yotsuba hokkaido fresh milk": (3.20, "https://www.breadtalk.com.sg/shop/"),
        "yotsuba hokkaido milk strawberry": (3.20, "https://www.breadtalk.com.sg/shop/"),
    }
    bt_by_dish = {}
    for r in all_menu_rows:
        u = str(r[mh["Menu Source URL"]] or "")
        if "breadtalk.com.sg/shop" in u and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            if dn not in breadtalk_official:
                bt_by_dish.setdefault(dn, set()).add((float(r[mh["Price (SGD)"]]), u))
    for dn, pset in bt_by_dish.items():
        prices = {p for p, _ in pset}
        if len(prices) == 1:
            p_val, u_val = sorted(pset)[0]
            breadtalk_official[dn] = (p_val, u_val)

    # Build Reference 4: MOS Burger official menu prices (https://www.mosburger.com.sg/mos-menu/)
    mos_multi_size_exclude = {"butterfly prawns", "chicken nuggets", "mussel nuggets"}
    mos_by_dish = {}
    for r in all_menu_rows:
        u = str(r[mh["Menu Source URL"]] or "")
        if "mosburger.com.sg" in u and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            if dn not in mos_multi_size_exclude:
                mos_by_dish.setdefault(dn, set()).add(float(r[mh["Price (SGD)"]]))
    mos_official = {dn: list(pset)[0] for dn, pset in mos_by_dish.items() if len(pset) == 1}

    # Build Reference 5: Mr Bean official product-info prices & URLs
    mrbean_by_dish = {}
    for r in all_menu_rows:
        u = str(r[mh["Menu Source URL"]] or "")
        if "mrbean.com.sg/product-info" in u and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            mrbean_by_dish.setdefault(dn, set()).add((float(r[mh["Price (SGD)"]]), u))
    mrbean_official = {}
    for dn, pset in mrbean_by_dish.items():
        prices = {p for p, _ in pset}
        if len(prices) == 1:
            mrbean_official[dn] = sorted(pset)[0]

    # Build Reference 6: Jollibee official menu prices (https://jollibee.com.sg/our-menu)
    jb_snap_path = os.path.join(ROOT, "data/source_snapshots/jollibee_live_official_delta_20261018.json")
    with open(jb_snap_path, encoding="utf-8") as f:
        jb_snap = json.load(f)
    jollibee_official = {}
    for item in jb_snap.get("brand_level_price_field_gaps", []):
        dn = norm(item.get("item_name"))
        vars_list = item.get("published_variations", [])
        p_set = {float(v["price"]) for v in vars_list if v.get("price") is not None}
        if len(p_set) == 1:
            jollibee_official[dn] = list(p_set)[0]
    for r in all_menu_rows:
        u = str(r[mh["Menu Source URL"]] or "")
        if "jollibee.com.sg" in u and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            jollibee_official.setdefault(dn, float(r[mh["Price (SGD)"]]))

    # Build Reference 7: Yoshinoya official menu prices (https://yoshinoya.com.sg/menu/)
    yoshi_by_dish = {}
    for r in all_menu_rows:
        u = str(r[mh["Menu Source URL"]] or "")
        if "yoshinoya.com.sg/menu" in u and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            yoshi_by_dish.setdefault(dn, set()).add(float(r[mh["Price (SGD)"]]))
    yoshinoya_official = {dn: list(pset)[0] for dn, pset in yoshi_by_dish.items() if len(pset) == 1}
    if "dasani drinking water" in yoshinoya_official:
        yoshinoya_official["dasani bottled water"] = yoshinoya_official["dasani drinking water"]

    # Build Reference 8: Saizeriya official PDF prices (https://www.saizeriya.com.sg/pdf/GrandMenu202609S_single.pdf)
    saizeriya_official = {}
    for r in all_menu_rows:
        if r[mh["SFA Licence"]] == "S87167P000" and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            saizeriya_official[dn] = float(r[mh["Price (SGD)"]])

    # Build Reference 9: Fun Toast official menu prices (https://funtoast.com.sg/menu/)
    funtoast_by_dish = {}
    for r in all_menu_rows:
        u = str(r[mh["Menu Source URL"]] or "")
        v_name = str(r[mh["F&B Venue Name"]] or "")
        if "funtoast.com.sg/menu" in u and "fun toast" in v_name.lower() and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            funtoast_by_dish.setdefault(dn, set()).add(float(r[mh["Price (SGD)"]]))
    funtoast_official = {dn: list(pset)[0] for dn, pset in funtoast_by_dish.items() if len(pset) == 1}

    # Build Reference 10: Kaffe & Toast official menu prices (https://www.kaffeandtoast.sg/menus)
    kt_by_dish = {}
    for r in all_menu_rows:
        u = str(r[mh["Menu Source URL"]] or "")
        if "kaffeandtoast.sg/menus" in u and r[mh["Price (SGD)"]] is not None:
            dn = norm(r[mh["Menu Item / Dish Name"]])
            kt_by_dish.setdefault(dn, set()).add(float(r[mh["Price (SGD)"]]))
    kt_official = {dn: list(pset)[0] for dn, pset in kt_by_dish.items() if len(pset) == 1}

    menu_stats = {
        "official_price_updated": 0,
        "official_url_updated": 0,
        "quarantined_cross_brand_rows": 0,
        "tai_cheong_wrong_url_cleared": 0,
    }

    def quarantine_row(r_idx, venue, lic, dish, reason_tag, reason_desc):
        old_p = ws_menu.cell(row=r_idx, column=col_m_price).value
        old_u = ws_menu.cell(row=r_idx, column=col_m_surl).value
        old_lvd = ws_menu.cell(row=r_idx, column=col_m_lvd).value
        old_notes = str(ws_menu.cell(row=r_idx, column=col_m_notes).value or "").strip()
        changed = False
        if old_p is not None:
            ws_menu.cell(row=r_idx, column=col_m_price).value = None
            record_change("Menu & Price", r_idx, venue, lic, dish, "Price (SGD)", old_p, None, reason_desc, None, "Yes", None)
            changed = True
        if old_u is not None:
            ws_menu.cell(row=r_idx, column=col_m_surl).value = None
            record_change("Menu & Price", r_idx, venue, lic, dish, "Menu Source URL", old_u, None, reason_desc, None, "No", None)
            changed = True
        if old_lvd is not None:
            ws_menu.cell(row=r_idx, column=col_m_lvd).value = None
            record_change("Menu & Price", r_idx, venue, lic, dish, "Last Verified Date", old_lvd, None, reason_desc, None, "No", None)
            changed = True
        if not old_notes.startswith("[QUARANTINED"):
            new_notes = f"{reason_tag} {old_notes}".strip() if old_notes else reason_tag
            ws_menu.cell(row=r_idx, column=col_m_notes).value = new_notes
            record_change("Menu & Price", r_idx, venue, lic, dish, "Description / Notes", old_notes if old_notes else None, new_notes, reason_desc, None, "No", None)
            changed = True
        if changed:
            menu_stats["quarantined_cross_brand_rows"] += 1

    # Licences where the entire block or specific foreign URL rows are cross-brand contaminations
    full_quarantine_lics = {
        "CE12E01X000": ("[QUARANTINED: Cross-brand Toast Box Harbourfront menu rows]", "Quarantined Toast Box Harbourfront menu row misattributed to Henri Charpentier (CE12E01X000)."),
        "W81085A000": ("[QUARANTINED: Cross-brand Han's FairPrice Hub menu rows]", "Quarantined Han's FairPrice Hub menu row misattributed to DONER KEBAB TURKISH (W81085A000)."),
        "S01283N000": ("[QUARANTINED: Cross-brand Han's FairPrice Hub menu rows]", "Quarantined Han's FairPrice Hub menu row misattributed to TUN XIANG (S01283N000)."),
        "SW15E12P003": ("[QUARANTINED: Cross-brand KJM Curry House menu rows]", "Quarantined KJM Curry House menu row misattributed to Samy's Kitchen (SW15E12P003)."),
        "C99045V001": ("[QUARANTINED: Cross-brand KJM Curry House menu rows]", "Quarantined KJM Curry House menu row misattributed to PERFECT EIGHT PTE. LTD. (C99045V001)."),
        "S97132N000": ("[QUARANTINED: Cross-brand Mun Ting Xiang menu rows]", "Quarantined Mun Ting Xiang menu row misattributed to Hometown Flavours (S97132N000)."),
        "SW09215P000": ("[QUARANTINED: Cross-brand Xin Wang Hong Kong Cafe menu rows]", "Quarantined Xin Wang Hong Kong Cafe Northpoint menu row misattributed to Saizeriya (SW09215P000)."),
        "NE18683L000": ("[QUARANTINED: Cross-brand iSTEAKS Diner menu rows]", "Quarantined iSTEAKS Diner The Star Vista menu row misattributed to Crystal Jade Hong Kong Kitchen (NE18683L000)."),
        "CE04009N000": ("[QUARANTINED: Cross-brand Coffee Hive Square 2 menu rows]", "Quarantined Coffee Hive Square 2 menu row misattributed to Kyo Kohee (CE04009N000)."),
        "CE16982C000": ("[QUARANTINED: Cross-brand La-Teh Fortune Centre menu rows]", "Quarantined La-Teh Fortune Centre menu row misattributed to KAY-TU MYANMAR (CE16982C000)."),
        "SE17398C000": ("[QUARANTINED: Cross-brand McDonald's menu rows]", "Quarantined McDonald's item row misattributed to Burger King (SE17398C000)."),
        "SE23J47B000": ("[QUARANTINED: Cross-brand Ichikokudo/Popeyes/Starbucks/McDonald's menu rows]", "Quarantined foreign chain menu row misattributed to CAFE O (SE23J47B000)."),
        "CE16C93B000": ("[QUARANTINED: Cross-brand Ichikokudo/Popeyes/Starbucks/McDonald's menu rows]", "Quarantined foreign chain menu row misattributed to CAFE O SINGAPORE (CE16C93B000)."),
        "CE16605C000": ("[QUARANTINED: Cross-brand Ichikokudo/Popeyes/Starbucks/McDonald's menu rows]", "Quarantined foreign chain menu row misattributed to SGO (CE16605C000)."),
        "SE24738X000": ("[QUARANTINED: Cross-brand Cafe O Changi Airport T2 menu rows]", "Quarantined Cafe O Changi Airport T2 menu row misattributed to Mona Nasi Pandan (SE24738X000)."),
        "SE24M04N000": ("[QUARANTINED: Cross-brand Cafe O Changi Airport T2 menu rows]", "Quarantined Cafe O Changi Airport T2 menu row misattributed to Mona Nasi Pandan (SE24M04N000)."),
        "SE26358X001": ("[QUARANTINED: Cross-brand Cafe O Changi Airport T2 menu rows]", "Quarantined Cafe O Changi Airport T2 menu row misattributed to Togi Korean Kitchen (SE26358X001)."),
        "SE26358X009": ("[QUARANTINED: Cross-brand Cafe O Changi Airport T2 menu rows]", "Quarantined Cafe O Changi Airport T2 menu row misattributed to Togi Korean Kitchen (SE26358X009)."),
        "SE23I93P000": ("[QUARANTINED: Cross-brand Cafe O Changi Airport T2 menu rows]", "Quarantined Cafe O Changi Airport T2 menu row misattributed to A-ROY THAI RESTAURANT (SE23I93P000)."),
        "CE06A62P000": ("[QUARANTINED: Cross-brand Ya Kun Kaya Toast menu rows]", "Quarantined Ya Kun Kaya Toast menu row misattributed to PAPERBAKES (CE06A62P000)."),
        "SW12M82J000": ("[QUARANTINED: Cross-brand Ya Kun Kaya Toast menu rows]", "Quarantined Ya Kun Kaya Toast menu row misattributed to BUGIS XIN YUAN JI PTE. LTD. (SW12M82J000)."),
        "CE04437C000": ("[QUARANTINED: Cross-brand Ya Kun Kaya Toast menu rows]", "Quarantined Ya Kun Kaya Toast menu row misattributed to Scissors King (CE04437C000)."),
        "CE16995P000": ("[QUARANTINED: Cross-brand Fun Toast menu rows]", "Quarantined Fun Toast menu row misattributed to 50 Years (CE16995P000)."),
        "CE18K72N000": ("[QUARANTINED: Cross-brand Fun Toast menu rows]", "Quarantined Fun Toast menu row misattributed to 50 Years (CE18K72N000)."),
        "SE22074B000": ("[QUARANTINED: Cross-brand Fun Toast menu rows]", "Quarantined Fun Toast menu row misattributed to 50 Years (SE22074B000)."),
        "SW20V06E000": ("[QUARANTINED: Cross-brand Fun Toast menu rows]", "Quarantined Fun Toast menu row misattributed to 50 Years (SW20V06E000)."),
        "NE18302V000": ("[QUARANTINED: Cross-brand Fun Toast menu rows]", "Quarantined Fun Toast menu row misattributed to 50 Years (NE18302V000)."),
        "E65007A003": ("[QUARANTINED: Cross-brand KOI The menu rows]", "Quarantined KOI The menu row misattributed to AL KOITHI Gourmet (E65007A003)."),
        "CE17M73J000": ("[QUARANTINED: Cross-brand Huggs Coffee menu rows]", "Quarantined Huggs Coffee menu row misattributed to BU PIN (CE17M73J000)."),
    }

    yakun_toastbox_contaminated_lics = {
        "CE12C58X000", "CE19B31L000", "CE20K87K000", "CE22L73K000",
        "NW20T48K000", "SE23M23L000", "W03391E000", "NW04070A000"
    }
    tai_cheong_lics = {
        "CE15K03V000", "CE06536E000", "CE06P09B000", "NE21C32N000",
        "NW20T22J000", "NW21446B000", "SW21P04E000"
    }
    single_row_foreign_lics = {
        "CE08D30V000", "S03282A000", "CE07C99N000", "NW09229P000",
        "W00328A000", "SE08122N000", "SW11882L000", "CE18J30X001",
        "C00056A000", "CE11G53L000", "W00111J000", "W90169A000",
        "SE12L20B000"
    }

    breadtalk_lics = {
        "SW17A65V000", "NW04065P000", "CE18R59K000", "CE16H49B000",
        "CE10L01N000", "CE12J42N000", "CE25H76X000", "SW10169L000"
    }
    mrbean_delivery_lics = {
        "CE10B15X000", "CE13V99K000", "SE13185N000", "CE09718X000",
        "NE16478L000", "SW13T56E000"
    }
    jollibee_delivery_lics = {
        "CE07R64L000", "CE15H95V000", "CE13Z25A000", "C00031X000", "W91159B000"
    }
    yoshinoya_delivery_lics = {
        "CE07611K000", "SE13126N000", "CE13Y77C000", "NE17316P000"
    }
    cbtl_lics = {"W95194P000", "CE06N32P000", "J99032B000", "C98083P000"}
    funtoast_delivery_lics = {"CE05204C000", "SE17709N000", "SE12K92V000"}
    kt_delivery_lics = {"CE16P15X000", "NW07651L000"}

    for r_idx in range(2, ws_menu.max_row + 1):
        venue = ws_menu.cell(row=r_idx, column=col_m_venue).value
        lic = str(ws_menu.cell(row=r_idx, column=col_m_lic).value or "").strip()
        dish = ws_menu.cell(row=r_idx, column=col_m_dish).value
        notes = str(ws_menu.cell(row=r_idx, column=col_m_notes).value or "")
        surl = str(ws_menu.cell(row=r_idx, column=col_m_surl).value or "").strip()
        p_cell = ws_menu.cell(row=r_idx, column=col_m_price).value
        old_p = float(p_cell) if p_cell is not None else None
        dn = norm(dish)
        v_low = str(venue or "").lower()

        # -----------------------------------------------------------------
        # A. CROSS-BRAND CONTAMINATIONS
        # -----------------------------------------------------------------
        if dish == "Special Strawberry Shortcake" and "chateraise" not in v_low:
            quarantine_row(
                r_idx, venue, lic, dish,
                "[QUARANTINED: Cross-brand Chateraise Special Strawberry Shortcake row]",
                "Quarantined Chateraise Special Strawberry Shortcake row misattributed to non-Chateraise venue."
            )
            continue

        if lic in tai_cheong_lics and "chateraisesg.getz.co" in surl:
            ws_menu.cell(row=r_idx, column=col_m_surl).value = None
            record_change(
                "Menu & Price", r_idx, venue, lic, dish,
                "Menu Source URL", surl, None,
                "Cleared cross-brand Chateraise ordering URL (chateraisesg.getz.co) from Tai Cheong Bakery row.",
                None, "No", None
            )
            menu_stats["tai_cheong_wrong_url_cleared"] += 1
            continue

        if lic in full_quarantine_lics:
            tag, desc = full_quarantine_lics[lic]
            quarantine_row(r_idx, venue, lic, dish, tag, desc)
            continue

        if lic in yakun_toastbox_contaminated_lics and "prior Toast Box Harbourfront URL" in notes:
            quarantine_row(
                r_idx, venue, lic, dish,
                "[QUARANTINED: Cross-brand Toast Box Harbourfront menu row]",
                "Quarantined Toast Box Harbourfront menu row misattributed to Ya Kun Kaya Toast."
            )
            continue

        if lic in single_row_foreign_lics and any(k in surl.lower() for k in ("starbucks.com.sg", "mcdonalds.com.sg", "huggscoffee.com")):
            quarantine_row(
                r_idx, venue, lic, dish,
                "[QUARANTINED: Cross-brand foreign chain menu row]",
                "Quarantined cross-brand Starbucks/McDonald's/Huggs Coffee menu row misattributed to unrelated venue."
            )
            continue

        if r_idx == 12509 and "danielfooddiary.com" in surl.lower():
            ws_menu.cell(row=r_idx, column=col_m_surl).value = None
            record_change(
                "Menu & Price", r_idx, venue, lic, dish,
                "Menu Source URL", surl, None,
                "Cleared third-party food blog URL (danielfooddiary.com) from Menu Source URL.",
                None, "No", None
            )
            continue

        # -----------------------------------------------------------------
        # B. OFFICIAL WEBSITE / PDF PRICE & URL REPLACEMENTS
        # -----------------------------------------------------------------

        # 1. Tiong Bahru Bakery (6 licences)
        if lic in tbb_lics:
            d_low = str(dish or "").strip().lower()
            n_low = notes.strip().lower()
            new_p = None
            if (d_low, n_low) in tbb_06nov_updates:
                new_p = tbb_06nov_updates[(d_low, n_low)]
            elif dn in tbb_unambiguous:
                new_p = tbb_unambiguous[dn]

            if new_p is not None and (old_p is None or abs(old_p - new_p) > 0.001):
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Updated Tiong Bahru Bakery item to official 06 Nov 2026 PDF counter price (replacing delivery-inflated or older 13 Oct price).",
                    tbb_pdf_url, "Yes", None
                )
                menu_stats["official_price_updated"] += 1

            if surl != tbb_pdf_url and (new_p is not None or "TBB_MENU_DIGITAL" in surl):
                ws_menu.cell(row=r_idx, column=col_m_surl).value = tbb_pdf_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, tbb_pdf_url,
                    "Updated Tiong Bahru Bakery Menu Source URL to the latest official 06 Nov 2026 PDF menu.",
                    tbb_pdf_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 2. Time Table Cafe (SW14083L000)
        if lic == "SW14083L000" and "Exact normalized English title match in the captured operator menu" in notes:
            ttc_url = "https://timetablecafe.getz.co/"
            m = re.search(r"vs current operator ordering menu (\d+(?:\.\d+)?) SGD", notes)
            if m:
                new_p = float(m.group(1))
                if old_p is None or abs(old_p - new_p) > 0.001:
                    ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                    record_change(
                        "Menu & Price", r_idx, venue, lic, dish,
                        "Price (SGD)", old_p, f"{new_p:.2f}",
                        "Replaced GrabFood delivery price with verified official operator ordering menu price (timetablecafe.getz.co).",
                        ttc_url, "Yes", None
                    )
                    menu_stats["official_price_updated"] += 1
            if surl != ttc_url:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = ttc_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, ttc_url,
                    "Replaced GrabFood URL with verified official operator ordering menu URL (timetablecafe.getz.co).",
                    ttc_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 3. Cedele (SW14536X000 exact matches from snapshot)
        if lic == "SW14536X000" and dn in cedele_official:
            new_p, new_u = cedele_official[dn]
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Replaced Foodpanda price with verified official Cedele website price.",
                    new_u, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != new_u:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = new_u
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, new_u,
                    "Replaced Foodpanda URL with verified official Cedele product URL.",
                    new_u, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 4. BreadTalk (8 licences)
        if lic in breadtalk_lics and dn in breadtalk_official:
            new_p, new_u = breadtalk_official[dn]
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Replaced delivery-inflated price with verified official BreadTalk online shop price (breadtalk.com.sg/shop/).",
                    new_u, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != new_u:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = new_u
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, new_u,
                    "Replaced delivery/blank URL with verified official BreadTalk online shop URL.",
                    new_u, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 5. MOS Burger (SW18617J000 and x0ma Foodpanda rows)
        if ("mos burger" in v_low or lic == "SW18617J000") and dn in mos_official:
            new_p = mos_official[dn]
            mos_url = "https://www.mosburger.com.sg/mos-menu/"
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Replaced Foodpanda/blank price with verified official MOS Burger Singapore menu price.",
                    mos_url, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != mos_url:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = mos_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, mos_url,
                    "Replaced Foodpanda/blank URL with verified official MOS Burger Singapore menu URL.",
                    mos_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 6. Mr Bean (6 delivery/blank-URL licences)
        if lic in mrbean_delivery_lics and dn in mrbean_official:
            new_p, new_u = mrbean_official[dn]
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Replaced Foodpanda/blank price with verified official Mr Bean product price.",
                    new_u, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != new_u:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = new_u
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, new_u,
                    "Replaced Foodpanda/blank URL with verified official Mr Bean product URL.",
                    new_u, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 7. Jollibee (Jollibee Singapore + 5 delivery licences)
        if (venue == "Jollibee Singapore" or lic in jollibee_delivery_lics) and dn in jollibee_official:
            new_p = jollibee_official[dn]
            jb_url = "https://jollibee.com.sg/our-menu"
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Updated Jollibee item to verified official Jollibee Singapore menu price (replacing Foodpanda/blank price).",
                    jb_url, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != jb_url:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = jb_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, jb_url,
                    "Replaced Foodpanda/blank URL with verified official Jollibee Singapore menu URL.",
                    jb_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 8. Yoshinoya (4 delivery licences)
        if lic in yoshinoya_delivery_lics and dn in yoshinoya_official:
            new_p = yoshinoya_official[dn]
            yoshi_url = "https://yoshinoya.com.sg/menu/"
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Updated Yoshinoya item to verified official Yoshinoya Singapore menu price (replacing Foodpanda/blank price).",
                    yoshi_url, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != yoshi_url:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = yoshi_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, yoshi_url,
                    "Replaced Foodpanda/blank URL with verified official Yoshinoya Singapore menu URL.",
                    yoshi_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 9. The Coffee Bean & Tea Leaf (4 licences)
        if lic in cbtl_lics:
            if dn == "colombia narino 7oz":
                cbtl_url = "https://www.coffeebean.com.sg/colombia-narino-7oz.html"
                new_p = 16.90
                if old_p is None or abs(old_p - new_p) > 0.001:
                    ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                    record_change(
                        "Menu & Price", r_idx, venue, lic, dish,
                        "Price (SGD)", old_p, f"{new_p:.2f}",
                        "Replaced Foodpanda price with verified official Coffee Bean & Tea Leaf website price.",
                        cbtl_url, "Yes", None
                    )
                    menu_stats["official_price_updated"] += 1
                if surl != cbtl_url:
                    ws_menu.cell(row=r_idx, column=col_m_surl).value = cbtl_url
                    record_change(
                        "Menu & Price", r_idx, venue, lic, dish,
                        "Menu Source URL", surl if surl else None, cbtl_url,
                        "Replaced Foodpanda URL with verified official Coffee Bean & Tea Leaf product URL.",
                        cbtl_url, "No", None
                    )
                    menu_stats["official_url_updated"] += 1
                continue
            elif dn == "homestyle carrot cake" and lic == "C98083P000" and "foodpanda.sg" in surl:
                cbtl_cakes_url = "https://www.coffeebean.com.sg/order-online/cakes.html"
                ws_menu.cell(row=r_idx, column=col_m_surl).value = cbtl_cakes_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl, cbtl_cakes_url,
                    "Replaced Foodpanda URL with official Coffee Bean & Tea Leaf cakes catalogue URL.",
                    cbtl_cakes_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
                continue

        # 10. Saizeriya (NE04054L000)
        if lic == "NE04054L000" and dn in saizeriya_official:
            new_p = saizeriya_official[dn]
            sz_pdf = "https://www.saizeriya.com.sg/pdf/GrandMenu202609S_single.pdf"
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Replaced unverified delivery-inflated price with verified official Saizeriya Grand Menu PDF price.",
                    sz_pdf, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != sz_pdf:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = sz_pdf
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, sz_pdf,
                    "Set verified official Saizeriya Grand Menu PDF URL on matched item.",
                    sz_pdf, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 11. Fun Toast (3 delivery licences)
        if lic in funtoast_delivery_lics and dn in funtoast_official:
            new_p = funtoast_official[dn]
            ft_url = "https://funtoast.com.sg/menu/"
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Updated Fun Toast item to verified official Fun Toast website menu price.",
                    ft_url, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != ft_url:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = ft_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, ft_url,
                    "Replaced delivery URL with verified official Fun Toast website menu URL.",
                    ft_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

        # 12. Kaffe & Toast (2 delivery licences)
        if lic in kt_delivery_lics and dn in kt_official:
            new_p = kt_official[dn]
            kt_url = "https://www.kaffeandtoast.sg/menus"
            if old_p is None or abs(old_p - new_p) > 0.001:
                ws_menu.cell(row=r_idx, column=col_m_price).value = new_p
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Price (SGD)", old_p, f"{new_p:.2f}",
                    "Updated Kaffe & Toast item to verified official Kaffe & Toast website menu price.",
                    kt_url, "Yes", None
                )
                menu_stats["official_price_updated"] += 1
            if surl != kt_url:
                ws_menu.cell(row=r_idx, column=col_m_surl).value = kt_url
                record_change(
                    "Menu & Price", r_idx, venue, lic, dish,
                    "Menu Source URL", surl if surl else None, kt_url,
                    "Replaced GrabFood URL with verified official Kaffe & Toast website menu URL.",
                    kt_url, "No", None
                )
                menu_stats["official_url_updated"] += 1
            continue

    print("Menu & Price updates summary:", menu_stats)
    print(f"Total Change Manifest entries appended in Pass 2: {len(manifest_entries)}")

    with open(MANIFEST_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "Change ID", "Dataset", "CSV Line", "F&B Venue Name", "SFA Licence",
            "Menu Item / Dish Name", "Field", "Old Value", "New Value", "Reason",
            "Evidence URL", "Evidence Date", "Price Changed", "Stable Row ID"
        ])
        w.writerows(manifest_entries)
    print(f"Saved standalone Pass 2 change manifest to {MANIFEST_CSV_PATH}")

    # =========================================================================
    # PART 3: PRESERVE PRESENTATION & ATOMIC SAVE
    # =========================================================================
    print("Restoring freeze_panes = 'A2' and header styling on Menu & Price...")
    ws_menu.freeze_panes = "A2"
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFFFF")
    header_fill = PatternFill(fill_type="solid", start_color="FF163A37", end_color="FF163A37")
    for col_idx in range(1, len(mh) + 1):
        cell = ws_menu.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill

    print(f"Saving workbook to temporary path {TEMP_WB_PATH}...")
    wb.save(TEMP_WB_PATH)

    print("Verifying ZIP integrity and XML formula/error health...")
    with zipfile.ZipFile(TEMP_WB_PATH, "r") as z:
        bad_file = z.testzip()
        if bad_file:
            raise ValueError(f"Corrupted ZIP member: {bad_file}")
        formula_count = 0
        error_cell_count = 0
        for name in z.namelist():
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                data = z.read(name).decode("utf-8")
                formula_count += data.count("<f>") + data.count("<f ")
                error_cell_count += data.count('t="e"')
        print(f"ZIP integrity: PASS | Raw XML Formula tags: {formula_count} | Error cells: {error_cell_count}")
        if formula_count > 0 or error_cell_count > 0:
            raise ValueError("Formula tags or error cells detected!")

    os.replace(TEMP_WB_PATH, WB_PATH)
    final_sha = calc_sha(WB_PATH)
    final_size = os.path.getsize(WB_PATH)
    print("Successfully updated master workbook!")
    print(f"Final SHA-256: {final_sha} ({final_size} bytes)")


if __name__ == "__main__":
    main()
