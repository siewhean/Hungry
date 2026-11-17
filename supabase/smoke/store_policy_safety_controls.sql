-- Store policy safety smoke checks.
-- Run after applying migrations to a linked or local Supabase DB.

select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('account_deletion_requests', 'content_reports', 'user_blocks')
order by tablename;

select
  policyname,
  tablename,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('account_deletion_requests', 'content_reports', 'user_blocks')
order by tablename, policyname;
