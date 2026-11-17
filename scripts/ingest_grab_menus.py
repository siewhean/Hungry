#!/usr/bin/env python3
"""
scripts/ingest_grab_menus.py

Adapter: converts GrabFood enrichment results (default data/menu_enrichment_test.json)
into the 28-column Document 2 schema and appends them to
data/Hungry Full Menu & Price - 21 Oct 2026.csv / .xlsx (same pattern as
ingest_parsed_foodpanda_menus.py). Existing rows are never modified.

Stall identity: enrichment rows come from a legacy workbook (uri 'row-N'), so the
SFA licence is resolved against Document 1 by normalised name; if several Doc1
venues share the name, the stall address must also match. Ambiguous/unmatched
stalls are skipped and reported. Dedupes on (SFA licence, dish name).
Source is marked via Menu Source URL (food.grab.com) and a '[GrabFood]' tag in notes.

Usage: python3 scripts/ingest_grab_menus.py [json_path] [--dry-run]
"""
import csv
import json
import re
import sys
import xlsxwriter

DOC1_CSV = 'data/Hungry_Database_Food_Only_2026-10-21.csv'
DOC2_CSV = 'data/Hungry Full Menu & Price - 21 Oct 2026.csv'
DOC2_XLSX = 'data/Hungry Full Menu & Price - 21 Oct 2026.xlsx'
TODAY = '2026-11-05'

COLS = [
    'F&B Venue Name', 'SFA Licence', 'Address', 'Postal Code',
    'Menu Item / Dish Name', 'Category / Section', 'Price (SGD)',
    'Description / Notes', 'Dish Image URL', 'Menu Source URL',
    'Last Verified Date', 'Halal', 'Vegetarian', 'Vegan', 'Pork-free',
    'Gluten-free', 'Dairy-free', 'Nut-free', 'Beef', 'Milk', 'Eggs',
    'Fish', 'Crustaceans', 'Soy', 'Peanuts', 'Tree nuts', 'Wheat', 'Intolerances'
]


def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()


def resolve_venue(stall, by_name):
    cands = by_name.get(norm(stall.get('stall_name')), [])
    if len(cands) == 1:
        return cands[0]
    toks = norm(stall.get('address')).split()[:3]
    if toks:
        m = [c for c in cands if all(t in norm(c['Full Address']) for t in toks)]
        if len(m) == 1:
            return m[0]
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    src = args[0] if args else 'data/menu_enrichment_test.json'
    stalls = json.load(open(src, encoding='utf-8'))

    by_name = {}
    with open(DOC1_CSV, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            by_name.setdefault(norm(r['F&B Name']), []).append(r)

    with open(DOC2_CSV, encoding='utf-8-sig', newline='') as f:
        all_rows = list(csv.DictReader(f))
    existing = {(r['SFA Licence'].strip(), r['Menu Item / Dish Name'].strip().lower()) for r in all_rows}
    before = len(all_rows)

    new_rows, matched, unmatched = [], 0, []
    for st in stalls:
        v = resolve_venue(st, by_name)
        if not v:
            unmatched.append(st.get('stall_name'))
            continue
        matched += 1
        lic = v['SFA Licence'].strip()
        halal = v.get('Halal Certified', '').strip()
        halal = halal if halal in ('Yes', 'No') else ''
        for d in st.get('dishes', []):
            name = (d.get('name') or '').strip()
            price = d.get('price')
            if not name or price in (None, ''):
                continue
            key = (lic, name.lower())
            if key in existing:
                continue
            existing.add(key)
            row = {c: '' for c in COLS}
            row.update({
                'F&B Venue Name': v['F&B Name'].strip(),
                'SFA Licence': lic,
                'Address': v.get('Full Address', '').strip(),
                'Postal Code': v.get('Postal Code', '').strip(),
                'Menu Item / Dish Name': name,
                'Price (SGD)': f'{float(price):.2f}',
                'Description / Notes': ((d.get('description') or '').strip() + ' [GrabFood]').strip(),
                'Dish Image URL': (d.get('imageUrl') or '').strip(),
                'Menu Source URL': (st.get('url') or '').strip(),
                'Last Verified Date': TODAY,
                'Halal': halal,
            })
            new_rows.append(row)

    print(f'stalls={len(stalls)} matched={matched} unmatched={len(unmatched)} new_rows={len(new_rows)} before={before}')
    if unmatched:
        print('unmatched:', unmatched)
    if dry or not new_rows:
        return

    all_rows.extend(new_rows)
    with open(DOC2_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(all_rows)

    wb = xlsxwriter.Workbook(DOC2_XLSX, {'constant_memory': True, 'strings_to_urls': False})
    ws = wb.add_worksheet('Hungry Full Menu & Price')
    ws.write_row(0, 0, COLS)
    for i, r in enumerate(all_rows, start=1):
        ws.write_row(i, 0, [r.get(c, '') for c in COLS])
    wb.close()
    print(f'written: {len(all_rows)} rows (CSV + XLSX)')


if __name__ == '__main__':
    main()
