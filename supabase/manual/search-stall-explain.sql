-- Why is the stall name lookup slow? (reads only; run as the postgres role, everything is rolled back)
-- Shows the venue cards per release, the index sizes, and the plan of the name lookup for the word
-- "chicken" three ways: exactly as the function runs it, with only the ILIKE half, and with only the
-- fuzzy (<%) half. Then the same for "rice".
--   psql "$DB_URL" -f supabase/manual/search-stall-explain.sql
\set ON_ERROR_STOP on
begin;
set local search_path = public, extensions;
select public.catalog_raw_release_for_read(null) as rel \gset

select release_id, count(*) as venue_cards from public.catalog_raw_venue_cards group by release_id order by 2 desc;
select relname, pg_size_pretty(pg_relation_size(oid)) as size from pg_class
where relname in ('catalog_raw_venue_cards', 'catalog_raw_venue_cards_name_idx', 'catalog_raw_venue_cards_building_name_idx');

\echo === chicken: as the function runs it
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and (c.name ilike any (array['%chicken%']) or 'chicken' <% c.name);
\echo === chicken: ILIKE only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and c.name ilike any (array['%chicken%']);
\echo === chicken: fuzzy only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and 'chicken' <% c.name;

\echo === rice: as the function runs it
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and (c.name ilike any (array['%rice%']) or 'rice' <% c.name);
\echo === rice: ILIKE only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and c.name ilike any (array['%rice%']);
\echo === rice: fuzzy only
explain (analyze, buffers) select c.id from public.catalog_raw_venue_cards c
where c.release_id = :'rel' and 'rice' <% c.name;
rollback;
