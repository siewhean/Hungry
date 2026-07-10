# Database–Excel Integration Plan — Implementation Audit

> Date: 2026-06-06
> Plan: `tasks/Roadmap/Database/database-excel-integration-plan.md`
> Branch: `frontend-design-overhaul`
> Method: Direct code inspection, test suite execution, script invocation
> TypeScript: **clean — 0 errors**
> Integration test suite: **6/6 pass** (`database-excel-integration.test.ts`)
> Validate script smoke: **100/100 rows accepted** (first 100 rows of workbook)

---

## Deliverable Checklist — Plan vs Reality

| # | Deliverable | Phase | Status | File |
|---|---|:---:|:---:|---|
| 1 | Migration: extend `buildings` | 0 | ✅ Done | `supabase/migrations/20260606120000_database_excel_integration_foundation.sql` |
| 2 | Migration: extend `venues` | 0 | ✅ Done | same |
| 3 | Migration: extend `dishes` | 0 | ✅ Done | same |
| 4 | Migration: add `areas` table + 31 areas seeded | 0 | ✅ Done | same |
| 5 | Migration: update `search_dishes` RPC (area name, cuisine, price, open_only) | 0 | ✅ Done | same |
| 6 | Migration: add `get_discovery_feed_by_location` RPC | 2 | ✅ Done | same |
| 7 | Migration: add `search_venues_by_location` RPC | 2 | ✅ Done | same |
| 8 | Script: `validate_excel_workbook.py` | 1 | ✅ Done | `scripts/validate_excel_workbook.py` |
| 9 | Script: `import_excel_to_supabase.py` | 1 | ✅ Done | `scripts/import_excel_to_supabase.py` |
| 10 | Script: `smoke_location_queries.mjs` | 4 | ✅ Done | `scripts/smoke_location_queries.mjs` |
| 11 | Script: `smoke_search_queries.mjs` | 4 | ✅ Done | `scripts/smoke_search_queries.mjs` |
| 12 | Script: `smoke_rls.mjs` | 4 | ✅ Done | `scripts/smoke_rls.mjs` |
| 13 | Tests: `database-excel-integration.test.ts` | 4 | ✅ Done | `src/lib/services/supabase/database-excel-integration.test.ts` |
| 14 | Tests: `validate_excel.test.py` (plan item) | 4 | ✅ Done | `scripts/__tests__/validate_excel.test.py` |
| 15 | App: connect Discover to `get_discovery_feed_by_location` | 3 | ✅ Done | `src/app/screens/discover/DiscoverHomeScreen.tsx` |
| 16 | App: connect `QuickBitesScreen` to `search_dishes` | 3 | ✅ Done | `src/app/screens/discover/QuickBitesScreen.tsx`, `src/features/discover/bites.ts` |
| 17 | Performance indexes | 5 | ✅ Done | `20260606120000…` |
| 18 | `package.json` new scripts | 1 | ✅ Done | `package.json` lines 25–27, 53–54 |
| 19 | `.env.example` new keys | 1 | ✅ Done | `.env.example` lines 67–70 |
| 20 | `tasks/Roadmap/Database/database-excel-import-report.md` | 1 | ✅ Done — live import pending | `tasks/Roadmap/Database/database-excel-import-report.md` |
| 21 | `tasks/Roadmap/Database/database-query-performance-report.md` | 5 | ✅ Done — live EXPLAIN pending | `tasks/Roadmap/Database/database-query-performance-report.md` |
| 22 | Smoke SQL: `supabase/smoke/database_excel_integration.sql` | 4 | ✅ Done (bonus) | `supabase/smoke/database_excel_integration.sql` |

---

## Phase 0 — Schema Migrations ✅

All schema additions are confirmed in `20260606120000_database_excel_integration_foundation.sql`:

### `buildings` extensions confirmed:
- `address`, `postal_code`, `region`, `planning_area`, `business_id`, `licence_no`, `source_type`, `source_confidence`, `image_url`, `updated_at` ✅
- `building_type` constraint extended with `'mall'`, `'cafe'`, `'bar_bistro'`, `'chain_outlet'`, `'standalone'`, `'kopitiam'`, `'other'` ✅
- `business_id` unique index (partial, where not null) ✅

