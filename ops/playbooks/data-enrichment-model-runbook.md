# Data Enrichment Model Runbook

Use this runbook when another model is extracting Hungry stall, menu, image, price, description, tag, and location data and syncing it into both Supabase and the Excel master workbook.

## Goal

Keep these data surfaces consistent:

| Surface | Purpose | Location |
|---|---|---|
| Supabase | Structured live database for venues, dishes, prices, images, descriptions, tags, and source metadata | Linked Supabase project |
| Excel master | Local auditable master file | `data/Hungry F&B Database.xlsx` |
| App catalog | Generated app data used when Excel mode is active | `src/lib/services/excel/excelCatalog.generated.json` |

Supabase is the structured write target. Excel is the local master snapshot. The app catalog is generated from Excel and must not be manually edited.

Install the pinned Python workbook dependencies once per environment:

```bash
python3 -m pip install -r scripts/requirements-data-enrichment.txt
```

## Non-Negotiable Rules

| Rule | Detail |
|---|---|
| Official sources only | Use merchant websites/APIs, delivery-platform merchant pages, mall directories, or verified source-backed records. |
| HD images only for new image writes | Prefer images with at least `512px` on the shortest side. Do not claim existing low-resolution images are HD. |
| No placeholders | Never use Unsplash, Picsum, Wikimedia demo images, generated local art, favicons, broken URLs, or placeholder logos as real media. |
| No food-as-logo | A stall logo must be an official brand/platform logo. Dish photos may be used only as dish/menu images. |
| One venue at a time | Dry-run, review, apply, sync, validate, and log one venue before moving to the next. |
| Do not invent data | If name, price, image, location, logo, tag, or description is not source-backed, leave it empty or mark it pending. |
| Supabase health first | If Supabase is timing out, update only the Excel master with reviewed data and generate pending SQL for later. |
| Excel stays openable | Every workbook write must be followed by ZIP/openability validation. |
| App catalog is generated | Never hand-edit `src/lib/services/excel/excelCatalog.generated.json`. |

## Data To Extract

For each stall:

| Field | Rule |
|---|---|
| Stall name | Use the consumer-facing brand/outlet name. Remove legal suffixes like `PTE LTD` when a better display name is verified. |
| Chain outlet label | Use `Brand - Mall/Building/Outlet`, for example `Polar Puffs and Cakes - White Sands`. |
| Address | Use the verified outlet address. |
| Postal code | Store when source-backed. |
| Latitude/longitude | Store only when source-backed or geocoded from a verified address. |
| Logo | Use official stall/platform logo only. Do not use food photos as logos. |
| Menu source URL | Store the exact source page used. |
| Cuisine/tags | Use specific tags based on the stall and dishes. Avoid generic fallback tags. |

For each dish:

| Field | Rule |
|---|---|
| Dish name | Keep the actual menu item name. Skip modifier-only or option-only rows. |
| Price | Store real menu prices. Reject sentinel values like `0.00` or `0.01`. |
| Image | Use actual dish/menu item images from the source. |
| Description | Store useful source-backed text only. Remove boilerplate, promo text, and repeated price text. |
| Tags | Assign dish-specific tags so category buttons can return the right dishes. |

## Data Quality Audit To Run First

Before enrichment, audit current coverage so the model knows what is missing.

| Metric | How to interpret |
|---|---|
| Total venues | Current stall/outlet rows in the master surface. |
| Venues missing logo | Stalls needing official logo review. |
| Venues missing address/postal | Stalls needing location verification. |
| Total dishes | Current menu item rows. |
| Dishes missing price | Menu rows needing source-backed price extraction. |
| Dishes missing image | Menu rows needing official dish/menu images. |
| Dishes missing description | Menu rows needing source-backed descriptions. |
| Dishes missing tags | Menu rows that will not work well in category filters. |
| Placeholder media URLs | Must be removed or nulled. |
| Supermarket/convenience rows | Remove unless they are real prepared-food stalls. |
| Duplicate venues | Merge useful values into one canonical row, then delete duplicates after remapping references. |

Use percentages in the report. Re-run this audit after every batch because counts change.

## End-To-End Pipeline

Use this exact order when extracting data and keeping Excel and Supabase in sync.

