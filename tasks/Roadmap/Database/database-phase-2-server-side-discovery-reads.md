# Database Phase 2 Server-Side Discovery Reads

## Scope

Phase 2 first slice only: replace the highest-risk discovery cache reads with bounded Supabase RPCs for dish search, dish detail, and venue detail. Also add a server-side nearby-open-venues RPC/helper for the future location feed, but do not expose it through the app service interface yet. Deferred: social feed read model, merchant dashboard RPC, menu versioning, media asset unification, background jobs, analytics summaries, partitioning, commerce, and canonical ID migration.

## Deliverables

- Migration: `supabase/migrations/0029_server_side_discovery_reads.sql`
- Smoke SQL: `supabase/smoke/server_side_discovery_reads.sql`
- Source contract: `src/lib/services/supabase/server-side-discovery.test.ts`
- Supabase service wiring:
  - `discovery.searchDishes` uses `search_dishes` first, cache fallback second.
  - `discovery.getDish` uses `get_dish_detail` first, cache fallback second.
  - `discovery.getVenue` and `discovery.listDishesByVenue` use `get_venue_detail` first, cache fallback second.
  - `discovery.listPopularNearby` uses `search_dishes` with location/radius first, cache fallback second.
- Nearby-open venue support:
  - `get_nearby_open_venues` and `listNearbyOpenVenuesViaRpc` exist for the next location-feed slice.
  - No `HungryService.discovery` method is added yet because the current service contract has no nearby-open venue endpoint.

## RPCs

- `public.search_dishes(...)`
- `public.get_dish_detail(p_dish_id text)`
- `public.get_venue_detail(p_venue_id text)`
- `public.get_nearby_open_venues(...)` using the canonical `venues.is_open` flag and building closure flag. Time-window parsing is deferred until operating hours are structured.

## Safety Notes

- RPCs are `security invoker`, not `security definer`.
- RPCs are granted to `anon` and `authenticated` because discovery remains guest-browseable.
- Cursor pagination uses score/id for dish search and distance/id for nearby venues.
- Existing canonical IDs remain `text`; this phase does not alter `buildings`, `venues`, `dishes`, `reviews`, or `posts` IDs.
- Phase 0-1 raw import/provenance tables remain service-role-only and are not used for app-facing reads.
