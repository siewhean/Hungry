-- Neutral Supabase audit smoke.
-- Read-only. Returns rows for findings that need review; zero rows is the ideal state.

with public_tables as (
  select
    c.oid,
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname <> 'spatial_ref_sys'
),
table_policy_counts as (
  select
    schemaname,
    tablename,
    count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
),
findings as (
  select
    'public_table_without_rls' as check_name,
    'critical' as severity,
    schema_name || '.' || table_name as detail
  from public_tables
  where not rls_enabled

  union all

  select
    'public_table_without_policy' as check_name,
    'review' as severity,
    t.schema_name || '.' || t.table_name as detail
  from public_tables t
  left join table_policy_counts p
    on p.schemaname = t.schema_name
   and p.tablename = t.table_name
  where coalesce(p.policy_count, 0) = 0

  union all

  select
    'anon_write_policy' as check_name,
    'high' as severity,
    schemaname || '.' || tablename || ':' || policyname || ':' || cmd as detail
  from pg_policies
  where schemaname in ('public', 'storage')
    and 'anon' = any(roles)
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')

  union all

  select
    'merchant_dish_view_insert_policy_needs_tightening' as check_name,
    'high' as severity,
    policyname || ': missing dish venue/user binding in policy predicate' as detail
  from pg_policies
  where schemaname = 'public'
    and tablename = 'merchant_dish_view_events'
    and cmd = 'INSERT'
    and (
      coalesce(with_check, '') !~* 'dishes'
      or coalesce(with_check, '') !~* 'auth.uid'
    )

  union all

  select
    'merchant_email_outbox_client_insert_policy' as check_name,
    'high' as severity,
    policyname || ': queued email creation should be service-role or constrained RPC only' as detail
  from pg_policies
  where schemaname = 'public'
    and tablename = 'merchant_email_outbox'
    and cmd in ('INSERT', 'ALL')
    and 'authenticated' = any(roles)

  union all

  select
    'security_definer_missing_search_path' as check_name,
    'high' as severity,
    p.oid::regprocedure::text as detail
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) as config(setting)
      where setting like 'search_path=%'
    )

  union all

  select
    'public_storage_bucket' as check_name,
    'review' as severity,
    id || ': public=' || public::text as detail
  from storage.buckets
  where id in (
    'avatars',
    'bites-media',
    'menu-photos',
    'post-media',
    'review-media',
    'merchant-dish-images',
    'merchant-stall-images',
    'merchant-verification-evidence'
  )
    and public
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
