-- Smoke checks for 20261029120000_catalog_venue_card_logo_main_price.sql (round-four Search audit SR4-3, SR4-4, SR4-8, SR4-9, SR4-10):
--   * venue cards get the stall's logo and a main price (median of non-drink, non-side items)
--   * "Under S$6" leaves out a stall whose only cheap item is a drink
--   * stall results carry matched_dish, the stall's best dish for the query
--   * a unique stall name in suggestions carries the venue id and building; a chain's name does not
-- Runs in a transaction and rolls back; nothing it inserts survives.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('lm-b1', 'Smoke LM Food Centre', 'hawker_centre', 1.2813, 103.8458);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude, logo_url)
values
  ('lm-v1', 'lm-b1', 'Smoke LM Laksa Stall', '#01-01', 'L1', 1.2813, 103.8458, 'https://example.com/lm-logo.png'),
  ('lm-v2', 'lm-b1', 'Smoke LM Coffee and Rice', '#01-02', 'L1', 1.2813, 103.8459, null),
  ('lm-v3', 'lm-b1', 'Smoke LM Chain Bakery', '#01-03', 'L1', 1.2813, 103.8460, null),
  ('lm-v4', 'lm-b1', 'Smoke LM Chain Bakery', '#01-04', 'L1', 1.2813, 103.8461, null);

-- Displayable menu items (approved, merchant owned). The stalls' mains and drinks:
--   lm-v1: Signature Laksa 6.00, Small Laksa 4.00 (Main), Barley 1.00 (Drink)  -> main price 5.00
--   lm-v2: Iced Coffee 1.50 (Drink), Chicken Rice 9.00 (Main)                  -> main price 9.00
insert into dishes (
  id, venue_id, building_id, name, price, price_range, rating_avg, review_count, course,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
) values
  ('lm-d1', 'lm-v1', 'lm-b1', 'Signature Laksa', 6.00, 'S$6.00', 4.5, 10, 'Main', true, 'merchant_owned', false, 'unverified'),
  ('lm-d2', 'lm-v1', 'lm-b1', 'Small Laksa', 4.00, 'S$4.00', 3.0, 5, 'Main', true, 'merchant_owned', false, 'unverified'),
  ('lm-d3', 'lm-v1', 'lm-b1', 'Barley', 1.00, 'S$1.00', 4.0, 5, 'Drink', true, 'merchant_owned', false, 'unverified'),
  ('lm-d4', 'lm-v2', 'lm-b1', 'Iced Coffee', 1.50, 'S$1.50', 4.0, 5, 'Drink', true, 'merchant_owned', false, 'unverified'),
  ('lm-d5', 'lm-v2', 'lm-b1', 'Chicken Rice', 9.00, 'S$9.00', 4.0, 5, 'Main', true, 'merchant_owned', false, 'unverified');

-- Swap in a throwaway active release for the duration of the transaction.
update public.catalog_releases set status = 'retired', expires_at = now() + interval '1 hour'
where status = 'active';

insert into public.catalog_releases (id, status, activated_at)
values ('00000000-0000-0229-a000-0000000000d1', 'active', now() + interval '1 hour');

