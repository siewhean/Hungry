-- Smoke checks for 20261101090000_discovery_feed_nearby_prefilter.sql.
-- The "near me" Home feed only reads the 500 nearest venues, but still returns a stall with a menu
-- that is farther away than all of them, a stall in the viewer's own building, and a stall whose
-- position comes from its building; it still leaves out stalls beyond the radius.
-- Runs in a transaction and rolls back. Brings its own buildings, so it runs on prod too.

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values
  ('smoke-nf-home', 'smoke-nf-home', 'Smoke NF Home', 'mall', 1.4801, 103.7801, array['01']),
  ('smoke-nf-far', 'smoke-nf-far', 'Smoke NF Far Mall', 'mall', 1.4950, 103.7801, array['01']),
  ('smoke-nf-nolat', 'smoke-nf-nolat', 'Smoke NF No-position Mall', 'mall', 1.4801, 103.7920, array['01']),
  ('smoke-nf-out', 'smoke-nf-out', 'Smoke NF Out Of Range', 'mall', 1.5200, 103.7801, array['01']);

-- 520 plain stalls close by: more than the 500 candidates the feed keeps.
insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
select 'smoke-nf-plain-' || i, 'smoke-nf-home', 'Smoke NF Plain ' || i, '#01-' || i, '01',
       1.4801 + (i % 20) * 0.00005, 103.7801 + (i / 20) * 0.00005
from generate_series(1, 520) i;

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values
  ('smoke-nf-menu', 'smoke-nf-far', 'Smoke NF Far Menu Stall', '#01-01', '01', 1.4950, 103.7801),
  ('smoke-nf-bld', 'smoke-nf-far', 'Smoke NF Far Building Stall', '#01-02', '01', 1.4951, 103.7801),
  ('smoke-nf-out', 'smoke-nf-out', 'Smoke NF Out Of Range Stall', '#01-01', '01', 1.5200, 103.7801);
-- No position of its own: it is placed by its building.
insert into venues (id, building_id, name, unit_number, floor)
values ('smoke-nf-nolat', 'smoke-nf-nolat', 'Smoke NF No-position Stall', '#01-01', '01');

insert into dishes (
  id, venue_id, building_id, name, price,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-nf-menu-dish', 'smoke-nf-menu', 'smoke-nf-far', 'Far Menu Noodles', 5, true, 'merchant_owned', true, 'merchant_owned'),
  ('smoke-nf-nolat-dish', 'smoke-nf-nolat', 'smoke-nf-nolat', 'No Position Rice', 5, true, 'merchant_owned', true, 'merchant_owned'),
  ('smoke-nf-out-dish', 'smoke-nf-out', 'smoke-nf-out', 'Out Of Range Rice', 5, true, 'merchant_owned', true, 'merchant_owned');

do $$
declare
  v_top text;
  v_count integer;
begin
  -- 1. A stall with a menu, 1.7 km away behind 520 nearer stalls, is still in the feed and
  -- leads it with its dish; the stall beyond the 2 km radius is not there.
  select feed.top_dish_id into v_top
  from public.get_discovery_feed_by_location(null, 1.4801, 103.7801, 2000, 100) feed
  where feed.venue_id = 'smoke-nf-menu';
  if v_top is distinct from 'smoke-nf-menu-dish' then
    raise exception 'a far stall with a menu should be in the feed with its dish, got %', v_top;
  end if;

  if (select feed.venue_id from public.get_discovery_feed_by_location(null, 1.4801, 103.7801, 2000, 100) feed limit 1)
     not in ('smoke-nf-menu', 'smoke-nf-nolat') then
    raise exception 'stalls with a menu should lead the feed';
  end if;

  select count(*) into v_count
  from public.get_discovery_feed_by_location(null, 1.4801, 103.7801, 2000, 100) feed
  where feed.venue_id = 'smoke-nf-out';
  if v_count <> 0 then
    raise exception 'a stall beyond the radius must not be in the feed';
  end if;

  -- 2. A stall placed by its building (no position of its own) is found.
  select count(*) into v_count
  from public.get_discovery_feed_by_location(null, 1.4801, 103.7801, 2000, 100) feed
  where feed.venue_id = 'smoke-nf-nolat' and feed.top_dish_id = 'smoke-nf-nolat-dish';
  if v_count <> 1 then
    raise exception 'a stall placed by its building should be in the feed';
  end if;

  -- 3. The viewer's own building comes first even for a stall without a menu that is farther
  -- than 500 other stalls.
  select count(*) into v_count
  from public.get_discovery_feed_by_location(null, 1.4801, 103.7801, 2000, 100, 'smoke-nf-far') feed
  where feed.venue_id = 'smoke-nf-bld';
  if v_count <> 1 then
    raise exception 'a stall in the viewer''s building should be in the feed';
  end if;

  -- 4. Without a position the feed still answers.
  select count(*) into v_count from public.get_discovery_feed_by_location(null, null, null, 3000, 10);
  if v_count = 0 then
    raise exception 'the feed with no position should still return stalls';
  end if;
end $$;

rollback;

select 'DISCOVERY_FEED_NEARBY_PREFILTER_OK' as result;
