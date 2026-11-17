-- Migration: 20261110150000_raw_catalog_publication_hold_guards.sql
-- Description: Enforce item-level publication holds and display predicates in the raw catalog publisher.
-- 1. Table catalog_item_publication_holds tracks durable item-level holds (whole_item, price_only, media_only, dietary_only).
-- 2. Hardens catalog_raw_publish_release:
--    - Excludes dishes with whole_item hold, or explicit publication hold / quarantine phrases in description.
--    - Nullifies price and price_range for dishes with price_only hold (disputed price).
--    - Suppresses image_url and child media for dishes with media_only hold or unapproved media.
--    - Filters venue_menu_counts, top_dishes, and venue tags to exclude held dishes and reflect clean min_price.
--    - Preserves security definer, set search_path = public, extensions.

create table if not exists public.catalog_item_publication_holds (
  id uuid primary key default gen_random_uuid(),
  dish_id text not null references public.dishes(id) on delete cascade,
  hold_scope text not null check (hold_scope in ('whole_item', 'price_only', 'media_only', 'dietary_only')),
  hold_reason text not null,
  source_evidence_url text,
  workbook_row integer,
  workbook_sha256 text,
  created_at timestamptz not null default now(),
  unique (dish_id, hold_scope)
);

create index if not exists idx_catalog_item_publication_holds_dish
  on public.catalog_item_publication_holds (dish_id, hold_scope);

alter table public.catalog_item_publication_holds enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'catalog_item_publication_holds' and policyname = 'catalog_item_publication_holds_read'
    ) then
      create policy catalog_item_publication_holds_read
        on public.catalog_item_publication_holds
        for select
        to authenticated
        using (true);
    end if;
  end if;
end $$;

