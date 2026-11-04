-- smoke: supabase/smoke/discovery_feed_nearby_prefilter.sql
-- Home feed speed. get_discovery_feed_by_location read every venue (29,611 on prod) to pick its
-- 500 candidates: the radius test wraps coalesce(v.location, b.location), which stops
-- idx_venues_location being used, and has_menu ran a dishes lookup for every venue. On prod the
-- candidate stage took about 410 ms and the whole call 360 to 2,700 ms.
--
-- Now, for a "near me" call (lat/lng given, no named area):
-- 1. menu_venues lists the venues with a displayable priced dish once, and has_menu looks the
--    venue up in it (all three candidate queries, including the named-area ones).
-- 2. near_venues takes the 500 nearest venues through the GiST index (KNN). The candidate query
--    keeps a venue in range only if it is among those, has a menu, is in the viewer's building,
--    or has no location of its own. The 500 candidates are the viewer's building first, then
--    venues with a menu, then the nearest of the rest, so this changes nothing but ties at the
--    same distance: the nearest 500 always hold the 500 minus (menu + building venues) plain
--    venues that are needed.
-- The ranking, the top dish and the output are untouched. Patched in place from the live body
-- (as 20261025090000 and 20261029140000 did) so this file does not restate the function; every
-- patch checks its hit count.
-- Rollback: supabase/rollbacks/20261101090000_discovery_feed_nearby_prefilter.down.sql.

do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_find_menu constant text := E'        exists (\n          select 1\n          from dishes d\n          where d.venue_id = v.id\n            and d.archived_at is null\n            and d.price > 0\n            and public.catalog_menu_is_displayable(\n              d.menu_approved_for_display,\n              d.menu_rights_status,\n              d.menu_source_url\n            )\n        ) as has_menu,\n';
  v_repl_menu constant text := E'        exists (select 1 from menu_venues mv where mv.venue_id = v.id) as has_menu,\n';
  v_find_cte constant text := E'  candidate_venues as materialized (\n';
  v_repl_cte constant text := E'  menu_venues as materialized (\n    select distinct d.venue_id\n    from dishes d\n    where d.archived_at is null\n      and d.price > 0\n      and public.catalog_menu_is_displayable(\n        d.menu_approved_for_display,\n        d.menu_rights_status,\n        d.menu_source_url\n      )\n  ),\n  near_venues as materialized (\n    select v.id\n    from venues v\n    where v.location is not null\n      and (\n        select p.lat is not null and p.lng is not null and not (p.area_requested and p.area_found)\n        from params p\n      )\n      and not exists (select 1 from app_private.catalog_excluded_venues ex where ex.venue_id = v.id)\n      and st_dwithin(\n        v.location,\n        (select st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography from params p),\n        (select p.radius_meters from params p)\n      )\n    order by v.location <-> (select st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography from params p)\n    limit 500\n  ),\n  candidate_venues as materialized (\n';
  v_find_near constant text := E'          or st_dwithin(\n            coalesce(v.location, b.location),\n            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,\n            params.radius_meters\n          )\n        )\n';
  v_repl_near constant text := E'          or (\n            st_dwithin(\n              coalesce(v.location, b.location),\n              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,\n              params.radius_meters\n            )\n            and (\n              v.location is null\n              or v.building_id = p_building_id\n              or exists (select 1 from menu_venues mv where mv.venue_id = v.id)\n              or v.id in (select nv.id from near_venues nv)\n            )\n          )\n        )\n';
  v_hits integer;
begin
  if position('near_venues' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_menu, ''))) / length(v_find_menu);
  if v_hits <> 3 then
    raise exception 'get_discovery_feed_by_location: expected 3 has_menu subqueries, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_cte, ''))) / length(v_find_cte);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 candidate_venues CTE, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_near, ''))) / length(v_find_near);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 radius test, found %', v_hits;
  end if;
  execute replace(replace(replace(v_def, v_find_menu, v_repl_menu), v_find_cte, v_repl_cte), v_find_near, v_repl_near);
end;
$$;
