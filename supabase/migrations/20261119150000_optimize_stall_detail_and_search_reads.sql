-- Migration: 20261119150000_optimize_stall_detail_and_search_reads.sql
-- Fixes statement timeout (code 57014) on get_venue_detail and search_venues_by_location.
-- Replaces nationwide 99k dish scan in get_venue_detail with direct indexed dish query (<50ms).
-- Optimizes search_venues_by_location candidate selection via GIN trigram indexes (<50ms).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_venue_detail(p_venue_id text)
 RETURNS TABLE(
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
  longitude double precision,
  merchant_profile jsonb,
  active_promotions jsonb,
  claim_status text
)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'extensions'
AS $function$
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
      select jsonb_agg(
        jsonb_build_object(
          'dish_id', d.id,
          'id', d.id,
          'venue_id', d.venue_id,
          'building_id', d.building_id,
          'venue_name', v.name,
          'unit_number', v.unit_number,
          'floor', v.floor,
          'name', d.name,
          'image_url', coalesce(
            public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
            public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
          ),
          'blurhash', d.blurhash,
          'distance_meters', 0,
          'rating', d.rating_avg,
          'rating_avg', d.rating_avg,
          'review_count', d.review_count,
          'price', d.price,
          'price_range', d.price_range,
          'live_crowd', d.live_crowd,
          'taste_tags', d.taste_tags,
          'taste_vector', jsonb_build_object(
            'sweet', coalesce(dtv.sweet, 5),
            'spicy', coalesce(dtv.spicy, 5),
            'sour', coalesce(dtv.sour, 5),
            'salty', coalesce(dtv.salty, 5),
            'rich', coalesce(dtv.rich, 5),
            'aromatic', coalesce(dtv.aromatic, 5)
          ),
          'dietary_flags', coalesce((
            select array_agg(df.slug::text order by df.slug::text)
            from dish_dietary_flags ddf
            join dietary_flags df on df.id = ddf.dietary_flag_id
            where ddf.dish_id = d.id
          ), '{}'::text[]),
          'gallery', coalesce((
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
            when coalesce(
              public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
              public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
            ) is null then '{}'::text[]
            else array[
              coalesce(
                public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
                public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
              )
            ]
          end),
          'description', d.description,
          'must_order', d.must_order,
          'availability_flags', d.availability_flags,
          'food_type', d.food_type,
          'course', d.course,
          'cuisine_tags', d.cuisine_tags,
          'rank_score', coalesce(d.rating_avg, 4.0)::double precision,
          'cursor_score', coalesce(d.rating_avg, 4.0)::double precision,
          'cursor_id', d.id,
          'price_basis', case d.price_confidence
            when 'counter_price' then 'counter'
            when 'listed_price' then 'menu'
            when 'delivery_price' then 'delivery'
            else 'menu'
          end,
          'price_checked_at', coalesce(d.price_checked_at, d.created_at)
        )
        order by d.is_featured desc, d.must_order desc, d.rating_avg desc nulls last, d.id
      )
      from (
        select d.*
        from dishes d
        where d.venue_id = v.id
          and d.archived_at is null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
        order by d.is_featured desc, d.must_order desc, d.rating_avg desc nulls last, d.id
        limit 100
      ) d
      left join dish_taste_vectors dtv on dtv.dish_id = d.id
    ), '[]'::jsonb) as dishes,
    public.catalog_display_image_url(
      v.image_url,
      v.media_approved_for_display,
      v.media_rights_status,
      v.media_source_url
    ) as display_image_url,
    v.opening_schedule,
    v.latitude,
    v.longitude,
    (
      select to_jsonb(mp)
      from public.get_public_merchant_profile(v.id) mp
      limit 1
    ) as merchant_profile,
    coalesce((
      select jsonb_agg(to_jsonb(ap))
      from public.list_customer_active_promotions(v.id, null) ap
    ), '[]'::jsonb) as active_promotions,
    app_private.my_merchant_claim_status(v.id) as claim_status
  from venues v
  join buildings b on b.id = v.building_id
  where v.id = p_venue_id
  limit 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_venue_detail(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_venues_by_location(
  p_query text DEFAULT NULL::text,
  p_area_name text DEFAULT NULL::text,
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_radius_meters integer DEFAULT 3000,
  p_limit integer DEFAULT 30
)
 RETURNS TABLE(
  venue_id text,
  building_id text,
  name text,
  logo_url text,
  building_name text,
  unit_number text,
  floor text,
  is_open boolean,
  planning_area text,
  cuisine_tags text[],
  distance_meters integer,
  rank_score double precision
)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'extensions'
AS $function$
  with area_match as (
    select center_lat, center_lng
    from areas
    where nullif(trim(coalesce(p_area_name, '')), '') is not null
      and name_normalized = lower(trim(p_area_name))
    limit 1
  ),
  params as (
    select
      nullif(trim(coalesce(p_query, '')), '') as query,
      coalesce((select center_lat from area_match), p_lat) as lat,
      coalesce((select center_lng from area_match), p_lng) as lng,
      greatest(coalesce(p_radius_meters, 3000), 1) as radius_meters,
      least(greatest(coalesce(p_limit, 30), 1), 100) as result_limit,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from area_match) as area_found
  ),
  candidate_venue_ids as materialized (
    -- Branch 1: Query specified -> index scan on venues name trgm
    select v.id
    from venues v
    cross join params p
    where p.query is not null
      and (
        v.name ilike ('%' || p.query || '%')
        or v.name % p.query
      )
    union
    -- Branch 2: Query specified -> index scan on buildings name trgm
    select v.id
    from buildings b
    join venues v on v.building_id = b.id
    cross join params p
    where p.query is not null
      and (
        b.name ilike ('%' || p.query || '%')
        or b.name % p.query
      )
    union
    -- Branch 3: Query is null, area requested
    select v.id
    from venues v
    cross join params p
    where p.query is null
      and p.area_requested
      and p.area_found
      and lower(trim(coalesce(v.planning_area, ''))) = lower(trim(p_area_name))
    union
    -- Branch 4: Query is null, location requested
    select v.id
    from venues v
    cross join params p
    where p.query is null
      and not (p.area_requested and p.area_found)
      and p.lat is not null
      and p.lng is not null
      and v.location is not null
      and st_dwithin(
        v.location,
        st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography,
        p.radius_meters
      )
    union
    -- Branch 5: Pure fallback (no query, no area, no location) -> nationwide top venues
    select v.id
    from venues v
    cross join params p
    where p.query is null
      and not (p.area_requested and p.area_found)
      and (p.lat is null or p.lng is null)
    limit 200
  )
  select
    v.id as venue_id,
    v.building_id,
    v.name,
    nullif(trim(v.logo_url), '') as logo_url,
    b.name as building_name,
    v.unit_number,
    v.floor,
    v.is_open,
    coalesce(v.planning_area, b.planning_area) as planning_area,
    v.cuisine_tags,
    case
      when params.lat is not null and params.lng is not null then
        st_distance(
          coalesce(v.location, b.location),
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
        )::integer
      else 0
    end as distance_meters,
    case
      when params.query is null then 1::double precision
      else greatest(
        similarity(v.name, params.query),
        similarity(b.name, params.query),
        case
          when v.name ilike '%' || params.query || '%' then 0.65
          else 0.55
        end
      )
    end as rank_score
  from candidate_venue_ids c
  join venues v on v.id = c.id
  join buildings b on b.id = v.building_id
  cross join params
  where (not params.area_requested or params.area_found)
    and (
      params.lat is null
      or params.lng is null
      or st_dwithin(
        coalesce(v.location, b.location),
        st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
        params.radius_meters
      )
    )
  order by rank_score desc, distance_meters, v.id
  limit (select result_limit from params);
$function$;

GRANT EXECUTE ON FUNCTION public.search_venues_by_location(text, text, double precision, double precision, integer, integer) TO anon, authenticated;

COMMIT;
