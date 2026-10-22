-- smoke: supabase/smoke/api_request_rate_limits.sql
-- Endpoint rate limiting for the REST API (PostgREST) and the Edge Functions.
--
-- Supabase has no per-caller limit on /rest/v1, so before this anyone with the public anon key
-- (or any free account) could call a catalog search RPC or an insert path thousands of times a
-- minute. PostgREST runs one function before every request (pgrst.db_pre_request). This migration
-- points it at app_private.check_request_rate(), which counts requests per caller per route per
-- minute and answers HTTP 429 once a route's cap is passed.
--
-- How it counts
--   * Caller: the signed-in user id (JWT sub) for role authenticated, the client IP for role anon.
--     service_role (Edge Functions, workers) is never limited.
--   * Only POST/PATCH/PUT/DELETE can be counted: PostgREST runs GET and HEAD in a read-only
--     transaction, where the counter cannot be written. The app only ever calls RPCs with POST, so
--     GET /rpc/* is refused outright (405); otherwise a stable RPC could be hammered over GET and
--     skip the counter.
--   * Routes are request paths without the leading slash: 'rpc/<function>' or '<table>'. A route with
--     a row in app_private.request_rate_rules gets its own counter and caps. Every other route shares
--     the '*' row, one combined counter per caller, so unknown paths cannot create counter rows.
--   * Fail open: if the counter itself errors, the request goes through (a limiter bug must not
--     take the API down). Rejecting a request is the only thing that raises.
--
-- Not covered here (cannot be counted in the database): GET reads of tables that anon may select
-- (RLS and max_rows only), Auth endpoints (config.toml [auth.rate_limit]), and the raw number of
-- Edge Function invocations (edge functions call app_can_make_ip_request below).
--
-- Add a cap for a new anon RPC or Edge Function in a new migration (insert into
-- app_private.request_rate_rules ... on conflict). `npm run check:rate-limits` fails CI when an
-- anon-callable RPC has neither a rule nor an entry in supabase/rate-limit-allowlist.json.
--
-- Rollback: supabase/rollbacks/20261022120000_api_request_rate_limits.down.sql. To switch only the
-- limiter off at once (nothing else changes):
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create table if not exists app_private.request_rate_rules (
  route text primary key,
  anon_per_minute integer check (anon_per_minute is null or anon_per_minute > 0),
  user_per_minute integer check (user_per_minute is null or user_per_minute > 0),
  note text
);

-- Counters are throwaway, so UNLOGGED keeps the write cost per request low.
create unlogged table if not exists app_private.request_rate_counters (
  key text not null,
  bucket timestamptz not null,
  hits integer not null default 0,
  primary key (key, bucket)
);

alter table app_private.request_rate_rules enable row level security;
alter table app_private.request_rate_counters enable row level security;
revoke all on table app_private.request_rate_rules from public, anon, authenticated;
revoke all on table app_private.request_rate_counters from public, anon, authenticated;

-- Caps are requests per minute: anon_per_minute is per client IP, user_per_minute per signed-in
-- user. A null cap on a route means that caller type uses the '*' default instead.
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('*', 120, 300, 'every route without its own row, one combined counter per caller'),

  -- Guest-readable catalog reads (the expensive ones: search, distance, fuzzy match).
  ('rpc/catalog_raw_dishes_page', 90, 120, 'catalog dish search and paging'),
  ('rpc/catalog_raw_venues_page', 90, 120, 'catalog stall search and paging'),
  ('rpc/catalog_raw_venue_menu_page', 90, 120, 'stall menu paging'),
  ('rpc/catalog_raw_map_view', 90, 120, 'map viewport query (350 ms debounce in the app)'),
  ('rpc/catalog_raw_places', 60, 90, 'mall / hawker centre search'),
  ('rpc/catalog_suggest', 150, 200, 'search typeahead (200 ms debounce in the app)'),
  ('rpc/catalog_raw_dish_detail', 120, 180, 'dish detail'),
  ('rpc/catalog_raw_venue_detail', 120, 180, 'stall detail'),
  ('rpc/search_dishes', 60, 90, 'legacy search'),
  ('rpc/search_venues_by_location', 60, 90, 'legacy search'),
  ('rpc/get_discovery_feed_by_location', 60, 90, 'discovery feed'),
  ('rpc/get_nearby_open_venues', 60, 90, 'open-now query'),
  ('rpc/get_dish_detail', 120, 180, 'dish detail'),
  ('rpc/get_venue_detail', 120, 180, 'stall detail'),
  ('rpc/get_building_detail', 120, 180, 'building detail'),
  ('rpc/list_buildings', 60, 90, 'building list'),
  ('rpc/list_venues_by_building', 60, 90, 'stalls in a building'),
  ('rpc/count_venues_in_area', 60, 90, 'area count'),
  ('rpc/count_venues_in_planning_area', 60, 90, 'area count'),
  ('rpc/get_public_home_feed', 60, 90, 'guest home feed'),
  ('rpc/get_home_social_feed', 60, 90, 'home feed'),
  ('rpc/get_home_social_feed_v2', 60, 90, 'home feed'),
  ('rpc/get_home_social_feed_v3', 60, 90, 'home feed'),
  ('rpc/get_post_by_id', 120, 180, 'single post'),
  ('rpc/get_profile_card', 120, 180, 'profile card'),
  ('rpc/get_public_merchant_profile', 120, 180, 'merchant profile'),
  ('rpc/get_public_portfolio', 120, 180, 'public list'),
  ('rpc/get_user_profile_reviews', 60, 90, 'profile reviews'),
  ('rpc/get_follow_counts', 120, 180, 'follow counts'),
  ('rpc/get_taste_recommendations', 60, 90, 'taste engine'),
  ('rpc/list_customer_active_promotions', 60, 90, 'promotions list'),
  ('rpc/search_profiles', null, 60, 'people search'),
  ('rpc/search_portfolios', null, 60, 'list search'),

  -- Anonymous-callable writes (analytics counters).
  ('rpc/record_merchant_dish_view', 120, 180, 'merchant analytics counter'),
  ('rpc/record_merchant_action_event', 120, 180, 'merchant analytics counter'),

  -- Executable by anon through default grants but not meant for a loop; they check the caller
  -- inside (or run as the caller under RLS), so this only contains the cost of probing them.
  ('rpc/hide_post', 10, 60, 'hide a post from my feed'),
  ('rpc/unhide_post', 10, 60, 'unhide a post'),
  ('rpc/set_post_moderation_state', 5, 10, 'moderation action'),
  ('rpc/promote_staging_to_production', 2, 2, 'bulk catalog import, run by ops from the database'),

  -- Heavy or abusable signed-in RPCs.
  ('rpc/export_my_data', null, 3, 'builds the whole data export'),
  ('rpc/request_my_account_deletion', null, 3, 'account deletion request'),
  ('rpc/cancel_my_account_deletion', null, 5, 'account deletion cancel'),
  ('rpc/send_chat_message', null, 60, 'chat'),
  ('rpc/open_chat_conversation', null, 30, 'chat'),
  ('rpc/report_content', null, 10, 'moderation report'),
  ('rpc/report_post', null, 10, 'moderation report'),
  ('rpc/submit_catalog_correction', null, 10, 'catalog correction'),
  ('rpc/submit_menu_photo', null, 10, 'menu photo upload record'),
  ('rpc/submit_user_stall_submission', null, 10, 'new stall submission'),
  ('rpc/submit_merchant_claim_interest', null, 5, 'merchant claim'),
  ('rpc/submit_merchant_change_request', null, 10, 'merchant change request'),
  ('rpc/follow_user', null, 30, 'follow'),
  ('rpc/block_user', null, 20, 'block'),
  ('rpc/remove_follower', null, 20, 'remove follower'),
  ('rpc/approve_follow_request', null, 30, 'follow request'),
  ('rpc/decline_follow_request', null, 30, 'follow request'),
  ('rpc/cancel_follow_request', null, 30, 'follow request'),
  ('rpc/register_push_token', null, 10, 'push token'),
  ('rpc/unregister_push_token', null, 10, 'push token'),
  ('rpc/record_taste_interaction_event', null, 120, 'taste telemetry'),
  ('rpc/record_app_open', null, 20, 'app open telemetry'),
  ('rpc/record_passport_progress', null, 60, 'passport progress'),
  ('rpc/increment_mission_progress', null, 60, 'mission progress'),
  ('rpc/award_food_cred', null, 60, 'points'),
  ('rpc/set_dish_tried', null, 60, 'dish tried'),
  ('rpc/upsert_stall_interaction', null, 60, 'stall interaction'),
  ('rpc/merchant_save_dish', null, 30, 'merchant menu write'),
  ('rpc/merchant_remove_dish', null, 30, 'merchant menu write'),
  ('rpc/merchant_set_dish_availability_flag', null, 30, 'merchant menu write'),
  ('rpc/publish_portfolio_with_passport', null, 10, 'publish list'),
  ('rpc/add_portfolio_item_with_passport', null, 30, 'list item'),

  -- Direct table writes through PostgREST (any non-GET method on the table counts).
  ('reviews', null, 20, 'reviews'),
  ('review_photos', null, 40, 'review photos'),
  ('review_helpful_votes', null, 60, 'helpful votes'),
  ('posts', null, 20, 'posts'),
  ('post_comments', null, 30, 'comments'),
  ('post_media', null, 40, 'post photos'),
  ('post_shares', null, 60, 'shares'),
  ('stall_follows', null, 30, 'stall follows'),
  ('portfolio_follows', null, 30, 'list follows'),
  ('portfolios', null, 20, 'lists'),
  ('portfolio_collaborators', null, 20, 'list collaborators'),
  ('portfolio_flags', null, 10, 'list flags'),
  ('user_stall_submissions', null, 10, 'stall submissions'),
  ('customer_interaction_reports', null, 10, 'interaction reports'),
  ('merchant_verifications', null, 10, 'merchant verification'),
  ('merchant_verification_evidence', null, 20, 'merchant evidence'),
  ('merchant_promotions', null, 20, 'merchant promotions'),
  ('merchant_roles', null, 20, 'merchant team'),
  ('quiz_responses', null, 30, 'taste quiz'),
  ('taste_interaction_events', null, 120, 'taste telemetry'),
  ('recommendation_impressions', null, 120, 'recommendation telemetry'),
  ('read_receipts', null, 120, 'chat read receipts'),
  ('user_favourite_dishes', null, 60, 'favourites'),
  ('user_blocks', null, 20, 'blocks')
on conflict (route) do update
set anon_per_minute = excluded.anon_per_minute,
    user_per_minute = excluded.user_per_minute,
    note = excluded.note;

create or replace function app_private.check_request_rate()
returns void
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_method text := upper(coalesce(current_setting('request.method', true), ''));
  v_route text := regexp_replace(ltrim(coalesce(current_setting('request.path', true), ''), '/'), '/+$', '');
  v_claims jsonb;
  v_headers jsonb;
  v_role text;
  v_who text;
  v_default record;
  v_rule record;
  v_cap integer;
  v_key text;
  v_hits integer := 0;
  v_over boolean := false;
begin
  if v_route = '' or v_method in ('', 'OPTIONS') then
    return;
  end if;

  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    v_claims := null;
  end;
  v_role := coalesce(v_claims ->> 'role', 'anon');
  -- service_role (Edge Functions, workers) and any other role are never limited.
  if v_role not in ('anon', 'authenticated') then
    return;
  end if;

  if v_method in ('GET', 'HEAD') then
    -- A read-only transaction cannot write the counter, so RPCs over GET would skip the limit.
    -- The app calls every RPC with POST.
    if v_route like 'rpc/%' then
      raise sqlstate 'PGRST' using
        message = '{"code":"method_not_allowed","message":"Call RPCs with POST","details":null,"hint":null}',
        detail = '{"status":405,"headers":{"Allow":"POST"}}';
    end if;
    return;
  end if;

  begin
    select anon_per_minute, user_per_minute into v_default
    from app_private.request_rate_rules where route = '*';
    select anon_per_minute, user_per_minute into v_rule
    from app_private.request_rate_rules where route = v_route;

    if v_role = 'authenticated' then
      v_who := 'u:' || coalesce(v_claims ->> 'sub', '');
      v_cap := coalesce(v_rule.user_per_minute, v_default.user_per_minute);
    else
      begin
        v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
      exception when others then
        v_headers := null;
      end;
      v_who := 'ip:' || coalesce(
        nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
        nullif(btrim(v_headers ->> 'x-real-ip'), ''),
        nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
        ''
      );
      v_cap := coalesce(v_rule.anon_per_minute, v_default.anon_per_minute);
    end if;

    -- No usable caller identity (no IP, no sub), or no default row: nothing to count against.
    if v_cap is null or v_who in ('u:', 'ip:') then
      return;
    end if;

    -- A route with its own cap for this caller type counts on its own; everything else shares '*'.
    v_key := v_who || '|' || case
      when v_role = 'authenticated' and v_rule.user_per_minute is not null then v_route
      when v_role = 'anon' and v_rule.anon_per_minute is not null then v_route
      else '*'
    end;

    insert into app_private.request_rate_counters (key, bucket, hits)
    values (v_key, date_trunc('minute', now()), 1)
    on conflict (key, bucket) do update
      set hits = app_private.request_rate_counters.hits + 1
    returning hits into v_hits;

    v_over := v_hits > v_cap;
  exception when others then
    -- Fail open.
    return;
  end;

  if v_over then
    raise sqlstate 'PGRST' using
      message = '{"code":"rate_limited","message":"Too many requests","details":null,"hint":"Slow down and try again in a minute."}',
      detail = '{"status":429,"headers":{"Retry-After":"60"}}';
  end if;
end;
$$;

revoke all on function app_private.check_request_rate() from public;
grant execute on function app_private.check_request_rate() to anon, authenticated, service_role;

-- For Edge Functions: count one call for an IP address (or any caller key) and say whether it is
-- still within p_limit per minute. Same counters, so one prune job covers both.
create or replace function public.app_can_make_ip_request(
  p_ip text,
  p_action text,
  p_limit integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_hits integer;
begin
  if coalesce(btrim(p_ip), '') = '' then
    -- No IP to count against: do not lock everyone out.
    return true;
  end if;
  insert into app_private.request_rate_counters (key, bucket, hits)
  values ('edge:' || p_action || '|ip:' || btrim(p_ip), date_trunc('minute', now()), 1)
  on conflict (key, bucket) do update
    set hits = app_private.request_rate_counters.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.app_can_make_ip_request(text, text, integer) from public, anon, authenticated;
grant execute on function public.app_can_make_ip_request(text, text, integer) to service_role;

-- Counters older than an hour are of no use.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'prune-request-rate-counters') then
      perform cron.unschedule('prune-request-rate-counters');
    end if;
    perform cron.schedule(
      'prune-request-rate-counters',
      '*/10 * * * *',
      $job$delete from app_private.request_rate_counters where bucket < now() - interval '1 hour'$job$
    );
  end if;
end;
$$;

-- Switch it on. PostgREST reads this setting when it reloads its config.
alter role authenticator set pgrst.db_pre_request = 'app_private.check_request_rate';
notify pgrst, 'reload config';
