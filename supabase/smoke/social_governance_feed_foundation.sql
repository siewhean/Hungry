-- Smoke checks for Phase 3 social governance and Home feed read model foundation.
-- Each check should return zero rows except sample calls and the final pass marker.

with expected(table_name) as (
  values
    ('hidden_posts'),
    ('post_reports'),
    ('moderation_actions'),
    ('post_moderation_states'),
    ('home_feed_items')
),
actual as (
  select tablename::text as table_name
  from pg_tables
  where schemaname = 'public'
)
select 'missing_table' as check_name, expected.table_name as detail
from expected
except
select 'missing_table', actual.table_name
from actual;

with expected(function_name) as (
  values
    ('hide_post'),
    ('unhide_post'),
    ('report_post'),
    ('set_post_moderation_state'),
    ('get_home_social_feed_v2')
),
actual as (
  select proname::text as function_name
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
)
select 'missing_function' as check_name, expected.function_name as detail
from expected
except
select 'missing_function', actual.function_name
from actual;

with expected(table_name) as (
  values
    ('hidden_posts'),
    ('post_reports'),
    ('moderation_actions'),
    ('post_moderation_states'),
    ('home_feed_items')
)
select 'rls_not_enabled' as check_name, expected.table_name as detail
from expected
join pg_class on pg_class.relname = expected.table_name
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and pg_class.relrowsecurity is distinct from true;

select 'new_security_definer_not_allowed' as check_name, proname::text as detail
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname in (
    'hide_post',
    'unhide_post',
    'set_post_moderation_state',
    'get_home_social_feed_v2'
  )
  and prosecdef;

select 'missing_report_post_security_definer' as check_name, 'report_post' as detail
where not exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname = 'report_post'
    and prosecdef
);

with expected(indexname) as (
  values
    ('idx_hidden_posts_post_id'),
    ('idx_post_reports_post_status'),
    ('idx_post_reports_reporter_status'),
    ('idx_moderation_actions_target'),
    ('idx_moderation_actions_actor'),
    ('idx_post_moderation_states_state_updated'),
    ('idx_home_feed_items_viewer_cursor'),
    ('idx_home_feed_items_post_id'),
    ('idx_home_feed_items_bucket_cursor')
),
actual as (
  select indexname::text
  from pg_indexes
  where schemaname = 'public'
)
select 'missing_index' as check_name, expected.indexname as detail
from expected
except
select 'missing_index', actual.indexname
from actual;

with expected(policyname, tablename) as (
  values
    ('hidden_posts_service_role_all', 'hidden_posts'),
    ('post_reports_service_role_all', 'post_reports'),
    ('moderation_actions_service_role_all', 'moderation_actions'),
    ('post_moderation_states_service_role_all', 'post_moderation_states'),
    ('home_feed_items_service_role_all', 'home_feed_items')
),
actual as (
  select policyname::text, tablename::text
  from pg_policies
  where schemaname = 'public'
    and 'service_role'::name = any(roles)
)
select 'missing_service_role_policy' as check_name, expected.tablename || '.' || expected.policyname as detail
from expected
except
select 'missing_service_role_policy', actual.tablename || '.' || actual.policyname
from actual;

with expected(policyname, tablename) as (
  values
    ('hidden_posts_select_own', 'hidden_posts'),
    ('hidden_posts_insert_own', 'hidden_posts'),
    ('hidden_posts_delete_own', 'hidden_posts'),
    ('hidden_posts_update_own', 'hidden_posts'),
    ('post_reports_select_own', 'post_reports'),
    ('post_moderation_states_select_visible_post', 'post_moderation_states'),
    ('home_feed_items_select_scoped', 'home_feed_items')
),
actual as (
  select policyname::text, tablename::text
  from pg_policies
  where schemaname = 'public'
    and 'authenticated'::name = any(roles)
)
select 'missing_authenticated_policy' as check_name, expected.tablename || '.' || expected.policyname as detail
from expected
except
select 'missing_authenticated_policy', actual.tablename || '.' || actual.policyname
from actual;

select 'unexpected_anon_policy' as check_name, tablename || '.' || policyname as detail
from pg_policies
where schemaname = 'public'
  and tablename in (
    'hidden_posts',
    'post_reports',
    'moderation_actions',
    'post_moderation_states',
    'home_feed_items'
  )
  and 'anon'::name = any(roles);

