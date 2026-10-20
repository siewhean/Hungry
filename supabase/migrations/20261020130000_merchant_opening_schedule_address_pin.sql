-- Structured opening hours and a real address/map pin for merchant outlets
-- (medium/low decisions 25 and 29).
--
-- 1. merchant_outlets.opening_schedule and venues.opening_schedule hold a fixed
--    weekly schedule plus special hours by date:
--      {"weekly": {"mon": [{"open": "10:00", "close": "14:00"}, ...], ...},
--       "special": [{"date": "2026-12-25", "ranges": []}]}
--    Times are 24-hour Singapore clock times; "24:00" closes at midnight and a
--    close before open runs past midnight; an empty or missing day is closed.
--    The app computes "Open now" from it in Asia/Singapore time. The existing
--    venues.operating_hours text stays as the readable line (the app derives
--    it from the schedule), so enriched venues without a schedule keep working.
-- 2. merchant_outlets gains address, postal_code, latitude and longitude, filled
--    from the OneMap postal-code lookup and map pin in the app.
-- 3. The verified-outlet -> venue sync copies the schedule, address, postal
--    code and pin. Location privacy still applies: home-based outlets never
--    publish a pin, unit or floor; 'hidden' also drops address and postal code.
-- 4. Merchants still cannot write these venue columns directly.

begin;

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- 1. Schedule shape check
-- ---------------------------------------------------------------------------

create or replace function app_private.opening_range_is_valid(p_range jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(p_range) = 'object'
    and coalesce(p_range ->> 'open', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and coalesce(p_range ->> 'close', '') ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$';
$$;

create or replace function app_private.opening_ranges_are_valid(p_ranges jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_range jsonb;
begin
  if jsonb_typeof(p_ranges) is distinct from 'array' or jsonb_array_length(p_ranges) > 3 then
    return false;
  end if;
  for v_range in select value from jsonb_array_elements(p_ranges) loop
    if not app_private.opening_range_is_valid(v_range) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function app_private.opening_schedule_is_valid(p_schedule jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_day record;
  v_special jsonb;
  v_dates text[] := '{}';
begin
  if p_schedule is null then
    return true;
  end if;
  if jsonb_typeof(p_schedule) <> 'object' or jsonb_typeof(p_schedule -> 'weekly') is distinct from 'object' then
    return false;
  end if;

  for v_day in select key, value from jsonb_each(p_schedule -> 'weekly') loop
    if v_day.key not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
      or not app_private.opening_ranges_are_valid(v_day.value) then
      return false;
    end if;
  end loop;

  if p_schedule ? 'special' then
    if jsonb_typeof(p_schedule -> 'special') <> 'array'
      or jsonb_array_length(p_schedule -> 'special') > 60 then
      return false;
    end if;
    for v_special in select value from jsonb_array_elements(p_schedule -> 'special') loop
      if jsonb_typeof(v_special) <> 'object'
        or coalesce(v_special ->> 'date', '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
        or (v_special ->> 'date') = any(v_dates)
        or not app_private.opening_ranges_are_valid(v_special -> 'ranges') then
        return false;
      end if;
      v_dates := v_dates || (v_special ->> 'date');
    end loop;
  end if;

  return true;
end;
$$;

-- Called by CHECK constraints on rows merchants (authenticated) and ops write.
revoke all on function app_private.opening_range_is_valid(jsonb) from public, anon;
revoke all on function app_private.opening_ranges_are_valid(jsonb) from public, anon;
revoke all on function app_private.opening_schedule_is_valid(jsonb) from public, anon;
grant execute on function app_private.opening_range_is_valid(jsonb) to authenticated, service_role;
grant execute on function app_private.opening_ranges_are_valid(jsonb) to authenticated, service_role;
grant execute on function app_private.opening_schedule_is_valid(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Columns
-- ---------------------------------------------------------------------------

alter table public.merchant_outlets
  add column if not exists opening_schedule jsonb,
  add column if not exists address text,
  add column if not exists postal_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.venues
  add column if not exists opening_schedule jsonb;

alter table public.merchant_outlets
  drop constraint if exists merchant_outlets_opening_schedule_valid,
  add constraint merchant_outlets_opening_schedule_valid
    check (app_private.opening_schedule_is_valid(opening_schedule)),
  drop constraint if exists merchant_outlets_postal_code_format,
  add constraint merchant_outlets_postal_code_format
    check (postal_code is null or postal_code ~ '^[0-9]{6}$'),
  drop constraint if exists merchant_outlets_pin_in_singapore,
  add constraint merchant_outlets_pin_in_singapore
    check (
      (latitude is null and longitude is null)
      or (latitude between 1.1 and 1.5 and longitude between 103.5 and 104.1)
    );

alter table public.venues
  drop constraint if exists venues_opening_schedule_valid,
  add constraint venues_opening_schedule_valid
    check (app_private.opening_schedule_is_valid(opening_schedule));

-- ---------------------------------------------------------------------------
-- 3. Verified outlet -> venue sync (adds schedule, address, postal code, pin)
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
  v_address text := nullif(trim(coalesce(new.address, '')), '');
  v_postal text := nullif(trim(coalesce(new.postal_code, '')), '');
  v_home_based boolean := new.business_type = 'home_based';
  v_hidden boolean := new.business_type = 'home_based' and new.location_privacy = 'hidden';
  v_pin_changed boolean := (new.latitude, new.longitude) is distinct from (old.latitude, old.longitude)
    and new.latitude is not null and new.longitude is not null;
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
    opening_schedule = case
      when new.opening_schedule is distinct from old.opening_schedule then new.opening_schedule
      else v.opening_schedule
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
    latitude = case
      when v_home_based then null
      when v_pin_changed then new.latitude
      else v.latitude
    end,
    longitude = case
      when v_home_based then null
      when v_pin_changed then new.longitude
      else v.longitude
    end,
    address = case
      when v_hidden then null
      when new.address is distinct from old.address and v_address is not null then v_address
      else v.address
    end,
    postal_code = case
      when v_hidden then null
      when new.postal_code is distinct from old.postal_code and v_postal is not null then v_postal
      else v.postal_code
    end,
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

-- ---------------------------------------------------------------------------
-- 4. Merchants do not write synced venue columns directly
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
    or new.opening_schedule is distinct from old.opening_schedule
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

commit;
