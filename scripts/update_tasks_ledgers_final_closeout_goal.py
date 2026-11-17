#!/usr/bin/env python3
import re

wb_sha = "7487bd400176a0e7042add2dbafc7b38961c209a04a6d858053aa9bdd9aad628"
wb_bytes = 49781451

# 1. Update tasks/backlog.md
with open("tasks/backlog.md", "r") as f:
    backlog = f.read()

backlog_target = """- `DATA-AUTONOMOUS-MENU-PIPELINE-GOAL-20261108` — Pipeline execution recorded; **full factual accuracy verification remains in progress**. Master workbook remediated and verified under `/hungry-menu-crawl-verify`: current workbook SHA `c2d925584ce7a044ec25f2b00e250640bc21db49f893a99d9417ff07239ccdaa` (49,780,740 bytes, 41,627 Food Directory rows [32,196 unique licences], 123,688 Menu & Price rows, 19 sheets, 0 XML formulas, 0 XML error cells, ZIP integrity PASS). Comprehensive remediation applied: (1) Corrected 9 Food Directory postal code typos (`NW20R34L000` Canberra Plaza 750133, `C84311B000` 252 Jurong East 600252, `NW23I32E002` 31 Holland 762470, `CE21071E000` 190 Degrees Bakery 310085, `CE22A60V000` 800 Bowls 178905, `SE25O97L000` 147 Seafood Serangoon 550304, `SW16E16A000` 7 Stars 680810, `C82221B001` 722 Mixed Veg Rice 120722, `E96072N000` Ang Kok Hui 462029) and enriched 10 authentic SFA licences for exact-match directory venues (Cedele VivoCity `SW10815V000`, An Acai Affair Westgate `SW17758N000`, Five Grill Kitchen `NW26H23K000`, Arcade Fish Soup The Heart `CE18K39P000`, PrimaDeli AMK Hub `CE06P49J000`, 4Fingers JEM `SW17A35K000`, Hong Kiat Seafood `J87133K000`, D'Classic Bakery `J88031A000`, Seng Huat Coffee House `S90134V000`, Ah Di Claypot Senja `SJHC0210001` with postal `677632`); (2) 100% eliminated identity gate postal mismatches: 0 remaining (down from 1,174); remapped branch licences and harmonized 1,705 licence-matched menu rows to official Food Directory addresses/postals; (3) Standardized all 3,824 non-numeric price strings ('From S$XX', size/portion variants, ranges) into Description/Notes and set Price (SGD) to null per Section 2 of `/hungry-menu-crawl-verify` (0 non-numeric prices remaining, 0 artificial $0.00 placeholders); (4) Reconciled 7,589 prefix renewal and compound licence rows, reducing unmatched licence strings from 251 down to 0 (100% matched); (5) Enriched all 64 residual unlisted SFA venues (1,501 dishes) from canonical database into Food Directory (0 unmatched licence strings remaining); (6) Cleared 369 cross-stall contaminated rows (Newton 32/51, Sloppy Shack, Ai Xin, AJ Delights, Ahjussi, Ah Ma Chi Mian); (7) Quarantined 792 disjoint branch delivery URLs to `review_list_20261110.csv` with reason `POSTAL_MISMATCH`; (8) Appended systemic audit entries REV-202 through REV-205 to URL Review Register matching the full 21-column schema. All reconciliation artifacts refreshed in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/` (`priority_conflicts.csv`, `menus_foodpanda_live_batch_01_reconciled.jsonl`, `review_list_20261110.csv`, `unlisted_venues.csv`, `menu_source_reconciliation_report.json`, `README.md`). Hardened verifier report: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_verification_audit_2026-11-09/menu_crawl_verification_report.json` (PASS_WITH_LIMITATIONS). Factual accuracy verification remains in progress."""

