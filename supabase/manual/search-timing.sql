-- Search timing on staging (read-only; nothing is written to the catalog).
-- Runs each Search page function 20 times as a signed-in user and prints p50, p95 and max in ms.
-- The functions are plpgsql, so EXPLAIN ANALYZE of a call shows only the total; this loop gives the
-- numbers the PR needs. Run it after the migration is applied, and again before it for a comparison:
--   psql "$STAGING_DB_URL" -f supabase/manual/search-timing.sql
-- Success: the p95 of every row stays under 300 ms.

\set ON_ERROR_STOP on

begin;

create temp table search_timing (label text not null, ms numeric not null);
grant all on search_timing to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e5a1', true);
set local role authenticated;

do $$
declare
  v_cases constant text[][] := array[
    array['dishes: chicken rice',        $q$select public.catalog_raw_dishes_page(p_query => 'chicken rice', p_limit => 24)$q$],
    array['dishes: rice',                $q$select public.catalog_raw_dishes_page(p_query => 'rice', p_limit => 24)$q$],
    array['dishes: ice',                 $q$select public.catalog_raw_dishes_page(p_query => 'ice', p_limit => 24)$q$],
    array['dishes: teh',                 $q$select public.catalog_raw_dishes_page(p_query => 'teh', p_limit => 24)$q$],
    array['dishes: near, by quality',    $q$select public.catalog_raw_dishes_page(p_lat => 1.2804, p_lng => 103.8448, p_radius_meters => 3000, p_sort => 'quality', p_limit => 24)$q$],
    array['dishes: featured (limit 3)',  $q$select public.catalog_raw_dishes_page(p_sort => 'quality', p_limit => 3)$q$],
    array['stalls: chicken rice',        $q$select public.catalog_raw_venues_page(p_query => 'chicken rice', p_limit => 24)$q$],
    array['stalls: rice',                $q$select public.catalog_raw_venues_page(p_query => 'rice', p_limit => 24)$q$],
    array['stalls: near, by quality',    $q$select public.catalog_raw_venues_page(p_lat => 1.2804, p_lng => 103.8448, p_radius_meters => 3000, p_sort => 'quality', p_limit => 24)$q$],
    array['suggest: (no text)',          $q$select public.catalog_suggest(null, 8)$q$],
    array['suggest: lak',                $q$select public.catalog_suggest('lak', 8)$q$],
    array['suggest: chicken',            $q$select public.catalog_suggest('chicken', 8)$q$]
  ];
  v_i integer;
  v_run integer;
  v_started timestamptz;
begin
  for v_i in 1 .. array_length(v_cases, 1) loop
    for v_run in 1 .. 20 loop
      v_started := clock_timestamp();
      -- n-plus-one-ok: a timing loop runs the same call repeatedly on purpose
      execute v_cases[v_i][2];
      insert into search_timing values (v_cases[v_i][1], extract(epoch from clock_timestamp() - v_started) * 1000);
    end loop;
  end loop;
end;
$$;

select label,
       round((percentile_cont(0.5) within group (order by ms))::numeric, 1) as p50_ms,
       round((percentile_cont(0.95) within group (order by ms))::numeric, 1) as p95_ms,
       round(max(ms), 1) as max_ms
from search_timing
group by label
order by label;

rollback;