### `venues` extensions confirmed:
- `business_id`, `stall_id`, `licence_no`, `cuisine_tags`, `dietary_tags`, `image_url`, `latitude`, `longitude` ✅
- Generated `location geography(point, 4326)` column (computed from `latitude`/`longitude`) ✅
- `address`, `postal_code`, `planning_area`, `google_place_id`, `google_rating`, `google_review_count` ✅
- `source_type`, `source_confidence`, `last_verified_at`, `updated_at` ✅
- GiST index on `location`, GIN indexes on `cuisine_tags`, `dietary_tags`, `name` ✅
- `updated_at` trigger via `trg_venues_updated_at` ✅

### `dishes` extensions confirmed:
- `cuisine_tags`, `is_featured`, `source_type`, `source_confidence`, `updated_at` ✅
- `updated_at` trigger ✅

### `staging_food_businesses` extensions:
- Google enrichment columns (all 18 columns from plan) ✅
- `menu_source`, `menu_items_text` ✅

### `areas` table:
- Full definition with `center_location` generated geography column ✅
- 31 Singapore planning areas seeded (plan specified 30; one additional area `Pioneer` included) ✅
- RLS enabled; public read + service_role write policies ✅

### `venue_images` table:
- New table (not in the original plan, bonus deliverable) ✅
- RLS enabled; public read + service_role write policies ✅

### `search_dishes` RPC updated:
- Added `p_area_name`, `p_cuisine_tags`, `p_max_price`, `p_open_only` parameters ✅
- Old 9-argument version dropped with `cascade` ✅
- `security invoker`, `set search_path = public, extensions` ✅
- `GRANT EXECUTE` to `anon, authenticated` ✅

**One gap:** The migration contains `create extension if not exists pg_trgm` at line 5, which re-declares what `0029_server_side_discovery_reads.sql` already does in `extensions` schema. This is safe (idempotent `IF NOT EXISTS`) but is a minor redundancy.

---

## Phase 1 — Excel Import Script ✅

**`scripts/validate_excel_workbook.py`** (327 lines):
- Reads `data/Hungry F&B Database.xlsx` with `openpyxl`
- Validates column headers against `EXPECTED_COLUMNS` (52 columns including `"Google Place ID"`, `"Menu Items"`)
- Row-level validation: `missing_stall_name`, `invalid_latitude`, `invalid_longitude`, price range checks
- Outputs JSON report (`valid_rows`, `invalid_rows`, `issue_counts`, `severity_counts`, `sample_issues`)
- Read-only; no DB connection
- Test run: **100/100 rows valid** on first 100 rows of the workbook ✅

**`scripts/import_excel_to_supabase.py`** (578 lines):
- Imports from `validate_excel_workbook.py` (shared parsing utilities)
- Writes deterministic SQL to `/tmp/` by default
- Live import guarded by `HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1` ✅
- Uses `HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY` ✅
- Writes only to `staging_food_businesses` and `staging_import_errors` — **never to `buildings`, `venues`, or `dishes`** ✅
- Import run lifecycle: `running` → `completed` / `failed` ✅
- Source slug: `hungry_fnb_excel_workbook` ✅

`scripts/__tests__/validate_excel.test.py` now imports the validator directly and covers a valid row, required Google/menu columns, missing-name/bad-coordinate errors, and duplicate-source warnings. `package.json` exposes it through `npm run data:excel:test`.

---

## Phase 2 — Location Query RPCs ✅

**`get_discovery_feed_by_location`** — fully implemented:
- Area name → `areas.name_normalized` lookup with `center_lat`/`center_lng` resolution ✅
- Falls back to raw `p_lat`/`p_lng` if area name not matched ✅
- Returns: `venue_id`, `venue_name`, `building_id`, `building_name`, `planning_area`, `is_open`, `distance_meters`, `top_dish_id`, `top_dish_name`, `top_dish_image`, `top_dish_price`, `cuisine_tags`, `rank_score` ✅
- `security invoker`, `set search_path = public, extensions` ✅
- `GRANT EXECUTE` to `anon, authenticated` ✅
- Ranking: open bonus (0.35) + proximity score (0.35) + rating score (0.30) ✅

