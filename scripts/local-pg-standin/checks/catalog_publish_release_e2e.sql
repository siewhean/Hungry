-- End-to-end check for catalog_raw_publish_release (latest body in
-- 20261021140000_catalog_raw_display_rights.sql): publish a release from a
-- small seed, then read it as a guest through catalog_raw_dishes_page,
-- catalog_raw_venues_page and catalog_suggest. Rolls back.

begin;

-- Start from an empty catalog so the counts are exact.
delete from catalog_raw_dish_media;
delete from catalog_raw_dish_cards;
delete from catalog_raw_venue_cards;
delete from catalog_releases;
delete from dish_images;
delete from dish_dietary_flags;
delete from reviews;
delete from dishes;
delete from venues;

insert into buildings (id, name, building_type, latitude, longitude)
values ('e2e-building', 'Zephyr Food Centre', 'hawker_centre', 1.30, 103.80)
on conflict (id) do nothing;

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude, image_url,
                    media_approved_for_display, media_rights_status)
values
  ('e2e-venue-a', 'e2e-building', 'Quokka Noodle House', '#01-01', 'L1', 1.30, 103.80,
   'https://example.com/e2e-venue-a.jpg', true, 'merchant_owned'),
  ('e2e-venue-b', 'e2e-building', 'Wombat Rice Stall', '#01-02', 'L1', 1.3001, 103.8001,
   'https://example.com/e2e-venue-b.jpg', false, 'unverified');

insert into dishes (id, venue_id, building_id, name, price, price_range, rating_avg, review_count, image_url,
                    food_type, menu_approved_for_display, menu_rights_status,
                    media_approved_for_display, media_rights_status)
values
  ('e2e-dish-a1', 'e2e-venue-a', 'e2e-building', 'Quokka Laksa', 6, 'S$6.00', 4.5, 10,
   'https://example.com/e2e-a1.jpg', 'Laksa', true, 'merchant_owned', true, 'merchant_owned'),
  ('e2e-dish-a2', 'e2e-venue-a', 'e2e-building', 'Quokka Scraped Mee', 7, 'S$7.00', 5.0, 50,
   'https://example.com/e2e-a2.jpg', 'Mee', false, 'unverified', false, 'unverified'),
  ('e2e-dish-b1', 'e2e-venue-b', 'e2e-building', 'Wombat Chicken Rice', 5, 'S$5.00', 4.0, 4,
   'https://example.com/e2e-b1.jpg', 'Chicken Rice', true, 'operator_owned', false, 'unverified');

do $$
declare
  v_release uuid;
  v_row public.catalog_releases;
begin
  v_release := public.catalog_raw_publish_release(2, 2);
  select * into v_row from public.catalog_releases where id = v_release;
  if v_row.status <> 'active' or v_row.venue_total <> 2 or v_row.dish_total <> 2 then
    raise exception 'publish: expected active release with 2 venues / 2 dishes, got %', row_to_json(v_row);
  end if;
  if (select food_type from public.catalog_raw_dish_cards where release_id = v_release and id = 'e2e-dish-a1') is distinct from 'Laksa' then
    raise exception 'publish: dish card food_type not filled';
  end if;
  if exists (select 1 from public.catalog_raw_dish_cards where release_id = v_release and id = 'e2e-dish-a2') then
    raise exception 'publish: non-displayable dish was published';
  end if;
  if (select image_url from public.catalog_raw_dish_cards where release_id = v_release and id = 'e2e-dish-b1') is not null then
    raise exception 'publish: unapproved dish photo was published';
  end if;
  if (select image_url from public.catalog_raw_venue_cards where release_id = v_release and id = 'e2e-venue-b') is not null then
    raise exception 'publish: unapproved venue photo was published';
  end if;
  if (select representative_dish ->> 'id' from public.catalog_raw_venue_cards where release_id = v_release and id = 'e2e-venue-a') <> 'e2e-dish-a1' then
    raise exception 'publish: venue card picked a non-displayable top dish';
  end if;
  -- Publishing again retires the first release.
  perform public.catalog_raw_publish_release();
  if (select count(*) from public.catalog_releases where status = 'active') <> 1 then
    raise exception 'publish: expected exactly one active release after republish';
  end if;
end $$;

-- Read as a guest.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_dishes jsonb;
  v_venues jsonb;
  v_suggest jsonb;
  v_search jsonb;
begin
  v_dishes := public.catalog_raw_dishes_page(p_limit => 24);
  v_venues := public.catalog_raw_venues_page(p_limit => 24);
  v_search := public.catalog_raw_dishes_page(p_query => 'laksa', p_limit => 24);
  raise notice 'dishes_page: %', v_dishes;
  raise notice 'venues_page: %', v_venues;
  if v_dishes::text not like '%e2e-dish-a1%' or v_dishes::text not like '%e2e-dish-b1%' then
    raise exception 'anon dishes_page missing published dishes: %', v_dishes;
  end if;
  if v_dishes::text like '%e2e-dish-a2%' then
    raise exception 'anon dishes_page leaked a non-displayable dish';
  end if;
  if v_venues::text not like '%e2e-venue-a%' or v_venues::text not like '%e2e-venue-b%' then
    raise exception 'anon venues_page missing published venues: %', v_venues;
  end if;
  if v_search::text not like '%e2e-dish-a1%' or v_search::text like '%e2e-dish-b1%' then
    raise exception 'anon dishes_page query=laksa wrong: %', v_search;
  end if;

  v_suggest := public.catalog_suggest('la');
  raise notice 'suggest(la): %', v_suggest;
  if not v_suggest @> '[{"kind": "food_type", "label": "Laksa"}]' then
    raise exception 'catalog_suggest(la) should offer the Laksa food type: %', v_suggest;
  end if;
  v_suggest := public.catalog_suggest('zeph');
  -- Places are buildings with 3+ stalls; this one has two.
  if v_suggest @> '[{"kind": "place"}]' then
    raise exception 'catalog_suggest(zeph) must not offer a two-stall building as a place: %', v_suggest;
  end if;
  v_suggest := public.catalog_suggest('wombat');
  if not v_suggest @> '[{"kind": "stall", "label": "Wombat Rice Stall"}]' then
    raise exception 'catalog_suggest(wombat) should offer the stall: %', v_suggest;
  end if;
  v_suggest := public.catalog_suggest('mee');
  if v_suggest @> '[{"label": "Mee"}]' then
    raise exception 'catalog_suggest leaked a non-displayable dish food type: %', v_suggest;
  end if;
  v_suggest := public.catalog_suggest(null);
  if jsonb_array_length(v_suggest) <> 2 then
    raise exception 'catalog_suggest empty state should list the 2 published food types: %', v_suggest;
  end if;
end $$;

do $$
begin
  perform public.catalog_raw_publish_release();
  raise exception 'anon must not publish a release';
exception when insufficient_privilege then null;
end $$;

rollback;
