-- Loads the owner-vetted dish food types (dish_food_types.csv, built from dish-food-types-vetted.xlsx).
-- Needs migration 20261018170000_dish_food_types.sql in the same session or already applied.
-- The caller wraps this in begin/rollback (dry run) or begin/commit, after copying the CSV to
-- /tmp/dish_food_types.csv (psql's \copy does not interpolate variables).
\set ON_ERROR_STOP on

create temp table food_type_load (dish_id text, food_type text, course text) on commit drop;
\copy food_type_load from '/tmp/dish_food_types.csv' with (format csv, header true)

\echo 'before:'
select count(*) as dishes, count(food_type) as with_food_type from public.dishes;

select count(*) as csv_rows, count(*) filter (where d.id is null) as unknown_dish_ids
from food_type_load f left join public.dishes d on d.id = f.dish_id;

update public.dishes d
set food_type = f.food_type, course = f.course
from food_type_load f
where d.id = f.dish_id;

\echo 'after:'
select count(*) as dishes, count(food_type) as with_food_type, count(distinct food_type) as food_types from public.dishes;

select public.catalog_raw_publish_release() as release_id;

\echo 'published dish cards with a food type:'
select count(*) as dish_cards, count(food_type) as with_food_type
from public.catalog_raw_dish_cards
where release_id = (select id from public.catalog_releases where status = 'active' order by created_at desc limit 1);

\echo 'search check (dishes found by food type):'
select q as query, (select count(*) from public.search_dishes(p_query => q, p_limit => 50)) as dishes_found
from unnest(array['Chicken Rice', 'Nasi Lemak', 'Laksa', 'Pizza', 'Sushi']) as q;
