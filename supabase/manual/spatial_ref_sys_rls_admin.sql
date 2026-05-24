-- Manual Supabase-owner remediation for remaining PostGIS Security Advisor
-- findings:
-- 1) RLS Disabled in Public on public.spatial_ref_sys.
-- 2) Client-executable SECURITY DEFINER PostGIS st_estimatedextent overloads.
--
-- The linked Hungry project has public.spatial_ref_sys owned by the PostGIS /
-- Supabase extension owner, so the project postgres role cannot run this:
-- ERROR 42501: must be owner of table spatial_ref_sys.
--
-- Run this from a Supabase owner/support context that can alter extension-owned
-- objects, then rerun:
-- npx --no-install supabase db advisors --linked --type security --level error -o json
-- npx --no-install supabase db advisors --linked --type security --level warn -o json

alter table public.spatial_ref_sys enable row level security;

drop policy if exists spatial_ref_sys_read_all on public.spatial_ref_sys;
create policy spatial_ref_sys_read_all
on public.spatial_ref_sys for select
using (true);

revoke execute on function public.st_estimatedextent(text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text)
from public, anon, authenticated;

revoke execute on function public.st_estimatedextent(text, text, text, boolean)
from public, anon, authenticated;
