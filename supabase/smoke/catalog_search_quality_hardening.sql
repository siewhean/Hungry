-- Smoke checks for the round-two search mediums and lows:
--   20261022020100_search_dishes_all_dietary_flags.sql (onboarding-M5 server part)
--   20261022020200_catalog_search_quality_hardening.sql (search-M1, M3, M4, M11, L2)
--   20261022020300_catalog_suggest_fuzzy_food_types.sql (search-M10)
-- Runs in a transaction and rolls back; nothing it inserts survives.

begin;

-- search_dishes: every requested dietary flag must hold (no "any one flag" overlap).
do $$
declare
  v_def text := pg_get_functiondef('public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean)'::regprocedure);
begin
  if v_def like '%d.availability_flags && params.dietary_flags%' or v_def like '%v.dietary_tags && params.dietary_flags%' then
    raise exception 'search_dishes still lets one overlapping dietary flag through';
  end if;
  if v_def not like '%requested.flag = any(coalesce(d.availability_flags%' then
    raise exception 'search_dishes should require every requested dietary flag';
  end if;
  if v_def like '%security definer%' then
    raise exception 'search_dishes must stay SECURITY INVOKER';
  end if;
end;
$$;

-- Swap in a throwaway active release for the duration of the transaction.
update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0222-a000-0000000000c1', 'active', now() + interval '1 hour');

-- Viewer at (1.2813, 103.8458). Two "Zqxsmk Chicken" dishes: the nearer has no reviews, the
-- slightly farther one is verified with a rating and reviews. Prices 8.00 and 3.00, plus a
-- dish with no price. "Zqxsmk Noodle Soup" is food type "zqxsmknoodle".
insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, food_type, price,
  rating, review_count, verification_status, listing_location
)
values
  ('00000000-0000-0222-a000-0000000000c1', 'smk-q-near', 'smk-q-v1', 'smk-q-b1', 'Zqxsmk Chicken',
   'Plover Near Stall', 'Plover Hall', null, 8.00, 0, 0, 'raw',
   st_setsrid(st_makepoint(103.8485, 1.2813), 4326)::geography),
  ('00000000-0000-0222-a000-0000000000c1', 'smk-q-good', 'smk-q-v2', 'smk-q-b1', 'Zqxsmk Chicken',
   'Plover Good Stall', 'Plover Hall', null, 3.00, 4.5, 200, 'verified',
   st_setsrid(st_makepoint(103.8566, 1.2813), 4326)::geography),
  ('00000000-0000-0222-a000-0000000000c1', 'smk-q-noprice', 'smk-q-v3', 'smk-q-b1', 'Zqxsmk Noodle Soup',
   'Plover Noodle Stall', 'Plover Hall', 'zqxsmknoodle', null, 0, 0, 'raw',
   st_setsrid(st_makepoint(103.8500, 1.2813), 4326)::geography);

insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, min_price, quality_rating, quality_review_count,
  verification_status, listing_location
)
values
  ('00000000-0000-0222-a000-0000000000c1', 'smk-q-v1', 'smk-q-b1', 'Zqxsmk Near Stall', 'Plover Hall', 8.00, 0, 0, 'raw',
   st_setsrid(st_makepoint(103.8485, 1.2813), 4326)::geography),
  ('00000000-0000-0222-a000-0000000000c1', 'smk-q-v2', 'smk-q-b1', 'Zqxsmk Good Stall', 'Plover Hall', 3.00, 4.5, 200, 'verified',
   st_setsrid(st_makepoint(103.8566, 1.2813), 4326)::geography),
  ('00000000-0000-0222-a000-0000000000c1', 'smk-q-v3', 'smk-q-b1', 'Zqxsmk Noodle Stall', 'Plover Hall', null, 0, 0, 'raw',
   st_setsrid(st_makepoint(103.8500, 1.2813), 4326)::geography);