| Step | Action | Output |
|---:|---|---|
| 1 | Pick one venue with a verified source URL and missing data. | One venue ID and one source URL. |
| 2 | Scrape the source in dry-run mode. | JSON export under `/tmp/` with proposed changes. |
| 3 | Review outlet identity. | Confirm name, address, postal code, mall/building, and outlet match. |
| 4 | Review menu rows. | Keep real dishes only; reject modifiers, sauces, add-ons, and drink-only rows when not useful. |
| 5 | Review media. | Keep real dish images and official logos only; reject placeholders and food photos used as logos. |
| 6 | Review prices and descriptions. | Keep realistic prices and useful descriptions; strip promo/boilerplate text. |
| 7 | Apply safe writes to Supabase when healthy. | Updated `venues`, `dishes`, and image/source metadata. |
| 8 | If Supabase is unhealthy, apply only vetted rows to Excel and generate pending SQL. | Updated workbook plus `data/*_supabase_backfill_pending.sql`. |
| 9 | Sync Supabase back to Excel after live writes. | `data/Hungry F&B Database.xlsx` reflects database truth. |
| 10 | Validate Excel. | Workbook is openable and validator passes. |
| 11 | Regenerate app catalog from Excel. | `src/lib/services/excel/excelCatalog.generated.json` updated. |
| 12 | Probe the generated catalog. | Counts for venues, dishes, images, prices, tags, and placeholder URLs. |
| 13 | Log verification. | `tasks/verification.md` and `tasks/session-log.md` updated. |

## Extraction Steps For Another Model

Use this sequence for each venue.

| Step | Action | Acceptance check |
|---:|---|---|
| 1 | Select a target venue from the missing-data audit. | Venue has an ID, current name, address/postal if available, and a candidate source URL. |
| 2 | Open the source page/API. | Source is reachable and belongs to the intended stall/outlet. |
| 3 | Confirm identity. | Brand, outlet, building/mall, unit, address, or postal code matches the target venue. |
| 4 | Extract stall fields. | Consumer-facing name, outlet label, address, postal, coordinates when source-backed, official logo, source URL. |
| 5 | Extract menu fields. | Dish name, price, image URL, description, category, tags, source URL. |
| 6 | Reject bad rows. | Skip modifier rows, add-ons, sauces, duplicates, generic placeholders, non-menu rows, and wrong-outlet rows. |
| 7 | Verify image quality. | Keep only official source images; prefer HD images with shortest side at least `512px`. |
| 8 | Normalize names. | Remove legal suffixes where a consumer-facing name is verified; use `Brand - Mall/Building` for chain outlets. |
| 9 | Normalize tags. | Add dish-specific tags so category buttons return relevant dishes. |
| 10 | Dry-run the write. | Proposed rows are reviewable in JSON or SQL before live mutation. |
| 11 | Apply only reviewed rows. | Supabase write succeeds, or Excel is updated with pending SQL when Supabase is unhealthy. |
| 12 | Read back and compare. | Counts and sample rows match the extracted source data. |

## Source Priority

| Priority | Source | Use for |
|---:|---|---|
| 1 | Official merchant website/API | Names, menus, logos, hours, descriptions |
| 2 | Delivery platform menu pages | Menu items, prices, dish photos, merchant logos |
| 3 | Mall/building tenant directories | Outlet location, unit number, building, address |
| 4 | SFA/imported licensing records | Legal identifiers and fallback address checks |
| 5 | Manual review | Only when automation cannot safely verify the outlet |

Do not use Unsplash, Picsum, random Google image results, placeholder favicon domains, generated local art, or demo images as real content.

## One-Venue Workflow

Run one venue at a time.

### 1. Pick A Candidate

Choose a venue with:

| Signal | Why |
|---|---|
| Known menu source URL | The scraper has a real source to fetch. |
| Missing dish images/descriptions | High-value enrichment target. |
| Verified address/postal code | Reduces wrong-outlet writes. |
| Chain outlet context | Helps create display names like `Brand - Mall`. |

### 2. Dry Run

Use live Supabase mode when the database is responding:

```bash
OUT=/tmp/hungry-scraper-dryrun-venue.json
node scripts/auto-enrich-images.mjs \
  --dry-run \
  --known-sources-only \
  --venue-id=VENUE_ID_HERE \
  --limit=1 \
  --fetch-limit=280 \
  --batch-write-size=75 \
  --max-write-timeouts=2 \
  --export-json="$OUT"
```

