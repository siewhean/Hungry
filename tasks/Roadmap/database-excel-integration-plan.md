# Hungry — Database & Excel Integration Plan

> Date: 2026-06-06
> Auditor: Independent — evidence from direct code inspection
> Source input: `data/Hungry F&B Database.xlsx`, repo branch `frontend-design-overhaul`

## Implementation Update — 2026-06-06

Source implementation completed for the first database/Excel integration pass:

| Area | Status | Evidence |
|---|---|---|
| Excel-ready schema | ✅ Complete in source | `supabase/migrations/20260606120000_database_excel_integration_foundation.sql` extends `buildings`, `venues`, `dishes`, and `staging_food_businesses`; adds `areas` and `venue_images`; seeds Singapore areas including Pioneer, Jurong East, Jurong West, and Tampines |
| Excel validation/import tooling | ✅ Complete in source | `scripts/validate_excel_workbook.py` and `scripts/import_excel_to_supabase.py` validate the workbook and stage valid rows into import tables only |
| Live Discover feed RPCs | ✅ Complete in source | `get_discovery_feed_by_location`, `search_venues_by_location`, and extended `search_dishes` are defined and granted to app clients |
| App discovery wiring | ✅ Complete in source | `DiscoverHomeScreen` now reads live Supabase discovery feed rows when Supabase mode is active; empty live results stay empty instead of silently showing local repository content |
| Smoke/source contracts | ✅ Complete in source | `supabase/smoke/database_excel_integration.sql`, `scripts/smoke_location_queries.mjs`, `scripts/smoke_search_queries.mjs`, `scripts/smoke_rls.mjs`, and `src/lib/services/supabase/database-excel-integration.test.ts` |
| Package/env wiring | ✅ Complete | `package.json` has Excel/smoke scripts; `.env.example` has import-only Supabase service-role variables |
| Live 35k-row staging apply | ⚠️ Pending | This pass did not mutate the linked Supabase project; run staging apply after migration is applied |
| Production promotion from staging | ❌ Deferred | No promotion script yet; staging-only import remains the safe first pass |

Local verification run:

- `PYTHONPYCACHEPREFIX=/tmp/hungry-pycache python3 -m py_compile scripts/validate_excel_workbook.py scripts/import_excel_to_supabase.py` — pass
- `python3 scripts/validate_excel_workbook.py --limit 100 --allow-row-errors` — pass, 100 valid rows
- `python3 scripts/import_excel_to_supabase.py --limit 25 --output /tmp/hungry-excel-food-business-staging-sample.sql` — pass, 25 staged rows generated, not applied
- `node --check scripts/smoke_location_queries.mjs`, `node --check scripts/smoke_search_queries.mjs`, `node --check scripts/smoke_rls.mjs` — pass
- `node --import tsx --test src/lib/services/supabase/database-excel-integration.test.ts` — pass 6/6
- `node --import tsx --test src/lib/services/supabase/server-side-discovery.test.ts` — pass 6/6 after updating the `search_dishes` smoke signature
- `node node_modules/typescript/bin/tsc --noEmit` — pass
- `node scripts/run-eslint.cjs <touched TS files>` — pass
- `git diff --check -- <touched integration files>` — pass

QA/QC follow-up fixes applied:

- Preserved `mall` in the `buildings.building_type` constraint.
- Supabase Discover mode no longer falls back to local repository content when the live feed is empty.
- `database_excel_integration.sql` now raises an exception when required checks fail.
- Guarded live importer apply now marks runs `running` first and only marks `completed` after all batches insert; failures are marked `failed`.
- RLS readiness language now distinguishes source coverage from live staging proof.

---

## 1. Excel Workbook Analysis

### Sheets

| Sheet | Purpose | Row count | Import target |
|---|---|---:|---|
| `Sheet1` | Canonical Singapore F&B business directory | 35,909 data rows | Primary — staged import into `staging_food_businesses`, promote to `buildings` / `venues` / `dishes` |
| `Staging_High_Confidence` | Google Places enrichment scoring (rejected/accepted candidates) | 800 data rows | Reference only — do not import, already consumed by enrichment scripts |

### Sheet1 — Columns (52 total)

