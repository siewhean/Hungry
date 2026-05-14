-- Smoke checks for Phase 2 location/building directory read RPCs.
-- Failing checks return rows; sample calls and final pass marker are expected rows.

with expected(function_name) as (
  values
    ('list_buildings'),
    ('list_venues_by_building'),
    ('get_building_detail')
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
  and proname in ('list_buildings', 'list_venues_by_building', 'get_building_detail')
  and prosecdef;

with expected(indexname) as (
  values
    ('idx_buildings_location'),
    ('idx_building_floors_building_sort_label'),
    ('idx_venues_building_id'),
    ('idx_venues_building_floor_id'),
    ('idx_dishes_building_rating_id')
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

with expected(signature) as (
  values
    ('public.list_buildings(double precision,double precision,integer,integer,integer,text)'),
    ('public.list_venues_by_building(text,boolean,integer,integer,text)'),
    ('public.get_building_detail(text)')
)
select 'missing_anon_execute' as check_name, signature as detail
from expected
where not has_function_privilege('anon', signature, 'execute');

with expected(signature) as (
  values
    ('public.list_buildings(double precision,double precision,integer,integer,integer,text)'),
    ('public.list_venues_by_building(text,boolean,integer,integer,text)'),
    ('public.get_building_detail(text)')
)
select 'missing_authenticated_execute' as check_name, signature as detail
from expected
where not has_function_privilege('authenticated', signature, 'execute');

select 'list_buildings_sample' as check_name, count(*)::text as detail
from public.list_buildings(null, null, null, 10, null, null);

select 'list_buildings_cursor_sample' as check_name, count(*)::text as detail
from public.list_buildings(null, null, null, 10, 0, '');

select 'get_building_detail_sample' as check_name, count(*)::text as detail
from public.get_building_detail((select id from public.buildings order by id limit 1));

select 'list_venues_by_building_sample' as check_name, count(*)::text as detail
from public.list_venues_by_building(
  (select id from public.buildings order by id limit 1),
  null,
  10,
  null,
  null
);

with sample_building as (
  select id, is_closed_today
  from public.buildings
  order by id
  limit 1
),
rpc_detail as (
  select detail.*
  from sample_building
  cross join public.get_building_detail(sample_building.id) detail
),
actual_counts as (
  select
    count(v.id)::integer as total_stalls,
    count(v.id) filter (where v.is_open = true and sample_building.is_closed_today = false)::integer as open_stalls
  from sample_building
  left join public.venues v on v.building_id = sample_building.id
)
select 'building_detail_count_mismatch' as check_name, rpc_detail.id as detail
from rpc_detail
cross join actual_counts
where rpc_detail.total_stalls <> actual_counts.total_stalls
  or rpc_detail.open_stalls <> actual_counts.open_stalls;

select 'location_directory_reads_smoke_passed' as check_name, 'phase_2_location' as detail;
