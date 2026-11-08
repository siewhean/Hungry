---
name: hungry-menu-crawl
description: Extract accurate, up-to-date menu data (dishes, prices, categories, images, menu schedules) for stalls in the Hungry Food Directory and append it safely to the Full Menu & Price workbook (Doc 2). Use when asked to crawl, extract or update menus, add dishes to the Food Directory or Full Menu workbook, refresh prices, fill missing dish fields (image, category, description, dietary), or process saved Foodpanda/Grab pages or an official menu page. Never bypasses bot protection; dry-run first; dietary values only from explicit sources.
---

# Hungry menu crawl

Goal: every dish row in Doc 2 belongs to exactly one outlet, carries evidence (source URL, capture time, source type), and has only the fields its source genuinely supports. Missing evidence stays blank or "Unknown". Never invent stall names, dishes, prices or dietary flags (`tasks/lessons.md`).

Use alongside two existing skills, do not restate them:
- `hungry-directory-crawl-verify`: the identity key (SFA licence + unit + postal), Place ID and website rules, Tier A/B/C verification, manifest and one-writer rules. Use it to decide which outlet a page belongs to.
- `fb-stall-data-cleaning`: merging, adding or deleting stall rows in the Food Directory sheet. Use it for any clean-up of stall rows; this skill only appends dish rows.

Detail lives in `references/`: `field-fill-matrix.md` (every Doc 2 column), `source-ladder.md` (what each source allows, Foodpanda data map), `qa-checklist.md` (audit-derived checks).

## Hard rules

1. **Never bypass bot protection.** No stealth plugins, fingerprint spoofing, proxy rotation, CAPTCHA solving or headless evasion for PerimeterX, Cloudflare or similar. On HTTP 403, "confirm you are human" or any challenge page: stop that site, record `blocked` with the URL and time, report to the owner, move to the next source. Never retry in a loop. Do not use the earlier stealth scraper (`scrape_foodpanda_batch.mjs`, puppeteer-extra stealth, `scripts/test_foodpanda_stealth.js`).
2. **No live crawl without the owner's yes in chat.** Always pilot 3-5 stalls first and report row counts, price coverage and image HD rate. Concurrency 1, fixed delay of at least 3 seconds, exponential backoff, stop on block, resumable done-file.
3. **Identity before data.** One page maps to one licence. If a URL maps to several licences, or unit, postal or name numbers disagree (Newton 32 vs Newton 51), queue for review; do not attach. The venue name, address and postal in the workbook come from Doc 2 or the master DB, never from the page.
4. **Dry-run first.** The helper defaults to a dry run. Apply only after the owner has read the diff summary and said yes.
5. **No DB writes.** This skill touches CSV/XLSX files only. Loading into Supabase is a separate reviewed migration (backup, down-migration, staging first).
6. **Delivery prices are not in-store prices.** Record `price_basis`. Typical delivery markup is unmeasured here; do not claim a figure.

## Procedure

### 1. Preflight
- `git branch --show-current`, `git status --short`: work on a clean worktree, never in the dirty WIP checkout.
- `df -h /`: the helper refuses when free space is under 3x the file sizes; free space first rather than raising the factor.
- Confirm one writer for the workbook (see `hungry-directory-crawl-verify` section 0). Do not copy the 58 MB Doc 2 CSV around; the helper reads it in place.
- Python: `python3 scripts/menu_workbook_merge.test.py` must pass (needs openpyxl for the XLSX test; it skips under `python3 -I` because user site-packages are hidden).

### 2. Choose stalls
Doc 2 key is `SFA Licence`; the master DB (`data/Hungry_Database_Food_Only_2026-10-21.csv`) has `SFA Licence` and `Menu URL`. Candidates, in order:
1. Master rows with a `Menu URL` and no Doc 2 dish rows.
2. Doc 2 licences whose newest `Last Verified Date` is older than 30 days (refresh).
3. Doc 2 rows with blank price, image or category for a licence that has a usable source.

