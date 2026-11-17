-- Read-only preflight before applying the versioned raw-catalog migration.
select
  (select count(*) from public.venues) as venue_count,
  (select count(*) from public.dishes) as dish_count,
  to_regclass('public.catalog_raw_venue_cards') is not null as raw_projection_already_exists;

select version
from supabase_migrations.schema_migrations
where version = '20260713120000';
