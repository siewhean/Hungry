-- Merchant live sync: require the *writer* to be verified.
--
-- 20261018150000_merchant_live_sync auto-approved dish/photo writes whenever
-- ANY outlet linked to the venue was verified, and synced any outlet's
-- closure/phone/website onto venues. An unverified claimant linked to the
-- same venue could therefore publish unreviewed content once someone else was
-- verified. This migration:
--
-- 1. Adds merchant_venue_is_verified_for_current_user(): true only when
--    auth.uid() is the account owner or an owner/manager of a VERIFIED outlet
--    for the venue.
-- 2. Narrows merchant_can_manage_venue / merchant_outlet_matches_catalog_link:
--    once a venue has a verified outlet, only members of a verified outlet for
--    that venue keep write paths. Unverified claimants of unclaimed venues
--    keep their existing (hidden, unverified) write path.
-- 3. Switches the dish and dish-image write guards to the caller-scoped check.
-- 4. Syncs outlet profile fields onto venues only when that outlet is
--    verified.
-- 5. Makes merchant_outlets.venue_id linkage ops/service-only, so a verified
--    outlet cannot be re-pointed at another venue and a new outlet cannot
--    self-link to a venue.
-- 6. get_public_merchant_profile returns only a verified, live outlet.
--
-- service_role, postgres/supabase_admin and ops admins keep their existing
-- bypasses.

begin;

-- ---------------------------------------------------------------------------
-- 1. Caller-scoped verification helper
-- ---------------------------------------------------------------------------