| # | Column | Meaning | Null % | Import target | Transform |
|---|---|---|---:|---|---|
| 0 | Business ID | SFA-assigned stable ID | 0% | `venues.id` (as slug prefix) or external ref | Keep as-is |
| 1 | Stall ID | Sub-stall ID (rarely set) | 99.6% | `venues` metadata | Optional |
| 2 | Licence No | SFA licence number | 0% | `staging_food_businesses.licence_no` | — |
| 3 | Stall / Restaurant Name | Display name | 0% | `venues.name` | Titlecase clean |
| 4 | Business Name Normalized | Lowercase canonical | 0% | `venues` dedup key | — |
| 5 | Stall Type | Category (8 types) | 0% | `buildings.building_type` / `venues` metadata | Map enum |
| 6 | Cuisine | Comma-separated tags | 98.8% | `venues.cuisine_tags` (missing field) | Parse CSV |
| 7 | Signature Dish | One-line dish | 78.1% | `dishes.name` (seed) | — |
| 8 | Menu | Free text | — | `staging_menu_items.item_name` | Parse |
| 9 | Price | Free text price range | 98.8% | `dishes.price_range` | — |
| 10 | Price Min (SGD) | Numeric floor | 98.8% | `dishes.price` | — |
| 11 | Price Max (SGD) | Numeric ceiling | 98.8% | `dishes.price_range` | — |
| 12 | Opening Hours | Text hours | — | `venues.operating_hours` | — |
| 13 | Closed Days | Text | — | `venues` metadata | — |
| 14 | NEA Hygiene Grade | A/B/C/D | — | `venues.hygiene_grade` | — |
| 15 | Michelin Recognition | Text | — | `venues` metadata | — |
| 16 | Dietary Options | Text | — | `venues.dietary_tags` (missing field) | Parse |
| 17 | Delivery Platforms | Text | — | `venue_delivery_links` | Parse |
| 18 | Contact | Phone | — | `venues` metadata | — |
| 19 | Instagram | URL | — | `venues` metadata | — |
| 20 | Image URL | Photo | — | `venues.image_url` (missing field) | — |
| 21 | Hawker Centre / Building | Display name | 78.3% | `buildings.name` dedup | — |
| 22 | Building Name | Canonical name | 78.3% | `buildings.name` | — |
| 23 | Unit No. | Unit number | 30.2% | `venues.unit_number` | — |
| 24 | Address | Street address | 0.1% | `buildings.address` (missing field) | — |
| 25 | Postal Code | 6-digit postal | 0.1% | `buildings.postal_code` (missing field) | Zero-pad |
| 26 | Region | Central/East/West/etc | 97.0% | `buildings.region` / `areas.name` | Map |
| 27 | Location | Full location string | 0% | Dedup key | — |
| 28 | Location Key | Normalised key | 0% | Dedup hash | — |
| 29 | Latitude | WGS84 lat | 0.4% | `buildings.latitude` | — |
| 30 | Longitude | WGS84 lng | 0.4% | `buildings.longitude` | — |
| 31 | Source Type | Data source label | 0% | `external_sources.slug` | Map |
| 32 | Source URL | Source page | — | `import_runs.metadata` | — |
| 33 | Last Verified Date | Date | — | `venues.last_verified_at` (missing field) | — |
| 34 | Coverage Status | Partial/Complete | 0% | `venues.source_confidence` modifier | Map |
| 35 | Notes | Free text | — | `staging_food_businesses.notes` | — |
| 36–48 | Google* | Enrichment data | 97.3% null | `venues` / `buildings` enrichment | Conditional |
| 49 | Google Photo Last Refreshed | Date | — | metadata | — |
| 50 | Menu Source | Source label | — | `staging_menu_items` | — |
| 51 | Menu Items | CSV dish names | 79.3% | `staging_menu_items.item_name` | Parse CSV |

### Data Quality Issues

| Issue | Count | Severity |
|---|---|:---:|
| Cuisine missing | 35,474 / 35,909 (98.8%) | **High** |
| Region missing | 34,815 / 35,909 (97.0%) | **High** — infer from PostGIS |
| Menu items missing | 28,463 (79.3%) | Medium |
| Signature dish missing | 28,028 (78.1%) | Medium |
| Building name missing | 28,102 (78.3%) | Medium — standalone stalls expected |
| Price missing | 35,474 (98.8%) | Medium |
| Google enrichment | only 976 rows (2.7%) | Low |
| Lat/lng missing | 132 rows (0.4%) | **High for missing rows** — skip those rows |
| Coverage: `Complete` | only 57 rows (0.2%) | All others are `Partial` |
| Duplicate Business IDs | Not checked — will verify in import | — |

### Stall Type Distribution

| Type | Count | % |
|---|---:|---:|
| Restaurant | 20,348 | 56.7% |
| Chain Outlet | 10,945 | 30.5% |
| Cafe | 2,836 | 7.9% |
| Bar / Bistro | 978 | 2.7% |
| Hawker Stall | 425 | 1.2% |
| Food Court Stall | 318 | 0.9% |
| Other | 54 | 0.2% |
| Zi Char | 5 | <0.1% |

> **Key finding:** 35,909 rows represent F&B businesses, not just hawker stalls. The majority are restaurants and chain outlets. Only 1.2% are traditional hawker stalls. The building type enum in the current schema (`hawker_centre`, `food_court`, `restaurant`, `mixed_development`) is too narrow for this dataset.

