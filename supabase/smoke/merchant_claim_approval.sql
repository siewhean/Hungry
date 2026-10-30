-- Smoke checks for 20261029160000_merchant_claim_approval.sql.
-- Approving a claim creates the claimant's merchant account, an owner role and an unverified,
-- not-live outlet linked to the stall, and marks the claim converted; approving again changes
-- nothing; a stall owned by another account, a rejected claim and a claim with no claimant are
-- refused; only the service role can call it. Runs in a transaction and rolls back. Brings its
-- own building.
--   claimant: 00000000-0000-0073-b000-000000000001
--   rival:    00000000-0000-0073-b000-000000000002

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values ('smoke-mca-building', 'smoke-mca-building', 'Smoke MCA Hawker Centre', 'hawker_centre', 1.4801, 103.6301, array['01']);

insert into venues (id, building_id, name, unit_number, floor)
values
  ('smoke-mca-venue', 'smoke-mca-building', 'Smoke MCA Noodles', '#01-07', '01'),
  ('smoke-mca-venue-2', 'smoke-mca-building', 'Smoke MCA Drinks', '#01-08', '01'),
  ('smoke-mca-venue-3', 'smoke-mca-building', 'Smoke MCA Rice', '#01-09', '01');

insert into auth.users (id, email)
values
  ('00000000-0000-0073-b000-000000000001', 'mca-claimant@example.test'),
  ('00000000-0000-0073-b000-000000000002', 'mca-rival@example.test');

insert into public.user_profiles (id, display_name)
values
  ('00000000-0000-0073-b000-000000000001', 'MCA Claimant'),
  ('00000000-0000-0073-b000-000000000002', 'MCA Rival');

insert into merchant_claim_interests (id, venue_id, building_id, claimed_by, contact_name, contact_email, status)
values
  ('00000000-0000-0073-c000-000000000001', 'smoke-mca-venue', 'smoke-mca-building',
   '00000000-0000-0073-b000-000000000001', 'Uncle Tan', 'tan@example.test', 'qualified'),
  ('00000000-0000-0073-c000-000000000002', 'smoke-mca-venue', 'smoke-mca-building',
   '00000000-0000-0073-b000-000000000002', 'Rival', 'rival@example.test', 'new'),
  ('00000000-0000-0073-c000-000000000003', 'smoke-mca-venue-2', 'smoke-mca-building',
   '00000000-0000-0073-b000-000000000001', null, null, 'new'),
  ('00000000-0000-0073-c000-000000000004', 'smoke-mca-venue-3', 'smoke-mca-building',
   '00000000-0000-0073-b000-000000000002', null, null, 'rejected'),
  ('00000000-0000-0073-c000-000000000005', 'smoke-mca-venue', 'smoke-mca-building',
   '00000000-0000-0073-b000-000000000001', 'Uncle Tan again', 'tan@example.test', 'new');

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

do $$
declare
  v_first jsonb;
  v_again jsonb;
  v_second jsonb;
