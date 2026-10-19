-- Discover's area count used `.ilike('planning_area', name)` with an exact count,
-- which cannot use idx_venues_planning_area_norm (lower(trim(planning_area))).
-- This compares the same normalised expression with `=`, so the index applies.
-- SECURITY INVOKER: venues RLS still decides which rows a caller can count.

create or replace function public.count_venues_in_planning_area(p_area_name text)
returns integer
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.venues v
  where v.planning_area is not null
    and lower(trim(v.planning_area)) = lower(trim(p_area_name));
$$;

revoke all on function public.count_venues_in_planning_area(text) from public;
grant execute on function public.count_venues_in_planning_area(text) to anon, authenticated, service_role;

comment on function public.count_venues_in_planning_area(text) is
  'Exact venue count for a planning area via the normalised-expression index. Security invoker.';
