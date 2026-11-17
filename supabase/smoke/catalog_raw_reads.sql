-- Run after `catalog_raw_publish_release(...)` in a linked Supabase project.
-- The release totals are reported rather than hard-coded so the same smoke can
-- validate the next catalog import before it is promoted.

select 'active_catalog_release' as check_name,
       id::text || ': venues=' || venue_total::text || ', dishes=' || dish_total::text as detail
from public.catalog_releases
where status = 'active';

select 'raw_catalog_dishes_authenticated_only' as check_name,
       has_function_privilege(
         'authenticated',
         'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])',
         'execute'
       )::text as detail;

select 'raw_catalog_dishes_not_anon' as check_name,
       (not has_function_privilege(
         'anon',
         'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])',
         'execute'
       ))::text as detail;

select 'raw_catalog_read_indexes' as check_name,
       count(*)::text as detail
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'catalog_raw_venue_cards_release_quality_idx',
    'catalog_raw_dish_cards_release_quality_idx',
    'catalog_raw_dish_cards_release_venue_idx'
  );

select 'raw_catalog_projections_rls_and_no_direct_reads' as check_name,
       bool_and(relrowsecurity and not has_table_privilege('anon', relname, 'select') and not has_table_privilege('authenticated', relname, 'select'))::text as detail
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('catalog_releases', 'catalog_raw_venue_cards', 'catalog_raw_dish_cards', 'catalog_raw_dish_media');
