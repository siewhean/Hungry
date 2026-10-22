-- Smoke checks for 20261020051000_catalog_search_dietary_all_distance_relevance.sql.
-- Dietary filters require every flag, an equally good text match closer to the viewer
-- ranks first, and the new trigram indexes exist. Runs in a transaction and rolls back.

begin;

-- Swap in a throwaway active release for the duration of the transaction.
update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0051-a000-0000000000c1', 'active', now() + interval '1 hour');

insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, dietary_flags, verification_status, listing_location
)
values
  -- Same name, one about 300 m from the viewer and one about 15 km away.
  ('00000000-0000-0051-a000-0000000000c1', 'smk-near', 'smk-v1', 'smk-b1', 'Smoke Laksa', 'Near Stall',
   '{halal,vegetarian}', 'unverified', st_setsrid(st_makepoint(103.8480, 1.2830), 4326)::geography),
  ('00000000-0000-0051-a000-0000000000c1', 'smk-far', 'smk-v2', 'smk-b2', 'Smoke Laksa', 'Far Stall',
   '{halal}', 'unverified', st_setsrid(st_makepoint(103.9800, 1.3500), 4326)::geography);

select set_config('request.jwt.claim.sub', '00000000-0000-0051-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
begin
  -- halal + vegetarian: only the dish carrying both flags.
  v_page := public.catalog_raw_dishes_page(
    p_dietary_flags => array['halal', 'vegetarian'], p_venue_id => null, p_limit => 10
  );
  if jsonb_array_length(v_page->'items') <> 1 or v_page->'items'->0->>'id' <> 'smk-near' then
    raise exception 'dietary filter should require all flags, got %', v_page->'items';
  end if;

  -- Same text match: the nearer dish ranks first.
  v_page := public.catalog_raw_dishes_page(
    p_query => 'Smoke Laksa', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 10
  );
  if v_page->'items'->0->>'id' <> 'smk-near' or v_page->'items'->1->>'id' <> 'smk-far' then
    raise exception 'relevance should prefer the nearer match, got %', v_page->'items';
  end if;

  -- Paging with the relevance cursor still returns the second row exactly once.
  v_page := public.catalog_raw_dishes_page(
    p_query => 'Smoke Laksa', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 1
  );
  v_page := public.catalog_raw_dishes_page(
    p_query => 'Smoke Laksa', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 1,
    p_cursor => v_page->>'next_cursor'
  );
  if jsonb_array_length(v_page->'items') <> 1 or v_page->'items'->0->>'id' <> 'smk-far' then
    raise exception 'relevance cursor should continue with the far dish, got %', v_page->'items';
  end if;
end;
$$;

reset role;

do $$
begin
  if (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
    'catalog_raw_dish_cards_venue_name_trgm_idx', 'catalog_raw_dish_cards_food_type_trgm_idx'
  )) <> 2 then
    raise exception 'catalog search trigram indexes missing';
  end if;
  -- Guests browse and search the catalog (PR #83); re-creating the RPCs keeps their anon grant.
  if not has_function_privilege('anon', 'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[],text[],text)', 'execute') then
    raise exception 'anon must execute catalog_raw_dishes_page';
  end if;
  if not has_function_privilege('anon', 'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[],text[],text)', 'execute') then
    raise exception 'anon must execute catalog_raw_venues_page';
  end if;
end;
$$;

select 'catalog_search_dietary_distance' as check_name, 'ok' as detail;

rollback;
