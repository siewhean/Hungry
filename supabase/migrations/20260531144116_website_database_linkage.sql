-- Website database linkage.
-- Backs the public waitlist and gives the web console an audited place to
-- record operator actions without creating a separate merchant data model.

create table if not exists public.website_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  audience text not null default 'foodie'
    check (audience in ('foodie', 'merchant', 'both')),
  business_name text,
  establishment_type text,
  source text not null default 'web_v2'
    check (source in ('web_v2', 'marketing_web', 'merchant_portal', 'console', 'unknown')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email)),
  check (position('@' in email::text) > 1)
);

create index if not exists idx_website_waitlist_entries_audience_submitted
  on public.website_waitlist_entries(audience, submitted_at desc);

create index if not exists idx_website_waitlist_entries_source_submitted
  on public.website_waitlist_entries(source, submitted_at desc);

drop trigger if exists trg_website_waitlist_entries_updated_at
  on public.website_waitlist_entries;
create trigger trg_website_waitlist_entries_updated_at
  before update on public.website_waitlist_entries
  for each row execute function public.set_updated_at();

alter table public.website_waitlist_entries enable row level security;

revoke all on table public.website_waitlist_entries from public, anon, authenticated;
grant insert on table public.website_waitlist_entries to anon, authenticated;
grant select, insert, update, delete on table public.website_waitlist_entries to service_role;

drop policy if exists "website_waitlist_public_insert"
  on public.website_waitlist_entries;
create policy "website_waitlist_public_insert"
on public.website_waitlist_entries for insert to anon, authenticated
with check (
  email = lower(email)
  and audience in ('foodie', 'merchant', 'both')
  and source in ('web_v2', 'marketing_web', 'merchant_portal', 'console', 'unknown')
);

drop policy if exists "website_waitlist_service_role_all"
  on public.website_waitlist_entries;
create policy "website_waitlist_service_role_all"
on public.website_waitlist_entries for all to service_role
using (true)
with check (true);

create table if not exists public.website_console_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email citext,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists idx_website_console_audit_events_created
  on public.website_console_audit_events(created_at desc);

create index if not exists idx_website_console_audit_events_target
  on public.website_console_audit_events(target_type, target_id, created_at desc)
  where target_id is not null;

alter table public.website_console_audit_events enable row level security;

revoke all on table public.website_console_audit_events from public, anon, authenticated;
grant select, insert on table public.website_console_audit_events to service_role;

drop policy if exists "website_console_audit_service_role_all"
  on public.website_console_audit_events;
create policy "website_console_audit_service_role_all"
on public.website_console_audit_events for all to service_role
using (true)
with check (true);

comment on table public.website_waitlist_entries is
  'Database-backed Hungry website waitlist for foodie and merchant interest.';

comment on table public.website_console_audit_events is
  'Server-side audit trail for Hungry Console actions performed from the website.';
