-- Merchant live sync caller-verification smoke checks
-- (20261019090000_merchant_live_sync_caller_verification).
-- Run as postgres against a local/linked DB after migrations. Every query
-- below should return zero rows. The behavioural block rolls back.

-- Helper/guard functions exist with the expected security mode and search_path.
select 'missing_or_wrong_security_mode' as check_name, expected.proname as detail
from (
  values
    ('merchant_venue_is_verified_for_current_user', true),
    ('merchant_can_manage_venue', false),
    ('merchant_outlet_matches_catalog_link', false),
    ('sync_merchant_outlet_to_venue', true),
    ('get_public_merchant_profile', true),
    ('enforce_merchant_outlet_venue_link_guard', false)
) as expected(proname, secdef)
where not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = expected.proname
    and p.prosecdef = expected.secdef
    and p.proconfig @> array['search_path=""']
);

-- anon must not execute the caller-scoped helper.
select 'anon_can_execute_caller_helper' as check_name, 'merchant_venue_is_verified_for_current_user' as detail
where has_function_privilege('anon', 'public.merchant_venue_is_verified_for_current_user(text)', 'execute');

-- Dish guards must use the caller-scoped check.
select 'guard_uses_venue_wide_verification' as check_name, p.proname as detail
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('enforce_merchant_dish_write_guard', 'enforce_merchant_dish_image_write_guard')
  and (
    pg_get_functiondef(p.oid) not like '%merchant_venue_is_verified_for_current_user(%'
    or pg_get_functiondef(p.oid) ~ 'merchant_venue_is_verified\('
  );

select 'missing_outlet_venue_link_guard' as check_name, 'trg_enforce_merchant_outlet_venue_link_guard' as detail
where not exists (
  select 1
  from pg_trigger
  where tgname = 'trg_enforce_merchant_outlet_venue_link_guard'
    and tgrelid = 'public.merchant_outlets'::regclass
    and not tgisinternal
);

-- Behaviour: a verified outlet and an unverified claimant on the same venue.
begin;

do $$
declare
  v_venue text;
  v_building text;
  v_verified_user uuid := gen_random_uuid();
  v_claimant_user uuid := gen_random_uuid();
  v_verified_account uuid;
  v_claimant_account uuid;
  v_verified_outlet uuid;
  v_claimant_outlet uuid;
  v_profile_count integer;
begin
  select v.id, v.building_id into v_venue, v_building
  from public.venues v
  where v.building_id is not null
  limit 1;
  if v_venue is null then
    raise notice 'skipped: no venues';
    return;
  end if;

  insert into public.merchant_accounts (user_id, display_name, email)
  values (v_verified_user, 'Smoke verified', 'smoke-verified@example.test')
  returning id into v_verified_account;
  insert into public.merchant_accounts (user_id, display_name, email)
  values (v_claimant_user, 'Smoke claimant', 'smoke-claimant@example.test')
  returning id into v_claimant_account;

  insert into public.merchant_outlets (merchant_account_id, venue_id, building_id, name, business_type, is_live, contact_phone)
  values (v_verified_account, v_venue, v_building, 'Smoke verified', 'hawker_stall', true, '+6560000001')
  returning id into v_verified_outlet;
  insert into public.merchant_outlets (merchant_account_id, venue_id, building_id, name, business_type, is_live, contact_phone)
  values (v_claimant_account, v_venue, v_building, 'Smoke claimant', 'hawker_stall', true, '+6560000002')
  returning id into v_claimant_outlet;

  insert into public.merchant_verifications (outlet_id, status, verified_at)
  values (v_verified_outlet, 'verified', now());

  -- Act as the unverified claimant.
  perform set_config('request.jwt.claims', json_build_object('sub', v_claimant_user, 'role', 'authenticated')::text, true);
  if public.merchant_venue_is_verified_for_current_user(v_venue) then
    raise exception 'FAIL: claimant treated as verified';
  end if;
  if public.merchant_can_manage_venue(v_venue) then
    raise exception 'FAIL: claimant can manage a venue with a verified outlet';
  end if;

  -- Act as the verified merchant.
  perform set_config('request.jwt.claims', json_build_object('sub', v_verified_user, 'role', 'authenticated')::text, true);
  if not public.merchant_venue_is_verified_for_current_user(v_venue) then
    raise exception 'FAIL: verified merchant not recognised';
  end if;
  if not public.merchant_can_manage_venue(v_venue) then
    raise exception 'FAIL: verified merchant lost manage access';
  end if;

  -- Public profile returns only the verified outlet.
  select count(*) into v_profile_count
  from public.get_public_merchant_profile(v_venue) p
  where p.outlet_id = v_claimant_outlet or p.contact_phone = '+6560000002';
  if v_profile_count <> 0 then
    raise exception 'FAIL: unverified outlet exposed by get_public_merchant_profile';
  end if;

  raise notice 'merchant live sync caller verification smoke passed';
end;
$$;

rollback;