create or replace function public.merchant_venue_is_verified_for_current_user(p_venue_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_venue_id is not null
    and exists (
      select 1
      from public.merchant_outlets mo
      join public.merchant_verifications mv on mv.outlet_id = mo.id
      where mo.venue_id = p_venue_id
        and mv.status = 'verified'
        and (mv.expires_at is null or mv.expires_at > now())
        and (
          exists (
            select 1
            from public.merchant_accounts ma
            where ma.id = mo.merchant_account_id
              and ma.user_id = auth.uid()
          )
          or exists (
            select 1
            from public.merchant_roles mr
            where mr.merchant_account_id = mo.merchant_account_id
              and mr.user_id = auth.uid()
              and mr.role in ('owner', 'manager')
          )
        )
    );
$$;

revoke all on function public.merchant_venue_is_verified_for_current_user(text) from public, anon;
grant execute on function public.merchant_venue_is_verified_for_current_user(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Write-path helpers: verified venues are managed by verified members only
-- ---------------------------------------------------------------------------

-- plpgsql so the auth.uid() short-circuit runs before the security definer
-- helpers (anon has no execute on them).
create or replace function public.merchant_can_manage_venue(p_venue_id text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or p_venue_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.merchant_outlets mo
    left join public.merchant_accounts ma on ma.id = mo.merchant_account_id
    left join public.merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = p_venue_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  ) then
    return false;
  end if;

  return not public.merchant_venue_is_verified(p_venue_id)
    or public.merchant_venue_is_verified_for_current_user(p_venue_id);
end;
$$;

create or replace function public.merchant_outlet_matches_catalog_link(p_venue_id text, p_building_id text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or p_venue_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.merchant_outlets mo
    left join public.merchant_accounts ma on ma.id = mo.merchant_account_id
    left join public.merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = p_venue_id
      and mo.building_id = p_building_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  ) then
    return false;
  end if;

  return not public.merchant_venue_is_verified(p_venue_id)
    or public.merchant_venue_is_verified_for_current_user(p_venue_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Dish / dish image guards: auto-approve only for the verified writer
-- ---------------------------------------------------------------------------

create or replace function public.enforce_merchant_dish_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_image_changed boolean;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish insert must match a managed merchant outlet' using errcode = '42501';
    end if;

    if new.distance_meters is distinct from 0
      or new.rating_avg is distinct from 0
      or new.review_count is distinct from 0
      or new.live_crowd is not null then
      raise exception 'merchant dish inserts cannot set aggregate or live fields' using errcode = '42501';
    end if;

    if new.media_approved_for_display is distinct from false
      or new.media_rights_status is distinct from 'unverified'
      or new.media_source_url is not null
      or new.media_verified_at is not null
      or new.media_verified_by is not null
      or new.menu_approved_for_display is distinct from false
      or new.menu_rights_status is distinct from 'unverified'
      or new.menu_source_url is not null
      or new.menu_verified_at is not null
      or new.menu_verified_by is not null then
      raise exception 'merchant dish inserts cannot set provenance fields' using errcode = '42501';
    end if;

    v_image_changed := nullif(trim(coalesce(new.image_url, '')), '') is not null;
  else
    if not merchant_can_manage_venue(old.venue_id) then
      raise exception 'not authorized to update dish' using errcode = '42501';
    end if;

    if new.id is distinct from old.id
      or new.venue_id is distinct from old.venue_id
      or new.distance_meters is distinct from old.distance_meters
      or new.rating_avg is distinct from old.rating_avg
      or new.review_count is distinct from old.review_count
      or new.live_crowd is distinct from old.live_crowd
      or new.media_approved_for_display is distinct from old.media_approved_for_display
      or new.media_rights_status is distinct from old.media_rights_status
      or new.media_source_url is distinct from old.media_source_url
      or new.media_verified_at is distinct from old.media_verified_at
      or new.media_verified_by is distinct from old.media_verified_by
      or new.menu_approved_for_display is distinct from old.menu_approved_for_display
      or new.menu_rights_status is distinct from old.menu_rights_status
      or new.menu_source_url is distinct from old.menu_source_url
      or new.menu_verified_at is distinct from old.menu_verified_at
      or new.menu_verified_by is distinct from old.menu_verified_by
      or new.created_at is distinct from old.created_at then
      raise exception 'merchant dish updates cannot change identity, aggregate, live, or provenance fields' using errcode = '42501';
    end if;

    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish building must match a managed merchant outlet' using errcode = '42501';
    end if;

    v_image_changed := new.image_url is distinct from old.image_url;
  end if;

  -- Auto-approval depends on the writer, not on whether some other outlet for
  -- this venue happens to be verified.
  if public.merchant_venue_is_verified_for_current_user(new.venue_id) then
    -- A verified merchant is the source of its own menu. Ops rejections stick.
    if new.menu_rights_status is distinct from 'rejected' then
      new.menu_rights_status := 'merchant_owned';
      new.menu_approved_for_display := true;
      new.menu_source_url := null;
      new.menu_verified_at := now();
      new.menu_verified_by := auth.uid();
    end if;
    -- Only a photo the merchant just supplied becomes merchant_owned; an
    -- untouched imported photo keeps its original rights.
    if v_image_changed and nullif(trim(coalesce(new.image_url, '')), '') is not null then
      new.media_rights_status := 'merchant_owned';
      new.media_approved_for_display := true;
      new.media_source_url := null;
      new.media_verified_at := now();
      new.media_verified_by := auth.uid();
    end if;
  elsif v_image_changed then
    -- A new photo from an unverified merchant never inherits old approval.
    new.media_rights_status := 'unverified';
    new.media_approved_for_display := false;
    new.media_source_url := null;
    new.media_verified_at := null;
    new.media_verified_by := null;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_merchant_dish_image_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id text;
begin
  if auth.role() = 'service_role' or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if public.app_is_current_user_ops_admin() then
    return new;
  end if;

  select d.venue_id
  into v_venue_id
  from dishes d
  where d.id = new.dish_id;

  if v_venue_id is null or not merchant_can_manage_venue(v_venue_id) then
    raise exception 'not authorized to update dish image' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.media_approved_for_display is distinct from false
      or new.media_rights_status is distinct from 'unverified'
      or new.media_source_url is not null
      or new.media_verified_at is not null
      or new.media_verified_by is not null then
      raise exception 'merchant dish image inserts cannot set provenance fields' using errcode = '42501';
    end if;
  else
    if new.media_approved_for_display is distinct from old.media_approved_for_display
      or new.media_rights_status is distinct from old.media_rights_status
      or new.media_source_url is distinct from old.media_source_url
      or new.media_verified_at is distinct from old.media_verified_at
      or new.media_verified_by is distinct from old.media_verified_by then
      raise exception 'merchant dish image updates cannot change provenance fields' using errcode = '42501';
    end if;
    if new.url is not distinct from old.url then
      return new;
    end if;
  end if;

  if public.merchant_venue_is_verified_for_current_user(v_venue_id) then
    new.media_rights_status := 'merchant_owned';
    new.media_approved_for_display := true;
    new.media_source_url := null;
    new.media_verified_at := now();
    new.media_verified_by := auth.uid();
  else
    new.media_rights_status := 'unverified';
    new.media_approved_for_display := false;
    new.media_source_url := null;
    new.media_verified_at := null;
    new.media_verified_by := null;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Outlet -> venue sync only for verified outlets
-- ---------------------------------------------------------------------------

create or replace function public.sync_merchant_outlet_to_venue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closure text := nullif(trim(coalesce(new.temporary_closure, '')), '');
  v_website text;
begin
  if new.venue_id is null then
    return new;
  end if;

  -- Only the verified outlet itself may change what diners see on the venue.
  -- Unverified claims keep their edits on merchant_outlets until verified.
  if not exists (
    select 1
    from public.merchant_verifications mv
    where mv.outlet_id = new.id
      and mv.status = 'verified'
      and (mv.expires_at is null or mv.expires_at > now())
  ) then
    return new;
  end if;

  select nullif(trim(link ->> 'url'), '')
  into v_website
  from jsonb_array_elements(
    case when jsonb_typeof(new.social_links) = 'array' then new.social_links else '[]'::jsonb end
  ) link
  where lower(link ->> 'platform') = 'website'
  limit 1;

  update public.venues v
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
-- 5. Venue linkage on merchant_outlets is ops/service-only
-- ---------------------------------------------------------------------------

create or replace function public.enforce_merchant_outlet_venue_link_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
    or auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.venue_id is not null then
      raise exception 'merchant outlets are linked to venues by ops only' using errcode = '42501';
    end if;
  elsif new.venue_id is distinct from old.venue_id then
    raise exception 'merchant outlet venue linkage is ops-only' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_merchant_outlet_venue_link_guard() from public, anon, authenticated;

drop trigger if exists trg_enforce_merchant_outlet_venue_link_guard on public.merchant_outlets;
create trigger trg_enforce_merchant_outlet_venue_link_guard
before insert or update on public.merchant_outlets
for each row
execute function public.enforce_merchant_outlet_venue_link_guard();

-- ---------------------------------------------------------------------------
-- 6. Public merchant profile: verified outlets only
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
set search_path = ''
as $$
  -- Unverified claims expose nothing: contact details and links are only
  -- published once ops has verified the outlet.
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
  from public.merchant_outlets mo
  join public.merchant_verifications mv on mv.outlet_id = mo.id
  where mo.venue_id = p_venue_id
    and mo.is_live
    and mv.status = 'verified'
    and (mv.expires_at is null or mv.expires_at > now())
  order by mv.verified_at desc nulls last, mo.updated_at desc
  limit 1;
$$;

revoke all on function public.get_public_merchant_profile(text) from public;
grant execute on function public.get_public_merchant_profile(text) to anon, authenticated, service_role;

commit;