Use offline workbook mode when Supabase is timing out:

```bash
OUT=/tmp/hungry-scraper-dryrun-venue-offline.json
node scripts/auto-enrich-images.mjs \
  --dry-run \
  --known-sources-only \
  --offline-workbook='data/Hungry F&B Database.xlsx' \
  --venue-id=VENUE_ID_HERE \
  --source-url='SOURCE_URL_HERE' \
  --limit=1 \
  --fetch-limit=280 \
  --batch-write-size=75 \
  --max-write-timeouts=2 \
  --export-json="$OUT"
```

### 3. Review The Dry Run

Approve live writes only when:

| Check | Pass condition |
|---|---|
| Outlet identity | Source page is the intended stall/outlet. |
| Address/postal | Source address matches the target outlet or clearly confirms it. |
| Logo | Logo is a real merchant/platform logo, not a food image. |
| Menu rows | Rows are real dishes, not options or modifiers. |
| Prices | Prices are realistic and non-zero. |
| Images | Image URLs are real source images. |
| Descriptions | Descriptions are useful and not boilerplate/promo text. |

Reject the run if the source page is a wrong outlet, stale address, generic source, or unsafe match.

For images, reject:

| Reject when | Reason |
|---|---|
| Image is under the HD threshold for a new write | It does not satisfy the current official-HD goal. |
| Image is a favicon, social sharing logo, app icon, or generated placeholder | It is not real menu content. |
| Image is a dish photo being assigned to `logo_url` | Logos and dish photos must remain separate. |
| Image URL is broken, redirects to a placeholder, or returns a tiny thumbnail only | It will not render well in the app. |
| Source ownership is unclear | Avoid random search-result images. |

### 4. Live Run

```bash
OUT=/tmp/hungry-scraper-live-venue.json
node scripts/auto-enrich-images.mjs \
  --known-sources-only \
  --venue-id=VENUE_ID_HERE \
  --limit=1 \
  --fetch-limit=280 \
  --batch-write-size=75 \
  --max-write-timeouts=2 \
  --export-json="$OUT"
```

For trusted multi-venue batches, checkpointing is enabled by default when `--limit` is greater than `1` and no `--venue-id` is provided. Progress is written to `data/enrichment_checkpoint.json` after each venue. Use `--reset-checkpoint` to restart the same scoped batch from the beginning, `--checkpoint=PATH` to write elsewhere, or `--no-checkpoint` for a disposable run.

If Supabase is not healthy, do not force the live run. Create a pending SQL artifact instead:

| Artifact | Rule |
|---|---|
| SQL path | `data/<venue-slug>_supabase_backfill_pending.sql` |
| Updates | Only include rows approved from dry-run review. |
| Inserts | Use deterministic IDs and `on conflict do nothing`. |
| Timeouts | Include short `lock_timeout` and `statement_timeout`. |
| Unsafe rows | Leave them out and document why. |

### 5. Read Back Supabase Or Workbook

Verify:

| Metric | Expected result |
|---|---|
| Venue name | Correct display name and outlet label. |
| Address/postal | Correct outlet. |
| Logo | Real logo or null. |
| Dish count | Matches source menu scale. |
| Dishes with images | Increased when source has images. |
| Dishes with prices | Realistic source-backed prices. |
| Dishes with descriptions | Useful descriptions only. |
| Placeholder URLs | `0` |
| Mojibake/corrupt text | `0` |

When Supabase is healthy, read back from Supabase. When using offline workbook mode, read back from the workbook and generated app catalog instead, then leave Supabase marked pending.

### 6. Sync Supabase To Excel

```bash
python3 scripts/sync_supabase_excel_master.py \
  --workbook 'data/Hungry F&B Database.xlsx' \
  --output 'data/Hungry F&B Database.xlsx'
```

### 7. Validate Excel

```bash
unzip -t 'data/Hungry F&B Database.xlsx'
python3 scripts/validate_excel_workbook.py \
  --workbook 'data/Hungry F&B Database.xlsx' \
  --limit 100
```

Expected result:

| Check | Expected |
|---|---|
| ZIP validation | No errors |
| Workbook validator | No critical invalid rows |
| Excel openability | Workbook opens normally |

### 8. Regenerate App Catalog

