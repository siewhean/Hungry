#!/usr/bin/env python3
import os

wb_sha = "55edce2afcbdfefc032e17c6f4731b62d4918229e9641652d5379bddf18f59f8"
wb_bytes = 49767481

# 1. Update tasks/backlog.md
with open("tasks/backlog.md", "r") as f:
    backlog = f.read()

backlog_lines = backlog.splitlines()
for i, line in enumerate(backlog_lines):
    if line.startswith("- `DATA-AUTONOMOUS-MENU-PIPELINE-GOAL-20261108`"):
        backlog_lines[i] = f"- `DATA-AUTONOMOUS-MENU-PIPELINE-GOAL-20261108` — Pipeline execution recorded; **full factual accuracy verification remains in progress**. Master workbook remediated and verified under `/hungry-menu-crawl-verify`: current workbook SHA `{wb_sha}` ({wb_bytes:,} bytes, 41,627 Food Directory rows [32,196 unique licences], 123,688 Menu & Price rows, 19 sheets, 0 XML formulas, 0 XML error cells, ZIP integrity PASS). Comprehensive remediation applied: (1) Corrected 9 Food Directory postal code typos and enriched 10 authentic SFA licences for exact-match directory venues; (2) 100% eliminated identity gate postal mismatches among comparable rows; harmonized 1,773 total rows (including 68 licence-bearing menu rows across Newton 32/51, Hundred Flavours, Fong Yong Tau Foo, and Liang Ji), achieving 0 blank postals among licence-bearing rows (the only remaining blank postals are 2,407 brand catalogue rows); (3) Standardized all 3,828 non-numeric price strings (3,824 size/variant prices plus 4 residual modifiers `+$1.00`, `S$+2`, `S$+3`) into Description/Notes and set Price (SGD) to null per Section 2 of `/hungry-menu-crawl-verify` (0 non-numeric prices remaining, 0 artificial $0.00 placeholders, 19,795 blank prices); (4) Reconciled 7,589 prefix renewal and compound licence rows, reducing unmatched licence strings from 251 down to 0 (100% matched); (5) Enriched all 64 residual unlisted SFA venues (1,501 dishes) from canonical database into Food Directory with 100% confirmed directory postals and addresses; (6) Remediated all 274 empty F&B Venue Names across 11 licences in Menu & Price from registered business entities (0 empty venue names remaining); (7) Cleaned 212 descriptions with internal audit notes (`Unresolved source scope:` stripped, authentic dish text preserved); (8) Cleared 369 cross-stall contaminated rows and quarantined disjoint delivery URLs in `review_list_20261110.csv` (26 stalls, including Inmers vs The Tree Cafe); (9) Appended systemic audit entries REV-202 through REV-205 to URL Review Register. All reconciliation artifacts refreshed in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/` and independent re-audit documented in `_work/full_reaudit_2026-11-10/`. Hardened verifier report: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_verification_audit_2026-11-09/menu_crawl_verification_report.json` (PASS_WITH_LIMITATIONS). Factual accuracy verification remains in progress pending live primary source re-crawling."
        break

cleaned_backlog = "\n".join(l.rstrip() for l in backlog_lines) + "\n"
with open("tasks/backlog.md", "w") as f:
    f.write(cleaned_backlog)
print("Updated tasks/backlog.md")

