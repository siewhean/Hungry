-- Checklist / Portfolio / Passport readiness smoke.
-- Read-only. Returns rows for missing Phase 5 production controls.

with required_tables(table_name) as (
  values
    ('checklists'),
    ('checklist_items'),
    ('portfolios'),
    ('portfolio_items'),
    ('portfolio_collaborators'),
    ('portfolio_follows'),
    ('portfolio_flags'),
    ('passport_stamps'),
    ('passport_progress_events')
),
required_indexes(index_name) as (
  values
    ('idx_checklist_items_unique_dish'),
    ('idx_checklist_items_unique_stall'),
    ('idx_portfolio_items_unique_dish'),
    ('idx_portfolio_items_unique_stall'),
    ('idx_portfolio_flags_unique_pending'),
    ('idx_portfolios_name_description_trgm')
),
required_functions(function_name) as (
  values
    ('record_passport_progress'),
    ('assert_portfolio_expected_updated_at'),
    ('add_portfolio_item_with_passport'),
    ('update_portfolio_item_with_version'),
    ('delete_portfolio_item_with_version'),
    ('publish_portfolio_with_passport'),
    ('reorder_checklist_items'),
    ('reorder_portfolio_items'),
    ('search_portfolios'),
    ('enforce_portfolio_creation_rate_limit'),
    ('enforce_portfolio_flag_rate_limit')
),
findings as (
  select
    'required_table_missing_or_rls_disabled' as check_name,
    'critical' as severity,
    rt.table_name as detail
  from required_tables rt
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = rt.table_name
      and c.relkind = 'r'
      and c.relrowsecurity
  )

  union all

  select
    'required_index_missing' as check_name,
    'high' as severity,
    ri.index_name as detail
  from required_indexes ri
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = ri.index_name
      and c.relkind = 'i'
  )

  union all

  select
    'security_definer_search_path_missing' as check_name,
    'critical' as severity,
    rf.function_name as detail
  from required_functions rf
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = rf.function_name
      and p.prosecdef
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as config(setting)
        where setting = 'search_path=public'
      )
  )

  union all

  select
    'direct_portfolio_item_insert_not_revoked' as check_name,
    'critical' as severity,
    'authenticated insert on portfolio_items' as detail
  where has_table_privilege('authenticated', 'public.portfolio_items', 'INSERT')

  union all

  select
    'direct_passport_event_insert_not_revoked' as check_name,
    'critical' as severity,
    'authenticated insert on passport_progress_events' as detail
  where has_table_privilege('authenticated', 'public.passport_progress_events', 'INSERT')

  union all

  select
    'portfolio_search_not_trigram_ranked' as check_name,
    'medium' as severity,
    'search_portfolios' as detail
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'search_portfolios'
      and pg_get_functiondef(p.oid) ilike '%similarity(lower(p.name%'
  )
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
