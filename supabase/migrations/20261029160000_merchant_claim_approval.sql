-- smoke: supabase/smoke/merchant_claim_approval.sql
-- Merchant Centre round-four phase 3 (MERCH-R4-1).
--
-- A stall claim only ever recorded interest: nothing turned an approved claim into a merchant
-- account, so a claimant who was approved by hand still saw "no merchant account yet". Ops
-- approve claims by hand in the console (not by an ACRA/UEN match); the console calls this
-- function with the service role. In one transaction it
--   - locks the claim and the venue (two staff clicking Approve, or two claimants for one stall,
--     cannot both pass),
--   - creates the claimant's merchant account (or reuses it) and an owner role,
--   - creates the outlet linked to the venue, not live and not verified (the licence check in
--     the Merchant Centre still decides that),
--   - marks the claim 'converted', which the stall page already shows as "Approved",
--   - rejects the stall's other open claims (they could never succeed and would stay pending),
--   - returns the claimant's email, the stall name and whether the claim was already approved, so the console
--     emails the claimant once, on the first approval only.
-- Approving again returns the same account and outlet. A stall that already has an outlet under
-- another account is refused with a clear message.
-- SECURITY INVOKER and service_role only: it is not reachable by the app or by guests.
-- Rollback: supabase/rollbacks/20261029160000_merchant_claim_approval.down.sql.

create or replace function public.approve_merchant_claim(p_claim_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_claim public.merchant_claim_interests%rowtype;
  v_venue public.venues%rowtype;
  v_building_type text;
  v_email text;
  v_account_id uuid;
  v_outlet_id uuid;
  v_created boolean := false;
  v_was_approved boolean;
  v_rejected integer := 0;
begin
  select * into v_claim
  from public.merchant_claim_interests c
  where c.id = p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if v_claim.claimed_by is null then
    raise exception 'this claim has no signed-in claimant' using errcode = '22023';
  end if;
  if v_claim.status = 'rejected' then
    raise exception 'this claim was rejected' using errcode = '22023';
  end if;

  v_was_approved := v_claim.status = 'converted';

  -- One approval per stall at a time.
  perform pg_advisory_xact_lock(hashtextextended('merchant_claim_venue:' || v_claim.venue_id, 0));

  select * into v_venue from public.venues v where v.id = v_claim.venue_id;
  if not found then
    raise exception 'the claimed stall no longer exists' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.merchant_outlets mo
    join public.merchant_accounts ma on ma.id = mo.merchant_account_id
    where mo.venue_id = v_claim.venue_id
      and ma.user_id <> v_claim.claimed_by
  ) then
    raise exception 'this stall already belongs to another merchant account' using errcode = '23505';
  end if;

  v_email := coalesce(
    nullif(trim(v_claim.contact_email::text), ''),
    (select nullif(trim(u.email), '') from auth.users u where u.id = v_claim.claimed_by)
  );
  if v_email is null then
    raise exception 'the claimant has no email address on file' using errcode = '22023';
  end if;

  insert into public.merchant_accounts (user_id, display_name, email)
  values (
    v_claim.claimed_by,
    coalesce(nullif(trim(v_claim.contact_name), ''), nullif(split_part(v_email, '@', 1), ''), v_venue.name),
    v_email
  )
  on conflict (user_id) do update set updated_at = now()
  returning id into v_account_id;

  insert into public.merchant_roles (merchant_account_id, user_id, role)
  values (v_account_id, v_claim.claimed_by, 'owner')
  on conflict (merchant_account_id, user_id) do nothing;

  select mo.id into v_outlet_id
  from public.merchant_outlets mo
  where mo.merchant_account_id = v_account_id
    and mo.venue_id = v_claim.venue_id;

  if v_outlet_id is null then
    select b.building_type into v_building_type
    from public.buildings b
    where b.id = v_venue.building_id;

    insert into public.merchant_outlets (
      merchant_account_id, venue_id, building_id, name, unit_number, floor, business_type, is_live
    )
    values (
      v_account_id,
      v_venue.id,
      v_venue.building_id,
      v_venue.name,
      v_venue.unit_number,
      v_venue.floor,
      case v_building_type
        when 'hawker_centre' then 'hawker_stall'
        when 'kopitiam' then 'hawker_stall'
        when 'food_court' then 'food_court_stall'
        when 'mall' then 'mall_tenant'
        when 'cafe' then 'cafe'
        else 'restaurant'
      end,
      false
    )
    returning id into v_outlet_id;
    v_created := true;
  end if;

  update public.merchant_claim_interests
  set status = 'converted', status_updated_at = now()
  where id = v_claim.id;

  -- The claimant's own duplicate claims on this stall are approved with it; other people's open
  -- claims can no longer succeed.
  update public.merchant_claim_interests
  set status = 'converted', status_updated_at = now()
  where venue_id = v_claim.venue_id
    and id <> v_claim.id
    and status in ('new', 'contacted', 'qualified')
    and claimed_by = v_claim.claimed_by;

  update public.merchant_claim_interests
  set status = 'rejected', status_updated_at = now()
  where venue_id = v_claim.venue_id
    and id <> v_claim.id
    and status in ('new', 'contacted', 'qualified')
    and claimed_by is distinct from v_claim.claimed_by;
  get diagnostics v_rejected = row_count;

  return jsonb_build_object(
    'claimId', v_claim.id,
    'merchantAccountId', v_account_id,
    'outletId', v_outlet_id,
    'venueId', v_claim.venue_id,
    'venueName', v_venue.name,
    'created', v_created,
    'alreadyApproved', v_was_approved,
    'rejectedOthers', v_rejected,
    'email', v_email
  );
end;
$$;

revoke all on function public.approve_merchant_claim(uuid) from public, anon, authenticated;
grant execute on function public.approve_merchant_claim(uuid) to service_role;

notify pgrst, 'reload schema';