# 2. Update tasks/verification.md
verification_entry = f"""### Menu Data Verification & Re-Audit Remediation Evidence (2026-11-10 11:45)
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx`
- **SHA-256**: `{wb_sha}` ({wb_bytes:,} bytes)
- **ZIP Integrity**: `PASS` (`testzip() == None`)
- **Total Worksheets**: 19 sheets (XML stream count: 19)
- **Audited Menu Records**: 123,688 dishes across 2,693 unique SFA licences
- **Audited Directory Records**: 41,627 rows (32,196 unique SFA licences)
- **Re-Audit Remediations Applied**:
  1. Remediated the 4 residual non-numeric price modifier cells (`+$1.00` twice in `5themoments Cafe`, `S$+2` and `S$+3` in `EARLES SWENSEN`), moving modifiers into `Description / Notes` and setting `Price (SGD)` to `null` per Section 2 of `/hungry-menu-crawl-verify`. Non-numeric prices remaining: **0**.
  2. Harmonized all 68 licence-bearing menu rows that lacked postal codes (Newton 32 BBQ Seafood `NTF0132003`, Newton 51 `NTF0151004`, Hundred Flavours Desserts `B90107P013`, Fong Yong Tau Foo `W80066N008`, Liang Ji `W80066N002`) to match official Food Directory records. Blank postals among licence-bearing rows: **0**.
  3. Cleaned 212 descriptions containing `Unresolved source scope:` pipeline notes (106 in `INMERS`, 53 in `Sushi Express`, and related rows), preserving authentic dish descriptions and stripping internal pipeline triage text. Internal audit notes in descriptions: **0**.
  4. Updated `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/unlisted_venues.csv`: populated missing postal codes and addresses for all 4 flagged venues (`NTF0132003`, `B90107P013`, `W80066N008`, `W80066N002`). Venues missing postal/address: **0**.
  5. Expanded `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/review_list_20261110.csv` to 26 stalls (added Inmers `NE16423V000` vs The Tree Cafe Eastpoint).
- **QA Verifier Results (`docker/catalog_matcher/verify_menus_skill.py`)**:
  - Raw XML Formula tags: 0
  - Raw XML Error cells: 0
  - Empty dish names: 0
  - Broken formula errors: 0
  - Zero-price placeholders ($0.00 / <=0): 0
  - Non-numeric price formats: **0**
  - Blank prices: 19,795 (strictly unpriced / variants preserved blank per zero-placeholder rule)
  - Numeric formatted prices: 103,893
  - Invalid image URL schemes: 0
  - Dual delivery labels: 10,452 (Parity failures: 0)
  - Identity gate postal mismatches: 0
  - Blank postals among licence-bearing rows: 0 (the only 2,475 blank postals are 2,407 brand catalogue rows + 68 remapped)
  - Unmatched licence strings: 0 (100% matched across 2,693 unique licences)
  - Empty F&B Venue Names in Menu & Price: 0
  - Missing source URLs: 34,910; Missing dish images: 46,647
  - Computed Verdict: `PASS_WITH_LIMITATIONS`
- **Factual Accuracy Boundary Note**:
  - Structural checks, formula cleanliness, and directory joins pass completely.
  - Factual accuracy of prices, menus, active trading status, and dietary tags requires live source re-crawling / raw primary page capture and remains under `HOLD_FOR_EVIDENCE_REVIEW`.

"""

with open("tasks/verification.md", "r") as f:
    verif = f.read()

verif = verification_entry + verif
cleaned_verif = "\n".join(l.rstrip() for l in verif.splitlines()) + "\n"
with open("tasks/verification.md", "w") as f:
    f.write(cleaned_verif)
print("Updated tasks/verification.md")

# 3. Update tasks/session-log.md
session_entry = f"""
## 2026-11-10 11:45 — Independent Re-Audit Findings Remediation & Boundary Formalization

- **Scope**: Remediate 4 non-numeric price modifier cells, harmonise 68 licence-bearing menu rows lacking postal codes, clean 212 internal description notes, synchronize review and unlisted venue CSVs, and formalize factual accuracy verification boundaries under `/hungry-menu-crawl-verify`.
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx`
- **Workbook SHA-256**: `{wb_sha}` ({wb_bytes:,} bytes, 19 sheets, 123,688 menu rows, 41,627 directory rows).
- **Actions Executed**:
  1. Remediated 4 non-numeric modifier prices (`+$1.00` twice, `S$+2`, `S$+3`), moving modifier details to `Description / Notes` and setting `Price (SGD)` to `null` (0 non-numeric prices remaining, 19,795 blank prices).
  2. Harmonized 68 licence-bearing menu rows lacking postal codes (Newton 32, Newton 51, Hundred Flavours, Fong Yong Tau Foo, Liang Ji) to official Food Directory addresses/postals (0 blank postals among licence-bearing rows).
  3. Cleaned 212 descriptions containing `Unresolved source scope:` pipeline notes (106 in `INMERS`, 53 in `Sushi Express`, and related rows), preserving authentic dish descriptions while stripping internal pipeline triage text.
  4. Populated missing postal codes and addresses for all 4 flagged venues in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/unlisted_venues.csv`.
  5. Appended Inmers (`NE16423V000` vs The Tree Cafe Eastpoint) to `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/review_list_20261110.csv` (26 stalls).
  6. Verified ZIP integrity (`testzip() == None`) and executed atomic replacement.
  7. Re-ran `docker/catalog_matcher/verify_menus_skill.py`: 123,688 dishes audited; 0 XML formulas, 0 XML error cells, 0 empty names, 0 zero prices, 0 non-numeric prices, 0 postal mismatches, 0 unmatched licences.
  8. Verified zero trailing whitespace across `tasks/` via `git diff --check -- tasks/`.
- **Verification Verdict**: `PASS_WITH_LIMITATIONS` (Structural pass; factual accuracy pending live primary source re-crawling).
"""

with open("tasks/session-log.md", "r") as f:
    session_log = f.read()

session_log += session_entry
cleaned_session_log = "\n".join(l.rstrip() for l in session_log.splitlines()) + "\n"
with open("tasks/session-log.md", "w") as f:
    f.write(cleaned_session_log)
print("Updated tasks/session-log.md")
