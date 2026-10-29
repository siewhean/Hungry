-- Smoke checks for 20261029130000_catalog_search_home_precompute.sql (round-four Search audit SR4-11, SR4-12):
--   * quality_score is the Bayesian score (prior 4.0, weight 10), null with no reviews, and a trigger keeps
--     it in step when rating or review_count change
--   * "Top rated" (sort quality) puts 200 reviews at 4.7 above 1 review at 5.0, and unreviewed cards last,
--     for dishes and for stalls, and a cursor walks the same order
--   * catalog_release_highlights is built when a release becomes active and by the refresh function;
--     catalog_suggest with no text and the Search home featured request (sort quality, limit 3) read it;
--     other requests are searched live; signed-in users cannot read the table
-- Runs in a transaction and rolls back; nothing it inserts survives.

begin;

-- Swap in a throwaway active release for the duration of the transaction.
update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0230-a000-0000000000d1', 'active', now() + interval '1 hour');

insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, min_price, quality_rating, quality_review_count,
  verification_status, listing_location
)
values
  ('00000000-0000-0230-a000-0000000000d1', 'ph-v1', 'ph-b1', 'Smoke PH One Review', 'Smoke PH Food Centre', 5.00, 5.00, 1, 'verified',
   st_setsrid(st_makepoint(103.8458, 1.2813), 4326)::geography),
  ('00000000-0000-0230-a000-0000000000d1', 'ph-v2', 'ph-b1', 'Smoke PH Many Reviews', 'Smoke PH Food Centre', 5.00, 4.70, 200, 'verified',
   st_setsrid(st_makepoint(103.8459, 1.2813), 4326)::geography),
  ('00000000-0000-0230-a000-0000000000d1', 'ph-v3', 'ph-b1', 'Smoke PH No Reviews', 'Smoke PH Food Centre', 5.00, 0, 0, 'verified',
   st_setsrid(st_makepoint(103.8460, 1.2813), 4326)::geography);

insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, food_type, price,
  rating, review_count, verification_status, listing_location
)
values
  ('00000000-0000-0230-a000-0000000000d1', 'ph-d1', 'ph-v1', 'ph-b1', 'Smoke PH Five Star Once', 'Smoke PH One Review', 'Smoke PH Food Centre', 'PH Soup', 5.00, 5.00, 1, 'verified',
   st_setsrid(st_makepoint(103.8458, 1.2813), 4326)::geography),
  ('00000000-0000-0230-a000-0000000000d1', 'ph-d2', 'ph-v2', 'ph-b1', 'Smoke PH Solid Favourite', 'Smoke PH Many Reviews', 'Smoke PH Food Centre', 'PH Soup', 5.00, 4.70, 200, 'verified',
   st_setsrid(st_makepoint(103.8459, 1.2813), 4326)::geography),
  ('00000000-0000-0230-a000-0000000000d1', 'ph-d3', 'ph-v3', 'ph-b1', 'Smoke PH Not Yet Reviewed', 'Smoke PH No Reviews', 'Smoke PH Food Centre', 'PH Curry', 5.00, 0, 0, 'verified',
   st_setsrid(st_makepoint(103.8460, 1.2813), 4326)::geography),
  ('00000000-0000-0230-a000-0000000000d1', 'ph-d4', 'ph-v3', 'ph-b1', 'Smoke PH Another Curry', 'Smoke PH No Reviews', 'Smoke PH Food Centre', 'PH Curry', 5.00, 3.00, 10, 'verified',
   st_setsrid(st_makepoint(103.8460, 1.2813), 4326)::geography);

select app_private.catalog_refresh_release_highlights('00000000-0000-0230-a000-0000000000d1');

