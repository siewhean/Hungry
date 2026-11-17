import csv
import re
import openpyxl

tier6_rules = [
    (lambda n: 'JIAN BO' in n or 'SHUI KUEH' in n, 'No', 'Daily 6:30 AM – 8:30 PM', None, 'Jian Bo Shui Kueh'),
    (lambda n: 'ZTP' in n, 'No', 'Daily 10:00 AM – 9:30 PM', None, 'ZTP Ginseng Birdnest'),
    (lambda n: 'WANGS ROASTED' in n or 'WANG\'S ROASTED' in n, 'No', 'Daily 9:30 AM – 8:30 PM', None, 'Wangs Roasted Delights'),
    (lambda n: n in ('FIVE TEN', 'FIVE TEN WESTERN'), 'No', 'Daily 11:30 AM – 9:30 PM', None, 'Five Ten'),
    (lambda n: n in ('7 STARS', '7STARS', '7 STARS COFFEE SHOP'), 'No', 'Daily 6:00 AM – 11:00 PM', None, '7 Stars'),
    (lambda n: 'EAT BAR' in n, 'No', 'Daily 11:00 AM – 10:00 PM', None, 'Eat Bar'),
    (lambda n: n in ('KEI', 'KEI KAISENDON'), 'No', 'Daily 11:00 AM – 10:00 PM', None, 'Kei Kaisendon'),
]

csv_path = 'data/Hungry_Database_Food_Only_2026-10-21.csv'
xlsx_path = 'data/Hungry_Database_Food_Only_2026-10-21.xlsx'

rows = []
with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

print(f'Starting records: {len(rows)}')

updated_hours = 0
updated_halal = 0

for r in rows:
    raw_name = r['F&B Name'].upper()
    clean_name = re.sub(r'\(.*?\)', '', raw_name).strip()
    reg_name = r['Registered Business Name'].upper()
    clean_reg = re.sub(r'\(.*?\)', '', reg_name).strip()
    hrs = r['Opening Hours / Closed Days'].strip()
    halal = r['Halal Certified'].strip()
    
    for rule_fn, target_halal, target_hrs, target_vegan, label in tier6_rules:
        if rule_fn(clean_name) or rule_fn(clean_reg):
            if halal == 'Yes' and target_halal == 'No':
                break
            if not hrs and target_hrs:
                r['Opening Hours / Closed Days'] = target_hrs
                updated_hours += 1
            if halal != target_halal:
                r['Halal Certified'] = target_halal
                updated_halal += 1
            break

print(f'Updated hours: {updated_hours}')
print(f'Updated Halal status: {updated_halal}')

# Write CSV with UTF-8 BOM
with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print('CSV successfully written.')

# Write XLSX
wb = openpyxl.Workbook()
ws = wb.active
ws.title = 'Food Businesses'
ws.append(fieldnames)
for r in rows:
    ws.append([r[col] for col in fieldnames])
wb.save(xlsx_path)

print('XLSX successfully written.')
