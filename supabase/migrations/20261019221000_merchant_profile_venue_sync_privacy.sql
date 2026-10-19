-- Merchant profile -> venue sync covers name, hours, unit and floor, and
-- home-based outlets never publish an exact location (page review H3, H7).
--
-- Before this, the app wrote name/hours/unit/floor straight onto venues from
-- the client (for verified and unverified outlets alike, ignoring location
-- privacy), while the DB sync trigger copied only closure, phone, website,
-- cuisine and logo.
--
-- 1. A home-based outlet cannot hold 'exact' location privacy (coerced to
--    'approximate'); existing rows are backfilled.
-- 2. The verified-outlet sync trigger now also copies name, operating hours,
--    unit and floor. For a home-based outlet it clears the venue's unit,
--    floor and exact pin (diners see the building area only), and for
--    'hidden' also the street address and postal code.
-- 3. Merchants can no longer write those venue columns directly, so the
--    verification and privacy rules above cannot be bypassed.
-- 4. The sync body moves to app_private (definer); the old public definer
--    trigger function is dropped.

begin;

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- 1. Home-based outlets are never 'exact'
-- ---------------------------------------------------------------------------

create or replace function app_private.coerce_home_based_location_privacy()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if new.business_type = 'home_based' and new.location_privacy = 'exact' then
    new.location_privacy := 'approximate';
  end if;
  return new;
end;
$$;

revoke all on function app_private.coerce_home_based_location_privacy() from public, anon, authenticated;

drop trigger if exists trg_coerce_home_based_location_privacy on public.merchant_outlets;
create trigger trg_coerce_home_based_location_privacy
before insert or update on public.merchant_outlets
for each row
execute function app_private.coerce_home_based_location_privacy();

-- ---------------------------------------------------------------------------
-- 2. Verified outlet -> venue sync
-- ---------------------------------------------------------------------------

create or replace function app_private.sync_merchant_outlet_to_venue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_closure text := nullif(trim(coalesce(new.temporary_closure, '')), '');
  v_name text := nullif(trim(coalesce(new.name, '')), '');
  v_home_based boolean := new.business_type = 'home_based';
  v_hidden boolean := new.business_type = 'home_based' and new.location_privacy = 'hidden';
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

  update public.venues v
  set
    name = case
      when new.name is distinct from old.name and v_name is not null then v_name
      else v.name
    end,
    operating_hours = case
      when new.operating_hours is distinct from old.operating_hours
        then trim(coalesce(new.operating_hours, ''))
      else v.operating_hours
    end,
    unit_number = case
      when v_home_based then ''
      when new.unit_number is distinct from old.unit_number
        then trim(coalesce(new.unit_number, ''))
      else v.unit_number
    end,
    floor = case
      when v_home_based then ''
      when new.floor is distinct from old.floor then trim(coalesce(new.floor, ''))
      else v.floor
    end,
    latitude = case when v_home_based then null else v.latitude end,
    longitude = case when v_home_based then null else v.longitude end,
    address = case when v_hidden then null else v.address end,
    postal_code = case when v_hidden then null else v.postal_code end,
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

revoke all on function app_private.sync_merchant_outlet_to_venue() from public, anon, authenticated;

drop trigger if exists trg_sync_merchant_outlet_to_venue on public.merchant_outlets;
create trigger trg_sync_merchant_outlet_to_venue
after update on public.merchant_outlets
for each row
execute function app_private.sync_merchant_outlet_to_venue();

drop function if exists public.sync_merchant_outlet_to_venue();

-- ---------------------------------------------------------------------------
-- 3. Merchants do not write synced venue columns directly
-- ---------------------------------------------------------------------------

create or replace function public.enforce_merchant_venue_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

  if not merchant_can_manage_venue(old.id) then
    raise exception 'not authorized to update venue' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.hygiene_grade is distinct from old.hygiene_grade
    or new.is_open is distinct from old.is_open
    or new.top_dish_id is distinct from old.top_dish_id
    or new.closure_notice is distinct from old.closure_notice
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
    raise exception 'merchant venue updates are limited to profile fields' using errcode = '42501';
  end if;

  -- Synced from the verified merchant profile (with location privacy applied).
  if new.name is distinct from old.name
    or new.building_id is distinct from old.building_id
    or new.unit_number is distinct from old.unit_number
    or new.floor is distinct from old.floor
    or new.operating_hours is distinct from old.operating_hours
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.address is distinct from old.address
    or new.postal_code is distinct from old.postal_code then
    raise exception 'update the merchant profile instead; it syncs to the stall page'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Backfill: home-based outlets saved as 'exact'
-- ---------------------------------------------------------------------------

update public.merchant_outlets
set location_privacy = 'approximate'
where business_type = 'home_based'
  and location_privacy = 'exact';

-- Venues already linked to a verified home-based outlet drop their exact
-- location now, not on the merchant's next save.
do $$
declare
  v_venue_id text;
begin
  for v_venue_id in
    update public.venues v
    set
      unit_number = '',
      floor = '',
      latitude = null,
      longitude = null,
      address = case when mo.location_privacy = 'hidden' then null else v.address end,
      postal_code = case when mo.location_privacy = 'hidden' then null else v.postal_code end
    from public.merchant_outlets mo
    where mo.venue_id = v.id
      and mo.business_type = 'home_based'
      and public.merchant_outlet_is_verified(mo.id)
    returning v.id
  loop
    perform public.catalog_raw_refresh_venue(v_venue_id);
  end loop;
end $$;

commit;
