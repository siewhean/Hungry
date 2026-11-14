-- Smoke checks for 20261114110000_rank_menuless_stalls_lower.sql.
-- 1. Home's feed: a stall with a dish (no photo) ranks above a stall with no dishes whose mall has
--    a photo, and the stall with no dishes is still returned (ranked down, not hidden).
-- 2. Search's relevance sort: no stall with a menu comes after a stall without one.
-- Runs in a transaction and rolls back. Brings its own buildings, so it runs on prod too.

begin;

insert into buildings (
  id, slug, name, building_type, latitude, longitude, floors,
  image_url, media_approved_for_display, media_rights_status
)
values
  ('smoke-rm-photo', 'smoke-rm-photo', 'Smoke RM Photo Mall', 'mall', 1.5301, 103.8301, array['01'],
   'https://example.com/smoke-rm-mall.jpg', true, 'operator_owned'),
  ('smoke-rm-plain', 'smoke-rm-plain', 'Smoke RM Plain Mall', 'mall', 1.5302, 103.8301, array['01'],
   null, false, null);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values
  ('smoke-rm-nomenu', 'smoke-rm-photo', 'Smoke RM No Menu Stall', '#01-01', '01', 1.5301, 103.8301),
  ('smoke-rm-menu', 'smoke-rm-plain', 'Smoke RM Menu Stall', '#01-01', '01', 1.5302, 103.8301);

insert into dishes (
  id, venue_id, building_id, name, price,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-rm-dish', 'smoke-rm-menu', 'smoke-rm-plain', 'Smoke RM Noodles', 5, true, 'merchant_owned', false, null);

do $$
declare
  v_menu_pos integer;
  v_nomenu_pos integer;
  v_items jsonb;
  v_seen_menuless boolean := false;
  v_item jsonb;
begin
  -- 1. Feed order.
  select min(pos) filter (where venue_id = 'smoke-rm-menu'),
         min(pos) filter (where venue_id = 'smoke-rm-nomenu')
    into v_menu_pos, v_nomenu_pos
  from (
    select feed.venue_id, row_number() over () as pos
    from public.get_discovery_feed_by_location(null, 1.5301, 103.8301, 3000, 100) feed
  ) ranked;
  if v_menu_pos is null then
    raise exception 'the stall with a dish should be in the feed';
  end if;
  if v_nomenu_pos is null then
    raise exception 'the stall with no dishes should still be in the feed (ranked down, not hidden)';
  end if;
  if v_menu_pos > v_nomenu_pos then
    raise exception 'the stall with a dish (at %) should rank above the stall with none (at %)',
      v_menu_pos, v_nomenu_pos;
  end if;

  -- 2. Search relevance order over the live catalogue (empty when there is no active release).
  v_items := coalesce(
    public.catalog_raw_venues_page(p_sort => 'relevance', p_limit => 50)->'items',
    '[]'::jsonb
  );
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce((v_item->>'menu_count')::integer, 0) > 0 then
      if v_seen_menuless then
        raise exception 'search relevance: stall % with a menu comes after a stall without one',
          v_item->>'id';
      end if;
    else
      v_seen_menuless := true;
    end if;
  end loop;
end;
$$;

rollback;
