-- Map pins: search, an honest "Top Rated", the nearest pins, and a building type.
--   M19: p_query, so a map search keeps its results on the map as pins. It matches a
--        stall name, its building, or a dish / food type on its menu (the same rule
--        catalog_raw_venues_page uses). Empty or null means no text filter.
--   M12: p_min_rating also needs at least 3 reviews on the card's rated dish, so one
--        5-star review on one dish no longer makes a stall "Top Rated".
--   M14: the 500-pin cap keeps the pins nearest the viewport centre, not the highest
--        rated, so panning never leaves a gap next to the diner.
--   M9:  venue pins carry building_type so the map can colour them by what they are.
-- Body otherwise unchanged from 20260713120000_versioned_raw_catalog_reads.sql
-- (the latest definition; 20260714163100 and 20261019210000 only changed grants).
--
-- Redefines: public.catalog_raw_map_view  SECURITY DEFINER (unchanged). A new
-- trailing parameter changes the signature, so the old one is dropped first.

begin;

drop function if exists public.catalog_raw_map_view(
  double precision, double precision, double precision, double precision, double precision,
  uuid, double precision, double precision, integer, text[], text[], boolean, numeric
);

create or replace function public.catalog_raw_map_view(
  p_min_lat double precision, p_min_lng double precision, p_max_lat double precision, p_max_lng double precision,
  p_zoom double precision, p_release_id uuid default null, p_near_lat double precision default null,
  p_near_lng double precision default null, p_radius_meters integer default null,
  p_building_types text[] default '{}', p_cuisine_tags text[] default '{}', p_open_only boolean default false,
  p_min_rating numeric default null, p_query text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_release uuid;
  v_items jsonb;
  v_cell numeric := case when p_zoom < 12 then 0.08 when p_zoom < 14 then 0.02 else 0.004 end;
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_center geography := st_setsrid(st_makepoint((p_min_lng + p_max_lng) / 2, (p_min_lat + p_max_lat) / 2), 4326)::geography;
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  if p_zoom < 14 then
    select coalesce(jsonb_agg(jsonb_build_object('kind','cluster','id',cell,'latitude',avg(latitude),'longitude',avg(longitude),'count',count(*))), '[]'::jsonb) into v_items
    from (
      select floor(c.latitude / v_cell)::text || ':' || floor(c.longitude / v_cell)::text as cell, c.latitude, c.longitude
      from public.catalog_raw_venue_cards c
      where c.release_id = v_release and c.latitude between p_min_lat and p_max_lat and c.longitude between p_min_lng and p_max_lng
        and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
        and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
        and (p_open_only = false or c.is_open)
        and (p_min_rating is null or (c.quality_rating >= p_min_rating and c.quality_review_count >= 3))
        and (p_near_lat is null or p_near_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_near_lng, p_near_lat), 4326)::geography, p_radius_meters))
        and (v_query is null
          or c.name % v_query or c.name ilike '%' || v_query || '%'
          or c.building_name % v_query or c.building_name ilike '%' || v_query || '%'
          or exists (
            select 1 from public.catalog_raw_dish_cards dc
            where dc.release_id = v_release and dc.venue_id = c.id
              and (dc.name % v_query or dc.name ilike '%' || v_query || '%' or dc.food_type ilike '%' || v_query || '%' or dc.food_type % v_query)
          ))
    ) cells;
  else
    select coalesce(jsonb_agg(jsonb_build_object('kind','venue','id',id,'label',name,'latitude',latitude,'longitude',longitude,'verification_status',verification_status,'building_type',building_type)), '[]'::jsonb) into v_items
    from (
      select c.* from public.catalog_raw_venue_cards c
      where c.release_id = v_release and c.latitude between p_min_lat and p_max_lat and c.longitude between p_min_lng and p_max_lng
        and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
        and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
        and (p_open_only = false or c.is_open)
        and (p_min_rating is null or (c.quality_rating >= p_min_rating and c.quality_review_count >= 3))
        and (p_near_lat is null or p_near_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_near_lng, p_near_lat), 4326)::geography, p_radius_meters))
        and (v_query is null
          or c.name % v_query or c.name ilike '%' || v_query || '%'
          or c.building_name % v_query or c.building_name ilike '%' || v_query || '%'
          or exists (
            select 1 from public.catalog_raw_dish_cards dc
            where dc.release_id = v_release and dc.venue_id = c.id
              and (dc.name % v_query or dc.name ilike '%' || v_query || '%' or dc.food_type ilike '%' || v_query || '%' or dc.food_type % v_query)
          ))
      order by st_distance(c.listing_location, v_center) asc, c.quality_rating desc, c.quality_review_count desc, c.id limit 500
    ) venues;
  end if;
  return jsonb_build_object('release_id', v_release, 'items', v_items);
end;
$$;

-- Guests browse the map too (20261019210000_guest_catalog_raw_reads.sql).
revoke all on function public.catalog_raw_map_view(
  double precision, double precision, double precision, double precision, double precision,
  uuid, double precision, double precision, integer, text[], text[], boolean, numeric, text
) from public;
grant execute on function public.catalog_raw_map_view(
  double precision, double precision, double precision, double precision, double precision,
  uuid, double precision, double precision, integer, text[], text[], boolean, numeric, text
) to anon, authenticated;

commit;
