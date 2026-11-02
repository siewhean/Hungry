-- Undo 20261102090000_catalog_raw_map_view_cluster_aggregate: puts back the original zoomed-out
-- branch (which fails with 42803 when called at zoom < 14; the app asks for zoom >= 14).
-- Nothing is stored, so no data is lost.

do $$
declare
  v_sig constant regprocedure :=
    'public.catalog_raw_map_view(double precision,double precision,double precision,double precision,double precision,uuid,double precision,double precision,integer,text[],text[],boolean,numeric,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_head constant text := E'select coalesce(jsonb_agg(jsonb_build_object(''kind'',''cluster'',''id'',g.cell,''latitude'',g.lat,''longitude'',g.lng,''count'',g.n)), ''[]''::jsonb) into v_items\n    from (\n      select cell, avg(latitude) as lat, avg(longitude) as lng, count(*) as n\n      from (\n      select floor(';
  v_head_old constant text := E'select coalesce(jsonb_agg(jsonb_build_object(''kind'',''cluster'',''id'',cell,''latitude'',avg(latitude),''longitude'',avg(longitude),''count'',count(*))), ''[]''::jsonb) into v_items\n    from (\n      select floor(';
  v_tail constant text := E'    ) cells\n      group by cell\n    ) g;\n  else';
  v_tail_old constant text := E'    ) cells;\n  else';
begin
  if position('group by cell' in v_def) = 0 then
    return;
  end if;
  execute replace(replace(v_def, v_head, v_head_old), v_tail, v_tail_old);
end;
$$;
