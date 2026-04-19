-- Phase 7 smoke: verify PostGIS geography distance is working on known fixture points.
-- Maxwell Food Centre: 1.28011, 103.84439
-- Lau Pa Sat:          1.28059, 103.85086

select
  st_distance(
    st_setsrid(st_makepoint(103.84439, 1.28011), 4326)::geography,
    st_setsrid(st_makepoint(103.85086, 1.28059), 4326)::geography
  ) as distance_meters;
