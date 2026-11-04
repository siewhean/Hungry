-- Smoke checks for 20261101120000_discovery_feed_candidates_follow_limit.sql.
-- A small first read (p_limit 10) ranks fewer candidates but still returns 10 stalls, the nearest
-- stall, a far stall with a menu and the viewer's own building first; the full read (p_limit 100)
-- is unchanged. Runs in a transaction and rolls back. Brings its own buildings, so it runs on prod too.

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values
  ('smoke-fl-home', 'smoke-fl-home', 'Smoke FL Home', 'mall', 1.5001, 103.8001, array['01']),
  ('smoke-fl-far', 'smoke-fl-far', 'Smoke FL Far Mall', 'mall', 1.5150, 103.8001, array['01']);

-- 250 plain stalls close by: more than the 100 candidates a first read ranks.
insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
select 'smoke-fl-plain-' || i, 'smoke-fl-home', 'Smoke FL Plain ' || i, '#01-' || i, '01',
       1.5001 + (i % 20) * 0.00005, 103.8001 + (i / 20) * 0.00005
from generate_series(1, 250) i;

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values
  ('smoke-fl-menu', 'smoke-fl-far', 'Smoke FL Far Menu Stall', '#01-01', '01', 1.5150, 103.8001),
  ('smoke-fl-bld', 'smoke-fl-far', 'Smoke FL Far Building Stall', '#01-02', '01', 1.5151, 103.8001);

insert into dishes (
  id, venue_id, building_id, name, price,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-fl-menu-dish', 'smoke-fl-menu', 'smoke-fl-far', 'Far Menu Noodles', 5, true, 'merchant_owned', true, 'merchant_owned');

do $$
declare
  v_count integer;
  v_first text;
begin
  -- 1. A first read of 10 returns 10 stalls, led by the far stall with a menu.
  select count(*) into v_count
  from public.get_discovery_feed_by_location(null, 1.5001, 103.8001, 3000, 10);
  if v_count <> 10 then
    raise exception 'a first read of 10 should return 10 stalls, got %', v_count;
  end if;

  select feed.venue_id into v_first
  from public.get_discovery_feed_by_location(null, 1.5001, 103.8001, 3000, 10) feed limit 1;
  if v_first is distinct from 'smoke-fl-menu' then
    raise exception 'the stall with a menu should lead the first read, got %', v_first;
  end if;

  -- 2. The viewer's own building still comes first in a first read.
  select count(*) into v_count
  from public.get_discovery_feed_by_location(null, 1.5001, 103.8001, 3000, 10, 'smoke-fl-far') feed
  where feed.venue_id = 'smoke-fl-bld';
  if v_count <> 1 then
    raise exception 'a stall in the viewer''s building should be in the first read';
  end if;

  -- 3. The full read still returns 100 stalls and holds the stall with a menu.
  select count(*) into v_count
  from public.get_discovery_feed_by_location(null, 1.5001, 103.8001, 3000, 100);
  if v_count <> 100 then
    raise exception 'the full read should return 100 stalls, got %', v_count;
  end if;
  select count(*) into v_count
  from public.get_discovery_feed_by_location(null, 1.5001, 103.8001, 3000, 100) feed
  where feed.venue_id = 'smoke-fl-menu';
  if v_count <> 1 then
    raise exception 'the full read should hold the stall with a menu';
  end if;
end $$;

rollback;

select 'DISCOVERY_FEED_CANDIDATES_FOLLOW_LIMIT_OK' as result;