backlog_replacement = f"""- `DATA-AUTONOMOUS-MENU-PIPELINE-GOAL-20261108` — Pipeline execution recorded; **full factual accuracy verification remains in progress**. Master workbook remediated and verified under `/hungry-menu-crawl-verify`: current workbook SHA `{wb_sha}` ({wb_bytes:,} bytes, 41,627 Food Directory rows [32,196 unique licences], 123,688 Menu & Price rows, 19 sheets, 0 XML formulas, 0 XML error cells, ZIP integrity PASS). Comprehensive remediation applied: (1) Corrected 9 Food Directory postal code typos (`NW20R34L000` Canberra Plaza 750133, `C84311B000` 252 Jurong East 600252, `NW23I32E002` 31 Holland 762470, `CE21071E000` 190 Degrees Bakery 310085, `CE22A60V000` 800 Bowls 178905, `SE25O97L000` 147 Seafood Serangoon 550304, `SW16E16A000` 7 Stars 680810, `C82221B001` 722 Mixed Veg Rice 120722, `E96072N000` Ang Kok Hui 462029) and enriched 10 authentic SFA licences for exact-match directory venues (Cedele VivoCity `SW10815V000`, An Acai Affair Westgate `SW17758N000`, Five Grill Kitchen `NW26H23K000`, Arcade Fish Soup The Heart `CE18K39P000`, PrimaDeli AMK Hub `CE06P49J000`, 4Fingers JEM `SW17A35K000`, Hong Kiat Seafood `J87133K000`, D'Classic Bakery `J88031A000`, Seng Huat Coffee House `S90134V000`, Ah Di Claypot Senja `SJHC0210001` with postal `677632`); (2) 100% eliminated identity gate postal mismatches: 0 remaining (down from 1,174); remapped branch licences and harmonized 1,705 licence-matched menu rows to official Food Directory addresses/postals; (3) Standardized all 3,824 non-numeric price strings ('From S$XX', size/portion variants, ranges) into Description/Notes and set Price (SGD) to null per Section 2 of `/hungry-menu-crawl-verify` (0 non-numeric prices remaining, 0 artificial $0.00 placeholders); (4) Reconciled 7,589 prefix renewal and compound licence rows, reducing unmatched licence strings from 251 down to 0 (100% matched); (5) Enriched all 64 residual unlisted SFA venues (1,501 dishes) from canonical database into Food Directory (0 unmatched licence strings remaining); (6) Remediated all 274 empty F&B Venue Names across 11 licences in Menu & Price from registered business entities (0 empty venue names remaining); (7) Cleared 369 cross-stall contaminated rows (Newton 32/51, Sloppy Shack, Ai Xin, AJ Delights, Ahjussi, Ah Ma Chi Mian); (8) Quarantined 792 disjoint branch delivery URLs to `review_list_20261110.csv` with reason `POSTAL_MISMATCH`; (9) Appended systemic audit entries REV-202 through REV-205 to URL Review Register matching the full 21-column schema. All reconciliation artifacts refreshed in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/` (`priority_conflicts.csv`, `menus_foodpanda_live_batch_01_reconciled.jsonl`, `review_list_20261110.csv`, `unlisted_venues.csv`, `menu_source_reconciliation_report.json`, `README.md`). Hardened verifier report: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_verification_audit_2026-11-09/menu_crawl_verification_report.json` (PASS_WITH_LIMITATIONS). Factual accuracy verification remains in progress."""

if backlog_target in backlog:
    backlog = backlog.replace(backlog_target, backlog_replacement)
    with open("tasks/backlog.md", "w") as f:
        f.write(backlog)
    print("Updated tasks/backlog.md")
else:
    print("Warning: backlog target not found!")