---

## 2. Current Database Schema — Gap Analysis

### Existing Tables (confirmed via migrations)

| Table | Status | Notes |
|---|---|---|
| `buildings` | ✅ Exists | Missing: `address`, `postal_code`, `region`, `source_type`, `source_confidence`, `updated_at`, `image_url` |
| `venues` | ✅ Exists | Missing: `cuisine_tags`, `dietary_tags`, `image_url`, `last_verified_at`, `updated_at`, `source_type`, `source_confidence`, `address`, `postal_code`, `latitude`, `longitude`, `location geography` |
| `dishes` | ✅ Exists | Missing: `cuisine_tags`, `source_type`, `source_confidence`, `is_featured`, `updated_at` |
| `dietary_flags` | ✅ Exists (lookup) | Seeded: halal, vegetarian, pork_free, allium_free |
| `dish_dietary_flags` | ✅ Exists | OK |
| `staging_food_businesses` | ✅ Exists | Extended by `0043_canonical_food_business_staging.sql` with all Excel columns |
| `staging_menu_items` | ✅ Exists | OK |
| `import_runs` | ✅ Exists | OK |
| `external_sources` | ✅ Exists | OK |
| `areas` (planning areas) | ❌ **MISSING** | No planning area table exists |
| `venue_cuisine_tags` | ❌ **MISSING** | Cuisine stored as free text, not normalized |
| `venue_images` | ❌ **MISSING** | No gallery table for venues |

### Current `buildings` Schema — Gaps

```
CURRENT: id, slug, name, building_type, latitude, longitude, location (geography), floors[], venue_count, is_closed_today, hero_dish_id, created_at

MISSING:
  address             text        -- from Excel col 24
  postal_code         text        -- from Excel col 25
  region              text        -- from Excel col 26
  planning_area       text        -- derived from PostGIS / OneMap
  source_type         text        -- SFA, NEA, Google, manual
  source_confidence   numeric
  image_url           text        -- venue/building photo
  updated_at          timestamptz
```

### Current `venues` Schema — Gaps

```
CURRENT: id, building_id, name, unit_number, floor, hygiene_grade, is_open, top_dish_id, operating_hours, closure_notice, live_crowd, created_at

MISSING:
  cuisine_tags        text[]      -- from Excel col 6
  dietary_tags        text[]      -- from Excel col 16
  image_url           text        -- from Excel col 20
  latitude            double      -- own coords (standalone venues without building)
  longitude           double
  location            geography   -- standalone venue location
  address             text        -- for standalone venues
  postal_code         text        -- for standalone venues
  planning_area       text        -- resolved area name
  source_type         text
  source_confidence   numeric
  last_verified_at    date
  updated_at          timestamptz
  google_place_id     text        -- from Excel col 36
  google_rating       numeric     -- from Excel col 43
  google_review_count integer     -- from Excel col 44
```

### Current `dishes` Schema — Gaps

```
CURRENT: id, venue_id, building_id, name, description, image_url, blurhash, distance_meters, rating_avg, review_count, price, price_range, live_crowd, taste_tags, must_order, availability_flags, created_at

MISSING:
  cuisine_tags        text[]      -- derived from venue or explicit
  is_featured         boolean     -- for featured dish surfaces
  source_type         text
  source_confidence   numeric
  updated_at          timestamptz
```

---

## 3. Location Architecture — Gap Analysis

### Current State

The app uses a **hardcoded** geo lookup file: `src/lib/geo/singaporeBuildings.ts` (776 lines), which contains:
- ~30 area anchors (Jurong West, Jurong East, Tampines, Orchard, etc.) with lat/lng centroids
- ~100+ hardcoded Singapore buildings (hawker centres, food courts) with coordinates
- `getNearestBuildings(lat, lng, count, radiusKm)` — pure in-memory search
- `getNearestSingaporeArea(lat, lng)` — finds nearest area by Euclidean distance

### What This Means

- `DiscoverHomeScreen` uses `getNearestBuildings()` from the hardcoded file, not from Supabase
- Supabase `buildings` table is used **only** for `count_venues_in_area()` — a single integer count displayed in the Discover header
- All discover/search content in Supabase mode reads from `search_dishes()` RPC which uses **lat/lng radius** — no concept of named area (e.g. "Jurong East")
- The `search_dishes()` RPC has no `p_area_name` parameter — area filtering is purely PostGIS distance
- The `count_venues_in_area()` RPC exists but the main content still falls back to the mock repository's data because the discover page calls `repository.listVenuesByBuilding()` using hardcoded building IDs

### Location Requirement Assessment

