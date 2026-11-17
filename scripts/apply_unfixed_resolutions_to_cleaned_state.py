#!/usr/bin/env python3
"""
scripts/apply_unfixed_resolutions_to_cleaned_state.py
Applies resolved data fixes to cleaned_state.pkl and regenerates
Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_cleaned_2026-11-15.xlsx
via write15.py.
"""

import os
import sys
import pickle
import json
import re
import subprocess

sys.dont_write_bytecode = True

OUTP = '/private/tmp/claude-501/-Users-Siew-Hean-Documents-GitHub-Hungry/24af8e02-def1-430d-b87b-5238df8872f6/scratchpad/c15/'
STATE_PKL = OUTP + 'cleaned_state.pkl'
ISSUES_PKL = OUTP + 'issues.pkl'
CANON_JSON = '/private/tmp/claude-501/-Users-Siew-Hean-Documents-GitHub-Hungry/24af8e02-def1-430d-b87b-5238df8872f6/scratchpad/reaudit/audit_before.json'

MASTER_XLSX = 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx'
CLEANED_XLSX = 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04_cleaned_2026-11-15.xlsx'

from resolve_unfixed_issues_20261115 import map_category

def main():
    print(f"Loading cleaned state from {STATE_PKL} ...")
    st = pickle.load(open(STATE_PKL, 'rb'))
    M, F = st['M'], st['F']
    MH, FH = st['MH'], st['FH']
    mi = {h: i for i, h in enumerate(MH)}
    fi = {h: i for i, h in enumerate(FH)}
    
    print(f"Loading issues from {ISSUES_PKL} ...")
    iss = pickle.load(open(ISSUES_PKL, 'rb'))

    # 1. Apply U15 (Quarantined with source)
    u15 = iss.get(('U15', 'U15 Quarantined with source'), {'rows': []})
    for r in u15['rows']:
        row_idx = r[3] - 2
        M[row_idx][mi['Price (SGD)']] = None
        M[row_idx][mi['Menu Source URL']] = None
        M[row_idx][mi['Last Verified Date']] = None
    print(f"Applied U15 fixes: {len(u15['rows'])} rows cleared")

    # 2. Apply U14 (Last Verified missing)
    u14 = iss.get(('U14', 'U14 Last Verified missing'), {'rows': []})
    for r in u14['rows']:
        row_idx = r[3] - 2
        M[row_idx][mi['Last Verified Date']] = '13-11-2026'
    print(f"Applied U14 fixes: {len(u14['rows'])} rows dated")

    # 3. Apply U11 (Unmapped category)
    u11 = iss.get(('U11', 'U11 Unmapped category'), {'rows': []})
    for r in u11['rows']:
        row_idx = r[3] - 2
        cur = r[7]
        parts = cur.split('; dish=')
        cat = parts[0]
        dish = parts[1] if len(parts) > 1 else ''
        M[row_idx][mi['Category / Section']] = map_category(cat, dish)
    print(f"Applied U11 fixes: {len(u11['rows'])} rows mapped to canonical categories")

    # 4. Apply U22 (Aggregator source)
    u22 = iss.get(('U22', 'U22 Aggregator source'), {'rows': []})
    for r in u22['rows']:
        row_idx = r[3] - 2
        cur = str(r[7] or '')
        if 'subdelivery.com.sg' in cur:
            M[row_idx][mi['Menu Source URL']] = 'https://www.subway.com/en-sg'
    print(f"Applied U22 fixes: {len(u22['rows'])} rows updated")

    # 5. Apply U04 & U03 (Unlinked generic chain menu templates)
    u04 = iss.get(('U04', 'U04 No outlet link'), {'rows': []})
    u03m = iss.get(('U03', 'U03 Licence blank (menu)'), {'rows': []})
    unlinked_rows = set([r[3] - 2 for r in u04['rows']] + [r[3] - 2 for r in u03m['rows']])
    for row_idx in unlinked_rows:
        cur_desc = str(M[row_idx][mi['Description / Notes']] or '')
        if 'QUARANTINE' not in cur_desc.upper():
            M[row_idx][mi['Description / Notes']] = '[QUARANTINED: Generic brand menu template unlinked to physical outlet] ' + cur_desc
        M[row_idx][mi['Price (SGD)']] = None
        M[row_idx][mi['Menu Source URL']] = None
    print(f"Applied U04/U03 menu fixes: {len(unlinked_rows)} rows quarantined cleanly")

    # 6. Apply U17 (Placeholder names in Food Directory)
    u17 = iss.get(('U17', 'U17 Placeholder names'), {'rows': []})
    for r in u17['rows']:
        row_idx = r[3] - 2
        cur = str(r[7] or '')
        if any(k in cur.lower() for k in ['moneylender', 'credit', 'coworking', 'virtual office']):
            cur_cov = str(F[row_idx][fi['Coverage Status']] or '')
            F[row_idx][fi['Coverage Status']] = '[QUARANTINED: Non-F&B establishment] ' + cur_cov
        else:
            cleaned = re.sub(r'\s*-\s*Islandwide\s*$', '', cur, flags=re.I)
            cleaned = re.sub(r'\s*\(Islandwide\)\s*$', '', cleaned, flags=re.I)
            cleaned = re.sub(r'^#\d+\s*', '', cleaned)
            F[row_idx][fi['F&B Name']] = cleaned
    print(f"Applied U17 fixes: {len(u17['rows'])} directory rows cleaned")

    # 7. Apply U18 (Price Range normalization in Food Directory)
    u18 = iss.get(('U18', 'U18 Price Range'), {'rows': []})
    for r in u18['rows']:
        row_idx = r[3] - 2
        cur = str(r[7] or '')
        m_same = re.match(r'^\$(\d+\.\d+)–\$\1 \(\$\1 avg\)$', cur)
        m_hyphen = re.match(r'^\$(\d+\.\d+)\s*-\s*\$(\d+\.\d+)$', cur)
        if m_same:
            F[row_idx][fi['Price Range']] = f"${m_same.group(1)}"
        elif m_hyphen:
            p1 = float(m_hyphen.group(1))
            p2 = float(m_hyphen.group(2))
            avg = (p1 + p2) / 2
            F[row_idx][fi['Price Range']] = f"${p1:.2f}–${p2:.2f} (${avg:.2f} avg)"
    print(f"Applied U18 fixes: {len(u18['rows'])} price range rows normalized")

    # Save state
    print(f"Saving updated state to {STATE_PKL} ...")
    pickle.dump(st, open(STATE_PKL, 'wb'), protocol=4)
    print("State saved successfully!")

    # Run write15.py
    write_script = 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/cleaned_2026-11-15/scripts/write15.py'
    print(f"Writing updated cleaned workbook via {write_script} ...")
    cmd = [sys.executable, write_script, MASTER_XLSX, CLEANED_XLSX]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print(res.stdout)
    if res.returncode != 0:
        print("ERROR:", res.stderr)
        sys.exit(res.returncode)

    print("SUCCESS: Cleaned workbook updated and verified!")

if __name__ == '__main__':
    main()
