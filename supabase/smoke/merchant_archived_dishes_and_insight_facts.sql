-- Smoke checks for 20261029140000_merchant_archived_dishes_and_insight_facts.sql.
-- A removed (archived) dish is out of the Home feed's top dish and has_menu and out of
-- get_dish_detail; a Featured dish leads the feed's top dish; the dashboard summary does not count
-- archived dishes; get_merchant_insight_facts returns the counts for the outlet's team only.
-- Runs in a transaction and rolls back. Brings its own building, so it runs on prod too.
--   owner:    00000000-0000-0071-b000-000000000001
--   stranger: 00000000-0000-0071-b000-000000000002
--   account:  00000000-0000-0071-a000-000000000001
--   outlet:   00000000-0000-0071-d000-000000000001

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values ('smoke-ar-building', 'smoke-ar-building', 'Smoke AR Building', 'hawker_centre', 1.4601, 103.6101, array['01']);

insert into venues (id, building_id, name, unit_number, floor)
values
  ('smoke-ar-venue', 'smoke-ar-building', 'Smoke AR Stall', '#01-01', '01'),
  ('smoke-ar-empty', 'smoke-ar-building', 'Smoke AR Removed-only Stall', '#01-02', '01');

insert into auth.users (id, email)
values
  ('00000000-0000-0071-b000-000000000001', 'ar-owner@example.test'),
  ('00000000-0000-0071-b000-000000000002', 'ar-stranger@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values ('00000000-0000-0071-a000-000000000001', '00000000-0000-0071-b000-000000000001', 'Smoke AR Merchant', 'ar-owner@example.test');

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values (
  '00000000-0000-0071-d000-000000000001', '00000000-0000-0071-a000-000000000001',
  'smoke-ar-venue', 'smoke-ar-building', 'Smoke AR Stall', 'hawker_stall', true
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0071-d000-000000000001', 'verified', now());

-- smoke-ar-plain is a must-order dish and would win the top dish on its own; smoke-ar-pick is
-- Featured and must beat it; smoke-ar-gone is archived and must never be named.
insert into dishes (
  id, venue_id, building_id, name, price, must_order, availability_flags, archived_at,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-ar-plain', 'smoke-ar-venue', 'smoke-ar-building', 'Plain Noodles', 4, true, '{}', null,
   true, 'merchant_owned', true, 'merchant_owned'),
  ('smoke-ar-pick', 'smoke-ar-venue', 'smoke-ar-building', 'Pick Laksa', 5, false, '{featured,sold_out}', null,
   true, 'merchant_owned', true, 'merchant_owned'),
  ('smoke-ar-gone', 'smoke-ar-venue', 'smoke-ar-building', 'Removed Rice', 6, true, '{featured}', now(),
   true, 'merchant_owned', true, 'merchant_owned'),
  ('smoke-ar-only-gone', 'smoke-ar-empty', 'smoke-ar-building', 'Removed Only', 6, true, '{}', now(),
   true, 'merchant_owned', true, 'merchant_owned');

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text, created_at, merchant_reply_text)
select
  '00000000-0000-0071-e000-000000000001', '00000000-0000-0071-b000-000000000002',
  'smoke-ar-pick', 'smoke-ar-venue', 'Diner A', 4, 'Good', now() - interval '1 day', null;

-- 1. The feed: featured beats must-order, archived is never the top dish, a stall with only a
-- removed dish has no top dish.
do $$
declare
  v_top text;
  v_empty_top text;
  v_empty_rows integer;
begin
  select feed.top_dish_id into v_top
  from public.get_discovery_feed_by_location(null, 1.4601, 103.6101, 2000, 100) feed
  where feed.venue_id = 'smoke-ar-venue';
  if v_top is distinct from 'smoke-ar-pick' then
    raise exception 'the featured dish should be the top dish, got %', v_top;
  end if;

  select count(*), max(feed.top_dish_id) into v_empty_rows, v_empty_top
  from public.get_discovery_feed_by_location(null, 1.4601, 103.6101, 2000, 100) feed
  where feed.venue_id = 'smoke-ar-empty';
  if v_empty_top is not null then
    raise exception 'an archived dish was named as the top dish: %', v_empty_top;
  end if;
end $$;

-- 2. The dish page: guests cannot open a removed dish.
set local role anon;

do $$
begin
  if not exists (select 1 from public.get_dish_detail('smoke-ar-pick')) then
    raise exception 'a live dish should open';
  end if;
  if exists (select 1 from public.get_dish_detail('smoke-ar-gone')) then
    raise exception 'an archived dish must not open';
  end if;
end $$;

reset role;

-- 3. The owner: dashboard counts and insight facts skip archived dishes.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_summary jsonb;
  v_facts jsonb;
begin
  v_summary := public.get_merchant_dashboard_summary('00000000-0000-0071-d000-000000000001');
  if (v_summary->>'menuCount')::integer <> 2 or (v_summary->>'dishesWithoutImages')::integer <> 2 then
    raise exception 'dashboard summary counted an archived dish: %', v_summary;
  end if;

  v_facts := public.get_merchant_insight_facts('00000000-0000-0071-d000-000000000001');
  if (v_facts->>'dishCount')::integer <> 2
     or (v_facts->>'dishesWithoutPhoto')::integer <> 2
     or (v_facts->>'soldOutCount')::integer <> 1
     or v_facts->'soldOutNames' <> '["Pick Laksa"]'::jsonb
     or (v_facts->>'unrepliedReviews')::integer <> 1
     or (v_facts->>'reviewsLast7Days')::integer <> 1 then
    raise exception 'unexpected insight facts: %', v_facts;
  end if;
end $$;

reset role;

-- 4. Someone outside the outlet's team gets nothing; anon cannot call; the function is invoker.
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000002', true);
set local role authenticated;

do $$
begin
  begin
    perform public.get_merchant_insight_facts('00000000-0000-0071-d000-000000000001');
    raise exception 'stranger read the insight facts';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.get_merchant_insight_facts(uuid)', 'execute') then
    raise exception 'anon can execute get_merchant_insight_facts';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.get_merchant_insight_facts(uuid)'::regprocedure) then
    raise exception 'get_merchant_insight_facts must be SECURITY INVOKER';
  end if;
end $$;

select 'merchant_archived_dishes_and_insight_facts_passed' as result;

rollback;
