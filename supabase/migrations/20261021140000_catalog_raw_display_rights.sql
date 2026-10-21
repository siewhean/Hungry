-- The raw catalog (map pins, venue cards, catalog dish pages) copied every
-- photo and menu row with no display-rights check, and guests can read it
-- since 20261019210000. Apply the same rule the Discover feed uses:
--   * photos only through public.catalog_display_image_url(...)
--   * menu items only when public.catalog_menu_is_displayable(...)
-- Venue identity (name, building, address, hours, location) stays visible.
--
-- Redefines (latest bodies were 20260714163000 and 20261018150000):
--   public.catalog_raw_publish_release(integer, integer)  SECURITY DEFINER
--   public.catalog_raw_refresh_venue(text)                SECURITY DEFINER
-- Then scrubs the rows already published in live releases.

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

  with displayable_dishes as materialized (
    select d.*
    from public.dishes d
    where public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  ), venue_menu_counts as materialized (
    select d.venue_id, count(*)::integer as menu_count, min(d.price) as min_price
    from displayable_dishes d
    group by d.venue_id
  ), venue_cuisine_tags as materialized (
    select d.venue_id, array_remove(array_agg(distinct tag), null) as cuisine_tags
    from displayable_dishes d
    left join lateral unnest(d.cuisine_tags) tag on true
    group by d.venue_id
  ), venue_dietary_flags as materialized (
    select d.venue_id, array_agg(distinct df.slug order by df.slug) as dietary_flags
    from displayable_dishes d
    join public.dish_dietary_flags ddf on ddf.dish_id = d.id
    join public.dietary_flags df on df.id = ddf.dietary_flag_id
    group by d.venue_id
  ), top_dishes as materialized (
    select distinct on (d.venue_id)
      d.venue_id,
      jsonb_build_object(
        'id', d.id, 'name', d.name,
        'image_url', public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
        'price', d.price,
        'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
          when d.source_confidence >= 0.85 then 'verified' else 'raw' end
      ) as card,
      d.rating_avg as rating,
      d.review_count
    from displayable_dishes d
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
    coalesce(v.address, b.address), coalesce(v.postal_code, b.postal_code), v.operating_hours,
    public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url),
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
    d.price, d.price_range,
    coalesce(
      public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
      primary_media.url
    ),
    d.distance_meters, d.rating_avg, d.review_count,
    coalesce(nullif(d.cuisine_tags, '{}'), v.cuisine_tags, '{}'), coalesce(flags.slugs, '{}'), v.is_open,
    coalesce(v.location, b.location),
    case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
      when d.source_confidence >= 0.85 then 'verified' else 'raw' end,
    d.menu_rights_status, d.media_rights_status, d.menu_source_url, d.media_source_url, d.updated_at
  from public.dishes d
  join public.venues v on v.id = d.venue_id
  join public.buildings b on b.id = d.building_id
  left join lateral (
    select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
    from public.dish_images di
    where di.dish_id = d.id
      and public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) is not null
    order by di.sort_order, di.id
    limit 1
  ) primary_media on true
  left join lateral (
    select array_agg(df.slug order by df.slug) as slugs
    from public.dish_dietary_flags ddf join public.dietary_flags df on df.id = ddf.dietary_flag_id
    where ddf.dish_id = d.id
  ) flags on true
  where public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url);

  insert into public.catalog_raw_dish_media (
    release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
  )
  select v_release_id, media.dish_id, media.media_key, media.display_url, media.source_url,
         media.rights_status, media.approved_for_display, media.sort_order
  from (
    select d.id as dish_id, 'inline:' || d.id as media_key,
           public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url) as display_url,
           d.media_source_url as source_url, d.media_rights_status as rights_status,
           d.media_approved_for_display as approved_for_display, -1 as sort_order
    from public.dishes d
    where public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
    union all
    select di.dish_id, di.id::text,
           public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url),
           di.media_source_url, di.media_rights_status, di.media_approved_for_display, di.sort_order
    from public.dish_images di
    join public.dishes d on d.id = di.dish_id
    where public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  ) media
  where media.display_url is not null;

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

