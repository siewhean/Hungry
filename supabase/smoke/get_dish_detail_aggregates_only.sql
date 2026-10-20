-- Smoke: get_dish_detail returns the dish and its aggregates, never a review list.
-- Run after applying 20261020020000_get_dish_detail_aggregates_only.sql. Rolled back.

begin;

do $$
declare
  detail_def text;
  detail_reviews jsonb;
  detail_review_count integer;
  detail_rating numeric;
begin
  select pg_get_functiondef('public.get_dish_detail(text)'::regprocedure) into detail_def;
  if detail_def ilike '%from reviews%' or detail_def ilike '%review_photos%' then
    raise exception 'get_dish_detail must not read reviews or review photos';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = 'public.get_dish_detail(text)'::regprocedure) then
    raise exception 'get_dish_detail must stay security invoker';
  end if;
  if not has_function_privilege('anon', 'public.get_dish_detail(text)', 'execute') then
    raise exception 'anon must keep execute on get_dish_detail';
  end if;

  insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
  values (
    'dish-detail-agg-smoke-building', 'dish-detail-agg-smoke-building',
    'Dish Detail Smoke Building', 'hawker_centre', 1.3001, 103.8001, array['01']
  )
  on conflict (id) do nothing;

  insert into venues (id, building_id, name, unit_number, floor, operating_hours)
  values (
    'dish-detail-agg-smoke-venue', 'dish-detail-agg-smoke-building',
    'Dish Detail Smoke Venue', '#01-01', '01', 'Mon-Sun 9am-9pm'
  )
  on conflict (id) do nothing;

  insert into dishes (
    id, venue_id, building_id, name, distance_meters, rating_avg, review_count,
    price, price_range, menu_approved_for_display, menu_rights_status, menu_source_url
  )
  values (
    'dish-detail-agg-smoke-dish', 'dish-detail-agg-smoke-venue', 'dish-detail-agg-smoke-building',
    'Smoke Agg Mee', 50, 4.4, 12, 4.50, '$4-$5', true, 'merchant_owned',
    'https://merchant.example/menu'
  )
  on conflict (id) do nothing;

  select d.reviews, d.review_count, d.rating
  into detail_reviews, detail_review_count, detail_rating
  from public.get_dish_detail('dish-detail-agg-smoke-dish') d;

  if detail_reviews is distinct from '[]'::jsonb then
    raise exception 'get_dish_detail reviews must be an empty array, got %', detail_reviews;
  end if;
  if detail_review_count is distinct from 12 or detail_rating is distinct from 4.4 then
    raise exception 'get_dish_detail must keep rating and review_count aggregates';
  end if;
end $$;

rollback;
