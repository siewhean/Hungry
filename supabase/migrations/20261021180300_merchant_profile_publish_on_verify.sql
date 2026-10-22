-- Profile edits saved while verification is pending go live on approval
-- (round-two review H49).
--
-- The outlet -> venue sync returns early for unverified outlets and copies
-- only the columns changed by the current UPDATE, and the publish-on-verify
-- trigger published only dishes. So a profile edited while pending stayed off
-- the stall page after verification until the merchant edited each field
-- again, although the app says diners see it "once Hungry verifies your
-- stall".
--
-- Decision: pending profile edits are kept and applied automatically when the
-- outlet's verification is approved.
--
-- 1. app_private.sync_merchant_outlet_to_venue_full(outlet) copies the whole
--    outlet profile onto its venue with the same rules as the diff sync
--    (verified outlets only, https websites only, home-based location privacy).
--    Blank outlet fields keep the venue's existing value, so enriched data the
--    merchant never filled in is not wiped.
-- 2. publish_merchant_menu_drafts_on_verify (latest:
--    20261020130100_merchant_unverified_menu_drafts.sql) runs that full sync
--    first, then publishes drafts as before, and refreshes the catalog even
--    when there are no drafts.

begin;

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- 1. Full (non-diff) outlet -> venue sync
-- ---------------------------------------------------------------------------

create or replace function app_private.sync_merchant_outlet_to_venue_full(p_outlet_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  o public.merchant_outlets;
  v_closure text;
  v_name text;
  v_hours text;
  v_unit text;
  v_floor text;
  v_address text;
  v_postal text;
  v_phone text;
  v_logo text;
  v_home_based boolean;
  v_hidden boolean;
  v_has_pin boolean;
  v_website text;
begin
  select * into o from public.merchant_outlets mo where mo.id = p_outlet_id;

  if o.id is null or o.venue_id is null or not public.merchant_outlet_is_verified(o.id) then
    return null;
  end if;

  v_closure := nullif(trim(coalesce(o.temporary_closure, '')), '');
  v_name := nullif(trim(coalesce(o.name, '')), '');
  v_hours := nullif(trim(coalesce(o.operating_hours, '')), '');
  v_unit := nullif(trim(coalesce(o.unit_number, '')), '');
  v_floor := nullif(trim(coalesce(o.floor, '')), '');
  v_address := nullif(trim(coalesce(o.address, '')), '');
  v_postal := nullif(trim(coalesce(o.postal_code, '')), '');
  v_phone := nullif(trim(coalesce(o.contact_phone, '')), '');
  v_logo := nullif(trim(coalesce(o.profile_photo_url, '')), '');
  v_home_based := o.business_type = 'home_based';
  v_hidden := o.business_type = 'home_based' and o.location_privacy = 'hidden';
  v_has_pin := o.latitude is not null and o.longitude is not null;

  select nullif(trim(link ->> 'url'), '')
  into v_website
  from jsonb_array_elements(
    case when jsonb_typeof(o.social_links) = 'array' then o.social_links else '[]'::jsonb end
  ) link
  where lower(link ->> 'platform') = 'website'
  limit 1;

  if v_website is not null and v_website !~* '^https://[^/@[:space:]]+\.[^/@[:space:]]+' then
    v_website := null;
  end if;

  update public.venues v
  set
    name = coalesce(v_name, v.name),
    operating_hours = coalesce(v_hours, v.operating_hours),
    opening_schedule = coalesce(o.opening_schedule, v.opening_schedule),
    unit_number = case when v_home_based then '' else coalesce(v_unit, v.unit_number) end,
    floor = case when v_home_based then '' else coalesce(v_floor, v.floor) end,
    latitude = case
      when v_home_based then null
      when v_has_pin then o.latitude
      else v.latitude
    end,
    longitude = case
      when v_home_based then null
      when v_has_pin then o.longitude
      else v.longitude
    end,
    address = case when v_hidden then null else coalesce(v_address, v.address) end,
    postal_code = case when v_hidden then null else coalesce(v_postal, v.postal_code) end,
    closure_notice = case when v_closure is not null then v_closure else v.closure_notice end,
    is_open = case when v_closure is not null then false else v.is_open end,
    contact_phone = coalesce(v_phone, v.contact_phone),
    website_url = coalesce(v_website, v.website_url),
    cuisine_tags = case
      when cardinality(o.cuisine_categories) > 0 then o.cuisine_categories
      else v.cuisine_tags
    end,
    logo_url = coalesce(v_logo, v.logo_url)
  where v.id = o.venue_id;

  return o.venue_id;
end;
$$;

revoke all on function app_private.sync_merchant_outlet_to_venue_full(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Verification publishes the profile and the drafts
-- ---------------------------------------------------------------------------

create or replace function app_private.publish_merchant_menu_drafts_on_verify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_venue_id text;
begin
  if new.status <> 'verified'
    or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  select mo.venue_id into v_venue_id
  from public.merchant_outlets mo
  where mo.id = new.outlet_id;

  if v_venue_id is null then
    return new;
  end if;

  -- Profile edits saved while verification was pending.
  perform app_private.sync_merchant_outlet_to_venue_full(new.outlet_id);

  if exists (select 1 from public.dishes d where d.venue_id = v_venue_id and d.merchant_draft) then
    update public.dish_images di
    set
      media_rights_status = 'merchant_owned',
      media_approved_for_display = true,
      media_source_url = null,
      media_verified_at = now(),
      media_verified_by = auth.uid()
    from public.dishes d
    where d.id = di.dish_id
      and d.venue_id = v_venue_id
      and d.merchant_draft
      and di.media_rights_status = 'unverified';

    update public.dishes d
    set
      merchant_draft = false,
      menu_approved_for_display = case
        when d.menu_rights_status = 'rejected' then d.menu_approved_for_display else true end,
      menu_rights_status = case
        when d.menu_rights_status = 'rejected' then d.menu_rights_status else 'merchant_owned' end,
      menu_source_url = case when d.menu_rights_status = 'rejected' then d.menu_source_url else null end,
      menu_verified_at = case when d.menu_rights_status = 'rejected' then d.menu_verified_at else now() end,
      menu_verified_by = case when d.menu_rights_status = 'rejected' then d.menu_verified_by else auth.uid() end,
      media_approved_for_display = case
        when d.media_rights_status = 'unverified' and nullif(trim(coalesce(d.image_url, '')), '') is not null
          then true else d.media_approved_for_display end,
      media_rights_status = case
        when d.media_rights_status = 'unverified' and nullif(trim(coalesce(d.image_url, '')), '') is not null
          then 'merchant_owned' else d.media_rights_status end,
      media_verified_at = case
        when d.media_rights_status = 'unverified' and nullif(trim(coalesce(d.image_url, '')), '') is not null
          then now() else d.media_verified_at end
    where d.venue_id = v_venue_id
      and d.merchant_draft;
  end if;

  perform public.catalog_raw_refresh_venue(v_venue_id);
  return new;
end;
$$;

revoke all on function app_private.publish_merchant_menu_drafts_on_verify() from public, anon, authenticated;

commit;
