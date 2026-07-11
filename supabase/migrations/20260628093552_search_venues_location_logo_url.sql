-- Expose venue logo URLs in location-scoped stall browsing.

begin;

drop function if exists public.search_venues_by_location(
  text,
  text,
  double precision,
  double precision,
  integer,
  integer
);

create function public.search_venues_by_location(
  p_query text default null,
  p_area_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_limit integer default 30
)
returns table (
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
      nullif(trim(coalesce(p_query, '')), '') as query,
      coalesce((select center_lat from area_match), p_lat) as lat,
      coalesce((select center_lng from area_match), p_lng) as lng,
      greatest(coalesce(p_radius_meters, 3000), 1) as radius_meters,
      least(greatest(coalesce(p_limit, 30), 1), 100) as result_limit,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from area_match) as area_found
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
          when concat_ws(' ', v.name, b.name, array_to_string(v.cuisine_tags, ' ')) ilike '%' || params.query || '%'
            then 0.55
          else 0
        end
      )
    end as rank_score
  from venues v
  join buildings b on b.id = v.building_id
  cross join params
  where (not params.area_requested or params.area_found)
    and (
      params.query is null
      or concat_ws(' ', v.name, b.name, array_to_string(v.cuisine_tags, ' ')) ilike '%' || params.query || '%'
      or v.name % params.query
      or b.name % params.query
    )
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
$$;

grant execute on function public.search_venues_by_location(
  text,
  text,
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;

commit;
