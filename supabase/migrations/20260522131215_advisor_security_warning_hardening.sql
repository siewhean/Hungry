-- Reduce app-owned Supabase Security Advisor warnings without changing
-- extension-owned PostGIS objects or intentionally authenticated RPC entry
-- points. The remaining PostGIS owner work is tracked separately.

-- The advisor flags these immutable helper functions because their
-- search_path was not pinned. Keep the same logic and pin resolution.
alter function public.food_cred_level_index(integer)
set search_path = public, pg_temp;

alter function public.food_cred_default_points(text)
set search_path = public, pg_temp;

alter function public.food_cred_daily_cap(text)
set search_path = public, pg_temp;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Tighten
-- app-owned SECURITY DEFINER functions so unauthenticated callers cannot hit
-- them directly via /rest/v1/rpc/*. Authenticated/service-role grants remain
-- where the app intentionally uses checked RPCs.
revoke execute on function public.app_is_current_user_ops_admin()
from public, anon;

revoke execute on function public.app_user_block_exists(uuid, uuid)
from public, anon;

revoke execute on function public.award_food_cred(text, text, text, integer)
from public, anon;

revoke execute on function public.can_access_conversation(uuid)
from public, anon;

revoke execute on function public.can_read_author_content(uuid)
from public, anon;

revoke execute on function public.can_read_post(uuid)
from public, anon;

revoke execute on function public.cancel_merchant_change_request(uuid)
from public, anon;

revoke execute on function public.enqueue_merchant_team_invite_email(uuid, text, uuid, text, text)
from public, anon;

revoke execute on function public.enqueue_merchant_weekly_summary_email(uuid, uuid, text, text, text, text, text)
from public, anon;

revoke execute on function public.get_merchant_change_request_detail(uuid)
from public, anon;

revoke execute on function public.get_merchant_dish_view_counts(uuid, timestamptz, timestamptz)
from public, anon;

revoke execute on function public.increment_mission_progress(text)
from public, anon;

revoke execute on function public.is_merchant_member(uuid)
from public, anon;

revoke execute on function public.is_platform_operator()
from public, anon;

revoke execute on function public.list_content_moderation_queue(integer)
from public, anon;

revoke execute on function public.list_merchant_change_requests(uuid, text, timestamptz, uuid, integer)
from public, anon;

revoke execute on function public.merchant_can_manage_legacy_outlet(uuid)
from public, anon;

revoke execute on function public.merchant_can_manage_organization(uuid)
from public, anon;

revoke execute on function public.merchant_can_manage_outlet_v2(uuid)
from public, anon;

revoke execute on function public.merchant_can_view_organization(uuid)
from public, anon;

revoke execute on function public.merchant_is_org_member(uuid)
from public, anon;

revoke execute on function public.record_merchant_dish_view(text, text)
from public, anon;

revoke execute on function public.record_taste_interaction_event(
  text,
  text,
  double precision[],
  double precision[],
  text,
  text,
  text,
  text,
  numeric,
  boolean,
  numeric,
  text,
  timestamptz,
  jsonb
)
from public, anon;

revoke execute on function public.report_content(text, text, text, text)
from public, anon;

revoke execute on function public.report_post(uuid, text, text)
from public, anon;

revoke execute on function public.review_merchant_change_request(uuid, text, text)
from public, anon;

revoke execute on function public.send_chat_message(uuid, text, text, uuid)
from public, anon;

revoke execute on function public.submit_menu_photo(text, text, text, integer)
from public, anon;

revoke execute on function public.submit_merchant_change_request(uuid, text, text, text, jsonb, uuid, text, text)
from public, anon;

revoke execute on function public.submit_merchant_claim_interest(text, text, text, text, text, text)
from public, anon;

revoke execute on function public.sync_home_feed_item_for_post()
from public, anon;

revoke execute on function public.sync_post_engagement_counts()
from public, anon;

revoke execute on function public.upsert_stall_interaction(text, boolean, boolean, boolean)
from public, anon;
