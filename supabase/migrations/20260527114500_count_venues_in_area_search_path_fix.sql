-- Ensure discover venue count RPC resolves PostGIS types/functions if PostGIS is in extensions schema.
create or replace function public.count_venues_in_area(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer default 3000
)
returns integer
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select count(v.id)::integer
  from venues v
  join buildings b on b.id = v.building_id
  where
    p_lat is not null
    and p_lng is not null
    and (
      nullif(p_radius_meters, 0) is null
      or st_dwithin(
        b.location,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
        p_radius_meters
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.count_venues_in_area(
  double precision,
  double precision,
  integer
) TO anon, authenticated;
