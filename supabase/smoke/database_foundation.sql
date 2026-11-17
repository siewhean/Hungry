-- Smoke checks for the Phase 0-1 data import/provenance foundation.
-- Each query should return zero rows unless the final pass marker is selected.

with expected(tablename) as (
  values
    ('external_sources'),
    ('import_runs'),
    ('staging_food_businesses'),
    ('staging_google_places_observations'),
    ('staging_menu_items'),
    ('staging_photos'),
    ('staging_import_errors'),
    ('external_place_refs'),
    ('venue_source_observations'),
    ('dish_source_observations'),
    ('photo_source_observations'),
    ('google_places_observations'),
    ('venue_aliases'),
    ('venue_merge_events'),
    ('data_quality_flags')
),
actual as (
  select table_name::text as tablename
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
)
select 'missing_table' as check_name, expected.tablename as detail
from expected
except
select 'missing_table', actual.tablename
from actual;

with expected(tablename) as (
  values
    ('external_sources'),
    ('import_runs'),
    ('staging_food_businesses'),
    ('staging_google_places_observations'),
    ('staging_menu_items'),
    ('staging_photos'),
    ('staging_import_errors'),
    ('external_place_refs'),
    ('venue_source_observations'),
    ('dish_source_observations'),
    ('photo_source_observations'),
    ('google_places_observations'),
    ('venue_aliases'),
    ('venue_merge_events'),
    ('data_quality_flags')
)
select 'rls_not_enabled' as check_name, expected.tablename as detail
from expected
left join pg_class on pg_class.relname = expected.tablename
left join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and pg_class.relrowsecurity is distinct from true;

with expected(tablename, policyname) as (
  values
    ('external_sources', 'external_sources_service_role_all'),
    ('import_runs', 'import_runs_service_role_all'),
    ('staging_food_businesses', 'staging_food_businesses_service_role_all'),
    ('staging_google_places_observations', 'staging_google_places_observations_service_role_all'),
    ('staging_menu_items', 'staging_menu_items_service_role_all'),
    ('staging_photos', 'staging_photos_service_role_all'),
    ('staging_import_errors', 'staging_import_errors_service_role_all'),
    ('external_place_refs', 'external_place_refs_service_role_all'),
    ('venue_source_observations', 'venue_source_observations_service_role_all'),
    ('dish_source_observations', 'dish_source_observations_service_role_all'),
    ('photo_source_observations', 'photo_source_observations_service_role_all'),
    ('google_places_observations', 'google_places_observations_service_role_all'),
    ('venue_aliases', 'venue_aliases_service_role_all'),
    ('venue_merge_events', 'venue_merge_events_service_role_all'),
    ('data_quality_flags', 'data_quality_flags_service_role_all')
),
actual as (
  select tablename::text, policyname::text
  from pg_policies
  where schemaname = 'public'
    and cmd = 'ALL'
    and 'service_role'::name = any(roles)
)
select 'missing_service_role_policy' as check_name, expected.tablename || ':' || expected.policyname as detail
from expected
except
select 'missing_service_role_policy', actual.tablename || ':' || actual.policyname
from actual;

select 'unexpected_user_policy' as check_name, tablename || ':' || policyname as detail
from pg_policies
where schemaname = 'public'
  and tablename in (
    'external_sources',
    'import_runs',
    'staging_food_businesses',
    'staging_google_places_observations',
    'staging_menu_items',
    'staging_photos',
    'staging_import_errors',
    'external_place_refs',
    'venue_source_observations',
    'dish_source_observations',
    'photo_source_observations',
    'google_places_observations',
    'venue_aliases',
    'venue_merge_events',
    'data_quality_flags'
  )
  and (
    'authenticated'::name = any(roles)
    or 'anon'::name = any(roles)
  );

with expected(indexname) as (
  values
    ('idx_import_runs_status_created'),
    ('idx_import_runs_source_created'),
    ('idx_staging_food_businesses_import_status'),
    ('idx_staging_food_businesses_source_row'),
    ('idx_staging_food_businesses_normalized_trgm'),
    ('idx_staging_google_places_google_place'),
    ('idx_staging_menu_items_import_status'),
    ('idx_staging_menu_items_normalized_trgm'),
    ('idx_staging_photos_import_status'),
    ('idx_staging_photos_source_reference'),
    ('idx_staging_import_errors_run_created'),
    ('external_place_refs_source_external_unique'),
    ('idx_external_place_refs_venue'),
    ('idx_venue_source_observations_venue_source'),
    ('idx_venue_source_observations_location'),
    ('idx_dish_source_observations_dish_source'),
    ('dish_source_observations_source_external_unique'),
    ('idx_photo_source_observations_venue'),
    ('photo_source_observations_source_external_unique'),
    ('idx_google_places_observations_place_fetched'),
    ('idx_google_places_observations_venue_fetched'),
    ('venue_aliases_venue_alias_source_unique'),
    ('idx_venue_aliases_normalized_trgm'),
    ('idx_venue_merge_events_surviving'),
    ('idx_data_quality_flags_status'),
    ('idx_data_quality_flags_entity')
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

with expected(slug) as (
  values
    ('google_places'),
    ('google_sheets'),
    ('manual'),
    ('merchant'),
    ('ocr'),
    ('sfa'),
    ('nea')
),
actual as (
  select slug::text
  from external_sources
)
select 'missing_external_source_seed' as check_name, expected.slug as detail
from expected
except
select 'missing_external_source_seed', actual.slug
from actual;

select 'database_foundation_smoke_passed' as check_name, 'phase_0_1' as detail;
