import csv
import re
import openpyxl

tier3_chains_map = {
    # Halal: Yes (MUIS certified)
    r'\b(ARNOLD\'S FRIED CHICKEN|ARNOLDS FRIED CHICKEN)\b': ('Yes', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(BEBEK GORENG PAK NDUT)\b': ('Yes', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(EL CARBON|EL CARBÓN)\b': ('Yes', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(GO-ANG PRATUNAM CHICKEN RICE|GO-ANG)\b': ('Yes', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(EPIKEBABS)\b': ('Yes', 'Daily 11:00 AM – 9:00 PM', None),
    r'\b(BAGUS KITCHEN)\b': ('Yes', 'Daily 7:30 AM – 9:30 PM', None),

    # Halal: No (Non-halal or commercial uncertified)
    r'\b(TWO MEN BAGEL HOUSE)\b': ('No', 'Daily 8:00 AM – 3:30 PM', None),
    r'\b(HARRIANNS NONYA TABLE|HARRIANNS)\b': ('No', 'Daily 7:30 AM – 8:00 PM', None),
    r'\b(JOE & DOUGH|JOE AND DOUGH)\b': ('No', 'Daily 8:00 AM – 8:00 PM', None),
    r'\b(HELLO ARIGATO)\b': ('No', 'Tue–Sun 10:00 AM – 9:00 PM; Mon Closed', None),
    r'\b(MARUHACHI DONBURI & CURRY|MARUHACHI)\b': ('No', 'Daily 11:00 AM – 9:00 PM', None),
    r'\b(MEI HEONG YUEN DESSERT|MEI HEONG YUEN)\b': ('No', 'Tue–Sun 12:00 PM – 9:30 PM; Mon Closed', None),
    r'\b(MERCI MARCEL)\b': ('No', 'Daily 8:00 AM – 11:00 PM', None),
    r'\b(NA NA HOMEMADE CURRY)\b': ('No', 'Daily 11:00 AM – 8:00 PM', None),
    r'\b(NO SIGNBOARD SEAFOOD|NO SIGNBOARD)\b': ('No', 'Daily 11:00 AM – 10:30 PM', None),
    r'\b(LIXIN TEOCHEW FISHBALL NOODLES|LIXIN FISHBALL)\b': ('No', 'Daily 8:00 AM – 9:00 PM', None),
    r'\b(JIAK SONG MEE HOON KWAY|JIAK SONG)\b': ('No', 'Daily 7:30 AM – 2:30 PM', None),
    r'\b(DAN LAO)\b': ('No', 'Daily 11:00 AM – 8:00 PM', None),
    r'\b(FAMOUS EUNOS BAK CHOR MEE)\b': ('No', 'Daily 6:00 AM – 2:00 PM', None),
    r'\b(HUNDRED ACRE CREAMERY)\b': ('No', 'Daily 12:00 PM – 11:00 PM', None),
    r'\b(BANGKOK STREET MOOKATA)\b': ('No', 'Daily 5:00 PM – 2:00 AM', None),
    r'\b(BAN HENG RESTAURANT|BAN HENG)\b': ('No', 'Daily 11:30 AM – 3:00 PM, 6:00 PM – 10:00 PM', None),
    r'\b(BKK BISTRO & BAR|BKK BISTRO)\b': ('No', 'Daily 5:00 PM – 2:00 AM', None),
    r'\b(CHAR GRILL BAR)\b': ('No', 'Daily 11:30 AM – 10:30 PM', None),
    r'\b(CHIN SIN HUAN)\b': ('No', 'Mon–Fri 8:00 AM – 6:00 PM; Sat 8:00 AM – 5:00 PM; Sun Closed', None),
    r'\b(CHIRASHIZUSHI SHOU)\b': ('No', 'Daily 11:30 AM – 9:30 PM', None),
    r'\b(COCO ICHIBANYA)\b': ('No', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(COMMON MAN COFFEE ROASTERS)\b': ('No', 'Daily 7:30 AM – 5:00 PM', None),
    r'\b(COTTI COFFEE)\b': ('No', 'Daily 7:00 AM – 9:00 PM', None),
    r'\b(CANOPY)\b': ('No', 'Daily 9:00 AM – 10:30 PM', None),
    r'\b(EDITH PATISSERIE)\b': ('No', 'Tue–Sun 10:00 AM – 7:00 PM; Mon Closed', None),
    r'\b(FONG SHENG HAO)\b': ('No', 'Daily 7:30 AM – 9:00 PM', None),
    r'\b(FOREWORD COFFEE)\b': ('No', 'Mon–Fri 8:00 AM – 5:00 PM; Sat–Sun 9:00 AM – 4:00 PM', None),
    r'\b(CARL\'S JR|CARLS JR)\b': ('No', 'Daily 10:00 AM – 10:00 PM', None),
    r'\b(BROTZEIT)\b': ('No', 'Daily 11:30 AM – 11:00 PM', None),
    r'\b(BLU KOUZINA)\b': ('No', 'Daily 11:30 AM – 3:30 PM, 5:30 PM – 10:30 PM', None),
    r'\b(BUDDY HOAGIES CAFE & GRILL|BUDDY HOAGIES)\b': ('No', 'Daily 11:30 AM – 10:00 PM', None),
    r'\b(BANTIANYAO GRILLED FISH)\b': ('No', 'Daily 11:30 AM – 9:30 PM', None),
    r'\b(BAI NIAN NIANG DOU FU|BAI NIAN)\b': ('No', 'Daily 7:30 AM – 9:00 PM', None),
    r'\b(75 AH BALLING PEANUT SOUP|75 AH BALLING)\b': ('No', 'Daily 8:00 AM – 8:30 PM', None),
    r'\b(888 MOOKATA)\b': ('No', 'Daily 5:00 PM – 12:00 AM', None),
    r'\b(AH CHIANG PORRIDGE)\b': ('No', 'Daily 7:00 AM – 11:00 PM', None),
    r'\b(AH ER SOUP|AHER SOUP)\b': ('No', 'Mon–Fri 11:00 AM – 2:00 PM, 5:00 PM – 8:00 PM; Sun 5:00 PM – 8:00 PM; Sat Closed', None),
    r'\b(AH HENG CURRY CHICKEN BEE HOON MEE)\b': ('No', 'Daily 9:30 AM – 9:00 PM', None),
}

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
    name = r['F&B Name'].upper()
    reg = r['Registered Business Name'].upper()
    hrs = r['Opening Hours / Closed Days'].strip()
    halal = r['Halal Certified'].strip()
    
    for pat, (target_halal, target_hrs, target_vegan) in tier3_chains_map.items():
        if re.search(pat, name) or re.search(pat, reg):
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
