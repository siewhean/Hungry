-- Smoke checks for 20261020060200_merchant_dish_atomic_writes.sql and
-- 20261020060300_catalog_refresh_once_per_transaction.sql.
-- merchant_set_dish_availability_flag sets, clears and toggles one flag in a
-- single UPDATE and keeps other flags; merchant_save_dish creates a dish with
-- its photos and dietary labels, a retried create edits instead of
-- duplicating, edits change only the keys sent, unknown labels roll the whole
-- save back, and another merchant cannot write the dish. The raw catalog card
-- for the venue is rebuilt once per transaction. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0060-b000-000000000001
--   stranger: 00000000-0000-0060-b000-000000000002
--   account:  00000000-0000-0060-a000-000000000001
--   outlet:   00000000-0000-0060-d000-000000000001
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-ml-building', 'Smoke ML Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values ('smoke-ml-venue', 'smoke-ml-building', 'Smoke ML Stall', '#01-01', 'L1', 1.301, 103.801);

insert into auth.users (id, email)
values
  ('00000000-0000-0060-b000-000000000001', 'ml-owner@example.test'),
  ('00000000-0000-0060-b000-000000000002', 'ml-stranger@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0060-a000-000000000001',
  '00000000-0000-0060-b000-000000000001',
  'Smoke ML Merchant',
  'ml-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values (
  '00000000-0000-0060-d000-000000000001', '00000000-0000-0060-a000-000000000001',
  'smoke-ml-venue', 'smoke-ml-building', 'Smoke ML Stall', 'hawker_stall', true
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0060-d000-000000000001', 'verified', now());

insert into catalog_releases (id, status, activated_at)
values ('00000000-0000-0060-c000-000000000001', 'active', now());

-- Count venue card rebuilds for this venue (rolled back with the smoke).
create table smoke_ml_rebuilds (n integer not null);
create function smoke_ml_count_rebuild() returns trigger language plpgsql as $$
begin
  if new.id = 'smoke-ml-venue' then insert into smoke_ml_rebuilds values (1); end if;
  return new;
end $$;
create trigger smoke_ml_count_rebuild after insert on catalog_raw_venue_cards
for each row execute function smoke_ml_count_rebuild();
grant insert, select on smoke_ml_rebuilds to authenticated;

-- 1. Owner creates a dish with two photos and two dietary labels.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0060-b000-000000000001', true);
set local role authenticated;

select public.merchant_save_dish(
  'merchant-dish-smoke-ml-1',
  'smoke-ml-venue',
  'smoke-ml-building',
  jsonb_build_object('name', 'Chicken Rice', 'price', 4.5, 'availability_flags', jsonb_build_array('section:Mains')),
  array['https://example.test/a.jpg', 'https://example.test/b.jpg'],
  array['halal', 'nut_free'],
  null
);

-- Deferred catalog triggers fire here instead of at commit.
set constraints all immediate;
set constraints all deferred;

reset role;

do $$
declare
  v_dish public.dishes;
begin
  select * into v_dish from public.dishes where id = 'merchant-dish-smoke-ml-1';
  if v_dish.id is null or v_dish.name <> 'Chicken Rice' or v_dish.price <> 4.5
     or v_dish.price_range <> 'S$4.50' or v_dish.building_id <> 'smoke-ml-building' then
    raise exception 'dish was not created as sent: %', row_to_json(v_dish);
  end if;
  if (select count(*) from public.dish_images where dish_id = v_dish.id) <> 2 then
    raise exception 'dish photos were not saved';
  end if;
  if (select count(*) from public.dish_dietary_flags where dish_id = v_dish.id) <> 2 then
    raise exception 'dish dietary labels were not saved';
  end if;
  if (select count(*) from smoke_ml_rebuilds) <> 1 then
    raise exception 'venue card rebuilt % times for one save, expected 1',
      (select count(*) from smoke_ml_rebuilds);
  end if;
  if not exists (
    select 1 from public.catalog_raw_dish_cards
    where release_id = '00000000-0000-0060-c000-000000000001' and id = 'merchant-dish-smoke-ml-1'
  ) then
    raise exception 'catalog dish card was not rebuilt';
  end if;
end $$;

-- 2. A retried create with the same id edits it; an edit changes only sent keys.
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.merchant_save_dish(
  'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'smoke-ml-building',
  jsonb_build_object('name', 'Chicken Rice', 'price', 4.5),
  null, null, null
);
select public.merchant_save_dish(
  'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'smoke-ml-building',
  jsonb_build_object('price', 5),
  array['https://example.test/c.jpg'],
  array['halal'],
  null
);

-- Unknown dietary label: the whole save fails and nothing changes.
do $$
begin
  begin
    perform public.merchant_save_dish(
      'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'smoke-ml-building',
      jsonb_build_object('name', 'Should Not Stick'),
      null,
      array['not_a_real_flag'],
      null
    );
    raise exception 'unknown dietary flag was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end $$;

reset role;

do $$
declare
  v_dish public.dishes;
begin
  if (select count(*) from public.dishes where venue_id = 'smoke-ml-venue') <> 1 then
    raise exception 'retried create duplicated the dish';
  end if;
  select * into v_dish from public.dishes where id = 'merchant-dish-smoke-ml-1';
  if v_dish.name <> 'Chicken Rice' or v_dish.price <> 5
     or not ('section:Mains' = any(v_dish.availability_flags)) then
    raise exception 'edit did not keep unsent fields: %', row_to_json(v_dish);
  end if;
  if (select count(*) from public.dish_images where dish_id = v_dish.id) <> 1
     or (select count(*) from public.dish_dietary_flags where dish_id = v_dish.id) <> 1 then
    raise exception 'photos and labels were not replaced';
  end if;
end $$;

-- 3. Availability flag: set, keep other flags, toggle, clear variants.
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if public.merchant_set_dish_availability_flag(
       'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'sold_out', true) is not true then
    raise exception 'set sold_out did not return true';
  end if;
  -- Setting again is idempotent.
  if public.merchant_set_dish_availability_flag(
       'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'sold_out', true) is not true then
    raise exception 'second set sold_out did not return true';
  end if;
  -- Toggle (null) clears it.
  if public.merchant_set_dish_availability_flag(
       'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'sold_out', null) is not false then
    raise exception 'toggle did not clear sold_out';
  end if;
  if public.merchant_set_dish_availability_flag(
       'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'Sold Out', null) is not true then
    raise exception 'toggle did not set sold_out';
  end if;
end $$;

reset role;

do $$
declare
  v_flags text[];
begin
  select availability_flags into v_flags from public.dishes where id = 'merchant-dish-smoke-ml-1';
  if v_flags <> array['section:Mains', 'sold_out'] then
    raise exception 'unexpected flags after toggles: %', v_flags;
  end if;
end $$;

-- 4. Another signed-in user cannot write the dish through either function.
select set_config('request.jwt.claim.sub', '00000000-0000-0060-b000-000000000002', true);
set local role authenticated;

do $$
begin
  begin
    perform public.merchant_set_dish_availability_flag(
      'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'sold_out', false);
    raise exception 'stranger changed a dish flag';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.merchant_save_dish(
      'merchant-dish-smoke-ml-1', 'smoke-ml-venue', 'smoke-ml-building',
      jsonb_build_object('name', 'Hijacked'), null, null, null);
    raise exception 'stranger edited a dish';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

do $$
begin
  if (select name from public.dishes where id = 'merchant-dish-smoke-ml-1') <> 'Chicken Rice' then
    raise exception 'stranger write reached the dish';
  end if;
  if has_function_privilege('anon', 'public.merchant_save_dish(text, text, text, jsonb, text[], text[], jsonb)', 'execute')
     or has_function_privilege('anon', 'public.merchant_set_dish_availability_flag(text, text, text, boolean)', 'execute') then
    raise exception 'anon can execute merchant dish write functions';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.merchant_save_dish(text, text, text, jsonb, text[], text[], jsonb)'::regprocedure)
     or (select prosecdef from pg_proc where oid = 'public.merchant_set_dish_availability_flag(text, text, text, boolean)'::regprocedure) then
    raise exception 'merchant dish write functions must be SECURITY INVOKER';
  end if;
end $$;

select 'merchant_dish_atomic_writes_passed' as result;

rollback;
