-- Smoke checks for 20261114130000_price_basis_halal_status.sql.
-- 1. get_dish_detail returns price basis, a checked date and halal status (yes / no / unknown).
-- 2. Changing a price moves price_checked_at; a writer that sets it keeps its own value.
-- 3. search_dishes (stall menus), the Home feed and Search's catalog cards carry the price basis.
-- Runs in a transaction and rolls back. Brings its own building, so it runs on prod too.

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values ('smoke-pb-mall', 'smoke-pb-mall', 'Smoke PB Mall', 'mall', 1.5401, 103.8401, array['01']);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values ('smoke-pb-stall', 'smoke-pb-mall', 'Smoke PB Stall', '#01-01', '01', 1.5401, 103.8401);

insert into dishes (
  id, venue_id, building_id, name, price, price_confidence, dietary_status,
  menu_approved_for_display, menu_rights_status, must_order
)
values
  ('smoke-pb-counter', 'smoke-pb-stall', 'smoke-pb-mall', 'Smoke PB Counter Rice', 5.5, 'counter_price',
   '{"flags":{"halal":"no"}}', true, 'merchant_owned', true),
  ('smoke-pb-delivery', 'smoke-pb-stall', 'smoke-pb-mall', 'Smoke PB Delivery Noodles', 6.8, 'delivery_price',
   '{"flags":{"halal":"unknown"}}', true, 'merchant_owned', false),
  ('smoke-pb-flagged', 'smoke-pb-stall', 'smoke-pb-mall', 'Smoke PB Halal Soup', 4, 'listed_price',
   null, true, 'merchant_owned', false);

insert into dish_dietary_flags (dish_id, dietary_flag_id)
select 'smoke-pb-flagged', df.id from dietary_flags df where df.slug::text = 'halal';

-- A throwaway (not active) release: the insert trigger fills price_basis from the dish.
insert into public.catalog_releases (id, status)
values ('00000000-0000-0114-b000-0000000000c1', 'building');

insert into public.catalog_raw_dish_cards (release_id, id, venue_id, building_id, name, venue_name, verification_status)
values ('00000000-0000-0114-b000-0000000000c1', 'smoke-pb-delivery', 'smoke-pb-stall', 'smoke-pb-mall',
        'Smoke PB Delivery Noodles', 'Smoke PB Stall', 'unverified');

do $$
declare
  r record;
  v_before timestamptz;
  v_after timestamptz;
  v_n integer;
begin
  -- 1. Dish page.
  select * into r from public.get_dish_detail('smoke-pb-counter');
  if r.price_basis is distinct from 'counter' then
    raise exception 'counter price should read as counter, got %', r.price_basis;
  end if;
  if r.price_checked_at is null then
    raise exception 'a new dish should have a price checked date';
  end if;
  if r.halal_status is distinct from 'no' then
    raise exception 'halal "no" should read as no, got %', r.halal_status;
  end if;

  select * into r from public.get_dish_detail('smoke-pb-delivery');
  if r.price_basis is distinct from 'delivery' or r.halal_status is distinct from 'unknown' then
    raise exception 'delivery dish should be delivery / unknown, got % / %', r.price_basis, r.halal_status;
  end if;

  select * into r from public.get_dish_detail('smoke-pb-flagged');
  if r.price_basis is distinct from 'menu' or r.halal_status is distinct from 'yes' then
    raise exception 'flagged dish should be menu / yes, got % / %', r.price_basis, r.halal_status;
  end if;

  -- 2. Price change moves the date; an explicit date is kept.
  update dishes set price_checked_at = '2026-10-01T00:00:00Z' where id = 'smoke-pb-counter';
  select price_checked_at into v_before from dishes where id = 'smoke-pb-counter';
  update dishes set price = 6 where id = 'smoke-pb-counter';
  select price_checked_at into v_after from dishes where id = 'smoke-pb-counter';
  if v_after <= v_before then
    raise exception 'a price change should move price_checked_at (% -> %)', v_before, v_after;
  end if;
  update dishes set price = 6.5, price_checked_at = '2026-10-02T00:00:00Z' where id = 'smoke-pb-counter';
  select price_checked_at into v_after from dishes where id = 'smoke-pb-counter';
  if v_after <> '2026-10-02T00:00:00Z'::timestamptz then
    raise exception 'an explicit price_checked_at should be kept, got %', v_after;
  end if;

  -- 3. Search / stall menu rows and the Home feed.
  select count(*) into v_n
  from public.search_dishes(p_venue_id => 'smoke-pb-stall', p_limit => 10) sd
  where (sd.dish_id = 'smoke-pb-counter' and sd.price_basis = 'counter')
     or (sd.dish_id = 'smoke-pb-delivery' and sd.price_basis = 'delivery')
     or (sd.dish_id = 'smoke-pb-flagged' and sd.price_basis = 'menu');
  if v_n <> 3 then
    raise exception 'search_dishes should return the price basis of all 3 smoke dishes, matched %', v_n;
  end if;

  select count(*) into v_n
  from public.get_discovery_feed_by_location(null, 1.5401, 103.8401, 3000, 100) feed
  where feed.venue_id = 'smoke-pb-stall'
    and feed.top_dish_id is not null
    and feed.top_dish_price_basis in ('counter', 'menu', 'delivery');
  if v_n <> 1 then
    raise exception 'the Home feed should carry the top dish price basis for the smoke stall';
  end if;

  if (select c.price_basis from public.catalog_raw_dish_cards c
      where c.release_id = '00000000-0000-0114-b000-0000000000c1' and c.id = 'smoke-pb-delivery')
     is distinct from 'delivery' then
    raise exception 'a new catalog card should get its price basis from the dish';
  end if;
end;
$$;

rollback;
