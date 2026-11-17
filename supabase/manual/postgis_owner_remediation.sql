-- Supabase-owner remediation for PostGIS security advisor findings.
-- This script must be run by a database owner/superuser context
-- (supabase_admin via support workflow), not from the normal project role.

-- 1) Keep spatial_ref_sys usable for lookups while enabling RLS.
alter table public.spatial_ref_sys
  enable row level security;

drop policy if exists spatial_ref_sys_read_all on public.spatial_ref_sys;
drop policy if exists spatial_ref_sys_read_lookup on public.spatial_ref_sys;

create policy spatial_ref_sys_read_all
  on public.spatial_ref_sys
  for select
  to anon, authenticated
  using (true);

-- Optional explicit grant if policy visibility is affected by role defaults.
grant select on table public.spatial_ref_sys to anon, authenticated;

-- 2) Remove execute from public/anon/authenticated on PostGIS helper funcs.
revoke execute on function public.st_estimatedextent(text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text, boolean)
from public, anon, authenticated;

-- 3) Verification queries
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'spatial_ref_sys';

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'spatial_ref_sys';

select
  has_function_privilege('public.st_estimatedextent(text, text)', 'execute', 'anon') as anon_execute_2,
  has_function_privilege('public.st_estimatedextent(text, text)', 'execute', 'authenticated') as authenticated_execute_2,
  has_function_privilege('public.st_estimatedextent(text, text, text)', 'execute', 'anon') as anon_execute_3,
  has_function_privilege('public.st_estimatedextent(text, text, text)', 'execute', 'authenticated') as authenticated_execute_3,
  has_function_privilege('public.st_estimatedextent(text, text, text, boolean)', 'execute', 'anon') as anon_execute_4,
  has_function_privilege('public.st_estimatedextent(text, text, text, boolean)', 'execute', 'authenticated') as authenticated_execute_4;
