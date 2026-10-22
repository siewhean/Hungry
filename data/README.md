### Latest installed refresh: Refresh138 (2026-10-19; independent QA passed with limitations)

The single canonical workbook is [Hungry F&B Database.Public Access 2026-10-17 Verified Menu Catalogue Refresh 40.xlsx](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/Hungry%20F%26B%20Database.Public%20Access%202026-10-17%20Verified%20Menu%20Catalogue%20Refresh%2040.xlsx), SHA-256 `e2b0a7e63ab806176f9476b6c79e00c9f9233d1918f023f39c1aa59031fa4583`. It was updated in place; no new catalogue workbook was created. Refresh138 adds 99 exact-source Subway fields (19 branch phone numbers, 79 Singapore brand website links, one menu URL), two exact-unit Malaysia Boleh! names, 55 menu rows, and three official Makan Prata menu-image candidates marked review-only. The menu rows comprise 19 Foodpanda delivery-only prices, 16 Jollibee official brand-level items, and 20 Saizeriya official brand-level items. Brand-level outlet availability is explicitly unconfirmed; delivery prices are not dine-in prices.

Current coverage: 38,273 unique SFA licence records; 14,325 menu rows; 2,770 image candidates, of which two directory images are approved for display; 32,817 named records (5,456 blank); 35,737 coordinate pairs (2,536 missing); 2,776 contacts; 2,947 websites; 1,531 menu URLs; 1,553 opening-hour values; 541 menu summaries; and zero rating/review-count values. Integration evidence is in `data/source_snapshots/refresh138_integration_20261019.json`; independent QA is pending in `data/source_snapshots/refresh138_final_qa_20261019.json`.

The three new image URLs point to tiny official menu thumbnails. Their visual content has not been checked and reuse permission is not established, so they are not approved for display. No closure was removed: Burger King at Kallang Leisure Park remains unresolved because the operator’s “Closed” schedule conflicts with the current mall tenant page. No new coordinates qualified in the free-source recheck; OneMap’s token was absent in the executing shell. No paid service or Mapbox request was used for Refresh138. Independent QA result: `PASS_WITH_LIMITATIONS` in `data/source_snapshots/refresh138_final_qa_20261019.json`.

Remaining gaps: 5,456 unnamed records; 2,536 missing coordinates; 35,497 missing contacts; 35,326 missing websites; 36,742 missing menu URLs; 36,720 missing hours; no rating/review-count values; and current branch-specific menu data for most records. Nationwide verification and population remain in progress.

### Previous refreshes

Refresh121 added seven exact names, five Foodpanda branch menu links and delivery-price summaries, 24 delivery-listed menu items, and refreshed one stale Song Fa JEM price with the prior source preserved. It passed independent QA at SHA `e75b32a39d9840532afbff2f5b497cc7a3a12870097418716f7d0b92f503f84f`; see `refresh121_integration_20261019.json` and `refresh121_final_qa_20261019.json`. Refresh120/119 history and evidence remain in their corresponding integration and QA snapshots.

## Refresh command

```bash
python3 -m pip install openpyxl
npm run data:enrich
```

## Free public-source harvest (proposal-only)

Use `npm run data:harvest:public -- --help` to inspect the bounded extractor at
`scripts/harvest_public_fnb_sources.py`. It reads the canonical workbook and
visits only its existing HTTPS website/menu URLs or URLs explicitly mapped to
an exact SFA licence in a JSON source map, and only when that exact host is in
a reviewed host-policy file documenting collection/retention permission. It checks `robots.txt`, pauses at
least three seconds per host, caps the run at 50 requests by default (including
robots checks), and writes field/menu/image candidates plus a run receipt under
`data/source_snapshots/`. It never writes to the workbook, Supabase, or any
other database. Run repeated batches with `--limit` and `--offset` after
reviewing each receipt.

Example:

```bash
npm run data:harvest:public -- --host-policy=PATH_TO_REVIEWED_HOST_POLICY.json --limit=25 --max-requests=50
```

