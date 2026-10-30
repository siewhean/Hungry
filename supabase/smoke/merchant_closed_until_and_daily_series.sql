-- Smoke checks for 20261029150000_merchant_closed_until_and_daily_series.sql.
-- A stall with closed_until in the future reads as "Closed today" / "Reopens <date>" on the
-- public merchant profile (guests included) and as its free-text closure once the date passes;
-- the daily series is zero-filled per Singapore day, team-only, capped at 31 days, and not
-- callable by guests; a stall can feature at most three dishes; get_venue_closures lists the
-- stalls with an active closure (guests included); a closure more than 60 days ahead is refused.
-- Runs in a transaction and rolls back. Brings its own building.
--   owner:    00000000-0000-0072-b000-000000000001
--   stranger: 00000000-0000-0072-b000-000000000002
--   account:  00000000-0000-0072-a000-000000000001
--   outlet:   00000000-0000-0072-d000-000000000001

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values ('smoke-cu-building', 'smoke-cu-building', 'Smoke CU Building', 'hawker_centre', 1.4701, 103.6201, array['01']);

insert into venues (id, building_id, name, unit_number, floor)
values ('smoke-cu-venue', 'smoke-cu-building', 'Smoke CU Stall', '#01-01', '01');

insert into auth.users (id, email)
values
  ('00000000-0000-0072-b000-000000000001', 'cu-owner@example.test'),
  ('00000000-0000-0072-b000-000000000002', 'cu-stranger@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values ('00000000-0000-0072-a000-000000000001', '00000000-0000-0072-b000-000000000001', 'Smoke CU Merchant', 'cu-owner@example.test');

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values (
  '00000000-0000-0072-d000-000000000001', '00000000-0000-0072-a000-000000000001',
  'smoke-cu-venue', 'smoke-cu-building', 'Smoke CU Stall', 'hawker_stall', true
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0072-d000-000000000001', 'verified', now());

-- Two profile visits yesterday (SGT), one today.
insert into merchant_analytics_events (
  merchant_account_id, outlet_id, venue_id, session_id, event_type, dedupe_key, occurred_at
)
select
  '00000000-0000-0072-a000-000000000001', '00000000-0000-0072-d000-000000000001',
  'smoke-cu-venue', 'smoke-cu-session-' || n, 'stall_profile_view', 'smoke-cu-' || n,
  case when n <= 2
    then (date_trunc('day', now() at time zone 'Asia/Singapore') - interval '12 hours') at time zone 'Asia/Singapore'
    else now() - interval '1 minute' end
from generate_series(1, 3) as n;

-- 1. Closed today / closed until, read as a guest.
set local role anon;

do $$
begin
  if (select temporary_closure from public.get_public_merchant_profile('smoke-cu-venue')) is not null then
    raise exception 'an open stall should have no closure text';
  end if;
end $$;

reset role;

update merchant_outlets
set closed_until = (date_trunc('day', now() at time zone 'Asia/Singapore') + interval '1 day') at time zone 'Asia/Singapore'
where id = '00000000-0000-0072-d000-000000000001';

set local role anon;

do $$
begin
  if (select temporary_closure from public.get_public_merchant_profile('smoke-cu-venue')) is distinct from 'Closed today' then
    raise exception 'closed until midnight should read Closed today, got %',
      (select temporary_closure from public.get_public_merchant_profile('smoke-cu-venue'));
  end if;
end $$;

reset role;

update merchant_outlets
set closed_until = (date_trunc('day', now() at time zone 'Asia/Singapore') + interval '5 days') at time zone 'Asia/Singapore'
where id = '00000000-0000-0072-d000-000000000001';

set local role anon;

do $$
declare
  v_expected text := 'Reopens ' || to_char(date_trunc('day', now() at time zone 'Asia/Singapore') + interval '5 days', 'FMDD Mon');
begin
  if (select temporary_closure from public.get_public_merchant_profile('smoke-cu-venue')) is distinct from v_expected then
    raise exception 'expected %, got %', v_expected,
      (select temporary_closure from public.get_public_merchant_profile('smoke-cu-venue'));
  end if;
  -- The batched closure read agrees (and ignores stalls that are not paused).
  if (select count(*) from public.get_venue_closures(array['smoke-cu-venue', 'smoke-cu-not-a-venue'])) <> 1 then
    raise exception 'get_venue_closures should list the paused stall only';
  end if;
end $$;

reset role;

-- A date in the past is ignored; the free-text closure shows again.
update merchant_outlets
set closed_until = now() - interval '1 hour', temporary_closure = 'Renovating'
where id = '00000000-0000-0072-d000-000000000001';

set local role anon;

do $$
begin
  if (select temporary_closure from public.get_public_merchant_profile('smoke-cu-venue')) is distinct from 'Renovating' then
    raise exception 'an expired closed_until should fall back to the free-text closure';
  end if;
  if exists (select 1 from public.get_venue_closures(array['smoke-cu-venue'])) then
    raise exception 'an expired closed_until must not count as a closure';
  end if;
end $$;

reset role;

-- 2. Daily series: owner reads it; zero-filled; capped; stranger and guest cannot.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0072-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_series jsonb;
begin
  v_series := public.get_merchant_daily_series(
    '00000000-0000-0072-d000-000000000001',
    (date_trunc('day', now() at time zone 'Asia/Singapore') - interval '2 days') at time zone 'Asia/Singapore',
    null
  );
  if jsonb_array_length(v_series) <> 3 then
    raise exception 'expected 3 days, got %', v_series;
  end if;
  if (v_series->0->>'profileVisits')::integer <> 0
     or (v_series->1->>'profileVisits')::integer <> 2
     or (v_series->2->>'profileVisits')::integer <> 1 then
    raise exception 'unexpected daily visits: %', v_series;
  end if;
  begin
    perform public.get_merchant_daily_series('00000000-0000-0072-d000-000000000001', now() - interval '40 days', null);
    raise exception 'a 40 day range should be refused';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0072-b000-000000000002', true);
set local role authenticated;

do $$
begin
  begin
    perform public.get_merchant_daily_series('00000000-0000-0072-d000-000000000001', null, null);
    raise exception 'stranger read the daily series';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.get_merchant_daily_series(uuid, timestamptz, timestamptz)', 'execute') then
    raise exception 'anon can execute get_merchant_daily_series';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.get_merchant_daily_series(uuid, timestamptz, timestamptz)'::regprocedure) then
    raise exception 'the public daily series wrapper must be SECURITY INVOKER';
  end if;
  if not exists (select 1 from app_private.request_rate_rules where route = 'rpc/get_merchant_daily_series') then
    raise exception 'the daily series rate rule is missing';
  end if;
end $$;

-- 2b. A closure more than 60 days ahead is refused for the merchant; 5 days ahead is fine.
select set_config('request.jwt.claim.sub', '00000000-0000-0072-b000-000000000001', true);
set local role authenticated;

do $$
begin
  update merchant_outlets
  set closed_until = now() + interval '5 days'
  where id = '00000000-0000-0072-d000-000000000001';
  begin
    update merchant_outlets
    set closed_until = now() + interval '90 days'
    where id = '00000000-0000-0072-d000-000000000001';
    raise exception 'a 90 day closure should be refused';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

reset role;

do $$
begin
  if not has_function_privilege('anon', 'public.get_venue_closures(text[])', 'execute') then
    raise exception 'anon should be able to execute get_venue_closures';
  end if;
  if not exists (select 1 from app_private.request_rate_rules where route = 'rpc/get_venue_closures') then
    raise exception 'the get_venue_closures rate rule is missing';
  end if;
end $$;

-- 3. Featured dishes: three at most, per stall, however the flag is set.
select set_config('request.jwt.claim.sub', '00000000-0000-0072-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_id text;
begin
  for v_id in select unnest(array['smoke-cu-dish-1', 'smoke-cu-dish-2', 'smoke-cu-dish-3']) loop
    perform public.merchant_save_dish(
      v_id, 'smoke-cu-venue', 'smoke-cu-building',
      jsonb_build_object('name', v_id, 'price', 5, 'availability_flags', jsonb_build_array('featured'))
    );
  end loop;
  perform public.merchant_save_dish(
    'smoke-cu-dish-4', 'smoke-cu-venue', 'smoke-cu-building',
    jsonb_build_object('name', 'smoke-cu-dish-4', 'price', 6)
  );

  begin
    perform public.merchant_set_dish_availability_flag('smoke-cu-dish-4', 'smoke-cu-venue', 'featured', true);
    raise exception 'a fourth featured dish should be refused';
  exception when check_violation then
    null;
  end;
  begin
    perform public.merchant_save_dish(
      'smoke-cu-dish-4', 'smoke-cu-venue', 'smoke-cu-building',
      jsonb_build_object('availability_flags', jsonb_build_array('Featured'))
    );
    raise exception 'saving a fourth featured dish should be refused';
  exception when check_violation then
    null;
  end;

  -- An already featured dish can still be edited and kept featured.
  perform public.merchant_save_dish(
    'smoke-cu-dish-1', 'smoke-cu-venue', 'smoke-cu-building',
    jsonb_build_object('price', 7, 'availability_flags', jsonb_build_array('featured', 'sold_out'))
  );

  -- Freeing a slot lets the fourth in.
  perform public.merchant_set_dish_availability_flag('smoke-cu-dish-1', 'smoke-cu-venue', 'featured', false);
  if not public.merchant_set_dish_availability_flag('smoke-cu-dish-4', 'smoke-cu-venue', 'featured', true) then
    raise exception 'the fourth dish should be featured once a slot is free';
  end if;
end $$;

reset role;

select 'merchant_closed_until_and_daily_series_passed' as result;

rollback;