select 'unexpected_post_reports_authenticated_write_policy' as check_name, policyname as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'post_reports'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and 'authenticated'::name = any(roles);

select 'unexpected_post_reports_authenticated_insert' as check_name, 'post_reports' as detail
where has_table_privilege('authenticated', 'public.post_reports', 'insert');

select 'unexpected_post_reports_authenticated_update' as check_name, 'post_reports' as detail
where has_table_privilege('authenticated', 'public.post_reports', 'update');

select 'unexpected_post_reports_authenticated_delete' as check_name, 'post_reports' as detail
where has_table_privilege('authenticated', 'public.post_reports', 'delete');

select 'missing_authenticated_execute' as check_name, 'hide_post' as detail
where not has_function_privilege('authenticated', 'public.hide_post(uuid,text)', 'execute');

select 'missing_authenticated_execute' as check_name, 'unhide_post' as detail
where not has_function_privilege('authenticated', 'public.unhide_post(uuid)', 'execute');

select 'missing_authenticated_execute' as check_name, 'report_post' as detail
where not has_function_privilege('authenticated', 'public.report_post(uuid,text,text)', 'execute');

select 'missing_authenticated_execute' as check_name, 'get_home_social_feed_v2' as detail
where not has_function_privilege(
  'authenticated',
  'public.get_home_social_feed_v2(integer,timestamp with time zone,uuid)',
  'execute'
);

select 'unexpected_authenticated_execute' as check_name, 'set_post_moderation_state' as detail
where has_function_privilege(
  'authenticated',
  'public.set_post_moderation_state(uuid,text,text,uuid,jsonb)',
  'execute'
);

select 'missing_service_role_execute' as check_name, 'set_post_moderation_state' as detail
where not has_function_privilege(
  'service_role',
  'public.set_post_moderation_state(uuid,text,text,uuid,jsonb)',
  'execute'
);

select 'unexpected_anon_execute' as check_name, proname::text as detail
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname in (
    'hide_post',
    'unhide_post',
    'report_post',
    'set_post_moderation_state',
    'get_home_social_feed_v2'
  )
  and has_function_privilege(
    'anon',
    format('%I.%I(%s)', pg_namespace.nspname, proname, oidvectortypes(proargtypes)),
    'execute'
  );

select 'missing_can_read_post_moderation_guard' as check_name, 'can_read_post' as detail
where not exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname = 'can_read_post'
    and pg_get_functiondef(pg_proc.oid) ilike '%post_moderation_states%'
    and pg_get_functiondef(pg_proc.oid) ilike '%hidden%'
    and pg_get_functiondef(pg_proc.oid) ilike '%removed%'
);

select 'missing_feed_read_model_guard' as check_name, 'get_home_social_feed_v2' as detail
where not exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname = 'get_home_social_feed_v2'
    and pg_get_functiondef(pg_proc.oid) ilike '%home_feed_items%'
    and pg_get_functiondef(pg_proc.oid) ilike '%hidden_posts%'
    and pg_get_functiondef(pg_proc.oid) ilike '%post_moderation_states%'
    and pg_get_functiondef(pg_proc.oid) ilike '%public.can_read_post(p.id)%'
);

select 'missing_feed_cursor_order' as check_name, 'get_home_social_feed_v2' as detail
where not exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname = 'get_home_social_feed_v2'
    and regexp_replace(pg_get_functiondef(pg_proc.oid), '\s+', ' ', 'g')
      ilike '%order by p.feed_created_at desc, p.id desc%'
);

select 'unexpected_rank_score_cursor_order' as check_name, 'get_home_social_feed_v2' as detail
where exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname = 'get_home_social_feed_v2'
    and regexp_replace(pg_get_functiondef(pg_proc.oid), '\s+', ' ', 'g')
      ilike '%order by%rank_score%'
);

select 'home_social_feed_v2_sample' as check_name, count(*)::text as detail
from public.get_home_social_feed_v2(10, null, null);

select 'home_social_feed_v2_cursor_sample' as check_name, count(*)::text as detail
from public.get_home_social_feed_v2(10, now(), 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);

select 'social_governance_feed_foundation_smoke_passed' as check_name, 'phase_3_social_feed' as detail;
