-- Smoke checks for Phase 2 Home social feed read RPCs.
-- Each check should return zero rows except sample calls and the final pass marker.

with expected(function_name) as (
  values ('get_home_social_feed')
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

select 'security_definer_not_allowed' as check_name, proname::text as detail
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname = 'get_home_social_feed'
  and prosecdef;

with expected(indexname) as (
  values
    ('idx_posts_home_feed_cursor'),
    ('idx_posts_feed_published'),
    ('idx_post_media_post_order'),
    ('idx_follows_followee_status'),
    ('idx_follows_follower_status')
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

select 'missing_authenticated_execute' as check_name, 'get_home_social_feed' as detail
where not has_function_privilege(
  'authenticated',
  'public.get_home_social_feed(integer,timestamp with time zone,uuid)',
  'execute'
);

select 'unexpected_anon_execute' as check_name, 'get_home_social_feed' as detail
where has_function_privilege(
  'anon',
  'public.get_home_social_feed(integer,timestamp with time zone,uuid)',
  'execute'
);

select 'missing_visibility_guard' as check_name, 'get_home_social_feed' as detail
where not exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname = 'get_home_social_feed'
    and pg_get_functiondef(pg_proc.oid) ilike '%public.can_read_post(p.id)%'
);

select 'home_social_feed_sample' as check_name, count(*)::text as detail
from public.get_home_social_feed(10, null, null);

select 'home_social_feed_cursor_sample' as check_name, count(*)::text as detail
from public.get_home_social_feed(10, now(), 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);

select 'home_social_feed_reads_smoke_passed' as check_name, 'phase_2_feed' as detail;