| Requirement | Current Support | Gap |
|---|---|---|
| Named area lookup (e.g. Jurong East) | ✅ Hardcoded anchors in geo file | No DB table; breaks for real data |
| Planning area derivation from lat/lng | ✅ Hardcoded anchors (approximate) | Not accurate for all 35k rows; OneMap API needed |
| Lat/lng for buildings | ✅ `buildings.location` (PostGIS geography) | Only 4 buildings in seed data |
| Lat/lng for standalone venues | ❌ Missing | Venues don't have their own coordinates |
| Postal code | ❌ Missing from `buildings` | Excel has it |
| Address | ❌ Missing from `buildings` | Excel has it |
| Location-aware discovery | ⚠️ Partial | `count_venues_in_area` works; content delivery still hits mock repo |
| Discover feed from Supabase | ❌ **Not connected** | Discover loads from `repository.listVenuesByBuilding()` with hardcoded IDs |
| Search from Supabase | ✅ Partial | `searchDishesViaRpc()` exists and is called in Supabase mode |
| Dish detail from Supabase | ✅ `get_dish_detail()` RPC exists | — |
| Stall detail from Supabase | ✅ `get_venue_detail()` RPC exists | — |

---

## 4. App Screen Integration — Current State

| Screen | Current data source (Supabase mode) | Should use | Gap |
|---|---|---|---|
| Discover Home | `repository.listVenuesByBuilding(hardcodedId)` + `repository.listDishesByVenue()` | `search_dishes()` RPC by lat/lng + Supabase venue feed | **Critical** — hardcoded building IDs return 0 results against real Supabase |
| Discover — Area Count | `count_venues_in_area()` RPC | Same | ✅ OK |
| Discover — "Decide For Me" | `repository.getDecideForMe()` | `search_dishes()` RPC with taste vector | Gap |
| Search Results | `searchDishesViaRpc()` RPC | Same | ✅ OK |
| Dish Detail | `getDishDetailViaRpc()` or `getDishById()` | `get_dish_detail()` RPC | ✅ OK |
| Stall Detail | `getVenueDetailViaRpc()` or `getVenueById()` | `get_venue_detail()` RPC | ✅ OK |
| Map (HomeMapScreen) | `getNearestBuildings()` hardcoded geo file | Real building lat/lngs from Supabase | Gap |
| Quick Bites | `repository.searchDishes()` (mock) | `search_dishes()` RPC | Gap |

**Critical finding:** In Supabase mode, `DiscoverHomeScreen` still calls `getDataRepository().listVenuesByBuilding(building.id)` where `building.id` comes from `getNearestBuildings()` which returns hardcoded IDs like `"building-maxwell"`. These IDs exist in the seed but not in the real Excel data, so the Discover screen returns **empty content** when connected to a real Supabase instance populated from Excel.

---

## 5. Implementation Plan — Phased

---

### Phase 0 — Schema Migrations (prerequisite for all phases)

**Goal:** Add missing fields to `buildings`, `venues`, `dishes` so the Excel data can be stored without loss.

#### Migration A: Extend `buildings` table

```sql
-- supabase/migrations/YYYYMMDD_extend_buildings_for_excel.sql

alter table buildings
  add column if not exists address             text,
  add column if not exists postal_code         text,
  add column if not exists region              text,
  add column if not exists planning_area       text,
  add column if not exists business_id         text unique,  -- SFA Business ID
  add column if not exists licence_no          text,
  add column if not exists source_type         text not null default 'manual',
  add column if not exists source_confidence   numeric(4,3) not null default 0.500,
  add column if not exists image_url           text,
  add column if not exists updated_at          timestamptz not null default now();

-- extend building_type enum to cover restaurants and chain outlets
alter table buildings
  drop constraint if exists buildings_building_type_check;
alter table buildings
  add constraint buildings_building_type_check
  check (building_type in (
    'hawker_centre', 'food_court', 'restaurant', 'mixed_development',
    'cafe', 'bar_bistro', 'chain_outlet', 'standalone', 'kopitiam', 'other'
  ));

create index if not exists idx_buildings_postal_code on buildings(postal_code) where postal_code is not null;
create index if not exists idx_buildings_planning_area on buildings(planning_area) where planning_area is not null;
create index if not exists idx_buildings_business_id on buildings(business_id) where business_id is not null;
create index if not exists idx_buildings_name_trgm on buildings using gin (name gin_trgm_ops);
```

#### Migration B: Extend `venues` table

