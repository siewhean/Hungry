-- Full Audit V1 social safety + gamification readiness smoke.
-- Read-only. Returns rows for missing release controls.

with required_tables(table_name) as (
  values
    ('post_comment_moderation_states'),
    ('user_food_cred'),
    ('food_cred_events'),
    ('user_stall_interactions'),
    ('weekly_missions'),
    ('user_mission_progress')
),
required_wrapped_rpc_functions(function_name) as (
  values
    ('open_chat_conversation'),
    ('send_chat_message'),
    ('report_content'),
    ('list_content_moderation_queue'),
    ('award_food_cred'),
    ('upsert_stall_interaction'),
    ('increment_mission_progress')
),
postgis_relocation_ready_functions(function_name) as (
  values
    ('get_taste_recommendations'),
    ('search_dishes'),
    ('get_nearby_open_venues'),
    ('list_buildings'),
    ('list_venues_by_building')
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
    'required_rpc_missing_or_unhardened' as check_name,
    'critical' as severity,
    rf.function_name as detail
  from required_wrapped_rpc_functions rf
  where not exists (
    select 1
    from pg_proc public_rpc
    join pg_namespace public_schema on public_schema.oid = public_rpc.pronamespace
    join pg_proc private_body
      on private_body.proname = public_rpc.proname
      and pg_get_function_identity_arguments(private_body.oid)
        = pg_get_function_identity_arguments(public_rpc.oid)
    join pg_namespace private_schema on private_schema.oid = private_body.pronamespace
    where public_schema.nspname = 'public'
      and private_schema.nspname = 'app_private'
      and public_rpc.proname = rf.function_name
      and public_rpc.prosecdef is false
      and private_body.prosecdef
      and exists (
        select 1
        from unnest(coalesce(private_body.proconfig, array[]::text[])) as config(setting)
        where setting = 'search_path=public'
      )
  )

  union all

  select
    'postgis_relocation_search_path_missing' as check_name,
    'high' as severity,
    prf.function_name as detail
  from postgis_relocation_ready_functions prf
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = prf.function_name
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as config(setting)
        where setting like 'search_path=%public%extensions%'
      )
  )

  union all

  select
    'unsafe_direct_user_table_privilege' as check_name,
    'critical' as severity,
    privilege as detail
  from (
    values
      ('authenticated can insert messages', has_table_privilege('authenticated', 'public.messages', 'INSERT')),
      ('authenticated can update messages', has_table_privilege('authenticated', 'public.messages', 'UPDATE')),
      ('authenticated can delete messages', has_table_privilege('authenticated', 'public.messages', 'DELETE')),
      ('anon can insert messages', has_table_privilege('anon', 'public.messages', 'INSERT')),
      ('authenticated can insert content_reports', has_table_privilege('authenticated', 'public.content_reports', 'INSERT')),
      ('anon can insert content_reports', has_table_privilege('anon', 'public.content_reports', 'INSERT'))
  ) as checks(privilege, allowed)
  where allowed

  union all

  select
    'moderation_queue_not_ops_admin_gated' as check_name,
    'critical' as severity,
    'list_content_moderation_queue' as detail
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = 'list_content_moderation_queue'
      and pg_get_functiondef(p.oid) ilike '%app_is_current_user_ops_admin()%'
  )

  union all

  select
    'mission_reward_transition_guard_missing' as check_name,
    'high' as severity,
    'increment_mission_progress' as detail
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = 'increment_mission_progress'
      and pg_get_functiondef(p.oid) ilike '%previous_completed_at is null%'
      and pg_get_functiondef(p.oid) ilike '%next_completed_at is not null%'
  )

  union all

  select
    'content_report_target_constraint_missing' as check_name,
    'high' as severity,
    'content_reports_target_type_check' as detail
  where not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'content_reports'
      and con.conname = 'content_reports_target_type_check'
      and pg_get_constraintdef(con.oid) ilike '%story%'
      and pg_get_constraintdef(con.oid) ilike '%message%'
      and pg_get_constraintdef(con.oid) ilike '%post_comment%'
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
