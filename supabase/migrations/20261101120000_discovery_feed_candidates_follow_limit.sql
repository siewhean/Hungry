-- smoke: supabase/smoke/discovery_feed_candidates_follow_limit.sql
-- Home first page. get_discovery_feed_by_location always ranked 500 candidate stalls, even when
-- the app asked for a handful, so asking for fewer stalls did not make the call faster (about
-- 250 ms warm on prod, the top-dish lookup for every candidate).
--
-- The candidate count now follows the number of stalls asked for: 10 times p_limit, at least 100
-- and at most 500. The app's full read (p_limit 100) and any p_limit of 50 or more still rank
-- 500, exactly as before. A small first read (p_limit 10) ranks 100: the viewer's building first,
-- then stalls with a menu, then the nearest of the rest, so it holds the same leading stalls.
-- The 500-nearest pre-filter from 20261101090000 uses the same count; the nearest N always hold
-- the N minus (menu + building stalls) plain stalls that are needed.
-- Patched in place from the live body (as 20261101090000 did); each patch checks its hit count.
-- Rollback: supabase/rollbacks/20261101120000_discovery_feed_candidates_follow_limit.down.sql.

do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_find_near constant text := E'    limit 500\n  ),\n  candidate_venues as materialized (\n';
  v_repl_near constant text := E'    limit (select least(500, greatest(100, p.result_limit * 10)) from params p)\n  ),\n  candidate_venues as materialized (\n';
  v_find_cand constant text := E'filtered.request_distance_meters asc nulls last\n    limit 500\n  ),\n';
  v_repl_cand constant text := E'filtered.request_distance_meters asc nulls last\n    limit (select least(500, greatest(100, p.result_limit * 10)) from params p)\n  ),\n';
  v_hits integer;
begin
  if position('greatest(100, p.result_limit * 10)' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_near, ''))) / length(v_find_near);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 near_venues limit, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_cand, ''))) / length(v_find_cand);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 candidate limit, found %', v_hits;
  end if;
  execute replace(replace(v_def, v_find_near, v_repl_near), v_find_cand, v_repl_cand);
end;
$$;
