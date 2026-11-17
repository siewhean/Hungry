# Database Query Performance Report

> Updated: 2026-06-06
> Scope: Excel-backed discovery/search query readiness
> Status: Static query/index review complete; live EXPLAIN pending staging data

## Summary

The Excel integration migration adds the indexes needed for the planned location, search, and discovery RPCs. Live performance cannot be measured until the workbook has been staged and promoted into queryable canonical tables.

## Query Surfaces Reviewed

| Surface | Function | Status |
|---|---|---|
| Discover feed by location | `get_discovery_feed_by_location` | indexed and smoke-covered |
| Venue search by location | `search_venues_by_location` | indexed and smoke-covered |
| Dish search | `search_dishes` | location/filter parameters wired |
| Quick Bites live results | `discovery.searchDishes()` / `search_dishes` | wired in Supabase mode |

## Index Coverage

| Query need | Index |
|---|---|
| Area name lookup | `idx_areas_name_normalized` |
| Area distance lookup | `idx_areas_center_location` |
| Building planning-area filtering | `idx_buildings_planning_area` |
| Building geospatial filtering | `idx_buildings_planning_area_location` |
| Venue open/planning filtering | `idx_venues_planning_area_open` |
| Venue open-only lookup | `idx_venues_open_location` |
| Venue geospatial filtering | `idx_venues_location` |
| Venue Google place dedupe | `idx_venues_google_place_id` |
| Venue cuisine filters | `idx_venues_cuisine_tags` |
| Venue dietary filters | `idx_venues_dietary_tags` |
| Venue fuzzy name search | `idx_venues_name_trgm` |
| Dish cuisine filters | `idx_dishes_cuisine_tags` |
| Featured dish lookup | `idx_dishes_is_featured` |
| Dish fuzzy search | `idx_dishes_name_venue_trgm` |
| Staging Google place dedupe | `idx_staging_food_businesses_google_place_id` |
| Image ordering | `idx_venue_images_venue_order` |

## Static Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Live canonical tables may still be sparse before promotion | Empty Discover/Quick Bites results in Supabase mode | Run staging import, review dedupe, then promote approved rows |
| `search_dishes` fuzzy relevance depends on normalized dish and venue names | Weak ranking if imported names are noisy | Use validation and dedupe review before promotion |
| Duplicate source keys in workbook | Potential duplicate venues if promoted blindly | Keep duplicates in staging review; do not direct-promote |
| Missing lat/lng rows | Location queries cannot return those rows | Keep invalid rows in `staging_import_errors` until repaired |

## Pending Live Measurements

After staging and promotion, run:

```sql
explain (analyze, buffers)
select * from public.get_discovery_feed_by_location(null, 1.34, 103.74, 3000, 50);

explain (analyze, buffers)
select * from public.search_venues_by_location('chicken', null, 1.34, 103.74, 3000, 20);

explain (analyze, buffers)
select * from public.search_dishes('chicken rice', 1.34, 103.74, 3000, array[]::text[], 20, null, null, null, null, null, 8, false);
```

Acceptance target for beta:

- p95 app-facing RPC latency under 500 ms on staging-size data.
- No sequential scan on large promoted venue/dish tables unless row count is still below planner threshold.
- No unbounded result sets; all RPCs keep explicit limits.
