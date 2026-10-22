-- N+1 sweep (20261022140000): get_item_details, get_venue_summaries, apply_menu_draft_matches,
-- merchant_set_dishes_availability_flag, reorder_popular_visitor_pins.
-- Runs in a transaction and rolls back.

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values ('n1-building', 'n1-building', 'N1 Building', 'hawker_centre', 1.3001, 103.8001, array['01'])
on conflict (id) do nothing;

insert into venues (id, building_id, name, floor, operating_hours, is_open)
values
  ('n1-venue-a', 'n1-building', 'N1 Venue A', '01', '08:00-20:00', true),
  ('n1-venue-b', 'n1-building', 'N1 Venue B', '01', '09:00-21:00', false)
on conflict (id) do nothing;

insert into dishes (id, venue_id, building_id, name, price, menu_approved_for_display, menu_rights_status)
values
  ('n1-dish-shown', 'n1-venue-a', 'n1-building', 'N1 Shown Dish', 4.5, true, 'operator_owned'),
  ('n1-dish-hidden', 'n1-venue-a', 'n1-building', 'N1 Hidden Dish', 5.5, false, 'unverified')
on conflict (id) do nothing;

do $$
begin
  -- get_item_details: one row per dish and per stall, in one call.
  if (select count(*) from public.get_item_details(
        array['n1-dish-shown'], array['n1-venue-a', 'n1-venue-b'])) <> 3 then
    raise exception 'get_item_details must return a row per dish and stall id';
  end if;
  if not exists (
    select 1 from public.get_item_details(array['n1-dish-shown'], '{}')
    where dish_id = 'n1-dish-shown' and name = 'N1 Shown Dish' and stall_name = 'N1 Venue A' and price = 4.5
  ) then
    raise exception 'get_item_details must name the dish and its stall';
  end if;
  if exists (select 1 from public.get_item_details(null, null)) then
    raise exception 'get_item_details with null arrays must return nothing';
  end if;

  -- get_venue_summaries: one row per venue, no dishes column, open-state inputs present.
  if (select count(*) from public.get_venue_summaries(array['n1-venue-a', 'n1-venue-b', 'n1-missing'])) <> 2 then
    raise exception 'get_venue_summaries must return a row per existing venue';
  end if;
  if not exists (
    select 1 from public.get_venue_summaries(array['n1-venue-a'])
    where venue_id = 'n1-venue-a' and operating_hours = '08:00-20:00' and is_open
      and building ->> 'name' = 'N1 Building'
  ) then
    raise exception 'get_venue_summaries must carry hours, open flag and building';
  end if;
end $$;

-- A draft the public cannot see stays out of get_item_details for an ordinary signed-in user.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0071-a000-000000000001', true);

do $$
begin
  if exists (
    select 1 from public.get_item_details(array['n1-dish-hidden'], '{}')
    where name is not null
  ) then
    raise exception 'get_item_details leaked a dish the public cannot see';
  end if;
  if has_function_privilege('authenticated', 'public.apply_menu_draft_matches(jsonb)', 'execute') then
    raise exception 'apply_menu_draft_matches must be service-role only';
  end if;
end $$;

reset role;

-- apply_menu_draft_matches: one statement bumps confidence and counters for every match.
insert into dishes_draft (id, venue_id, building_id, name, name_normalized, extraction_confidence, confidence_bumps)
values
  ('00000000-0000-0071-d000-000000000001', 'n1-venue-a', 'n1-building', 'Laksa', 'laksa', 0.500, 0),
  ('00000000-0000-0071-d000-000000000002', 'n1-venue-a', 'n1-building', 'Rojak', 'rojak', 0.900, 2);

do $$
declare
  v_updated integer;
begin
  v_updated := public.apply_menu_draft_matches(jsonb_build_array(
    jsonb_build_object('id', '00000000-0000-0071-d000-000000000001', 'confidence', 0.8, 'bumps', 1),
    jsonb_build_object('id', '00000000-0000-0071-d000-000000000002', 'confidence', 0.4, 'bumps', 2)
  ));
  if v_updated <> 2 then
    raise exception 'apply_menu_draft_matches must update both drafts, got %', v_updated;
  end if;
  if not exists (
    select 1 from dishes_draft
    where id = '00000000-0000-0071-d000-000000000001' and extraction_confidence = 0.800 and confidence_bumps = 1
  ) then
    raise exception 'apply_menu_draft_matches must raise confidence and add a bump';
  end if;
  if not exists (
    select 1 from dishes_draft
    where id = '00000000-0000-0071-d000-000000000002' and extraction_confidence = 0.900 and confidence_bumps = 4
  ) then
    raise exception 'apply_menu_draft_matches must keep the higher confidence and add bumps';
  end if;
end $$;

