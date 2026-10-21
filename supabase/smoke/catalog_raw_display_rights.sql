-- Smoke checks for 20261021140000_catalog_raw_display_rights.sql.
-- A guest reading the raw catalog (map, venue cards, menu, details) never gets
-- a photo or menu item that fails the display-rights check Discover uses.
-- Venue identity stays visible. Rolls back.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-h15-building', 'Smoke H15 Building', 'hawker_centre', 1.3, 103.8);

-- Venue photo has no approved rights.
insert into venues (
  id, building_id, name, unit_number, floor, latitude, longitude, image_url,
  media_approved_for_display, media_rights_status
) values (
  'smoke-h15-venue', 'smoke-h15-building', 'Smoke H15 Stall', '#01-01', 'L1', 1.3, 103.8,
  'https://example.com/h15-unapproved-venue.jpg', false, 'unverified'
);

insert into dishes (
  id, venue_id, building_id, name, price, price_range, rating_avg, review_count, image_url,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
) values
  -- Approved menu item with an approved photo.
  ('smoke-h15-approved', 'smoke-h15-venue', 'smoke-h15-building', 'Approved Noodles', 5, 'S$5.00', 4.0, 3,
   'https://example.com/h15-approved-dish.jpg', true, 'merchant_owned', true, 'merchant_owned'),
  -- Approved menu item whose own photo is not approved.
  ('smoke-h15-approved-no-photo', 'smoke-h15-venue', 'smoke-h15-building', 'Approved Rice', 4, 'S$4.00', 3.0, 1,
   'https://example.com/h15-unapproved-dish-photo.jpg', true, 'merchant_owned', false, 'unverified'),
  -- Scraped menu item: not displayable, and the best rated, so it used to be the card's dish.
  ('smoke-h15-scraped', 'smoke-h15-venue', 'smoke-h15-building', 'Scraped Laksa', 9, 'S$9.00', 5.0, 50,
   'https://example.com/h15-unapproved-scraped.jpg', false, 'unverified', false, 'unverified');

insert into dish_images (dish_id, url, sort_order, media_approved_for_display, media_rights_status)
values
  ('smoke-h15-approved', 'https://example.com/h15-unapproved-gallery.jpg', 1, false, 'unverified'),
  ('smoke-h15-approved', 'https://example.com/h15-approved-gallery.jpg', 2, true, 'merchant_owned'),
  ('smoke-h15-scraped', 'https://example.com/h15-unapproved-scraped-gallery.jpg', 1, false, 'unverified');

-- Reuse the live database's active release; only one may be active.
insert into catalog_releases (id, status, activated_at)
select '00000000-0000-0150-c000-000000000001', 'active', now()
where not exists (select 1 from catalog_releases where status = 'active');
select public.catalog_raw_refresh_venue('smoke-h15-venue');

-- Act as a guest: anon role and anon JWT claims, no user id.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_seen text := '';
  v_venue jsonb;
  v_menu jsonb;
  v_dish jsonb;
begin
  v_venue := public.catalog_raw_venue_detail('smoke-h15-venue');
  v_menu := public.catalog_raw_venue_menu_page(p_venue_id => 'smoke-h15-venue', p_limit => 50);
  v_dish := public.catalog_raw_dish_detail('smoke-h15-approved');
  v_seen := v_venue::text || v_menu::text || v_dish::text
    || public.catalog_raw_dish_detail('smoke-h15-approved-no-photo')::text
    || public.catalog_raw_venues_page(p_lat => 1.3, p_lng => 103.8, p_radius_meters => 50, p_limit => 50)::text
    || public.catalog_raw_dishes_page(p_query => 'Smoke H15', p_limit => 50)::text
    || public.catalog_raw_map_view(1.29, 103.79, 1.31, 103.81, 17)::text;

  -- Venue identity is still there.
  if v_venue->>'name' is distinct from 'Smoke H15 Stall' then
    raise exception 'venue identity should stay visible, got %', v_venue;
  end if;

  if v_seen like '%h15-unapproved%' then
    raise exception 'guest read returned an unapproved photo: %', v_seen;
  end if;
  if v_seen like '%Scraped Laksa%' then
    raise exception 'guest read returned a non-displayable menu item';
  end if;

  if (v_venue->>'menu_count')::integer <> 2 then
    raise exception 'menu_count should count displayable dishes only, got %', v_venue->>'menu_count';
  end if;
  if v_venue->'representative_dish'->>'id' is distinct from 'smoke-h15-approved' then
    raise exception 'representative dish should be displayable, got %', v_venue->'representative_dish';
  end if;
  if jsonb_array_length(v_menu->'items') <> 2 then
    raise exception 'venue menu should list the two displayable dishes, got %', v_menu->'items';
  end if;
  if v_dish->>'image_url' is distinct from 'https://example.com/h15-approved-dish.jpg' then
    raise exception 'approved dish photo should show, got %', v_dish->>'image_url';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_dish->'media') m
    where m->>'url' = 'https://example.com/h15-approved-gallery.jpg'
  ) then
    raise exception 'approved gallery photo should show, got %', v_dish->'media';
  end if;

  begin
    perform public.catalog_raw_dish_detail('smoke-h15-scraped');
    raise exception 'non-displayable dish detail should not be found';
  exception
    when no_data_found then null;
  end;
end $$;

reset role;

select 'catalog_raw_display_rights_smoke_passed' as result;

rollback;
