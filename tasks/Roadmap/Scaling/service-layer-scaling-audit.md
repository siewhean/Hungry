# Service Layer Scaling Audit

Date: 2026-06-07

## Rule

Production screens must use service or repository methods that can be bounded, cached, timed out, and retried. Screens must not become the source of truth for shared data.

## Read Path Contracts

| Flow | Scaling expectation |
| --- | --- |
| Discovery | Use bounded Supabase location/search RPCs in Supabase mode; cache only as a fallback mirror |
| Search | Use search service/RPC calls with explicit query, limit, and failure state |
| Detail | Fetch dish/stall detail by stable ID; show not-found/empty states instead of fabricated data |
| Home/feed | Use feed service/RPC with cursor/limit; followed-first ordering must be service-built or pure-builder tested |
| Profile | Hydrate public/private profile data from Supabase on auth start and user switch |
| Saves/reviews/posts | Writes go through Supabase services with rollback/error handling |

## Store Contracts

Zustand stores remain device-local cache, optimistic mirrors, or UI-only state. Supabase remains canonical for shared/synced data.

- `useSessionStore`: auth/session state and account-scoped cache reset.
- `useProfileStore`: profile/favourites/preferences cache and optimistic rollback.
- `useSocialStore`: feed interactions/follows/shares as optimistic mirrors only.
- `useUIStore`: device-local UI settings only.

## Required Failure Behavior

- Timeout or network errors show an explicit error/empty/retry state.
- Mutating actions do not silently succeed when the backend write fails.
- Unsupported mock/review/share IDs are not written to production tables.
- Signed-out protected actions keep a return route or action intent.

## Remaining External Proof

- Live cross-device mutation smoke for post publish, review, favourite, and follow.
- Staging Supabase latency measurements for discovery/search/detail/feed RPCs.
- Real pagination thresholds from staging or load-test telemetry.
