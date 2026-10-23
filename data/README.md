# Singapore Food Business Workbook

## Current SFA-backed Singapore F&B register

Use [singapore_fnb_verified.csv](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_fnb_verified.csv)
as the consolidated public-access list. Its official SFA identity, address,
business type, grade, and current-export membership fields are refreshed from the
SFA Track Records export. It excludes school and education-site stalls,
standalone/organisation canteens, caterers, kitchens, production and other
non-venue food operations, and records with unresolved public access. The
`public_access_status` field documents that inclusion is classified from SFA
type/address data, not confirmed by an on-site access check. Public food retail
and vending are retained unless the site appears restricted.

Refresh from the live SFA export (requires `openpyxl`):

```bash
python3 scripts/refresh_sfa_verified_fnb_catalog.py
```

The refresh preserves the source workbook under `data/source_snapshots/` and
writes [singapore_fnb_verified_audit.json](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_fnb_verified_audit.json)
with counts, exclusions, duplicate conflicts, and legacy enrichment coverage.
SFA licence listing is not proof that a premises is open today or permanently
closed. Old records that do not match this public-access list are excluded, but
are not asserted to be permanently closed. `singapore_fnb_verified_audit.json`
reports the public-access exclusions by reason.

Menu, opening-hour, rating, and other non-SFA fields are retained only as
`legacy_*` enrichment joined by exact licence number. Their source/date/status
columns disclose their age and provenance. Menus are not presented as freshly
verified: much of the existing menu content is generated fallback or older
third-party data, and should be refreshed from each operator's current public
menu before consumer use. The current SFA source does not publish menus.

