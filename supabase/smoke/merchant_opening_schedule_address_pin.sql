-- Smoke checks for 20261020130000_merchant_opening_schedule_address_pin.sql.
-- A verified outlet's weekly schedule (with special hours), address, postal
-- code and map pin reach its venue; an unverified outlet's do not; malformed
-- schedules, postal codes and pins outside Singapore are refused; merchants
-- cannot write venues.opening_schedule directly; a home-based outlet never
-- publishes its pin. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0130-b000-000000000001
--   account:  00000000-0000-0130-a000-000000000001
--   outlets:  00000000-0000-0130-d000-00000000000{1,2}
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-d25-building', 'Smoke D25 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, operating_hours, latitude, longitude, address, postal_code)
values
  ('smoke-d25-venue', 'smoke-d25-building', 'Smoke D25 Stall', '#01-01', 'L1', 'Old hours',
   1.301, 103.801, '1 Old Street', '111111'),
  ('smoke-d25-venue-unverified', 'smoke-d25-building', 'Smoke D25 Unverified', '#02-02', 'L2', 'Old',
   1.302, 103.802, '2 Old Street', '222222');

insert into auth.users (id, email)
values ('00000000-0000-0130-b000-000000000001', 'd25-owner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0130-a000-000000000001',
  '00000000-0000-0130-b000-000000000001',
  'Smoke D25 Merchant',
  'd25-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, name, business_type, is_live)
values
  ('00000000-0000-0130-d000-000000000001', '00000000-0000-0130-a000-000000000001',
   'smoke-d25-venue', 'Smoke D25 Stall', 'hawker_stall', true),
  ('00000000-0000-0130-d000-000000000002', '00000000-0000-0130-a000-000000000001',
   'smoke-d25-venue-unverified', 'Smoke D25 Unverified', 'hawker_stall', true);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0130-d000-000000000001', 'verified', now());
insert into merchant_verifications (outlet_id, status)
values ('00000000-0000-0130-d000-000000000002', 'submitted');

select set_config(
  'smoke.schedule',
  '{"weekly": {"mon": [{"open": "10:00", "close": "14:00"}, {"open": "17:00", "close": "21:00"}],
               "fri": [{"open": "18:00", "close": "02:00"}], "sat": [{"open": "00:00", "close": "24:00"}]},
    "special": [{"date": "2026-12-25", "ranges": []}]}',
  true
);

-- 1. Owner saves schedule, address and pin on both outlets.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0130-b000-000000000001', true);
set local role authenticated;

update merchant_outlets
set opening_schedule = current_setting('smoke.schedule')::jsonb,
    operating_hours = 'Mon 10am-2pm, 5pm-9pm; Fri 6pm-2am; Sat 24 hours',
    address = '1 Kadayanallur Street', postal_code = '069184',
    latitude = 1.2803, longitude = 103.8447
where id = '00000000-0000-0130-d000-000000000001';

update merchant_outlets
set opening_schedule = current_setting('smoke.schedule')::jsonb,
    address = '9 Unverified Road', postal_code = '999999',
    latitude = 1.35, longitude = 103.9
where id = '00000000-0000-0130-d000-000000000002';

-- 2. Malformed values are refused; direct venue writes are refused.
do $$
begin
  begin
    update merchant_outlets set opening_schedule = '{"weekly": {"mon": [{"open": "25:00", "close": "26:00"}]}}'
    where id = '00000000-0000-0130-d000-000000000001';
    raise exception 'invalid clock time was accepted';
  exception when check_violation then null;
  end;
  begin
    update merchant_outlets set opening_schedule = '{"weekly": {"funday": []}}'
    where id = '00000000-0000-0130-d000-000000000001';
    raise exception 'unknown weekday was accepted';
  exception when check_violation then null;
  end;
  begin
    update merchant_outlets
    set opening_schedule = '{"weekly": {}, "special": [{"date": "2026-12-25", "ranges": []}, {"date": "2026-12-25", "ranges": []}]}'
    where id = '00000000-0000-0130-d000-000000000001';
    raise exception 'duplicate special date was accepted';
  exception when check_violation then null;
  end;
  begin
    update merchant_outlets set postal_code = '12345' where id = '00000000-0000-0130-d000-000000000001';
    raise exception 'five-digit postal code was accepted';
  exception when check_violation then null;
  end;
  begin
    update merchant_outlets set latitude = 51.5, longitude = -0.12 where id = '00000000-0000-0130-d000-000000000001';
    raise exception 'pin outside Singapore was accepted';
  exception when check_violation then null;
  end;
  begin
    update venues set opening_schedule = '{"weekly": {}}' where id = 'smoke-d25-venue';
    raise exception 'merchant direct venue schedule write was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

do $$
declare
  v public.venues;
begin
  select * into v from public.venues where id = 'smoke-d25-venue';
  if v.opening_schedule is distinct from current_setting('smoke.schedule')::jsonb
     or v.operating_hours <> 'Mon 10am-2pm, 5pm-9pm; Fri 6pm-2am; Sat 24 hours' then
    raise exception 'verified schedule did not sync: %', row_to_json(v);
  end if;
  if v.address <> '1 Kadayanallur Street' or v.postal_code <> '069184'
     or v.latitude <> 1.2803 or v.longitude <> 103.8447 then
    raise exception 'verified address/pin did not sync: %', row_to_json(v);
  end if;

  select * into v from public.venues where id = 'smoke-d25-venue-unverified';
  if v.opening_schedule is not null or v.address <> '2 Old Street' or v.latitude <> 1.302 then
    raise exception 'unverified schedule/address reached the venue: %', row_to_json(v);
  end if;
end $$;

-- 3. Home-based: the pin never reaches the venue; 'hidden' drops address too.
-- Changing the type of a verified outlet is ops-only now (merchant-M2), so the setup runs
-- as the database owner; the privacy coercion below does not depend on the role.
update merchant_outlets
set business_type = 'home_based', latitude = 1.29, longitude = 103.85
where id = '00000000-0000-0130-d000-000000000001';
reset role;

do $$
declare
  v public.venues;
begin
  select * into v from public.venues where id = 'smoke-d25-venue';
  if v.latitude is not null or v.longitude is not null then
    raise exception 'home-based venue published a pin: %', row_to_json(v);
  end if;
  if v.address is null or v.opening_schedule is null then
    raise exception 'approximate home-based venue lost its address or hours';
  end if;
end $$;

set local role authenticated;
update merchant_outlets
set location_privacy = 'hidden', address = '3 Secret Lane'
where id = '00000000-0000-0130-d000-000000000001';
reset role;

do $$
begin
  if (select address from public.venues where id = 'smoke-d25-venue') is not null
     or (select postal_code from public.venues where id = 'smoke-d25-venue') is not null then
    raise exception 'hidden home-based venue still shows its address';
  end if;
end $$;

select 'merchant_opening_schedule_address_pin smoke passed' as result;

rollback;
