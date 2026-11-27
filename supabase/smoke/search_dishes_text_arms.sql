-- Plain-text search keeps its candidates and finds tag matches through the new indexes. Fixtures are rolled back.
begin;

insert into public.buildings (id, name, building_type, latitude, longitude)
values ('smoke-sta-building', 'Smoke STA Building', 'hawker_centre', 1.2803, 103.8448);

insert into public.venues (id, building_id, name, floor, operating_hours, cuisine_tags)
values
  ('smoke-sta-v1', 'smoke-sta-building', 'Smoke STA Stall One', '1', '09:00-17:00', '{}'::text[]),
  ('smoke-sta-v2', 'smoke-sta-building', 'Smoke STA Stall Two', '1', '09:00-17:00', '{}'::text[]),
  ('smoke-sta-v3', 'smoke-sta-building', 'Smoke STA Stall Three', '1', '09:00-17:00', array['smokevtagqxz']);

insert into public.dishes (
  id, venue_id, building_id, name, price, rating_avg, review_count, distance_meters,
  availability_flags, menu_approved_for_display, menu_rights_status, food_type, taste_tags, cuisine_tags
)
values
  ('smoke-sta-name-1', 'smoke-sta-v2', 'smoke-sta-building', 'Smoke STA Zorblat Noodle', 5, 4, 1, 0, '{}', true, 'merchant_owned', null, '{}', '{}'),
  ('smoke-sta-near-1', 'smoke-sta-v1', 'smoke-sta-building', 'Smoke STA Zorblat Noodel', 5, 4, 1, 0, '{}', true, 'merchant_owned', null, '{}', '{}'),
  ('smoke-sta-hidden-1', 'smoke-sta-v1', 'smoke-sta-building', 'Smoke STA Zorblat Noodle Hidden', 5, 4, 1, 0, '{}', false, 'unverified', null, '{}', '{}'),
  ('smoke-sta-tag-1', 'smoke-sta-v1', 'smoke-sta-building', 'Smoke STA Plain One', 5, 3, 1, 0, '{}', true, 'merchant_owned', null, array['smoketagqxz'], '{}'),
  ('smoke-sta-food-1', 'smoke-sta-v1', 'smoke-sta-building', 'Smoke STA Plain Two', 5, 3, 1, 0, '{}', true, 'merchant_owned', 'smokefoodqxz', '{}', '{}'),
  ('smoke-sta-cuis-1', 'smoke-sta-v1', 'smoke-sta-building', 'Smoke STA Plain Three', 5, 3, 1, 0, '{}', true, 'merchant_owned', null, '{}', array['smokecuisqxz']),
  ('smoke-sta-vtag-1', 'smoke-sta-v3', 'smoke-sta-building', 'Smoke STA Plain Four', 5, 3, 1, 0, '{}', true, 'merchant_owned', null, '{}', '{}');

insert into public.dishes (
  id, venue_id, building_id, name, price, rating_avg, review_count, distance_meters,
  availability_flags, menu_approved_for_display, menu_rights_status
)
select
  'smoke-sta-bulk-' || lpad(i::text, 3, '0'), 'smoke-sta-v1', 'smoke-sta-building',
  'Smoke STA Bulkwok Dish ' || i, 5, 3, 1, 0, '{}', true, 'merchant_owned'
from generate_series(1, 260) i;

do $$
declare
  v_body text := (select prosrc from pg_proc where oid = 'public.search_dishes(text,double precision,double precision,integer,text[],integer,
    double precision,text,text,text,text[],numeric,boolean,text[],text[])'::regprocedure);
  v_fn regprocedure;
begin
  if strpos(v_body, 'app_private.search_dish_name_ilike_rows(params.query)') = 0
    or strpos(v_body, 'app_private.search_dish_tag_ids(params.query)') = 0
    or strpos(v_body, 'or array_to_string(v.cuisine_tags, '' '') ilike ''%'' || params.query') > 0
  then
    raise exception 'search_dishes must read its text candidates through the indexed helpers';
  end if;

  if (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
        'idx_dishes_food_type_trgm', 'idx_dishes_taste_tags_trgm',
        'idx_dishes_cuisine_tags_trgm', 'idx_venues_cuisine_tags_trgm')) <> 4
  then
    raise exception 'The four tag search indexes must exist';
  end if;

  foreach v_fn in array array[
    'app_private.search_dish_name_ilike_rows(text)'::regprocedure,
    'app_private.search_dish_name_fuzzy_rows(text)'::regprocedure,
    'app_private.search_dish_name_close_rows(text)'::regprocedure,
    'app_private.search_dish_tag_ids(text)'::regprocedure
  ] loop
    if exists (select 1 from pg_proc where oid = v_fn and prosecdef)
      or not has_function_privilege('anon', v_fn, 'EXECUTE')
      or not has_function_privilege('authenticated', v_fn, 'EXECUTE')
    then
      raise exception 'Search helper must run as the caller and be callable by anon and signed-in users: %', v_fn;
    end if;
  end loop;
end;
$$;

set local role anon;

do $$
declare
  v_ids text[];
  v_count integer;
begin
  -- Substring match ranks first, a near-miss spelling still appears (fewer than 250 substring
  -- matches keeps the loose trigram read), and a hidden dish never does.
  select array_agg(r.dish_id order by r.ord) into v_ids
  from (
    select dish_id, row_number() over () as ord
    from public.search_dishes(p_query => 'Zorblat Noodle', p_limit => 50)
  ) r;
  if v_ids is null
    or not ('smoke-sta-name-1' = any(v_ids))
    or not ('smoke-sta-near-1' = any(v_ids))
    or 'smoke-sta-hidden-1' = any(v_ids)
    or array_position(v_ids, 'smoke-sta-name-1') > array_position(v_ids, 'smoke-sta-near-1')
  then
    raise exception 'Name search must rank the substring match first, keep the near miss and hide hidden dishes: %', v_ids;
  end if;

  -- With 250 or more substring matches only the first 50 are returned and all of them match.
  select count(*) into v_count from public.search_dishes(p_query => 'Bulkwok Dish', p_limit => 50);
  if v_count <> 50 or exists (
    select 1 from public.search_dishes(p_query => 'Bulkwok Dish', p_limit => 50) s
    where s.name not ilike '%Bulkwok Dish%'
  ) then
    raise exception 'A broad name search must return a full page of matches (got %)', v_count;
  end if;

  -- Tags and food type, on the dish and on its stall.
  if not exists (select 1 from public.search_dishes(p_query => 'smoketagqxz', p_limit => 50) where dish_id = 'smoke-sta-tag-1')
    or not exists (select 1 from public.search_dishes(p_query => 'smokefoodqxz', p_limit => 50) where dish_id = 'smoke-sta-food-1')
    or not exists (select 1 from public.search_dishes(p_query => 'smokecuisqxz', p_limit => 50) where dish_id = 'smoke-sta-cuis-1')
    or not exists (select 1 from public.search_dishes(p_query => 'smokevtagqxz', p_limit => 50) where dish_id = 'smoke-sta-vtag-1')
  then
    raise exception 'Tag, food type and stall cuisine searches must find their dishes';
  end if;

  -- A stall-scoped search stays inside that stall.
  select array_agg(dish_id) into v_ids
  from public.search_dishes(p_query => 'Zorblat', p_venue_id => 'smoke-sta-v2', p_limit => 50);
  if v_ids is distinct from array['smoke-sta-name-1'] then
    raise exception 'A stall-scoped search must return only that stall''s dishes: %', v_ids;
  end if;
end;
$$;

select 'search_dishes_text_arms_smoke_passed' as result;

rollback;
