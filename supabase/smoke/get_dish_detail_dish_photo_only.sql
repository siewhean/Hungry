-- Smoke: get_dish_detail never shows the stall photo as the dish photo (H27).
-- Run after applying 20261021160000_get_dish_detail_dish_photo_only.sql. Rolled back.

begin;

do $$
declare
  detail_image text;
  detail_gallery text[];
  detail_def text;
begin
  select pg_get_functiondef('public.get_dish_detail(text)'::regprocedure) into detail_def;
  if detail_def ilike '%v.image_url%' then
    raise exception 'get_dish_detail must not read the venue image';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = 'public.get_dish_detail(text)'::regprocedure) then
    raise exception 'get_dish_detail must stay security invoker';
  end if;

  insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
  values (
    'dish-photo-only-smoke-building', 'dish-photo-only-smoke-building',
    'Dish Photo Smoke Building', 'hawker_centre', 1.3002, 103.8002, array['01']
  )
  on conflict (id) do nothing;

  insert into venues (
    id, building_id, name, unit_number, floor, operating_hours,
    image_url, media_approved_for_display, media_rights_status, media_source_url
  )
  values (
    'dish-photo-only-smoke-venue', 'dish-photo-only-smoke-building',
    'Dish Photo Smoke Venue', '#01-02', '01', 'Mon-Sun 9am-9pm',
    'https://merchant.example/stall.jpg', true, 'merchant_owned', 'https://merchant.example/'
  )
  on conflict (id) do nothing;

  -- A dish with no photo of its own.
  insert into dishes (
    id, venue_id, building_id, name, distance_meters, rating_avg, review_count,
    price, price_range, menu_approved_for_display, menu_rights_status, menu_source_url
  )
  values (
    'dish-photo-only-smoke-dish', 'dish-photo-only-smoke-venue', 'dish-photo-only-smoke-building',
    'Smoke Plain Mee', 50, 0, 0, 4.00, '$4', true, 'merchant_owned',
    'https://merchant.example/menu'
  )
  on conflict (id) do nothing;

  select d.image_url, d.gallery
  into detail_image, detail_gallery
  from public.get_dish_detail('dish-photo-only-smoke-dish') d;

  if not found then
    raise exception 'get_dish_detail should return the smoke dish';
  end if;
  if detail_image is not null then
    raise exception 'A dish without a photo must return a null image_url, got %', detail_image;
  end if;
  if coalesce(cardinality(detail_gallery), 0) <> 0 then
    raise exception 'A dish without a photo must return an empty gallery, got %', detail_gallery;
  end if;

  -- The dish's own photo is still returned.
  update dishes
  set image_url = 'https://merchant.example/mee.jpg',
      media_approved_for_display = true,
      media_rights_status = 'merchant_owned',
      media_source_url = 'https://merchant.example/'
  where id = 'dish-photo-only-smoke-dish';

  select d.image_url, d.gallery
  into detail_image, detail_gallery
  from public.get_dish_detail('dish-photo-only-smoke-dish') d;

  if detail_image is distinct from 'https://merchant.example/mee.jpg'
    or detail_gallery is distinct from array['https://merchant.example/mee.jpg'] then
    raise exception 'The dish photo should be image_url and gallery, got % / %', detail_image, detail_gallery;
  end if;
end $$;

select 'get_dish_detail_dish_photo_only_smoke_passed' as result;

rollback;