```bash
python3 -I - <<'PY'
import csv, collections, datetime
csv.field_size_limit(10**8)
have = collections.defaultdict(str)
with open("data/Hungry Full Menu & Price - 21 Oct 2026.csv", newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        for lic in r["SFA Licence"].replace(",", ";").split(";"):
            have[lic.strip()] = max(have[lic.strip()], r["Last Verified Date"])
with open("data/Hungry_Database_Food_Only_2026-10-21.csv", newline="", encoding="utf-8-sig") as f:
    todo = [r["SFA Licence"] for r in csv.DictReader(f) if r["Menu URL"] and r["SFA Licence"] not in have]
print(len(todo), "master stalls with a Menu URL and no dish rows; first 5:", todo[:5])
PY
```
Skip URLs shared by several licences (the audit found 7,286 licences on 1,577 shared URLs): they need identity review first, not a crawl.

### 3. Pick the source (ladder, safest first)
1. Pages the owner saved from their own browser after passing any human check; parse offline.
2. The stall or brand's own website or official ordering page, only if robots.txt and the terms allow automated reads. Read both first and record the finding.
3. Official, partner or licensed APIs/feeds the owner has access to.
4. Public open data (data.gov.sg, SFA).

Details, limits and the "when blocked" action per source are in `references/source-ladder.md`. Foodpanda and Grab pages are tier 1 only (owner-saved). Whether their data may be republished in the app is an open decision (see end).