**`search_venues_by_location`** — fully implemented:
- Area name resolution via `areas` table ✅
- Trigram similarity + `ILIKE` fuzzy matching on venue name, building name, cuisine tags ✅
- Returns 11 columns including `planning_area`, `cuisine_tags`, `distance_meters`, `rank_score` ✅
- `security invoker`, `set search_path = public, extensions` ✅
- `GRANT EXECUTE` to `anon, authenticated` ✅

---

## Phase 3 — App Screen Connection ✅

### `DiscoverHomeScreen.tsx` — ✅ DONE

The critical `isSupabaseDataSource` block (lines 1178–1223) now calls both:
1. `discoveryService.countVenuesInArea(lat, lng, radius)` — count for header ✅
2. `discoveryService.listDiscoveryFeedByLocation({ areaName, lat, lng, radiusMeters, limit: 50 })` ✅

The result is stored in `supabaseDiscoveryFeed`. All downstream `useMemo` hooks (`areaVenues`, `areaDishes`, `allDiscoverVenues`, `allDiscoverDishes`) branch on `isSupabaseDataSource`:
- **Supabase mode**: use `supabaseFeedVenues` and `supabaseFeedResults` ✅
- **Mock mode**: use hardcoded building IDs from `getNearestBuildings()` ✅

**This resolves the critical P1 gap identified in the previous audit.**

### `QuickBitesScreen.tsx` — ✅ DONE

The plan specified: *"In Supabase mode: call `search_dishes` RPC for quick bites category"*

Current reality after this pass: `QuickBitesScreen` branches on `getServiceProvider().mode === "supabase"` and calls `getDiscoverBitesFromSearch(collection, { latitude, longitude, radiusMeters, tasteVector, dietaryFlags })`.

`getDiscoverBitesFromSearch()` calls `getHungryService().discovery.searchDishes()`. In Supabase mode this goes through the `search_dishes` RPC. `SearchFilters` now carries optional `latitude`, `longitude`, `areaName`, `cuisineTags`, `maxPrice`, and `openOnly`, and the Supabase RPC mapper passes those fields through.

If Supabase returns no rows, Quick Bites shows its empty state instead of silently mixing mock content into the live surface.

### Service layer — ✅ DONE

`src/lib/services/supabase/supabaseRepository.ts`:
- `listDiscoveryFeedByLocationViaRpc()` → calls `rpcRows("get_discovery_feed_by_location", ...)` ✅
- `searchVenuesByLocationViaRpc()` → calls `rpcRows("search_venues_by_location", ...)` ✅

`src/lib/services/supabase/supabaseService.ts`:
- `discovery.listDiscoveryFeedByLocation(request)` → calls the repository function ✅
- `discovery.searchVenuesByLocation(request)` → calls the repository function ✅

`src/lib/services/types.ts`:
- `listDiscoveryFeedByLocation(request): Promise<DiscoveryFeedResult | null>` declared ✅
- `searchVenuesByLocation(request): Promise<VenueSearchResult[]>` declared ✅

---

## Phase 4 — Smoke Tests and Validation Scripts ✅

All scripts exist and are runnable:

| Script | File | Status |
|---|---|:---:|
| `data:excel:validate` | `scripts/validate_excel_workbook.py` | ✅ |
| `data:excel:import` | `scripts/import_excel_to_supabase.py` | ✅ |
| `smoke:database:location` | `scripts/smoke_location_queries.mjs` | ✅ |
| `smoke:database:search` | `scripts/smoke_search_queries.mjs` | ✅ |
| `smoke:database:rls` | `scripts/smoke_rls.mjs` | ✅ |
| `supabase/smoke/database_excel_integration.sql` | SQL smoke against live DB | ✅ |

**Integration contract test** (`database-excel-integration.test.ts`, 204 lines, 6 tests):
- Schema: all required columns and indexes present ✅
- RLS: `areas` and `venue_images` have correct policies ✅
- RPCs: all three functions have `security invoker` + correct grants ✅
- Scripts: import is staging-only and service-role guarded ✅
- Repo wiring: `listDiscoveryFeedByLocationViaRpc` and `searchVenuesByLocationViaRpc` wired ✅
- App screen: `listDiscoveryFeedByLocation({` and `supabaseDiscoveryFeed?.venues` present ✅
- Test result: **6/6 pass** ✅

