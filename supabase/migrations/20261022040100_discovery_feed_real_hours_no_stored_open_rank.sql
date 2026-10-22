-- M11/M15/L2: the Discover feed ranked a stall up by the stored venues.is_open
-- flag (a copy taken at catalog publish time, not the real hours), so a closed
-- stall could outrank an open one, and it returned no opening hours, so the app
-- could not show a real open/closed state or build a late-night rail.
--   * drop the stored is_open bonus from rank_score (closed-today buildings still
--     lose it); the app works out open state from hours in Singapore time.
--   * return venues.operating_hours (null when empty) as operating_hours.
-- Body otherwise unchanged from the latest definition
-- (20261021190000_catalog_places_and_place_scoped_reads.sql, which added p_building_id).
--
-- Redefines: public.get_discovery_feed_by_location(text, double precision,
-- double precision, integer, integer, text)  SECURITY INVOKER (unchanged).

begin;

-- Adding an OUT column changes the row type, which CREATE OR REPLACE cannot do.
drop function if exists public.get_discovery_feed_by_location(
  text,
  double precision,
  double precision,
  integer,
  integer,
  text
);

create or replace function public.get_discovery_feed_by_location(
  p_area_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_limit integer default 50,
  p_building_id text default null
)
returns table (
  venue_id text,
  venue_name text,
  venue_logo_url text,
  building_id text,
  building_name text,
  planning_area text,
  is_open boolean,
  operating_hours text,
  distance_meters integer,
  top_dish_id text,
  top_dish_name text,
  top_dish_image text,
  top_dish_rating numeric,
  top_dish_review_count integer,
  top_dish_price numeric,
  cuisine_tags text[],
  rank_score double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with area_match as (
    select name, center_lat, center_lng
    from areas
    where nullif(trim(coalesce(p_area_name, '')), '') is not null
      and name_normalized = lower(trim(p_area_name))
    limit 1
  ),
  params as (
    select
      coalesce((select center_lat from area_match), p_lat) as lat,
      coalesce((select center_lng from area_match), p_lng) as lng,
      greatest(coalesce(p_radius_meters, 3000), 1) as radius_meters,
      least(greatest(coalesce(p_limit, 50), 1), 100) as result_limit,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from area_match) as area_found,
      lower(trim(nullif(coalesce(p_area_name, ''), ''))) as area_key
  ),
  candidate_venues as materialized (
    select *
    from (
      select
        v.id,
        v.name,
        v.logo_url as venue_logo_url,
        v.building_id,
        v.planning_area as venue_planning_area,
        v.is_open,
        v.operating_hours as venue_operating_hours,
        v.location as venue_location,
        v.image_url as venue_image_url,
        v.media_approved_for_display as venue_media_approved_for_display,
        v.media_rights_status as venue_media_rights_status,
        v.media_source_url as venue_media_source_url,
        v.menu_approved_for_display as venue_menu_approved_for_display,
        v.menu_rights_status as venue_menu_rights_status,
        v.menu_source_url as venue_menu_source_url,
        v.cuisine_tags as venue_cuisine_tags,
        b.name as building_name,
        b.planning_area as building_planning_area,
        b.location as building_location,
        b.image_url as building_image_url,
        b.media_approved_for_display as building_media_approved_for_display,
        b.media_rights_status as building_media_rights_status,
        b.media_source_url as building_media_source_url,
        b.is_closed_today,
        exists (
          select 1
          from dishes d
          where d.venue_id = v.id
            and d.price > 0
            and public.catalog_menu_is_displayable(
              d.menu_approved_for_display,
              d.menu_rights_status,
              d.menu_source_url
            )
        ) as has_menu,
        case
          when params.lat is not null and params.lng is not null then
            st_distance(
              coalesce(v.location, b.location),
              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
            )
          else null
        end as request_distance_meters
      from venues v
      join buildings b on b.id = v.building_id
      cross join params
      where params.area_requested
        and params.area_found
        and lower(trim(v.planning_area)) = params.area_key

      union all

      select
        v.id,
        v.name,
        v.logo_url as venue_logo_url,
        v.building_id,
        v.planning_area as venue_planning_area,
        v.is_open,
        v.operating_hours as venue_operating_hours,
        v.location as venue_location,
        v.image_url as venue_image_url,
        v.media_approved_for_display as venue_media_approved_for_display,
        v.media_rights_status as venue_media_rights_status,
        v.media_source_url as venue_media_source_url,
        v.menu_approved_for_display as venue_menu_approved_for_display,
        v.menu_rights_status as venue_menu_rights_status,
        v.menu_source_url as venue_menu_source_url,
        v.cuisine_tags as venue_cuisine_tags,
        b.name as building_name,
        b.planning_area as building_planning_area,
        b.location as building_location,
        b.image_url as building_image_url,
        b.media_approved_for_display as building_media_approved_for_display,
        b.media_rights_status as building_media_rights_status,
        b.media_source_url as building_media_source_url,
        b.is_closed_today,
        exists (
          select 1
          from dishes d
          where d.venue_id = v.id
            and d.price > 0
            and public.catalog_menu_is_displayable(
              d.menu_approved_for_display,
              d.menu_rights_status,
              d.menu_source_url
            )
        ) as has_menu,
        case
          when params.lat is not null and params.lng is not null then
            st_distance(
              coalesce(v.location, b.location),
              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
            )
          else null
        end as request_distance_meters
      from venues v
      join buildings b on b.id = v.building_id
      cross join params
      where params.area_requested
        and params.area_found
        and v.planning_area is null
        and lower(trim(b.planning_area)) = params.area_key

      union all

      select
        v.id,
        v.name,
        v.logo_url as venue_logo_url,
        v.building_id,
        v.planning_area as venue_planning_area,
        v.is_open,
        v.operating_hours as venue_operating_hours,
        v.location as venue_location,
        v.image_url as venue_image_url,
        v.media_approved_for_display as venue_media_approved_for_display,
        v.media_rights_status as venue_media_rights_status,
        v.media_source_url as venue_media_source_url,
        v.menu_approved_for_display as venue_menu_approved_for_display,
        v.menu_rights_status as venue_menu_rights_status,
        v.menu_source_url as venue_menu_source_url,
        v.cuisine_tags as venue_cuisine_tags,
        b.name as building_name,
        b.planning_area as building_planning_area,
        b.location as building_location,
        b.image_url as building_image_url,
        b.media_approved_for_display as building_media_approved_for_display,
        b.media_rights_status as building_media_rights_status,
        b.media_source_url as building_media_source_url,
        b.is_closed_today,
        exists (
          select 1
          from dishes d
          where d.venue_id = v.id
            and d.price > 0
            and public.catalog_menu_is_displayable(
              d.menu_approved_for_display,
              d.menu_rights_status,
              d.menu_source_url
            )
        ) as has_menu,
        case
          when params.lat is not null and params.lng is not null then
            st_distance(
              coalesce(v.location, b.location),
              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
            )
          else null
        end as request_distance_meters
      from venues v
      join buildings b on b.id = v.building_id
      cross join params
      where not (params.area_requested and params.area_found)
        and (
          params.lat is null
          or params.lng is null
          or st_dwithin(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
            params.radius_meters
          )
        )
    ) filtered
    order by coalesce(filtered.building_id = p_building_id, false) desc, filtered.has_menu desc, filtered.request_distance_meters asc nulls last
    limit 500
  ),
  candidates as (
    select
      cv.id as venue_id,
      cv.name as venue_name,
      nullif(trim(cv.venue_logo_url), '') as venue_logo_url,
      cv.building_id,
      cv.building_name,
      coalesce(cv.venue_planning_area, cv.building_planning_area) as planning_area,
      cv.is_open,
      nullif(trim(cv.venue_operating_hours), '') as operating_hours,
      coalesce(cv.request_distance_meters, 0)::integer as distance_meters,
      top_dish.id as top_dish_id,
      top_dish.name as top_dish_name,
      coalesce(
        top_dish_image.url,
        public.catalog_display_image_url(top_dish.image_url, top_dish.media_approved_for_display, top_dish.media_rights_status, top_dish.media_source_url),
        public.catalog_display_image_url(cv.venue_image_url, cv.venue_media_approved_for_display, cv.venue_media_rights_status, cv.venue_media_source_url),
        public.catalog_display_image_url(cv.building_image_url, cv.building_media_approved_for_display, cv.building_media_rights_status, cv.building_media_source_url)
      ) as top_dish_image,
      top_dish.rating_avg as top_dish_rating,
      top_dish.review_count as top_dish_review_count,
      top_dish.price as top_dish_price,
      coalesce(cv.venue_cuisine_tags, '{}'::text[]) as cuisine_tags,
      (
        case when not cv.is_closed_today then 0.320 else 0 end
        + case
            when cv.request_distance_meters is null then 0
            else greatest(0, 0.320 - least(cv.request_distance_meters, 3000)::double precision / 10000)
          end
        + least(coalesce(top_dish.rating_avg, 0)::double precision / 5, 1) * 0.260
        + public.catalog_venue_menu_priority_score(
            cv.id,
            cv.venue_menu_approved_for_display,
            cv.venue_menu_rights_status,
            cv.venue_menu_source_url
          )
      )::double precision as rank_score
    from candidate_venues cv
    cross join params
    left join lateral (
      select d.*
      from dishes d
      where d.venue_id = cv.id
        and d.price > 0
        and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
      order by
        exists (
          select 1
          from dish_images di
          where di.dish_id = d.id
            and public.catalog_display_image_url(
              di.url,
              di.media_approved_for_display,
              di.media_rights_status,
              di.media_source_url
            ) is not null
        ) desc,
        (public.catalog_display_image_url(
          d.image_url,
          d.media_approved_for_display,
          d.media_rights_status,
          d.media_source_url
        ) is not null) desc,
        d.must_order desc,
        d.is_featured desc,
        d.rating_avg desc,
        d.review_count desc,
        d.id
      limit 1
    ) top_dish on true
    left join lateral (
      select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
      from dish_images di
      where di.dish_id = top_dish.id
        and public.catalog_display_image_url(
          di.url,
          di.media_approved_for_display,
          di.media_rights_status,
          di.media_source_url
        ) is not null
      order by di.sort_order
      limit 1
    ) top_dish_image on true
  )
  select
    candidates.venue_id,
    candidates.venue_name,
    candidates.venue_logo_url,
    candidates.building_id,
    candidates.building_name,
    candidates.planning_area,
    candidates.is_open,
    candidates.operating_hours,
    candidates.distance_meters,
    candidates.top_dish_id,
    candidates.top_dish_name,
    candidates.top_dish_image,
    candidates.top_dish_rating,
    candidates.top_dish_review_count,
    candidates.top_dish_price,
    candidates.cuisine_tags,
    candidates.rank_score
  from (
    select
      candidates.*,
      row_number() over (
        partition by coalesce(candidates.building_id = p_building_id, false)
        order by
          (nullif(trim(candidates.top_dish_image), '') is not null) desc,
          (candidates.top_dish_id is not null) desc,
          candidates.rank_score desc,
          candidates.distance_meters,
          candidates.venue_id
      ) as place_rank
    from candidates
  ) candidates
  order by
    -- Stalls in the viewer's own building first, but at most 60 of them, so a big mall
    -- never crowds out everything else in the feed.
    (coalesce(candidates.building_id = p_building_id, false) and candidates.place_rank <= 60) desc,
    (nullif(trim(candidates.top_dish_image), '') is not null) desc,
    (candidates.top_dish_id is not null) desc,
    candidates.rank_score desc,
    candidates.distance_meters,
    candidates.venue_id
  limit (select result_limit from params);
$$;

grant execute on function public.get_discovery_feed_by_location(
  text,
  double precision,
  double precision,
  integer,
  integer,
  text
) to anon, authenticated;

commit;
