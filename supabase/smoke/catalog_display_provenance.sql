-- Smoke checks for catalog display provenance guardrails.
-- Run after applying 20260610120000_catalog_display_provenance_guardrails.sql.

begin;

do $$
declare
  search_def text;
  discovery_def text;
  dish_detail_def text;
  unapproved_count integer;
  approved_count integer;
  approved_detail_count integer;
  delivery_image_count integer;
  discovery_top_dish_id text;
  discovery_top_dish_image text;
begin
  if public.catalog_display_image_url('https://images.unsplash.com/photo-test', true, 'licensed', null) is not null then
    raise exception 'Unsplash placeholder image should not be displayable';
  end if;

  if public.catalog_display_image_url('https://merchant.example/stall.jpg', true, 'merchant_owned', null) is distinct from 'https://merchant.example/stall.jpg' then
    raise exception 'Merchant-owned image should be displayable when approved';
  end if;

  if public.catalog_display_image_url('https://foodpanda.sg/image.jpg', true, 'merchant_owned', 'https://foodpanda.sg/restaurant/test') is not null then
    raise exception 'Delivery-app image should be blocked unless explicitly licensed';
  end if;

  if public.catalog_display_image_url('https://foodpanda.sg/image.jpg', true, 'licensed', 'https://foodpanda.sg/restaurant/test') is distinct from 'https://foodpanda.sg/image.jpg' then
    raise exception 'Licensed delivery-app image should be displayable';
  end if;

  if public.catalog_menu_is_displayable(false, 'merchant_owned', 'https://merchant.example/menu') then
    raise exception 'Unapproved menu should not be displayable';
  end if;

  if public.catalog_menu_is_displayable(true, 'unverified', 'https://merchant.example/menu') then
    raise exception 'Unverified menu should not be displayable';
  end if;

  if not public.catalog_menu_is_displayable(true, 'operator_owned', 'https://merchant.example/menu') then
    raise exception 'Operator-owned approved menu should be displayable';
  end if;

  insert into buildings (
    id,
    slug,
    name,
    building_type,
    latitude,
    longitude,
    floors
  )
  values (
    'catalog-provenance-smoke-building',
    'catalog-provenance-smoke-building',
    'Catalog Provenance Smoke Building',
    'hawker_centre',
    1.3001,
    103.8001,
    array['01']
  )
  on conflict (id) do update
  set
    name = excluded.name,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    floors = excluded.floors;

  insert into venues (
    id,
    building_id,
    name,
    unit_number,
    floor,
    operating_hours
  )
  values (
    'catalog-provenance-smoke-venue',
    'catalog-provenance-smoke-building',
    'Catalog Provenance Smoke Venue',
    '#01-01',
    '01',
    'Monday: 09:00-21:00; Tuesday: 09:00-21:00; Wednesday: 09:00-21:00; Thursday: 09:00-21:00; Friday: 09:00-21:00; Saturday: 09:00-21:00; Sunday: 09:00-21:00'
  )
  on conflict (id) do update
  set
    name = excluded.name,
    unit_number = excluded.unit_number,
    floor = excluded.floor,
    operating_hours = excluded.operating_hours;

  insert into dishes (
    id,
    venue_id,
    building_id,
    name,
    description,
    image_url,
    distance_meters,
    rating_avg,
    review_count,
    price,
    price_range,
    taste_tags,
    must_order,
    availability_flags,
    cuisine_tags,
    menu_approved_for_display,
    menu_rights_status,
    menu_source_url,
    media_approved_for_display,
    media_rights_status,
    media_source_url
  )
  values
    (
      'catalog-provenance-smoke-unapproved-dish',
      'catalog-provenance-smoke-venue',
      'catalog-provenance-smoke-building',
      'Smoke Unapproved Mee',
      'Should never appear in app-facing catalog reads.',
      'https://merchant.example/unapproved-dish.jpg',
      50,
      5.00,
      1,
      4.50,
      '$4-$5',
      array['smoke'],
      true,
      array[]::text[],
      array['smoke'],
      false,
      'merchant_owned',
      'https://merchant.example/menu',
      true,
      'merchant_owned',
      'https://merchant.example/media'
    ),
    (
      'catalog-provenance-smoke-approved-dish',
      'catalog-provenance-smoke-venue',
      'catalog-provenance-smoke-building',
      'Smoke Approved Mee',
      'Should appear with its approved merchant-owned image.',
      'https://merchant.example/approved-dish.jpg',
      50,
      4.90,
      1,
      4.50,
      '$4-$5',
      array['smoke'],
      true,
      array[]::text[],
      array['smoke'],
      true,
      'merchant_owned',
      'https://merchant.example/menu',
      true,
      'merchant_owned',
      'https://merchant.example/media'
    ),
    (
      'catalog-provenance-smoke-delivery-image-dish',
      'catalog-provenance-smoke-venue',
      'catalog-provenance-smoke-building',
      'Smoke Delivery Image Mee',
      'Should appear only without a delivery-app image.',
      'https://foodpanda.sg/image.jpg',
      50,
      4.80,
      1,
      4.50,
      '$4-$5',
      array['smoke'],
      false,
      array[]::text[],
      array['smoke'],
      true,
      'merchant_owned',
      'https://merchant.example/menu',
      true,
      'merchant_owned',
      'https://foodpanda.sg/restaurant/test'
    )
  on conflict (id) do update
  set
    name = excluded.name,
    image_url = excluded.image_url,
    rating_avg = excluded.rating_avg,
    menu_approved_for_display = excluded.menu_approved_for_display,
    menu_rights_status = excluded.menu_rights_status,
    menu_source_url = excluded.menu_source_url,
    media_approved_for_display = excluded.media_approved_for_display,
    media_rights_status = excluded.media_rights_status,
    media_source_url = excluded.media_source_url;

  select count(*)
  into unapproved_count
  from public.search_dishes(p_query => 'Smoke Unapproved Mee', p_limit => 10)
  where dish_id = 'catalog-provenance-smoke-unapproved-dish';

  if unapproved_count <> 0 then
    raise exception 'Unapproved seeded dish should not be returned by search_dishes';
  end if;

  select count(*)
  into approved_count
  from public.search_dishes(p_query => 'Smoke Approved Mee', p_limit => 10)
  where dish_id = 'catalog-provenance-smoke-approved-dish'
    and image_url = 'https://merchant.example/approved-dish.jpg'
    and array_position(gallery, 'https://merchant.example/approved-dish.jpg') is not null;

  if approved_count <> 1 then
    raise exception 'Approved seeded dish should be returned by search_dishes with approved image';
  end if;

  select count(*)
  into delivery_image_count
  from public.search_dishes(p_query => 'Smoke Delivery Image Mee', p_limit => 10)
  where dish_id = 'catalog-provenance-smoke-delivery-image-dish'
    and image_url is not null;

  if delivery_image_count <> 0 then
    raise exception 'Delivery-app image should be stripped from search_dishes output';
  end if;

  select count(*)
  into unapproved_count
  from public.get_dish_detail('catalog-provenance-smoke-unapproved-dish');

  if unapproved_count <> 0 then
    raise exception 'Unapproved seeded dish should not be returned by get_dish_detail';
  end if;

  select count(*)
  into approved_detail_count
  from public.get_dish_detail('catalog-provenance-smoke-approved-dish')
  where image_url = 'https://merchant.example/approved-dish.jpg'
    and array_position(gallery, 'https://merchant.example/approved-dish.jpg') is not null;

  if approved_detail_count <> 1 then
    raise exception 'Approved seeded dish should be returned by get_dish_detail with approved image';
  end if;

  select top_dish_id, top_dish_image
  into discovery_top_dish_id, discovery_top_dish_image
  from public.get_discovery_feed_by_location(
    p_lat => 1.3001,
    p_lng => 103.8001,
    p_radius_meters => 1000,
    p_limit => 10
  )
  where venue_id = 'catalog-provenance-smoke-venue'
  limit 1;

  if discovery_top_dish_id is distinct from 'catalog-provenance-smoke-approved-dish'
    or discovery_top_dish_image is distinct from 'https://merchant.example/approved-dish.jpg' then
    raise exception 'Discovery feed should choose the approved seeded dish and approved image';
  end if;

  select pg_get_functiondef('public.search_dishes(text, double precision, double precision, integer, text[], integer, double precision, text, text, text, text[], numeric, boolean)'::regprocedure)
    into search_def;
  select pg_get_functiondef('public.get_discovery_feed_by_location(text, double precision, double precision, integer, integer, text)'::regprocedure)
    into discovery_def;
  select pg_get_functiondef('public.get_dish_detail(text)'::regprocedure)
    into dish_detail_def;

  if search_def not like '%catalog_menu_is_displayable%' or search_def not like '%catalog_display_image_url%' then
    raise exception 'search_dishes must filter menu rows and sanitize images';
  end if;
  if discovery_def not like '%catalog_menu_is_displayable%' or discovery_def not like '%catalog_display_image_url%' then
    raise exception 'get_discovery_feed_by_location must filter menu rows and sanitize images';
  end if;
  if dish_detail_def not like '%catalog_menu_is_displayable%' or dish_detail_def not like '%catalog_display_image_url%' then
    raise exception 'get_dish_detail must filter menu rows and sanitize images';
  end if;
end $$;

rollback;
