# Database Phase 3 Social Governance And Feed Foundation

## Scope

Phase 3 first slice only: add social post safety tables and a Home feed read-model foundation. This keeps existing app-facing IDs intact and does not add partitioning, background jobs, merchant dashboard RPCs, menu versioning, media asset unification, analytics summaries, commerce, or canonical ID migration.

## Deliverables

- Migrations:
  - `supabase/migrations/0032_social_governance_feed_foundation.sql`
  - `supabase/migrations/0033_social_governance_feed_foundation_fixes.sql`
  - `supabase/migrations/0034_post_report_write_integrity.sql`
- Smoke SQL: `supabase/smoke/social_governance_feed_foundation.sql`
- Source contract: `src/lib/services/supabase/social-governance-feed.test.ts`
- Supabase service wiring:
  - Home social feed calls `get_home_social_feed_v2` first.
  - Existing `get_home_social_feed` remains as fallback.
  - `communitySafety.reportContent` routes post UUID reports through `report_post`.
  - `communitySafety.hidePost` and `communitySafety.unhidePost` call the matching RPCs.

## Safety Notes

- All new tables enable RLS.
- `service_role` can manage new governance/read-model rows.
- Authenticated users can only manage their own hidden-post rows and their own post reports.
- Moderation audit rows have no broad authenticated read/write policy.
- `can_read_post` is strengthened to exclude posts with `hidden` or `removed` moderation state.
- `get_home_social_feed_v2` is `security invoker`, bounded to 50 rows, and excludes user-hidden plus moderated posts.
- Repeated hide/report calls are supported through scoped owner-only update policies.
- Post report writes are routed through the checked `report_post` RPC; authenticated users keep select-only table access for their own reports.
- Feed cursor ordering is deterministic on `feed_created_at desc, post_id desc`; `rank_score` remains stored for later ranking but is not part of the active cursor order yet.
- The read model starts global-first through `home_feed_items`; viewer-specific ranking rows remain reserved for a later phase.
