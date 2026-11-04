-- Smoke checks for 20261029113000_catalog_search_relevance.sql (round-four Search audit SR4-1, SR4-2, SR4-5):
--   * a stall's name no longer ranks its whole menu ("chicken rice" must not list Pandan Cake)
--   * every word of the query must match ("maxwell laksa" is laksa at Maxwell, not every laksa)
--   * Singapore shorthand through the alias table (ckt, bcm, bak chor mee, kopi)
--   * "Did you mean" for typos, including swapped letters ("laska")
-- Runs in a transaction and rolls back; nothing it inserts survives.

begin;

-- Swap in a throwaway active release for the duration of the transaction.
update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0229-a000-0000000000c1', 'active', now() + interval '1 hour');

-- Viewer at (1.2813, 103.8458). Maxwell (b1) is about 200 m away, Tampines (b2) far away.
insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, min_price, quality_rating, quality_review_count,
  verification_status, listing_location
)
values
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v1', 'rel-b1', 'Tian Tian Chicken Rice', 'Maxwell Food Centre', 3.00, 4.5, 100, 'verified',
   st_setsrid(st_makepoint(103.8470, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v2', 'rel-b1', 'Maxwell Fuzhou Oyster Cake', 'Maxwell Food Centre', 2.50, 4.0, 40, 'verified',
   st_setsrid(st_makepoint(103.8471, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v3', 'rel-b1', 'Famous Laksa House', 'Maxwell Food Centre', 5.00, 4.2, 60, 'verified',
   st_setsrid(st_makepoint(103.8472, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v4', 'rel-b2', 'Tampines Laksa', 'Tampines Hub', 5.50, 4.0, 20, 'verified',
   st_setsrid(st_makepoint(103.9400, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v5', 'rel-b2', 'Charlie Fried Noodles', 'Tampines Hub', 5.00, 3.8, 15, 'verified',
   st_setsrid(st_makepoint(103.9401, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v6', 'rel-b2', 'Mee Station', 'Tampines Hub', 4.00, 3.9, 10, 'verified',
   st_setsrid(st_makepoint(103.9402, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v7', 'rel-b2', 'Stall Zeta', 'Tampines Hub', 4.50, 3.5, 5, 'verified',
   st_setsrid(st_makepoint(103.9403, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v8', 'rel-b2', 'Plain Coffee Shop', 'Tampines Hub', 1.50, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9404, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-v9', 'rel-b2', 'Corner Kitchen', 'Tampines Hub', 4.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography);

insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, food_type, price,
  rating, review_count, verification_status, listing_location
)
values
  ('00000000-0000-0229-a000-0000000000c1', 'rel-chicken', 'rel-v1', 'rel-b1', 'Chicken Rice', 'Tian Tian Chicken Rice', 'Maxwell Food Centre', 'Chicken Rice', 5.00, 4.5, 100, 'verified',
   st_setsrid(st_makepoint(103.8470, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-pandan', 'rel-v1', 'rel-b1', 'Pandan Cake', 'Tian Tian Chicken Rice', 'Maxwell Food Centre', 'Cakes', 3.00, 4.0, 10, 'verified',
   st_setsrid(st_makepoint(103.8470, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-oyster', 'rel-v2', 'rel-b1', 'Oyster Cake', 'Maxwell Fuzhou Oyster Cake', 'Maxwell Food Centre', null, 2.50, 4.0, 40, 'verified',
   st_setsrid(st_makepoint(103.8471, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-laksa-max', 'rel-v3', 'rel-b1', 'Curry Laksa', 'Famous Laksa House', 'Maxwell Food Centre', 'Laksa', 5.00, 4.2, 60, 'verified',
   st_setsrid(st_makepoint(103.8472, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-laksa-tamp', 'rel-v4', 'rel-b2', 'Laksa', 'Tampines Laksa', 'Tampines Hub', 'Laksa', 5.50, 4.0, 20, 'verified',
   st_setsrid(st_makepoint(103.9400, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-ckt', 'rel-v5', 'rel-b2', 'Char Kway Teow', 'Charlie Fried Noodles', 'Tampines Hub', 'Fried Noodles', 5.00, 3.8, 15, 'verified',
   st_setsrid(st_makepoint(103.9401, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-mmn', 'rel-v6', 'rel-b2', 'Minced Meat Noodles', 'Mee Station', 'Tampines Hub', 'Noodles', 4.00, 3.9, 10, 'verified',
   st_setsrid(st_makepoint(103.9402, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-zeta-chicken', 'rel-v7', 'rel-b2', 'Hainanese Chicken Rice', 'Stall Zeta', 'Tampines Hub', 'Chicken Rice', 4.50, 3.5, 5, 'verified',
   st_setsrid(st_makepoint(103.9403, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-zeta-burger', 'rel-v7', 'rel-b2', 'Cheese Burger', 'Stall Zeta', 'Tampines Hub', 'Burger', 6.50, 3.5, 5, 'verified',
   st_setsrid(st_makepoint(103.9403, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-kopi', 'rel-v8', 'rel-b2', 'Iced Coffee', 'Plain Coffee Shop', 'Tampines Hub', 'Coffee', 1.50, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9404, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-steak', 'rel-v9', 'rel-b2', 'Beef Steak', 'Corner Kitchen', 'Tampines Hub', 'Western', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-steamed', 'rel-v9', 'rel-b2', 'Steamed Fish', 'Corner Kitchen', 'Tampines Hub', 'Fish', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-friedrice', 'rel-v8', 'rel-b2', 'Fried Rice', 'Plain Coffee Shop', 'Tampines Hub', 'Rice', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-spice', 'rel-v9', 'rel-b2', 'Spice Chicken', 'Corner Kitchen', 'Tampines Hub', 'Chicken', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-shami', 'rel-v9', 'rel-b2', 'Shami Kebab', 'Corner Kitchen', 'Tampines Hub', 'Kebab', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-teh', 'rel-v9', 'rel-b2', 'Teh Tarik', 'Corner Kitchen', 'Tampines Hub', 'Drinks', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-milo', 'rel-v9', 'rel-b2', 'Iced Milo', 'Corner Kitchen', 'Tampines Hub', 'Drinks', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000c1', 'rel-ham', 'rel-v9', 'rel-b2', 'Ham Sandwich', 'Corner Kitchen', 'Tampines Hub', 'Western', 3.00, 3.0, 2, 'verified',
   st_setsrid(st_makepoint(103.9405, 1.3550), 4326)::geography);

select set_config('request.jwt.claim.sub', '00000000-0000-0229-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_second jsonb;
  v_ids text[];
begin
  -- SR4-1: "chicken rice" lists chicken-rice dishes, not the stall's other menu items.
  v_page := public.catalog_raw_dishes_page(p_query => 'chicken rice', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id' order by ord) into v_ids from jsonb_array_elements(v_page->'items') with ordinality as t(i, ord);
  if v_ids is distinct from array['rel-chicken', 'rel-zeta-chicken'] then
    raise exception 'chicken rice should list only the two chicken-rice dishes, nearest first, got %', v_ids;
  end if;

  -- ...but searching a stall by name still lists its whole menu (no dish matches by name there).
  v_page := public.catalog_raw_dishes_page(p_query => 'tian tian', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id' order by i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from array['rel-chicken', 'rel-pandan'] then
    raise exception 'a stall-name search should list that stall''s dishes, got %', v_ids;
  end if;

  -- SR4-2: every word must match. "maxwell laksa" is the laksa at Maxwell only.
  v_page := public.catalog_raw_dishes_page(p_query => 'maxwell laksa', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from array['rel-laksa-max'] then
    raise exception 'maxwell laksa should list only the laksa at Maxwell, got %', v_ids;
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'laksa', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 2 then
    raise exception 'laksa should list both laksa dishes, got %', v_page->'items';
  end if;
  -- Filler words do not have to match.
  v_page := public.catalog_raw_dishes_page(p_query => 'best laksa near me', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 2 then
    raise exception 'filler words should be ignored, got %', v_page->'items';
  end if;
  -- Punctuation is not a word.
  v_page := public.catalog_raw_dishes_page(p_query => '  laksa!! ', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 2 then
    raise exception 'punctuation should be ignored, got %', v_page->'items';
  end if;

  -- Plurals.
  v_page := public.catalog_raw_dishes_page(p_query => 'burgers', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-zeta-burger' then
    raise exception 'burgers should find the burger, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'burger', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-zeta-burger' then
    raise exception 'burger should find the burger, got %', v_page->'items';
  end if;

  -- A word is matched where it starts, never inside another word ("teh" has the alias tea, which is
  -- in "Steak"; "ice" is in "Rice" and "Spice"; "ham" is in "Shami").
  v_page := public.catalog_raw_dishes_page(p_query => 'teh', p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id' order by i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from array['rel-teh'] then
    raise exception 'teh should find only the teh tarik, got %', v_ids;
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'ice', p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id' order by i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from array['rel-kopi', 'rel-milo'] then
    raise exception 'ice should find the iced drinks, not Fried Rice or Spice Chicken, got %', v_ids;
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'ham', p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id' order by i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from array['rel-ham'] then
    raise exception 'ham should find only the ham sandwich, not Shami Kebab, got %', v_ids;
  end if;

  -- SR4-5: shorthand and local names.
  v_page := public.catalog_raw_dishes_page(p_query => 'ckt', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-ckt' or jsonb_array_length(v_page->'items') <> 1 then
    raise exception 'ckt should find char kway teow, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'bak chor mee', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-mmn' then
    raise exception 'bak chor mee should find minced meat noodles, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'bcm', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-mmn' then
    raise exception 'bcm should find minced meat noodles, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'kopi', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-kopi' then
    raise exception 'kopi should find the coffee, got %', v_page->'items';
  end if;
  -- An alias combined with another word still needs both.
  v_page := public.catalog_raw_dishes_page(p_query => 'ckt tampines', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-ckt' or jsonb_array_length(v_page->'items') <> 1 then
    raise exception 'ckt tampines should find the char kway teow at Tampines, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => 'ckt maxwell', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'ckt maxwell should find nothing (no char kway teow at Maxwell), got %', v_page->'items';
  end if;

  -- Typos: no results, but "Did you mean" offers the food type.
  v_page := public.catalog_raw_dishes_page(p_query => 'laska', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'laska should not match by itself, got %', v_page->'items';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(public.catalog_suggest('laska')) item
    where item->>'label' = 'Laksa' and item->>'kind' = 'food_type'
  ) then
    raise exception 'catalog_suggest should offer Laksa for laska, got %', public.catalog_suggest('laska');
  end if;
  if not exists (
    select 1 from jsonb_array_elements(public.catalog_suggest('chikcen rice')) item
    where item->>'label' = 'Chicken Rice'
  ) then
    raise exception 'catalog_suggest should offer Chicken Rice for chikcen rice, got %', public.catalog_suggest('chikcen rice');
  end if;
  if not exists (
    select 1 from jsonb_array_elements(public.catalog_suggest('chiken rice')) item
    where item->>'label' = 'Chicken Rice'
  ) then
    raise exception 'catalog_suggest should offer Chicken Rice for chiken rice, got %', public.catalog_suggest('chiken rice');
  end if;
  if public.catalog_suggest('zzzzzz') <> '[]'::jsonb then
    raise exception 'nonsense should get no suggestion, got %', public.catalog_suggest('zzzzzz');
  end if;

  -- The relevance cursor still pages through a multi-word query without repeats.
  v_page := public.catalog_raw_dishes_page(p_query => 'chicken rice', p_sort => 'relevance', p_limit => 1);
  v_second := public.catalog_raw_dishes_page(p_query => 'chicken rice', p_sort => 'relevance', p_limit => 1, p_cursor => v_page->>'next_cursor');
  if v_page->'items'->0->>'id' = v_second->'items'->0->>'id' or v_second->'items'->0->>'id' is null then
    raise exception 'the cursor should continue with the other chicken-rice dish, got % then %', v_page->'items', v_second->'items';
  end if;

  -- Stalls follow the same rule: every word on the stall name, its building or one of its dishes.
  v_page := public.catalog_raw_venues_page(p_query => 'maxwell laksa', p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from array['rel-v3'] then
    raise exception 'maxwell laksa should list only the laksa stall at Maxwell, got %', v_ids;
  end if;
  v_page := public.catalog_raw_venues_page(p_query => 'chicken rice', p_sort => 'relevance', p_limit => 20);
  select array_agg(i->>'id' order by i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from array['rel-v1', 'rel-v7'] then
    raise exception 'chicken rice should list the stall of that name and the stall that sells it, got %', v_ids;
  end if;
  v_page := public.catalog_raw_venues_page(p_query => 'ckt', p_sort => 'relevance', p_limit => 20);
  if v_page->'items'->0->>'id' is distinct from 'rel-v5' then
    raise exception 'stall search for ckt should find the char kway teow stall, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_venues_page(p_query => 'maxwell', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 3 then
    raise exception 'maxwell should list the three stalls in that building, got %', v_page->'items';
  end if;

  -- Wildcards and punctuation alone match nothing.
  v_page := public.catalog_raw_venues_page(p_query => '%%', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'a percent query should not match every stall, got %', v_page->'items';
  end if;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.catalog_food_aliases', 'select')
     or has_table_privilege('authenticated', 'public.catalog_food_aliases', 'select') then
    raise exception 'catalog_food_aliases must not be readable by clients';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.catalog_food_aliases'::regclass) then
    raise exception 'catalog_food_aliases must have row level security on';
  end if;
  if has_function_privilege('authenticated', 'app_private.catalog_search_terms(text)', 'execute')
     or has_function_privilege('anon', 'app_private.catalog_text_match(integer[],text[],double precision[],integer,text,text,text,text)', 'execute') then
    raise exception 'the search helpers must stay internal';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = 'public.catalog_suggest(text,integer)'::regprocedure)
     or (select p.provolatile from pg_proc p where p.oid = 'public.catalog_suggest(text,integer)'::regprocedure) <> 'v' then
    raise exception 'catalog_suggest must stay SECURITY DEFINER and VOLATILE';
  end if;
  if not has_function_privilege('anon', 'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[],text[],text)', 'execute')
     or not has_function_privilege('anon', 'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[],text[],text)', 'execute') then
    raise exception 'guests must still be able to search';
  end if;
end;
$$;

select 'catalog_search_relevance' as check_name, 'ok' as detail;

rollback;
