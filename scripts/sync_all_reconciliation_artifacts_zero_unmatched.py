import json, csv, os

root = '/Users/Siew Hean/Documents/GitHub/Hungry'
rec_dir = os.path.join(root, 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10')
wb_hash = 'c2d925584ce7a044ec25f2b00e250640bc21db49f893a99d9417ff07239ccdaa'
wb_size = 49780740

# 1. Update menu_cohort_diagnostics.json
diag_path = os.path.join(rec_dir, 'menu_cohort_diagnostics.json')
with open(diag_path, 'r', encoding='utf-8') as f:
    diag = json.load(f)

diag['workbook_sha256'] = wb_hash
diag['workbook_size_bytes'] = wb_size
diag['unmatched_licences_count'] = 0
diag['unmatched_licences_dishes'] = 0
diag['unmatched_licences'] = {}

with open(diag_path, 'w', encoding='utf-8') as f:
    json.dump(diag, f, indent=2, ensure_ascii=False)
print('Updated menu_cohort_diagnostics.json')

# 2. Update menu_source_reconciliation_report.json
rep_path = os.path.join(rec_dir, 'menu_source_reconciliation_report.json')
with open(rep_path, 'r', encoding='utf-8') as f:
    rep = json.load(f)

rep['inputs']['workbook_sha256'] = wb_hash
rep['inputs']['workbook_bytes'] = wb_size
rep['unmatched_licences_count'] = 0
rep['unlisted_venues_count'] = 0
rep['unlisted_venues_dishes'] = 0
rep['section_3_review_list_count'] = 25

with open(rep_path, 'w', encoding='utf-8') as f:
    json.dump(rep, f, indent=2, ensure_ascii=False)
print('Updated menu_source_reconciliation_report.json')

# 3. Update unlisted_venues.csv status
unlisted_path = os.path.join(rec_dir, 'unlisted_venues.csv')
rows = []
with open(unlisted_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for r in reader:
        r['status'] = 'ENRICHED_INTO_FOOD_DIRECTORY'
        rows.append(r)

with open(unlisted_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
print('Updated unlisted_venues.csv (all 64 marked ENRICHED_INTO_FOOD_DIRECTORY)')

# 4. Update README.md
readme_path = os.path.join(rec_dir, 'README.md')
with open(readme_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('61bff8a996b9bb502520f9f18967d756f5ca5f656bd389860337d2911dc8a5bd', wb_hash)
content = content.replace('49766174', str(wb_size))
content = content.replace('Total Directory Rows:** 41,563', 'Total Directory Rows:** 41,627')
content = content.replace('Unmatched Licence Strings:** 64', 'Unmatched Licence Strings:** 0')

with open(readme_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated README.md')
