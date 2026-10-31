-- Where does stall text search spend its time? (reads only; run as the postgres role, everything is rolled back)
-- Replays the stages of public.catalog_raw_venues_page for one query and prints, per stage, how many
-- stalls it produced and how long it took (best of 3 runs, ms), then the whole call for comparison.
--   psql "$DB_URL" -v q="'chicken rice'" -f supabase/manual/search-stall-stages.sql
\set ON_ERROR_STOP on
\if :{?q}
\else
  \set q '''chicken rice'''
\endif
\set QUIET on
begin;
set local search_path = public, extensions;

create temp table stall_q as select :q::text as q;
create temp table stall_stages (step integer not null, label text not null, rows_out bigint, ms numeric not null);

do $$
declare
  v_q text := (select q from stall_q);
  v_release uuid := public.catalog_raw_release_for_read(null);
  v_slots integer[]; v_variants text[]; v_weights double precision[]; v_n integer;
  v_tok1 text; v_tok2 text; v_pat1 text[]; v_pat2 text[];
  v_started timestamptz; v_rows bigint; v_best numeric; v_ms numeric; v_run integer;
begin
  select array_agg(t.slot order by t.slot, t.variant), array_agg(t.variant order by t.slot, t.variant),
    array_agg(t.weight order by t.slot, t.variant), max(t.slot),
    max(t.variant) filter (where t.slot = 1 and t.is_token), max(t.variant) filter (where t.slot = 2 and t.is_token),
    array_agg(t.pattern) filter (where t.slot = 1), array_agg(t.pattern) filter (where t.slot = 2)
  into v_slots, v_variants, v_weights, v_n, v_tok1, v_tok2, v_pat1, v_pat2
  from app_private.catalog_search_terms(v_q) t;

  -- 1: dishes that answer any word (the dish_term_hits stage, grouped by stall)
  v_best := null;
  for v_run in 1 .. 3 loop
    v_started := clock_timestamp();
    select count(*) into v_rows from (
      select dc.venue_id
      from public.catalog_raw_dish_cards dc
      cross join lateral (select app_private.catalog_dish_term_scores(v_slots, v_variants, v_weights, dc.name, dc.food_type) as s offset 0) t
      where dc.release_id = v_release
        and ((dc.name ilike any(v_pat1) or dc.food_type ilike any(v_pat1) or v_tok1 <% dc.name or v_tok1 <% dc.food_type)
          or (v_n >= 2 and (dc.name ilike any(v_pat2) or dc.food_type ilike any(v_pat2) or v_tok2 <% dc.name or v_tok2 <% dc.food_type)))
      group by dc.venue_id) x;
    v_ms := extract(epoch from clock_timestamp() - v_started) * 1000;
    v_best := least(coalesce(v_best, v_ms), v_ms);
  end loop;
  insert into stall_stages values (1, 'stalls with a dish matching word 1 or 2', v_rows, v_best);

  -- 2: stalls whose name matches word 1 (indexed lookup)
  v_best := null;
  for v_run in 1 .. 3 loop
    v_started := clock_timestamp();
    select count(*) into v_rows from public.catalog_raw_venue_cards c
    where c.release_id = v_release and (c.name ilike any(v_pat1) or v_tok1 <% c.name);
    v_ms := extract(epoch from clock_timestamp() - v_started) * 1000;
    v_best := least(coalesce(v_best, v_ms), v_ms);
  end loop;
  insert into stall_stages values (2, 'stalls whose name matches word 1', v_rows, v_best);

  -- 3: stalls whose building matches word 1
  v_best := null;
  for v_run in 1 .. 3 loop
    v_started := clock_timestamp();
    select count(*) into v_rows from public.catalog_raw_venue_cards c
    where c.release_id = v_release and (c.building_name ilike any(v_pat1) or v_tok1 <% c.building_name);
    v_ms := extract(epoch from clock_timestamp() - v_started) * 1000;
    v_best := least(coalesce(v_best, v_ms), v_ms);
  end loop;
  insert into stall_stages values (3, 'stalls whose building matches word 1', v_rows, v_best);

  -- 4: the whole call, as the app makes it
  v_best := null;
  for v_run in 1 .. 3 loop
    v_started := clock_timestamp();
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e5a1', true);
    perform public.catalog_raw_venues_page(p_query => v_q, p_limit => 24);
    v_ms := extract(epoch from clock_timestamp() - v_started) * 1000;
    v_best := least(coalesce(v_best, v_ms), v_ms);
  end loop;
  insert into stall_stages values (4, 'whole catalog_raw_venues_page call', null, v_best);
end;
$$;

select step, label, rows_out, round(ms, 1) as best_ms from stall_stages order by step;
rollback;
