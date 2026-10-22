-- Smoke checks for 20261021090000_merchant_dish_archive.sql.
-- A verified merchant cannot hard-delete a dish diners can see: removing it
-- archives the dish, its reviews and favourites stay, and it leaves the raw
-- catalog and search_dishes. Drafts are still deleted outright. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0133-b000-000000000001
--   diner:    00000000-0000-0133-b000-000000000002
--   account:  00000000-0000-0133-a000-000000000001
--   outlet:   00000000-0000-0133-d000-000000000001
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-d29-building', 'Smoke D29 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values ('smoke-d29-venue', 'smoke-d29-building', 'Smoke D29 Stall', '#01-01', 'L1', 1.301, 103.801);

insert into dishes (
  id, venue_id, building_id, name, price, price_range,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-d29-reviewed', 'smoke-d29-venue', 'smoke-d29-building', 'Smoke Archive Laksa', 5, 'S$5.00',
   true, 'licensed', true, 'licensed'),
  ('smoke-d29-kept', 'smoke-d29-venue', 'smoke-d29-building', 'Smoke Kept Kopi', 2, 'S$2.00',
   true, 'licensed', true, 'licensed');

insert into auth.users (id, email)
values
  ('00000000-0000-0133-b000-000000000001', 'd29-owner@example.test'),
  ('00000000-0000-0133-b000-000000000002', 'd29-diner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0133-a000-000000000001',
  '00000000-0000-0133-b000-000000000001',
  'Smoke D29 Merchant',
  'd29-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values (
  '00000000-0000-0133-d000-000000000001', '00000000-0000-0133-a000-000000000001',
  'smoke-d29-venue', 'smoke-d29-building', 'Smoke D29 Stall', 'hawker_stall', true
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0133-d000-000000000001', 'verified', now());

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0133-e000-000000000001',
  '00000000-0000-0133-b000-000000000002',
  'smoke-d29-reviewed',
  'smoke-d29-venue',
  'D29 Diner',
  1,
  'Archive smoke review'
);
insert into user_favourite_dishes (user_id, dish_id)
values ('00000000-0000-0133-b000-000000000002', 'smoke-d29-reviewed');

-- Reuse the live database's active release; only one may be active.
insert into catalog_releases (id, status, activated_at)
select '00000000-0000-0133-c000-000000000001', 'active', now()
where not exists (select 1 from catalog_releases where status = 'active');
select set_config('smoke.release', (select id::text from catalog_releases where status = 'active' limit 1), true);
select public.catalog_raw_refresh_venue('smoke-d29-venue');

-- 1. The verified owner cannot hard-delete a live dish, but can remove it.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0133-b000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    delete from dishes where id = 'smoke-d29-reviewed';
    if not found then
      raise exception 'merchant delete of a live dish did not reach the guard';
    end if;
    raise exception 'verified merchant hard-deleted a live dish';
  exception when insufficient_privilege then null;
  end;
end $$;

select public.merchant_remove_dish('smoke-d29-reviewed', 'smoke-d29-venue');

-- A dish the verified owner just added is live too, so removing it archives it.
select public.merchant_save_dish(
  'merchant-dish-smoke-d29-new', 'smoke-d29-venue', 'smoke-d29-building',
  jsonb_build_object('name', 'Smoke New Dish', 'price', 3), null, null, null
);
select public.merchant_remove_dish('merchant-dish-smoke-d29-new', 'smoke-d29-venue');
reset role;

-- The catalog rebuild is a deferred trigger that runs at commit; run it now.
select public.catalog_raw_refresh_venue('smoke-d29-venue');

do $$
declare
  v_release uuid := current_setting('smoke.release')::uuid;
begin
  if not exists (select 1 from dishes where id = 'smoke-d29-reviewed' and archived_at is not null) then
    raise exception 'removed dish was not archived';
  end if;
  if not exists (select 1 from dishes where id = 'merchant-dish-smoke-d29-new' and archived_at is not null) then
    raise exception 'removed new dish was not archived';
  end if;
  if not exists (select 1 from reviews where id = '00000000-0000-0133-e000-000000000001') then
    raise exception 'archiving a dish deleted its review';
  end if;
  if not exists (
    select 1 from user_favourite_dishes
    where user_id = '00000000-0000-0133-b000-000000000002' and dish_id = 'smoke-d29-reviewed'
  ) then
    raise exception 'archiving a dish deleted a favourite';
  end if;
  if exists (select 1 from catalog_raw_dish_cards where release_id = v_release and id = 'smoke-d29-reviewed') then
    raise exception 'archived dish is still in the raw catalog';
  end if;
  if not exists (select 1 from catalog_raw_dish_cards where release_id = v_release and id = 'smoke-d29-kept') then
    raise exception 'the other dish dropped out of the raw catalog';
  end if;
  if exists (
    select 1 from catalog_raw_venue_cards
    where release_id = v_release and id = 'smoke-d29-venue'
      and (menu_count <> 1 or representative_dish ->> 'id' = 'smoke-d29-reviewed')
  ) then
    raise exception 'venue card still counts or shows the archived dish';
  end if;
  if exists (
    select 1 from public.search_dishes(p_query => 'Smoke Archive Laksa', p_venue_id => 'smoke-d29-venue')
  ) then
    raise exception 'search_dishes returns the archived dish';
  end if;
  if not exists (
    select 1 from public.search_dishes(p_query => 'Smoke Kept Kopi', p_venue_id => 'smoke-d29-venue')
  ) then
    raise exception 'search_dishes lost the live dish';
  end if;
end $$;

-- 2. Another signed-in user cannot remove the stall's dishes.
select set_config('request.jwt.claim.sub', '00000000-0000-0133-b000-000000000002', true);
set local role authenticated;
do $$
begin
  begin
    perform public.merchant_remove_dish('smoke-d29-kept', 'smoke-d29-venue');
    raise exception 'a diner removed a stall dish';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'merchant_dish_archive smoke passed' as result;

rollback;