```bash
python3 scripts/export_excel_catalog_for_app.py \
  --workbook 'data/Hungry F&B Database.xlsx'
```

### 9. Probe App Catalog

Check `src/lib/services/excel/excelCatalog.generated.json` for:

| Check | Expected |
|---|---|
| Venue exists | Updated venue appears. |
| Dishes exist | Updated dishes appear. |
| Images exist | Real dish image URLs are present. |
| Prices exist | Prices match source/Excel. |
| Logo exists | Real logo appears when available. |
| Tags exist | Popular/category filters can return the dish. |
| Placeholder URLs | `0` |

## Cleanup Rules

| Issue | Action |
|---|---|
| Unsplash/Picsum/demo image | Null/remove it. |
| Food photo used as logo | Null it or replace with official logo. |
| Placeholder Google Place ID | Null it. |
| Placeholder favicon/logo URL | Remove it. |
| Supermarket/convenience stall | Remove from the food-discovery dataset unless it is a real prepared-food stall. |
| Legal-only name | Replace with verified consumer-facing name. |
| Chain outlet | Display as `Brand - Mall/Building/Outlet`. |
| Generic imported hours | Use only if source-backed; otherwise `Hours not provided`. |
| Duplicate venue rows | Merge useful values into one canonical row, remap references, then delete duplicates. |

## Sync Rules

| Rule | Reason |
|---|---|
| Write source-backed enrichment into Supabase first | Supabase is structured and reference-aware. |
| Sync Excel after each approved live run | Keeps the local master current. |
| Regenerate app catalog after Excel sync | Keeps app data reproducible. |
| Never manually edit generated catalog JSON | Manual edits will be overwritten. |
| Keep rejected/no-op rows out of claims | Prevents false completion reporting. |
| Record source URL and evidence | Makes every value auditable. |

### Incremental Sync

After one successful full sync has created the `Supabase Venues` and `Supabase Dishes` cache sheets, use the stateful incremental path for routine enrichment runs:

```bash
python3 scripts/sync_supabase_excel_master.py \
  --workbook 'data/Hungry F&B Database.xlsx' \
  --output 'data/Hungry F&B Database.xlsx' \
  --incremental
```

The sync fetches only rows within the bounded `updated_at` watermark using `(updated_at,id)` keyset pagination, then atomically copies and patches only changed Sheet1 cells plus changed/appended Supabase venue/dish cache rows. Unrelated sheets, cells, and formulas remain untouched. Missing/mismatched state or cache sheets fall back to a full sync. The state watermark advances only after the workbook is reopened successfully and atomically replaced. Use `--since=ISO_TIMESTAMP` only for an explicit reviewed recovery window. Because hard deletes do not emit a newer `updated_at`, run `--reconcile-deletions` periodically to force a full cache replacement and record the reconciliation watermark.

## Multi-Platform Scraping And Identity

The core scraper uses shared adapters for Grab, Oddle, Foodpanda, and Deliveroo. `--known-sources-only` is the safe default. Use `--discover-sources` only for a reviewed discovery pass. Discovery uses platform-owned search/state directly; web-search fallbacks are not accepted.

Venue identity uses weighted name, postal, address, and URL-location signals with `accept`, `review`, and `reject` bands. Review/reject candidates are not written automatically. Parallel batches use `--workers=2` by default and are capped at three contexts; Supabase writes remain serialized and rate-limited. Use `--write-interval-ms` and `--inter-venue-delay-ms` to slow a trusted batch further.

## Batch Grab Source Discovery

Use directory/API payloads to stage missing Grab menu source URLs without enriching dishes:

```bash
node scripts/discover-grab-menu-sources.mjs \
  --input=scratch/grab-directory-payload.json \
  --limit=5000 \
  --out=scratch/grab-menu-source-discovery.json
```

The default is dry-run. Approval requires exact postal evidence, strong name similarity, and an unambiguous score margin. Review the report before adding `--apply`; apply mode requires a service-role key and only fills currently-null `menu_source_url` fields. `--directory-url` can collect current `__NEXT_DATA__` payloads when Grab exposes restaurants for the selected location; blocked or location-empty pages must be retained as evidence rather than forced into canonical updates.

## Scheduled Review Batch

