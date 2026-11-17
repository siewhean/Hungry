-- smoke: supabase/smoke/menu_import_columns.sql
-- Menu importer support columns (scripts/staging_menu_import). Additive and idempotent:
-- nullable columns, defaults that need no table rewrite on Postgres 11+, partial indexes, one CHECK.
-- Replaces the unversioned draft 20261111120000_staging_menu_import_columns.sql, whose version
-- collided with 20261111120000_drop_portfolio_ranking.sql on main.
-- Backout: supabase/rollbacks/20261114150000_menu_import_columns.down.sql
-- (archives every populated value to rollback_archive, then drops only these columns/indexes/constraint).

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

comment on column public.dishes.price_confidence is 'counter_price | delivery_price | listed_price. Set by the staging menu importer.';
comment on column public.dishes.is_generic_cuisine is 'True when cuisine is a generic default; search suggestion lists should hide it.';
comment on column public.dishes.secondary_menu_url is 'Delivery-app link kept only as a secondary menu link; never the price source.';
comment on column public.dishes.dietary_status is 'Tri-state dietary/allergen status (yes|no|unknown); blank source values stay unknown.';
comment on column public.venues.is_generic_cuisine is 'True when cuisine_tags holds only a generic default.';
