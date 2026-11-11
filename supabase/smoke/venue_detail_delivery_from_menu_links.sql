-- Smoke checks for 20261111150000_venue_detail_delivery_from_menu_links.sql.
-- A stall whose menu_url is a Foodpanda page gets a Foodpanda link, one whose menu_source_url is a
-- Grab page gets a Grab link, one with both gets both, one with a table row keeps that row, and
-- stalls with only their own website or no link get none. Runs in a transaction and rolls back.
-- Brings its own building, so it runs on prod (no seed data) as well as staging.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-dl-building', 'Smoke DL Building', 'hawker_centre', 1.2803, 103.8448);

insert into venues (id, building_id, name, floor, menu_url, menu_source_url) values
  ('smoke-dl-fp', 'smoke-dl-building', 'Smoke DL Foodpanda', '1',
    'https://www.foodpanda.sg/restaurant/abcd/smoke-stall', null),
  ('smoke-dl-grab', 'smoke-dl-building', 'Smoke DL Grab', '1',
    null, 'https://food.grab.com/sg/en/restaurant/smoke-stall/4-C0000000'),
  ('smoke-dl-both', 'smoke-dl-building', 'Smoke DL Both', '1',
    'https://foodpanda.sg/restaurant/efgh/both', 'https://food.grab.com/sg/en/restaurant/both/4-C1111111'),
  ('smoke-dl-row', 'smoke-dl-building', 'Smoke DL Row', '1',
    'https://foodpanda.sg/restaurant/ijkl/row', null),
  ('smoke-dl-site', 'smoke-dl-building', 'Smoke DL Website', '1',
    'https://example.com/menu', 'http://www.foodpanda.sg/restaurant/plain-http'),
  ('smoke-dl-none', 'smoke-dl-building', 'Smoke DL None', '1', null, null);

insert into venue_delivery_links (venue_id, platform, web_url)
values ('smoke-dl-row', 'foodpanda', 'https://www.foodpanda.sg/restaurant/table-row');

set local role anon;

do $$
declare
  r record;
begin
  select * into r from public.get_venue_detail('smoke-dl-fp');
  if jsonb_array_length(r.delivery_links) <> 1
     or r.delivery_links -> 0 ->> 'platform' <> 'foodpanda'
     or r.delivery_links -> 0 ->> 'webUrl' <> 'https://www.foodpanda.sg/restaurant/abcd/smoke-stall' then
    raise exception 'a Foodpanda menu_url should give one Foodpanda link, got %', r.delivery_links;
  end if;

  select * into r from public.get_venue_detail('smoke-dl-grab');
  if jsonb_array_length(r.delivery_links) <> 1 or r.delivery_links -> 0 ->> 'platform' <> 'grabfood' then
    raise exception 'a Grab menu_source_url should give one Grab link, got %', r.delivery_links;
  end if;

  select * into r from public.get_venue_detail('smoke-dl-both');
  if jsonb_array_length(r.delivery_links) <> 2 then
    raise exception 'a stall with both pages should give two links, got %', r.delivery_links;
  end if;

  select * into r from public.get_venue_detail('smoke-dl-row');
  if jsonb_array_length(r.delivery_links) <> 1
     or r.delivery_links -> 0 ->> 'webUrl' <> 'https://www.foodpanda.sg/restaurant/table-row' then
    raise exception 'a venue_delivery_links row should win over menu_url, got %', r.delivery_links;
  end if;

  select * into r from public.get_venue_detail('smoke-dl-site');
  if r.delivery_links is distinct from '[]'::jsonb then
    raise exception 'another host or a plain http page should give no link, got %', r.delivery_links;
  end if;

  select * into r from public.get_venue_detail('smoke-dl-none');
  if r.delivery_links is distinct from '[]'::jsonb then
    raise exception 'a stall with no link should give none, got %', r.delivery_links;
  end if;
end $$;

reset role;

select 'venue_detail_delivery_from_menu_links_smoke_passed' as result;

rollback;