```sql
-- supabase/migrations/YYYYMMDD_extend_venues_for_excel.sql

alter table venues
  add column if not exists cuisine_tags        text[]      not null default '{}',
  add column if not exists dietary_tags        text[]      not null default '{}',
  add column if not exists image_url           text,
  add column if not exists latitude            double precision,
  add column if not exists longitude           double precision,
  add column if not exists location            geography(point, 4326)
    generated always as (
      case when latitude is null or longitude is null then null
      else st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
      end
    ) stored,
  add column if not exists address             text,
  add column if not exists postal_code         text,
  add column if not exists planning_area       text,
  add column if not exists google_place_id     text,
  add column if not exists google_rating       numeric(3,1),
  add column if not exists google_review_count integer,
  add column if not exists source_type         text not null default 'manual',
  add column if not exists source_confidence   numeric(4,3) not null default 0.500,
  add column if not exists last_verified_at    date,
  add column if not exists updated_at          timestamptz not null default now();

create index if not exists idx_venues_location on venues using gist (location) where location is not null;
create index if not exists idx_venues_planning_area on venues(planning_area) where planning_area is not null;
create index if not exists idx_venues_cuisine_tags on venues using gin (cuisine_tags);
create index if not exists idx_venues_name_trgm on venues using gin (name gin_trgm_ops);
create index if not exists idx_venues_postal_code on venues(postal_code) where postal_code is not null;
```

#### Migration C: Extend `dishes` table

```sql
-- supabase/migrations/YYYYMMDD_extend_dishes_for_excel.sql

alter table dishes
  add column if not exists cuisine_tags        text[]      not null default '{}',
  add column if not exists is_featured         boolean     not null default false,
  add column if not exists source_type         text        not null default 'manual',
  add column if not exists source_confidence   numeric(4,3) not null default 0.500,
  add column if not exists updated_at          timestamptz not null default now();

create index if not exists idx_dishes_cuisine_tags on dishes using gin (cuisine_tags);
create index if not exists idx_dishes_is_featured on dishes(is_featured) where is_featured = true;
```

#### Migration D: Add `areas` table

```sql
-- supabase/migrations/YYYYMMDD_areas_planning_table.sql

create table if not exists areas (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null unique,
  name_normalized text       not null unique,
  region         text,
  center_lat     double precision,
  center_lng     double precision,
  center_location geography(point, 4326)
    generated always as (
      case when center_lat is null or center_lng is null then null
      else st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography
      end
    ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_areas_name_normalized on areas(name_normalized);
create index if not exists idx_areas_center_location on areas using gist (center_location)
  where center_location is not null;

-- Seed Singapore planning areas
insert into areas (name, name_normalized, region, center_lat, center_lng) values
  ('Jurong East',      'jurong east',      'West',     1.3331, 103.7437),
  ('Jurong West',      'jurong west',      'West',     1.3404, 103.7066),
  ('Tampines',         'tampines',         'East',     1.3526, 103.9448),
  ('Bedok',            'bedok',            'East',     1.3236, 103.9273),
  ('Woodlands',        'woodlands',        'North',    1.4382, 103.7891),
  ('Yishun',           'yishun',           'North',    1.4300, 103.8350),
  ('Ang Mo Kio',       'ang mo kio',       'North-East', 1.3691, 103.8454),
  ('Hougang',          'hougang',          'North-East', 1.3612, 103.8863),
  ('Sengkang',         'sengkang',         'North-East', 1.3868, 103.8914),
  ('Punggol',          'punggol',          'North-East', 1.3984, 103.9072),
  ('Bukit Batok',      'bukit batok',      'West',     1.3490, 103.7490),
  ('Clementi',         'clementi',         'West',     1.3150, 103.7650),
  ('Queenstown',       'queenstown',       'Central',  1.2943, 103.7861),
  ('Toa Payoh',        'toa payoh',        'Central',  1.3343, 103.8470),
  ('Bishan',           'bishan',           'Central',  1.3526, 103.8352),
  ('Novena',           'novena',           'Central',  1.3200, 103.8438),
  ('Bukit Timah',      'bukit timah',      'Central',  1.3294, 103.8021),
  ('Orchard',          'orchard',          'Central',  1.3048, 103.8318),
  ('Marina Bay',       'marina bay',       'Central',  1.2808, 103.8586),
  ('Chinatown',        'chinatown',        'Central',  1.2834, 103.8441),
  ('Little India',     'little india',     'Central',  1.3066, 103.8518),
  ('Geylang',          'geylang',          'East',     1.3135, 103.8896),
  ('Kallang',          'kallang',          'Central',  1.3111, 103.8728),
  ('Pasir Ris',        'pasir ris',        'East',     1.3721, 103.9490),
  ('Serangoon',        'serangoon',        'North-East', 1.3496, 103.8729),
  ('Buona Vista',      'buona vista',      'West',     1.3070, 103.7900),
  ('Commonwealth',     'commonwealth',     'West',     1.3027, 103.7985),
  ('Harbourfront',     'harbourfront',     'Central',  1.2651, 103.8219),
  ('Changi',           'changi',           'East',     1.3644, 103.9915),
  ('Lim Chu Kang',     'lim chu kang',     'North',    1.4200, 103.7100)
on conflict (name) do nothing;

-- Grant anon read access
alter table areas enable row level security;
create policy "areas_anon_read" on areas for select to anon, authenticated using (true);
```

