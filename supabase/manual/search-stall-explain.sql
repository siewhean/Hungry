-- Why is the stall name lookup slow? (reads only; run as the postgres role, everything is rolled back)
-- Shows the plan of the stall name lookup for the word "chicken" three ways (as the function runs
-- it, only the ILIKE half, only the fuzzy <% half), then the same three with index-only scans
-- switched off for this session, which is the change under test.
--   psql "$DB_URL" -P pager=off -f supabase/manual/search-stall-explain.sql
\set ON_ERROR_STOP on
\pset pager off
begin;
set local search_path = public, extensions;
select public.catalog_raw_release_for_read(null) as rel \gset

\echo === default planner: as the function runs it
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and (c.name ilike any (array['%chicken%']) or 'chicken' <% c.name);
\echo === default planner: ILIKE only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and c.name ilike any (array['%chicken%']);
\echo === default planner: fuzzy only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and 'chicken' <% c.name;

set local enable_indexonlyscan = off;
\echo === index-only scans off: as the function runs it
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and (c.name ilike any (array['%chicken%']) or 'chicken' <% c.name);
\echo === index-only scans off: ILIKE only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and c.name ilike any (array['%chicken%']);
\echo === index-only scans off: fuzzy only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and 'chicken' <% c.name;
rollback;
