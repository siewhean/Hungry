#!/usr/bin/env python3
"""
verify_enrichment_audit_readback_20261110.py

Runs the 5-Gate Food Directory audit and Menu & Price verification on the updated master workbook,
and outputs a JSON verification report to:
  outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/verified_enrichment_audit_2026-11-10/post_update_verification_report.json
"""

import os
import json
import hashlib
import zipfile
import urllib.parse
from collections import Counter
import openpyxl

ROOT = "/Users/Siew Hean/Documents/GitHub/Hungry"
WB_PATH = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx",
)
REPORT_PATH = os.path.join(
    ROOT,
    "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/verified_enrichment_audit_2026-11-10/post_update_verification_report.json",
)


def calc_sha(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    sha = calc_sha(WB_PATH)
    size = os.path.getsize(WB_PATH)

    with zipfile.ZipFile(WB_PATH, "r") as z:
        bad_zip = z.testzip()
        formula_count = 0
        error_cell_count = 0
        for name in z.namelist():
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"):
                data = z.read(name).decode("utf-8")
                formula_count += data.count("<f>") + data.count("<f ")
                error_cell_count += data.count('t="e"')

    wb = openpyxl.load_workbook(WB_PATH, read_only=True)
    ws_dir = wb["Food Directory"]
    ws_menu = wb["Menu & Price"]
    ws_cm = wb["Change Manifest"]

    dh = {str(c or "").strip(): i for i, c in enumerate(next(ws_dir.iter_rows(min_row=1, max_row=1, values_only=True)))}
    mh = {str(c or "").strip(): i for i, c in enumerate(next(ws_menu.iter_rows(min_row=1, max_row=1, values_only=True)))}

    # Check Food Directory 5 Gates
    dir_rows = 0
    bare_digit_rbn = 0
    orphan_maps_url = 0
    place_ids = Counter()
    third_party_websites = 0
    bad_domains = (
        "grab.onelink.me", "cho.pe", "meuu.online", "oddle.restaurant", "luckycat.media",
        "tabsquare.ai", "sevenrooms.com", "opentable.com", "tablecheck.com", "quandoo.sg",
        "order.yqueue.co", "foodpanda.page.link", "foodpanda.go.link", "tinyurl.com",
        "misstamchiak.com", "blogspot.sg", "alvinology.com", "hyperlocal.sg", "google.com",
        "csp.sfa.gov.sg", "getz.co", "jewelchangiairport.com", "changiairport.com",
        "ionorchard.com", "takashimaya.com.sg", "takashimayasc.com.sg", "wismaonline.com",
        "nex.com.sg", "northpointcity.com.sg", "westmall.com.sg", "tiongbahruplaza.com.sg",
        "compassone.sg", "heartlandmall.com.sg", "hougangmall.com.sg", "waterwaypoint.com.sg",
    )

    for row in ws_dir.iter_rows(min_row=2, values_only=True):
        dir_rows += 1
        rbn = str(row[dh["Registered Business Name"]] or "").strip()
        if rbn.isdigit():
            bare_digit_rbn += 1
        pid = str(row[dh["Google Place ID"]] or "").strip()
        murl = str(row[dh["Google Maps URL"]] or "").strip()
        if murl and not pid:
            orphan_maps_url += 1
        if pid:
            place_ids[pid] += 1
        web = str(row[dh["Website"]] or "").strip()
        if web:
            host = urllib.parse.urlparse(web).netloc.lower()
            if any(bd in host or bd in web.lower() for bd in bad_domains):
                third_party_websites += 1

    dup_place_ids = {k: v for k, v in place_ids.items() if v > 1}

    # Check Menu & Price gates
    menu_rows = 0
    resize_query_images = 0
    quarantined_total = 0
    quarantined_with_price = 0
    quarantined_with_date = 0
    kakushin_notes = []

    for r_idx, row in enumerate(ws_menu.iter_rows(min_row=2, values_only=True), start=2):
        menu_rows += 1
        img = str(row[mh["Dish Image URL"]] or "").strip()
        if "?" in img and any(k in img.lower() for k in ("width=", "height=", "w=", "h=", "resize=", "fit=", "canvas=")):
            resize_query_images += 1
        desc = str(row[mh["Description / Notes"]] or "")
        if "[QUARANTINED:" in desc:
            quarantined_total += 1
            if row[mh["Price (SGD)"]] is not None:
                quarantined_with_price += 1
            if row[mh["Last Verified Date"]] is not None:
                quarantined_with_date += 1
        if r_idx in (4430, 4431, 4432):
            kakushin_notes.append((r_idx, row[mh["Price (SGD)"]], desc))

    cm_rows = sum(1 for _ in ws_cm.iter_rows(min_row=2, values_only=True))

    report = {
        "workbook_path": WB_PATH,
        "sha256": sha,
        "size_bytes": size,
        "zip_integrity_pass": bad_zip is None,
        "xml_formula_tags": formula_count,
        "xml_error_cells": error_cell_count,
        "food_directory": {
            "total_rows": dir_rows,
            "bare_digit_rbn": bare_digit_rbn,
            "orphan_maps_url_without_place_id": orphan_maps_url,
            "duplicate_place_ids": dup_place_ids,
            "remaining_flagged_third_party_or_mall_websites": third_party_websites,
        },
        "menu_and_price": {
            "total_rows": menu_rows,
            "resize_query_dish_images": resize_query_images,
            "quarantined_rows_total": quarantined_total,
            "quarantined_rows_with_price": quarantined_with_price,
            "quarantined_rows_with_verified_date": quarantined_with_date,
            "kakushin_rows": kakushin_notes,
        },
        "change_manifest_total_rows": cm_rows,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