`.github/workflows/scheduled-enrichment-review.yml` runs the trusted source-backed batch nightly. Scheduled runs are permanently review-only and supply `--dry-run --known-sources-only --no-inserts`. Apply is manual-only through `workflow_dispatch` and requires the repository owner, the exact `APPLY_EXISTING_ROWS` confirmation, the `enrichment-production` environment branch policy, and its separate `HUNGRY_ENABLE_SCHEDULED_ENRICHMENT_WRITES=1` secret. Keep that secret absent until a reviewed apply window. Apply is capped at 10 venues and three workers, remains known-source-only, and never inserts new dishes or discovers new sources. Both paths validate credentials, redact logs, and upload result/checkpoint/log artifacts. The legacy `HUNGRY_SCHEDULED_ENRICHMENT_MODE=review` variable can remain for compatibility but cannot enable scheduled writes.

## Non-Consumer Entity Audit

```bash
python3 scripts/classify_non_consumer_entities.py \
  --report-json=scratch/non-consumer-report.json \
  --report-csv=scratch/non-consumer-report.csv
```

The classifier combines SFA licence-type evidence with school, corporate, government, manufacturing, warehouse, and placeholder-name rules. Dry-run is the default. `review` rows are always retained. `--apply` requires a distinct `--cleaned-output` and removes only high-confidence `remove` rows, preserving the source CSV and its hash in the audit report.

## Structured Dish Taxonomy

`scripts/dish_taxonomy.py` maps common dish aliases to structured cuisine categories, taste tags, and six-axis taste vectors. The app catalog exporter prefers source-authored `food_type_tag`, then the structured taxonomy, then the legacy keyword fallback. Add or adjust entries with focused taxonomy tests; do not replace source-authored classifications.

## Chain Propagation

Use chain propagation only for **confirmed** `stall_brand_id` groups. The source outlet and every copied dish must be display-approved with `merchant_owned`, `operator_owned`, `permitted_api`, or `licensed` menu rights. A dish image is copied only when it is separately display-approved with one of those media rights; otherwise the cloned menu row has no image. The source must also have an official or verified source URL; a target must have no dishes and either no source URL yet or the same source domain. Always inspect the dry-run first:

```bash
node scripts/supabase-propagate-chain-menus.mjs --limit=5
```

Apply only the reviewed group(s), scoped by brand or source outlet:

```bash
node scripts/supabase-propagate-chain-menus.mjs \
  --brand-id=BRAND_UUID \
  --source-venue-id=VENUE_ID \
  --limit=1 \
  --apply
```

After an applied run, read back target dish counts and source URLs, then run the normal Supabase-to-Excel sync, workbook validation, catalog export, and verification logging. Do not propagate by normalized venue name alone or overwrite outlets that already have dishes.

## Supabase Health Gate

Before mutating Supabase, run a small read and, if needed, a one-row dry-run transaction with short timeouts. If even a single-row read hangs or returns statement timeout, treat Supabase as unhealthy.

| Supabase state | Action |
|---|---|
| Healthy | Apply reviewed writes to Supabase, then sync Supabase to Excel. |
| Slow but readable | Use small chunks, short `lock_timeout`, short `statement_timeout`, and verify each chunk. |
| Timing out | Do not mutate live tables. Update Excel with reviewed rows and generate `data/*_supabase_backfill_pending.sql`. |
| Unknown | Run read-only checks first; do not guess. |

Pending SQL should include only reviewed rows and should be applied later in small chunks with read-back verification.

## Required Logging

After each venue, record:

| Field | Example |
|---|---|
| Venue ID | `ven-SFA-SW14083L000` |
| Venue name | `Time Table Cafe` |
| Source URL | Grab/Oddle/official URL |
| Supabase dish count | `288` |
| Dishes with images | `264` |
| Dishes with prices | `288` |
| Dishes with descriptions | `260` |
| Logo status | Present / missing / rejected |
| Address status | Verified / unchanged / rejected |
| Excel validation | Pass/fail |
| App catalog result | Updated / unchanged / blocked |
| Blockers | Timeout, wrong outlet, missing source, etc. |

## Current Working Files

