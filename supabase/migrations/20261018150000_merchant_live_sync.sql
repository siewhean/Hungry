-- Merchant edits reach diners immediately.
--
-- 1. Verified merchants own their menu: dishes and dish photos they write are
--    marked merchant_owned + approved, so consumer RLS/search show them at once.
--    Unverified merchants still write unverified rows (hidden until verified).
-- 2. Restores the provenance column guards that 20260710133000 dropped, so a
--    merchant can never self-approve rows directly.
-- 3. Syncs merchant_outlets profile fields (closure, phone, website, cuisine,
--    photo) onto venues, which the consumer stall page reads.
-- 4. Exposes the live merchant profile (description, contact, links, photos)
--    to diners through a narrow read RPC.
-- 5. Refreshes the active raw catalog release for just the edited venue, so
--    Search/Map (catalog V2) do not wait for a full catalog republish.

begin;

alter table public.merchant_outlets
  add column if not exists cuisine_categories text[] not null default '{}',
  add column if not exists social_links jsonb not null default '[]'::jsonb;

-- Also added by 20261018130000_venue_contact_links; repeated so this migration
-- applies on its own.
alter table public.venues
  add column if not exists website_url text,
  add column if not exists contact_phone text;

-- ---------------------------------------------------------------------------
-- 1. Verification helper
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
    where mo.venue_id = p_venue_id
      and mv.status = 'verified'
      and (mv.expires_at is null or mv.expires_at > now())
  );
$$;

