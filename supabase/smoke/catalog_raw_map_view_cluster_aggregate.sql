-- Smoke checks for 20261102090000_catalog_raw_map_view_cluster_aggregate.sql.
-- A zoomed-out map read (zoom 12) returns cluster items with the right counts instead of failing
-- with 42803; a zoomed-in read still returns single venues. Runs in a transaction and rolls back.
-- Brings its own buildings and release, so it runs on prod too.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-mc-b1', 'Smoke MC Food Centre', 'hawker_centre', 1.4001, 103.9001);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values
  ('smoke-mc-v1', 'smoke-mc-b1', 'Smoke MC Stall One', '#01-01', 'L1', 1.4001, 103.9001),
  ('smoke-mc-v2', 'smoke-mc-b1', 'Smoke MC Stall Two', '#01-02', 'L1', 1.4002, 103.9002),
  ('smoke-mc-v3', 'smoke-mc-b1', 'Smoke MC Stall Three', '#01-03', 'L1', 1.4003, 103.9003);

update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0229-a000-0000000000e1', 'active', now() + interval '1 hour');

insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, quality_rating, quality_review_count,
  verification_status, latitude, longitude, listing_location
)
select '00000000-0000-0229-a000-0000000000e1', v.id, 'smoke-mc-b1', v.name, 'Smoke MC Food Centre', 0, 0,
       'verified', v.latitude, v.longitude,
       st_setsrid(st_makepoint(v.longitude, v.latitude), 4326)::geography
from venues v where v.id like 'smoke-mc-v%';

select set_config('request.jwt.claim.sub', '00000000-0000-0229-a000-000000000003', true);
set local role authenticated;

do $$
declare
  v_items jsonb;
  v_total integer;
begin
  -- 1. Zoomed out: the three stalls fall in one grid cell, so one cluster of three.
  v_items := public.catalog_raw_map_view(1.39, 103.89, 1.41, 103.91, 12)->'items';
  if jsonb_array_length(v_items) <> 1 then
    raise exception 'zoom 12 should return one cluster, got %', v_items;
  end if;
  if v_items->0->>'kind' is distinct from 'cluster' or (v_items->0->>'count')::integer <> 3 then
    raise exception 'the cluster should hold 3 stalls, got %', v_items;
  end if;
  if abs((v_items->0->>'latitude')::numeric - 1.4002) > 0.0001
     or abs((v_items->0->>'longitude')::numeric - 103.9002) > 0.0001 then
    raise exception 'the cluster should sit at the average position, got %', v_items;
  end if;

  -- 2. An empty viewport still returns an empty list, not null or an error.
  v_items := public.catalog_raw_map_view(0.1, 100.1, 0.2, 100.2, 12)->'items';
  if v_items is distinct from '[]'::jsonb then
    raise exception 'an empty viewport should return [], got %', v_items;
  end if;

  -- 3. Zoomed in: single venue pins, unchanged.
  v_items := public.catalog_raw_map_view(1.39, 103.89, 1.41, 103.91, 17)->'items';
  select count(*) into v_total from jsonb_array_elements(v_items) i where i->>'kind' = 'venue';
  if v_total <> 3 then
    raise exception 'zoom 17 should return 3 venue pins, got %', v_items;
  end if;
end;
$$;

rollback;
