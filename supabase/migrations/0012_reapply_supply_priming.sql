-- Sprint 10: Re-apply Supply Priming (CLM-02) after rollback 0011.
-- Three tables feeding the supply cold-start pipeline:
--   * menu_photo_submissions — photo pointer + OCR job state
--   * dishes_draft           — OCR-extracted dishes pre-promotion
--   * merchant_claim_interests — "Claim this stall" waitlist
--
-- Dev-only gate: RLS enabled with NO public policies. service_role bypasses RLS,
-- so Edge Functions and ops tooling can read/write; the app client cannot.
-- Two security-definer RPCs are defined for the future consumer write paths
-- (CLM-03 / CLM-06) so the surface is reviewed up-front, but they remain
-- unwired from the app in this PR.
--
-- Safe to re-run (idempotent).

-- =========================================================================
-- 0. EXTENSIONS (defensive — already present in 0001_extensions.sql)
-- =========================================================================
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists vector;
create extension if not exists pg_trgm;

-- =========================================================================
-- 1. GENERIC updated_at TRIGGER FUNCTION (new in codebase; reusable)
-- =========================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =========================================================================
-- 2. menu_photo_submissions
-- =========================================================================
create table if not exists menu_photo_submissions (
  id              uuid primary key default gen_random_uuid(),
  venue_id        text not null references venues(id) on delete cascade,
  building_id     text not null references buildings(id) on delete cascade,
  submitted_by    uuid references user_profiles(id) on delete set null,
  storage_bucket  text not null default 'menu-photos',
  storage_path    text not null,
  content_type    text not null check (content_type in ('image/jpeg','image/png','image/heic','image/webp')),
  size_bytes      integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  ocr_status      text not null default 'pending'
                  check (ocr_status in ('pending','processing','succeeded','failed','skipped')),
  ocr_attempts    integer not null default 0,
  ocr_job_id      text,
  ocr_error       text,
  vision_response jsonb,
  submitted_at    timestamptz not null default now(),
  processed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_menu_photo_venue
  on menu_photo_submissions(venue_id);
create index if not exists idx_menu_photo_status
  on menu_photo_submissions(ocr_status, submitted_at desc);
create index if not exists idx_menu_photo_submitter
  on menu_photo_submissions(submitted_by);

-- =========================================================================
-- 3. dishes_draft
-- =========================================================================
create table if not exists dishes_draft (
  id                    uuid primary key default gen_random_uuid(),
  venue_id              text not null references venues(id) on delete cascade,
  building_id           text not null references buildings(id) on delete cascade,
  source_photo_id       uuid references menu_photo_submissions(id) on delete set null,
  name                  text not null,
  name_normalized       text not null,
  price_cents           integer check (price_cents is null or price_cents >= 0),
  currency              text not null default 'SGD',
  modifiers             jsonb not null default '[]'::jsonb,
  ocr_raw_text          text,
  extraction_confidence numeric(4, 3) not null check (extraction_confidence between 0 and 1),
  embedding             vector(768),
  review_status         text not null default 'pending'
                        check (review_status in ('pending','accepted','edited','rejected','promoted','duplicate')),
  reviewed_by           uuid references user_profiles(id) on delete set null,
  reviewed_at           timestamptz,
  promoted_dish_id      text references dishes(id) on delete set null,
  duplicate_of          uuid references dishes_draft(id) on delete set null,
  confidence_bumps      integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_dishes_draft_venue_status
  on dishes_draft(venue_id, review_status);
create index if not exists idx_dishes_draft_queue
  on dishes_draft(review_status, created_at desc)
  where review_status = 'pending';
create index if not exists idx_dishes_draft_name_trgm
  on dishes_draft using gin (name gin_trgm_ops);
create index if not exists idx_dishes_draft_name_normalized
  on dishes_draft(venue_id, name_normalized);
create index if not exists idx_dishes_draft_embedding
  on dishes_draft using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- =========================================================================
-- 4. merchant_claim_interests
-- =========================================================================
create table if not exists merchant_claim_interests (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            text not null references venues(id) on delete cascade,
  building_id         text not null references buildings(id) on delete cascade,
  claimed_by          uuid references user_profiles(id) on delete set null,
  contact_name        text,
  contact_phone       text,
  contact_email       citext,
  uen                 text,
  notes               text,
  status              text not null default 'new'
                      check (status in ('new','contacted','qualified','rejected','converted')),
  status_updated_by   uuid references user_profiles(id) on delete set null,
  status_updated_at   timestamptz,
  source              text not null default 'stall_detail_cta',
  user_agent          text,
  ip_address          inet,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists uniq_claim_user_venue
  on merchant_claim_interests(venue_id, claimed_by)
  where claimed_by is not null;

create index if not exists idx_claim_queue
  on merchant_claim_interests(status, created_at desc);
create index if not exists idx_claim_venue
  on merchant_claim_interests(venue_id);
create index if not exists idx_claim_uen
  on merchant_claim_interests(uen)
  where uen is not null;

-- =========================================================================
-- 5. RLS — enabled, NO public policies (dev-only gate)
-- =========================================================================
alter table menu_photo_submissions   enable row level security;
alter table dishes_draft             enable row level security;
alter table merchant_claim_interests enable row level security;

-- No create policy statements. service_role bypasses RLS; no other role
-- can read or write these tables directly. Consumer writes flow through
-- the two security-definer RPCs below.

-- =========================================================================
-- 6. updated_at TRIGGERS
-- =========================================================================
drop trigger if exists trg_menu_photo_submissions_updated_at on menu_photo_submissions;
create trigger trg_menu_photo_submissions_updated_at
  before update on menu_photo_submissions
  for each row execute function set_updated_at();

drop trigger if exists trg_dishes_draft_updated_at on dishes_draft;
create trigger trg_dishes_draft_updated_at
  before update on dishes_draft
  for each row execute function set_updated_at();

drop trigger if exists trg_merchant_claim_interests_updated_at on merchant_claim_interests;
create trigger trg_merchant_claim_interests_updated_at
  before update on merchant_claim_interests
  for each row execute function set_updated_at();

-- =========================================================================
-- 7. RPC: submit_menu_photo (consumer write path for OCR-01/OCR-02)
--    Dormant in this PR — app does not call it yet.
-- =========================================================================
create or replace function submit_menu_photo(
  p_venue_id     text,
  p_storage_path text,
  p_content_type text,
  p_size_bytes   integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_building_id text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select building_id into v_building_id
    from venues
    where id = p_venue_id;

  if v_building_id is null then
    raise exception 'unknown venue: %', p_venue_id using errcode = '22023';
  end if;

  insert into menu_photo_submissions (
    venue_id, building_id, submitted_by,
    storage_path, content_type, size_bytes
  ) values (
    p_venue_id, v_building_id, auth.uid(),
    p_storage_path, p_content_type, p_size_bytes
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function submit_menu_photo(text, text, text, integer) from public;
grant execute on function submit_menu_photo(text, text, text, integer) to authenticated;

-- =========================================================================
-- 8. RPC: submit_merchant_claim_interest (consumer write path for CLM-03)
--    Dormant in this PR — app does not call it yet.
-- =========================================================================
create or replace function submit_merchant_claim_interest(
  p_venue_id      text,
  p_contact_name  text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_uen           text default null,
  p_notes         text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_building_id text;
  v_id uuid;
begin
  select building_id into v_building_id
    from venues
    where id = p_venue_id;

  if v_building_id is null then
    raise exception 'unknown venue: %', p_venue_id using errcode = '22023';
  end if;

  insert into merchant_claim_interests (
    venue_id, building_id, claimed_by,
    contact_name, contact_phone, contact_email, uen, notes, source
  ) values (
    p_venue_id, v_building_id, auth.uid(),
    p_contact_name, p_contact_phone, p_contact_email, p_uen, p_notes,
    'stall_detail_cta'
  )
  on conflict (venue_id, claimed_by)
    where claimed_by is not null
    do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function submit_merchant_claim_interest(
  text, text, text, text, text, text
) from public;
grant execute on function submit_merchant_claim_interest(
  text, text, text, text, text, text
) to authenticated;

-- =========================================================================
-- 9. COMMENTS (documentation surfaced in psql \d+ and Supabase Studio)
-- =========================================================================
comment on table menu_photo_submissions is
  'Consumer-uploaded menu photos awaiting OCR. Dev-only: RLS blocks all non-service-role access.';
comment on column menu_photo_submissions.vision_response is
  'Raw Google Cloud Vision API response kept for audit and confidence recalibration.';
comment on column menu_photo_submissions.ocr_status is
  'pending → processing → succeeded|failed|skipped. Terminal states only written by OCR pipeline.';

comment on table dishes_draft is
  'OCR-extracted dishes pre-promotion to dishes table. Dev-only: RLS blocks all non-service-role access.';
comment on column dishes_draft.name_normalized is
  'lower(trim(name)), used as O(1) dedupe probe before falling back to cosine similarity on embedding.';
comment on column dishes_draft.extraction_confidence is
  'Per-dish confidence 0..1 from the LLM extraction step (OCR-04).';
comment on column dishes_draft.confidence_bumps is
  'Increments each time a new submission matches this draft row via dedupe (see OCR-05). Trust signal for ops.';
comment on column dishes_draft.review_status is
  'pending → accepted|edited → promoted; or rejected|duplicate as terminal states. Only ops reviewers write this.';
comment on column dishes_draft.promoted_dish_id is
  'Set when an ops reviewer promotes this draft to a real row in dishes (see MP-07).';

comment on table merchant_claim_interests is
  'Waitlist of consumers who tapped "Claim this stall". Dev-only: RLS blocks all non-service-role access.';
comment on column merchant_claim_interests.source is
  'Origin of the interest event (e.g. stall_detail_cta, manual_entry).';
comment on column merchant_claim_interests.uen is
  'Singapore Unique Entity Number. Not validated at DB level; MP-02 will verify via SingPass Myinfo Business.';
comment on column merchant_claim_interests.status is
  'new → contacted → qualified → converted, or rejected. Only ops team transitions this.';
