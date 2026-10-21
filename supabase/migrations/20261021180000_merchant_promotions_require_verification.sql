-- Promotions reach diners only from verified outlets (round-two review H46).
--
-- Before this, any owner/manager linked to an outlet could insert or update a
-- promotion with status 'active' and set merchant_outlets.is_live, and diners
-- saw it. Only the app's VERIFIED_ONLY_SCREENS gate stopped unverified
-- merchants. Verification is outlet-specific, so the checks use the
-- promotion's own outlet.
--
-- 1. A merchant cannot save a promotion as 'active' or 'scheduled' unless the
--    outlet has a current verification. Drafts and ended promotions are still
--    allowed, so a merchant whose verification lapsed can end an offer.
-- 2. The diner read policies and app_private.list_customer_active_promotions
--    also require the outlet to be verified, so a promotion from an outlet
--    whose verification lapsed or was revoked stops showing.
-- is_live stays merchant-writable: it is the merchant's own online toggle and
-- unverified merchants set it while setting up. It no longer publishes
-- anything on its own.

begin;

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- 1. Writes: publishing needs a verified outlet
-- ---------------------------------------------------------------------------

-- True when the caller is an owner/manager of the outlet and the outlet has a
-- current verification. Definer so it can read merchant_verifications; it
-- answers only for the caller's own outlets.
create or replace function app_private.merchant_outlet_is_verified_for_caller(p_outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.merchant_outlets mo
    left join public.merchant_accounts ma on ma.id = mo.merchant_account_id
    left join public.merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = p_outlet_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
  and public.merchant_outlet_is_verified(p_outlet_id);
$$;

revoke all on function app_private.merchant_outlet_is_verified_for_caller(uuid) from public, anon;
grant execute on function app_private.merchant_outlet_is_verified_for_caller(uuid)
  to authenticated, service_role;

create or replace function app_private.enforce_merchant_promotion_verified()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  -- Definer functions (analytics counters) and service jobs.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if new.status in ('active', 'scheduled')
    and not app_private.merchant_outlet_is_verified_for_caller(new.outlet_id) then
    raise exception 'verify this outlet before publishing promotions' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_merchant_promotion_verified() from public, anon;

drop trigger if exists trg_enforce_merchant_promotion_verified on public.merchant_promotions;
create trigger trg_enforce_merchant_promotion_verified
before insert or update on public.merchant_promotions
for each row
execute function app_private.enforce_merchant_promotion_verified();

-- ---------------------------------------------------------------------------
-- 2. Reads: only live, verified outlets show promotions
-- ---------------------------------------------------------------------------

create or replace function app_private.merchant_outlet_shows_promotions(p_outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.merchant_outlets mo
    where mo.id = p_outlet_id
      and mo.is_live
  )
  and public.merchant_outlet_is_verified(p_outlet_id);
$$;

revoke all on function app_private.merchant_outlet_shows_promotions(uuid) from public;
grant execute on function app_private.merchant_outlet_shows_promotions(uuid)
  to anon, authenticated, service_role;

drop policy if exists "merchant_promotions_anon_active_select" on public.merchant_promotions;
create policy "merchant_promotions_anon_active_select"
on public.merchant_promotions for select to anon
using (
  status in ('active', 'scheduled')
  and coalesce(is_available, true) = true
  and now() >= start_date
  and now() <= end_date
  and app_private.merchant_outlet_shows_promotions(outlet_id)
);

drop policy if exists "merchant_promotions_authenticated_select" on public.merchant_promotions;
create policy "merchant_promotions_authenticated_select"
on public.merchant_promotions for select to authenticated
using (
  (
    status in ('active', 'scheduled')
    and coalesce(is_available, true) = true
    and now() >= start_date
    and now() <= end_date
    and app_private.merchant_outlet_shows_promotions(outlet_id)
  )
  or exists (
    select 1
    from public.merchant_outlets mo
    left join public.merchant_accounts ma on ma.id = mo.merchant_account_id
    left join public.merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = merchant_promotions.outlet_id
      and (ma.user_id = (select auth.uid()) or mr.user_id = (select auth.uid()))
  )
);

-- Based on 20261019220000_merchant_outlet_member_only_reads.sql; adds the
-- verification check. The public SECURITY INVOKER wrapper is unchanged.
create or replace function app_private.list_customer_active_promotions(
  p_venue_id text,
  p_dish_id text default null
)
returns table (
  id uuid,
  outlet_id uuid,
  title text,
  description text,
  target_dish_id text,
  promotion_item_type text,
  start_date timestamptz,
  end_date timestamptz,
  original_price numeric,
  promotional_price numeric,
  final_price numeric,
  discount_percentage numeric,
  is_available boolean,
  target_audience text[],
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    mp.id,
    mp.outlet_id,
    mp.title,
    mp.description,
    mp.target_dish_id,
    mp.promotion_item_type,
    mp.start_date,
    mp.end_date,
    mp.original_price,
    mp.promotional_price,
    mp.final_price,
    mp.discount_percentage,
    mp.is_available,
    mp.target_audience,
    -- A scheduled promotion inside its window is running for diners.
    'active'::text,
    mp.created_at
  from public.merchant_promotions mp
  join public.merchant_outlets mo on mo.id = mp.outlet_id
  where mo.venue_id = p_venue_id
    and mo.is_live = true
    and public.merchant_outlet_is_verified(mo.id)
    and mp.status in ('active', 'scheduled')
    and coalesce(mp.is_available, true) = true
    and now() >= mp.start_date
    and now() <= mp.end_date
    and (
      mp.target_dish_id is null
      or nullif(p_dish_id, '') is null
      or mp.target_dish_id = p_dish_id
    )
  order by
    case when mp.target_dish_id is not null then 0 else 1 end,
    mp.created_at desc;
$$;

revoke all on function app_private.list_customer_active_promotions(text, text) from public;
grant execute on function app_private.list_customer_active_promotions(text, text)
  to anon, authenticated, service_role;

commit;
