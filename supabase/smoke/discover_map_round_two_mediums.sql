-- Smoke checks for 20261022040000_catalog_raw_map_view_query_rating_nearest.sql and
-- 20261022040100_discovery_feed_real_hours_no_stored_open_rank.sql.
--   * map pins: p_query keeps results on the map, "Top Rated" needs 3+ reviews,
--     venue pins carry building_type.
--   * Discover feed: returns operating_hours and ranks a stall the same whether or
--     not the stored venues.is_open copy says open. Rolls back.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-dm-building', 'Smoke DM Building', 'hawker_centre', 1.3, 103.8);

insert into venues (
  id, building_id, name, unit_number, floor, latitude, longitude, is_open, operating_hours
) values
  -- One 5-star review only: must not count as Top Rated.
  ('smoke-dm-venue-thin', 'smoke-dm-building', 'Smoke DM Thin Stall', '#01-01', 'L1', 1.3001, 103.8001, true, '10am-10pm'),
  -- Well reviewed: Top Rated.
  ('smoke-dm-venue-solid', 'smoke-dm-building', 'Smoke DM Solid Stall', '#01-02', 'L1', 1.3002, 103.8002, false, '10am-10pm'),
  -- Two stalls with no dishes in the same building: only the stored open copy differs.
  ('smoke-dm-venue-open-flag', 'smoke-dm-building', 'Smoke DM Open Flag Stall', '#01-03', 'L1', 1.3003, 103.8003, true, ''),
  ('smoke-dm-venue-closed-flag', 'smoke-dm-building', 'Smoke DM Closed Flag Stall', '#01-04', 'L1', 1.3003, 103.8003, false, '');

insert into dishes (
  id, venue_id, building_id, name, price, price_range, rating_avg, review_count, image_url,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
) values
  ('smoke-dm-dish-thin', 'smoke-dm-venue-thin', 'smoke-dm-building', 'Zzqxthin Noodles', 5, 'S$5.00', 5.0, 1,
   null, true, 'merchant_owned', false, 'unverified'),
  ('smoke-dm-dish-solid', 'smoke-dm-venue-solid', 'smoke-dm-building', 'Zzqxsolid Rice', 5, 'S$5.00', 4.8, 5,
   null, true, 'merchant_owned', false, 'unverified');

insert into catalog_releases (id, status, activated_at)
select '00000000-0000-0220-c000-000000000001', 'active', now()
where not exists (select 1 from catalog_releases where status = 'active');
select public.catalog_raw_refresh_venue('smoke-dm-venue-thin');
select public.catalog_raw_refresh_venue('smoke-dm-venue-solid');

-- Act as a guest: anon role and anon JWT claims, no user id.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_all jsonb;
  v_top jsonb;
  v_query jsonb;
  v_none jsonb;
begin
  v_all := public.catalog_raw_map_view(1.29, 103.79, 1.31, 103.81, 17)->'items';
  v_top := public.catalog_raw_map_view(1.29, 103.79, 1.31, 103.81, 17, p_min_rating => 4.5)->'items';
  v_query := public.catalog_raw_map_view(1.29, 103.79, 1.31, 103.81, 17, p_query => 'Zzqxthin')->'items';
  v_none := public.catalog_raw_map_view(1.29, 103.79, 1.31, 103.81, 17, p_query => 'Qqwwzznomatch')->'items';

  -- M9: venue pins carry the building type.
  if not exists (
    select 1 from jsonb_array_elements(v_all) i
    where i->>'id' = 'smoke-dm-venue-solid' and i->>'building_type' = 'hawker_centre'
  ) then
    raise exception 'venue pins should carry building_type, got %', v_all;
  end if;

  -- M12: one review is not "Top Rated"; five reviews at 4.8 is.
  if exists (select 1 from jsonb_array_elements(v_top) i where i->>'id' = 'smoke-dm-venue-thin') then
    raise exception 'a stall with one review should not pass the Top Rated filter, got %', v_top;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_top) i where i->>'id' = 'smoke-dm-venue-solid') then
    raise exception 'a stall with 5 reviews at 4.8 should pass Top Rated, got %', v_top;
  end if;

  -- M19: a dish-name query returns only the stall that serves it.
  if jsonb_array_length(v_query) <> 1 or v_query->0->>'id' is distinct from 'smoke-dm-venue-thin' then
    raise exception 'p_query should return only the matching stall, got %', v_query;
  end if;
  if jsonb_array_length(v_none) <> 0 then
    raise exception 'a query that matches nothing should return no pins, got %', v_none;
  end if;
end $$;

-- Discover feed: hours come back, and the stored open copy does not move the rank.
do $$
declare
  v_hours text;
  v_open double precision;
  v_closed double precision;
begin
  select f.operating_hours into v_hours
  from public.get_discovery_feed_by_location(null, 1.3002, 103.8002, 2000, 100) f
  where f.venue_id = 'smoke-dm-venue-solid';
  if v_hours is distinct from '10am-10pm' then
    raise exception 'feed should return operating_hours, got %', v_hours;
  end if;

  select f.rank_score into v_open
  from public.get_discovery_feed_by_location(null, 1.3002, 103.8002, 2000, 100) f
  where f.venue_id = 'smoke-dm-venue-open-flag';
  select f.rank_score into v_closed
  from public.get_discovery_feed_by_location(null, 1.3002, 103.8002, 2000, 100) f
  where f.venue_id = 'smoke-dm-venue-closed-flag';
  if v_open is null or v_closed is null then
    raise exception 'both stalls should be in the feed';
  end if;
  if v_open is distinct from v_closed then
    raise exception 'the stored is_open flag should not change the feed rank (% vs %)', v_open, v_closed;
  end if;
end $$;

reset role;

select 'discover_map_round_two_mediums_smoke_passed' as result;

rollback;
