import csv
import re
import openpyxl

tier5_rules = [
    (lambda n: 'DOUGH MAGIC' in n, 'No', 'Daily 10:00 AM – 9:30 PM', None, 'Dough Magic'),
    (lambda n: 'GRAINS & CO' in n or 'GRAINS AND CO' in n, 'No', 'Daily 11:00 AM – 9:00 PM', None, 'Grains & Co.'),
    (lambda n: n in ('S-11', 'S11', 'S-11 FOOD HOUSE', 'S-11 EATING HOUSE', 'S-11 F&B PTE. LTD.'), 'No', 'Daily 6:00 AM – 11:00 PM', None, 'S-11'),
    (lambda n: 'FRAGRANCE' in n, 'No', 'Daily 10:00 AM – 9:30 PM', None, 'Fragrance'),
    (lambda n: 'YU PAN' in n, 'No', 'Daily 9:00 AM – 8:30 PM', None, 'Yu Pan'),
    (lambda n: '365 JUICES BAR' in n, 'No', 'Daily 9:00 AM – 9:00 PM', None, '365 Juices Bar'),
    (lambda n: 'WU FU' in n, 'No', 'Daily 10:00 AM – 9:30 PM', None, 'Wu Fu'),
    (lambda n: 'CHARCOAL ROASTED DELIGHT' in n, 'No', 'Daily 9:30 AM – 8:30 PM', None, 'Charcoal Roasted Delight'),
    (lambda n: 'BROADWAY FOOD CENTRE' in n, 'No', 'Daily 6:00 AM – 11:00 PM', None, 'Broadway Food Centre'),
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
    
    for rule_fn, target_halal, target_hrs, target_vegan, label in tier5_rules:
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
