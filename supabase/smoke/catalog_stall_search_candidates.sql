-- Smoke checks for 20261030100000_catalog_stall_search_candidates.sql:
--   * every word must be answered, each by a dish, the stall name or the building ("maxwell famous curry")
--   * four words work, and a stall that answers only some of the words is left out
--   * a word nobody answers returns nothing
-- Runs in a transaction and rolls back; nothing it inserts survives.

begin;

update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0231-a000-0000000000c1', 'active', now() + interval '1 hour');

insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, min_price, quality_rating, quality_review_count,
  verification_status, listing_location
)
values
  ('00000000-0000-0231-a000-0000000000c1', 'sc-v1', 'sc-b1', 'Famous Laksa House', 'Maxwell Food Centre', 5.00, 4.2, 60, 'verified',
   st_setsrid(st_makepoint(103.8470, 1.2813), 4326)::geography),
  ('00000000-0000-0231-a000-0000000000c1', 'sc-v2', 'sc-b1', 'Maxwell Noodle Bar', 'Maxwell Food Centre', 4.00, 4.0, 30, 'verified',
   st_setsrid(st_makepoint(103.8471, 1.2813), 4326)::geography),
  ('00000000-0000-0231-a000-0000000000c1', 'sc-v3', 'sc-b2', 'Famous Satay Stall', 'Tampines Hub', 6.00, 3.9, 20, 'verified',
   st_setsrid(st_makepoint(103.9400, 1.3550), 4326)::geography);

insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, food_type, price,
  rating, review_count, verification_status, listing_location
)
values
  ('00000000-0000-0231-a000-0000000000c1', 'sc-curry', 'sc-v1', 'sc-b1', 'Curry Laksa', 'Famous Laksa House', 'Maxwell Food Centre', 'Laksa', 5.00, 4.2, 60, 'verified',
   st_setsrid(st_makepoint(103.8470, 1.2813), 4326)::geography),
  ('00000000-0000-0231-a000-0000000000c1', 'sc-prawn', 'sc-v2', 'sc-b1', 'Prawn Noodle', 'Maxwell Noodle Bar', 'Maxwell Food Centre', 'Noodles', 4.00, 4.0, 30, 'verified',
   st_setsrid(st_makepoint(103.8471, 1.2813), 4326)::geography),
  ('00000000-0000-0231-a000-0000000000c1', 'sc-satay', 'sc-v3', 'sc-b2', 'Chicken Satay', 'Famous Satay Stall', 'Tampines Hub', 'Satay', 6.00, 3.9, 20, 'verified',
   st_setsrid(st_makepoint(103.9400, 1.3550), 4326)::geography);

select set_config('request.jwt.claim.sub', '00000000-0000-0231-a000-000000000002', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_ids text;
begin
  -- Famous (stall name) + Maxwell (building) + curry (a dish): only the first stall answers all three.
  v_page := public.catalog_raw_venues_page(p_query => 'maxwell famous curry', p_sort => 'relevance', p_limit => 20);
  select string_agg(i->>'id', ',' order by o) into v_ids from jsonb_array_elements(v_page->'items') with ordinality t(i, o);
  if v_ids is distinct from 'sc-v1' then
    raise exception 'three words split across dish, name and building should find only sc-v1, got %', v_ids;
  end if;

  -- "famous" alone: the two stalls with Famous in the name.
  v_page := public.catalog_raw_venues_page(p_query => 'famous', p_sort => 'relevance', p_limit => 20);
  select string_agg(i->>'id', ',' order by i->>'id') into v_ids from jsonb_array_elements(v_page->'items') i;
  if v_ids is distinct from 'sc-v1,sc-v3' then
    raise exception 'famous should find both Famous stalls, got %', v_ids;
  end if;

  -- Four words, all answered by one stall (name, building, dish, dish).
  v_page := public.catalog_raw_venues_page(p_query => 'famous maxwell curry laksa', p_sort => 'relevance', p_limit => 20);
  select string_agg(i->>'id', ',' order by o) into v_ids from jsonb_array_elements(v_page->'items') with ordinality t(i, o);
  if v_ids is distinct from 'sc-v1' then
    raise exception 'four answered words should find sc-v1, got %', v_ids;
  end if;

  -- A stall that answers only some of the words is left out ("tampines" + "curry" never meet in one stall).
  v_page := public.catalog_raw_venues_page(p_query => 'tampines curry', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'tampines curry should find nothing, got %', v_page->'items';
  end if;

  -- A word nobody answers returns nothing.
  v_page := public.catalog_raw_venues_page(p_query => 'famous zzzqq', p_sort => 'relevance', p_limit => 20);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'an unanswered word should find nothing, got %', v_page->'items';
  end if;

  -- The browse (no text) list is untouched: all three stalls, the matching count is the capped total.
  v_page := public.catalog_raw_venues_page(p_sort => 'quality', p_limit => 20, p_release_id => '00000000-0000-0231-a000-0000000000c1');
  if jsonb_array_length(v_page->'items') <> 3 then
    raise exception 'browse should list all three stalls, got %', v_page->'items';
  end if;
end;
$$;

reset role;

select 'catalog_stall_search_candidates' as check_name, 'ok' as detail;

rollback;
