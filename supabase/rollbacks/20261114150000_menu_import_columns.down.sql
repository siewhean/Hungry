-- Undo 20261114150000_menu_import_columns: drops the importer columns, their indexes and the
-- price_confidence CHECK. Every populated value is first copied to rollback_archive
-- (one table per source table, keyed by the row's primary key), so nothing is lost.
-- dishes.price_confidence and dishes.dietary_status are shared with the price and halal label migration
-- (20261114130000). They are dropped (with their comments) ONLY if the up migration created them, which it
-- recorded in rollback_archive.menu_import_created_columns_20261114150000. If that marker table is missing or does not
-- list a column, the column belongs to the other migration and stays, data included.
-- Dropped shared columns are archived first to rollback_archive.menu_import_dishes_<column>_20261114150000.
-- The marker table is dropped last, so a completed rollback leaves only the archive tables behind.
-- Order risk: if the other migration ran AFTER the up migration, the columns count as created by this file and are dropped here.
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
  select id, import_batch_id, is_generic_cuisine, secondary_menu_url from public.dishes
  where import_batch_id is not null or is_generic_cuisine or secondary_menu_url is not null;

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

do $$
declare
  c text;
begin
  if to_regclass('rollback_archive.menu_import_created_columns_20261114150000') is null then
    return;
  end if;
  for c in
    select m.column_name from rollback_archive.menu_import_created_columns_20261114150000 m
    where m.column_name in ('price_confidence', 'dietary_status')
      and exists (select 1 from pg_attribute where attrelid = 'public.dishes'::regclass and attname = m.column_name and not attisdropped)
    order by m.column_name
  loop
    execute format('drop table if exists rollback_archive.%I', 'menu_import_dishes_' || c || '_20261114150000');
    execute format('create table rollback_archive.%I as select id, %I from public.dishes where %I is not null',
                   'menu_import_dishes_' || c || '_20261114150000', c, c);
    execute format('alter table public.dishes drop column %I', c);
  end loop;
end $$;

alter table public.dish_dietary_flags drop column if exists import_batch_id;
alter table public.dish_taste_vectors drop column if exists import_batch_id;
alter table public.dishes
  drop column if exists secondary_menu_url,
  drop column if exists is_generic_cuisine,
  drop column if exists import_batch_id;
alter table public.venues
  drop column if exists secondary_menu_url,
  drop column if exists is_generic_cuisine,
  drop column if exists import_batch_id;
alter table public.buildings drop column if exists import_batch_id;

drop table if exists rollback_archive.menu_import_created_columns_20261114150000;
