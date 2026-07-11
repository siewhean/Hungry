-- Phase 0-1 database foundation for safe data imports.
-- Safe to re-run. Additive only: no canonical table drops, renames, or ID changes.

create table if not exists external_sources (
  slug citext primary key,
  display_name text not null,
  source_type text not null check (source_type in ('official', 'third_party', 'spreadsheet', 'merchant', 'manual', 'ocr', 'user', 'system')),
  trust_tier text not null default 'staging' check (trust_tier in ('staging', 'standard', 'trusted', 'verified')),
  base_url text,
  default_confidence numeric(4, 3) not null default 0.500 check (default_confidence >= 0 and default_confidence <= 1),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into external_sources (slug, display_name, source_type, trust_tier, default_confidence)
values
  ('google_places', 'Google Places', 'third_party', 'standard', 0.700),
  ('google_sheets', 'Google Sheets Import', 'spreadsheet', 'staging', 0.400),
  ('manual', 'Manual Ops', 'manual', 'trusted', 0.900),
  ('merchant', 'Merchant Submitted', 'merchant', 'trusted', 0.800),
  ('ocr', 'Menu OCR', 'ocr', 'staging', 0.450),
  ('sfa', 'Singapore Food Agency', 'official', 'verified', 0.950),
  ('nea', 'National Environment Agency', 'official', 'verified', 0.950)
on conflict (slug) do update set
  display_name = excluded.display_name,
  source_type = excluded.source_type,
  trust_tier = excluded.trust_tier,
  default_confidence = excluded.default_confidence,
  updated_at = now();

create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  source_slug citext not null references external_sources(slug) on update cascade,
  source_type text not null check (source_type in ('google_sheets', 'csv', 'google_places', 'menu_ocr', 'manual', 'merchant', 'system')),
  source_file text,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_by uuid,
  total_rows integer not null default 0 check (total_rows >= 0),
  processed_rows integer not null default 0 check (processed_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_import_runs_status_created on import_runs(status, created_at desc);
create index if not exists idx_import_runs_source_created on import_runs(source_slug, created_at desc);

create table if not exists staging_food_businesses (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references import_runs(id) on delete cascade,
  source_slug citext not null references external_sources(slug) on update cascade,
  source_row_id text,
  row_number integer check (row_number is null or row_number > 0),
  raw_payload jsonb not null default '{}'::jsonb,
  parsed_payload jsonb not null default '{}'::jsonb,
  business_name text,
  normalized_name text,
  building_name text,
  unit_number text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  candidate_building_id text references buildings(id) on delete set null,
  candidate_venue_id text references venues(id) on delete set null,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'invalid', 'dedupe_candidate', 'promoted', 'rejected')),
  error_reason text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_run_id, row_number)
);
create index if not exists idx_staging_food_businesses_import_status on staging_food_businesses(import_run_id, validation_status, row_number);
create index if not exists idx_staging_food_businesses_candidate_venue on staging_food_businesses(candidate_venue_id) where candidate_venue_id is not null;
create index if not exists idx_staging_food_businesses_source_row on staging_food_businesses(source_slug, source_row_id) where source_row_id is not null;
create index if not exists idx_staging_food_businesses_normalized_trgm on staging_food_businesses using gin (normalized_name gin_trgm_ops) where normalized_name is not null;

create table if not exists staging_google_places_observations (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references import_runs(id) on delete cascade,
  staging_food_business_id uuid references staging_food_businesses(id) on delete cascade,
  candidate_venue_id text references venues(id) on delete set null,
  google_place_id text not null,
  field_mask text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  parsed_payload jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'invalid', 'promoted', 'rejected')),
  error_reason text,
  source_hash text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_staging_google_places_run_status on staging_google_places_observations(import_run_id, validation_status, fetched_at desc);
create index if not exists idx_staging_google_places_google_place on staging_google_places_observations(google_place_id, fetched_at desc);
create index if not exists idx_staging_google_places_candidate_venue on staging_google_places_observations(candidate_venue_id) where candidate_venue_id is not null;