| File | Purpose |
|---|---|
| `scripts/auto-enrich-images.mjs` | Scrapes source menus, exports dry-run/live rows, supports offline workbook mode. |
| `scripts/sync_supabase_excel_master.py` | Syncs Supabase truth into the Excel master. |
| `scripts/validate_excel_workbook.py` | Validates workbook structure and data quality. |
| `scripts/export_excel_catalog_for_app.py` | Generates app-consumable catalog JSON from Excel. |
| `scripts/lib/platform-scrapers.mjs` | Shared Grab/Oddle/Foodpanda/Deliveroo menu adapters. |
| `scripts/lib/platform-resolvers.mjs` | Direct platform search/state URL resolvers. |
| `scripts/lib/venue-identity.mjs` | Weighted outlet identity scoring and decision bands. |
| `scripts/lib/enrichment-concurrency.mjs` | Bounded workers, serialized writes, and monotonic checkpoint helpers. |
| `scripts/discover-grab-menu-sources.mjs` | Batch Grab source candidate extraction and postal/name matching. |
| `scripts/classify_non_consumer_entities.py` | Dry-run-first non-consumer audit and cleaned-copy generator. |
| `scripts/dish_taxonomy.py` | Structured common-dish cuisine/taste lookup. |
| `scripts/run-scheduled-enrichment-review.mjs` | Secret-gated scheduled enrichment wrapper and redacted artifact logger. |
| `data/Hungry F&B Database.xlsx` | Local master workbook. |
| `src/lib/services/excel/excelCatalog.generated.json` | Generated app catalog; never edit manually. |
| `data/enrichment_checkpoint.json` | Batch scraper resume state for source-backed multi-venue runs. |
| `data/*_supabase_backfill_pending.sql` | Pending reviewed Supabase updates when live DB writes are blocked. |

## Excel-First Fallback

Use this path only when Supabase is unavailable or too slow.

| Step | Action |
|---:|---|
| 1 | Dry-run against the workbook using `--offline-workbook`. |
| 2 | Review proposed rows manually from the JSON export. |
| 3 | Apply only approved source-backed values to `data/Hungry F&B Database.xlsx`. |
| 4 | Generate pending SQL for the same reviewed rows. |
| 5 | Validate the workbook ZIP and data structure. |
| 6 | Regenerate the app catalog from Excel. |
| 7 | Mark Supabase as pending in verification notes. |

Do not describe Excel-only data as synced to Supabase until the pending SQL has been applied and read back.

## Pending SQL Management

Apply pending `data/*_supabase_backfill_pending.sql` files only after reviewing the venue and dish rows in the dry-run export or SQL file. Apply during a low-traffic window, read back affected venue/dish counts from Supabase, sync Supabase to Excel, validate the workbook, regenerate the app catalog, then delete or archive only the files that were successfully applied. Do not apply all pending files blindly from an audit summary.

## Final Verification Commands

```bash
node --check scripts/auto-enrich-images.mjs
python3 -m py_compile \
  scripts/sync_supabase_excel_master.py \
  scripts/export_excel_catalog_for_app.py \
  scripts/validate_excel_workbook.py
unzip -t 'data/Hungry F&B Database.xlsx'
python3 scripts/validate_excel_workbook.py \
  --workbook 'data/Hungry F&B Database.xlsx' \
  --limit 100
python3 scripts/export_excel_catalog_for_app.py \
  --workbook 'data/Hungry F&B Database.xlsx'
git diff --check -- \
  scripts/auto-enrich-images.mjs \
  'data/Hungry F&B Database.xlsx' \
  src/lib/services/excel/excelCatalog.generated.json \
  data/*_supabase_backfill_pending.sql \
  tasks/verification.md \
  tasks/session-log.md
```

## Prompt For Another Model

```text
Use /Users/Siew Hean/Documents/GitHub/Hungry/ops/playbooks/data-enrichment-model-runbook.md.

Process one venue only:
1. Pick one venue with a known menu source and missing images/descriptions.
2. Dry-run the scraper.
3. Inspect outlet identity, address, logo, menu items, prices, images, and descriptions.
4. If safe, live-run the scraper.
5. Read back Supabase counts and quality checks.
6. Sync Supabase to data/Hungry F&B Database.xlsx.
7. Validate the workbook opens and passes the validator.
8. Regenerate src/lib/services/excel/excelCatalog.generated.json.
9. Report only counts, files changed, verification, and blockers.

Do not batch venues. Do not invent data. Do not use placeholder images.
```

## Current Baseline Note

The workbook and Supabase counts change after each enrichment pass. Re-run the current audit before quoting totals. Treat any older counts as snapshots, not live truth.
