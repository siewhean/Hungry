-- Down script for 20261111120000_staging_menu_import_columns.sql.
-- STAGING ONLY. Run only after `rollback_import.py --apply` has deleted every
-- import batch (otherwise the import_batch_id lineage is lost). Not auto-run.
drop index if exists public.idx_dish_dietary_flags_import_batch;
drop index if exists public.idx_dish_taste_vectors_import_batch;
drop index if exists public.idx_dishes_import_batch;
drop index if exists public.idx_venues_import_batch;
drop index if exists public.idx_buildings_import_batch;

alter table public.dishes drop constraint if exists dishes_price_confidence_check;

alter table public.dish_dietary_flags drop column if exists import_batch_id;
alter table public.dish_taste_vectors drop column if exists import_batch_id;
alter table public.dishes
  drop column if exists dietary_status,
  drop column if exists secondary_menu_url,
  drop column if exists is_generic_cuisine,
  drop column if exists price_confidence,
  drop column if exists import_batch_id;
alter table public.venues
  drop column if exists secondary_menu_url,
  drop column if exists is_generic_cuisine,
  drop column if exists import_batch_id;
alter table public.buildings drop column if exists import_batch_id;