#### Migration E: Update `search_dishes` RPC to support area name

```sql
-- supabase/migrations/YYYYMMDD_search_dishes_area_name_support.sql

-- Drop and recreate with p_area_name parameter
create or replace function public.search_dishes(
  p_query             text default null,
  p_lat               double precision default null,
  p_lng               double precision default null,
  p_radius_meters     integer default null,
  p_dietary_flags     text[] default '{}'::text[],
  p_limit             integer default 20,
  p_cursor_score      double precision default null,
  p_cursor_id         text default null,
  p_venue_id          text default null,
  p_area_name         text default null,      -- NEW: filter by planning area name
  p_cuisine_tags      text[] default null,    -- NEW: filter by cuisine
  p_max_price         numeric default null,   -- NEW: price ceiling
  p_open_only         boolean default false   -- NEW: open venues only
)
-- ... (same return columns as current, logic extended)
```

The area name filter will:
1. Look up the area in `areas` using case-insensitive match
2. If found, set lat/lng to the area center and use `p_radius_meters` or a 3km default
3. Area name takes precedence over raw lat/lng if both provided but area matches

---

### Phase 1 — Excel Import Script (Python)

**Script:** `scripts/import_excel_to_supabase.py`

This script extends the existing `stage_canonical_food_businesses.py` pattern but reads from the Excel workbook instead of the CSV.

#### Key behaviours

1. **Read** `data/Hungry F&B Database.xlsx` → Sheet1
2. **Validate** each row — skip rows with missing lat/lng, missing stall name
3. **Normalise** text — trim whitespace, fix casing, normalise postal codes (zero-pad to 6 digits)
4. **Derive planning area** — use PostGIS `ST_Distance` against the `areas` table centroids (or fallback to hardcoded anchors)
5. **Deduplicate buildings** — key: `(postal_code, building_name_normalized)` or `(latitude_rounded, longitude_rounded)` for standalone stalls
6. **Deduplicate venues** — key: `(business_id)` or `(normalized_name, postal_code)`
7. **Deduplicate dishes** — key: `(venue_id, normalized_dish_name)` from Menu Items column
8. **Upsert** — `on conflict (business_id) do update` or `on conflict (normalized_name, postal_code) do update`
9. **Log** invalid/skipped rows to `staging_import_errors` and to stdout JSON
10. **Generate** import report: rows read, inserted, updated, skipped, invalid

#### Stall type → building_type mapping

| Excel Stall Type | `buildings.building_type` |
|---|---|
| Hawker Stall / Food Court Stall | `hawker_centre` or `food_court` (from Building Name) |
| Restaurant | `restaurant` |
| Cafe | `cafe` |
| Chain Outlet | `chain_outlet` |
| Bar / Bistro | `bar_bistro` |
| Zi Char | `restaurant` |
| Other | `other` |

#### Row validation rules

| Field | Rule |
|---|---|
| Stall / Restaurant Name | Required; min 2 chars |
| Latitude / Longitude | Required; lat ∈ [1.1, 1.6], lng ∈ [103.5, 104.2] |
| Postal Code | Optional; if present must be 5–6 digits |
| Price Min | If present, must be numeric ≥ 0 |
| Price Max | If present, must be ≥ Price Min |
| Stall Type | Must be one of the 8 known values |

#### Idempotency

The import uses `ON CONFLICT ... DO UPDATE` keyed on:
- For buildings: `business_id` (unique per SFA record), or `(name_normalized, postal_code)`
- For venues: `business_id`, or `(name_normalized, postal_code, unit_number)`
- For dishes: `(venue_id, name_normalized)`

Running the import twice will not create duplicates; the second run will update existing rows.

---

### Phase 2 — Location Query RPCs

#### RPC: `get_discovery_feed_by_location`

```sql
create or replace function public.get_discovery_feed_by_location(
  p_area_name     text default null,
  p_lat           double precision default null,
  p_lng           double precision default null,
  p_radius_meters integer default 3000,
  p_limit         integer default 50
)
returns table (
  venue_id        text,
  venue_name      text,
  building_id     text,
  building_name   text,
  planning_area   text,
  is_open         boolean,
  distance_meters integer,
  top_dish_id     text,
  top_dish_name   text,
  top_dish_image  text,
  top_dish_price  numeric,
  cuisine_tags    text[],
  rank_score      double precision
)
```