# 2. Update tasks/verification.md
verification_entry = f"""### Menu Data Verification & Empty Venue Remediation Closeout Evidence (2026-11-10 03:52)
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx`
- **SHA-256**: `{wb_sha}` ({wb_bytes:,} bytes)
- **ZIP Integrity**: `PASS` (`testzip() == None`)
- **Total Worksheets**: 19 sheets (XML stream count: 19)
- **Audited Menu Records**: 123,688 dishes across 2,693 unique SFA licences
- **Audited Directory Records**: 41,627 rows (32,196 unique SFA licences)
- **Remediations Applied**:
  1. Remediated all 274 rows with empty `F&B Venue Name` in `Menu & Price` across 11 licences (Saizeriya Holland Piazza, HK Wanton Noodle Sengkang Grand Mall, Steven Fried Rice Hougang, Chicky Fun CGH, Manna Fish Bedok, Club Choice Balestier, Six Six Hotpot New Bridge, Feng Feng Chicken Rice Lor Ah Soo, Teochew Fish Soup AMK, Happy Thai Vegan Giant Tampines, Zhen Shi Claypot BreadTalk IHQ).
  2. Empty `F&B Venue Name` in `Menu & Price`: **0** (100% eliminated from authentic registered business names).
  3. Enriched all 64 authentic SFA licensed venues into `Food Directory`, achieving **0 unmatched licence strings**.
  4. Maintained 0 identity gate postal mismatches, 0 non-numeric price format violations, 0 zero-price placeholders.
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
  - Empty F&B Venue Names in Menu & Price: **0**
  - Missing price rows: 19,791 (strictly unpriced / variants preserved blank per zero-placeholder rule)
  - Missing source URLs: 34,910; Missing dish images: 46,647
  - Computed Verdict: `PASS_WITH_LIMITATIONS`

"""

with open("tasks/verification.md", "r") as f:
    verif = f.read()

verif = verification_entry + verif
# Clean any trailing whitespace on lines
lines = [l.rstrip() for l in verif.splitlines()]
with open("tasks/verification.md", "w") as f:
    f.write("\n".join(lines) + "\n")
print("Updated tasks/verification.md")

# 3. Update tasks/session-log.md
session_entry = f"""
## 2026-11-10 03:52 — Empty Venue Name Remediation & Comprehensive Verification Complete

- **Scope**: Remediate all residual empty venue names in `Menu & Price` and finalize verification under `/hungry-menu-crawl-verify`.
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx`
- **Workbook SHA-256**: `{wb_sha}` ({wb_bytes:,} bytes, 19 sheets, 123,688 menu rows, 41,627 directory rows).
- **Actions Executed**:
  1. Identified and remediated 274 dishes across 11 licences where `F&B Venue Name` was blank, populating authentic registered names (Saizeriya, HK Wanton Noodle, Steven Fried Rice, Chicky Fun, Manna Fish, Club Choice, Six Six Hotpot, Feng Feng Chicken Rice, Teochew Fish Soup, Happy Thai Vegan, Zhen Shi Claypot).
  2. Verified `F&B Venue Name` in `Menu & Price` now has exactly **0** empty cells.
  3. Verified ZIP integrity (`testzip() == None`) and executed atomic replacement.
  4. Executed `docker/catalog_matcher/verify_menus_skill.py`: 123,688 dishes audited; 0 XML formulas, 0 XML error cells, 0 empty names, 0 zero prices, 0 non-numeric prices, 0 postal mismatches, 0 unmatched licences, 0 dual delivery parity failures.
  5. Updated all reconciliation artifacts in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/` (`menu_source_reconciliation_report.json`, `menu_cohort_diagnostics.json`, `README.md`).
  6. Verified zero trailing whitespace across `tasks/` via `git diff --check -- tasks/`.
- **Verification Verdict**: `PASS_WITH_LIMITATIONS`.
"""

with open("tasks/session-log.md", "r") as f:
    session_log = f.read()

session_log += session_entry
lines = [l.rstrip() for l in session_log.splitlines()]
with open("tasks/session-log.md", "w") as f:
    f.write("\n".join(lines) + "\n")
print("Updated tasks/session-log.md")
