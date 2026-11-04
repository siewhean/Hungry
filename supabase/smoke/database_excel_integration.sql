with required_columns(table_name, column_name) as (
  values
    ('buildings', 'address'),
    ('buildings', 'postal_code'),
    ('buildings', 'planning_area'),
    ('venues', 'cuisine_tags'),
    ('venues', 'dietary_tags'),
    ('venues', 'location'),
    ('venues', 'google_place_id'),
    ('dishes', 'cuisine_tags'),
    ('staging_food_businesses', 'google_place_id'),
    ('staging_food_businesses', 'menu_items_text')
),
missing_columns as (
  select required_columns.*
  from required_columns
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = required_columns.table_name
   and c.column_name = required_columns.column_name
  where c.column_name is null
)
select 'missing_database_excel_columns' as check_name, json_agg(missing_columns)::text as detail
from missing_columns
having count(*) > 0;

with required_tables(table_name) as (
  values ('areas'), ('venue_images')
),
missing_tables as (
  select required_tables.table_name
  from required_tables
  left join information_schema.tables t
    on t.table_schema = 'public'
   and t.table_name = required_tables.table_name
  where t.table_name is null
)
select 'missing_database_excel_tables' as check_name, json_agg(missing_tables)::text as detail
from missing_tables
having count(*) > 0;

with required_functions(proname) as (
  values ('search_dishes'), ('get_discovery_feed_by_location'), ('search_venues_by_location')
),
missing_functions as (
  select required_functions.proname
  from required_functions
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = required_functions.proname
  )
)
select 'missing_database_excel_functions' as check_name, json_agg(missing_functions)::text as detail
from missing_functions
having count(*) > 0;

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

select 'missing_anon_execute' as check_name, 'get_discovery_feed_by_location' as detail
where not has_function_privilege(
  'anon',
  'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)',
  'execute'
);

select 'missing_authenticated_execute' as check_name, 'get_discovery_feed_by_location' as detail
where not has_function_privilege(
  'authenticated',
  'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)',
  'execute'
);

select 'missing_anon_execute' as check_name, 'search_venues_by_location' as detail
where not has_function_privilege(
  'anon',
  'public.search_venues_by_location(text,text,double precision,double precision,integer,integer)',
  'execute'
);

select 'missing_authenticated_execute' as check_name, 'search_venues_by_location' as detail
where not has_function_privilege(
  'authenticated',
  'public.search_venues_by_location(text,text,double precision,double precision,integer,integer)',
  'execute'
);

do $$
declare
  failure_count integer;
begin
  with required_columns(table_name, column_name) as (
    values
      ('buildings', 'address'),
      ('buildings', 'postal_code'),
      ('buildings', 'planning_area'),
      ('venues', 'cuisine_tags'),
      ('venues', 'dietary_tags'),
      ('venues', 'location'),
      ('venues', 'google_place_id'),
      ('dishes', 'cuisine_tags'),
      ('staging_food_businesses', 'google_place_id'),
      ('staging_food_businesses', 'menu_items_text')
  ),
  missing_columns as (
    select 1
    from required_columns
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = required_columns.table_name
     and c.column_name = required_columns.column_name
    where c.column_name is null
  ),
  required_tables(table_name) as (
    values ('areas'), ('venue_images')
  ),
  missing_tables as (
    select 1
    from required_tables
    left join information_schema.tables t
      on t.table_schema = 'public'
     and t.table_name = required_tables.table_name
    where t.table_name is null
  ),
  required_functions(proname) as (
    values ('search_dishes'), ('get_discovery_feed_by_location'), ('search_venues_by_location')
  ),
  missing_functions as (
    select 1
    from required_functions
    where not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = required_functions.proname
    )
  ),
  missing_grants as (
    select 1
    where not has_function_privilege(
      'anon',
      'public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean,text[],text[])',
      'execute'
    )
    union all
    select 1
    where not has_function_privilege(
      'authenticated',
      'public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean,text[],text[])',
      'execute'
    )
    union all
    select 1
    where not has_function_privilege(
      'anon',
      'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)',
      'execute'
    )
    union all
    select 1
    where not has_function_privilege(
      'authenticated',
      'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)',
      'execute'
    )
    union all
    select 1
    where not has_function_privilege(
      'anon',
      'public.search_venues_by_location(text,text,double precision,double precision,integer,integer)',
      'execute'
    )
    union all
    select 1
    where not has_function_privilege(
      'authenticated',
      'public.search_venues_by_location(text,text,double precision,double precision,integer,integer)',
      'execute'
    )
  )
  select count(*) into failure_count
  from (
    select 1 from missing_columns
    union all
    select 1 from missing_tables
    union all
    select 1 from missing_functions
    union all
    select 1 from missing_grants
  ) failures;

  if failure_count > 0 then
    raise exception 'database_excel_integration_smoke_failed: % check(s) failed', failure_count;
  end if;
end $$;

select 'database_excel_integration_smoke_passed' as check_name, '20260606120000' as detail;
