-- Smoke checks for 20261020130100_merchant_unverified_menu_drafts.sql.
-- Diners (anon and other signed-in users) never see a dish or photo an
-- unverified merchant saves: not through dishes/dish_images RLS and not
-- through the raw catalog cards and guest catalog RPCs. The unverified
-- merchant can create, edit and delete its own drafts, but cannot change a
-- dish diners already see. Verifying the outlet publishes the drafts.
-- Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0131-b000-000000000001
--   diner:    00000000-0000-0131-b000-000000000002
--   account:  00000000-0000-0131-a000-000000000001
--   outlet:   00000000-0000-0131-d000-000000000001
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-d27-building', 'Smoke D27 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values ('smoke-d27-venue', 'smoke-d27-building', 'Smoke D27 Stall', '#01-01', 'L1', 1.301, 103.801);

-- An imported dish diners can already see.
insert into dishes (
  id, venue_id, building_id, name, price, price_range, rating_avg, review_count,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values (
  'smoke-d27-live-dish', 'smoke-d27-venue', 'smoke-d27-building', 'Live Laksa', 5, 'S$5.00', 4.5, 10,
  true, 'licensed', true, 'licensed'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0131-b000-000000000001', 'd27-owner@example.test'),
  ('00000000-0000-0131-b000-000000000002', 'd27-diner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0131-a000-000000000001',
  '00000000-0000-0131-b000-000000000001',
  'Smoke D27 Merchant',
  'd27-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values (
  '00000000-0000-0131-d000-000000000001', '00000000-0000-0131-a000-000000000001',
  'smoke-d27-venue', 'smoke-d27-building', 'Smoke D27 Stall', 'hawker_stall', true
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status)
values ('00000000-0000-0131-d000-000000000001', 'submitted');

-- Reuse the live database's active release; only one may be active.
insert into catalog_releases (id, status, activated_at)
select '00000000-0000-0131-c000-000000000001', 'active', now()
where not exists (select 1 from catalog_releases where status = 'active');
select set_config('smoke.release', (select id::text from catalog_releases where status = 'active' limit 1), true);
select public.catalog_raw_refresh_venue('smoke-d27-venue');

-- 1. Unverified owner saves a draft with a photo.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0131-b000-000000000001', true);
set local role authenticated;

select public.merchant_save_dish(
  'merchant-dish-smoke-d27-draft',
  'smoke-d27-venue',
  'smoke-d27-building',
  jsonb_build_object('name', 'Draft Mee Siam', 'price', 3.5, 'image_url', 'https://example.test/draft.jpg'),
  array['https://example.test/draft.jpg'],
  array[]::text[],
  null
);

-- The client cannot clear the draft flag itself.
update dishes set merchant_draft = false, name = 'Draft Mee Siam v2'
where id = 'merchant-dish-smoke-d27-draft';

-- Deferred catalog triggers fire here instead of at commit.
set constraints all immediate;
set constraints all deferred;

do $$
begin
  if not (select merchant_draft from dishes where id = 'merchant-dish-smoke-d27-draft') then
    raise exception 'unverified merchant dish is not marked as a draft';
  end if;
  if (select name from dishes where id = 'merchant-dish-smoke-d27-draft') <> 'Draft Mee Siam v2' then
    raise exception 'owner could not edit its own draft';
  end if;

  -- Dishes diners already see stay read-only until verification.
  begin
    update dishes set name = 'Hijacked' where id = 'smoke-d27-live-dish';
    raise exception 'unverified merchant renamed a live dish';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.merchant_set_dish_availability_flag('smoke-d27-live-dish', 'smoke-d27-venue', 'sold_out', true);
    raise exception 'unverified merchant marked a live dish sold out';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into dish_images (dish_id, url, sort_order) values ('smoke-d27-live-dish', 'https://example.test/x.jpg', 9);
    raise exception 'unverified merchant added a photo to a live dish';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from dishes where id = 'smoke-d27-live-dish';
    raise exception 'unverified merchant deleted a live dish';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 2. Diners see nothing of the draft.
select set_config('request.jwt.claim.sub', '00000000-0000-0131-b000-000000000002', true);
do $$
begin
  if exists (select 1 from dishes where id = 'merchant-dish-smoke-d27-draft')
     or exists (select 1 from dish_images where dish_id = 'merchant-dish-smoke-d27-draft') then
    raise exception 'another signed-in user can read the draft dish or photo';
  end if;
  perform public.catalog_raw_dish_detail('smoke-d27-live-dish', null);
  begin
    perform public.catalog_raw_dish_detail('merchant-dish-smoke-d27-draft', null);
    raise exception 'catalog dish detail returns the draft';
  exception when no_data_found then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  if exists (select 1 from dishes where id = 'merchant-dish-smoke-d27-draft')
     or exists (select 1 from dish_images where dish_id = 'merchant-dish-smoke-d27-draft') then
    raise exception 'anon can read the draft dish or photo';
  end if;
  perform public.catalog_raw_dish_detail('smoke-d27-live-dish', null);
  begin
    perform public.catalog_raw_dish_detail('merchant-dish-smoke-d27-draft', null);
    raise exception 'guest catalog dish detail returns the draft';
  exception when no_data_found then null;
  end;
end $$;
reset role;

do $$
declare
  v_release uuid := current_setting('smoke.release')::uuid;
begin
  if exists (select 1 from catalog_raw_dish_cards where release_id = v_release and id = 'merchant-dish-smoke-d27-draft')
     or exists (select 1 from catalog_raw_dish_media where release_id = v_release and dish_id = 'merchant-dish-smoke-d27-draft') then
    raise exception 'draft dish reached the raw catalog';
  end if;
  if not exists (select 1 from catalog_raw_dish_cards where release_id = v_release and id = 'smoke-d27-live-dish') then
    raise exception 'live dish dropped out of the raw catalog';
  end if;
  if (select menu_count from catalog_raw_venue_cards where release_id = v_release and id = 'smoke-d27-venue') <> 1
     or (select representative_dish ->> 'id' from catalog_raw_venue_cards where release_id = v_release and id = 'smoke-d27-venue')
       <> 'smoke-d27-live-dish' then
    raise exception 'venue card counts or shows the draft';
  end if;
end $$;

-- 3. The owner can delete a draft.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0131-b000-000000000001', true);
set local role authenticated;
select public.merchant_save_dish(
  'merchant-dish-smoke-d27-throwaway', 'smoke-d27-venue', 'smoke-d27-building',
  jsonb_build_object('name', 'Throwaway', 'price', 1), null, null, null
);
delete from dishes where id = 'merchant-dish-smoke-d27-throwaway';
do $$
begin
  if exists (select 1 from dishes where id = 'merchant-dish-smoke-d27-throwaway') then
    raise exception 'owner could not delete its own draft';
  end if;
end $$;
reset role;

-- 4. Ops verify the outlet: drafts go live.
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
update merchant_verifications
set status = 'verified', verified_at = now()
where outlet_id = '00000000-0000-0131-d000-000000000001';

do $$
declare
  d public.dishes;
  v_release uuid := current_setting('smoke.release')::uuid;
begin
  select * into d from dishes where id = 'merchant-dish-smoke-d27-draft';
  if d.merchant_draft or not d.menu_approved_for_display or d.menu_rights_status <> 'merchant_owned'
     or not d.media_approved_for_display then
    raise exception 'verification did not publish the draft: %', row_to_json(d);
  end if;
  if not public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url) then
    raise exception 'published draft is still hidden by RLS';
  end if;
  if exists (
    select 1 from dish_images
    where dish_id = 'merchant-dish-smoke-d27-draft' and not media_approved_for_display
  ) then
    raise exception 'draft photos were not published';
  end if;
  if not exists (select 1 from catalog_raw_dish_cards where release_id = v_release and id = 'merchant-dish-smoke-d27-draft') then
    raise exception 'published draft did not reach the raw catalog';
  end if;
end $$;

select 'merchant_unverified_menu_drafts smoke passed' as result;

rollback;
