-- Harden catalog provenance controls and promote parsed menu items into the
-- canonical dish model without bypassing display approval.

create or replace function enforce_merchant_venue_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
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

create or replace function enforce_merchant_dish_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish insert must match a managed merchant outlet' using errcode = '42501';
    end if;

    if new.distance_meters is distinct from 0
      or new.rating_avg is distinct from 0
      or new.review_count is distinct from 0
      or new.live_crowd is not null
      or new.media_approved_for_display is distinct from false
      or new.media_rights_status is distinct from 'unverified'
      or new.media_source_url is not null
      or new.media_verified_at is not null
      or new.media_verified_by is not null
      or new.menu_approved_for_display is distinct from false
      or new.menu_rights_status is distinct from 'unverified'
      or new.menu_source_url is not null
      or new.menu_verified_at is not null
      or new.menu_verified_by is not null then
      raise exception 'merchant dish inserts cannot set aggregate, live, or provenance fields' using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
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

    return new;
  end if;

  return new;
end;
$$;

create or replace function enforce_merchant_dish_image_write_guard()
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

  select d.venue_id
  into v_venue_id
  from dishes d
  where d.id = coalesce(new.dish_id, old.dish_id);

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
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.media_approved_for_display is distinct from old.media_approved_for_display
      or new.media_rights_status is distinct from old.media_rights_status
      or new.media_source_url is distinct from old.media_source_url
      or new.media_verified_at is distinct from old.media_verified_at
      or new.media_verified_by is distinct from old.media_verified_by then
      raise exception 'merchant dish image updates cannot change provenance fields' using errcode = '42501';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_merchant_dish_image_write_guard on dish_images;
create trigger trg_enforce_merchant_dish_image_write_guard
before insert or update on dish_images
for each row
execute function enforce_merchant_dish_image_write_guard();

drop policy if exists "public_select_dishes" on dishes;
create policy "public_select_dishes"
on dishes for select
using (public.catalog_menu_is_displayable(menu_approved_for_display, menu_rights_status, menu_source_url));

drop policy if exists "public_select_dish_images" on dish_images;
create policy "public_select_dish_images"
on dish_images for select
using (
  public.catalog_display_image_url(url, media_approved_for_display, media_rights_status, media_source_url) is not null
);

drop policy if exists "dish_images_select_merchant_owner_or_manager" on dish_images;
create policy "dish_images_select_merchant_owner_or_manager"
on dish_images for select to authenticated
using (
  exists (
    select 1
    from dishes d
    where d.id = dish_images.dish_id
      and merchant_can_manage_venue(d.venue_id)
  )
);

create or replace function public.promote_staging_menu_items_to_dishes(p_import_run_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_rows integer := 0;
begin
  with parsed_menu_items as (
    select
      s.business_id,
      s.building_name,
      s.postal_code,
      s.cuisine,
      s.confidence,
      s.price_min_sgd,
      s.price_text,
      s.menu_source,
      item.ordinality,
      nullif(
        trim(regexp_replace(item.raw_item, '^[[:space:][:digit:].)-]+', '')),
        ''
      ) as item_name
    from staging_food_businesses s
    cross join lateral regexp_split_to_table(
      coalesce(nullif(s.menu_items_text, ''), nullif(s.menu_text, ''), ''),
      E'[\\n;|]+'
    ) with ordinality as item(raw_item, ordinality)
    where s.import_run_id = p_import_run_id
      and s.validation_status in ('valid', 'promoted')
      and s.business_id is not null
      and trim(s.business_id) <> ''
  ),
  canonical_menu_items as (
    select distinct on (business_id, lower(item_name))
      business_id,
      'ven-' || business_id as venue_id,
      'bld-' || md5(lower(trim(coalesce(building_name, 'Standalone'))) || ':' || lower(trim(coalesce(postal_code, '')))) as building_id,
      item_name,
      coalesce(price_min_sgd, 0.00) as price,
      coalesce(price_text, '') as price_range,
      case when cuisine is not null and trim(cuisine) <> '' then string_to_array(cuisine, ',') else '{}'::text[] end as cuisine_tags,
      coalesce(menu_source, '') as menu_source_url,
      coalesce(confidence, 0.850) as source_confidence,
      ordinality
    from parsed_menu_items
    where item_name is not null
      and length(item_name) between 2 and 120
      and lower(item_name) not in ('failed to enrich', 'none', 'n/a', 'na', 'nil')
    order by business_id, lower(item_name), ordinality
  )
  insert into dishes (
    id,
    venue_id,
    building_id,
    name,
    price,
    price_range,
    cuisine_tags,
    is_featured,
    must_order,
    source_type,
    source_confidence,
    menu_source_url
  )
  select
    'dsh-menu-' || md5(business_id || ':' || lower(item_name)) as id,
    venue_id,
    building_id,
    item_name as name,
    price,
    price_range,
    cuisine_tags,
    false as is_featured,
    false as must_order,
    'spreadsheet_menu_item' as source_type,
    source_confidence,
    nullif(menu_source_url, '') as menu_source_url
  from canonical_menu_items
  on conflict (id) do update set
    venue_id = excluded.venue_id,
    building_id = excluded.building_id,
    name = excluded.name,
    price = excluded.price,
    price_range = excluded.price_range,
    cuisine_tags = excluded.cuisine_tags,
    source_confidence = excluded.source_confidence,
    menu_source_url = excluded.menu_source_url,
    updated_at = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke execute on function public.promote_staging_menu_items_to_dishes(uuid) from public, anon, authenticated;
grant execute on function public.promote_staging_menu_items_to_dishes(uuid) to service_role;
