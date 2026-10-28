-- Smoke checks for 20261029100000_search_dishes_decide_filters.sql.
-- search_dishes filters on cuisine and staple keywords in the database (whole words, plurals
-- allowed, matched on name, food type, course, taste tags and the cuisine tags of the dish and
-- its stall), and returns food_type, course and cuisine_tags. Brings its own building, so it
-- runs on prod (no seed data) as well as staging. Rolls back.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-0052-building', 'Smoke 0052 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude, cuisine_tags)
values
  ('smoke-0052-chinese', 'smoke-0052-building', 'Smoke 0052 Chinese Stall', '#01-01', 'L1', 1.301, 103.801, '{Chinese}'),
  ('smoke-0052-malay', 'smoke-0052-building', 'Smoke 0052 Malay Stall', '#01-02', 'L1', 1.302, 103.802, '{Malay}');

insert into dishes (
  id, venue_id, building_id, name, price, price_range, food_type, course, taste_tags,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-0052-mee', 'smoke-0052-chinese', 'smoke-0052-building', 'Smoke 0052 Wanton Mee', 5, 'S$5.00',
   'Noodles', 'Main', '{savoury}', true, 'licensed', true, 'licensed'),
  ('smoke-0052-tea', 'smoke-0052-chinese', 'smoke-0052-building', 'Smoke 0052 Teh Tarik', 2, 'S$2.00',
   'Tea', 'Drink', '{sweet}', true, 'licensed', true, 'licensed'),
  ('smoke-0052-nasi', 'smoke-0052-malay', 'smoke-0052-building', 'Smoke 0052 Nasi Special', 6, 'S$6.00',
   'Rice Dishes', 'Main', '{}', true, 'licensed', true, 'licensed');

set local role anon;

do $$
declare
  v_ids text;
  v_row record;
begin
  -- Staple: "noodle" matches the food type "Noodles" (plural), nothing else at that stall.
  select string_agg(dish_id, ',' order by dish_id) into v_ids
  from public.search_dishes(p_venue_id => 'smoke-0052-chinese', p_staple_keywords => array['noodle']);
  if v_ids is distinct from 'smoke-0052-mee' then
    raise exception 'staple noodle should return only the noodle dish, got %', v_ids;
  end if;

  -- Staple: the course counts, so "drink" finds the tea.
  select string_agg(dish_id, ',' order by dish_id) into v_ids
  from public.search_dishes(p_venue_id => 'smoke-0052-chinese', p_staple_keywords => array['drink']);
  if v_ids is distinct from 'smoke-0052-tea' then
    raise exception 'staple drink should return only the drink, got %', v_ids;
  end if;

  -- Whole words only: "ice" is not inside "Rice Dishes".
  select string_agg(dish_id, ',' order by dish_id) into v_ids
  from public.search_dishes(p_venue_id => 'smoke-0052-malay', p_staple_keywords => array['ice']);
  if v_ids is not null then
    raise exception 'staple ice must not match Rice Dishes, got %', v_ids;
  end if;

  -- Cuisine comes from the stall's tags: both Chinese-stall dishes match, the Malay stall's does not.
  select string_agg(dish_id, ',' order by dish_id) into v_ids
  from public.search_dishes(p_venue_id => 'smoke-0052-chinese', p_cuisine_keywords => array['chinese']);
  if v_ids is distinct from 'smoke-0052-mee,smoke-0052-tea' then
    raise exception 'cuisine chinese should return both dishes of the Chinese stall, got %', v_ids;
  end if;
  select string_agg(dish_id, ',' order by dish_id) into v_ids
  from public.search_dishes(p_venue_id => 'smoke-0052-chinese', p_cuisine_keywords => array['malay']);
  if v_ids is not null then
    raise exception 'cuisine malay must not match the Chinese stall, got %', v_ids;
  end if;

  -- Both filters must hold.
  select string_agg(dish_id, ',' order by dish_id) into v_ids
  from public.search_dishes(
    p_venue_id => 'smoke-0052-chinese',
    p_cuisine_keywords => array['chinese'],
    p_staple_keywords => array['noodle']
  );
  if v_ids is distinct from 'smoke-0052-mee' then
    raise exception 'cuisine and staple together should return only the noodle dish, got %', v_ids;
  end if;

  -- Regex characters in a keyword are stripped, not run.
  select string_agg(dish_id, ',' order by dish_id) into v_ids
  from public.search_dishes(p_venue_id => 'smoke-0052-chinese', p_staple_keywords => array['(a|b)*.*', '']);
  if v_ids is not null then
    raise exception 'a pattern-like keyword must not match everything, got %', v_ids;
  end if;

  -- The new columns come back, with the stall's cuisine tags merged in.
  select * into v_row
  from public.search_dishes(p_venue_id => 'smoke-0052-malay')
  where dish_id = 'smoke-0052-nasi';
  if v_row.food_type is distinct from 'Rice Dishes'
    or v_row.course is distinct from 'Main'
    or v_row.cuisine_tags is distinct from array['Malay']::text[] then
    raise exception 'food_type, course and cuisine_tags were not returned: %, %, %',
      v_row.food_type, v_row.course, v_row.cuisine_tags;
  end if;

  -- No keywords: nothing is filtered out.
  if (select count(*) from public.search_dishes(p_venue_id => 'smoke-0052-chinese')) <> 2 then
    raise exception 'without keywords both dishes of the Chinese stall should come back';
  end if;
end $$;

reset role;

rollback;