-- merchant_set_dishes_availability_flag: one call flags several dishes, and only that venue's.
insert into dishes (id, venue_id, building_id, name, price, availability_flags)
values
  ('n1-flag-a', 'n1-venue-a', 'n1-building', 'Flag A', 3, array['sold_out', 'featured']),
  ('n1-flag-b', 'n1-venue-a', 'n1-building', 'Flag B', 3, array['sold_out']),
  ('n1-flag-c', 'n1-venue-b', 'n1-building', 'Flag C', 3, array['sold_out']);

do $$
declare
  v_changed text[];
begin
  v_changed := public.merchant_set_dishes_availability_flag(
    array['n1-flag-a', 'n1-flag-b', 'n1-flag-c', 'n1-missing'], 'n1-venue-a', 'sold_out', false);
  if v_changed is distinct from array['n1-flag-a', 'n1-flag-b'] and v_changed is distinct from array['n1-flag-b', 'n1-flag-a'] then
    raise exception 'merchant_set_dishes_availability_flag must change only dishes of the venue, got %', v_changed;
  end if;
  if exists (select 1 from dishes where id in ('n1-flag-a', 'n1-flag-b') and 'sold_out' = any(availability_flags)) then
    raise exception 'sold_out must be cleared on the venue dishes';
  end if;
  if not exists (select 1 from dishes where id = 'n1-flag-a' and 'featured' = any(availability_flags)) then
    raise exception 'other flags must be kept';
  end if;
  if not exists (select 1 from dishes where id = 'n1-flag-c' and 'sold_out' = any(availability_flags)) then
    raise exception 'a dish of another venue must not change';
  end if;
  v_changed := public.merchant_set_dishes_availability_flag(array['n1-flag-b'], 'n1-venue-a', 'Sold Out', true);
  if not exists (select 1 from dishes where id = 'n1-flag-b' and 'sold_out' = any(availability_flags)) then
    raise exception 'enabling must set the normalized flag';
  end if;
end $$;

-- reorder_popular_visitor_pins: one UPDATE sets the order of an outlet's pins.
insert into auth.users (id, email)
values
  ('00000000-0000-0071-b000-000000000001', 'n1-owner@example.test'),
  ('00000000-0000-0071-b000-000000000002', 'n1-diner-a@example.test'),
  ('00000000-0000-0071-b000-000000000003', 'n1-diner-b@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values ('00000000-0000-0071-a000-000000000001', '00000000-0000-0071-b000-000000000001', 'N1 Merchant', 'n1-owner@example.test');

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values ('00000000-0000-0071-c000-000000000001', '00000000-0000-0071-a000-000000000001',
        'n1-venue-a', 'n1-building', 'N1 Stall', 'hawker_stall', true);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values
  ('00000000-0000-0071-e000-000000000001', '00000000-0000-0071-b000-000000000002', 'n1-dish-shown', 'n1-venue-a', 'A', 5, 'Great'),
  ('00000000-0000-0071-e000-000000000002', '00000000-0000-0071-b000-000000000003', 'n1-dish-shown', 'n1-venue-a', 'B', 4, 'Good');

insert into merchant_popular_visitor_pins (
  id, outlet_id, venue_id, review_id, source_id, author_name, review_text, rating, visited_at, sort_order
)
values
  ('00000000-0000-0071-f000-000000000001', '00000000-0000-0071-c000-000000000001', 'n1-venue-a',
   '00000000-0000-0071-e000-000000000001', 'a', 'A', '', 5, now(), 0),
  ('00000000-0000-0071-f000-000000000002', '00000000-0000-0071-c000-000000000001', 'n1-venue-a',
   '00000000-0000-0071-e000-000000000002', 'b', 'B', '', 4, now(), 1);

do $$
begin
  if public.reorder_popular_visitor_pins(
       '00000000-0000-0071-c000-000000000001',
       array['00000000-0000-0071-f000-000000000002', '00000000-0000-0071-f000-000000000001']::uuid[]
     ) <> 2 then
    raise exception 'reorder_popular_visitor_pins must update both pins';
  end if;
  if not exists (select 1 from merchant_popular_visitor_pins
                 where id = '00000000-0000-0071-f000-000000000002' and sort_order = 0)
     or not exists (select 1 from merchant_popular_visitor_pins
                 where id = '00000000-0000-0071-f000-000000000001' and sort_order = 1) then
    raise exception 'reorder_popular_visitor_pins must follow the given order';
  end if;
  if public.reorder_popular_visitor_pins(
       '00000000-0000-0071-c000-000000000002',
       array['00000000-0000-0071-f000-000000000001']::uuid[]
     ) <> 0 then
    raise exception 'reorder_popular_visitor_pins must ignore pins of another outlet';
  end if;
end $$;

select 'n_plus_one_batched_reads_smoke_passed' as result;

rollback;
