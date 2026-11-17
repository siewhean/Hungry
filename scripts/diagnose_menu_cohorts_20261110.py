import openpyxl
from collections import defaultdict, Counter
import re
import json

wb_path = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
wb = openpyxl.load_workbook(wb_path, read_only=True)
ws_dir = wb["Food Directory"]
ws_menu = wb["Menu & Price"]

dir_lics = set()
dir_map = {}
for i, row in enumerate(ws_dir.iter_rows(values_only=True)):
    if i == 0:
        dir_headers = list(row)
        lic_idx = dir_headers.index("SFA Licence")
        name_idx = dir_headers.index("F&B Name")
        postal_idx = dir_headers.index("Postal Code")
        continue
    lic = str(row[lic_idx]).strip() if row[lic_idx] is not None else ""
    if lic:
        dir_lics.add(lic)
        dir_map[lic] = {
            "name": str(row[name_idx]).strip() if row[name_idx] is not None else "",
            "postal": str(row[postal_idx]).strip() if row[postal_idx] is not None else ""
        }

print(f"Total directory licences: {len(dir_lics)}")

# Inspect Menu & Price
unmatched_licences = defaultdict(list)
nonnumeric_prices = Counter()
nonnumeric_samples = defaultdict(list)
missing_price_brands = Counter()

total_menu_rows = 0

for i, row in enumerate(ws_menu.iter_rows(values_only=True)):
    if i == 0:
        menu_headers = list(row)
        m_lic_idx = menu_headers.index("SFA Licence")
        m_name_idx = menu_headers.index("F&B Venue Name")
        m_item_idx = menu_headers.index("Menu Item / Dish Name")
        m_price_idx = menu_headers.index("Price (SGD)")
        m_url_idx = menu_headers.index("Menu Source URL")
        continue
    total_menu_rows += 1
    lic = str(row[m_lic_idx]).strip() if row[m_lic_idx] is not None else ""
    venue = str(row[m_name_idx]).strip() if row[m_name_idx] is not None else ""
    item = str(row[m_item_idx]).strip() if row[m_item_idx] is not None else ""
    price = row[m_price_idx]
    url = str(row[m_url_idx]).strip() if row[m_url_idx] is not None else ""

    # Check licence match
    if lic not in dir_lics:
        unmatched_licences[lic].append({
            "row": i + 1,
            "venue": venue,
            "item": item,
            "url": url
        })

    # Check price
    if price is None or str(price).strip() == "":
        missing_price_brands[venue] += 1
    else:
        p_str = str(price).strip()
        cleaned = p_str.replace("$", "").replace("SGD", "").replace("S$", "").strip()
        try:
            float(cleaned)
        except ValueError:
            nonnumeric_prices[p_str] += 1
            if len(nonnumeric_samples[p_str]) < 3:
                nonnumeric_samples[p_str].append({"row": i + 1, "venue": venue, "item": item, "raw": p_str})

print(f"Total menu rows analyzed: {total_menu_rows}")
print(f"Distinct unmatched licences: {len(unmatched_licences)} (affecting {sum(len(v) for v in unmatched_licences.values())} rows)")
print(f"Distinct non-numeric price patterns: {len(nonnumeric_prices)} (affecting {sum(nonnumeric_prices.values())} rows)")
print(f"Total missing prices: {sum(missing_price_brands.values())} across {len(missing_price_brands)} venues")

# Output summaries
report = {
    "unmatched_licences": {
        lic: {
            "count": len(rows),
            "sample_venue": rows[0]["venue"],
            "sample_item": rows[0]["item"],
            "sample_url": rows[0]["url"]
        }
        for lic, rows in sorted(unmatched_licences.items(), key=lambda x: len(x[1]), reverse=True)
    },
    "top_nonnumeric_prices": [
        {"pattern": pat, "count": cnt, "samples": nonnumeric_samples[pat]}
        for pat, cnt in nonnumeric_prices.most_common(50)
    ],
    "top_missing_price_venues": [
        {"venue": v, "count": c}
        for v, c in missing_price_brands.most_common(30)
    ]
}

with open("outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/menu_cohort_diagnostics.json", "w") as f:
    json.dump(report, f, indent=2)

print("Saved menu_cohort_diagnostics.json successfully.")
