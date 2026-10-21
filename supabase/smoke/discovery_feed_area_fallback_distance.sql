-- Smoke checks for 20261019130000_discovery_feed_area_fallback_distance.sql.
-- An area name that is not in the areas table falls back to the radius search,
-- and the nearer of two otherwise-equal venues ranks first. Runs in a
-- transaction and rolls back.

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values
  ('discovery-fallback-smoke-near', 'discovery-fallback-smoke-near', 'Discovery Fallback Smoke Near', 'hawker_centre', 1.4501, 103.6001, array['01']),
  ('discovery-fallback-smoke-far', 'discovery-fallback-smoke-far', 'Discovery Fallback Smoke Far', 'hawker_centre', 1.4581, 103.6001, array['01'])
on conflict (id) do update
set latitude = excluded.latitude, longitude = excluded.longitude;

insert into venues (id, building_id, name, unit_number, floor)
values
  ('discovery-fallback-smoke-venue-near', 'discovery-fallback-smoke-near', 'Discovery Fallback Smoke Near Venue', '#01-01', '01'),
  ('discovery-fallback-smoke-venue-far', 'discovery-fallback-smoke-far', 'Discovery Fallback Smoke Far Venue', '#01-01', '01')
on conflict (id) do update
set building_id = excluded.building_id;

do $$
declare
  feed_def text;
  near_rank double precision;
  far_rank double precision;
begin
  select pg_get_functiondef('public.get_discovery_feed_by_location(text, double precision, double precision, integer, integer, text)'::regprocedure)
  into feed_def;

  if (
    select p.prosecdef
    from pg_proc p
    where p.oid = 'public.get_discovery_feed_by_location(text, double precision, double precision, integer, integer, text)'::regprocedure
  ) then
    raise exception 'get_discovery_feed_by_location must stay security invoker';
  end if;

  if feed_def ~* 'top_dish\.distance_meters' then
    raise exception 'get_discovery_feed_by_location must not rank on the stored dishes.distance_meters column';
  end if;

  if feed_def ~* 'priced_menu_venues' then
    raise exception 'get_discovery_feed_by_location must not scan every priced dish per call';
  end if;

  if not exists (
    select 1
    from public.get_discovery_feed_by_location(
      'Hungry Smoke Unknown Area', 1.4501, 103.6001, 2000, 100
    ) feed
    where feed.venue_id = 'discovery-fallback-smoke-venue-near'
  ) then
    raise exception 'Unknown area name should fall back to the radius search around p_lat/p_lng';
  end if;

  if exists (
    select 1
    from public.get_discovery_feed_by_location(
      'Hungry Smoke Unknown Area', 1.4501, 103.6001, 300, 100
    ) feed
    where feed.venue_id = 'discovery-fallback-smoke-venue-far'
  ) then
    raise exception 'Radius fallback should still respect p_radius_meters';
  end if;

  select feed.rank_score into near_rank
  from public.get_discovery_feed_by_location(null, 1.4501, 103.6001, 2000, 100) feed
  where feed.venue_id = 'discovery-fallback-smoke-venue-near';

  select feed.rank_score into far_rank
  from public.get_discovery_feed_by_location(null, 1.4501, 103.6001, 2000, 100) feed
  where feed.venue_id = 'discovery-fallback-smoke-venue-far';

  if near_rank is null or far_rank is null or near_rank <= far_rank then
    raise exception 'Nearer venue should get a higher proximity score (near %, far %)', near_rank, far_rank;
  end if;

  -- Place-first: with p_building_id the far building's stall leads the feed even though the
  -- near one is closer; without it the near one leads.
  if (
    select feed.venue_id
    from public.get_discovery_feed_by_location(null, 1.4501, 103.6001, 2000, 100, 'discovery-fallback-smoke-far') feed
    limit 1
  ) is distinct from 'discovery-fallback-smoke-venue-far' then
    raise exception 'The stall in p_building_id should come first in the feed';
  end if;
  if (
    select feed.venue_id
    from public.get_discovery_feed_by_location(null, 1.4501, 103.6001, 2000, 100) feed
    limit 1
  ) is distinct from 'discovery-fallback-smoke-venue-near' then
    raise exception 'Without p_building_id the nearer stall should lead the feed';
  end if;
end $$;

rollback;
