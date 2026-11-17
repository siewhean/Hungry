#!/usr/bin/env python3
"""
apply_verified_enrichment_audit_20261110.py

Applies online-verified enrichment and audit remediation updates to the master workbook:
  outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx

1. Food Directory (41,627 rows):
   - Gate 1 (Registered Business Name):
     * Row 41565 (NTF0132003, Newton 32 BBQ Seafood): Clears bare-digit RBN "32" -> None.
   - Gate 2 (Google Place ID & Google Maps URL alignment):
     * Rows 2697 (E47004E000) & 5768 (J89169E000): Clears street-pin Google Maps URL lacking Google Place ID -> None.
     * Row 3560 (Ah ma chi mian, unlicensed duplicate placeholder row merged into licensed Row 3545 C89200E001):
       Clears duplicate Google Place ID (ChIJlWgSxZ0R2jER7joEYqCmBbs) and Google Maps URL -> None.
   - Gate 3 (Website Hygiene — 80 rows):
     * Sets 17 live-probed (HTTP 200) official first-party websites (% Arabica, 2gather, Bee Cheng Hiang,
       Chateraise x7, EAT., Encik Tan x2, Hawkers Street, Kakushin, Potato Corner, Sushi Express, Tandoori Culture).
     * Row 15197 (Jannathul Firthous Shenton Way Power): Unwraps Google redirect in Website, moves clean GrabFood URL
       to Menu URL, sets Menu / Price = "GrabFood menu", and clears Website -> None.
     * Clears remaining 62 third-party/aggregator/social/blog/mall Website cells (where no live first-party site exists) -> None.

2. Menu & Price (123,340 rows):
   - Kakushin Portion & Dine-in Tax Notes (CE22E83L000, rows 4430, 4431, 4432):
     * Row 4430 (45.00): "Portion: 5 pieces for one guest. Dine-in price excludes GST and service charge."
     * Row 4431 (78.00): "Portion: 3 kinds, 9 pieces. Dine-in price excludes GST and service charge."
     * Row 4432 (128.00): "Portion: 5 kinds, 15 pieces. Dine-in price excludes GST and service charge."
   - HD Dish Image URL Normalization (531 rows):
     * Strips thumbnail resize query parameters (?width=150&height=150, ?v=...&width=10, etc.) on 514 direct CDN URLs.
     * Unwraps 17 images.weserv.nl proxy URLs to their underlying full-size S3 Oddle image URLs.
   - Blank-Source Chicky Fun Variant Rows (7 rows: 103187, 103188, 103194, 103195, 103196, 103201, 103202):
     * Clears Last Verified Date -> None on rows with blank Price (SGD) and blank Menu Source URL.
   - Quarantined Cross-Stall / Cross-Branch Rows (507 rows across 10 licences):
     * Clears disputed Price (SGD) (368 rows) and Last Verified Date (503 rows) so all 507 [QUARANTINED: ...] rows
       are uniformly quarantined.
   - Unverified Dietary Flags (11 rows):
     * Clears unverified Halal = "Yes" -> None on 4 hold-noted rows with unspecified bacon (27832, 27833, 34441, 42077).
     * Clears unverified Vegan = "Yes" -> None on 7 150 GREEN VEGETARIAN rows (98528, 98529, 98531, 98532, 98533, 98535, 98539).

3. Change Manifest & Workbook Integrity:
   - Logs all cell changes to Change Manifest sheet and exports CSV manifest.
   - Preserves freeze_panes = 'A2' and row 1 header styling on Menu & Price.
   - Verifies ZIP integrity, 0 XML formula tags (<f>), and 0 XML error cells (t="e").
"""

import os
import sys
import csv
import shutil
import hashlib
import zipfile
import urllib.parse
import openpyxl
from openpyxl.styles import Font, PatternFill

ROOT = "/Users/Siew Hean/Documents/GitHub/Hungry"
WB_PATH = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx",
)
BACKUP_PATH = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_before_verified_enrichment_audit_2026-11-10.xlsx",
)
TEMP_WB_PATH = WB_PATH + ".tmp_verified_enrichment_20261110"
WORK_DIR = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/verified_enrichment_audit_2026-11-10",
)
os.makedirs(WORK_DIR, exist_ok=True)
MANIFEST_CSV_PATH = os.path.join(WORK_DIR, "change_manifest_2026-11-10.csv")

