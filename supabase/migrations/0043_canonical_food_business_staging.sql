-- Canonical Singapore food-business CSV staging alignment.
-- Additive only: this prepares the existing service-role-only staging table for
-- the checked-in canonical CSV without promoting rows into production tables.

insert into external_sources (
  slug,
  display_name,
  source_type,
  trust_tier,
  default_confidence,
  metadata
)
values (
  'singapore_food_businesses_csv',
  'Singapore Food Businesses Canonical CSV',
  'spreadsheet',
  'staging',
  0.650,
  '{"path":"data/singapore_food_businesses_canonical.csv","purpose":"canonical food-business staging import"}'::jsonb
)
on conflict (slug) do update set
  display_name = excluded.display_name,
  source_type = excluded.source_type,
  trust_tier = excluded.trust_tier,
  default_confidence = excluded.default_confidence,
  metadata = external_sources.metadata || excluded.metadata,
  updated_at = now();

alter table staging_food_businesses
  add column if not exists business_id text,
  add column if not exists stall_id text,
  add column if not exists licence_no text,
  add column if not exists stall_type text,
  add column if not exists cuisine text,
  add column if not exists signature_dish text,
  add column if not exists menu_text text,
  add column if not exists price_text text,
  add column if not exists price_min_sgd numeric(8, 2),
  add column if not exists price_max_sgd numeric(8, 2),
  add column if not exists opening_hours_text text,
  add column if not exists closed_days text,
  add column if not exists hygiene_grade text,
  add column if not exists michelin_recognition text,
  add column if not exists dietary_options text[] not null default '{}',
  add column if not exists delivery_platforms text[] not null default '{}',
  add column if not exists contact text,
  add column if not exists instagram text,
  add column if not exists image_url text,
  add column if not exists address text,
  add column if not exists building_display_name text,
  add column if not exists region text,
  add column if not exists location_text text,
  add column if not exists location_key text,
  add column if not exists source_type_label text,
  add column if not exists source_url text,
  add column if not exists last_verified_date date,
  add column if not exists coverage_status text,
  add column if not exists notes text,
  add column if not exists observed_location geography(point, 4326) generated always as (
    case
      when longitude is null or latitude is null then null
      else st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
    end
  ) stored;

alter table staging_food_businesses
  drop constraint if exists staging_food_businesses_price_range_check;
alter table staging_food_businesses
  add constraint staging_food_businesses_price_range_check
  check (
    price_min_sgd is null
    or price_max_sgd is null
    or price_min_sgd <= price_max_sgd
  ) not valid;

alter table staging_food_businesses
  drop constraint if exists staging_food_businesses_coverage_status_check;
alter table staging_food_businesses
  add constraint staging_food_businesses_coverage_status_check
  check (
    coverage_status is null
    or lower(coverage_status) in ('complete', 'partial', 'unknown', 'out_of_scope')
  ) not valid;

create index if not exists idx_staging_food_businesses_business_id
  on staging_food_businesses(business_id)
  where business_id is not null;

create index if not exists idx_staging_food_businesses_stall_id
  on staging_food_businesses(stall_id)
  where stall_id is not null;

create index if not exists idx_staging_food_businesses_licence_no
  on staging_food_businesses(licence_no)
  where licence_no is not null;

create index if not exists idx_staging_food_businesses_source_hash
  on staging_food_businesses(source_slug, source_hash)
  where source_hash is not null;

create index if not exists idx_staging_food_businesses_location
  on staging_food_businesses using gist (observed_location)
  where observed_location is not null;

create index if not exists idx_staging_food_businesses_coverage_status
  on staging_food_businesses(coverage_status, last_verified_date desc nulls last)
  where coverage_status is not null;

comment on column staging_food_businesses.business_id is
  'Business ID from data/singapore_food_businesses_canonical.csv.';
comment on column staging_food_businesses.building_display_name is
  'Secondary Building Name column from data/singapore_food_businesses_canonical.csv when it differs from Hawker Centre / Building.';
comment on column staging_food_businesses.licence_no is
  'SFA/NEA licence number when present in the canonical CSV.';
comment on column staging_food_businesses.menu_text is
  'Raw menu text from curated or enriched food-business data; promotion to dishes remains a reviewed follow-up.';
comment on column staging_food_businesses.coverage_status is
  'CSV coverage state such as Complete or Partial. This is staging metadata, not a production trust claim.';
comment on column staging_food_businesses.observed_location is
  'Generated geography point for staging dedupe and spatial validation; canonical venues are not mutated by this migration.';
