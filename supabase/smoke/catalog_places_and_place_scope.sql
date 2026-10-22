-- Smoke checks for 20261021190000_catalog_places_and_place_scoped_reads.sql.
-- Places are buildings with 3+ stalls; place search finds them by name or position;
-- p_building_id keeps stall and dish pages inside that one building; suggestions carry the
-- building id. Runs in a transaction and rolls back.

begin;

update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0219-a000-0000000000c1', 'active', now() + interval '1 hour');

-- Mall (3 stalls) at 1.3000, 103.8000; court (3 stalls) about 1.1 km north; a one-stall building
-- with the same name prefix. Every stall in the mall and court sells one dish.
insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, building_type, latitude, longitude,
  verification_status, listing_location
)
select '00000000-0000-0219-a000-0000000000c1', v.id, v.building_id, v.name, v.building_name, v.building_type,
  v.lat, v.lng, 'raw', st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography
from (values
  ('smk-pl-v1', 'smk-pl-mall', 'Plzzy Stall One', 'Plzzy Smoke Mall', 'other', 1.3000, 103.8000),
  ('smk-pl-v2', 'smk-pl-mall', 'Plzzy Stall Two', 'Plzzy Smoke Mall', 'other', 1.3000, 103.8000),
  ('smk-pl-v3', 'smk-pl-mall', 'Plzzy Stall Three', 'Plzzy Smoke Mall', 'other', 1.3000, 103.8000),
  ('smk-pl-v4', 'smk-pl-court', 'Plzzy Court Stall A', 'Plzzy Smoke Court', 'food_court', 1.3100, 103.8000),
  ('smk-pl-v5', 'smk-pl-court', 'Plzzy Court Stall B', 'Plzzy Smoke Court', 'food_court', 1.3100, 103.8000),
  ('smk-pl-v6', 'smk-pl-court', 'Plzzy Court Stall C', 'Plzzy Smoke Court', 'food_court', 1.3100, 103.8000),
  ('smk-pl-v7', 'smk-pl-solo', 'Plzzy Lonely Stall', 'Plzzy Lonely Shophouse', 'other', 1.3200, 103.8000)
) as v(id, building_id, name, building_name, building_type, lat, lng);

insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, building_type,
  distance_meters, verification_status, listing_location
)
select '00000000-0000-0219-a000-0000000000c1', 'smk-pl-d' || right(c.id, 1), c.id, c.building_id,
  'Plzzy Noodles ' || right(c.id, 1), c.name, c.building_name, c.building_type,
  0, 'raw', c.listing_location
from public.catalog_raw_venue_cards c
where c.release_id = '00000000-0000-0219-a000-0000000000c1';