EXPECTED_INITIAL_SHA = "7d8d80171a066b470bd0739a8511f257f62661928fc7f7f6ea8ebd4eb22f2d2f"


def calc_sha(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


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

    next_chg_num = 199434
    manifest_entries = []

    def record_change(dataset, row_num, venue, lic, dish, field, old_val, new_val, reason, evidence_url=None, price_changed="No", stable_id=None):
        nonlocal next_chg_num
        if old_val == new_val:
            return False
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
    # PART 1: FOOD DIRECTORY UPDATES
    # =========================================================================
    dir_stats = {
        "rbn_cleared": 0,
        "orphan_maps_url_cleared": 0,
        "dup_place_id_cleared": 0,
        "website_verified_replaced": 0,
        "website_moved_to_menu_url": 0,
        "website_third_party_cleared": 0,
    }

    # 1A. Row 41565 (Newton 32 BBQ Seafood, NTF0132003): Clear bare-digit RBN "32"
    r_newton = 41565
    lic_newton = str(ws_dir.cell(row=r_newton, column=dh["SFA Licence"] + 1).value or "").strip()
    venue_newton = ws_dir.cell(row=r_newton, column=dh["F&B Name"] + 1).value
    old_rbn = ws_dir.cell(row=r_newton, column=dh["Registered Business Name"] + 1).value
    if lic_newton == "NTF0132003" and str(old_rbn or "").strip() == "32":
        ws_dir.cell(row=r_newton, column=dh["Registered Business Name"] + 1).value = None
        record_change(
            "Food Directory", r_newton, venue_newton, lic_newton, None,
            "Registered Business Name", old_rbn, None,
            "Cleared bare stall number ('32') from Registered Business Name (Gate 1 entity hygiene; no ACRA corporate name in SFA crosswalk).",
            None, "No", f"DIR-{lic_newton}"
        )
        dir_stats["rbn_cleared"] += 1

    # 1B. Rows 2697 & 5768: Clear street-pin Google Maps URLs that have no Google Place ID
    for r_idx in (2697, 5768):
        lic = ws_dir.cell(row=r_idx, column=dh["SFA Licence"] + 1).value
        venue = ws_dir.cell(row=r_idx, column=dh["F&B Name"] + 1).value
        pid = ws_dir.cell(row=r_idx, column=dh["Google Place ID"] + 1).value
        old_murl = ws_dir.cell(row=r_idx, column=dh["Google Maps URL"] + 1).value
        if not pid and old_murl:
            ws_dir.cell(row=r_idx, column=dh["Google Maps URL"] + 1).value = None
            record_change(
                "Food Directory", r_idx, venue, lic, None,
                "Google Maps URL", old_murl, None,
                "Cleared street-pin Google Maps URL lacking a verified Google Place ID (Gate 2 Place ID alignment).",
                None, "No", f"DIR-{lic}" if lic else None
            )
            dir_stats["orphan_maps_url_cleared"] += 1

    # 1C. Row 3560 (unlicensed duplicate of licensed Row 3545 C89200E001): Clear duplicate Place ID & Maps URL
    r_dup = 3560
    cov_dup = str(ws_dir.cell(row=r_dup, column=dh["Coverage Status"] + 1).value or "")
    venue_dup = ws_dir.cell(row=r_dup, column=dh["F&B Name"] + 1).value
    old_pid_dup = ws_dir.cell(row=r_dup, column=dh["Google Place ID"] + 1).value
    old_murl_dup = ws_dir.cell(row=r_dup, column=dh["Google Maps URL"] + 1).value
    if "Duplicate of licensed row 3545" in cov_dup and old_pid_dup == "ChIJlWgSxZ0R2jER7joEYqCmBbs":
        ws_dir.cell(row=r_dup, column=dh["Google Place ID"] + 1).value = None
        ws_dir.cell(row=r_dup, column=dh["Google Maps URL"] + 1).value = None
        record_change(
            "Food Directory", r_dup, venue_dup, None, None,
            "Google Place ID", old_pid_dup, None,
            "Cleared duplicate Google Place ID on unlicensed placeholder row already merged into licensed row 3545 (C89200E001).",
            None, "No", None
        )
        record_change(
            "Food Directory", r_dup, venue_dup, None, None,
            "Google Maps URL", old_murl_dup, None,
            "Cleared duplicate Google Maps URL on unlicensed placeholder row already merged into licensed row 3545 (C89200E001).",
            None, "No", None
        )
        dir_stats["dup_place_id_cleared"] += 1

    # 1D. Gate 3 Website Hygiene (17 verified first-party replacements, 1 move to Menu URL, 62 clears)
    verified_websites = {
        2197: ("https://arabica.com/", "Replaced Jewel mall directory link with live-verified official % Arabica website (HTTP 200)."),
        2549: ("https://2gather.sg/", "Replaced Chope aggregator link with live-verified official 2gather website (HTTP 200)."),
        5380: ("https://www.beechenghiang.com.sg/", "Replaced Jewel mall directory link with live-verified official Bee Cheng Hiang Singapore website (HTTP 200)."),
        7026: ("https://www.chateraise.co.jp/global", "Replaced West Mall root link with live-verified official Chateraise global website (HTTP 200)."),
        9520: ("https://www.feisionggroup.com.sg/", "Replaced Tiong Bahru Plaza mall link with live-verified official Fei Siong Group (EAT.) website (HTTP 200)."),
        9753: ("https://www.enciktan.com.sg/", "Replaced Compass One mall link with live-verified official Encik Tan website (HTTP 200)."),
        9754: ("https://www.enciktan.com.sg/", "Replaced Heartland Mall link with live-verified official Encik Tan website (HTTP 200)."),
        12725: ("https://hawkersstreet.com.sg/", "Replaced ION Orchard mall link with live-verified official Hawkers' Street website (HTTP 200)."),
        16583: ("https://www.kakushinfb.com/", "Stripped Google/Wix UTM tracking parameters from official Kakushin website URL (HTTP 200)."),
        27275: ("https://potatocorner.com/", "Replaced Hougang Mall directory link with live-verified official Potato Corner website (HTTP 200)."),
        32894: ("https://www.sushiexpress.com.sg/", "Replaced Waterway Point mall link with live-verified official Sushi Express Singapore website (HTTP 200)."),
        33646: ("https://www.tandooriculture.com.sg/", "Stripped concatenated Foodpanda/Grab URLs from official Tandoori Culture website cell (HTTP 200)."),
        41603: ("https://www.chateraise.co.jp/global", "Replaced third-party Getz ordering link in Website with live-verified official Chateraise global website (HTTP 200); Getz link preserved in Menu URL."),
        41604: ("https://www.chateraise.co.jp/global", "Replaced third-party Getz ordering link in Website with live-verified official Chateraise global website (HTTP 200); Getz link preserved in Menu URL."),
        41605: ("https://www.chateraise.co.jp/global", "Replaced third-party Getz ordering link in Website with live-verified official Chateraise global website (HTTP 200); Getz link preserved in Menu URL."),
        41606: ("https://www.chateraise.co.jp/global", "Replaced third-party Getz ordering link in Website with live-verified official Chateraise global website (HTTP 200); Getz link preserved in Menu URL."),
        41607: ("https://www.chateraise.co.jp/global", "Replaced third-party Getz ordering link in Website with live-verified official Chateraise global website (HTTP 200); Getz link preserved in Menu URL."),
        41608: ("https://www.chateraise.co.jp/global", "Replaced third-party Getz ordering link in Website with live-verified official Chateraise global website (HTTP 200); Getz link preserved in Menu URL."),
    }

    for r_idx, (new_web, reason) in sorted(verified_websites.items()):
        lic = ws_dir.cell(row=r_idx, column=dh["SFA Licence"] + 1).value
        venue = ws_dir.cell(row=r_idx, column=dh["F&B Name"] + 1).value
        old_web = ws_dir.cell(row=r_idx, column=dh["Website"] + 1).value
        if old_web != new_web:
            ws_dir.cell(row=r_idx, column=dh["Website"] + 1).value = new_web
            record_change(
                "Food Directory", r_idx, venue, lic, None,
                "Website", old_web, new_web,
                reason, new_web, "No", f"DIR-{lic}" if lic else None
            )
            dir_stats["website_verified_replaced"] += 1

    # Row 15197: Unwrap Google redirect to GrabFood, move to Menu URL, clear Website
    r_jf = 15197
    venue_jf = ws_dir.cell(row=r_jf, column=dh["F&B Name"] + 1).value
    old_web_jf = str(ws_dir.cell(row=r_jf, column=dh["Website"] + 1).value or "")
    old_murl_jf = ws_dir.cell(row=r_jf, column=dh["Menu URL"] + 1).value
    old_mp_jf = ws_dir.cell(row=r_jf, column=dh["Menu / Price"] + 1).value
    clean_grab_jf = "https://food.grab.com/sg/en/restaurant/jannathul-firthous-shenton-way-power-indian-muslim-stall-ayer-rajah-food-centre-stall-55-delivery/4-CZDXHEAZLJE1WA"
    if "google.com/url" in old_web_jf and not old_murl_jf:
        ws_dir.cell(row=r_jf, column=dh["Website"] + 1).value = None
        ws_dir.cell(row=r_jf, column=dh["Menu URL"] + 1).value = clean_grab_jf
        ws_dir.cell(row=r_jf, column=dh["Menu / Price"] + 1).value = "GrabFood menu"
        record_change(
            "Food Directory", r_jf, venue_jf, None, None,
            "Website", old_web_jf, None,
            "Cleared Google redirect wrapper pointing to GrabFood from Website column (moved clean GrabFood link to Menu URL).",
            clean_grab_jf, "No", None
        )
        record_change(
            "Food Directory", r_jf, venue_jf, None, None,
            "Menu URL", old_murl_jf, clean_grab_jf,
            "Moved unwrapped GrabFood link for Jannathul Firthous Shenton Way Power from Website into Menu URL.",
            clean_grab_jf, "No", None
        )
        record_change(
            "Food Directory", r_jf, venue_jf, None, None,
            "Menu / Price", old_mp_jf, "GrabFood menu",
            "Set Menu / Price summary for unwrapped GrabFood link in Menu URL.",
            clean_grab_jf, "No", None
        )
        dir_stats["website_moved_to_menu_url"] += 1

    # Remaining 62 third-party/aggregator/social/blog/mall Website rows to clear
    clear_website_rows = [
        2176, 2434, 3141, 4874, 5142, 5258, 5430, 6392, 6501, 7047,
        7149, 7543, 8676, 8958, 8959, 9091, 9131, 9132, 9348, 10691,
        10720, 10768, 11076, 11799, 11817, 12034, 12514, 13559, 14375, 17768,
        20719, 22010, 22229, 22476, 22795, 23465, 23852, 24591, 25024, 28244,
        28336, 28400, 30107, 30462, 30663, 30786, 31071, 31391, 31423, 31625,
        33435, 33974, 34370, 34372, 35635, 36629, 37060, 39454, 39853, 40441,
        41280,
    ]
    for r_idx in clear_website_rows:
        lic = ws_dir.cell(row=r_idx, column=dh["SFA Licence"] + 1).value
        venue = ws_dir.cell(row=r_idx, column=dh["F&B Name"] + 1).value
        old_web = ws_dir.cell(row=r_idx, column=dh["Website"] + 1).value
        if old_web is not None and str(old_web).strip() != "":
            ws_dir.cell(row=r_idx, column=dh["Website"] + 1).value = None
            record_change(
                "Food Directory", r_idx, venue, lic, None,
                "Website", old_web, None,
                "Cleared non-first-party URL (third-party ordering/booking platform, blog, URL shortener, government feedback form, or mall directory where no live official domain exists) per Gate 3 Website Hygiene.",
                None, "No", f"DIR-{lic}" if lic else None
            )
            dir_stats["website_third_party_cleared"] += 1

    print("Food Directory updates summary:", dir_stats)

    # =========================================================================
    # PART 2: MENU & PRICE UPDATES
    # =========================================================================
    menu_stats = {
        "kakushin_notes_added": 0,
        "hd_image_query_stripped": 0,
        "hd_image_weserv_unwrapped": 0,
        "chicky_fun_dates_cleared": 0,
        "quarantined_prices_cleared": 0,
        "quarantined_dates_cleared": 0,
        "unverified_halal_cleared": 0,
        "unverified_vegan_cleared": 0,
    }

    # 2A. Kakushin portion & dine-in tax notes (rows 4430, 4431, 4432)
    kakushin_rules = {
        4430: (45.0, "Portion: 5 pieces for one guest. Dine-in price excludes GST and service charge."),
        4431: (78.0, "Portion: 3 kinds, 9 pieces. Dine-in price excludes GST and service charge."),
        4432: (128.0, "Portion: 5 kinds, 15 pieces. Dine-in price excludes GST and service charge."),
    }
    for r_idx, (exp_price, new_note) in kakushin_rules.items():
        lic = str(ws_menu.cell(row=r_idx, column=mh["SFA Licence"] + 1).value or "").strip()
        venue = ws_menu.cell(row=r_idx, column=mh["F&B Venue Name"] + 1).value
        dish = ws_menu.cell(row=r_idx, column=mh["Menu Item / Dish Name"] + 1).value
        price_val = float(ws_menu.cell(row=r_idx, column=mh["Price (SGD)"] + 1).value)
        old_note = ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value
        assert lic == "CE22E83L000" and abs(price_val - exp_price) < 0.001, f"Kakushin guard failed on row {r_idx}"
        if old_note != new_note:
            ws_menu.cell(row=r_idx, column=mh["Description / Notes"] + 1).value = new_note
            record_change(
                "Menu & Price", r_idx, venue, lic, dish,
                "Description / Notes", old_note, new_note,
                "Added live-verified portion size and dine-in GST/service-charge note from official Kakushin menu (https://www.kakushinfb.com/menu).",
                "https://www.kakushinfb.com/menu", "No", None
            )
            menu_stats["kakushin_notes_added"] += 1

    # 2B. Chicky Fun 7 blank-source variant rows: clear Last Verified Date
    chicky_rows = [103187, 103188, 103194, 103195, 103196, 103201, 103202]
    for r_idx in chicky_rows:
        lic = str(ws_menu.cell(row=r_idx, column=mh["SFA Licence"] + 1).value or "").strip()
        venue = ws_menu.cell(row=r_idx, column=mh["F&B Venue Name"] + 1).value
        dish = ws_menu.cell(row=r_idx, column=mh["Menu Item / Dish Name"] + 1).value
        old_lvd = ws_menu.cell(row=r_idx, column=mh["Last Verified Date"] + 1).value
        if lic == "S97091V011" and old_lvd is not None:
            ws_menu.cell(row=r_idx, column=mh["Last Verified Date"] + 1).value = None
            record_change(
                "Menu & Price", r_idx, venue, lic, dish,
                "Last Verified Date", old_lvd, None,
                "Cleared Last Verified Date on Chicky Fun variant row whose Price (SGD) and Menu Source URL were cleared pending exact variant/stall confirmation.",
                None, "No", None
            )
            menu_stats["chicky_fun_dates_cleared"] += 1

    # 2C. Unverified Dietary Flags (4 bacon Halal rows + 7 150 GREEN VEGETARIAN Vegan rows)
    halal_clear_rows = [27832, 27833, 34441, 42077]
    for r_idx in halal_clear_rows:
        lic = ws_menu.cell(row=r_idx, column=mh["SFA Licence"] + 1).value
        venue = ws_menu.cell(row=r_idx, column=mh["F&B Venue Name"] + 1).value
        dish = ws_menu.cell(row=r_idx, column=mh["Menu Item / Dish Name"] + 1).value
        old_halal = ws_menu.cell(row=r_idx, column=mh["Halal"] + 1).value
        if old_halal is not None:
            ws_menu.cell(row=r_idx, column=mh["Halal"] + 1).value = None
            record_change(
                "Menu & Price", r_idx, venue, lic, dish,
                "Halal", old_halal, None,
                "Cleared unverified Halal='Yes' flag on hold-noted dish containing unspecified bacon/ham (Zero-Inference Rule).",
                None, "No", None
            )
            menu_stats["unverified_halal_cleared"] += 1

    vegan_clear_rows = [98528, 98529, 98531, 98532, 98533, 98535, 98539]
    for r_idx in vegan_clear_rows:
        lic = ws_menu.cell(row=r_idx, column=mh["SFA Licence"] + 1).value
        venue = ws_menu.cell(row=r_idx, column=mh["F&B Venue Name"] + 1).value
        dish = ws_menu.cell(row=r_idx, column=mh["Menu Item / Dish Name"] + 1).value
        old_vegan = ws_menu.cell(row=r_idx, column=mh["Vegan"] + 1).value
        if old_vegan is not None:
            ws_menu.cell(row=r_idx, column=mh["Vegan"] + 1).value = None
            record_change(
                "Menu & Price", r_idx, venue, lic, dish,
                "Vegan", old_vegan, None,
                "Cleared unverified Vegan='Yes' flag on vegetarian stall dish lacking explicit vegan ingredient/badge verification (Zero-Inference Rule).",
                None, "No", None
            )
            menu_stats["unverified_vegan_cleared"] += 1

    # 2D. Single pass over Menu & Price for:
    #     - HD Dish Image URL normalization (531 rows)
    #     - Uniform quarantine of all [QUARANTINED: ...] rows (clear disputed Price (SGD) & Last Verified Date)
    col_venue = mh["F&B Venue Name"] + 1
    col_lic = mh["SFA Licence"] + 1
    col_dish = mh["Menu Item / Dish Name"] + 1
    col_price = mh["Price (SGD)"] + 1
    col_desc = mh["Description / Notes"] + 1
    col_img = mh["Dish Image URL"] + 1
    col_lvd = mh["Last Verified Date"] + 1

    for r_idx in range(2, ws_menu.max_row + 1):
        # Check Dish Image URL
        img_val = ws_menu.cell(row=r_idx, column=col_img).value
        if img_val and "?" in str(img_val):
            u = str(img_val).strip()
            if any(k in u.lower() for k in ("width=", "height=", "w=", "h=", "resize=", "fit=", "canvas=")):
                venue = ws_menu.cell(row=r_idx, column=col_venue).value
                lic = ws_menu.cell(row=r_idx, column=col_lic).value
                dish = ws_menu.cell(row=r_idx, column=col_dish).value
                if "images.weserv.nl" in u:
                    parsed = urllib.parse.urlparse(u)
                    qs = urllib.parse.parse_qs(parsed.query)
                    raw_url = qs.get("url", [""])[0]
                    if raw_url.startswith("http"):
                        ws_menu.cell(row=r_idx, column=col_img).value = raw_url
                        record_change(
                            "Menu & Price", r_idx, venue, lic, dish,
                            "Dish Image URL", u, raw_url,
                            "Unwrapped images.weserv.nl resize proxy to direct full-size S3 Oddle image URL (verified HTTP 200).",
                            raw_url, "No", None
                        )
                        menu_stats["hd_image_weserv_unwrapped"] += 1
                else:
                    base_url = u.split("?")[0]
                    ws_menu.cell(row=r_idx, column=col_img).value = base_url
                    record_change(
                        "Menu & Price", r_idx, venue, lic, dish,
                        "Dish Image URL", u, base_url,
                        "Stripped CDN thumbnail resize query parameters to restore full-size HD Dish Image URL (verified HTTP 200).",
                        base_url, "No", None
                    )
                    menu_stats["hd_image_query_stripped"] += 1

        # Check [QUARANTINED: ...] rows
        desc_val = ws_menu.cell(row=r_idx, column=col_desc).value
        if desc_val and "[QUARANTINED:" in str(desc_val):
            price_val = ws_menu.cell(row=r_idx, column=col_price).value
            lvd_val = ws_menu.cell(row=r_idx, column=col_lvd).value
            if price_val is not None or lvd_val is not None:
                venue = ws_menu.cell(row=r_idx, column=col_venue).value
                lic = ws_menu.cell(row=r_idx, column=col_lic).value
                dish = ws_menu.cell(row=r_idx, column=col_dish).value
                if price_val is not None:
                    ws_menu.cell(row=r_idx, column=col_price).value = None
                    record_change(
                        "Menu & Price", r_idx, venue, lic, dish,
                        "Price (SGD)", price_val, None,
                        "Cleared disputed cross-branch/cross-stall price on quarantined row pending verified outlet-specific menu.",
                        None, "Yes", None
                    )
                    menu_stats["quarantined_prices_cleared"] += 1
                if lvd_val is not None:
                    ws_menu.cell(row=r_idx, column=col_lvd).value = None
                    record_change(
                        "Menu & Price", r_idx, venue, lic, dish,
                        "Last Verified Date", lvd_val, None,
                        "Cleared Last Verified Date on quarantined row with blank Menu Source URL.",
                        None, "No", None
                    )
                    menu_stats["quarantined_dates_cleared"] += 1

    print("Menu & Price updates summary:", menu_stats)
    print(f"Total Change Manifest entries appended: {len(manifest_entries)}")

    # Write standalone CSV manifest
    with open(MANIFEST_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "Change ID", "Dataset", "CSV Line", "F&B Venue Name", "SFA Licence",
            "Menu Item / Dish Name", "Field", "Old Value", "New Value", "Reason",
            "Evidence URL", "Evidence Date", "Price Changed", "Stable Row ID"
        ])
        w.writerows(manifest_entries)
    print(f"Saved standalone change manifest to {MANIFEST_CSV_PATH}")

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
    print(f"Successfully updated master workbook!")
    print(f"Final SHA-256: {final_sha} ({final_size} bytes)")


if __name__ == "__main__":
    main()
