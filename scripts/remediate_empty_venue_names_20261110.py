import openpyxl, tempfile, os, zipfile, hashlib

root = '/Users/Siew Hean/Documents/GitHub/Hungry'
wb_path = os.path.join(root, 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx')

venue_name_map = {
    'CE18X38E000': 'Saizeriya',
    'BHC02K33001': 'HK Wanton Noodle & Roasted Delights',
    'S84153P009': 'Steven Fried Rice',
    'S97091V011': 'Chicky Fun Chicken Rice',
    'E77107N000': 'Manna Fish 每味鱼',
    'W95323B000': 'Club Choice',
    'CE07V76B000': 'Six Six Hotpot',
    'S96068C003': 'Feng Feng Hainanese Boneless Chicken Rice',
    'B80122K000': 'Teochew Fish Soup (332 Ang Mo Kio)',
    'NE07513V009': 'Happy Thai Vegan',
    'SE13S10A011': 'Zhen Shi Claypot'
}

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

print('Initial SHA-256:', sha256_file(wb_path))

wb = openpyxl.load_workbook(wb_path)

# 1. Update Food Directory
ws_dir = wb['Food Directory']
dir_updated = 0
for row in ws_dir.iter_rows(min_row=2):
    lic = str(row[2].value or '').strip().upper()
    if lic in venue_name_map:
        if not row[0].value:
            row[0].value = venue_name_map[lic]
            dir_updated += 1

print(f'Updated {dir_updated} rows in Food Directory')

# 2. Update Menu & Price
ws_menu = wb['Menu & Price']
menu_updated = 0
for row in ws_menu.iter_rows(min_row=2):
    lic = str(row[1].value or '').strip().upper()
    if lic in venue_name_map:
        if not row[0].value:
            row[0].value = venue_name_map[lic]
            menu_updated += 1

print(f'Updated {menu_updated} rows in Menu & Price (expected 274)')
assert menu_updated == 274

tmp_dir = os.path.dirname(wb_path)
tmp_fd, tmp_path = tempfile.mkstemp(suffix='.xlsx', dir=tmp_dir)
os.close(tmp_fd)

print('Saving updated workbook to temporary file...')
wb.save(tmp_path)
wb.close()

print('Verifying ZIP integrity...')
with zipfile.ZipFile(tmp_path) as z:
    if z.testzip() is not None:
        os.remove(tmp_path)
        raise RuntimeError('Corrupted ZIP output in temporary file!')

os.replace(tmp_path, wb_path)
new_hash = sha256_file(wb_path)
new_size = os.path.getsize(wb_path)

print(f'Successfully eliminated all 274 empty venue names!')
print(f'New Master Workbook SHA-256: {new_hash}')
print(f'New Master Workbook Size: {new_size} bytes')