### 4. Pilot (3-5 stalls)
- Offline parse of saved pages: `node scripts/extract_foodpanda_menus.mjs --from-snapshot <saved.html> > rows.jsonl` (no requests, writes nothing).
- Online runs (tiers 2-4 only, after the owner's yes): `STALL_LIMIT=5`, `CONCURRENCY=1`, delay >= 3 s.
- Report: items per stall, % with price, % with original-size image, categories seen, menu schedule seen, anything blocked.

### 5. Identity match
Add to each extracted row what the extractor does not emit yet (see Known gaps): `licence` (real SFA licence, not the vendor code), `captured_at` (ISO-8601 with timezone, the time the page was saved), `source_type`, and the page evidence `page_name`, `page_postal_code`, `page_address` (unit), `page_lat`, `page_lng` from the ld+json. The helper passes a row only when nothing contradicts the workbook and two checks agree (postal, unit, name, coordinates within 300 m), or the owner signed off with `identity_confirmed_by`.

### 6. Extract and normalise
The helper does the mechanical part; check its output rather than redoing it:
- Prices to plain two-decimal SGD (`$2.30++`, `from S$ 10.80`, `28 / 35` parsed; size options go to Description / Notes and the sidecar; `+$` add-ons rejected as add-ons). Below S$0.50 or above S$100 goes to review.
- HTML entities decoded, whitespace trimmed, NFC, brand casing kept.
- Images: resize parameters stripped to the full-size URL; thumbnails recorded in the sidecar only; one image used on more than 5 rows is blanked.
- Duplicates collapsed on licence + normalised name + price; "Popular"/featured copies lose to the real category.
- Dietary, allergen, Halal, Vegan, Pork-free columns stay at the workbook default unless the row carries `dietary: {"Halal": {"value": "Yes", "evidence": "<where it says so>"}}`. Never infer from dish names, and never copy venue-level Halal/Vegan onto dishes.

### 7. Validate and review queue
Dry-run, writing the queue:
```bash
python3 scripts/menu_workbook_merge.py --input rows.jsonl \
  --target "data/Hungry Full Menu & Price - 21 Oct 2026.csv" \
  --master data/Hungry_Database_Food_Only_2026-10-21.csv --review-queue rows.review.jsonl
```
Read the summary: new rows, already present, rejected by reason, warnings, stalls with only one menu captured. Then run `references/qa-checklist.md` on a sample of 10 rows per stall. Rejected rows are never auto-fixed; each reason code is explained in the checklist. `price_changed_existing` means a refresh: the owner decides whether to replace the old row (replacement is a Tier C change; do it with `fb-stall-data-cleaning` style manifest, not through this helper).

### 8. Merge (owner OK, then apply)
Show the dry-run summary and ask. After a yes:
```bash
python3 scripts/menu_workbook_merge.py ... --apply --xlsx "data/Hungry Full Menu & Price - 21 Oct 2026.xlsx"
```
The helper checks free space (3x), makes a timestamped, hash-verified backup, builds the new CSV beside the original, validates it, builds the XLSX from that CSV (openpyxl, never a CSV renamed `.xlsx`), validates zip, row and column counts, then swaps with `os.replace`. If the XLSX swap fails it restores the CSV. Re-running changes nothing. It prints the restore command for every backup.

### 9. Report
Lead with counts: stalls processed, rows appended, rows queued (by reason), stalls blocked, backup paths. Then decisions needed. Say what could not be checked (live sites, other scheduled menus). Append one line to `tasks/session-log.md`; record verification in `tasks/verification.md` for broad runs.

## Freshness
- A saved page holds only the menu active when it was saved. The sidecar records `menu_scope` and `other_menus_captured: false`; list those stalls and ask the owner to save the other menus (for example weekend brunch vs weekday) before calling a stall complete.
- Re-crawl when the capture is older than 30 days (`recrawl_after` in the sidecar), when a price-change signal appears (owner report, promo banner, a refresh showing `price_changed_existing`), or when a stall changes menu schedule.
- `verified` stays false until a named person confirms the item, outlet and price (`verified_by`, `verified_at`). Do not stamp it from a brand-name match (`tasks/lessons.md`).

## Output files (all beside the target unless overridden)
- `<target>.provenance.jsonl`: one record per item key with source URL, capture time, source type, price basis, menu id/title/description/hours, menu scope, discounted price, price options, stall hours, image quality, verified flags, recrawl date.
- `<input>.review-queue.jsonl`: rejected rows with reason codes and detail.
- `<name>_before_menu_merge_<UTC stamp>.csv|xlsx|jsonl`: backups.

## Known gaps / open decisions for the owner
1. **Authorised data source for Foodpanda and Grab.** Their terms and robots.txt were not reviewed here, and no partner/API access is documented. Until the owner confirms the right to read and republish, use only owner-saved pages for internal review, and treat the data as `verified: false`. Prefer each brand's own site (tier 2) where it exists.
2. **Re-crawl cadence.** 30 days is a default, not a decision. Chains with frequent promo changes may need shorter; hawker stalls longer.
3. **Who sets `verified: true`**, and the evidence bar (photo of in-store menu board? official PDF?). The helper only enforces that a name and date exist.
4. **Delivery vs in-store prices.** The workbook has one price column. Either add a `Price Basis` column (the helper would then need `price_basis` in KNOWN_COLUMNS) or keep it in the sidecar and Description / Notes as now.
5. **Multiple scheduled menus per stall** are not merged into one view; there is no menu column in Doc 2. Decide whether to add Menu / Availability.
6. **Extractor gaps.** `scripts/extract_foodpanda_menus.mjs` does not yet emit `licence`, `captured_at`, `source_type` or the `page_*` identity fields, so an adapter step is needed. It also does not read `dietaryAttributes` or `isBundle` from the Apollo product, which would give `item_type` and an explicit dietary source on stalls that populate them.
7. **Existing Doc 2 price cells** hold text such as `From S$55.00` (about 1,190 rows), `$2.30++` (276 rows) and size lists; a one-off clean-up with the same parser is advisable but changes existing rows (Tier C).
8. **Dish-level dietary** coverage will stay "Unknown" for nearly all rows until an explicit source exists (official allergen sheets, certified-Halal lists).
9. **XLSX size.** The Doc 2 sheet XML is about 163 MB uncompressed; the rebuild streams it, but needs the free space the guard demands.
