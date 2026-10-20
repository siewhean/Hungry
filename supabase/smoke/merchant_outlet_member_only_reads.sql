-- Smoke checks for 20261019220000_merchant_outlet_member_only_reads.sql.
-- Diners (anon and signed-in non-members) cannot read merchant_outlets rows;
-- the outlet's owner still can. The diner promotion RPC and promotion table
-- reads still work without outlet row access, include a 'scheduled'
-- promotion whose window has started, and still hide everything once the
-- outlet is not live. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0046-b000-000000000001
--   diner:    00000000-0000-0046-b000-000000000002
--   account:  00000000-0000-0046-a000-000000000001
--   outlet:   00000000-0000-0046-d000-000000000001
--   promos:   00000000-0000-0046-e000-00000000000{1..4}
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-h1-building', 'Smoke H1 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor)
values ('smoke-h1-venue', 'smoke-h1-building', 'Smoke H1 Venue', '#01-01', 'L1');

insert into auth.users (id, email)
values
  ('00000000-0000-0046-b000-000000000001', 'h1-owner@example.test'),
  ('00000000-0000-0046-b000-000000000002', 'h1-diner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0046-a000-000000000001',
  '00000000-0000-0046-b000-000000000001',
  'Smoke H1 Merchant',
  'h1-owner@example.test'
);

insert into merchant_outlets (
  id, merchant_account_id, venue_id, name, business_type, is_live, contact_email, contact_phone
)
values (
  '00000000-0000-0046-d000-000000000001',
  '00000000-0000-0046-a000-000000000001',
  'smoke-h1-venue',
  'Smoke H1 Outlet',
  'hawker_stall',
  true,
  'private-h1@example.test',
  '+6591234567'
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0046-d000-000000000001', 'verified', now());
select set_config('request.jwt.claim.role', '', true);

insert into merchant_promotions (id, outlet_id, title, description, status, start_date, end_date)
values
  ('00000000-0000-0046-e000-000000000001', '00000000-0000-0046-d000-000000000001',
   'Active now', 'Running', 'active', now() - interval '1 day', now() + interval '1 day'),
  ('00000000-0000-0046-e000-000000000002', '00000000-0000-0046-d000-000000000001',
   'Scheduled, started', 'Window open', 'scheduled', now() - interval '1 hour', now() + interval '1 day'),
  ('00000000-0000-0046-e000-000000000003', '00000000-0000-0046-d000-000000000001',
   'Scheduled, future', 'Not yet', 'scheduled', now() + interval '1 day', now() + interval '2 days'),
  ('00000000-0000-0046-e000-000000000004', '00000000-0000-0046-d000-000000000001',
   'Draft', 'Never public', 'draft', now() - interval '1 day', now() + interval '1 day');

-- 1. anon has no table access at all.
do $$
begin
  if has_table_privilege('anon', 'public.merchant_outlets', 'select')
     or has_column_privilege('anon', 'public.merchant_outlets', 'contact_email', 'select') then
    raise exception 'anon can still select merchant_outlets';
  end if;
end $$;

-- 2. anon: promotion RPC and promotion table reads still work.
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

do $$
declare
  v_ids uuid[];
  v_statuses text[];
  v_table_rows integer;
begin
  select array_agg(id order by id), array_agg(distinct status)
  into v_ids, v_statuses
  from public.list_customer_active_promotions('smoke-h1-venue', null);
  if v_ids is distinct from array[
    '00000000-0000-0046-e000-000000000001'::uuid,
    '00000000-0000-0046-e000-000000000002'::uuid
  ] then
    raise exception 'anon promotion RPC returned %', v_ids;
  end if;
  if v_statuses is distinct from array['active'] then
    raise exception 'diner promotion statuses should read active, got %', v_statuses;
  end if;

  select count(*) into v_table_rows
  from public.merchant_promotions
  where outlet_id = '00000000-0000-0046-d000-000000000001';
  if v_table_rows <> 2 then
    raise exception 'anon promotion table read expected 2 rows, got %', v_table_rows;
  end if;

  if not exists (
    select 1 from public.get_public_merchant_profile('smoke-h1-venue')
  ) then
    raise exception 'public owner card stopped working for anon';
  end if;
end $$;

reset role;

-- 3. Signed-in diner (not on the team): no outlet rows, promotions still visible.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000002', true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.merchant_outlets
    where id = '00000000-0000-0046-d000-000000000001'
  ) then
    raise exception 'a non-member can still read the outlet row';
  end if;
  if (select count(*) from public.list_customer_active_promotions('smoke-h1-venue', null)) <> 2 then
    raise exception 'signed-in diner promotion RPC should return 2 rows';
  end if;
  if (
    select count(*) from public.merchant_promotions
    where outlet_id = '00000000-0000-0046-d000-000000000001'
  ) <> 2 then
    raise exception 'signed-in diner promotion table read should return 2 rows';
  end if;
end $$;

reset role;

-- 4. Owner still reads the full row and every promotion.
select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000001', true);
set local role authenticated;

do $$
begin
  if (
    select contact_email from public.merchant_outlets
    where id = '00000000-0000-0046-d000-000000000001'
  ) is distinct from 'private-h1@example.test' then
    raise exception 'owner lost access to their outlet row';
  end if;
  if (
    select count(*) from public.merchant_promotions
    where outlet_id = '00000000-0000-0046-d000-000000000001'
  ) <> 4 then
    raise exception 'owner should see all 4 promotions';
  end if;
end $$;

reset role;

-- 5. Outlet not live: diners see no promotions.
update merchant_outlets
set is_live = false
where id = '00000000-0000-0046-d000-000000000001';

select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.list_customer_active_promotions('smoke-h1-venue', null))
     or exists (
       select 1 from public.merchant_promotions
       where outlet_id = '00000000-0000-0046-d000-000000000001'
     ) then
    raise exception 'promotions of a non-live outlet are visible to diners';
  end if;
end $$;

reset role;

select 'merchant_outlet_member_only_reads_smoke_passed' as result;
rollback;