create or replace function public.catalog_raw_publish_release(
  p_expected_venues integer default null,
  p_expected_dishes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_release_id uuid := gen_random_uuid();
  v_venue_total integer;
  v_dish_total integer;
begin
  insert into public.catalog_releases (id, status) values (v_release_id, 'building');

  -- 1. Materialize permissible (non-held) dishes for release snapshot
  drop table if exists _catalog_displayable_dishes;
  create temporary table _catalog_displayable_dishes on commit drop as
  select
    d.*,
    case when price_hold.dish_id is not null then null else d.price end as effective_price,
    case when price_hold.dish_id is not null then null else d.price_range end as effective_price_range,
    case when media_hold.dish_id is not null or not coalesce(d.media_approved_for_display, false) then null
         else coalesce(d.image_url, primary_media.url) end as effective_image_url,
    price_hold.dish_id is not null as has_price_hold,
    media_hold.dish_id is not null as has_media_hold,
    dietary_hold.dish_id is not null as has_dietary_hold
  from public.dishes d
  left join public.catalog_item_publication_holds whole_hold
    on whole_hold.dish_id = d.id and whole_hold.hold_scope = 'whole_item'
  left join public.catalog_item_publication_holds price_hold
    on price_hold.dish_id = d.id and price_hold.hold_scope = 'price_only'
  left join public.catalog_item_publication_holds media_hold
    on media_hold.dish_id = d.id and media_hold.hold_scope = 'media_only'
  left join public.catalog_item_publication_holds dietary_hold
    on dietary_hold.dish_id = d.id and dietary_hold.hold_scope = 'dietary_only'
  left join lateral (
    select di.url from public.dish_images di
    where di.dish_id = d.id and coalesce(di.media_approved_for_display, false) = true
    order by di.sort_order, di.id limit 1
  ) primary_media on true
  where whole_hold.dish_id is null
    and (d.description is null or d.description not ilike '%do not publish as a confirmed outlet menu%')
    and (d.description is null or d.description not ilike '%[quarantined:%');

  -- 2. Materialize venue card aggregates from displayable dishes
  with venue_menu_counts as materialized (
    select
      dd.venue_id,
      count(*)::integer as menu_count,
      min(dd.effective_price) as min_price
    from _catalog_displayable_dishes dd
    group by dd.venue_id
  ),
  venue_cuisine_tags as materialized (
    select
      dd.venue_id,
      array_remove(array_agg(distinct tag), null) as cuisine_tags
    from _catalog_displayable_dishes dd
    left join lateral unnest(dd.cuisine_tags) tag on true
    group by dd.venue_id
  ),
  venue_dietary_flags as materialized (
    select
      dd.venue_id,
      array_agg(distinct df.slug order by df.slug) as dietary_flags
    from _catalog_displayable_dishes dd
    join public.dish_dietary_flags ddf on ddf.dish_id = dd.id
    join public.dietary_flags df on df.id = ddf.dietary_flag_id
    where not dd.has_dietary_hold
    group by dd.venue_id
  ),
  top_dishes as materialized (
    select distinct on (dd.venue_id)
      dd.venue_id,
      jsonb_build_object(
        'id', dd.id,
        'name', dd.name,
        'image_url', dd.effective_image_url,
        'price', dd.effective_price,
        'verification_status', case when dd.menu_approved_for_display and dd.media_approved_for_display and not dd.has_price_hold and not dd.has_media_hold then 'approved'
          when dd.source_confidence >= 0.85 then 'verified' else 'raw' end
      ) as card,
      dd.rating_avg as rating,
      dd.review_count
    from _catalog_displayable_dishes dd
    order by dd.venue_id, dd.rating_avg desc nulls last, dd.review_count desc nulls last, dd.id
  )
  insert into public.catalog_raw_venue_cards (
    release_id, id, building_id, name, building_name, building_type, unit_number, floor, address, postal_code,
    operating_hours, image_url, latitude, longitude, listing_location, is_open, menu_count, cuisine_tags,
    dietary_flags, min_price, quality_rating, quality_review_count, representative_dish, verification_status,
    menu_rights_status, media_rights_status, menu_source_url, media_source_url, updated_at
  )
  select
    v_release_id, v.id, v.building_id, v.name, b.name, b.building_type, v.unit_number, v.floor,
    coalesce(v.address, b.address), coalesce(v.postal_code, b.postal_code), v.operating_hours, v.image_url,
    coalesce(v.latitude, b.latitude), coalesce(v.longitude, b.longitude), coalesce(v.location, b.location), v.is_open,
    coalesce(mc.menu_count, 0), coalesce(ct.cuisine_tags, '{}'), coalesce(df.dietary_flags, '{}'), mc.min_price,
    coalesce(td.rating, 0), coalesce(td.review_count, 0), td.card,
    case when v.menu_approved_for_display and v.media_approved_for_display then 'approved'
      when v.source_confidence >= 0.85 then 'verified' else 'raw' end,
    v.menu_rights_status, v.media_rights_status, v.menu_source_url, v.media_source_url, v.updated_at
  from public.venues v
  join public.buildings b on b.id = v.building_id
  left join venue_menu_counts mc on mc.venue_id = v.id
  left join venue_cuisine_tags ct on ct.venue_id = v.id
  left join venue_dietary_flags df on df.venue_id = v.id
  left join top_dishes td on td.venue_id = v.id;

  -- 3. Insert dish cards (only displayable dishes)
  insert into public.catalog_raw_dish_cards (
    release_id, id, venue_id, building_id, name, venue_name, building_name, building_type, description, price,
    price_range, image_url, distance_meters, rating, review_count, cuisine_tags, dietary_flags, is_open,
    listing_location, verification_status, menu_rights_status, media_rights_status, menu_source_url,
    media_source_url, updated_at
  )
  select
    v_release_id, dd.id, dd.venue_id, dd.building_id, dd.name, v.name, b.name, b.building_type, dd.description,
    dd.effective_price, dd.effective_price_range, dd.effective_image_url, dd.distance_meters, dd.rating_avg, dd.review_count,
    coalesce(nullif(dd.cuisine_tags, '{}'), v.cuisine_tags, '{}'),
    case when dd.has_dietary_hold then '{}' else coalesce(flags.slugs, '{}') end,
    v.is_open,
    coalesce(v.location, b.location),
    case when dd.menu_approved_for_display and dd.media_approved_for_display and not dd.has_price_hold and not dd.has_media_hold then 'approved'
      when dd.source_confidence >= 0.85 then 'verified' else 'raw' end,
    dd.menu_rights_status, dd.media_rights_status, dd.menu_source_url, dd.media_source_url, dd.updated_at
  from _catalog_displayable_dishes dd
  join public.venues v on v.id = dd.venue_id
  join public.buildings b on b.id = dd.building_id
  left join lateral (
    select array_agg(df.slug order by df.slug) as slugs
    from public.dish_dietary_flags ddf join public.dietary_flags df on df.id = ddf.dietary_flag_id
    where ddf.dish_id = dd.id
  ) flags on true;

  -- 4. Insert dish media (only approved media for displayable dishes without media hold)
  insert into public.catalog_raw_dish_media (
    release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
  )
  select v_release_id, dd.id, 'inline:' || dd.id, dd.image_url, dd.media_source_url,
         dd.media_rights_status, dd.media_approved_for_display, -1
  from _catalog_displayable_dishes dd
  where nullif(trim(coalesce(dd.image_url, '')), '') is not null
    and not dd.has_media_hold
    and coalesce(dd.media_approved_for_display, false) = true
  union all
  select v_release_id, di.dish_id, di.id::text, di.url, di.media_source_url,
         di.media_rights_status, di.media_approved_for_display, di.sort_order
  from public.dish_images di
  join _catalog_displayable_dishes dd on dd.id = di.dish_id
  where not dd.has_media_hold
    and coalesce(di.media_approved_for_display, false) = true;

  drop table if exists _catalog_displayable_dishes;

  -- 5. Enforce hold revocation across any retained older releases so retired releases cannot leak held content
  delete from public.catalog_raw_dish_cards
  where release_id <> v_release_id
    and (id in (select dish_id from public.catalog_item_publication_holds where hold_scope = 'whole_item')
         or description ilike '%do not publish as a confirmed outlet menu%'
         or description ilike '%[quarantined:%');

  delete from public.catalog_raw_dish_media
  where release_id <> v_release_id
    and dish_id in (select dish_id from public.catalog_item_publication_holds where hold_scope in ('whole_item', 'media_only'));

  update public.catalog_raw_dish_cards
  set price = null, price_range = null
  where release_id <> v_release_id
    and id in (select dish_id from public.catalog_item_publication_holds where hold_scope = 'price_only');

  update public.catalog_raw_dish_cards
  set dietary_flags = '{}'
  where release_id <> v_release_id
    and id in (select dish_id from public.catalog_item_publication_holds where hold_scope = 'dietary_only');

  update public.catalog_raw_dish_cards
  set image_url = null
  where release_id <> v_release_id
    and id in (select dish_id from public.catalog_item_publication_holds where hold_scope = 'media_only');

  -- Immediately expire any legacy retired releases older than the active release being transitioned
  update public.catalog_releases
  set status = 'retired', expires_at = now()
  where status = 'retired' and expires_at > now();

  select count(*)::integer into v_venue_total from public.catalog_raw_venue_cards where release_id = v_release_id;
  select count(*)::integer into v_dish_total from public.catalog_raw_dish_cards where release_id = v_release_id;

  if (p_expected_venues is not null and v_venue_total <> p_expected_venues)
     or (p_expected_dishes is not null and v_dish_total <> p_expected_dishes) then
    update public.catalog_releases set status = 'failed', venue_total = v_venue_total, dish_total = v_dish_total where id = v_release_id;
    return v_release_id;
  end if;

  update public.catalog_releases set status = 'retired', expires_at = now() + interval '24 hours' where status = 'active';
  update public.catalog_releases set status = 'active', venue_total = v_venue_total, dish_total = v_dish_total, activated_at = now()
  where id = v_release_id;

  -- 6. Recalculate venue card aggregates and representative dish on any retained retired releases
  with target_venues as (
    select v.release_id, v.id as venue_id
    from public.catalog_raw_venue_cards v
    join public.catalog_releases r on r.id = v.release_id
    where v.release_id <> v_release_id
      and r.status = 'retired'
      and r.expires_at > now()
  ),
  scrubbed_venue_stats as (
    select
      c.release_id,
      c.venue_id,
      count(*)::integer as menu_count,
      min(c.price) as min_price,
      array_remove(array_agg(distinct flag), null) as dietary_flags
    from public.catalog_raw_dish_cards c
    left join lateral unnest(c.dietary_flags) flag on true
    where c.release_id <> v_release_id
    group by c.release_id, c.venue_id
  ),
  new_top_dishes as (
    select distinct on (c.release_id, c.venue_id)
      c.release_id,
      c.venue_id,
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'image_url', c.image_url,
        'price', c.price,
        'verification_status', c.verification_status
      ) as card
    from public.catalog_raw_dish_cards c
    where c.release_id <> v_release_id
    order by c.release_id, c.venue_id, c.rating desc nulls last, c.review_count desc nulls last, c.id
  ),
  merged_updates as (
    select
      tv.release_id,
      tv.venue_id,
      coalesce(s.menu_count, 0) as menu_count,
      s.min_price,
      coalesce(s.dietary_flags, '{}'::text[]) as dietary_flags,
      td.card as representative_dish
    from target_venues tv
    left join scrubbed_venue_stats s on s.release_id = tv.release_id and s.venue_id = tv.venue_id
    left join new_top_dishes td on td.release_id = tv.release_id and td.venue_id = tv.venue_id
  )
  update public.catalog_raw_venue_cards v
  set
    menu_count = mu.menu_count,
    min_price = mu.min_price,
    dietary_flags = mu.dietary_flags,
    representative_dish = mu.representative_dish
  from merged_updates mu
  where v.release_id = mu.release_id
    and v.id = mu.venue_id;

  return v_release_id;
end;
$$;
