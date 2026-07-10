-- Website Console admin roles.
-- Adds a service-role-managed allowlist for Supabase Auth users who may access
-- service-role-backed Hungry Console APIs from the marketing website.

create table if not exists public.website_console_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email citext,
  role text not null default 'admin'
    check (role in ('admin', 'ops', 'viewer')),
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or email = lower(email))
);

create index if not exists idx_website_console_admins_status_role
  on public.website_console_admins(status, role);

create index if not exists idx_website_console_admins_email_lower
  on public.website_console_admins(lower(email::text))
  where email is not null;

drop trigger if exists trg_website_console_admins_updated_at
  on public.website_console_admins;
create trigger trg_website_console_admins_updated_at
  before update on public.website_console_admins
  for each row execute function public.set_updated_at();

alter table public.website_console_admins enable row level security;

revoke all on table public.website_console_admins from public, anon, authenticated;
grant select, insert, update, delete on table public.website_console_admins to service_role;

drop policy if exists "website_console_admins_service_role_all"
  on public.website_console_admins;
create policy "website_console_admins_service_role_all"
on public.website_console_admins for all to service_role
using (true)
with check (true);

comment on table public.website_console_admins is
  'Service-role-managed Supabase Auth allowlist for Hungry Console website API access.';

comment on column public.website_console_admins.role is
  'admin and ops can access Console APIs; viewer is reserved for future read-only Console UI.';
