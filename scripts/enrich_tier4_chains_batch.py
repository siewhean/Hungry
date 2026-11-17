import csv
import re
import openpyxl

tier4_rules = [
    # Halal: Yes
    (lambda n: 'DABBA STREET' in n, 'Yes', 'Daily 10:30 AM – 9:30 PM', None, 'Dabba Street'),
    (lambda n: 'NIKU IKU' in n or 'NIKU-IKU' in n, 'Yes', 'Daily 11:00 AM – 10:00 PM', None, 'NiKU iKU'),
    (lambda n: 'KNS RESTAURANT' in n, 'Yes', '24 Hours Daily', None, 'KNS Restaurant'),

    # Halal: No
    (lambda n: 'TALAD THAI BANANA' in n, 'No', 'Daily 10:30 AM – 9:00 PM', 'Yes', 'Talad Thai Banana'),
    (lambda n: 'OTTIE PANCAKES' in n, 'No', 'Daily 8:00 AM – 8:00 PM', 'Yes', 'Ottie Pancakes'),
    (lambda n: 'BUTTER & CREAM' in n or 'BUTTER AND CREAM' in n, 'No', 'Daily 9:00 AM – 9:00 PM', None, 'Butter & Cream'),
    (lambda n: 'PONTIAN WANTON' in n, 'No', 'Daily 8:00 AM – 9:00 PM', None, 'Pontian Wanton Noodles'),
    (lambda n: 'HOCKHUA TONIC' in n or 'HOCK HUA TONIC' in n, 'No', 'Daily 10:00 AM – 9:30 PM', None, 'Hockhua Tonic'),
    (lambda n: 'KILLINEY' in n, 'No', 'Daily 7:30 AM – 8:00 PM', None, 'Killiney Kopitiam'),
    (lambda n: 'KING GROUPER' in n, 'No', 'Daily 10:00 AM – 9:00 PM', None, 'King Grouper Fish Soup'),
    (lambda n: 'BASIL KING' in n, 'No', 'Daily 10:30 AM – 9:00 PM', None, 'Basil King'),
    (lambda n: 'SUPER SUSHI' in n, 'No', 'Daily 11:00 AM – 9:30 PM', None, 'Super Sushi'),
    (lambda n: 'OLD TEA HUT' in n, 'No', 'Daily 7:30 AM – 8:00 PM', None, 'Old Tea Hut'),
    (lambda n: 'SF FRUITS' in n, 'No', 'Daily 9:30 AM – 9:30 PM', None, 'SF Fruits'),
    (lambda n: 'DJ BAKERY' in n, 'No', 'Daily 6:30 AM – 9:30 PM', None, 'DJ Bakery'),
    (lambda n: 'STEAK 99' in n, 'No', 'Daily 11:30 AM – 9:30 PM', None, 'Steak 99'),
    (lambda n: 'A HOT HIDEOUT' in n, 'No', 'Daily 11:00 AM – 9:30 PM', None, 'A Hot Hideout'),
    (lambda n: n in ('FOOD REPUBLIC', 'FOOD REPUBLIC PTE LTD'), 'No', 'Daily 10:00 AM – 10:00 PM', None, 'Food Republic'),
    (lambda n: n in ('KIMLY', 'KIMLY COFFEESHOP', 'KIMLY EATING HOUSE', 'KIMLY EATING HOUSE PTE LTD'), 'No', 'Daily 6:00 AM – 11:00 PM', None, 'Kimly'),
    (lambda n: n in ('KIM SAN LENG', 'KIM SAN LENG COFFEESHOP', 'KIM SAN LENG EATING HOUSE'), 'No', 'Daily 6:00 AM – 11:00 PM', None, 'Kim San Leng'),
    (lambda n: n in ('KOPITIAM', 'KOPITIAM CORNER') or n == 'KOPITIAM PTE LTD', 'No', 'Daily 7:00 AM – 10:00 PM', None, 'Kopitiam'),
    (lambda n: n in ('KOUFU', 'KOUFU PTE LTD'), 'No', 'Daily 7:00 AM – 10:00 PM', None, 'Koufu'),
    (lambda n: 'MAN XIANG TRADITIONAL' in n, 'No', 'Daily 9:00 AM – 8:00 PM', None, 'Man Xiang Traditional Roasted Delight'),
    (lambda n: 'YONG LI COFFEE' in n, 'No', 'Daily 6:30 AM – 10:00 PM', None, 'Yong Li Coffee Station'),
    (lambda n: 'FIVE TEN WESTERN' in n, 'No', 'Daily 11:30 AM – 9:30 PM', None, 'Five Ten Western Grill'),
    (lambda n: 'HE JIA MIXED VEG' in n, 'No', 'Daily 9:00 AM – 8:30 PM', None, 'He Jia Mixed Veg Rice'),
    (lambda n: 'JIA JIA VEGETARIAN' in n, 'No', 'Daily 7:00 AM – 8:00 PM', 'Yes', 'Jia Jia Vegetarian'),
    (lambda n: 'TONG LUCK' in n, 'No', 'Daily 8:30 AM – 8:30 PM', None, 'Tong Luck Economical Rice'),
    (lambda n: 'RED LANTERN SEAFOOD' in n, 'No', 'Daily 11:00 AM – 10:30 PM', None, 'Red Lantern Seafood'),
    (lambda n: 'XING LONG FISH SOUP' in n, 'No', 'Daily 9:00 AM – 8:30 PM', None, 'Xing Long Fish Soup'),
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
updated_vegan = 0

for r in rows:
    raw_name = r['F&B Name'].upper()
    clean_name = re.sub(r'\(.*?\)', '', raw_name).strip()
    reg_name = r['Registered Business Name'].upper()
    clean_reg = re.sub(r'\(.*?\)', '', reg_name).strip()
    hrs = r['Opening Hours / Closed Days'].strip()
    halal = r['Halal Certified'].strip()
    vegan = r['Vegan'].strip()
    
    # Don't overwrite confirmed Yes from previous audits (e.g. Bagus by Kopitiam)
    for rule_fn, target_halal, target_hrs, target_vegan, label in tier4_rules:
        if rule_fn(clean_name) or rule_fn(clean_reg):
            if halal == 'Yes' and target_halal == 'No':
                # Preserve existing verified Yes
                break
            if not hrs and target_hrs:
                r['Opening Hours / Closed Days'] = target_hrs
                updated_hours += 1
            if halal != target_halal:
                r['Halal Certified'] = target_halal
                updated_halal += 1
            if target_vegan and vegan != target_vegan:
                r['Vegan'] = target_vegan
                updated_vegan += 1
            break

print(f'Updated hours: {updated_hours}')
print(f'Updated Halal status: {updated_halal}')
print(f'Updated Vegan status: {updated_vegan}')

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
