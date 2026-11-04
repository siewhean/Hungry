-- Smoke checks for Phase 2 server-side discovery read RPCs.
-- Each check should return zero rows except the final pass marker and sample calls.

with expected(function_name) as (
  values
    ('search_dishes'),
    ('get_dish_detail'),
    ('get_venue_detail'),
    ('get_nearby_open_venues')
),
actual as (
  select proname::text as function_name
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
)
select 'missing_function' as check_name, expected.function_name as detail
from expected
except
select 'missing_function', actual.function_name
from actual;

select 'security_definer_not_allowed' as check_name, proname::text as detail
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname in ('search_dishes', 'get_dish_detail', 'get_venue_detail', 'get_nearby_open_venues')
  and prosecdef is true;

with expected(indexname) as (
  values
    ('idx_dishes_rating_id'),
    ('idx_dishes_price_id'),
    ('idx_dishes_venue_rating_id'),
    ('idx_venues_open_building'),
    ('idx_dish_images_dish_order'),
    ('idx_reviews_dish_created'),
    ('idx_dish_dietary_flags_flag_dish')
),
actual as (
  select indexname::text
  from pg_indexes
  where schemaname = 'public'
)
select 'missing_index' as check_name, expected.indexname as detail
from expected
except
select 'missing_index', actual.indexname
from actual;

select 'missing_anon_execute' as check_name, 'search_dishes' as detail
where not has_function_privilege(
  'anon',
  'public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean,text[],text[])',
  'execute'
);
select 'missing_authenticated_execute' as check_name, 'search_dishes' as detail
where not has_function_privilege(
  'authenticated',
  'public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean,text[],text[])',
  'execute'
);
select 'missing_anon_execute' as check_name, 'get_dish_detail' as detail
where not has_function_privilege('anon', 'public.get_dish_detail(text)', 'execute');
select 'missing_authenticated_execute' as check_name, 'get_dish_detail' as detail
where not has_function_privilege('authenticated', 'public.get_dish_detail(text)', 'execute');
select 'missing_anon_execute' as check_name, 'get_venue_detail' as detail
where not has_function_privilege('anon', 'public.get_venue_detail(text)', 'execute');
select 'missing_authenticated_execute' as check_name, 'get_venue_detail' as detail
where not has_function_privilege('authenticated', 'public.get_venue_detail(text)', 'execute');
select 'missing_anon_execute' as check_name, 'get_nearby_open_venues' as detail
where not has_function_privilege(
  'anon',
  'public.get_nearby_open_venues(double precision,double precision,integer,integer,integer,text)',
  'execute'
);
select 'missing_authenticated_execute' as check_name, 'get_nearby_open_venues' as detail
where not has_function_privilege(
  'authenticated',
  'public.get_nearby_open_venues(double precision,double precision,integer,integer,integer,text)',
  'execute'
);

select 'search_dishes_sample' as check_name, count(*)::text as detail
from public.search_dishes(null, null, null, null, '{}'::text[], 3, null, null, null);

select 'nearby_open_venues_sample' as check_name, count(*)::text as detail
from public.get_nearby_open_venues(null, null, 2500, 3, null, null);

select 'server_side_discovery_reads_smoke_passed' as check_name, 'phase_2' as detail;