create table if not exists staging_menu_items (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references import_runs(id) on delete cascade,
  staging_food_business_id uuid references staging_food_businesses(id) on delete cascade,
  candidate_venue_id text references venues(id) on delete set null,
  candidate_dish_id text references dishes(id) on delete set null,
  source_slug citext not null references external_sources(slug) on update cascade,
  source_row_id text,
  row_number integer check (row_number is null or row_number > 0),
  section_name text,
  item_name text not null,
  normalized_name text,
  description text,
  price numeric(8, 2) check (price is null or price >= 0),
  currency text not null default 'SGD',
  raw_payload jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'invalid', 'dedupe_candidate', 'promoted', 'rejected')),
  error_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_staging_menu_items_import_status on staging_menu_items(import_run_id, validation_status, row_number);
create index if not exists idx_staging_menu_items_candidate_venue on staging_menu_items(candidate_venue_id, normalized_name) where candidate_venue_id is not null;
create index if not exists idx_staging_menu_items_normalized_trgm on staging_menu_items using gin (normalized_name gin_trgm_ops) where normalized_name is not null;

create table if not exists staging_photos (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references import_runs(id) on delete cascade,
  staging_food_business_id uuid references staging_food_businesses(id) on delete cascade,
  candidate_venue_id text references venues(id) on delete set null,
  candidate_dish_id text references dishes(id) on delete set null,
  source_slug citext not null references external_sources(slug) on update cascade,
  source_row_id text,
  photo_reference text,
  external_url text,
  storage_bucket text,
  storage_path text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  attribution jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'invalid', 'promoted', 'rejected')),
  error_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_staging_photos_import_status on staging_photos(import_run_id, validation_status, created_at desc);
create index if not exists idx_staging_photos_candidate_venue on staging_photos(candidate_venue_id) where candidate_venue_id is not null;
create index if not exists idx_staging_photos_candidate_dish on staging_photos(candidate_dish_id) where candidate_dish_id is not null;
create index if not exists idx_staging_photos_source_reference on staging_photos(source_slug, photo_reference) where photo_reference is not null;

