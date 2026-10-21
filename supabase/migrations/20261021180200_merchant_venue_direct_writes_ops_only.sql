-- Merchants never write venue rows directly (round-two review H48).
--
-- enforce_merchant_venue_update_guard was a deny-list. Any linked merchant,
-- verified or not, could PATCH the columns it did not name: website_url
-- (skipping the https rule), contact_phone, menu_url, logo_url, image_url,
-- cuisine_tags, dietary_tags, google_rating, google_review_count, licence_no,
-- source_confidence and anything added later.
--
-- The guard is now an allow-list with nothing on it: a merchant changes the
-- stall page only by editing their outlet profile, and the SECURITY DEFINER
-- sync (app_private.sync_merchant_outlet_to_venue) copies the validated
-- fields for verified outlets. Rating, provenance and licence columns are
-- therefore ops/service only. The app never updates venues directly.
--
-- Based on the latest definition in
-- 20261020130000_merchant_opening_schedule_address_pin.sql. It stays
-- SECURITY INVOKER; definer functions (the sync, catalog jobs) run as the
-- owner and pass the first check.

begin;

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

  -- No venue column is merchant-writable. The verified merchant profile syncs
  -- to the stall page (with validation and location privacy applied).
  raise exception 'update the merchant profile instead; it syncs to the stall page'
    using errcode = '42501';
end;
$$;

commit;