revoke all on function public.merchant_venue_is_verified(text) from public, anon;
grant execute on function public.merchant_venue_is_verified(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Write guards
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

  return new;
end;
$$;

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

  if public.merchant_venue_is_verified(new.venue_id) then
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

  if public.merchant_venue_is_verified(v_venue_id) then
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
-- 3. Merchant profile -> venue sync
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
  v_verified boolean;
begin
  if new.venue_id is null then
    return new;
  end if;

  select nullif(trim(link ->> 'url'), '')
  into v_website
  from jsonb_array_elements(
    case when jsonb_typeof(new.social_links) = 'array' then new.social_links else '[]'::jsonb end
  ) link
  where lower(link ->> 'platform') = 'website'
  limit 1;

  v_verified := public.merchant_venue_is_verified(new.venue_id);

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
      when v_verified
        and new.profile_photo_url is distinct from old.profile_photo_url
        and nullif(trim(coalesce(new.profile_photo_url, '')), '') is not null
        then new.profile_photo_url
      else v.logo_url
    end
  where v.id = new.venue_id;

  return new;
end;
$$;

revoke all on function public.sync_merchant_outlet_to_venue() from public, anon, authenticated;

drop trigger if exists trg_sync_merchant_outlet_to_venue on public.merchant_outlets;
create trigger trg_sync_merchant_outlet_to_venue
after update on public.merchant_outlets
for each row
execute function public.sync_merchant_outlet_to_venue();

-- ---------------------------------------------------------------------------
-- 4. Public merchant profile for the consumer stall page
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
    case when verified.ok then mo.profile_photo_url end,
    case when verified.ok then mo.cover_photo_url end,
    nullif(trim(coalesce(mo.temporary_closure, '')), ''),
    verified.ok
  from merchant_outlets mo
  left join merchant_verifications mv on mv.outlet_id = mo.id
  cross join lateral (
    select coalesce(mv.status = 'verified' and (mv.expires_at is null or mv.expires_at > now()), false) as ok
  ) verified
  where mo.venue_id = p_venue_id
    and mo.is_live
  order by verified.ok desc, mo.updated_at desc
  limit 1;
$$;

revoke all on function public.get_public_merchant_profile(text) from public;
grant execute on function public.get_public_merchant_profile(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Per-venue refresh of the active raw catalog release
-- ---------------------------------------------------------------------------

create or replace function public.catalog_raw_refresh_venue(p_venue_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_release uuid;
  v_old_venues integer;
  v_old_dishes integer;
  v_new_venues integer;
  v_new_dishes integer;
begin
  if p_venue_id is null then
    return;
  end if;

  select id into v_release from catalog_releases where status = 'active' limit 1;
  if v_release is null then
    return;
  end if;

  select count(*)::integer into v_old_venues
  from catalog_raw_venue_cards where release_id = v_release and id = p_venue_id;
  select count(*)::integer into v_old_dishes
  from catalog_raw_dish_cards where release_id = v_release and venue_id = p_venue_id;

  delete from catalog_raw_dish_media m
  using catalog_raw_dish_cards c
  where m.release_id = v_release
    and c.release_id = v_release
    and c.venue_id = p_venue_id
    and m.dish_id = c.id;
  delete from catalog_raw_dish_media m
  using dishes d
  where m.release_id = v_release and d.venue_id = p_venue_id and m.dish_id = d.id;
  delete from catalog_raw_dish_cards where release_id = v_release and venue_id = p_venue_id;
  delete from catalog_raw_venue_cards where release_id = v_release and id = p_venue_id;

  -- Same projection as catalog_raw_publish_release, scoped to one venue.
  insert into catalog_raw_venue_cards (
    release_id, id, building_id, name, building_name, building_type, unit_number, floor, address, postal_code,
    operating_hours, image_url, latitude, longitude, listing_location, is_open, menu_count, cuisine_tags,
    dietary_flags, min_price, quality_rating, quality_review_count, representative_dish, verification_status,
    menu_rights_status, media_rights_status, menu_source_url, media_source_url, updated_at
  )
  select
    v_release, v.id, v.building_id, v.name, b.name, b.building_type, v.unit_number, v.floor,
    coalesce(v.address, b.address), coalesce(v.postal_code, b.postal_code), v.operating_hours, v.image_url,
    coalesce(v.latitude, b.latitude), coalesce(v.longitude, b.longitude), coalesce(v.location, b.location), v.is_open,
    coalesce(mc.menu_count, 0), coalesce(ct.cuisine_tags, '{}'), coalesce(df.dietary_flags, '{}'), mc.min_price,
    coalesce(td.rating, 0), coalesce(td.review_count, 0), td.card,
    case when v.menu_approved_for_display and v.media_approved_for_display then 'approved'
      when v.source_confidence >= 0.85 then 'verified' else 'raw' end,
    v.menu_rights_status, v.media_rights_status, v.menu_source_url, v.media_source_url, v.updated_at
  from venues v
  join buildings b on b.id = v.building_id
  left join lateral (
    select count(*)::integer as menu_count, min(d.price) as min_price
    from dishes d where d.venue_id = v.id
  ) mc on true
  left join lateral (
    select array_remove(array_agg(distinct tag), null) as cuisine_tags
    from dishes d
    left join lateral unnest(d.cuisine_tags) tag on true
    where d.venue_id = v.id
  ) ct on true
  left join lateral (
    select array_agg(distinct dfl.slug order by dfl.slug) as dietary_flags
    from dishes d
    join dish_dietary_flags ddf on ddf.dish_id = d.id
    join dietary_flags dfl on dfl.id = ddf.dietary_flag_id
    where d.venue_id = v.id
  ) df on true
  left join lateral (
    select
      jsonb_build_object(
        'id', d.id, 'name', d.name, 'image_url', d.image_url, 'price', d.price,
        'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
          when d.source_confidence >= 0.85 then 'verified' else 'raw' end
      ) as card,
      d.rating_avg as rating,
      d.review_count
    from dishes d
    where d.venue_id = v.id
    order by d.rating_avg desc nulls last, d.review_count desc nulls last, d.id
    limit 1
  ) td on true
  where v.id = p_venue_id;

  insert into catalog_raw_dish_cards (
    release_id, id, venue_id, building_id, name, venue_name, building_name, building_type, description, price,
    price_range, image_url, distance_meters, rating, review_count, cuisine_tags, dietary_flags, is_open,
    listing_location, verification_status, menu_rights_status, media_rights_status, menu_source_url,
    media_source_url, updated_at
  )
  select
    v_release, d.id, d.venue_id, d.building_id, d.name, v.name, b.name, b.building_type, d.description,
    d.price, d.price_range, coalesce(d.image_url, primary_media.url), d.distance_meters, d.rating_avg, d.review_count,
    coalesce(nullif(d.cuisine_tags, '{}'), v.cuisine_tags, '{}'), coalesce(flags.slugs, '{}'), v.is_open,
    coalesce(v.location, b.location),
    case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
      when d.source_confidence >= 0.85 then 'verified' else 'raw' end,
    d.menu_rights_status, d.media_rights_status, d.menu_source_url, d.media_source_url, d.updated_at
  from dishes d
  join venues v on v.id = d.venue_id
  join buildings b on b.id = d.building_id
  left join lateral (
    select di.url from dish_images di where di.dish_id = d.id order by di.sort_order, di.id limit 1
  ) primary_media on true
  left join lateral (
    select array_agg(dfl.slug order by dfl.slug) as slugs
    from dish_dietary_flags ddf join dietary_flags dfl on dfl.id = ddf.dietary_flag_id
    where ddf.dish_id = d.id
  ) flags on true
  where d.venue_id = p_venue_id;

  insert into catalog_raw_dish_media (
    release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
  )
  select v_release, d.id, 'inline:' || d.id, d.image_url, d.media_source_url,
         d.media_rights_status, d.media_approved_for_display, -1
  from dishes d
  where d.venue_id = p_venue_id and nullif(trim(coalesce(d.image_url, '')), '') is not null
  union all
  select v_release, di.dish_id, di.id::text, di.url, di.media_source_url,
         di.media_rights_status, di.media_approved_for_display, di.sort_order
  from dish_images di
  join dishes d on d.id = di.dish_id
  where d.venue_id = p_venue_id;

  select count(*)::integer into v_new_venues
  from catalog_raw_venue_cards where release_id = v_release and id = p_venue_id;
  select count(*)::integer into v_new_dishes
  from catalog_raw_dish_cards where release_id = v_release and venue_id = p_venue_id;

  update catalog_releases
  set venue_total = venue_total - v_old_venues + v_new_venues,
      dish_total = dish_total - v_old_dishes + v_new_dishes
  where id = v_release;
end;
$$;

revoke all on function public.catalog_raw_refresh_venue(text) from public, anon, authenticated;
grant execute on function public.catalog_raw_refresh_venue(text) to service_role;

-- Only app-user writes (merchants, ops in the app) refresh inline. Bulk loads
-- run as postgres/service_role and finish with catalog_raw_publish_release().
create or replace function public.catalog_raw_refresh_venue_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id text;
  v_dish_id text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return null;
  end if;

  if tg_table_name = 'venues' then
    if tg_op = 'DELETE' then v_venue_id := old.id; else v_venue_id := new.id; end if;
  elsif tg_table_name = 'dishes' then
    if tg_op = 'DELETE' then v_venue_id := old.venue_id; else v_venue_id := new.venue_id; end if;
  else
    if tg_op = 'DELETE' then v_dish_id := old.dish_id; else v_dish_id := new.dish_id; end if;
    select d.venue_id into v_venue_id from dishes d where d.id = v_dish_id;
  end if;

  perform public.catalog_raw_refresh_venue(v_venue_id);
  return null;
end;
$$;

revoke all on function public.catalog_raw_refresh_venue_trigger() from public, anon, authenticated;

drop trigger if exists trg_catalog_raw_refresh_venue on public.venues;
create trigger trg_catalog_raw_refresh_venue
after update on public.venues
for each row execute function public.catalog_raw_refresh_venue_trigger();

drop trigger if exists trg_catalog_raw_refresh_dish on public.dishes;
create trigger trg_catalog_raw_refresh_dish
after insert or update or delete on public.dishes
for each row execute function public.catalog_raw_refresh_venue_trigger();

drop trigger if exists trg_catalog_raw_refresh_dish_image on public.dish_images;
create trigger trg_catalog_raw_refresh_dish_image
after insert or update or delete on public.dish_images
for each row execute function public.catalog_raw_refresh_venue_trigger();

drop trigger if exists trg_catalog_raw_refresh_dish_dietary on public.dish_dietary_flags;
create trigger trg_catalog_raw_refresh_dish_dietary
after insert or update or delete on public.dish_dietary_flags
for each row execute function public.catalog_raw_refresh_venue_trigger();

commit;
