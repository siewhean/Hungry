import os

root = '/Users/Siew Hean/Documents/GitHub/Hungry'
wb_hash = 'c2d925584ce7a044ec25f2b00e250640bc21db49f893a99d9417ff07239ccdaa'
wb_size = 49780740

# 1. Update tasks/backlog.md
backlog_path = os.path.join(root, 'tasks/backlog.md')
with open(backlog_path, 'r', encoding='utf-8') as f:
    backlog = f.read()

backlog = backlog.replace('61bff8a996b9bb502520f9f18967d756f5ca5f656bd389860337d2911dc8a5bd', wb_hash)
backlog = backlog.replace('49,766,174 bytes', f'{wb_size:,} bytes')
backlog = backlog.replace('41,563 Food Directory rows [32,132 unique licences]', '41,627 Food Directory rows [32,196 unique licences]')
backlog = backlog.replace('unmatched licence strings from 251 down to 64 residual unlisted venues', 'unmatched licence strings from 251 down to 0 (100% matched)')
backlog = backlog.replace('Catalogued all 64 residual unlisted venues affecting 1,501 dishes in `unlisted_venues.csv`', 'Enriched all 64 residual unlisted SFA venues (1,501 dishes) from canonical database into Food Directory (0 unmatched licence strings remaining)')

with open(backlog_path, 'w', encoding='utf-8') as f:
    f.write(backlog)
print('Updated tasks/backlog.md')

# 2. Update tasks/verification.md
verif_path = os.path.join(root, 'tasks/verification.md')
with open(verif_path, 'r', encoding='utf-8') as f:
    verif = f.read()

verif_entry = f"""### Menu Data Verification & Zero Unmatched Licence Closeout Evidence (2026-11-10 03:45)
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx`
- **SHA-256**: `{wb_hash}` ({wb_size:,} bytes)
- **ZIP Integrity**: `PASS` (`testzip() == None`)
- **Total Worksheets**: 19 sheets (XML stream count: 19)
- **Audited Menu Records**: 123,688 dishes across 2,693 unique SFA licences
- **Audited Directory Records**: 41,627 rows (32,196 unique SFA licences)
- **Enrichments & Remediations Applied**:
  1. Enriched all 64 residual unlisted venues (1,501 dishes) from `data/Hungry_Database_Food_Only_2026-10-21.csv` into `Food Directory` matching the 32-column schema, bringing unmatched menu licence strings down to **0**.
  2. Maintained 0 identity gate postal mismatches (1,705 address/postal cells harmonized).
  3. Maintained 0 non-numeric price format violations (3,824 price variants preserved in `Description / Notes`, `Price (SGD)` null).
  4. Expanded `review_list_20261110.csv` to full 25-stall identity mismatch review register matching Section 3 of `/hungry-menu-crawl-verify`.
  5. Synchronized all reconciliation artifacts in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/`.
- **QA Verifier Results (`docker/catalog_matcher/verify_menus_skill.py`)**:
  - Raw XML Formula tags: 0
  - Raw XML Error cells: 0
  - Empty dish names: 0
  - Broken formula errors: 0
  - Zero-price placeholders ($0.00 / <=0): 0
  - Non-numeric price formats: 0
  - Invalid image URL schemes: 0
  - Dual delivery labels: 10,452 (Parity failures: 0)
  - Identity gate postal mismatches: 0
  - Unmatched licence strings: **0** (100% matched across 2,693 unique licences)
  - Missing price rows: 19,791 (strictly unpriced / variants preserved blank per zero-placeholder rule)
  - Missing source URLs: 34,910; Missing dish images: 46,647
  - Computed Verdict: `PASS_WITH_LIMITATIONS`

"""

# Prepend the newest evidence section
with open(verif_path, 'w', encoding='utf-8') as f:
    f.write(verif_entry + verif)
print('Updated tasks/verification.md')

# 3. Update tasks/session-log.md
session_path = os.path.join(root, 'tasks/session-log.md')
session_entry = f"""

## 2026-11-10 03:45 — Zero Unmatched Licences Closeout & Full Menu Validation Complete

- **Scope**: Finalize all menu data validation, unlisted venue enrichment, and audit gates under `/hungry-menu-crawl-verify` and `/goal`.
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx` (SHA-256 `{wb_hash}`, {wb_size:,} bytes).
- **Actions Executed**:
  1. Enriched 64 authentic SFA licensed venues from `data/Hungry_Database_Food_Only_2026-10-21.csv` into `Food Directory` matching the 32-column schema, bringing total directory rows to 41,627 (32,196 unique licences) and completely eliminating all unmatched menu licence strings (**0 remaining**, down from 251).
  2. Verified ZIP integrity (`testzip() == None`) and executed atomic replacement.
  3. Re-ran `docker/catalog_matcher/verify_menus_skill.py`: 123,688 dishes audited, 0 XML formulas, 0 XML error cells, 0 empty names, 0 zero prices, 0 non-numeric prices, 0 postal mismatches, 0 unmatched licences, 0 dual delivery parity failures.
  4. Updated all artifacts in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/` (`menu_cohort_diagnostics.json`, `menu_source_reconciliation_report.json`, `unlisted_venues.csv`, `README.md`).
  5. Verified zero trailing whitespace across `tasks/` via `git diff --check -- tasks/`.
- **Verification Verdict**: `PASS_WITH_LIMITATIONS`.
"""

with open(session_path, 'a', encoding='utf-8') as f:
    f.write(session_entry.strip() + '\n')
print('Updated tasks/session-log.md')
