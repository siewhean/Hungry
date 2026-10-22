-- Smoke checks for 20261019221000_merchant_profile_venue_sync_privacy.sql.
-- A verified outlet's name, hours, unit and floor reach its venue; an
-- unverified outlet's do not; merchants cannot write those venue columns
-- directly; a home-based outlet is never 'exact' and its venue loses unit,
-- floor and exact pin (and address when 'hidden'). Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0047-b000-000000000001
--   account:  00000000-0000-0047-a000-000000000001
--   outlets:  00000000-0000-0047-d000-00000000000{1,2}
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-h3-building', 'Smoke H3 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (
  id, building_id, name, unit_number, floor, operating_hours, latitude, longitude, address, postal_code
)
values
  ('smoke-h3-venue', 'smoke-h3-building', 'Old Name', '#01-01', 'L1', 'Old hours',
   1.301, 103.801, '1 Smoke Street', '123456'),
  ('smoke-h3-venue-unverified', 'smoke-h3-building', 'Unverified Old', '#02-02', 'L2', 'Old',
   1.302, 103.802, '2 Smoke Street', '654321');

insert into auth.users (id, email)
values ('00000000-0000-0047-b000-000000000001', 'h3-owner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0047-a000-000000000001',
  '00000000-0000-0047-b000-000000000001',
  'Smoke H3 Merchant',
  'h3-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, name, business_type, is_live)
values
  ('00000000-0000-0047-d000-000000000001', '00000000-0000-0047-a000-000000000001',
   'smoke-h3-venue', 'Old Name', 'hawker_stall', true),
  ('00000000-0000-0047-d000-000000000002', '00000000-0000-0047-a000-000000000001',
   'smoke-h3-venue-unverified', 'Unverified Old', 'hawker_stall', true);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0047-d000-000000000001', 'verified', now());
insert into merchant_verifications (outlet_id, status)
values ('00000000-0000-0047-d000-000000000002', 'submitted');

-- 1. Owner edits both outlets' profiles.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0047-b000-000000000001', true);
set local role authenticated;

update merchant_outlets
set name = 'New Name', operating_hours = 'Mon-Sun 10:00-22:00', unit_number = '#01-99', floor = 'L3'
where id = '00000000-0000-0047-d000-000000000001';

update merchant_outlets
set name = 'Unverified New', operating_hours = 'New', unit_number = '#09-09', floor = 'L9'
where id = '00000000-0000-0047-d000-000000000002';

-- 2. Direct venue writes of synced columns are refused.
do $$
begin
  begin
    update venues set name = 'Bypass' where id = 'smoke-h3-venue-unverified';
    raise exception 'merchant direct venue name write was allowed';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update venues set unit_number = '#00-00' where id = 'smoke-h3-venue';
    raise exception 'merchant direct venue unit write was allowed';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

do $$
declare
  v public.venues;
begin
  select * into v from public.venues where id = 'smoke-h3-venue';
  if v.name <> 'New Name' or v.operating_hours <> 'Mon-Sun 10:00-22:00'
     or v.unit_number <> '#01-99' or v.floor <> 'L3' then
    raise exception 'verified profile did not sync: %', row_to_json(v);
  end if;
  if v.latitude is null or v.address is null then
    raise exception 'non-home-based venue lost its location: %', row_to_json(v);
  end if;

  select * into v from public.venues where id = 'smoke-h3-venue-unverified';
  if v.name <> 'Unverified Old' or v.unit_number <> '#02-02' or v.operating_hours <> 'Old' then
    raise exception 'unverified profile reached the venue: %', row_to_json(v);
  end if;
end $$;

-- 3. Home-based: 'exact' is coerced, unit/floor/pin are cleared.
-- Changing the type of a verified outlet is ops-only now (merchant-M2), so the setup runs
-- as the database owner; the privacy coercion below does not depend on the role.

update merchant_outlets
set business_type = 'home_based', location_privacy = 'exact'
where id = '00000000-0000-0047-d000-000000000001';

reset role;

do $$
declare
  v public.venues;
begin
  if (
    select location_privacy from public.merchant_outlets
    where id = '00000000-0000-0047-d000-000000000001'
  ) <> 'approximate' then
    raise exception 'home-based outlet kept exact location privacy';
  end if;

  select * into v from public.venues where id = 'smoke-h3-venue';
  if v.unit_number <> '' or v.floor <> '' or v.latitude is not null or v.longitude is not null then
    raise exception 'home-based venue still exposes its exact location: %', row_to_json(v);
  end if;
  if v.address is null then
    raise exception 'approximate privacy should keep the street address';
  end if;
end $$;

set local role authenticated;

update merchant_outlets
set location_privacy = 'hidden', unit_number = '#05-05'
where id = '00000000-0000-0047-d000-000000000001';

reset role;

do $$
declare
  v public.venues;
begin
  select * into v from public.venues where id = 'smoke-h3-venue';
  if v.address is not null or v.postal_code is not null or v.unit_number <> '' then
    raise exception 'hidden home-based venue still exposes its address: %', row_to_json(v);
  end if;
end $$;

-- 4. The public definer trigger function is gone; the body lives in app_private.
do $$
begin
  if to_regprocedure('public.sync_merchant_outlet_to_venue()') is not null then
    raise exception 'public.sync_merchant_outlet_to_venue() still exists';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enforce_merchant_venue_update_guard' and p.prosecdef
  ) then
    raise exception 'venue update guard must stay SECURITY INVOKER';
  end if;
end $$;

select 'merchant_profile_venue_sync_privacy_smoke_passed' as result;
rollback;