create table if not exists staging_import_errors (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references import_runs(id) on delete cascade,
  staging_table text not null,
  staging_row_id uuid,
  source_row_number integer,
  severity text not null default 'error' check (severity in ('info', 'warning', 'error')),
  error_code text not null,
  message text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_staging_import_errors_run_created on staging_import_errors(import_run_id, created_at desc);
create index if not exists idx_staging_import_errors_code on staging_import_errors(error_code, severity);

create table if not exists external_place_refs (
  id uuid primary key default gen_random_uuid(),
  venue_id text references venues(id) on delete set null,
  source_slug citext not null references external_sources(slug) on update cascade,
  external_id text not null,
  source_url text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  match_status text not null default 'candidate' check (match_status in ('candidate', 'confirmed', 'rejected', 'stale')),
  matched_by uuid,
  matched_at timestamptz,
  last_seen_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists external_place_refs_source_external_unique on external_place_refs(source_slug, external_id);
create index if not exists idx_external_place_refs_venue on external_place_refs(venue_id, source_slug) where venue_id is not null;
create index if not exists idx_external_place_refs_status_seen on external_place_refs(match_status, last_seen_at desc nulls last);

create table if not exists venue_source_observations (
  id uuid primary key default gen_random_uuid(),
  external_place_ref_id uuid references external_place_refs(id) on delete set null,
  venue_id text references venues(id) on delete set null,
  source_slug citext not null references external_sources(slug) on update cascade,
  observed_name text,
  normalized_name text,
  observed_address text,
  observed_unit_number text,
  observed_latitude double precision,
  observed_longitude double precision,
  observed_location geography(point, 4326) generated always as (
    case
      when observed_longitude is null or observed_latitude is null then null
      else st_setsrid(st_makepoint(observed_longitude, observed_latitude), 4326)::geography
    end
  ) stored,
  observed_phone text,
  observed_website text,
  observed_opening_hours jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  raw_payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_venue_source_observations_venue_source on venue_source_observations(venue_id, source_slug, observed_at desc) where venue_id is not null;
create index if not exists idx_venue_source_observations_source_seen on venue_source_observations(source_slug, observed_at desc);
create index if not exists idx_venue_source_observations_location on venue_source_observations using gist (observed_location) where observed_location is not null;
create index if not exists idx_venue_source_observations_name_trgm on venue_source_observations using gin (normalized_name gin_trgm_ops) where normalized_name is not null;

create table if not exists dish_source_observations (
  id uuid primary key default gen_random_uuid(),
  dish_id text references dishes(id) on delete set null,
  venue_id text references venues(id) on delete set null,
  source_slug citext not null references external_sources(slug) on update cascade,
  external_dish_id text,
  observed_name text not null,
  normalized_name text,
  observed_description text,
  price numeric(8, 2) check (price is null or price >= 0),
  currency text not null default 'SGD',
  observed_tags text[] not null default '{}',
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  raw_payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_dish_source_observations_dish_source on dish_source_observations(dish_id, source_slug, observed_at desc) where dish_id is not null;
create index if not exists idx_dish_source_observations_venue_name on dish_source_observations(venue_id, normalized_name) where venue_id is not null;
create index if not exists idx_dish_source_observations_name_trgm on dish_source_observations using gin (normalized_name gin_trgm_ops) where normalized_name is not null;
create unique index if not exists dish_source_observations_source_external_unique on dish_source_observations(source_slug, external_dish_id) where external_dish_id is not null;

create table if not exists photo_source_observations (
  id uuid primary key default gen_random_uuid(),
  venue_id text references venues(id) on delete set null,
  dish_id text references dishes(id) on delete set null,
  source_slug citext not null references external_sources(slug) on update cascade,
  external_photo_id text,
  external_url text,
  storage_bucket text,
  storage_path text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  attribution jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected', 'hidden')),
  raw_payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (venue_id is not null or dish_id is not null)
);
create index if not exists idx_photo_source_observations_venue on photo_source_observations(venue_id, source_slug, observed_at desc) where venue_id is not null;
create index if not exists idx_photo_source_observations_dish on photo_source_observations(dish_id, source_slug, observed_at desc) where dish_id is not null;
create unique index if not exists photo_source_observations_source_external_unique on photo_source_observations(source_slug, external_photo_id) where external_photo_id is not null;

create table if not exists google_places_observations (
  id uuid primary key default gen_random_uuid(),
  venue_id text references venues(id) on delete set null,
  external_place_ref_id uuid references external_place_refs(id) on delete set null,
  google_place_id text not null,
  display_name text,
  formatted_address text,
  rating numeric(3, 2) check (rating is null or (rating >= 0 and rating <= 5)),
  user_rating_count integer check (user_rating_count is null or user_rating_count >= 0),
  price_level text,
  opening_hours jsonb not null default '{}'::jsonb,
  website_uri text,
  google_maps_uri text,
  photos jsonb not null default '[]'::jsonb,
  business_status text,
  field_mask text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_google_places_observations_place_fetched on google_places_observations(google_place_id, fetched_at desc);
create index if not exists idx_google_places_observations_venue_fetched on google_places_observations(venue_id, fetched_at desc) where venue_id is not null;
create index if not exists idx_google_places_observations_external_ref on google_places_observations(external_place_ref_id) where external_place_ref_id is not null;

create table if not exists venue_aliases (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  alias_name text not null,
  normalized_alias_name text not null,
  source_slug citext references external_sources(slug) on update cascade,
  confidence numeric(4, 3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);
create unique index if not exists venue_aliases_venue_alias_source_unique on venue_aliases(venue_id, normalized_alias_name, coalesce(source_slug::text, ''));
create index if not exists idx_venue_aliases_normalized_trgm on venue_aliases using gin (normalized_alias_name gin_trgm_ops);
create index if not exists idx_venue_aliases_venue on venue_aliases(venue_id);

create table if not exists venue_merge_events (
  id uuid primary key default gen_random_uuid(),
  surviving_venue_id text not null references venues(id) on delete restrict,
  merged_venue_id text not null references venues(id) on delete restrict,
  reason text not null,
  merged_by uuid,
  merge_metadata jsonb not null default '{}'::jsonb,
  merged_at timestamptz not null default now(),
  check (surviving_venue_id <> merged_venue_id),
  unique (surviving_venue_id, merged_venue_id)
);
create index if not exists idx_venue_merge_events_surviving on venue_merge_events(surviving_venue_id, merged_at desc);
create index if not exists idx_venue_merge_events_merged on venue_merge_events(merged_venue_id, merged_at desc);

create table if not exists data_quality_flags (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('staging_food_business', 'staging_menu_item', 'staging_photo', 'venue', 'dish', 'photo', 'external_place_ref', 'google_places_observation')),
  entity_id text not null,
  source_slug citext references external_sources(slug) on update cascade,
  flag_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  message text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists idx_data_quality_flags_status on data_quality_flags(status, severity, created_at desc);
create index if not exists idx_data_quality_flags_entity on data_quality_flags(entity_type, entity_id);
create index if not exists idx_data_quality_flags_source on data_quality_flags(source_slug, created_at desc) where source_slug is not null;

alter table external_sources enable row level security;
alter table import_runs enable row level security;
alter table staging_food_businesses enable row level security;
alter table staging_google_places_observations enable row level security;
alter table staging_menu_items enable row level security;
alter table staging_photos enable row level security;
alter table staging_import_errors enable row level security;
alter table external_place_refs enable row level security;
alter table venue_source_observations enable row level security;
alter table dish_source_observations enable row level security;
alter table photo_source_observations enable row level security;
alter table google_places_observations enable row level security;
alter table venue_aliases enable row level security;
alter table venue_merge_events enable row level security;
alter table data_quality_flags enable row level security;

drop policy if exists "external_sources_service_role_all" on external_sources;
create policy "external_sources_service_role_all" on external_sources for all to service_role using (true) with check (true);
drop policy if exists "import_runs_service_role_all" on import_runs;
create policy "import_runs_service_role_all" on import_runs for all to service_role using (true) with check (true);
drop policy if exists "staging_food_businesses_service_role_all" on staging_food_businesses;
create policy "staging_food_businesses_service_role_all" on staging_food_businesses for all to service_role using (true) with check (true);
drop policy if exists "staging_google_places_observations_service_role_all" on staging_google_places_observations;
create policy "staging_google_places_observations_service_role_all" on staging_google_places_observations for all to service_role using (true) with check (true);
drop policy if exists "staging_menu_items_service_role_all" on staging_menu_items;
create policy "staging_menu_items_service_role_all" on staging_menu_items for all to service_role using (true) with check (true);
drop policy if exists "staging_photos_service_role_all" on staging_photos;
create policy "staging_photos_service_role_all" on staging_photos for all to service_role using (true) with check (true);
drop policy if exists "staging_import_errors_service_role_all" on staging_import_errors;
create policy "staging_import_errors_service_role_all" on staging_import_errors for all to service_role using (true) with check (true);
drop policy if exists "external_place_refs_service_role_all" on external_place_refs;
create policy "external_place_refs_service_role_all" on external_place_refs for all to service_role using (true) with check (true);
drop policy if exists "venue_source_observations_service_role_all" on venue_source_observations;
create policy "venue_source_observations_service_role_all" on venue_source_observations for all to service_role using (true) with check (true);
drop policy if exists "dish_source_observations_service_role_all" on dish_source_observations;
create policy "dish_source_observations_service_role_all" on dish_source_observations for all to service_role using (true) with check (true);
drop policy if exists "photo_source_observations_service_role_all" on photo_source_observations;
create policy "photo_source_observations_service_role_all" on photo_source_observations for all to service_role using (true) with check (true);
drop policy if exists "google_places_observations_service_role_all" on google_places_observations;
create policy "google_places_observations_service_role_all" on google_places_observations for all to service_role using (true) with check (true);
drop policy if exists "venue_aliases_service_role_all" on venue_aliases;
create policy "venue_aliases_service_role_all" on venue_aliases for all to service_role using (true) with check (true);
drop policy if exists "venue_merge_events_service_role_all" on venue_merge_events;
create policy "venue_merge_events_service_role_all" on venue_merge_events for all to service_role using (true) with check (true);
drop policy if exists "data_quality_flags_service_role_all" on data_quality_flags;
create policy "data_quality_flags_service_role_all" on data_quality_flags for all to service_role using (true) with check (true);

drop trigger if exists trg_external_sources_updated_at on external_sources;
create trigger trg_external_sources_updated_at before update on external_sources for each row execute function public.set_updated_at();
drop trigger if exists trg_import_runs_updated_at on import_runs;
create trigger trg_import_runs_updated_at before update on import_runs for each row execute function public.set_updated_at();
drop trigger if exists trg_staging_food_businesses_updated_at on staging_food_businesses;
create trigger trg_staging_food_businesses_updated_at before update on staging_food_businesses for each row execute function public.set_updated_at();
drop trigger if exists trg_external_place_refs_updated_at on external_place_refs;
create trigger trg_external_place_refs_updated_at before update on external_place_refs for each row execute function public.set_updated_at();
drop trigger if exists trg_data_quality_flags_updated_at on data_quality_flags;
create trigger trg_data_quality_flags_updated_at before update on data_quality_flags for each row execute function public.set_updated_at();