revoke all on function public.catalog_raw_publish_release(integer, integer) from public, anon, authenticated;

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
    coalesce(v.address, b.address), coalesce(v.postal_code, b.postal_code), v.operating_hours,
    catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url),
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
    from dishes d
    where d.venue_id = v.id
      and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  ) mc on true
  left join lateral (
    select array_remove(array_agg(distinct tag), null) as cuisine_tags
    from dishes d
    left join lateral unnest(d.cuisine_tags) tag on true
    where d.venue_id = v.id
      and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  ) ct on true
  left join lateral (
    select array_agg(distinct dfl.slug order by dfl.slug) as dietary_flags
    from dishes d
    join dish_dietary_flags ddf on ddf.dish_id = d.id
    join dietary_flags dfl on dfl.id = ddf.dietary_flag_id
    where d.venue_id = v.id
      and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  ) df on true
  left join lateral (
    select
      jsonb_build_object(
        'id', d.id, 'name', d.name,
        'image_url', catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
        'price', d.price,
        'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
          when d.source_confidence >= 0.85 then 'verified' else 'raw' end
      ) as card,
      d.rating_avg as rating,
      d.review_count
    from dishes d
    where d.venue_id = v.id
      and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
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
    d.price, d.price_range,
    coalesce(
      catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
      primary_media.url
    ),
    d.distance_meters, d.rating_avg, d.review_count,
    coalesce(nullif(d.cuisine_tags, '{}'), v.cuisine_tags, '{}'), coalesce(flags.slugs, '{}'), v.is_open,
    coalesce(v.location, b.location),
    case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
      when d.source_confidence >= 0.85 then 'verified' else 'raw' end,
    d.menu_rights_status, d.media_rights_status, d.menu_source_url, d.media_source_url, d.updated_at
  from dishes d
  join venues v on v.id = d.venue_id
  join buildings b on b.id = d.building_id
  left join lateral (
    select catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
    from dish_images di
    where di.dish_id = d.id
      and catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) is not null
    order by di.sort_order, di.id
    limit 1
  ) primary_media on true
  left join lateral (
    select array_agg(dfl.slug order by dfl.slug) as slugs
    from dish_dietary_flags ddf join dietary_flags dfl on dfl.id = ddf.dietary_flag_id
    where ddf.dish_id = d.id
  ) flags on true
  where d.venue_id = p_venue_id
    and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url);

  insert into catalog_raw_dish_media (
    release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
  )
  select v_release, media.dish_id, media.media_key, media.display_url, media.source_url,
         media.rights_status, media.approved_for_display, media.sort_order
  from (
    select d.id as dish_id, 'inline:' || d.id as media_key,
           catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url) as display_url,
           d.media_source_url as source_url, d.media_rights_status as rights_status,
           d.media_approved_for_display as approved_for_display, -1 as sort_order
    from dishes d
    where d.venue_id = p_venue_id
      and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
    union all
    select di.dish_id, di.id::text,
           catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url),
           di.media_source_url, di.media_rights_status, di.media_approved_for_display, di.sort_order
    from dish_images di
    join dishes d on d.id = di.dish_id
    where d.venue_id = p_venue_id
      and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  ) media
  where media.display_url is not null;

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

-- ---------------------------------------------------------------------------
-- Scrub rows already published in readable releases (active, or retired and
-- still inside its 24-hour cursor window). A full republish gives the same
-- result; this makes the fix take effect without waiting for one.
-- ---------------------------------------------------------------------------

-- 1. Photos that fail the display check.
delete from public.catalog_raw_dish_media m
using public.catalog_releases r
where r.id = m.release_id
  and r.status in ('active', 'retired', 'building')
  and public.catalog_display_image_url(m.url, m.approved_for_display, m.rights_status, m.source_url) is null;

-- 2. Menu items whose source dish is not displayable (or no longer exists).
delete from public.catalog_raw_dish_cards c
using public.catalog_releases r
where r.id = c.release_id
  and r.status in ('active', 'retired', 'building')
  and not exists (
    select 1
    from public.dishes d
    where d.id = c.id
      and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  );

delete from public.catalog_raw_dish_media m
using public.catalog_releases r
where r.id = m.release_id
  and r.status in ('active', 'retired', 'building')
  and not exists (
    select 1 from public.catalog_raw_dish_cards c
    where c.release_id = m.release_id and c.id = m.dish_id
  );

-- 3. Dish card photo: the dish's own approved photo, else its first approved gallery photo.
update public.catalog_raw_dish_cards c
set image_url = coalesce(
  public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
  (
    select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url)
    from public.dish_images di
    where di.dish_id = d.id
      and public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) is not null
    order by di.sort_order, di.id
    limit 1
  )
)
from public.dishes d, public.catalog_releases r
where d.id = c.id
  and r.id = c.release_id
  and r.status in ('active', 'retired', 'building')
  and c.image_url is distinct from coalesce(
    public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
    (
      select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url)
      from public.dish_images di
      where di.dish_id = d.id
        and public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) is not null
      order by di.sort_order, di.id
      limit 1
    )
  );

-- 4. Venue cards: approved venue photo, and menu aggregates from displayable dishes only.
update public.catalog_raw_venue_cards vc
set image_url = public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url),
    menu_count = coalesce(mc.menu_count, 0),
    min_price = mc.min_price,
    cuisine_tags = coalesce(ct.cuisine_tags, '{}'),
    dietary_flags = coalesce(df.dietary_flags, '{}'),
    quality_rating = coalesce(td.rating, 0),
    quality_review_count = coalesce(td.review_count, 0),
    representative_dish = td.card
from public.venues v
cross join lateral (
  select count(*)::integer as menu_count, min(d.price) as min_price
  from public.dishes d
  where d.venue_id = v.id
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
) mc
cross join lateral (
  select array_remove(array_agg(distinct tag), null) as cuisine_tags
  from public.dishes d
  left join lateral unnest(d.cuisine_tags) tag on true
  where d.venue_id = v.id
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
) ct
cross join lateral (
  select array_agg(distinct dfl.slug order by dfl.slug) as dietary_flags
  from public.dishes d
  join public.dish_dietary_flags ddf on ddf.dish_id = d.id
  join public.dietary_flags dfl on dfl.id = ddf.dietary_flag_id
  where d.venue_id = v.id
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
) df
left join lateral (
  select
    jsonb_build_object(
      'id', d.id, 'name', d.name,
      'image_url', public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
      'price', d.price,
      'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
        when d.source_confidence >= 0.85 then 'verified' else 'raw' end
    ) as card,
    d.rating_avg as rating,
    d.review_count
  from public.dishes d
  where d.venue_id = v.id
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  order by d.rating_avg desc nulls last, d.review_count desc nulls last, d.id
  limit 1
) td on true
where v.id = vc.id
  and vc.release_id in (
    select r.id from public.catalog_releases r where r.status in ('active', 'retired', 'building')
  );

-- 5. Keep release totals in step with the scrubbed rows.
update public.catalog_releases r
set dish_total = (select count(*)::integer from public.catalog_raw_dish_cards c where c.release_id = r.id)
where r.status in ('active', 'retired');
