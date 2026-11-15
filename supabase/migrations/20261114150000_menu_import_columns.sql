-- smoke: supabase/smoke/menu_import_columns.sql
-- Menu importer support columns (scripts/staging_menu_import). Additive and idempotent:
-- nullable columns, defaults that need no table rewrite on Postgres 11+, partial indexes, one CHECK.
-- Replaces the unversioned draft 20261111120000_staging_menu_import_columns.sql, whose version
-- collided with 20261111120000_drop_portfolio_ranking.sql on main.
-- Backout: supabase/rollbacks/20261114150000_menu_import_columns.down.sql
-- (archives every populated value to rollback_archive, then drops the columns/indexes/constraint this file owns).
-- dishes.price_confidence and dishes.dietary_status are shared with the price and halal label migration
-- (20261114130000), which adds the same two columns with ADD COLUMN IF NOT EXISTS, so either order works.
-- Ownership: before adding them, this file records in rollback_archive.menu_import_created_columns_20261114150000
-- which of the two columns it is actually creating (the column did not exist yet). The rollback drops exactly
-- those and leaves the other thread's columns, data and comments alone. Re-running this file keeps earlier marker rows.
-- Order risk: if the other migration is applied AFTER this one, the columns count as ours and our rollback drops them
-- (after archiving their values to rollback_archive).

create schema if not exists rollback_archive;

create table if not exists rollback_archive.menu_import_created_columns_20261114150000 (column_name text primary key);

insert into rollback_archive.menu_import_created_columns_20261114150000 (column_name)
select c
from unnest(array['price_confidence', 'dietary_status']) as c
where not exists (
  select 1 from pg_attribute
  where attrelid = 'public.dishes'::regclass and attname = c and not attisdropped)
on conflict do nothing;

alter table public.buildings
  add column if not exists import_batch_id uuid;

alter table public.venues
  add column if not exists import_batch_id uuid,
  add column if not exists is_generic_cuisine boolean not null default false,
  add column if not exists secondary_menu_url text;

alter table public.dishes
  add column if not exists import_batch_id uuid,
  add column if not exists price_confidence text,
  add column if not exists is_generic_cuisine boolean not null default false,
  add column if not exists secondary_menu_url text,
  add column if not exists dietary_status jsonb;

alter table public.dish_taste_vectors
  add column if not exists import_batch_id uuid;

alter table public.dish_dietary_flags
  add column if not exists import_batch_id uuid;

-- counter_price: real in-store price (delivery apps inflate prices; confirmed by owner 2026-11-11).
-- delivery_price: only a delivery-app price exists; loaded and shown, tagged so the app can label it (2026-11-12).
-- listed_price: price from a first-party/other source.
-- Drop-and-recreate keeps the migration idempotent and corrects an earlier draft that used delivery_price_unverified.
alter table public.dishes drop constraint if exists dishes_price_confidence_check;
alter table public.dishes
  add constraint dishes_price_confidence_check
  check (price_confidence is null
         or price_confidence in ('counter_price', 'delivery_price', 'listed_price'));

-- Partial indexes keep batch rollback (delete ... where import_batch_id = ?) index-driven.
create index if not exists idx_buildings_import_batch on public.buildings (import_batch_id) where import_batch_id is not null;
create index if not exists idx_venues_import_batch on public.venues (import_batch_id) where import_batch_id is not null;
create index if not exists idx_dishes_import_batch on public.dishes (import_batch_id) where import_batch_id is not null;
create index if not exists idx_dish_taste_vectors_import_batch on public.dish_taste_vectors (import_batch_id) where import_batch_id is not null;
create index if not exists idx_dish_dietary_flags_import_batch on public.dish_dietary_flags (import_batch_id) where import_batch_id is not null;

comment on column public.dishes.is_generic_cuisine is 'True when cuisine is a generic default; search suggestion lists should hide it.';
comment on column public.dishes.secondary_menu_url is 'Delivery-app link kept only as a secondary menu link; never the price source.';
comment on column public.venues.is_generic_cuisine is 'True when cuisine_tags holds only a generic default.';

-- Comments on the two shared columns are set only where this file created the column, so a rollback that
-- leaves a shared column in place also leaves its comment (and never overwrites the other migration's).
do $$
begin
  if exists (select 1 from rollback_archive.menu_import_created_columns_20261114150000 where column_name = 'price_confidence') then
    comment on column public.dishes.price_confidence is 'counter_price | delivery_price | listed_price. Set by the staging menu importer.';
  end if;
  if exists (select 1 from rollback_archive.menu_import_created_columns_20261114150000 where column_name = 'dietary_status') then
    comment on column public.dishes.dietary_status is 'Tri-state dietary/allergen status (yes|no|unknown); blank source values stay unknown.';
  end if;
end $$;
