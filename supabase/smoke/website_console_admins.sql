-- Website Console admin-role smoke.
-- Read-only. Returns rows for findings that need review; zero rows is expected.

with target_table as (
  select
    c.oid,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'website_console_admins'
    and c.relkind = 'r'
),
findings as (
  select
    'website_console_admins_missing' as check_name,
    'critical' as severity,
    'public.website_console_admins was not found' as detail
  where not exists (select 1 from target_table)

  union all

  select
    'website_console_admins_rls_disabled' as check_name,
    'critical' as severity,
    'public.website_console_admins must have RLS enabled' as detail
  from target_table
  where not rls_enabled

  union all

  select
    'website_console_admins_client_grant' as check_name,
    'high' as severity,
    grantee || ':' || privilege_type as detail
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'website_console_admins'
    and grantee in ('anon', 'authenticated', 'public')

  union all

  select
    'website_console_admins_missing_service_policy' as check_name,
    'high' as severity,
    'service_role all policy is missing' as detail
  where not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'website_console_admins'
      and policyname = 'website_console_admins_service_role_all'
      and 'service_role' = any(roles)
  )

  union all

  select
    'website_console_admins_missing_index' as check_name,
    'review' as severity,
    index_name as detail
  from (
    values
      ('website_console_admins_user_id_key'),
      ('idx_website_console_admins_status_role')
  ) as required(index_name)
  where not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'website_console_admins'
      and indexname = required.index_name
  )
)
select *
from findings
order by
  case severity
    when 'critical' then 1
    when 'high' then 2
    when 'review' then 3
    else 4
  end,
  check_name,
  detail;
