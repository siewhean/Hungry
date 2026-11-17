#!/usr/bin/env python3
"""
update_backlog_evidence_20261110.py
Clean ledger updater for tasks/backlog.md, tasks/verification.md, and tasks/session-log.md.
Ensures zero trailing whitespace and strict adherence to git diff --check.
"""

def update_backlog():
    backlog_path = "tasks/backlog.md"
    with open(backlog_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_entry = """- `DATA-AUTONOMOUS-MENU-PIPELINE-GOAL-20261108` — Pipeline execution recorded; **full factual accuracy verification remains in progress**. Master workbook remediated and verified under `/hungry-menu-crawl-verify`: current workbook SHA `61bff8a996b9bb502520f9f18967d756f5ca5f656bd389860337d2911dc8a5bd` (49,766,174 bytes, 41,563 Food Directory rows [32,132 unique licences], 123,688 Menu & Price rows, 19 sheets, 0 XML formulas, 0 XML error cells, ZIP integrity PASS). Comprehensive remediation applied: (1) Corrected 9 Food Directory postal code typos (`NW20R34L000` Canberra Plaza 750133, `C84311B000` 252 Jurong East 600252, `NW23I32E002` 31 Holland 762470, `CE21071E000` 190 Degrees Bakery 310085, `CE22A60V000` 800 Bowls 178905, `SE25O97L000` 147 Seafood Serangoon 550304, `SW16E16A000` 7 Stars 680810, `C82221B001` 722 Mixed Veg Rice 120722, `E96072N000` Ang Kok Hui 462029) and enriched 10 authentic SFA licences for exact-match directory venues (Cedele VivoCity `SW10815V000`, An Acai Affair Westgate `SW17758N000`, Five Grill Kitchen `NW26H23K000`, Arcade Fish Soup The Heart `CE18K39P000`, PrimaDeli AMK Hub `CE06P49J000`, 4Fingers JEM `SW17A35K000`, Hong Kiat Seafood `J87133K000`, D'Classic Bakery `J88031A000`, Seng Huat Coffee House `S90134V000`, Ah Di Claypot Senja `SJHC0210001` with postal `677632`); (2) 100% eliminated identity gate postal mismatches: 0 remaining (down from 1,174); remapped branch licences and harmonized 1,705 licence-matched menu rows to official Food Directory addresses/postals; (3) Standardized all 3,824 non-numeric price strings ('From S$XX', size/portion variants, ranges) into Description/Notes and set Price (SGD) to null per Section 2 of `/hungry-menu-crawl-verify` (0 non-numeric prices remaining, 0 artificial $0.00 placeholders); (4) Reconciled 7,589 prefix renewal and compound licence rows, reducing unmatched licence strings from 251 down to 64 residual unlisted venues; (5) Catalogued all 64 residual unlisted venues affecting 1,501 dishes in `unlisted_venues.csv`; (6) Cleared 369 cross-stall contaminated rows (Newton 32/51, Sloppy Shack, Ai Xin, AJ Delights, Ahjussi, Ah Ma Chi Mian); (7) Quarantined 792 disjoint branch delivery URLs to `review_list_20261110.csv` with reason `POSTAL_MISMATCH`; (8) Appended systemic audit entries REV-202 through REV-205 to URL Review Register matching the full 21-column schema. All reconciliation artifacts refreshed in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/` (`priority_conflicts.csv`, `menus_foodpanda_live_batch_01_reconciled.jsonl`, `review_list_20261110.csv`, `unlisted_venues.csv`, `menu_source_reconciliation_report.json`, `README.md`). Hardened verifier report: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_verification_audit_2026-11-09/menu_crawl_verification_report.json` (PASS_WITH_LIMITATIONS). Factual accuracy verification remains in progress.\n\n"""

    target_anchor = "## Current Focus\n\n"
    if target_anchor not in content:
        raise ValueError("Anchor not found in tasks/backlog.md")
    content = content.replace(target_anchor, target_anchor + new_entry, 1)
    with open(backlog_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated tasks/backlog.md.")

def update_verification():
    verif_path = "tasks/verification.md"
    with open(verif_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_section = """### Menu Data Verification & Unmatched Licence Reconciliation Evidence (2026-11-10 03:15)
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx`
- **SHA-256**: `61bff8a996b9bb502520f9f18967d756f5ca5f656bd389860337d2911dc8a5bd` (49,766,174 bytes)
- **ZIP Integrity**: `PASS` (`testzip() == None`)
- **Total Worksheets**: 19 sheets (XML stream count: 19)
- **Audited Menu Records**: 123,688
- **Audited Directory Records**: 41,563 (32,132 unique SFA licences)
- **Remediations & Enrichments Applied**:
  1. Enriched 10 authentic SFA licences for exact-match directory venues: Cedele VivoCity (`SW10815V000`), An Acai Affair Westgate (`SW17758N000`), Five Grill Kitchen (`NW26H23K000`), Arcade Fish Soup The Heart (`CE18K39P000`), PrimaDeli AMK Hub (`CE06P49J000`), 4Fingers JEM (`SW17A35K000`), Hong Kiat Seafood (`J87133K000`), D'Classic Bakery (`J88031A000`), Seng Huat Coffee House (`S90134V000`), Ah Di Claypot Senja (`SJHC0210001` with postal `677632`).
  2. Applied 1,492 licence remappings in `Menu & Price` across compound licence chains (PUTIEN, JUMBO, Nando's, Jollibee) and verified branch renewals (The Bark Cafe `E02011J000`, Tiong Bahru Bakery Wisma Atria `CE23M66X000`, Georges@Changi `E96186X000`, Snag Bar `SE14319N000`, McDonald's Yew Tee `SW09255A000`, No.5 Emerald Hill `W91178V000`, Greendot Paya Lebar `SE14C24K000`, Juz Bread `CE14901K000`, Heavenly Wang T3 `SE07377B000`, Starbucks Suntec `CE04560A000`, KFC Zoo `NW23J21J000`, Siong BBQ `S85168P008`, Aiman Cafe `C82249A007`, Burger King T4 `SE17398C000`, Ajumma's Westgate `NW25Q43B000`, Ah Fang Yu Tang Ban Mian CCK `J94100L002`, 165 Pork Rib Prawn Noodles Yishun `NW23D62N000`, Hjh Maimunah Mini `CE24984E000`, 27 Mezze Bar & Grill `CE04427J000`, Bakery Cuisine Raffles Place `CE23309E000`, Five Ten Boon Lay `J78010V001`, Greendot Westgate `SW17A33N000`, 21WTM `B86079X005`, 806 Cafe `B92052X000`, 728 Kopihouse `B80102C010`, Bistro Bowl `SE26436B008`).
  3. Harmonized 992 postal/address cells on remapped rows to match official Food Directory records (total 1,705 harmonizations; 0 identity gate postal mismatches).
  4. Documented all 64 residual unlisted venues affecting 1,501 dishes in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/unlisted_venues.csv`.
- **QA Verifier Results (`docker/catalog_matcher/verify_menus_skill.py`)**:
  - Raw XML Formula tags: 0
  - Raw XML Error cells: 0
  - Empty dish names: 0
  - Broken formula errors: 0
  - Zero-price placeholders ($0.00 / <=0): 0
  - Non-numeric price formats: 0 (3,824 size/variant prices standardized in Description/Notes, price null per Section 2)
  - Invalid image URL schemes: 0
  - Dual delivery labels: 10,452 (Parity failures: 0)
  - Identity gate postal mismatches: 0
  - Unmatched licence strings: 64 (all documented in `unlisted_venues.csv`)
  - Missing price rows: 19,791 (strictly unpriced / variants preserved blank per zero-placeholder rule)
  - Missing source URLs: 34,910; Missing dish images: 46,647
  - Computed Verdict: `PASS_WITH_LIMITATIONS`
- **Reconciliation Directory Artifacts**:
  - `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/unlisted_venues.csv` (64 venues, 1,501 dishes)
  - `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/priority_conflicts.csv` (1,304 rows)
  - `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/menus_foodpanda_live_batch_01_reconciled.jsonl` (191 rows)
  - `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/review_list_20261110.csv`
  - `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/menu_source_reconciliation_report.json` (bound to `61bff8a9...`)
  - `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/README.md`
  - `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_verification_audit_2026-11-09/menu_crawl_verification_report.json` (bound to `61bff8a9...`)

"""
    content = new_section + content
    with open(verif_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated tasks/verification.md.")

def update_session_log():
    log_path = "tasks/session-log.md"
    entry = """
## 2026-11-10 03:15 — Autonomous Menu Pipeline Verification & Residual Licence Reconciliation

- **Scope**: Finalize menu validation and evidence reconciliation under `/hungry-menu-crawl-verify` and `/goal` for directory `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/`.
- **Master Workbook**: `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx` (SHA-256 `61bff8a996b9bb502520f9f18967d756f5ca5f656bd389860337d2911dc8a5bd`, 49,766,174 bytes).
- **Actions Executed**:
  1. Enriched 10 authentic SFA licences in `Food Directory` for exact-match stalls previously lacking licences: Cedele VivoCity (`SW10815V000`), An Acai Affair Westgate (`SW17758N000`), Five Grill Kitchen (`NW26H23K000`), Arcade Fish Soup The Heart (`CE18K39P000`), PrimaDeli AMK Hub (`CE06P49J000`), 4Fingers JEM (`SW17A35K000`), Hong Kiat Seafood (`J87133K000`), D'Classic Bakery (`J88031A000`), Seng Huat Coffee House (`S90134V000`), Ah Di Claypot Senja (`SJHC0210001` with postal `677632`).
  2. Remapped 1,492 licence rows in `Menu & Price` across compound chain licences (PUTIEN, JUMBO, Nando's, Jollibee) and verified branch renewals (The Bark Cafe `E02011J000`, Tiong Bahru Bakery Wisma Atria `CE23M66X000`, Georges@Changi `E96186X000`, Snag Bar `SE14319N000`, McDonald's Yew Tee `SW09255A000`, No.5 Emerald Hill `W91178V000`, Greendot Paya Lebar `SE14C24K000`, Juz Bread `CE14901K000`, Heavenly Wang T3 `SE07377B000`, Starbucks Suntec `CE04560A000`, KFC Zoo `NW23J21J000`, Siong BBQ `S85168P008`, Aiman Cafe `C82249A007`, Burger King T4 `SE17398C000`, Ajumma's Westgate `NW25Q43B000`, Ah Fang Yu Tang Ban Mian CCK `J94100L002`, 165 Pork Rib Prawn Noodles Yishun `NW23D62N000`, Hjh Maimunah Mini `CE24984E000`, 27 Mezze Bar & Grill `CE04427J000`, Bakery Cuisine Raffles Place `CE23309E000`, Five Ten Boon Lay `J78010V001`, Greendot Westgate `SW17A33N000`, 21WTM `B86079X005`, 806 Cafe `B92052X000`, 728 Kopihouse `B80102C010`, Bistro Bowl `SE26436B008`).
  3. Harmonized 992 postal/address cells on remapped rows to match official Food Directory records (total 1,705 harmonizations; 0 identity gate postal mismatches).
  4. Catalogued all 64 residual genuinely unlisted venues affecting 1,501 dishes in `unlisted_venues.csv`.
  5. Verified ZIP integrity and executed atomic replacement.
  6. Refreshed `menu_source_reconciliation_report.json` and `README.md` in `outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/_work/menu_reconciliation_2026-11-10/`.
  7. Hardened verifier (`docker/catalog_matcher/verify_menus_skill.py`) executed: 0 XML formulas, 0 XML error cells, 0 empty names, 0 zero prices, 0 non-numeric prices, 0 postal mismatches, 0 dual-delivery parity failures.
- **Verification Verdict**: `PASS_WITH_LIMITATIONS`.
"""
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(entry)
    print("Updated tasks/session-log.md.")

if __name__ == "__main__":
    update_backlog()
    update_verification()
    update_session_log()