insert into public.catalog_raw_venue_cards (
  release_id, id, building_id, name, building_name, min_price, quality_rating, quality_review_count,
  verification_status, listing_location
)
values
  ('00000000-0000-0229-a000-0000000000d1', 'lm-v1', 'lm-b1', 'Smoke LM Laksa Stall', 'Smoke LM Food Centre', 1.00, 4.5, 10, 'verified',
   st_setsrid(st_makepoint(103.8458, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000d1', 'lm-v2', 'lm-b1', 'Smoke LM Coffee and Rice', 'Smoke LM Food Centre', 1.50, 4.0, 5, 'verified',
   st_setsrid(st_makepoint(103.8459, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000d1', 'lm-v3', 'lm-b1', 'Smoke LM Chain Bakery', 'Smoke LM Food Centre', null, 0, 0, 'verified',
   st_setsrid(st_makepoint(103.8460, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000d1', 'lm-v4', 'lm-b1', 'Smoke LM Chain Bakery', 'Smoke LM Food Centre', null, 0, 0, 'verified',
   st_setsrid(st_makepoint(103.8461, 1.2813), 4326)::geography);

insert into public.catalog_raw_dish_cards (
  release_id, id, venue_id, building_id, name, venue_name, building_name, food_type, price,
  rating, review_count, verification_status, listing_location
)
values
  ('00000000-0000-0229-a000-0000000000d1', 'lm-d1', 'lm-v1', 'lm-b1', 'Signature Laksa', 'Smoke LM Laksa Stall', 'Smoke LM Food Centre', 'Laksa', 6.00, 4.5, 10, 'verified',
   st_setsrid(st_makepoint(103.8458, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000d1', 'lm-d2', 'lm-v1', 'lm-b1', 'Small Laksa', 'Smoke LM Laksa Stall', 'Smoke LM Food Centre', 'Laksa', 4.00, 3.0, 5, 'verified',
   st_setsrid(st_makepoint(103.8458, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000d1', 'lm-d4', 'lm-v2', 'lm-b1', 'Iced Coffee', 'Smoke LM Coffee and Rice', 'Smoke LM Food Centre', 'Coffee', 1.50, 4.0, 5, 'verified',
   st_setsrid(st_makepoint(103.8459, 1.2813), 4326)::geography),
  ('00000000-0000-0229-a000-0000000000d1', 'lm-d5', 'lm-v2', 'lm-b1', 'Chicken Rice', 'Smoke LM Coffee and Rice', 'Smoke LM Food Centre', 'Chicken Rice', 9.00, 4.0, 5, 'verified',
   st_setsrid(st_makepoint(103.8459, 1.2813), 4326)::geography);

select set_config('request.jwt.claim.sub', '00000000-0000-0229-a000-000000000002', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
  v_item jsonb;
  v_sug jsonb;
  v_stall jsonb;
  v_chain integer;
begin
  -- The trigger filled the new columns when the cards were inserted.
  v_page := public.catalog_raw_venues_page(p_query => 'smoke lm', p_limit => 50);
  select i into v_item from jsonb_array_elements(v_page->'items') i where i->>'id' = 'lm-v1';
  if v_item->>'logo_url' is distinct from 'https://example.com/lm-logo.png' then
    raise exception 'logo_url should be the venue logo, got %', v_item;
  end if;
  if (v_item->>'main_price')::numeric is distinct from 5.00 then
    raise exception 'lm-v1 main price should be the median of its mains (5.00), got %', v_item;
  end if;
  select i into v_item from jsonb_array_elements(v_page->'items') i where i->>'id' = 'lm-v2';
  if (v_item->>'main_price')::numeric is distinct from 9.00 or v_item->>'logo_url' is not null then
    raise exception 'lm-v2 should have main price 9.00 (the drink does not count) and no logo, got %', v_item;
  end if;
  select i into v_item from jsonb_array_elements(v_page->'items') i where i->>'id' = 'lm-v3';
  if v_item->>'main_price' is not null then
    raise exception 'a stall with no menu rows has no main price, got %', v_item;
  end if;

  -- Under S$6: lm-v1 (mains 5.00) stays, lm-v2 (only cheap item is a drink) goes.
  v_page := public.catalog_raw_venues_page(p_query => 'smoke lm', p_max_price => 6, p_limit => 50);
  if not exists (select 1 from jsonb_array_elements(v_page->'items') i where i->>'id' = 'lm-v1') then
    raise exception 'Under S$6 should keep the laksa stall, got %', v_page;
  end if;
  if exists (select 1 from jsonb_array_elements(v_page->'items') i where i->>'id' = 'lm-v2') then
    raise exception 'Under S$6 should leave out the stall whose only cheap item is a drink, got %', v_page;
  end if;

  -- Sort by price uses the main price: the laksa stall (5.00) comes before coffee and rice (9.00).
  v_page := public.catalog_raw_venues_page(p_query => 'smoke lm', p_sort => 'price', p_limit => 50);
  if (select array_agg(i->>'id' order by o) from jsonb_array_elements(v_page->'items') with ordinality t(i, o)
      where i->>'id' in ('lm-v1', 'lm-v2')) <> array['lm-v1', 'lm-v2'] then
    raise exception 'price sort should follow the main price, got %', v_page;
  end if;

  -- matched_dish: the best dish for the query, by name match then rating.
  v_page := public.catalog_raw_venues_page(p_query => 'laksa', p_limit => 50);
  select i into v_item from jsonb_array_elements(v_page->'items') i where i->>'id' = 'lm-v1';
  if v_item->'matched_dish'->>'name' is distinct from 'Signature Laksa'
     or (v_item->'matched_dish'->>'price')::numeric is distinct from 6.00 then
    raise exception 'matched_dish should be Signature Laksa at 6.00, got %', v_item;
  end if;
  -- No query, no matched dish.
  v_page := public.catalog_raw_venues_page(p_limit => 50);
  select i into v_item from jsonb_array_elements(v_page->'items') i where i->>'id' = 'lm-v1';
  if v_item->'matched_dish' is distinct from 'null'::jsonb then
    raise exception 'a browse with no query should carry no matched dish, got %', v_item;
  end if;

  -- Suggestions: a unique stall name carries the venue id and building; a chain's name carries neither.
  v_sug := public.catalog_suggest('smoke lm', 8);
  select s into v_stall from jsonb_array_elements(v_sug) s where s->>'label' = 'Smoke LM Laksa Stall';
  if v_stall->>'kind' is distinct from 'stall' or v_stall->>'id' is distinct from 'lm-v1'
     or v_stall->>'subtitle' is distinct from 'Smoke LM Food Centre' then
    raise exception 'a unique stall suggestion should carry its venue id and building, got %', v_sug;
  end if;
  select count(*) into v_chain from jsonb_array_elements(v_sug) s
  where s->>'label' = 'Smoke LM Chain Bakery' and (s ? 'id' or s ? 'subtitle');
  if v_chain <> 0 then
    raise exception 'a chain name should not point at one outlet, got %', v_sug;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_sug) s where s->>'label' = 'Smoke LM Chain Bakery') then
    raise exception 'the chain should still be suggested by name, got %', v_sug;
  end if;
end;
$$;

select 'catalog_venue_card_logo_main_price' as check_name, 'ok' as detail;

rollback;