Copy `scripts/templates/public_fnb_host_policy.example.json` and replace its
placeholder only after reviewing that host's collection/retention terms and
confirming it is an ordinary public official website or open dataset with no
per-request fee. Each entry must record `source_class` (`official_website` or
`open_dataset`), `no_request_fee: true`, a written `no_cost_basis`,
`collection_permitted: true`, a terms/license URL, permission basis, and review
date. The no-fee value is a reviewed operator attestation, not a billing API
check; only add hosts whose costs you have independently confirmed are zero.
Host matching is exact and cross-host redirects are blocked. An explicit
source map is a JSON object keyed by exact SFA licence,
for example `{"CE12345A000": ["https://merchant.example.com/menu"]}`. Add
URLs only from permitted first-party pages or appropriately licensed open datasets. The
extractor blocks Google/Maps, Grab, foodpanda, Oddle, Deliveroo, Mapbox, and
OneMap domains; it makes no Google Places, Mapbox, or OneMap API calls and does not scrape
search results. The current Google and marketplace sources do not provide a
generally reusable, guaranteed no-cost basis for persistent catalogue
harvesting. Public-sector/open datasets should carry their required attribution
and dataset-specific terms. Image URLs remain review-only unless reuse rights
are established. Policy references: [Google Places API policy](https://developers.google.com/maps/documentation/places/web-service/policies),
[Grab Singapore terms](https://www.grab.com/sg/terms-policies/transport-delivery-logistics/),
[foodpanda Singapore terms](https://www.foodpanda.sg/contents/terms-and-conditions.htm),
[Singapore Open Data Licence](https://developers.data.gov.sg/open-data-licence), and
[OpenStreetMap Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).
See also `data/source_snapshots/partner_platform_permission_audit_refresh112_20261018.md`.

## Supabase staging import

Generate a staging-only SQL import for the canonical CSV:

```bash
npm run data:supabase:stage:canonical
```

The generated SQL is written to `/tmp/hungry-canonical-food-business-staging.sql`.
It creates/updates one `import_runs` row, loads `staging_food_businesses`, writes
validation issues to `staging_import_errors`, and does not mutate production
`buildings`, `venues`, `dishes`, or media tables.

For linked Supabase CLI imports where the single SQL file is too large for the
management API, generate smaller sequential SQL chunks and apply them:

```bash
npm run data:supabase:stage:canonical:split
npm run data:supabase:stage:canonical:apply-sql-chunks
npm run smoke:supabase-canonical-food-business-staging -- --require-network
```

To write directly to a Supabase staging project through service-role REST, set
`HUNGRY_SUPABASE_IMPORT_URL`, `HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY`,
`HUNGRY_SUPABASE_IMPORT_PROJECT_REF`, and `HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1`,
then run:

```bash
npm run data:supabase:stage:canonical:apply
npm run smoke:supabase-canonical-food-business-staging
```

## What the pipeline does

- preserves the workbook path and regenerates the three sheets in place
- merges the checked-in curated seed snapshot with any current workbook edits on the same `Stall ID`
- merges in official SFA eating-establishment and grading data from data.gov.sg
- enriches existing rows and adds net-new hawker stall candidates from the public [WhyQ Corporate Catering](https://www.whyq.sg/corporate-catering) catalogue when a usable location anchor can be inferred
- enriches existing rows and adds net-new food-court stall candidates from the official [Food Republic outlet pages](https://foodrepublic.com.sg/food-republic-outlets/)
- refreshes the hawker-centre reference sheet from the official NEA dataset
- exports a canonical CSV at [singapore_food_businesses_canonical.csv](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_food_businesses_canonical.csv)
- preserves the original curated menu, price, and opening-hours fields via
  [singapore_food_stalls_seed_curated.csv](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_food_stalls_seed_curated.csv)

## Source datasets

- [SFA Eating Establishments](https://data.gov.sg/datasets/d_1f0313499a17075d13aae6ed3e825bc6/view)
- [SFA Certificate Grading Info of Licensed Eating Establishments](https://data.gov.sg/datasets/d_546a95c5e6a0a264a82247ec107a0629/view)
- [NEA Dates of Hawker Centres Closure](https://data.gov.sg/datasets/d_bda4baa634dd1cc7a6c7cad5f19e2d68/view)
- [WhyQ Corporate Catering stall catalogue](https://www.whyq.sg/corporate-catering)
- [Food Republic outlet pages](https://foodrepublic.com.sg/food-republic-outlets/)

## Dual-account quota pin automation

Keep Places `SearchTextRequest per minute` pinned until both primary and backup keys reach ceiling behavior:

```bash
npm run data:quota:pin:both -- --duration-s 75 --concurrency 20 --target-per-minute 600 --max-cycles 20
```

Behavior:

- reads `GOOGLE_MAPS_ENRICHMENT_API_KEY` and `GOOGLE_MAPS_ENRICHMENT_API_KEY_BACKUP` from `.env.local`
- runs repeated saturation windows for each key
- exits only when both accounts hit ceiling behavior (`429` observed or sustained near-full successful volume)
