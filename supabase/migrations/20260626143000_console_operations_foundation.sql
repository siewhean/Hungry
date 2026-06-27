create table if not exists public.console_feedback_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  source text not null default 'console',
  contact_email text,
  assigned_admin_id uuid,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.console_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status text not null default 'draft',
  audience text not null default 'internal_test',
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.console_feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  environment text not null default 'production',
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage between 0 and 100),
  owner_admin_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.console_app_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null,
  environment text not null default 'production',
  value jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  description text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (config_key, environment)
);

create table if not exists public.console_issue_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  source_type text not null,
  source_id text,
  assigned_admin_id uuid,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.console_feedback_threads enable row level security;
alter table public.console_notifications enable row level security;
alter table public.console_feature_flags enable row level security;
alter table public.console_app_config enable row level security;
alter table public.console_issue_links enable row level security;

revoke all on table public.console_feedback_threads from public, anon, authenticated;
revoke all on table public.console_notifications from public, anon, authenticated;
revoke all on table public.console_feature_flags from public, anon, authenticated;
revoke all on table public.console_app_config from public, anon, authenticated;
revoke all on table public.console_issue_links from public, anon, authenticated;

grant select, insert, update, delete on table public.console_feedback_threads to service_role;
grant select, insert, update, delete on table public.console_notifications to service_role;
grant select, insert, update, delete on table public.console_feature_flags to service_role;
grant select, insert, update, delete on table public.console_app_config to service_role;
grant select, insert, update, delete on table public.console_issue_links to service_role;

create index if not exists console_feedback_threads_status_idx
  on public.console_feedback_threads (status, priority, updated_at desc);

create index if not exists console_notifications_status_idx
  on public.console_notifications (status, scheduled_for desc nulls last);

create index if not exists console_feature_flags_environment_idx
  on public.console_feature_flags (environment, enabled);

create index if not exists console_app_config_environment_idx
  on public.console_app_config (environment, config_key);

create index if not exists console_issue_links_status_idx
  on public.console_issue_links (status, priority, updated_at desc);
