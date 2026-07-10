-- Smoke checks for canonical food-business CSV staging alignment.
-- Rows should be empty unless a required staging control is missing.

with expected(column_name) as (
  values
    ('business_id'),
    ('stall_id'),
    ('licence_no'),
    ('business_name'),
    ('normalized_name'),
    ('stall_type'),
    ('cuisine'),
    ('signature_dish'),
    ('menu_text'),
    ('price_text'),
    ('price_min_sgd'),
    ('price_max_sgd'),
    ('opening_hours_text'),
    ('closed_days'),
    ('hygiene_grade'),
    ('michelin_recognition'),
    ('dietary_options'),
    ('delivery_platforms'),
    ('contact'),
    ('instagram'),
    ('image_url'),
    ('building_name'),
    ('building_display_name'),
    ('unit_number'),
    ('address'),
    ('postal_code'),
    ('region'),
    ('location_text'),
    ('location_key'),
    ('latitude'),
    ('longitude'),
    ('source_type_label'),
    ('source_url'),
    ('last_verified_date'),
    ('coverage_status'),
    ('notes'),
    ('observed_location')
),
actual as (
  select column_name::text
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'staging_food_businesses'
)
select 'missing_staging_column' as check_name, expected.column_name as detail
from expected
except
select 'missing_staging_column', actual.column_name
from actual;

with expected(indexname) as (
  values
    ('idx_staging_food_businesses_business_id'),
    ('idx_staging_food_businesses_stall_id'),
    ('idx_staging_food_businesses_licence_no'),
    ('idx_staging_food_businesses_source_hash'),
    ('idx_staging_food_businesses_location'),
    ('idx_staging_food_businesses_coverage_status')
),
actual as (
  select indexname::text
  from pg_indexes
  where schemaname = 'public'
)
select 'missing_staging_index' as check_name, expected.indexname as detail
from expected
except
select 'missing_staging_index', actual.indexname
from actual;

select 'missing_csv_external_source' as check_name, 'singapore_food_businesses_csv' as detail
where not exists (
  select 1
  from external_sources
  where slug = 'singapore_food_businesses_csv'
    and source_type = 'spreadsheet'
    and trust_tier = 'staging'
);

with expected(conname) as (
  values
    ('staging_food_businesses_price_range_check'),
    ('staging_food_businesses_coverage_status_check')
),
actual as (
  select conname::text
  from pg_constraint
  join pg_class on pg_class.oid = pg_constraint.conrelid
  join pg_namespace on pg_namespace.oid = pg_class.relnamespace
  where pg_namespace.nspname = 'public'
    and pg_class.relname = 'staging_food_businesses'
)
select 'missing_staging_constraint' as check_name, expected.conname as detail
from expected
except
select 'missing_staging_constraint', actual.conname
from actual;

select 'unexpected_user_policy' as check_name, tablename || ':' || policyname as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'staging_food_businesses'
  and (
    'authenticated'::name = any(roles)
    or 'anon'::name = any(roles)
  );

with latest_import as (
  select *
  from import_runs
  where source_slug = 'singapore_food_businesses_csv'
    and source_file = 'data/singapore_food_businesses_canonical.csv'
  order by created_at desc
  limit 1
),
staged_counts as (
  select
    latest_import.id as import_run_id,
    count(staging_food_businesses.*)::integer as staged_rows,
    count(*) filter (where staging_food_businesses.source_hash is null)::integer as rows_without_source_hash,
    count(*) filter (where staging_food_businesses.raw_payload = '{}'::jsonb)::integer as rows_without_raw_payload,
    count(*) filter (where staging_food_businesses.parsed_payload = '{}'::jsonb)::integer as rows_without_parsed_payload
  from latest_import
  left join staging_food_businesses on staging_food_businesses.import_run_id = latest_import.id
  group by latest_import.id
)
select 'import_total_mismatch' as check_name, latest_import.id::text as detail
from latest_import
join staged_counts on staged_counts.import_run_id = latest_import.id
where latest_import.total_rows <> staged_counts.staged_rows
   or latest_import.processed_rows <> staged_counts.staged_rows;

with latest_import as (
  select *
  from import_runs
  where source_slug = 'singapore_food_businesses_csv'
    and source_file = 'data/singapore_food_businesses_canonical.csv'
  order by created_at desc
  limit 1
),
staged_counts as (
  select
    latest_import.id as import_run_id,
    count(*) filter (where staging_food_businesses.source_hash is null)::integer as rows_without_source_hash,
    count(*) filter (where staging_food_businesses.raw_payload = '{}'::jsonb)::integer as rows_without_raw_payload,
    count(*) filter (where staging_food_businesses.parsed_payload = '{}'::jsonb)::integer as rows_without_parsed_payload
  from latest_import
  left join staging_food_businesses on staging_food_businesses.import_run_id = latest_import.id
  group by latest_import.id
)
select 'incomplete_import_payload' as check_name, latest_import.id::text as detail
from latest_import
join staged_counts on staged_counts.import_run_id = latest_import.id
where staged_counts.rows_without_source_hash > 0
   or staged_counts.rows_without_raw_payload > 0
   or staged_counts.rows_without_parsed_payload > 0;

with latest_import as (
  select *
  from import_runs
  where source_slug = 'singapore_food_businesses_csv'
    and source_file = 'data/singapore_food_businesses_canonical.csv'
  order by created_at desc
  limit 1
)
select 'unexpected_import_summary' as check_name, latest_import.id::text as detail
from latest_import
where status <> 'completed'
   or total_rows <> 32253
   or processed_rows <> 32253
   or accepted_rows <> 32253
   or rejected_rows <> 0
   or metadata->>'csv_sha256' <> '9122e73836bf74f0b59a7817409f874f9064fa0acc65cd07f195929ce7892ccb';

select 'canonical_food_business_staging_smoke_passed' as check_name, '0043' as detail;