select set_config('request.jwt.claim.sub', '00000000-0000-0230-a000-000000000002', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_next jsonb;
  v_ids text;
  v_sug jsonb;
  v_release constant uuid := '00000000-0000-0230-a000-0000000000d1';
begin
  -- Highlights are private: a signed-in user reads them only through the functions.
  begin
    perform 1 from public.catalog_release_highlights limit 1;
    raise exception 'catalog_release_highlights should not be readable by signed-in users';
  exception when insufficient_privilege then
    null;
  end;

  -- Dishes, live path (limit above 3): 200 at 4.7, then 1 at 5.0, then 10 at 3.0 (4.0 + 10 * -1 / 20 = 3.5),
  -- then the unreviewed dish last.
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 50, p_release_id => v_release);
  select string_agg(i->>'id', ',' order by o) into v_ids from jsonb_array_elements(v_page->'items') with ordinality t(i, o);
  if v_ids <> 'ph-d2,ph-d1,ph-d4,ph-d3' then
    raise exception 'sort quality should rank 200 reviews at 4.7 above 1 at 5.0, unreviewed last; got %', v_ids;
  end if;
  if (v_page->'items'->0) ? 'quality_score' then
    raise exception 'quality_score is an internal column, not part of the card, got %', v_page->'items'->0;
  end if;
  if (v_page->'items'->1->>'rating')::numeric <> 5.00 then
    raise exception 'the displayed rating stays the raw average, got %', v_page->'items'->1;
  end if;

  -- A cursor walks the same order, one card at a time (limit 2 is not the featured request).
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 2, p_release_id => v_release);
  v_ids := (v_page->'items'->0->>'id') || ',' || (v_page->'items'->1->>'id');
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 2, p_cursor => v_page->>'next_cursor', p_release_id => v_release);
  v_ids := v_ids || ',' || (v_page->'items'->0->>'id') || ',' || (v_page->'items'->1->>'id');
  if v_ids <> 'ph-d2,ph-d1,ph-d4,ph-d3' then
    raise exception 'paging by cursor should keep the order, got %', v_ids;
  end if;

  -- Stalls: the same rule on the top dish's rating.
  v_page := public.catalog_raw_venues_page(p_sort => 'quality', p_limit => 50, p_release_id => v_release);
  select string_agg(i->>'id', ',' order by o) into v_ids from jsonb_array_elements(v_page->'items') with ordinality t(i, o);
  if v_ids <> 'ph-v2,ph-v1,ph-v3' then
    raise exception 'stalls should rank 200 reviews at 4.7 above 1 at 5.0, unreviewed last; got %', v_ids;
  end if;
  v_page := public.catalog_raw_venues_page(p_sort => 'quality', p_limit => 2, p_release_id => v_release);
  v_next := public.catalog_raw_venues_page(p_sort => 'quality', p_limit => 2, p_cursor => v_page->>'next_cursor', p_release_id => v_release);
  if v_next->'items'->0->>'id' <> 'ph-v3' or jsonb_array_length(v_next->'items') <> 1 then
    raise exception 'the stall cursor should continue with the unreviewed stall, got %', v_next;
  end if;

  -- The featured request is answered from the highlights: same cards, in order, no cursor.
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 3, p_release_id => v_release);
  select string_agg(i->>'id', ',' order by o) into v_ids from jsonb_array_elements(v_page->'items') with ordinality t(i, o);
  if v_ids <> 'ph-d2,ph-d1,ph-d4' or v_page->>'next_cursor' is not null then
    raise exception 'the featured request should list the top 3 from the highlights, got %', v_page;
  end if;
  if v_page->'items'->0->>'name' <> 'Smoke PH Solid Favourite' or (v_page->'items'->0->>'review_count')::integer <> 200
     or v_page->'items'->0->>'venue_name' <> 'Smoke PH Many Reviews' or v_page->'items'->0 ? 'listing_location' then
    raise exception 'a highlights card should look like a page card, got %', v_page->'items'->0;
  end if;

  -- Suggestions with no text list the popular food types (two PH Soup, two PH Curry; ties by name).
  v_sug := public.catalog_suggest(null, 8);
  if (select string_agg(s->>'label', ',' order by o) from jsonb_array_elements(v_sug) with ordinality t(s, o)
      where s->>'label' like 'PH %') <> 'PH Curry,PH Soup' then
    raise exception 'suggest with no text should list the popular food types, got %', v_sug;
  end if;
end;
$$;

reset role;

