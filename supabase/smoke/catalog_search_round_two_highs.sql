-- Smoke checks for the round-two search fixes:
--   20261021150000_catalog_search_distance_places_stall_dishes.sql (H20, H23)
--   20261021150100_catalog_raw_card_display_rights.sql (H26)
--   20261021150200_catalog_suggest.sql (H24)
-- Cards report the real distance, building names and a stall's dishes are searchable,
-- suggestions work, and no image that fails catalog_display_image_url leaves the cards.
-- Runs in a transaction and rolls back.

begin;

-- Anything already published must pass the display-rights check (backfill in the migration).
do $$
begin
  if exists (
    select 1 from public.catalog_raw_dish_cards c
    where c.image_url is not null
      and c.image_url is distinct from app_private.catalog_dish_display_image(c.id)
  ) then
    raise exception 'a published dish card carries an image that is not cleared for display';
  end if;
  if exists (
    select 1 from public.catalog_raw_venue_cards c
    left join public.venues v on v.id = c.id
    where c.image_url is not null
      and c.image_url is distinct from public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
  ) then
    raise exception 'a published venue card carries an image that is not cleared for display';
  end if;
end;
$$;

-- Swap in a throwaway active release for the duration of the transaction.
update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0215-a000-0000000000c1', 'active', now() + interval '1 hour');

-- Viewer at (1.2813, 103.8458). smk-r2-near is about 300 m away; the stall is in a building
-- whose name appears nowhere else; one dish is called "Smoke Prawn Mee". The card ids are not
-- real dishes, so the rights trigger must drop the scraped delivery-app image.
insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, image_url,
  distance_meters, verification_status, listing_location
)
values
  ('00000000-0000-0215-a000-0000000000c1', 'smk-r2-near', 'smk-r2-v1', 'smk-r2-b1', 'Smoke Prawn Mee',
   'Smoke Uncle Stall', 'Zyxwv Smoke Food Centre', 'https://images.deliveroo.com/smoke.jpg',
   0, 'raw', st_setsrid(st_makepoint(103.8485, 1.2813), 4326)::geography);

insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, image_url, representative_dish,
  verification_status, listing_location
)
values
  ('00000000-0000-0215-a000-0000000000c1', 'smk-r2-v1', 'smk-r2-b1', 'Smoke Uncle Stall',
   'Zyxwv Smoke Food Centre', 'https://images.grab.com/smoke.jpg',
   jsonb_build_object('id', 'smk-r2-near', 'name', 'Smoke Prawn Mee', 'image_url', 'https://images.grab.com/dish.jpg'),
   'raw', st_setsrid(st_makepoint(103.8485, 1.2813), 4326)::geography);

do $$
begin
  if (select image_url from public.catalog_raw_dish_cards where release_id = '00000000-0000-0215-a000-0000000000c1' and id = 'smk-r2-near') is not null then
    raise exception 'dish card kept an image without display rights';
  end if;
  if (select image_url from public.catalog_raw_venue_cards where release_id = '00000000-0000-0215-a000-0000000000c1' and id = 'smk-r2-v1') is not null then
    raise exception 'venue card kept an image without display rights';
  end if;
  if (select representative_dish ->> 'image_url' from public.catalog_raw_venue_cards where release_id = '00000000-0000-0215-a000-0000000000c1' and id = 'smk-r2-v1') is not null then
    raise exception 'representative dish kept an image without display rights';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0215-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_distance integer;
  v_items jsonb;
begin
  -- H20: the dish card reports ~300 m, not the stored 0.
  v_page := public.catalog_raw_dishes_page(
    p_query => 'Smoke Prawn Mee', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 10
  );
  v_distance := (v_page->'items'->0->>'distance_meters')::integer;
  if v_page->'items'->0->>'id' <> 'smk-r2-near' or v_distance not between 250 and 350 then
    raise exception 'dish card should report about 300 m, got %', v_page->'items'->0;
  end if;

  -- H20: venue cards now carry a distance too.
  v_page := public.catalog_raw_venues_page(
    p_query => 'Smoke Uncle', p_lat => 1.2813, p_lng => 103.8458, p_sort => 'relevance', p_limit => 10
  );
  v_distance := (v_page->'items'->0->>'distance_meters')::integer;
  if v_page->'items'->0->>'id' <> 'smk-r2-v1' or v_distance not between 250 and 350 then
    raise exception 'venue card should report about 300 m, got %', v_page->'items'->0;
  end if;

  -- H20: no coordinate means no distance, never the stored column.
  v_page := public.catalog_raw_dishes_page(p_query => 'Smoke Prawn Mee', p_sort => 'relevance', p_limit => 10);
  if v_page->'items'->0 ? 'distance_meters' and v_page->'items'->0->'distance_meters' <> 'null'::jsonb then
    raise exception 'without a coordinate distance_meters should be null, got %', v_page->'items'->0;
  end if;

  -- H23: the building name finds the dish and the stall.
  v_page := public.catalog_raw_dishes_page(p_query => 'Zyxwv', p_sort => 'relevance', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 1 then
    raise exception 'dish search should match the building name, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_venues_page(p_query => 'Zyxwv', p_sort => 'relevance', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 1 then
    raise exception 'stall search should match the building name, got %', v_page->'items';
  end if;

  -- H23: stall search finds a stall by one of its dishes.
  v_page := public.catalog_raw_venues_page(p_query => 'Prawn Mee', p_sort => 'relevance', p_limit => 10);
  if not exists (select 1 from jsonb_array_elements(v_page->'items') item where item->>'id' = 'smk-r2-v1') then
    raise exception 'stall search should match the stall''s dishes, got %', v_page->'items';
  end if;

  -- H24: suggestions by word start, typed text taken literally, popular food types when short.
  v_items := public.catalog_suggest('Smoke Fo');
  if not v_items @> '[{"kind": "place", "label": "Zyxwv Smoke Food Centre"}]'::jsonb then
    raise exception 'suggest should match a word start in the place name, got %', v_items;
  end if;
  v_items := public.catalog_suggest('Zy');
  if v_items->0 <> '{"kind": "place", "label": "Zyxwv Smoke Food Centre"}'::jsonb then
    raise exception 'suggest should return the place first, got %', v_items;
  end if;
  if jsonb_array_length(public.catalog_suggest('%%')) <> 0 then
    raise exception 'suggest must treat %% literally';
  end if;
  if jsonb_array_length(public.catalog_suggest(repeat('a', 500))) > 8 then
    raise exception 'suggest must cap results at 8';
  end if;
  v_items := public.catalog_suggest(null);
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'empty suggest should return an array of food types, got %', v_items;
  end if;
end;
$$;

reset role;

do $$
begin
  if not has_function_privilege('anon', 'public.catalog_suggest(text,integer)', 'execute') then
    raise exception 'guests must be able to call catalog_suggest';
  end if;
  if not has_function_privilege('anon', 'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])', 'execute') then
    raise exception 'anon must execute catalog_raw_dishes_page';
  end if;
  if not has_function_privilege('anon', 'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[])', 'execute') then
    raise exception 'anon must execute catalog_raw_venues_page';
  end if;
  if has_function_privilege('anon', 'app_private.catalog_dish_display_image(text)', 'execute') then
    raise exception 'catalog_dish_display_image must stay private';
  end if;
  if (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
    'catalog_raw_dish_cards_building_name_trgm_idx', 'catalog_raw_venue_cards_building_name_trgm_idx'
  )) <> 2 then
    raise exception 'building name trigram indexes missing';
  end if;
end;
$$;

select 'catalog_search_round_two_highs' as check_name, 'ok' as detail;

rollback;
