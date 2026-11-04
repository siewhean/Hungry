-- Undo 20261101120000_discovery_feed_candidates_follow_limit: the feed ranks 500 candidates again
-- whatever p_limit is. Nothing is stored, so no data is lost.

do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_near constant text := E'    limit (select least(500, greatest(100, p.result_limit * 10)) from params p)\n  ),\n  candidate_venues as materialized (\n';
  v_near_old constant text := E'    limit 500\n  ),\n  candidate_venues as materialized (\n';
  v_cand constant text := E'filtered.request_distance_meters asc nulls last\n    limit (select least(500, greatest(100, p.result_limit * 10)) from params p)\n  ),\n';
  v_cand_old constant text := E'filtered.request_distance_meters asc nulls last\n    limit 500\n  ),\n';
begin
  if position('greatest(100, p.result_limit * 10)' in v_def) = 0 then
    return;
  end if;
  execute replace(replace(v_def, v_near, v_near_old), v_cand, v_cand_old);
end;
$$;
