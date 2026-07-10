# Database Phase 2 Location Directory Reads

## Scope

Phase 2 third slice only: move location/building directory reads behind bounded Supabase RPCs. This does not add feed-ranking read models, merchant dashboard RPCs, menu versioning, media asset unification, background jobs, analytics summaries, partitioning, commerce, or canonical ID migration.

## Deliverables

- Migration: `supabase/migrations/0031_location_directory_reads.sql`
- Smoke SQL: `supabase/smoke/location_directory_reads.sql`
- Source contract: `src/lib/services/supabase/location-directory.test.ts`
- Supabase service wiring:
  - `discovery.listBuildings` calls `list_buildings` first.
  - `discovery.getBuildingDetail` calls `get_building_detail` first.
  - `discovery.listVenuesByBuilding` calls `list_venues_by_building` first.
  - Existing cache-backed repository reads remain as fallback.

## Safety Notes

- RPCs are `security invoker`, not `security definer`.
- Execute is granted to `anon` and `authenticated` because location discovery remains guest-browseable.
- Cursor pagination uses `distance_meters + id` for buildings and `floor_sort + id` for venue directory rows.
- Existing `buildings`, `venues`, and `dishes` IDs remain unchanged.
