-- Smoke checks for the Discover area count RPC.

select
  p.proname as function_name,
  pg_get_functiondef(p.oid) ~* 'security invoker' as security_invoker,
  pg_get_functiondef(p.oid) ~* 'set search_path = public' as public_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'count_venues_in_area';

select
  has_function_privilege(
    'anon',
    'public.count_venues_in_area(double precision, double precision, integer)',
    'execute'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.count_venues_in_area(double precision, double precision, integer)',
    'execute'
  ) as authenticated_can_execute;

select public.count_venues_in_area(1.2813, 103.8458, 3000) as nearby_venue_count;
