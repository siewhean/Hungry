-- Undo 20261101090000_discovery_feed_nearby_prefilter: the Home feed goes back to the body that
-- looks up every venue's menu and tests the radius on all venues. Nothing is stored, so no data
-- is lost.

do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_menu constant text := E'        exists (select 1 from menu_venues mv where mv.venue_id = v.id) as has_menu,\n';
  v_menu_old constant text := E'        exists (\n          select 1\n          from dishes d\n          where d.venue_id = v.id\n            and d.archived_at is null\n            and d.price > 0\n            and public.catalog_menu_is_displayable(\n              d.menu_approved_for_display,\n              d.menu_rights_status,\n              d.menu_source_url\n            )\n        ) as has_menu,\n';
  v_cte constant text := E'  menu_venues as materialized (\n    select distinct d.venue_id\n    from dishes d\n    where d.archived_at is null\n      and d.price > 0\n      and public.catalog_menu_is_displayable(\n        d.menu_approved_for_display,\n        d.menu_rights_status,\n        d.menu_source_url\n      )\n  ),\n  near_venues as materialized (\n    select v.id\n    from venues v\n    where v.location is not null\n      and (\n        select p.lat is not null and p.lng is not null and not (p.area_requested and p.area_found)\n        from params p\n      )\n      and not exists (select 1 from app_private.catalog_excluded_venues ex where ex.venue_id = v.id)\n      and st_dwithin(\n        v.location,\n        (select st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography from params p),\n        (select p.radius_meters from params p)\n      )\n    order by v.location <-> (select st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography from params p)\n    limit 500\n  ),\n  candidate_venues as materialized (\n';
  v_cte_old constant text := E'  candidate_venues as materialized (\n';
  v_near constant text := E'          or (\n            st_dwithin(\n              coalesce(v.location, b.location),\n              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,\n              params.radius_meters\n            )\n            and (\n              v.location is null\n              or v.building_id = p_building_id\n              or exists (select 1 from menu_venues mv where mv.venue_id = v.id)\n              or v.id in (select nv.id from near_venues nv)\n            )\n          )\n        )\n';
  v_near_old constant text := E'          or st_dwithin(\n            coalesce(v.location, b.location),\n            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,\n            params.radius_meters\n          )\n        )\n';
begin
  if position('near_venues' in v_def) = 0 then
    return;
  end if;
  execute replace(replace(replace(v_def, v_menu, v_menu_old), v_cte, v_cte_old), v_near, v_near_old);
end;
$$;