-- The lists are built at publish, so a dish added later shows in a live search at once and in the
-- highlights only after the next refresh.
insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, food_type, price,
  rating, review_count, verification_status, listing_location
)
values ('00000000-0000-0230-a000-0000000000d1', 'ph-d5', 'ph-v2', 'ph-b1', 'Smoke PH Late Star', 'Smoke PH Many Reviews', 'Smoke PH Food Centre', 'PH Dessert', 5.00, 4.90, 500, 'verified',
  st_setsrid(st_makepoint(103.8459, 1.2813), 4326)::geography);

select set_config('request.jwt.claim.sub', '00000000-0000-0230-a000-000000000002', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_ids text;
  v_release constant uuid := '00000000-0000-0230-a000-0000000000d1';
begin
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 50, p_release_id => v_release);
  if v_page->'items'->0->>'id' <> 'ph-d5' then
    raise exception 'a live search should see the new dish first, got %', v_page->'items'->0;
  end if;
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 3, p_release_id => v_release);
  select string_agg(i->>'id', ',' order by o) into v_ids from jsonb_array_elements(v_page->'items') with ordinality t(i, o);
  if v_ids <> 'ph-d2,ph-d1,ph-d4' then
    raise exception 'the featured request should not see the new dish until the highlights are refreshed, got %', v_ids;
  end if;
  -- Anything with a filter, text or location is searched live, even at limit 3.
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 3, p_max_price => 6, p_release_id => v_release);
  if v_page->'items'->0->>'id' <> 'ph-d5' then
    raise exception 'a filtered request should be searched live, got %', v_page->'items'->0;
  end if;
  if exists (
    select 1 from jsonb_array_elements(public.catalog_suggest(null, 8)) s where s->>'label' = 'PH Dessert'
  ) then
    raise exception 'suggest with no text should not see a food type added after the highlights were built';
  end if;
end;
$$;

reset role;

select app_private.catalog_refresh_release_highlights('00000000-0000-0230-a000-0000000000d1');
select set_config('request.jwt.claim.sub', '00000000-0000-0230-a000-000000000002', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_release constant uuid := '00000000-0000-0230-a000-0000000000d1';
begin
  v_page := public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 3, p_release_id => v_release);
  if v_page->'items'->0->>'id' <> 'ph-d5' then
    raise exception 'a refresh should bring the new dish into the featured list, got %', v_page->'items'->0;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(public.catalog_suggest(null, 8)) s where s->>'label' = 'PH Dessert'
  ) then
    raise exception 'a refresh should bring the new food type into the suggestions';
  end if;
end;
$$;

reset role;

-- Writing a rating or a review count keeps the score in step; clearing the reviews clears the score.
update public.catalog_raw_dish_cards set rating = 2.00, review_count = 30 where release_id = '00000000-0000-0230-a000-0000000000d1' and id = 'ph-d1';
do $$
begin
  if abs((select quality_score from public.catalog_raw_dish_cards where release_id = '00000000-0000-0230-a000-0000000000d1' and id = 'ph-d1') - ((40 + 60.0) / 40)) > 0.0001 then
    raise exception 'quality_score should follow a new rating and review count';
  end if;
end;
$$;
update public.catalog_raw_dish_cards set review_count = 0 where release_id = '00000000-0000-0230-a000-0000000000d1' and id = 'ph-d1';
do $$
begin
  if (select quality_score from public.catalog_raw_dish_cards where release_id = '00000000-0000-0230-a000-0000000000d1' and id = 'ph-d1') is not null then
    raise exception 'a card with no reviews should have no score';
  end if;
end;
$$;

-- A release that becomes active gets its highlights without anyone calling the refresh.
update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';
insert into public.catalog_releases (id, status) values ('00000000-0000-0230-a000-0000000000d2', 'building');
do $$
begin
  if exists (select 1 from public.catalog_release_highlights where release_id = '00000000-0000-0230-a000-0000000000d2') then
    raise exception 'a release that is still building should have no highlights yet';
  end if;
end;
$$;
update public.catalog_releases set status = 'active', activated_at = now() + interval '2 hours' where id = '00000000-0000-0230-a000-0000000000d2';
do $$
begin
  if not exists (select 1 from public.catalog_release_highlights where release_id = '00000000-0000-0230-a000-0000000000d2') then
    raise exception 'activating a release should build its highlights';
  end if;
end;
$$;

select 'catalog_search_home_precompute' as check_name, 'ok' as detail;

rollback;