Logic:
1. If `p_area_name` is provided, resolve to lat/lng via `areas` table
2. Return open venues within radius, ranked by distance then rating

#### RPC: `search_venues_by_location` (new)

```sql
create or replace function public.search_venues_by_location(
  p_query         text default null,
  p_area_name     text default null,
  p_lat           double precision default null,
  p_lng           double precision default null,
  p_radius_meters integer default 3000,
  p_limit         integer default 30
)
```

#### Index additions

```sql
-- After data import
create index if not exists idx_venues_open_location
  on venues(is_open, planning_area)
  where is_open = true;

create index if not exists idx_buildings_planning_area_location
  on buildings using gist (location)
  where location is not null;
```

---

### Phase 3 — Connect Discover Screen to Real Data

**Current broken path:**
```
DiscoverHomeScreen
  → getNearestBuildings()  ← hardcoded geo file
  → repository.listVenuesByBuilding(hardcodedId)  ← returns [] in Supabase mode
  → repository.listDishesByVenue(venueId)  ← returns [] in Supabase mode
```

**Target path:**
```
DiscoverHomeScreen (Supabase mode)
  → get_discovery_feed_by_location(lat, lng, radius) RPC
  → renders real venues and dishes from Supabase
```

**Files to modify:**

1. `src/lib/services/supabase/supabaseRepository.ts`
   - Add `getDiscoveryFeedByLocation(lat, lng, radiusMeters)` calling the new RPC

2. `src/app/screens/discover/DiscoverHomeScreen.tsx`
   - In Supabase mode: call `getDiscoveryFeedByLocation()` instead of `repository.listVenuesByBuilding()`
   - Keep mock path unchanged
   - Show empty state when RPC returns 0 venues for the area

3. `src/app/screens/discover/QuickBitesScreen.tsx`
   - In Supabase mode: call `search_dishes()` RPC for quick bites category

---

### Phase 4 — Smoke Tests and Validation Scripts

#### Scripts to create

| Script | Purpose |
|---|---|
| `scripts/validate_excel_workbook.py` | Validate all rows, output JSON report, exit non-zero on critical errors |
| `scripts/import_excel_to_supabase.py` | Idempotent import; requires `HUNGRY_SUPABASE_IMPORT_*` env vars |
| `scripts/smoke_location_queries.mjs` | Call `get_discovery_feed_by_location` for 5 areas; assert non-empty |
| `scripts/smoke_search_queries.mjs` | Call `search_dishes` for common queries; assert relevance |
| `scripts/smoke_rls.mjs` | Test anon read, authenticated read, write rejection |

#### Test cases to add to Jest

**`src/lib/services/__tests__/discoveryFeed.test.ts`**
- Jurong East query returns Jurong East venues first
- Tampines query returns Tampines venues
- Orchard query returns Orchard venues
- Area name is case-insensitive
- Empty area returns empty state (no silent fallback)
- Dish detail loads by ID
- Stall detail loads by ID

**`scripts/__tests__/validate_excel.test.py`**
- Missing stall name → rejected
- Missing lat/lng → rejected
- Invalid price (min > max) → rejected
- Duplicate business ID → second upserts cleanly
- Duplicate dish in same stall → deduped

---

### Phase 5 — Performance Optimisation

**Target latencies:**

| Query | Target |
|---|---|
| `get_discovery_feed_by_location` | < 500ms |
| `search_dishes` | < 300ms |
| `get_dish_detail` | < 200ms |
| `get_venue_detail` | < 200ms |

**Required indexes (to add after import):**

```sql
-- These are the critical missing indexes for the full dataset:

-- 1. Venue planning area + open status (covers Discover feed)
create index if not exists idx_venues_planning_area_open
  on venues(planning_area, is_open, id);

-- 2. Dish full-text (trigram already exists on name, add venue name)
create index if not exists idx_dishes_name_venue_trgm
  on dishes using gin ((name || ' ' || venue_id) gin_trgm_ops);

-- 3. Building full-text search
create index if not exists idx_buildings_name_trgm
  on buildings using gin (name gin_trgm_ops);

-- 4. Venue name trigram (for venue search)
create index if not exists idx_venues_name_trgm
  on venues using gin (name gin_trgm_ops);
```

---

### Phase 6 — RLS and Security

**Required RLS additions after schema migration:**

```sql
-- areas: public read
alter table areas enable row level security;
create policy "anon_read_areas" on areas for select to anon, authenticated using (true);

-- venues: public read for active venues
-- (extend existing policy from 0003_rls_policies.sql if it exists)
-- venues.location (geography) is read-only generated column — no risk

-- Venue/building writes only via service role (import) — no app user can write
```

**Import security:**
- Import script uses `HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY` (env var)
- This key is never in the mobile app bundle
- `HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1` env var gates the import
- Staging only — never runs against production without explicit sign-off

