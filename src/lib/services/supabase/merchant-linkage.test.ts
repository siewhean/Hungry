import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Supabase merchant service is wired to linked consumer venue and dish tables", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.doesNotMatch(service, /merchantUnavailable/);
  assert.doesNotMatch(service, /Merchant Centre is not available in Supabase mode yet/);
  assert.match(service, /from\("merchant_outlets"\)/);
  assert.match(service, /from\("venues"\)/);
  assert.match(service, /from\("dishes"\)/);
  assert.match(service, /refreshSupabaseRepositoryCache/);
  assert.match(service, /requireLinkedMerchantOutlet/);
  assert.match(service, /UUID_PATTERN/);
  assert.match(service, /merchant_account_id/);
});

test("Supabase merchant dish writes persist user-visible metadata and media", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(service, /resolveMerchantDishGalleryUrls/);
  assert.match(service, /bucket: "merchant-dish-images"/);
  assert.match(service, /uploadImageFromUri/);
  // Dish row, images, dietary flags and taste vector are written in one transaction by the
  // merchant_save_dish RPC, so a failed step can no longer leave a half-saved live dish.
  assert.match(service, /rpc\("merchant_save_dish"/);
  assert.match(service, /p_gallery_urls/);
  assert.match(service, /p_dietary_slugs/);
  assert.match(service, /p_taste_vector/);
  assert.doesNotMatch(service, /replaceDishImages|replaceDishDietaryFlags|replaceDishTasteVector/);
  assert.match(service, /buildDishUpdatePayload/);
  assert.match(service, /fetchDishPresentationMap/);
  assert.match(service, /mapSupabaseDish\(row, venue, presentationByDishId/);
});

test("Supabase repository reads dish metadata from normalized catalog tables", () => {
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");

  assert.match(repository, /from\("dishes"\)\.select\("\*"\)/);
  assert.match(
    repository,
    /from\("dish_images"\)[\s\S]*media_approved_for_display,media_rights_status,media_source_url/,
  );
  assert.match(repository, /from\("dish_taste_vectors"\)/);
  assert.match(repository, /from\("dish_dietary_flags"\)/);
  assert.match(repository, /from\("dietary_flags"\)/);
  assert.match(repository, /buildDishPresentationMap/);
  assert.match(repository, /presentationByDishId\.get/);
  assert.doesNotMatch(repository, /from\("dishes"\)\.select\([^)]*dietary_flags/);
  assert.doesNotMatch(repository, /from\("dishes"\)\.select\([^)]*sweet/);
  assert.doesNotMatch(repository, /from\("dishes"\)\.select\([^)]*gallery/);
});

test("Supabase migration links merchant writes to non-merchant read surfaces", () => {
  const migration = read("supabase/migrations/0019_merchant_consumer_linkage.sql");

  assert.match(migration, /mo\.venue_id = venues\.id/);
  assert.match(migration, /mo\.venue_id = dishes\.venue_id/);
  assert.match(migration, /mo\.venue_id = reviews\.venue_id/);
  assert.match(migration, /merchant_promotions/);
  assert.match(migration, /merchant_notification_preferences/);
});

test("Supabase merchant RLS hardening limits review replies and settings writes", () => {
  const migration = read("supabase/migrations/0020_merchant_rls_hardening.sql");
  const authorGuard = read("supabase/migrations/0021_review_author_update_guard.sql");
  const catalogGuard = read("supabase/migrations/0022_merchant_catalog_column_guards.sql");
  const smoke = read("supabase/smoke/merchant_rls_policies.sql");

  assert.match(migration, /merchant_can_manage_venue/);
  assert.match(migration, /enforce_merchant_review_reply_update/);
  assert.match(migration, /merchant review updates are limited to reply fields/);
  assert.match(migration, /interaction_reports_insert_merchant_owner_or_manager/);
  assert.match(migration, /notification_prefs_update_owner_or_manager/);
  assert.match(migration, /security invoker/);
  assert.match(authorGuard, /review authors cannot change identity or merchant reply fields/);
  assert.match(authorGuard, /new\.merchant_reply_text is distinct from old\.merchant_reply_text/);
  assert.match(catalogGuard, /merchant venue updates are limited to profile fields/);
  assert.match(catalogGuard, /new\.hygiene_grade is distinct from old\.hygiene_grade/);
  assert.match(
    catalogGuard,
    /merchant dish updates cannot change identity, aggregate, or live fields/,
  );
  assert.match(catalogGuard, /new\.rating_avg is distinct from old\.rating_avg/);
  assert.match(catalogGuard, /dish insert must match a managed merchant outlet/);
  assert.match(smoke, /trg_enforce_merchant_review_reply_update/);
  assert.match(smoke, /trg_enforce_merchant_venue_update_guard/);
  assert.match(smoke, /trg_enforce_merchant_dish_write_guard/);
  assert.match(smoke, /security_definer/);
});

test("Supabase merchant catalog metadata RLS covers images and dietary links", () => {
  const migration = read("supabase/migrations/0024_merchant_catalog_metadata_rls.sql");
  const smoke = read("supabase/smoke/merchant_rls_policies.sql");

  assert.match(migration, /dairy_free/);
  assert.match(migration, /egg_free/);
  assert.match(migration, /peanut_free/);
  assert.match(migration, /shellfish_free/);
  assert.match(migration, /soy_free/);
  assert.match(migration, /sulphite_free/);
  assert.match(migration, /dish_images_insert_merchant_owner_or_manager/);
  assert.match(migration, /dish_images_update_merchant_owner_or_manager/);
  assert.match(migration, /dish_images_delete_merchant_owner_or_manager/);
  assert.match(migration, /dish_taste_vectors_insert_merchant_owner_or_manager/);
  assert.match(migration, /dish_taste_vectors_update_merchant_owner_or_manager/);
  assert.match(migration, /dish_taste_vectors_delete_merchant_owner_or_manager/);
  assert.match(migration, /dish_dietary_flags_insert_merchant_owner_or_manager/);
  assert.match(migration, /dish_dietary_flags_update_merchant_owner_or_manager/);
  assert.match(migration, /dish_dietary_flags_delete_merchant_owner_or_manager/);
  assert.match(migration, /merchant_can_manage_venue\(d\.venue_id\)/);
  assert.match(smoke, /dish_images_%_merchant/);
  assert.match(smoke, /dish_taste_vectors_%_merchant/);
  assert.match(smoke, /dish_dietary_flags_%_merchant/);
});

test("Supabase merchant portal readiness covers views, notifications, and promo pricing", () => {
  const migration = read("supabase/migrations/0039_merchant_portal_readiness.sql");
  const hardening = read(
    "supabase/migrations/0040_release_hardening_account_deletion_merchant_rpcs.sql",
  );
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(migration, /merchant_dish_view_events/);
  assert.match(migration, /dedupe_key text not null unique/);
  assert.match(migration, /merchant_notifications/);
  assert.match(migration, /merchant_email_outbox/);
  assert.match(migration, /promotion_item_type/);
  assert.match(migration, /original_price numeric/);
  assert.match(migration, /profile_photo_url text/);
  assert.match(migration, /merchant_notifications_owner_manager_write/);
  assert.match(hardening, /drop policy if exists "merchant_dish_views_public_insert"/);
  assert.match(hardening, /drop policy if exists "merchant_email_outbox_owner_manager_insert"/);
  assert.match(hardening, /revoke insert, update, delete on table merchant_dish_view_events/);
  assert.match(hardening, /revoke insert, update, delete on table merchant_email_outbox/);
  assert.match(hardening, /record_merchant_dish_view/);
  assert.match(hardening, /anonymous dish views require a bounded session id/);
  assert.match(hardening, /session id format is invalid/);
  assert.match(hardening, /dish view rate limit exceeded/);
  assert.match(hardening, /get_merchant_dish_view_counts/);
  assert.match(hardening, /app_enqueue_merchant_email/);
  assert.match(hardening, /enqueue_merchant_team_invite_email/);
  assert.match(hardening, /enqueue_merchant_weekly_summary_email/);
  assert.match(hardening, /security definer/);
  assert.match(hardening, /set search_path = public/);
  assert.match(service, /recordDishView/);
  assert.match(service, /rpc\("record_merchant_dish_view"/);
  assert.match(service, /getMerchantAnalyticsSessionId/);
  assert.match(service, /merchantAnonymousSessionId/);
  assert.match(service, /Dish view tracking is analytics only/);
  assert.doesNotMatch(
    service,
    /async recordDishView[\s\S]*if \(error\) throw error[\s\S]*async listDishesByVenue/,
  );
  assert.match(service, /recordMerchantActionEvent/);
  assert.match(service, /rpc\(\s*"record_merchant_action_event"/);
  assert.match(service, /rpc\(\s*"get_merchant_analytics"/);
  assert.match(service, /mapMerchantAnalyticsPayload/);
  assert.match(service, /rpc\(\s*"persist_merchant_weekly_summary"/);
  assert.doesNotMatch(service, /context\?\.sessionId \?\? context\?\.userId \?\? "anonymous"/);
  assert.doesNotMatch(service, /profileVisits: Math\.floor\(dishViewTotal \/ 2\)/);
  assert.doesNotMatch(service, /menuViews: dishViewTotal/);
  assert.doesNotMatch(service, /directionTaps: 0/);
  assert.doesNotMatch(service, /peakDiscoveryHours: \[\]/);
  assert.doesNotMatch(service, /customerTasteTags: \[\]/);
  assert.match(service, /getWeeklySummaryStats/);
  assert.match(service, /getMerchantNotifications/);
  assert.match(service, /syncLowRatingNotifications/);
  assert.match(service, /sendWeeklySummaryNotifications/);
  assert.match(service, /rpc\(\s*"enqueue_merchant_team_invite_email"/);
  assert.match(service, /rpc\(\s*"enqueue_merchant_weekly_summary_email"/);
  assert.doesNotMatch(service, /from\("merchant_dish_view_events"\)/);
  assert.doesNotMatch(service, /from\("merchant_email_outbox"\)/);
  assert.match(service, /bucket: "merchant-stall-images"/);
});

test("Supabase merchant analytics foundation uses RPC-backed dynamic events and rollups", () => {
  const migration = read("supabase/migrations/20260525120301_merchant_analytics_foundation.sql");
  const smoke = read("supabase/smoke/merchant_analytics_foundation.sql");
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const serviceTypes = read("src/lib/services/types.ts");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");
  const dishDetailV2 = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(migration, /create table if not exists public\.merchant_analytics_events/);
  assert.match(migration, /create table if not exists public\.merchant_promotion_events/);
  assert.match(migration, /create table if not exists public\.merchant_analytics_daily_rollups/);
  assert.match(migration, /create table if not exists public\.merchant_dish_analytics_daily/);
  assert.match(migration, /create table if not exists public\.merchant_weekly_summaries/);
  assert.match(migration, /create table if not exists public\.merchant_audit_logs/);
  assert.match(
    migration,
    /alter table public\.merchant_analytics_events enable row level security/,
  );
  assert.match(migration, /public\.merchant_can_manage_outlet_v2\(outlet_id\)/);
  assert.match(
    migration,
    /revoke insert, update, delete on table public\.merchant_analytics_events/,
  );
  assert.match(migration, /record_merchant_action_event/);
  assert.match(migration, /get_merchant_analytics/);
  assert.match(migration, /persist_merchant_weekly_summary/);
  assert.match(migration, /refresh_merchant_analytics_daily_rollup/);
  assert.match(migration, /refresh_merchant_dish_analytics_daily/);
  assert.match(migration, /merchant_promotions_title_required_length_chk/);
  assert.match(migration, /merchant_promotions_date_order_chk/);
  assert.match(migration, /merchant_promotions_discount_range_chk/);
  assert.match(migration, /merchant_promotions_discount_consistency_chk/);
  assert.match(migration, /merchant_promotions_existing_item_target_chk/);
  assert.match(migration, /merchant_promotions_active_available_chk/);
  assert.match(migration, /enforce_merchant_promotion_target_dish/);
  assert.match(migration, /trg_enforce_merchant_promotion_target_dish/);
  assert.match(migration, /v_dish_venue_id is distinct from v_outlet_venue_id/);
  assert.match(migration, /merchant_dish_view_events/);
  assert.match(migration, /merchant_promotion_events/);
  assert.match(migration, /dish_flavor_tags/);
  assert.match(migration, /reviews r/);

  assert.match(smoke, /merchant_analytics_events/);
  assert.match(smoke, /record_merchant_action_event/);
  assert.match(smoke, /get_merchant_analytics/);
  assert.match(smoke, /persist_merchant_weekly_summary/);
  assert.match(smoke, /rowsecurity/);

  assert.match(serviceTypes, /recordMerchantActionEvent/);
  assert.match(service, /recordMerchantActionEvent/);
  assert.match(service, /validateMerchantPromotionInput/);
  assert.match(service, /listPromotionOutletDishIds/);
  assert.match(service, /outletDishIds: await listPromotionOutletDishIds\(client, outlet\)/);
  assert.match(
    service,
    /updates\.finalPrice !== undefined \|\| updates\.promotionalPrice !== undefined/,
  );
  assert.match(stallDetail, /eventType: "stall_profile_view"/);
  assert.match(stallDetail, /eventType: "menu_view"/);
  assert.match(stallDetail, /eventType: "save"/);
  assert.match(stallDetail, /eventType: "share"/);
  assert.match(dishDetailV2, /eventType: "save"/);
  assert.match(dishDetailV2, /eventType: "share"/);
});

test("Supabase popular visitor pins are review-backed, merchant-managed, and public-active readable", () => {
  const migration = read("supabase/migrations/20260524041000_merchant_popular_visitor_pins.sql");
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(migration, /create table if not exists public\.merchant_popular_visitor_pins/);
  assert.match(migration, /outlet_id uuid not null references public\.merchant_outlets/);
  assert.match(migration, /venue_id text not null references public\.venues/);
  assert.match(migration, /review_id uuid not null references public\.reviews/);
  assert.match(migration, /unique \(outlet_id, review_id\)/);
  assert.match(migration, /idx_popular_visitor_pins_venue_active_order/);
  assert.match(migration, /normalize_merchant_popular_visitor_pin/);
  assert.match(migration, /new\.venue_id is distinct from outlet_venue_id/);
  assert.match(migration, /review_row\.venue_id is distinct from outlet_venue_id/);
  assert.match(
    migration,
    /new\.author_name := coalesce\(profile_row\.display_name, review_row\.author_name/,
  );
  assert.match(
    migration,
    /alter table public\.merchant_popular_visitor_pins enable row level security/,
  );
  assert.match(migration, /popular_visitor_pins_public_active_read/);
  assert.match(migration, /using \(is_active = true\)/);
  assert.match(migration, /public\.merchant_can_manage_outlet_v2\(outlet_id\)/);
  assert.match(migration, /mo\.venue_id = merchant_popular_visitor_pins\.venue_id/);
  assert.match(migration, /r\.id = merchant_popular_visitor_pins\.review_id/);
  assert.match(migration, /r\.venue_id = merchant_popular_visitor_pins\.venue_id/);

  assert.match(service, /listSupabasePopularVisitorPinsForVenue/);
  assert.match(service, /listSupabasePopularVisitorPinsForOutlet/);
  assert.match(service, /fetchSafeProfileRowsById/);
  assert.match(service, /public_profiles/);
  assert.match(service, /async listPopularVisitorCandidates/);
  assert.match(service, /async pinPopularVisitor/);
  assert.match(service, /const safeProfileId = profile \? profileId : undefined/);
  assert.match(service, /async reorderPopularVisitorPins/);
  assert.match(service, /failedUpdate\?\.error/);
});
