-- Merchant outlet rows are private to the outlet's own team (page review H1),
-- and scheduled promotions go live when their window opens (page review H9).
--
-- Before this, anon and every signed-in user could select every column of
-- every live outlet (contact email/phone, unit, floor, building, account id,
-- location privacy). Diners never read merchant_outlets directly: the stall
-- page uses get_public_merchant_profile() and the promotion RPC below, both
-- of which return only public fields.
--
-- 1. merchant_outlets SELECT is owner/team only. anon loses all table access.
-- 2. Promotion read policies check "outlet is live" through a definer helper
--    instead of a subquery that needs outlet row access.
-- 3. list_customer_active_promotions keeps its public SECURITY INVOKER
--    signature; the body moves to app_private and accepts 'scheduled' rows
--    whose window has started (nothing flips them to 'active').

begin;

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Outlet rows: members only
-- ---------------------------------------------------------------------------

drop policy if exists "merchant_outlets_anon_live_select" on public.merchant_outlets;
drop policy if exists "merchant_outlets_public_live_select" on public.merchant_outlets;
drop policy if exists "merchant_outlets_authenticated_select" on public.merchant_outlets;
drop policy if exists "merchant_outlets_member_select" on public.merchant_outlets;

create policy "merchant_outlets_member_select"
on public.merchant_outlets for select to authenticated
using (
  exists (
    select 1
    from public.merchant_accounts ma
    where ma.id = merchant_outlets.merchant_account_id
      and ma.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.merchant_roles mr
    where mr.merchant_account_id = merchant_outlets.merchant_account_id
      and mr.user_id = (select auth.uid())
  )
);

revoke all on table public.merchant_outlets from anon;
revoke select (id, venue_id, is_live) on table public.merchant_outlets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Promotion visibility without outlet row access
-- ---------------------------------------------------------------------------

create or replace function app_private.merchant_outlet_is_live(p_outlet_id uuid)
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
  );
$$;

revoke all on function app_private.merchant_outlet_is_live(uuid) from public;
grant execute on function app_private.merchant_outlet_is_live(uuid)
  to anon, authenticated, service_role;

drop policy if exists "merchant_promotions_anon_active_select" on public.merchant_promotions;
create policy "merchant_promotions_anon_active_select"
on public.merchant_promotions for select to anon
using (
  status in ('active', 'scheduled')
  and coalesce(is_available, true) = true
  and now() >= start_date
  and now() <= end_date
  and app_private.merchant_outlet_is_live(outlet_id)
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
    and app_private.merchant_outlet_is_live(outlet_id)
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

-- ---------------------------------------------------------------------------
-- 3. Diner promotion RPC
-- ---------------------------------------------------------------------------

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

create or replace function public.list_customer_active_promotions(
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
security invoker
set search_path = public, pg_catalog
as $$
  select * from app_private.list_customer_active_promotions(p_venue_id, p_dish_id);
$$;

revoke all on function public.list_customer_active_promotions(text, text) from public;
grant execute on function public.list_customer_active_promotions(text, text)
  to anon, authenticated, service_role;

commit;
