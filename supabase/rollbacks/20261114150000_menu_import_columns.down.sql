-- Undo 20261114150000_menu_import_columns: drops the importer columns, their indexes and the
-- price_confidence CHECK. Every populated value is first copied to rollback_archive
-- (one table per source table, keyed by the row's primary key), so nothing is lost.
-- Run it after `rollback_import.py --apply` if the import batches should be deleted as well.
-- Re-running the up migration afterwards re-creates empty columns; restore from rollback_archive if needed.

create schema if not exists rollback_archive;

drop table if exists rollback_archive.menu_import_buildings_20261114150000;
create table rollback_archive.menu_import_buildings_20261114150000 as
  select id, import_batch_id from public.buildings where import_batch_id is not null;

drop table if exists rollback_archive.menu_import_venues_20261114150000;
create table rollback_archive.menu_import_venues_20261114150000 as
  select id, import_batch_id, is_generic_cuisine, secondary_menu_url from public.venues
  where import_batch_id is not null or is_generic_cuisine or secondary_menu_url is not null;

drop table if exists rollback_archive.menu_import_dishes_20261114150000;
create table rollback_archive.menu_import_dishes_20261114150000 as
  select id, import_batch_id, price_confidence, is_generic_cuisine, secondary_menu_url, dietary_status from public.dishes
  where import_batch_id is not null or price_confidence is not null or is_generic_cuisine
     or secondary_menu_url is not null or dietary_status is not null;

drop table if exists rollback_archive.menu_import_dish_taste_vectors_20261114150000;
create table rollback_archive.menu_import_dish_taste_vectors_20261114150000 as
  select dish_id, import_batch_id from public.dish_taste_vectors where import_batch_id is not null;

drop table if exists rollback_archive.menu_import_dish_dietary_flags_20261114150000;
create table rollback_archive.menu_import_dish_dietary_flags_20261114150000 as
  select dish_id, dietary_flag_id, import_batch_id from public.dish_dietary_flags where import_batch_id is not null;

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