begin
  v_first := public.approve_merchant_claim('00000000-0000-0073-c000-000000000001');
  if (v_first->>'created')::boolean is not true then
    raise exception 'the first approval should create the outlet: %', v_first;
  end if;
  if (v_first->>'alreadyApproved')::boolean is not false or v_first->>'email' <> 'tan@example.test' then
    raise exception 'the first approval should report a fresh approval and the claimant email: %', v_first;
  end if;
  if (v_first->>'rejectedOthers')::int <> 1 then
    raise exception 'exactly the rival claim should be rejected: %', v_first;
  end if;
  if (select status from merchant_claim_interests where id = '00000000-0000-0073-c000-000000000002') <> 'rejected' then
    raise exception 'the rival claim should be rejected once the stall is approved';
  end if;
  if (select status from merchant_claim_interests where id = '00000000-0000-0073-c000-000000000005') <> 'converted' then
    raise exception 'the claimant duplicate claim should be approved with the first';
  end if;

  if not exists (
    select 1 from merchant_accounts
    where id = (v_first->>'merchantAccountId')::uuid
      and user_id = '00000000-0000-0073-b000-000000000001'
      and display_name = 'Uncle Tan'
      and email = 'tan@example.test'
  ) then
    raise exception 'merchant account missing or wrong: %', v_first;
  end if;
  if not exists (
    select 1 from merchant_roles
    where merchant_account_id = (v_first->>'merchantAccountId')::uuid
      and user_id = '00000000-0000-0073-b000-000000000001' and role = 'owner'
  ) then
    raise exception 'owner role missing';
  end if;
  if not exists (
    select 1 from merchant_outlets
    where id = (v_first->>'outletId')::uuid
      and venue_id = 'smoke-mca-venue'
      and building_id = 'smoke-mca-building'
      and name = 'Smoke MCA Noodles'
      and unit_number = '#01-07'
      and business_type = 'hawker_stall'
      and is_live = false
  ) then
    raise exception 'outlet missing or wrong: %', v_first;
  end if;
  if exists (select 1 from merchant_verifications where outlet_id = (v_first->>'outletId')::uuid and status = 'verified') then
    raise exception 'an approved claim must not be verified';
  end if;
  if (select status from merchant_claim_interests where id = '00000000-0000-0073-c000-000000000001') <> 'converted' then
    raise exception 'the claim should be converted';
  end if;

  -- Approving again changes nothing.
  v_again := public.approve_merchant_claim('00000000-0000-0073-c000-000000000001');
  if (v_again->>'alreadyApproved')::boolean is not true then
    raise exception 'a second approval should be flagged as already approved: %', v_again;
  end if;
  if (v_again->>'created')::boolean is not false
     or v_again->>'outletId' <> v_first->>'outletId'
     or v_again->>'merchantAccountId' <> v_first->>'merchantAccountId' then
    raise exception 'a second approval should return the same account and outlet: %', v_again;
  end if;
  if (select count(*) from merchant_outlets where venue_id = 'smoke-mca-venue') <> 1 then
    raise exception 'a second approval created a second outlet';
  end if;

  -- A second stall for the same person reuses the account.
  v_second := public.approve_merchant_claim('00000000-0000-0073-c000-000000000003');
  if v_second->>'merchantAccountId' <> v_first->>'merchantAccountId' then
    raise exception 'a second stall should join the same merchant account';
  end if;
  if (select count(*) from merchant_accounts where user_id = '00000000-0000-0073-b000-000000000001') <> 1 then
    raise exception 'one person must have one merchant account';
  end if;

  -- Someone else's claim on a stall that already has an owner is refused.
  insert into merchant_claim_interests (id, venue_id, building_id, claimed_by, status)
  values ('00000000-0000-0073-c000-000000000006', 'smoke-mca-venue', 'smoke-mca-building',
          '00000000-0000-0073-b000-000000000002', 'new');
  begin
    perform public.approve_merchant_claim('00000000-0000-0073-c000-000000000006');
    raise exception 'a rival claim on an owned stall was approved';
  exception when unique_violation then
    null;
  end;

  -- A rejected claim stays rejected.
  begin
    perform public.approve_merchant_claim('00000000-0000-0073-c000-000000000004');
    raise exception 'a rejected claim was approved';
  exception when invalid_parameter_value then
    null;
  end;

  -- An unknown claim.
  begin
    perform public.approve_merchant_claim('00000000-0000-0073-c000-0000000000ff');
    raise exception 'an unknown claim was approved';
  exception when no_data_found then
    null;
  end;
end $$;

reset role;

-- Only the service role can call it.
do $$
begin
  if has_function_privilege('anon', 'public.approve_merchant_claim(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.approve_merchant_claim(uuid)', 'execute') then
    raise exception 'approve_merchant_claim must be service_role only';
  end if;
  if not has_function_privilege('service_role', 'public.approve_merchant_claim(uuid)', 'execute') then
    raise exception 'the console (service role) cannot call approve_merchant_claim';
  end if;
end $$;

select 'merchant_claim_approval_passed' as result;

rollback;
