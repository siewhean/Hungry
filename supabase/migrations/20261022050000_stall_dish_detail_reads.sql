-- Stall and dish detail reads (round-two mediums/lows detail-L6, L7, L10, L11).
--
-- get_venue_detail (based on 20260628063500_venue_logo_detail_reads.sql, the
-- latest definition) returned no stall photo, opening schedule or own map pin,
-- so when the hydrated venue replaced the cached one the hero lost its photo
-- and the schedule/pin were undefined. It now also returns:
--   display_image_url  the stall photo, through catalog_display_image_url so the
--                      same display-rights rules as every other read apply
--   opening_schedule   venues.opening_schedule (jsonb)
--   latitude/longitude the venue's own coordinate (the building point stays in
--                      building.latitude/longitude)
--
-- get_dish_detail (based on 20261021160000_get_dish_detail_dish_photo_only.sql,
-- the latest definition) returned no taste_confidence or updated_at, so a cold
-- open treated every taste vector as fully trusted and never showed "Updated
-- 3d ago". It now also returns:
--   taste_confidence   dish_taste_vectors.confidence for AI-tagged vectors;
--                      null for seed/curated ('default') vectors, which are
--                      fully trusted (same rule as the client's cache path)
--   updated_at         dishes.updated_at
--
-- Both keep security invoker and the anon/authenticated grants. New columns are
-- appended, so older clients that read by name keep working.

begin;

-- ---------------------------------------------------------------------------
-- get_venue_detail
-- ---------------------------------------------------------------------------

drop function if exists public.get_venue_detail(text);

create function public.get_venue_detail(p_venue_id text)
returns table (
  venue_id text,
  building_id text,
  name text,
  unit_number text,
  floor text,
  is_open boolean,
  live_crowd text,
  top_dish_id text,
  operating_hours text,
  closure_notice text,
  logo_url text,
  building jsonb,
  delivery_links jsonb,
  dishes jsonb,
  display_image_url text,
  opening_schedule jsonb,
  latitude double precision,
  longitude double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    v.id as venue_id,
    v.building_id,
    v.name,
    v.unit_number,
    v.floor,
    v.is_open,
    v.live_crowd,
    v.top_dish_id,
    v.operating_hours,
    v.closure_notice,
    v.logo_url,
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'type', b.building_type,
      'latitude', coalesce(v.latitude, b.latitude),
      'longitude', coalesce(v.longitude, b.longitude),
      'floors', b.floors,
      'venueCount', b.venue_count,
      'isClosedToday', b.is_closed_today,
      'heroDishId', b.hero_dish_id,
      'address', coalesce(v.address, b.address),
      'postalCode', coalesce(v.postal_code, b.postal_code),
      'planningArea', coalesce(v.planning_area, b.planning_area)
    ) as building,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'platform', vdl.platform,
          'nativeUrl', vdl.native_url,
          'webUrl', vdl.web_url,
          'affiliateEligible', vdl.affiliate_eligible
        )
        order by vdl.platform
      )
      from venue_delivery_links vdl
      where vdl.venue_id = v.id
    ), '[]'::jsonb) as delivery_links,
    coalesce((
      select jsonb_agg(to_jsonb(sd) order by sd.rank_score desc, sd.dish_id)
      from public.search_dishes(
        p_query => null,
        p_lat => null,
        p_lng => null,
        p_radius_meters => null,
        p_dietary_flags => '{}'::text[],
        p_limit => 50,
        p_cursor_score => null,
        p_cursor_id => null,
        p_venue_id => v.id,
        p_area_name => null,
        p_cuisine_tags => null,
        p_max_price => null,
        p_open_only => false
      ) sd
    ), '[]'::jsonb) as dishes,
    public.catalog_display_image_url(
      v.image_url,
      v.media_approved_for_display,
      v.media_rights_status,
      v.media_source_url
    ) as display_image_url,
    v.opening_schedule,
    v.latitude,
    v.longitude
  from venues v
  join buildings b on b.id = v.building_id
  where v.id = p_venue_id
  limit 1;
$$;

grant execute on function public.get_venue_detail(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_dish_detail
-- ---------------------------------------------------------------------------

drop function if exists public.get_dish_detail(text);

create function public.get_dish_detail(p_dish_id text)
returns table (
  dish_id text,
  venue_id text,
  building_id text,
  venue_name text,
  unit_number text,
  floor text,
  name text,
  image_url text,
  blurhash text,
  distance_meters integer,
  rating numeric,
  review_count integer,
  price numeric,
  price_range text,
  live_crowd text,
  taste_tags text[],
  taste_vector jsonb,
  dietary_flags text[],
  gallery text[],
  description text,
  must_order boolean,
  availability_flags text[],
  reviews jsonb,
  taste_confidence numeric,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    d.id as dish_id,
    d.venue_id,
    d.building_id,
    v.name as venue_name,
    v.unit_number,
    v.floor,
    d.name,
    public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url) as image_url,
    d.blurhash,
    d.distance_meters,
    d.rating_avg as rating,
    d.review_count,
    d.price,
    d.price_range,
    d.live_crowd,
    d.taste_tags,
    jsonb_build_object(
      'sweet', coalesce(dtv.sweet, 5),
      'spicy', coalesce(dtv.spicy, 5),
      'sour', coalesce(dtv.sour, 5),
      'salty', coalesce(dtv.salty, 5),
      'rich', coalesce(dtv.rich, 5),
      'aromatic', coalesce(dtv.aromatic, 5)
    ) as taste_vector,
    coalesce((
      select array_agg(df.slug::text order by df.slug::text)
      from dish_dietary_flags ddf
      join dietary_flags df on df.id = ddf.dietary_flag_id
      where ddf.dish_id = d.id
    ), '{}'::text[]) as dietary_flags,
    coalesce((
      select array_agg(safe_image.url order by safe_image.sort_order)
      from (
        select
          di.sort_order,
          public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
        from dish_images di
        where di.dish_id = d.id
      ) safe_image
      where safe_image.url is not null
    ), case
      when public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url) is null
        then '{}'::text[]
      else array[
        public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url)
      ]
    end) as gallery,
    d.description,
    d.must_order,
    d.availability_flags,
    -- Reviews load through listRecentReviews (paged, signed photos, owner replies).
    -- The column stays for older clients but is always empty: no unbounded list.
    '[]'::jsonb as reviews,
    -- Confidence only describes AI-tagged vectors; seed/curated vectors are fully trusted.
    case
      when dtv.confidence is null or dtv.source = 'default' then null
      else dtv.confidence
    end as taste_confidence,
    d.updated_at
  from dishes d
  join venues v on v.id = d.venue_id
  left join dish_taste_vectors dtv on dtv.dish_id = d.id
  where d.id = p_dish_id
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  limit 1;
$$;

grant execute on function public.get_dish_detail(text) to anon, authenticated;

commit;
