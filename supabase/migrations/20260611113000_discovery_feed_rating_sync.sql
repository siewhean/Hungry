-- Keep Discover feed ratings aligned with dish detail/search/stall detail.

drop function if exists public.get_discovery_feed_by_location(text, double precision, double precision, integer, integer);

create or replace function public.get_discovery_feed_by_location(
  p_area_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_limit integer default 50
)
returns table (
  venue_id text,
  venue_name text,
  building_id text,
  building_name text,
  planning_area text,
  is_open boolean,
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
    select center_lat, center_lng
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
      exists (select 1 from area_match) as area_found
  ),
  candidates as (
    select
      v.id as venue_id,
      v.name as venue_name,
      v.building_id,
      b.name as building_name,
      coalesce(v.planning_area, b.planning_area) as planning_area,
      v.is_open,
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
          )::integer
        else 0
      end as distance_meters,
      top_dish.id as top_dish_id,
      top_dish.name as top_dish_name,
      coalesce(
        top_dish_image.url,
        public.catalog_display_image_url(top_dish.image_url, top_dish.media_approved_for_display, top_dish.media_rights_status, top_dish.media_source_url),
        public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url),
        public.catalog_display_image_url(b.image_url, b.media_approved_for_display, b.media_rights_status, b.media_source_url)
      ) as top_dish_image,
      top_dish.rating_avg as top_dish_rating,
      top_dish.review_count as top_dish_review_count,
      top_dish.price as top_dish_price,
      coalesce(v.cuisine_tags, '{}'::text[]) as cuisine_tags,
      (
        case when v.is_open and not b.is_closed_today then 0.35 else 0 end
        + greatest(0, 0.35 - least(coalesce(top_dish.distance_meters, 0), 3000)::double precision / 10000)
        + least(coalesce(top_dish.rating_avg, 0)::double precision / 5, 1) * 0.30
      )::double precision as rank_score
    from venues v
    join buildings b on b.id = v.building_id
    cross join params
    left join lateral (
      select d.*
      from dishes d
      where d.venue_id = v.id
        and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
      order by d.must_order desc, d.is_featured desc, d.rating_avg desc, d.id
      limit 1
    ) top_dish on true
    left join lateral (
      select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
      from dish_images di
      where di.dish_id = top_dish.id
      order by di.sort_order
      limit 1
    ) top_dish_image on true
    where (not params.area_requested or params.area_found)
      and (
        (
          params.area_requested
          and lower(trim(coalesce(v.planning_area, b.planning_area, ''))) = lower(trim(p_area_name))
        )
        or params.lat is null
        or params.lng is null
        or st_dwithin(
          coalesce(v.location, b.location),
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
          params.radius_meters
        )
      )
      and top_dish.id is not null
  )
  select
    candidates.venue_id,
    candidates.venue_name,
    candidates.building_id,
    candidates.building_name,
    candidates.planning_area,
    candidates.is_open,
    candidates.distance_meters,
    candidates.top_dish_id,
    candidates.top_dish_name,
    candidates.top_dish_image,
    candidates.top_dish_rating,
    candidates.top_dish_review_count,
    candidates.top_dish_price,
    candidates.cuisine_tags,
    candidates.rank_score
  from candidates
  order by candidates.rank_score desc, candidates.distance_meters, candidates.venue_id
  limit (select result_limit from params);
$$;

grant execute on function public.get_discovery_feed_by_location(
  text,
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;