Source: [SFA Track Records](https://www.sfa.gov.sg/tools-and-resources/track-records),
accessed date and source last-updated date are recorded in the audit JSON.
Attribution and reuse are subject to [SFA Terms of Use](https://www.sfa.gov.sg/terms-of-use).

## Enriched public-access F&B list

Use [singapore_fnb_public_access_enriched.csv](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_fnb_public_access_enriched.csv)
for the alphabetized list with the backup workbook's full 55-column venue data and
separately attributed Supabase venue fields. Rights-cleared, approved dish-level
records are in [singapore_fnb_public_access_approved_menu_items.csv](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_fnb_public_access_approved_menu_items.csv), keyed by `licence_number`.
The venue CSV includes menu item names and counts. This normalized menu file
preserves full dish details without oversized per-venue cells. The list preserves exactly the base
public-access SFA list; joins are limited to unique normalized exact licence
numbers, and duplicate licence groups are quarantined. The backup workbook fields
retain their `Last Verified Date` of 2026-04-04 and are historical enrichment, not
fresh verification. `Approved Menu Items` contains only Supabase dishes marked
approved for display with `permitted_api`, `operator_owned`, or `licensed` rights.
Per-record timestamps, rights, and match status are included. Review
[singapore_fnb_public_access_enriched_audit.json](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_fnb_public_access_enriched_audit.json)
for match coverage and field counts. Regenerate with:

```bash
python3 scripts/enrich_public_access_fnb_catalog.py
```

The workbook at [singapore_food_stalls.xlsx](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/singapore_food_stalls.xlsx) is the working Excel artifact for the Singapore food-business database.

## Official-site review-only scrape (2026-10-15)

Exploratory website menu, image-reference, and explicit closure-text reviews are
stored under `data/review_runs/official-menu-*20261015.json` and
`data/review_runs/official-media-closure-review-20261015.json`. The refresh
script supports `--refresh-review --public-access-csv ...`; it is review-only,
and the recorded batches used `apply=false` and updated zero workbook/catalogue
rows. Extracted text is a candidate requiring exact venue identity and menu
quality review. Website image URLs are unapproved references with
`permission_required`; no image asset was copied or approved. Do not use these
candidate reports as consumer catalogue data.

Google Place IDs may be retained, but Google Places photos/URIs must be fetched
fresh for display with required author attribution and a Google Maps source link;
they are not stored as catalogue image URLs. Website availability does not
grant image reuse rights. A closure phrase is only a review lead; no closure was
confirmed and no record was removed by this scrape. SFA listing absence alone
does not establish permanent closure. The reviewed sample is not a
Singapore-wide fresh verification.

## Refresh command

```bash
python3 -m pip install openpyxl
npm run data:enrich
```

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

## Singapore public-access refresh workbook — 2026-10-16

New consolidated, alphabetized workbook (original workbooks preserved):

- [Hungry F&B Database.Public Access 2026-10-16.xlsx](/Users/Siew%20Hean/Documents/GitHub/Hungry/data/Hungry%20F%26B%20Database.Public%20Access%202026-10-16.xlsx)
- Input: current SFA-backed 38,584-row public-access register and exact-licence enrichment; public access is type/address-classified, not proof of current operation.
- Fresh official-site checks: 2 exact venue/address matches (Almost Famous and Bar B Q Tonight), 105 item-name observations, contact/hours, and 83 image URL candidates. Prices stayed blank when the current official page did not provide an unambiguous item price.
- First-party operator snapshots: 11 operator source sets contribute 479 listed outlet rows and 246 exact SFA outlet joins. New verified sources add Jollibee (25 outlets/12 exact joins), Burger King (70/45, with source-published hours), Starbucks (141 brand-level menu items/140 official image URL candidates), and McDonald's (127 brand-level menu items/127 official image URL candidates), and MOS Burger (29 outlets/25 exact joins; 59 brand-level menu items, 58 with published prices). Existing BreadTalk, Old Chang Kee, Boost Juice, Ya Kun, KOI Thé, and LiHO observations retain their source and branch-scope limits. Across the workbook there are 461 brand-level menu items (67 with published price ranges); branch availability is unconfirmed unless an exact outlet record says otherwise. Menu items remain separate from individual outlet menu fields.
- The main outlet-level `Menu` fields contain only the 2 current exact-venue menu observations (105 item-name observations). The 461 chain product/menu names remain on `Official Operator Menu` with `branch_availability_confirmed=false`; they are not copied into individual outlet menu fields.
- Image references: 470 first-party operator item/group candidates plus 83 exact-venue official-page candidates (553 total). All are display-unapproved and visually unchecked; rights are marked permission-required or permission-required-candidate. None are represented as confirmed stall photos. Seven OSM image references are separately retained with rights flags; 5,694 NEA matches are explicitly centre-context photo URLs only. No image files were downloaded.
- OpenStreetMap (OSM): 132 strict one-to-one matches from the 2026-10-14 Geofabrik extract require exact normalized name/brand and postal code, with exact unit when present or exact street/house when both units are absent. An additional 694 tier-2 one-to-one matches require unique exact normalized name + postal code but have incomplete unit/address evidence; these are labelled separately and only fill main coordinates when stronger operator/HPB coordinate evidence is absent. The combined 826 matches have 474 opening-hour, 310 phone, 375 website, 19 menu-URL, and 562 cuisine values. The main sheet has 1,307 coordinate pairs, 693 opening-hours values, 432 contacts, 375 websites, 563 cuisine values, 19 menu URLs, and 2 exact-venue menus; ratings and active stall/dish images remain blank where no permitted venue-level source was verified. See `OSM F&B Matches`, `osm_match_confidence_tier`, and `osm_*` columns. OSM tags can be stale and do not verify current operation. Attribution: © OpenStreetMap contributors, [OpenStreetMap copyright](https://www.openstreetmap.org/copyright); ODbL 1.0 and share-alike obligations apply when publicly used. Rebuild snapshots with `python3 scripts/build_osm_fnb_snapshot.py --pbf <file> --dataset-date YYYY-MM-DD --source-url <exact-url> --json-out <json-path> --csv-out <csv-path>`; PyOsmium is required and no service/API fee is involved.
- NEA Hawker Centres (GEOJSON): live snapshot retrieved from data.gov.sg on 2026-10-16; source metadata last updated 2026-10-15; 129 centres, 111 photo URLs, exact postal-code matches to 5,694 venue rows. NEA's 2026 cleaning schedule was re-fetched on 2026-10-16 (123 rows, unchanged from the prior snapshot; dataset last updated 2026-09-21) with 5,500 exact centre-to-venue schedule associations. Centre photos/coordinates and cleaning dates are labelled as centre context and are not attributed to individual stalls. Attribution and the current Singapore Open Data Licence link are on the workbook Read Me sheet; underlying photo rights remain unverified.
- Historical menu candidates: 509 source-linked rows from operator-owned/licensed status flags. Their menu observation dates are unknown; database `updated_at` is not treated as source freshness. Existing media URLs have no per-asset source URL and are omitted. Delivery-platform menus/media and the now-unavailable legacy data.gov menu source are excluded from the workbook. The `Legacy Menu Source Audit` sheet shows aggregate counts and exclusion reasons without copying platform item content.
- Google ratings/review counts and cached Google photo metadata were cleared because current reusable-source proof was absent. Non-placeholder Place IDs may remain as identifiers. Google Places photo names cannot be cached and must be fetched live; Places API use is pay-as-you-go, so no Google photo API calls were made under the zero-spend constraint ([photo policy](https://developers.google.com/maps/documentation/places/web-service/place-photos), [usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing/)). Coordinates now come only from exact official outlet matches, address-point matches, and the separately labelled OSM match tiers; unmatched venue-level ratings and images remain blank.
- Grab, foodpanda, and Oddle were rechecked for public feeds and reuse terms on 2026-10-16. No free, explicitly authorized public islandwide catalogue feed or republication licence was found. Oddle's [Acceptable Use Policy](https://docs.oddle.me/general/acceptable-use-policy/) prohibits scraping and database storage without prior written consent; Grab's relevant robots endpoints returned 403 and its terms do not grant downstream reuse; foodpanda pages expose menus but its terms reserve content reuse rights. Platform listing/menu/image content was not copied. Public pages may be retained as manual verification leads, but content requires the applicable permissions.
- No paid APIs/services were used. The SFA Track Records export was refreshed on 2026-10-16 and matched the 2026-10-15 licence/name/address set exactly. Permanent closure verification remains a sample only; no venue is removed without explicit closure evidence. 38,582 records remain without a fresh exact-venue menu observation; SFA current licence status is not proof of current physical operation.


### Catalogue-linked website review — 2026-10-16

The workbook now includes five separate review-only tabs: `Linked Website Review`, `Linked Website Menu Candidates`, `Linked Website Image Candidates`, `Linked Website Closure Review`, and `Linked Website Crawl Notes`. The live crawl reviewed 294 website URLs tagged in the 2026-10-14 OSM snapshot and joined them to SFA records with the original OSM match tier retained. It extracted 507 menu-text candidates and 2,682 deduplicated image URL/page references. These pages are not independently confirmed as official venue sites, and the site-to-outlet, menu-to-branch, and image-to-venue associations remain unverified. Candidate rows therefore do not populate active menu or image fields; image rows are `permission_required`, `display_approved=false`, and `visual_content_checked=false`. No image binaries were copied.

The closure scan fetched 294 catalogue-linked records; 259 pages were checked, 109 page requests were blocked by robots/access rules, and 130 records had no checked page. No explicit permanent or temporary closure signals were detected in checked text. This is not proof that a venue remains open, and no outlet was deleted on this basis. Grab/foodpanda/Oddle menu/media content was not copied because free islandwide reuse permission was not established; manual platform checks may be used as verification leads subject to each platform's terms. No paid APIs/services were used. Review JSON snapshots are retained under `data/review_runs/`.