select set_config('request.jwt.claim.sub', '00000000-0000-0222-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_second jsonb;
begin
  -- M1: one character is not searched, and the page says so with an empty result.
  v_page := public.catalog_raw_dishes_page(p_query => 'z', p_sort => 'relevance', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 0 or (v_page->>'match_count')::integer <> 0 then
    raise exception 'a one-character dish query should return an empty page, got %', v_page;
  end if;
  v_page := public.catalog_raw_venues_page(p_query => 'z', p_sort => 'relevance', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'a one-character stall query should return an empty page, got %', v_page;
  end if;

  -- L2: LIKE wildcards are literal. "%%" and "__" must not match every row.
  v_page := public.catalog_raw_dishes_page(p_query => '%%', p_sort => 'relevance', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'a percent query should not match every dish, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_query => '__', p_sort => 'relevance', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'an underscore query should not match every dish, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_venues_page(p_query => '%%', p_sort => 'relevance', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'a percent query should not match every stall, got %', v_page->'items';
  end if;

  -- L2: a very long query is capped, not rejected.
  v_page := public.catalog_raw_dishes_page(p_query => 'Zqxsmk Chicken' || repeat('x', 500), p_sort => 'relevance', p_limit => 10);
  if jsonb_typeof(v_page->'items') <> 'array' then
    raise exception 'a long query should still return a page';
  end if;

  -- M4: the verified, reviewed dish outranks the nearer one with no reviews.
  v_page := public.catalog_raw_dishes_page(
    p_query => 'Zqxsmk Chicken', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 1
  );
  if v_page->'items'->0->>'id' <> 'smk-q-good' then
    raise exception 'quality should lift the reviewed dish above the nearer one, got %', v_page->'items'->0;
  end if;
  -- ...and the cursor still pages on to the other dish.
  v_second := public.catalog_raw_dishes_page(
    p_query => 'Zqxsmk Chicken', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 1,
    p_cursor => v_page->>'next_cursor'
  );
  if v_second->'items'->0->>'id' <> 'smk-q-near' then
    raise exception 'the relevance cursor should continue with the next dish, got %', v_second->'items';
  end if;
  if (v_page->>'match_count')::integer <> 2 then
    raise exception 'match_count should be 2 for the two chicken dishes, got %', v_page->>'match_count';
  end if;

  -- M3: price sort is cheapest first, dishes without a price last, and it pages.
  v_page := public.catalog_raw_dishes_page(p_query => 'Zqxsmk', p_sort => 'price', p_limit => 2);
  if v_page->'items'->0->>'id' <> 'smk-q-good' or v_page->'items'->1->>'id' <> 'smk-q-near' then
    raise exception 'price sort should list 3.00 then 8.00, got %', v_page->'items';
  end if;
  v_second := public.catalog_raw_dishes_page(p_query => 'Zqxsmk', p_sort => 'price', p_limit => 2, p_cursor => v_page->>'next_cursor');
  if jsonb_array_length(v_second->'items') <> 1 or v_second->'items'->0->>'id' <> 'smk-q-noprice' then
    raise exception 'the unpriced dish should come last, got %', v_second->'items';
  end if;
  v_page := public.catalog_raw_venues_page(p_query => 'Zqxsmk', p_sort => 'price', p_limit => 3);
  if v_page->'items'->0->>'id' <> 'smk-q-v2' or v_page->'items'->2->>'id' <> 'smk-q-v3' then
    raise exception 'stall price sort should list the cheapest first and unpriced last, got %', v_page->'items';
  end if;

  -- M11: food keywords match dishes by food type or name, and stalls that sell them.
  v_page := public.catalog_raw_dishes_page(p_food_keywords => array['zqxsmknoodle'], p_sort => 'nearby', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 1 or v_page->'items'->0->>'id' <> 'smk-q-noprice' then
    raise exception 'food keyword should match by food type, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_food_keywords => array['zqxsmk chick'], p_sort => 'nearby', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 2 then
    raise exception 'food keyword should match by dish name, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_venues_page(p_food_keywords => array['zqxsmknoodle'], p_sort => 'nearby', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 1 or v_page->'items'->0->>'id' <> 'smk-q-v3' then
    raise exception 'stall food keyword should find stalls that sell the food, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_food_keywords => array['%'], p_sort => 'nearby', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'a percent food keyword must be literal, got %', v_page->'items';
  end if;

  -- M10: a typo of a food type still yields a suggestion, and short text is not fuzzy-matched.
  if not exists (
    select 1 from jsonb_array_elements(public.catalog_suggest('zqxsmknodle')) item
    where item->>'label' = 'zqxsmknoodle' and item->>'kind' = 'food_type'
  ) then
    raise exception 'catalog_suggest should offer the closest food type for a typo, got %', public.catalog_suggest('zqxsmknodle');
  end if;
end;
$$;

reset role;

do $$
begin
  if to_regprocedure('public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])') is not null then
    raise exception 'the old catalog_raw_dishes_page signature should be gone (PostgREST overload)';
  end if;
  if to_regprocedure('public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[])') is not null then
    raise exception 'the old catalog_raw_venues_page signature should be gone (PostgREST overload)';
  end if;
  if not has_function_privilege('anon', 'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[],text[],text)', 'execute')
     or not has_function_privilege('authenticated', 'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[],text[],text)', 'execute') then
    raise exception 'anon and authenticated must execute catalog_raw_dishes_page';
  end if;
  if not has_function_privilege('anon', 'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[],text[],text)', 'execute')
     or not has_function_privilege('authenticated', 'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[],text[],text)', 'execute') then
    raise exception 'anon and authenticated must execute catalog_raw_venues_page';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = 'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[],text[],text)'::regprocedure)
     or not (select p.prosecdef from pg_proc p where p.oid = 'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[],text[],text)'::regprocedure)
     or not (select p.prosecdef from pg_proc p where p.oid = 'public.catalog_suggest(text,integer)'::regprocedure) then
    raise exception 'the catalog read RPCs must stay SECURITY DEFINER';
  end if;
  if not has_function_privilege('anon', 'public.catalog_suggest(text,integer)', 'execute') then
    raise exception 'guests must be able to call catalog_suggest';
  end if;
end;
$$;

select 'catalog_search_quality_hardening' as check_name, 'ok' as detail;

rollback;
