-- smoke: supabase/smoke/catalog_raw_map_view_cluster_aggregate.sql
-- Map clusters (REACT-NATIVE-1Y, "aggregate function calls cannot be nested", SQLSTATE 42803).
-- catalog_raw_map_view's zoomed-out branch (p_zoom < 14) wrote
--   jsonb_agg(jsonb_build_object(... avg(latitude), avg(longitude), count(*)))
-- over un-grouped rows: an aggregate inside an aggregate, with no GROUP BY, so every call at
-- zoom < 14 failed and the Home map showed "Couldn't load places". It now groups the venue cards
-- by grid cell first (avg / count per cell) and aggregates the cells into JSON. The zoomed-in
-- branch and every filter are untouched.
-- Patched in place from the live body (as 20261101090000 did); each patch checks it matched.
-- Rollback: supabase/rollbacks/20261102090000_catalog_raw_map_view_cluster_aggregate.down.sql.

do $$
declare
  v_sig constant regprocedure :=
    'public.catalog_raw_map_view(double precision,double precision,double precision,double precision,double precision,uuid,double precision,double precision,integer,text[],text[],boolean,numeric,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_head constant text := E'select coalesce(jsonb_agg(jsonb_build_object(''kind'',''cluster'',''id'',cell,''latitude'',avg(latitude),''longitude'',avg(longitude),''count'',count(*))), ''[]''::jsonb) into v_items\n    from (\n      select floor(';
  v_head_new constant text := E'select coalesce(jsonb_agg(jsonb_build_object(''kind'',''cluster'',''id'',g.cell,''latitude'',g.lat,''longitude'',g.lng,''count'',g.n)), ''[]''::jsonb) into v_items\n    from (\n      select cell, avg(latitude) as lat, avg(longitude) as lng, count(*) as n\n      from (\n      select floor(';
  v_tail constant text := E'    ) cells;\n  else';
  v_tail_new constant text := E'    ) cells\n      group by cell\n    ) g;\n  else';
begin
  if position(v_head in v_def) = 0 or position(v_tail in v_def) = 0 then
    if position('group by cell' in v_def) > 0 then
      return;
    end if;
    raise exception 'catalog_raw_map_view cluster branch not found; refusing to patch';
  end if;
  execute replace(replace(v_def, v_head, v_head_new), v_tail, v_tail_new);
end;
$$;
