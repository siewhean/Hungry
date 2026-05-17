# Database Phase 2 Home Social Feed Reads

## Scope

Phase 2 second slice only: move the Home social feed read path behind a bounded Supabase RPC. This does not add moderation tables, partitioning, feed-ranking read models, merchant dashboard RPCs, menu versioning, media asset unification, background jobs, analytics summaries, or commerce.

## Deliverables

- Migration: `supabase/migrations/0030_home_social_feed_reads.sql`
- Smoke SQL: `supabase/smoke/home_social_feed_reads.sql`
- Source contract: `src/lib/services/supabase/home-social-feed.test.ts`
- Supabase service wiring:
  - `social.getBitesFeed` calls `get_home_social_feed` first.
  - Legacy client-side post/media/dish/venue assembly remains as fallback.
  - Post like/save existence checks use `post_id` because `post_likes` and `post_saves` use composite primary keys.

## Safety Notes

- `get_home_social_feed` is `security invoker`, not `security definer`.
- Execute is granted to `authenticated` only.
- The RPC uses existing `public.can_read_post(p.id)` visibility checks.
- Cursor pagination uses `coalesce(published_at, created_at)` plus `id`; no offset pagination.
- Existing `posts`, `post_media`, and social engagement IDs remain unchanged.
