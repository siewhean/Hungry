import csv
import re
import openpyxl

# Canonical chains map with exact verification
refined_chains_map = {
    # Halal: Yes (MUIS certified or Muslim-owned)
    r'\b(RITZ APPLE STRUDEL|RITZ APPLE STRUDEL & PASTRY)\b': ('Yes', 'Daily 10:00 AM – 9:30 PM', None),
    r'\b(OK CHICKEN RICE|HUMFULL PRAWN LAKSA)\b': ('Yes', 'Daily 10:00 AM – 9:00 PM', None),
    r'\b(CANADIAN 2 FOR 1 PIZZA|CANADIAN PIZZA)\b': ('Yes', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(TWYST)\b': ('Yes', 'Mon–Fri 10:30 AM – 8:30 PM; Sat–Sun 11:00 AM – 8:30 PM', None),
    r'\b(TANG TEA HOUSE)\b': ('Yes', 'Daily 11:00 AM – 2:00 AM', None),
    r'\b(TELUR THAI)\b': ('Yes', 'Daily 10:00 AM – 9:30 PM', None),
    r'\b(ABANG GEMUK)\b': ('Yes', 'Daily 11:00 AM – 9:00 PM', None),
    r'\b(MONSTER WESTERN)\b': ('Yes', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(SEABAY WOK DELIGHTS|SEABAY DELIGHT|WOK DELIGHT)\b': ('Yes', 'Daily 10:00 AM – 9:30 PM', None),
    r'\b(LLAOLIAO|LLAOLAO)\b': ('Yes', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(BERADIK)\b': ('Yes', 'Daily 10:00 AM – 9:30 PM', None),
    r'\b(YAKINIKU SHOKUDO)\b': ('Yes', 'Daily 11:30 AM – 10:00 PM', None),
    r'\b(BASKIN ROBBINS|BASKIN-ROBBINS)\b': ('Yes', 'Daily 10:00 AM – 10:00 PM', None),
    r'\b(UNCLE PENYET)\b': ('Yes', 'Daily 10:00 AM – 9:00 PM', None),
    r'\b(MR TEH TARIK EXPRESS|MR TEH TARIK)\b': ('Yes', 'Daily 7:00 AM – 11:00 PM', None),
    r'\b(CHICKY FUN)\b': ('Yes', 'Daily 10:00 AM – 9:00 PM', None),
    r'\b(CIK LIM YONG TAU FOO)\b': ('Yes', 'Daily 9:00 AM – 9:00 PM', None),
    r'\b(GELARE|GELARÉ)\b': ('Yes', 'Daily 11:30 AM – 10:00 PM', None),
    r'\b(BATTERCATCH)\b': ('Yes', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(BREAD JUNCTION)\b': ('Yes', 'Daily 6:30 AM – 9:30 PM', None),
    r'\b(MAKAN MELAKA)\b': ('Yes', 'Daily 8:00 AM – 8:00 PM', None),
    r'\b(POKE THEORY)\b': ('Yes', 'Daily 11:00 AM – 8:30 PM', None),
    r'\b(NENE CHICKEN)\b': ('Yes', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(THEJELLYHEARTS)\b': ('Yes', 'Daily 10:30 AM – 9:30 PM', None),
    r'\b(ASHES BURNNIT)\b': ('Yes', 'Daily 11:30 AM – 8:30 PM', None),
    r'\b(THE HOUSE OF LEMANG)\b': ('Yes', 'Daily 8:00 AM – 6:00 PM', None),

    # Halal: No (Non-halal or commercial uncertified)
    r'\b(GREENDOT)\b': ('No', 'Daily 11:00 AM – 9:00 PM', 'Yes'),  # Vegan: Yes
    r'\b(TAI WAH PORK NOODLE)\b': ('No', 'Daily 7:30 AM – 8:30 PM', None),
    r'\b(HUGGS COFFEE|HUGGS)\b': ('No', 'Mon–Fri 8:00 AM – 5:30 PM; Sat 8:00 AM – 3:00 PM; Sun Closed', None),
    r'\b(WESTERN BOY)\b': ('No', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(GAGA ROASTED DELIGHTS|GAGA ROASTED DELIGHT|SENG HENG ATAS ROASTED DELIGHT)\b': ('No', 'Daily 9:00 AM – 8:00 PM', None),
    r'\b(GOKOKU JAPANESE BAKERY|GOKOKU BAKERY)\b': ('No', 'Daily 10:00 AM – 10:00 PM', None),
    r'\b(SALADSTOP|SALADSTOP!)\b': ('No', 'Daily 11:00 AM – 9:00 PM', None),
    r'\b(XIANG CHI MIAN)\b': ('No', 'Daily 8:00 AM – 9:00 PM', None),
    r'\b(XIANG XIANG HUNAN CUISINE)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(KOPIFELLAS)\b': ('No', 'Daily 8:00 AM – 8:00 PM', None),
    r'\b(YAKINIKU LIKE)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(TAKAGI RAMEN)\b': ('No', '24 Hours Daily', None),
    r'\b(ZHANG LIANG MALA TANG|ZHANG LIANG MALATANG)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(JI DE CHI DESSERT|JI DE CHI)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(THE SUMMER ACAI)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(SIAM SQUARE MOOKATA)\b': ('No', 'Daily 4:00 PM – 3:00 AM', None),
    r'\b(FRAGRANCE FOODSTUFF|FRAGRANCE BAK KWA)\b': ('No', 'Daily 10:00 AM – 9:30 PM', None),
    r'\b(THE WHALE TEA)\b': ('No', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(SUSHI GOGO)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(YEW KEE SPECIALITIES|YEW KEE DUCK RICE|YU KEE HOUSE OF BRAISED DUCK|YU KEE DUCK RICE)\b': ('No', 'Daily 9:00 AM – 8:30 PM', None),
    r'\b(R&B TEA)\b': ('No', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(BAKER TALENT)\b': ('No', 'Daily 7:00 AM – 9:30 PM', None),
    r'\b(JACK\'S PLACE)\b': ('No', 'Daily 11:30 AM – 10:00 PM', None),
    r'\b(JUZ BREAD)\b': ('No', 'Daily 6:30 AM – 9:30 PM', None),
    r'\b(CHANG CHENG MEE WAH)\b': ('No', 'Daily 6:00 AM – 10:00 PM', None),
    r'\b(QIU LIAN BAN MIAN)\b': ('No', 'Daily 10:00 AM – 9:00 PM', None),
    r'\b(TANJONG RHU WANTON NOODLE)\b': ('No', 'Daily 7:30 AM – 2:30 PM', None),
    r'\b(TEOCHEW LAO)\b': ('No', 'Daily 8:00 AM – 8:00 PM', None),
    r'\b(HONG KONG STREET OLD CHUN KEE)\b': ('No', 'Daily 11:00 AM – 2:30 PM, 5:00 PM – 10:30 PM', None),
    r'\b(DOU YONG TAU FOO)\b': ('No', 'Daily 7:00 AM – 7:00 PM', None),
    r'\b(TAI SENG FISH SOUP)\b': ('No', 'Mon–Sat 9:30 AM – 8:00 PM; Sun Closed', None),
    r'\b(CLAYPOT KING)\b': ('No', 'Daily 11:00 AM – 9:00 PM', None),
    r'\b(BINGXUE TEA & ICE CREAM|BINGXUE)\b': ('No', 'Daily 10:00 AM – 10:00 PM', None),
    r'\b(CU LIANG YU FEN)\b': ('No', 'Daily 10:00 AM – 9:30 PM', None),
    r'\b(SHAN DONG DONG JI LA MIAN XIAO LONG BAO)\b': ('No', 'Daily 9:30 AM – 9:00 PM', None),
    r'\b(GOLDEN VILLAGE)\b': ('No', 'Daily 11:00 AM – 11:00 PM', None),
    r'\b(COFFEE HIVE)\b': ('No', 'Daily 8:00 AM – 9:00 PM', None),
    r'\b(KEI KAISENDON)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(WINE CONNECTION)\b': ('No', 'Daily 11:30 AM – 11:00 PM', None),
    r'\b(BACHA COFFEE)\b': ('No', 'Daily 9:30 AM – 10:00 PM', None),
    r'\b(NONG GENG JI)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
    r'\b(SWEET TALK)\b': ('No', 'Daily 10:30 AM – 9:30 PM', None),
    r'\b(PARKSON BAK KUT TEH)\b': ('No', 'Daily 9:00 AM – 9:00 PM', None),
    r'\b(XI DE LI)\b': ('No', 'Daily 6:30 AM – 6:00 PM', None),
    r'\b(CHONG PANG HUAT BBQ CHICKEN WING|CHONG PANG HUAT)\b': ('No', 'Daily 4:00 PM – 11:00 PM', None),
    r'\b(ENG KEE CHICKEN WINGS)\b': ('No', 'Daily 10:00 AM – 8:30 PM', None),
    r'\b(KENG ENG KEE SEAFOOD)\b': ('No', 'Daily 11:00 AM – 2:00 PM, 5:00 PM – 10:00 PM', None),
    r'\b(CHEF WEI HK CHEONG FUN)\b': ('No', 'Daily 7:00 AM – 8:30 PM', None),
    r'\b(PEACH GARDEN)\b': ('No', 'Daily 11:00 AM – 3:00 PM, 6:00 PM – 10:00 PM', None),
    r'\b(SHABU SAI)\b': ('No', 'Daily 11:30 AM – 10:00 PM', None),
    r'\b(THE ALLEY)\b': ('No', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(LAU WANG CLAYPOT DELIGHTS|LAU WANG CLAYPOT)\b': ('No', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(BLANCO COURT BEEF NOODLES)\b': ('No', 'Daily 10:00 AM – 9:00 PM', None),
    r'\b(BLANCO COURT FRESH FISH SOUP)\b': ('No', 'Daily 10:00 AM – 8:30 PM', None),
    r'\b(CHEF WANG FRIED RICE)\b': ('No', 'Daily 10:30 AM – 9:00 PM', None),
    r'\b(BURNT CONES)\b': ('No', 'Daily 11:00 AM – 12:00 AM', None),
    r'\b(LICKERS)\b': ('No', 'Tue–Thu 1:00 PM – 2:00 AM; Fri–Sun 12:00 PM – 2:00 AM; Mon Closed', None),
    r'\b(PLAIN VANILLA)\b': ('No', 'Daily 8:00 AM – 7:00 PM', None),
    r'\b(QIN JI ROUGAMO)\b': ('No', 'Daily 11:00 AM – 9:00 PM', None),
    r'\b(RAMEN KING)\b': ('No', 'Daily 11:00 AM – 9:00 PM', None),
    r'\b(RIVE GAUCHE PATISSERIE)\b': ('No', 'Daily 10:30 AM – 9:30 PM', None),
    r'\b(TONG FONG FATT HAINANESE BONELESS CHICKEN RICE|TONG FONG FATT)\b': ('No', 'Daily 9:30 AM – 8:30 PM', None),
    r'\b(HARRY\'S)\b': ('No', 'Daily 11:30 AM – 11:00 PM', None),
    r'\b(HUNDRED GRAINS)\b': ('No', 'Daily 11:00 AM – 9:30 PM', None),
    r'\b(SEREMBAN KEE MEI SIEW POW)\b': ('No', 'Daily 8:30 AM – 8:30 PM', None),
    r'\b(MING FA FISHBALL|MING FA)\b': ('No', 'Daily 7:30 AM – 9:00 PM', None),
    r'\b(BEREMPAH BROS)\b': ('No', 'Daily 10:30 AM – 8:30 PM', None),
    r'\b(KOONG WOH TONG)\b': ('No', 'Daily 11:00 AM – 10:00 PM', None),
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
updated_vegan = 0

for r in rows:
    name = r['F&B Name'].upper()
    reg = r['Registered Business Name'].upper()
    hrs = r['Opening Hours / Closed Days'].strip()
    halal = r['Halal Certified'].strip()
    vegan = r['Vegan'].strip()
    
    for pat, (target_halal, target_hrs, target_vegan) in refined_chains_map.items():
        if re.search(pat, name) or re.search(pat, reg):
            # Update opening hours if currently missing
            if not hrs and target_hrs:
                r['Opening Hours / Closed Days'] = target_hrs
                updated_hours += 1
            # Update Halal if needed
            if halal != target_halal:
                r['Halal Certified'] = target_halal
                updated_halal += 1
            # Update Vegan if specified
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
