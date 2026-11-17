-- Keep full-catalog release publication bounded at production scale. The original
-- publisher executed multiple lateral reads for every venue; this version derives
-- each aggregate once and then joins the immutable release snapshot.
create index if not exists idx_dish_dietary_flags_dish_flag
  on public.dish_dietary_flags (dish_id, dietary_flag_id);

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

  with venue_menu_counts as materialized (
    select d.venue_id, count(*)::integer as menu_count, min(d.price) as min_price
    from public.dishes d
    group by d.venue_id
  ), venue_cuisine_tags as materialized (
    select d.venue_id, array_remove(array_agg(distinct tag), null) as cuisine_tags
    from public.dishes d
    left join lateral unnest(d.cuisine_tags) tag on true
    group by d.venue_id
  ), venue_dietary_flags as materialized (
    select d.venue_id, array_agg(distinct df.slug order by df.slug) as dietary_flags
    from public.dishes d
    join public.dish_dietary_flags ddf on ddf.dish_id = d.id
    join public.dietary_flags df on df.id = ddf.dietary_flag_id
    group by d.venue_id
  ), top_dishes as materialized (
    select distinct on (d.venue_id)
      d.venue_id,
      jsonb_build_object(
        'id', d.id, 'name', d.name, 'image_url', d.image_url, 'price', d.price,
        'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
          when d.source_confidence >= 0.85 then 'verified' else 'raw' end
      ) as card,
      d.rating_avg as rating,
      d.review_count
    from public.dishes d
    order by d.venue_id, d.rating_avg desc nulls last, d.review_count desc nulls last, d.id
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

  insert into public.catalog_raw_dish_cards (
    release_id, id, venue_id, building_id, name, venue_name, building_name, building_type, description, price,
    price_range, image_url, distance_meters, rating, review_count, cuisine_tags, dietary_flags, is_open,
    listing_location, verification_status, menu_rights_status, media_rights_status, menu_source_url,
    media_source_url, updated_at
  )
  select
    v_release_id, d.id, d.venue_id, d.building_id, d.name, v.name, b.name, b.building_type, d.description,
    d.price, d.price_range, coalesce(d.image_url, primary_media.url), d.distance_meters, d.rating_avg, d.review_count,
    coalesce(nullif(d.cuisine_tags, '{}'), v.cuisine_tags, '{}'), coalesce(flags.slugs, '{}'), v.is_open,
    coalesce(v.location, b.location),
    case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
      when d.source_confidence >= 0.85 then 'verified' else 'raw' end,
    d.menu_rights_status, d.media_rights_status, d.menu_source_url, d.media_source_url, d.updated_at
  from public.dishes d
  join public.venues v on v.id = d.venue_id
  join public.buildings b on b.id = d.building_id
  left join lateral (
    select di.url from public.dish_images di where di.dish_id = d.id order by di.sort_order, di.id limit 1
  ) primary_media on true
  left join lateral (
    select array_agg(df.slug order by df.slug) as slugs
    from public.dish_dietary_flags ddf join public.dietary_flags df on df.id = ddf.dietary_flag_id
    where ddf.dish_id = d.id
  ) flags on true;

  insert into public.catalog_raw_dish_media (
    release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
  )
  select v_release_id, d.id, 'inline:' || d.id, d.image_url, d.media_source_url,
         d.media_rights_status, d.media_approved_for_display, -1
  from public.dishes d where nullif(trim(coalesce(d.image_url, '')), '') is not null
  union all
  select v_release_id, di.dish_id, di.id::text, di.url, di.media_source_url,
         di.media_rights_status, di.media_approved_for_display, di.sort_order
  from public.dish_images di;

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
  return v_release_id;
end;
$$;