`scripts/__tests__/validate_excel.test.py` now imports the validator and exercises known-good rows, missing-name/bad-coordinate errors, and duplicate-source warnings.

---

## Phase 5 — Performance Optimization ✅

All required indexes are in the migration:

| Index | Status |
|---|:---:|
| `idx_venues_planning_area_open` — `(planning_area, is_open, id)` | ✅ |
| `idx_venues_open_location` — `(is_open, planning_area) WHERE is_open = true` | ✅ |
| `idx_buildings_planning_area_location` — GiST on `location` | ✅ |
| `idx_venues_location` — GiST on `venue.location` | ✅ |
| `idx_venues_cuisine_tags` — GIN on `cuisine_tags` | ✅ |
| `idx_venues_name_trgm` — GIN trigram on `name` | ✅ |
| `idx_buildings_name_trgm` — GIN trigram on `name` | ✅ |
| `idx_dishes_cuisine_tags` — GIN on `cuisine_tags` | ✅ |
| `idx_dishes_is_featured` — partial on `is_featured = true` | ✅ |
| `idx_dishes_name_venue_trgm` — GIN trigram on `(name ‖ venue_id)` | ✅ |
| `idx_areas_name_normalized` | ✅ |
| `idx_areas_center_location` — GiST on `center_location` | ✅ |
| `idx_venue_images_venue_order` | ✅ |

`tasks/Roadmap/Database/database-query-performance-report.md` now records the static query/index review. Live `EXPLAIN (ANALYZE, BUFFERS)` capture remains pending until the staging import is applied.

---

## Phase 6 — RLS and Security ✅

- `areas` table: `enable row level security` + public select + service_role all ✅
- `venue_images` table: `enable row level security` + public select + service_role all ✅
- All three RPCs: `security invoker` + `set search_path = public, extensions` (no DEFINER privilege) ✅
- Import script: `HUNGRY_ALLOW_SERVICE_ROLE_IMPORT` gate + `HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY` env var ✅
- Service-role key never present in `src/` (confirmed in previous audit) ✅

---

## What Is NOT Implemented (Gaps Remaining)

### Remaining Gap — Excel data is not yet imported into Supabase (❌ Operational prerequisite)

The plan was always explicit that the import script must be run against a live Supabase instance. The script exists and works (100/100 rows pass validation), but no data is in the staging tables or promoted to production tables yet. All location-based RPCs will return empty results until rows are imported.

**This is expected and documented in the plan.** Not a code gap — an operational step.

---

## Summary — What Has Changed Since the Plan Was Written

The plan was written as a list of things that needed to be built. Repo-side implementation is now complete; only live staging import and post-import smoke proof remain:

| Category | Plan items | Done | Remaining |
|---|:---:|:---:|:---:|
| Schema migrations (Phase 0) | 5 | 5 | 0 |
| Import scripts (Phase 1) | 2 | 2 | 0 |
| Location RPCs (Phase 2) | 2 | 2 | 0 |
| App screen connections (Phase 3) | 2 | 2 | 0 |
| Tests and smoke scripts (Phase 4) | 5 | 5 | 0 |
| Performance indexes (Phase 5) | 1 (indexes) | 1 | 0 |
| Documentation reports | 2 | 2 | 0 live reports / live measurements pending |
| `package.json` scripts | 6 | 6 | 0 |
| `.env.example` keys | 4 | 4 | 0 |

**The database-excel integration plan is source-complete. Live data apply remains operationally pending.**

---

## Remaining Action Items (in priority order)

| Priority | Action | Files |
|:---:|---|---|
| P2 | Run `npm run data:excel:import` against staging Supabase and verify row count | — |
| P3 | Run `npm run smoke:database:location` against staging (after data import) | — |
| P3 | Run `npm run smoke:database:search` against staging | — |
| P3 | Run live `EXPLAIN (ANALYZE, BUFFERS)` and append results to `tasks/Roadmap/Database/database-query-performance-report.md` | — |

---

## Code Changes Completed In Follow-Up

The follow-up pass connected Quick Bites to the Supabase `search_dishes` path, added runtime validator tests, created the import/performance reports, and updated contracts to prevent regressions. All remaining work is live Supabase staging/import verification.