---

## 6. Deliverables Checklist

| # | Deliverable | Phase |
|---|---|:---:|
| 1 | Migration: extend `buildings` | 0 |
| 2 | Migration: extend `venues` | 0 |
| 3 | Migration: extend `dishes` | 0 |
| 4 | Migration: add `areas` table + seed 30 areas | 0 |
| 5 | Migration: update `search_dishes` RPC with area name, cuisine, price, open_only filters | 0 |
| 6 | Migration: add `get_discovery_feed_by_location` RPC | 2 |
| 7 | Migration: add `search_venues_by_location` RPC | 2 |
| 8 | Script: `scripts/validate_excel_workbook.py` | 1 |
| 9 | Script: `scripts/import_excel_to_supabase.py` | 1 |
| 10 | Script: `scripts/smoke_location_queries.mjs` | 4 |
| 11 | Script: `scripts/smoke_search_queries.mjs` | 4 |
| 12 | Script: `scripts/smoke_rls.mjs` | 4 |
| 13 | Tests: `discoveryFeed.test.ts` | 4 |
| 14 | Tests: `validate_excel.test.py` | 4 |
| 15 | App: connect `DiscoverHomeScreen` to `get_discovery_feed_by_location` | 3 |
| 16 | App: connect `QuickBitesScreen` to `search_dishes` | 3 |
| 17 | Performance indexes | 5 |
| 18 | `package.json` new scripts | 1 |
| 19 | `.env.example` new keys | 1 |
| 20 | `tasks/Roadmap/database-excel-import-report.md` | 1 |
| 21 | `tasks/Roadmap/database-query-performance-report.md` | 5 |

---

## 7. `package.json` Scripts to Add

```json
{
  "data:excel:validate": "python3 scripts/validate_excel_workbook.py",
  "data:excel:import": "python3 scripts/import_excel_to_supabase.py",
  "smoke:database:location": "node scripts/smoke_location_queries.mjs",
  "smoke:database:search": "node scripts/smoke_search_queries.mjs",
  "smoke:database:rls": "node scripts/smoke_rls.mjs"
}
```

---

## 8. `.env.example` Keys to Add

```env
# Supabase data import — service role, never expose to mobile app
# Required only for running import scripts on local/staging
HUNGRY_SUPABASE_IMPORT_URL=
HUNGRY_SUPABASE_IMPORT_PROJECT_REF=
HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY=
HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=0  # Set to "1" to allow import scripts to run
```

---

## 9. Summary — Current MVP Database Readiness

| Gate | Status |
|---|---|
| Schema has all required tables | ✅ Source migration adds `areas`, `venue_images`, and missing Excel/catalog columns |
| Excel data is importable as-is | ✅ Validator and staging importer exist; live apply is guarded |
| 35k rows staged in Supabase | ⚠️ Not applied in this pass; staging apply still pending |
| Location-aware discovery works | ✅ Source wiring uses `get_discovery_feed_by_location`; live smoke pending after migration/import |
| Search uses Supabase | ✅ `search_dishes` RPC wired and called in Supabase mode |
| Dish detail loads from DB | ✅ `get_dish_detail` RPC exists |
| Stall detail loads from DB | ✅ `get_venue_detail` RPC exists |
| Jurong East query works | ✅ Source RPC supports `p_area_name`; live smoke pending after migration/import |
| Production uses no mock data for food content | ⚠️ Discover live-feed source path avoids local fallback in Supabase mode; broader production data-source proof still pending |
| RLS is correct | ⚠️ Source policies and smoke checks exist; live staging RLS smoke still pending |
| Import is idempotent | ⚠️ Staging import is idempotent; production promotion script still deferred |
| Import does not expose service role to app | ✅ Import script architecture is correct |

**MVP database readiness: SOURCE-READY / DATA-APPLY PENDING**

Remaining blockers:
1. Apply the new migration to local/staging, then run the smoke SQL and live smoke scripts.
2. Run the guarded Excel staging import against staging with `HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1`.
3. Build and verify a separate production-promotion script from staging rows into `buildings`, `venues`, `dishes`, and `venue_images`.
4. Add latency/performance proof once staging contains the full workbook.

---

## 10. Recommended Execution Order

```
Phase 0 → Phase 1 → Phase 1 smoke → Phase 2 → Phase 3 → Phase 4 → Phase 5
   ↓              ↓                      ↓
 Schema       Run Excel import      Connect Discover
migrations    against staging       to real data
```

Do **not** promote data to production until:
- Import smoke tests pass on staging
- RLS tests pass
- Location query latency tests pass
- `DiscoverHomeScreen` renders real venue data in Supabase mode (not just count)
