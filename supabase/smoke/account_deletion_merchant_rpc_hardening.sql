-- Account deletion + merchant RPC hardening smoke.
-- Read-only. Returns rows for missing release-hardening controls.

with findings as (
  select
    'account_deletion_metadata_missing' as check_name,
    'critical' as severity,
    column_name as detail
  from (
    values
      ('processing_started_at'),
      ('processing_attempts'),
      ('worker_lock_id'),
      ('worker_locked_at'),
      ('anonymized_at'),
      ('auth_deleted_at'),
      ('legal_hold'),
      ('retention_reason'),
      ('last_error')
  ) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'account_deletion_requests'
      and c.column_name = required.column_name
  )

  union all

  select
    'active_account_deletion_unique_guard_missing' as check_name,
    'critical' as severity,
    'uniq_account_deletion_requests_active_user' as detail
  where not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'account_deletion_requests'
      and indexname = 'uniq_account_deletion_requests_active_user'
      and indexdef ilike '%unique%'
      and indexdef ilike '%requested%'
      and indexdef ilike '%processing%'
  )

  union all

  select
    'account_deletion_audit_table_missing' as check_name,
    'critical' as severity,
    'public.account_deletion_processing_events' as detail
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'account_deletion_processing_events'
      and c.relkind = 'r'
      and c.relrowsecurity
  )

  union all

  select
    'required_rpc_missing' as check_name,
    'critical' as severity,
    rpc_name as detail
  from (
    values
      ('claim_account_deletion_requests'),
      ('anonymize_account_deletion_request'),
      ('complete_account_deletion_request'),
      ('record_merchant_dish_view'),
      ('get_merchant_dish_view_counts'),
      ('enqueue_merchant_team_invite_email'),
      ('enqueue_merchant_weekly_summary_email')
  ) as required(rpc_name)
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = required.rpc_name
      and p.prosecdef
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as config(setting)
        where setting = 'search_path=public'
      )
  )

  union all

  select
    'direct_merchant_dish_view_insert_policy_present' as check_name,
    'high' as severity,
    policyname as detail
  from pg_policies
  where schemaname = 'public'
    and tablename = 'merchant_dish_view_events'
    and cmd in ('INSERT', 'ALL')
    and ('anon' = any(roles) or 'authenticated' = any(roles))

  union all

  select
    'direct_merchant_email_outbox_insert_policy_present' as check_name,
    'high' as severity,
    policyname as detail
  from pg_policies
  where schemaname = 'public'
    and tablename = 'merchant_email_outbox'
    and cmd in ('INSERT', 'ALL')
    and ('anon' = any(roles) or 'authenticated' = any(roles))
)
select *
from findings
order by
  case severity
    when 'critical' then 1
    when 'high' then 2
    else 3
  end,
  check_name,
  detail;
