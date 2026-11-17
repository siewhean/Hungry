import openpyxl, csv, tempfile, os, zipfile, hashlib

root = '/Users/Siew Hean/Documents/GitHub/Hungry'
wb_path = os.path.join(root, 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx')
unlisted_path = os.path.join(root, 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/unlisted_venues.csv')
db_path = os.path.join(root, 'data/Hungry_Database_Food_Only_2026-10-21.csv')

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

print('Initial SHA-256:', sha256_file(wb_path))

with open(unlisted_path, encoding='utf-8') as f:
    unlisted_lics = {r['sfa_licence_no']: r for r in csv.DictReader(f)}

assert len(unlisted_lics) == 64

with open(db_path, encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    db_rows = {r[2].strip().upper(): r for r in reader if len(r) > 2 and r[2].strip().upper() in unlisted_lics}

print(f'Matched {len(db_rows)} authentic SFA venues from 2026-10-21 database')
assert len(db_rows) == 64

wb = openpyxl.load_workbook(wb_path)
ws_dir = wb['Food Directory']
wb_headers = [cell.value for cell in ws_dir[1]]
print(f'Food Directory current rows: {ws_dir.max_row}')

for lic, d in db_rows.items():
    row_vals = list(d[:23]) + [None] * (len(wb_headers) - 23)
    ws_dir.append(row_vals)

print(f'Food Directory new rows: {ws_dir.max_row}')

tmp_dir = os.path.dirname(wb_path)
tmp_fd, tmp_path = tempfile.mkstemp(suffix='.xlsx', dir=tmp_dir)
os.close(tmp_fd)

print('Saving updated workbook to temporary file...')
wb.save(tmp_path)
wb.close()

print('Verifying ZIP integrity of temporary workbook...')
with zipfile.ZipFile(tmp_path) as z:
    if z.testzip() is not None:
        os.remove(tmp_path)
        raise RuntimeError('Corrupted ZIP output in temporary file!')

os.replace(tmp_path, wb_path)
new_hash = sha256_file(wb_path)
new_size = os.path.getsize(wb_path)

print(f'Successfully enriched Food Directory with 64 authentic venues!')
print(f'New Master Workbook SHA-256: {new_hash}')
print(f'New Master Workbook Size: {new_size} bytes')