select set_config('request.jwt.claim.sub', '00000000-0000-0219-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_places jsonb;
  v_page jsonb;
  v_next jsonb;
  v_items jsonb;
begin
  -- By name: both multi-stall buildings, the one-stall building is not a place.
  v_places := public.catalog_raw_places('Plzzy');
  if jsonb_array_length(v_places) <> 2 then
    raise exception 'two places expected, got %', v_places;
  end if;
  if not v_places @> '[{"id": "smk-pl-mall", "name": "Plzzy Smoke Mall", "venue_count": 3}]'::jsonb then
    raise exception 'the mall should be a place with 3 stalls even typed "other", got %', v_places;
  end if;

  -- With the viewer position the nearer place leads and carries a distance.
  v_places := public.catalog_raw_places('Plzzy', 1.3001, 103.8000);
  if v_places->0->>'id' <> 'smk-pl-mall' or (v_places->0->>'distance_meters')::integer > 50 then
    raise exception 'the mall should lead and be within 50 m, got %', v_places;
  end if;
  if (v_places->1->>'distance_meters')::integer not between 900 and 1200 then
    raise exception 'the court should be about 1.1 km away, got %', v_places;
  end if;

  -- By position: standing in the mall finds only the mall.
  v_places := public.catalog_raw_places(null, 1.3001, 103.8000, 100, 1);
  if jsonb_array_length(v_places) <> 1 or v_places->0->>'id' <> 'smk-pl-mall' then
    raise exception 'position inside the mall should return only the mall, got %', v_places;
  end if;
  -- The count still covers the whole building when only one stall is inside the radius.
  if (v_places->0->>'venue_count')::integer <> 3 then
    raise exception 'venue_count should count every stall in the building, got %', v_places;
  end if;
  v_places := public.catalog_raw_places(null, 1.3050, 103.8000, 100, 1);
  if jsonb_array_length(v_places) <> 0 then
    raise exception 'open ground between the buildings should return no place, got %', v_places;
  end if;

  -- Typed text is literal.
  if jsonb_array_length(public.catalog_raw_places('%%%')) <> 0 then
    raise exception 'place search must treat %% literally';
  end if;

  -- Stalls scoped to the mall: exactly its three, paged with a cursor that keeps the scope.
  v_page := public.catalog_raw_venues_page(p_building_id => 'smk-pl-mall', p_limit => 2);
  if jsonb_array_length(v_page->'items') <> 2 or v_page->>'next_cursor' is null then
    raise exception 'first page of the mall should hold 2 stalls and a cursor, got %', v_page;
  end if;
  v_next := public.catalog_raw_venues_page(p_building_id => 'smk-pl-mall', p_limit => 2, p_cursor => v_page->>'next_cursor', p_release_id => (v_page->>'release_id')::uuid);
  if jsonb_array_length(v_next->'items') <> 1 or v_next->>'next_cursor' is not null then
    raise exception 'second page of the mall should hold the last stall, got %', v_next;
  end if;
  select jsonb_agg(item->>'building_id') into v_items
  from jsonb_array_elements((v_page->'items') || (v_next->'items')) item;
  if exists (select 1 from jsonb_array_elements_text(v_items) b where b <> 'smk-pl-mall') then
    raise exception 'a place-scoped stall page leaked another building, got %', v_items;
  end if;

  -- A cursor made for the whole catalog is refused inside a place.
  begin
    perform public.catalog_raw_venues_page(p_limit => 2, p_cursor => (public.catalog_raw_venues_page(p_limit => 2)->>'next_cursor'), p_building_id => 'smk-pl-mall');
    raise exception 'a cursor from another scope should be refused';
  exception when sqlstate '22023' then
    null;
  end;

  -- Query inside a place: the name matches the building, so every stall passes.
  v_page := public.catalog_raw_venues_page(p_building_id => 'smk-pl-court', p_query => 'Plzzy', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 3 then
    raise exception 'the court should hold 3 stalls, got %', v_page->'items';
  end if;

  -- Dishes scoped to a place.
  v_page := public.catalog_raw_dishes_page(p_building_id => 'smk-pl-court', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 3
    or exists (select 1 from jsonb_array_elements(v_page->'items') item where item->>'building_id' <> 'smk-pl-court') then
    raise exception 'place-scoped dishes should be the court''s three only, got %', v_page->'items';
  end if;
  v_page := public.catalog_raw_dishes_page(p_building_id => 'smk-pl-none', p_limit => 10);
  if jsonb_array_length(v_page->'items') <> 0 then
    raise exception 'an unknown building should have no dishes';
  end if;

  -- Suggestions: places carry their building id; the one-stall building is not a place.
  v_items := public.catalog_suggest('Plzzy Smoke');
  if not v_items @> '[{"kind": "place", "label": "Plzzy Smoke Mall", "id": "smk-pl-mall"}]'::jsonb then
    raise exception 'place suggestion should carry the building id, got %', v_items;
  end if;
  if public.catalog_suggest('Plzzy Lonely') @> '[{"kind": "place"}]'::jsonb then
    raise exception 'a one-stall building must not be suggested as a place';
  end if;
end;
$$;

reset role;

do $$
begin
  if not has_function_privilege('anon', 'public.catalog_raw_places(text,double precision,double precision,integer,integer,uuid)', 'execute') then
    raise exception 'guests must be able to call catalog_raw_places';
  end if;
  if to_regprocedure('public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])') is not null
    or to_regprocedure('public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[])') is not null
    or to_regprocedure('public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer)') is not null then
    raise exception 'the pre-place signatures must be dropped so PostgREST has one candidate';
  end if;
end;
$$;

rollback;

select 'catalog_places_and_place_scope' as check_name, 'ok' as detail;
