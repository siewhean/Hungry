# Database Phase 0-1 Foundation

## Scope

Phase 0-1 only: clean backend branch plus additive canonical data-safety foundation for import staging, external provenance, and dedupe review. Deferred: read RPCs, app read-path migration, feed/social models, merchant/menu upgrades, media assets, background jobs, analytics, partitioning, and commerce.

## Phase 0 Baseline

- Clean worktree: `/Users/Siew Hean/Documents/GitHub/Hungry-db-phase-0-1`
- Branch: `codex/fdo-db-phase-0-1-foundation`
- Initial branch point: `origin/frontend-design-overhaul` at `d9c712f56`
- Final base after clean rebase: `origin/frontend-design-overhaul` at `759fe3cf5`
- Main checkout note: `/Users/Siew Hean/Documents/GitHub/Hungry` was checked separately and left untouched.
- Linked Supabase project ref: `vlqfgmrsprbrgzteixsj` from `supabase/config.toml`
- Pre-Phase-1 migration tail: `0023_integration_posts_privacy_chat.sql`, `0024_merchant_catalog_metadata_rls.sql`, `0025_post_media_visible_storage_policy.sql`, `0026_post_engagement_count_triggers.sql`, `0027_taste_recommendation_events.sql`
- Smoke SQL inventory before this pass: `postgis_distance.sql`, `clm02_supply_priming.sql`, `mobile_storage_policies.sql`, `merchant_rls_policies.sql`, `integration_readiness.sql`, `taste_recommendations.sql`, `store_policy_safety_controls.sql`, `pgvector_similarity.sql`

## Existing Production Table Baseline

Source migration table inventory before `0028`: `account_deletion_requests`, `bite_reactions`, `bites`, `blog_posts`, `blog_sources`, `building_floors`, `buildings`, `chat_messages`, `content_reports`, `conversation_participants`, `conversations`, `customer_interaction_reports`, `dietary_flags`, `dish_dietary_flags`, `dish_flavor_tags`, `dish_images`, `dish_taste_vectors`, `dishes`, `dishes_draft`, `follows`, `guest_sessions`, `menu_photo_submissions`, `merchant_accounts`, `merchant_claim_interests`, `merchant_notification_preferences`, `merchant_outlets`, `merchant_promotions`, `merchant_roles`, `merchant_verification_evidence`, `merchant_verifications`, `messages`, `orders`, `post_comments`, `post_likes`, `post_media`, `post_saves`, `post_shares`, `posts`, `privacy_settings`, `quiz_responses`, `read_receipts`, `review_photos`, `reviews`, `stall_posts`, `taste_interaction_events`, `user_blocks`, `user_favourite_dishes`, `user_profiles`, `user_taste_vectors`, `venue_categories`, `venue_category_links`, `venue_delivery_links`, `venues`.

RLS inventory already includes the production tables above plus manual/platform-noted entries such as `public.spatial_ref_sys`; this pass does not weaken or replace any existing RLS/policies.

## Phase 1 Deliverables

- Migration: `supabase/migrations/0028_data_import_provenance_foundation.sql`
- Smoke SQL: `supabase/smoke/database_foundation.sql`
- Source contract: `src/lib/services/supabase/database-foundation.test.ts`
- New internal-only tables: `external_sources`, `import_runs`, `staging_food_businesses`, `staging_google_places_observations`, `staging_menu_items`, `staging_photos`, `staging_import_errors`, `external_place_refs`, `venue_source_observations`, `dish_source_observations`, `photo_source_observations`, `google_places_observations`, `venue_aliases`, `venue_merge_events`, `data_quality_flags`
- Access model: RLS enabled on every new table, service-role manage policies only, no broad `authenticated` or `anon` access to raw import/provenance/dedupe data.
