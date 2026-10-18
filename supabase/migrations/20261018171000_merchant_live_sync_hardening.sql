-- Merchant live sync hardening (follow-up to 20261018150000).
-- - Verification is checked against an outlet the caller manages, not any
--   outlet that happens to share the venue.
-- - Outlet -> venue sync only runs for the verified outlet being edited and
--   only accepts https websites.
-- - Merchants cannot re-point an outlet at another venue/building/account.
-- - The public owner card only shows verified outlets.

begin;

-- ---------------------------------------------------------------------------
-- 1. Verification is tied to the caller
-- ---------------------------------------------------------------------------

create or replace function public.merchant_venue_is_verified(p_venue_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_outlets mo
    join merchant_verifications mv on mv.outlet_id = mo.id
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = p_venue_id
      and mv.status = 'verified'
      and (mv.expires_at is null or mv.expires_at > now())
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  );
$$;

revoke all on function public.merchant_venue_is_verified(text) from public, anon;
grant execute on function public.merchant_venue_is_verified(text) to authenticated, service_role;

create or replace function public.merchant_outlet_is_verified(p_outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_verifications mv
    where mv.outlet_id = p_outlet_id
      and mv.status = 'verified'
      and (mv.expires_at is null or mv.expires_at > now())
  );
$$;

revoke all on function public.merchant_outlet_is_verified(uuid) from public, anon, authenticated;
grant execute on function public.merchant_outlet_is_verified(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Outlet links are set by ops, not merchants
-- ---------------------------------------------------------------------------

create or replace function public.enforce_merchant_outlet_link_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.venue_id is not null or new.building_id is not null then
      raise exception 'outlets are linked to a venue by Hungry ops' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.venue_id is distinct from old.venue_id
    or new.building_id is distinct from old.building_id
    or new.merchant_account_id is distinct from old.merchant_account_id then
    raise exception 'outlet venue links are managed by Hungry ops' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_merchant_outlet_link_guard on public.merchant_outlets;
create trigger trg_enforce_merchant_outlet_link_guard
before insert or update on public.merchant_outlets
for each row
execute function public.enforce_merchant_outlet_link_guard();

-- ---------------------------------------------------------------------------
-- 3. Sync only from the verified outlet being edited
-- ---------------------------------------------------------------------------

create or replace function public.sync_merchant_outlet_to_venue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closure text := nullif(trim(coalesce(new.temporary_closure, '')), '');
  v_website text;
begin
  if new.venue_id is null or not public.merchant_outlet_is_verified(new.id) then
    return new;
  end if;

  select nullif(trim(link ->> 'url'), '')
  into v_website
  from jsonb_array_elements(
    case when jsonb_typeof(new.social_links) = 'array' then new.social_links else '[]'::jsonb end
  ) link
  where lower(link ->> 'platform') = 'website'
  limit 1;

  if v_website is not null and v_website !~* '^https://[^/@[:space:]]+\.[^/@[:space:]]+' then
    v_website := null;
  end if;

  update venues v
  set
    closure_notice = case
      when new.temporary_closure is distinct from old.temporary_closure then v_closure
      else v.closure_notice
    end,
    is_open = case
      when new.temporary_closure is distinct from old.temporary_closure then v_closure is null
      else v.is_open
    end,
    contact_phone = case
      when new.contact_phone is distinct from old.contact_phone
        then nullif(trim(coalesce(new.contact_phone, '')), '')
      else v.contact_phone
    end,
    website_url = case
      when new.social_links is distinct from old.social_links then v_website
      else v.website_url
    end,
    cuisine_tags = case
      when new.cuisine_categories is distinct from old.cuisine_categories
        and cardinality(new.cuisine_categories) > 0 then new.cuisine_categories
      else v.cuisine_tags
    end,
    logo_url = case
      when new.profile_photo_url is distinct from old.profile_photo_url
        and nullif(trim(coalesce(new.profile_photo_url, '')), '') is not null
        then new.profile_photo_url
      else v.logo_url
    end
  where v.id = new.venue_id;

  return new;
end;
$$;

revoke all on function public.sync_merchant_outlet_to_venue() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Public owner card: verified outlets only
-- ---------------------------------------------------------------------------

create or replace function public.get_public_merchant_profile(p_venue_id text)
returns table (
  outlet_id uuid,
  description text,
  contact_phone text,
  contact_email text,
  social_links jsonb,
  cuisine_categories text[],
  profile_photo_url text,
  cover_photo_url text,
  temporary_closure text,
  is_verified boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mo.id,
    nullif(trim(mo.description), ''),
    nullif(trim(coalesce(mo.contact_phone, '')), ''),
    nullif(trim(coalesce(mo.contact_email, '')), ''),
    coalesce(mo.social_links, '[]'::jsonb),
    coalesce(mo.cuisine_categories, '{}'),
    mo.profile_photo_url,
    mo.cover_photo_url,
    nullif(trim(coalesce(mo.temporary_closure, '')), ''),
    true
  from merchant_outlets mo
  where mo.venue_id = p_venue_id
    and mo.is_live
    and public.merchant_outlet_is_verified(mo.id)
  order by mo.updated_at desc
  limit 1;
$$;

revoke all on function public.get_public_merchant_profile(text) from public;
grant execute on function public.get_public_merchant_profile(text) to anon, authenticated;

commit;
