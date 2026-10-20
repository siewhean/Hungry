-- Smoke checks for 20261020060000_merchant_analytics_sgt_peak_hours.sql,
-- 20261020060400_merchant_notification_deep_links.sql and
-- 20261020060500_merchant_dashboard_summary.sql.
-- Peak discovery hours are Singapore hours; a low-rating alert links to
-- hungry://merchant/inbox; the dashboard summary counts the menu, dishes
-- without photos and unreplied reviews and returns the newest review, for the
-- outlet's team only. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0061-b000-000000000001
--   stranger: 00000000-0000-0061-b000-000000000002
--   diner:    00000000-0000-0061-b000-000000000003
--   account:  00000000-0000-0061-a000-000000000001
--   outlet:   00000000-0000-0061-d000-000000000001
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-md-building', 'Smoke MD Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values ('smoke-md-venue', 'smoke-md-building', 'Smoke MD Stall', '#01-02', 'L1', 1.301, 103.801);

insert into auth.users (id, email)
values
  ('00000000-0000-0061-b000-000000000001', 'md-owner@example.test'),
  ('00000000-0000-0061-b000-000000000002', 'md-stranger@example.test'),
  ('00000000-0000-0061-b000-000000000003', 'md-diner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0061-a000-000000000001',
  '00000000-0000-0061-b000-000000000001',
  'Smoke MD Merchant',
  'md-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values (
  '00000000-0000-0061-d000-000000000001', '00000000-0000-0061-a000-000000000001',
  'smoke-md-venue', 'smoke-md-building', 'Smoke MD Stall', 'hawker_stall', true
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0061-d000-000000000001', 'verified', now());

insert into dishes (
  id, venue_id, building_id, name, price, image_url,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-md-dish-1', 'smoke-md-venue', 'smoke-md-building', 'Laksa', 5, 'https://example.test/laksa.jpg',
   true, 'merchant_owned', true, 'merchant_owned'),
  ('smoke-md-dish-2', 'smoke-md-venue', 'smoke-md-building', 'Mee Siam', 4, null,
   true, 'merchant_owned', true, 'merchant_owned');

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text, created_at, merchant_reply_text)
values
  ('00000000-0000-0061-e000-000000000001', '00000000-0000-0061-b000-000000000003',
   'smoke-md-dish-1', 'smoke-md-venue', 'Diner A', 5, 'Great', now() - interval '2 days', 'Thanks!'),
  ('00000000-0000-0061-e000-000000000002', '00000000-0000-0061-b000-000000000003',
   'smoke-md-dish-1', 'smoke-md-venue', 'Diner B', 4, 'Good', now() - interval '1 day', null),
  ('00000000-0000-0061-e000-000000000003', '00000000-0000-0061-b000-000000000003',
   'smoke-md-dish-2', 'smoke-md-venue', 'Diner C', 2, 'Too salty', now() - interval '1 hour', null);

-- 12:30 in Singapore is 04:30 UTC. Three events then, one at 01:15 SGT.
insert into merchant_analytics_events (
  merchant_account_id, outlet_id, venue_id, session_id, event_type, dedupe_key, occurred_at
)
select
  '00000000-0000-0061-a000-000000000001', '00000000-0000-0061-d000-000000000001',
  'smoke-md-venue', 'smoke-md-session-' || n, 'stall_profile_view', 'smoke-md-' || n,
  date_trunc('day', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore'
    - interval '1 day' + case when n <= 3 then interval '12 hours 30 minutes' else interval '1 hour 15 minutes' end
from generate_series(1, 4) as n;

-- 1. Low-rating alert deep link.
do $$
begin
  if (
    select deep_link from public.merchant_notifications
    where dedupe_key = 'low-rating:00000000-0000-0061-e000-000000000003'
  ) is distinct from 'hungry://merchant/inbox' then
    raise exception 'low-rating alert deep link is not hungry://merchant/inbox';
  end if;
end $$;

-- 2. Owner reads analytics and the dashboard summary.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0061-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_analytics jsonb;
  v_summary jsonb;
begin
  v_analytics := app_private.get_merchant_analytics(
    '00000000-0000-0061-d000-000000000001', now() - interval '7 days', now()
  );
  if v_analytics->'peakDiscoveryHours' <> '[12, 1]'::jsonb then
    raise exception 'peak hours are not Singapore hours: %', v_analytics->'peakDiscoveryHours';
  end if;

  v_summary := public.get_merchant_dashboard_summary('00000000-0000-0061-d000-000000000001');
  if (v_summary->>'menuCount')::integer <> 2
     or (v_summary->>'dishesWithoutImages')::integer <> 1
     or (v_summary->>'unrepliedReviews')::integer <> 2
     or v_summary->'latestReview'->>'authorName' <> 'Diner C' then
    raise exception 'unexpected dashboard summary: %', v_summary;
  end if;
end $$;

reset role;

-- 3. Someone outside the outlet's team gets nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0061-b000-000000000002', true);
set local role authenticated;

do $$
begin
  begin
    perform public.get_merchant_dashboard_summary('00000000-0000-0061-d000-000000000001');
    raise exception 'stranger read the dashboard summary';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.get_merchant_dashboard_summary(uuid)', 'execute') then
    raise exception 'anon can execute get_merchant_dashboard_summary';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.get_merchant_dashboard_summary(uuid)'::regprocedure) then
    raise exception 'get_merchant_dashboard_summary must be SECURITY INVOKER';
  end if;
end $$;

select 'merchant_dashboard_analytics_followups_passed' as result;

rollback;
