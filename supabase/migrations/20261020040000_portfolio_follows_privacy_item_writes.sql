-- Lists (portfolios) privacy and write-path hardening.
--
-- 1. portfolio_follows SELECT was `using (true)`: any signed-in user could list who
--    follows which list, private ones included. Now a row is visible only to the
--    follower and to the list owner. Follower counts stay available through
--    search_portfolios / get_public_portfolio, which run as SECURITY DEFINER.
-- 2. authenticated kept direct UPDATE/DELETE on portfolio_items, so the
--    expected-updated-at version guard in the item RPCs was only advisory.
--    Item writes now go only through the checked RPCs (their definer bodies live
--    in app_private and keep working).
-- 3. search_portfolios had no row cap and treated % and _ in the query as
--    wildcards. The private body now escapes them and returns at most 100 rows.
--    The public SECURITY INVOKER wrapper is unchanged.

begin;

-- Owner check without going through portfolios RLS (whose policies read other list
-- tables), so this policy can never join an RLS cycle. Answers only for the caller.
create schema if not exists app_private;

create or replace function app_private.is_portfolio_owner(p_portfolio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.portfolios
    where portfolios.id = p_portfolio_id
      and portfolios.owner_id = auth.uid()
  );
$$;

revoke all on function app_private.is_portfolio_owner(uuid) from public;
grant usage on schema app_private to anon, authenticated, service_role;
grant execute on function app_private.is_portfolio_owner(uuid) to authenticated, service_role;

drop policy if exists "Users can view portfolio follows" on public.portfolio_follows;
create policy "Users can view portfolio follows"
  on public.portfolio_follows for select
  using (
    user_id = (select auth.uid())
    or app_private.is_portfolio_owner(portfolio_follows.portfolio_id)
  );

revoke update, delete on table public.portfolio_items from public, anon, authenticated;
grant select on table public.portfolio_items to authenticated;
grant all on table public.portfolio_items to service_role;

-- Same signature and defaults as the body the advisor cleanup moved to app_private.
create or replace function app_private.search_portfolios(
  p_query text,
  p_type text default null,
  p_visibility text default 'public'
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  type text,
  visibility text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  item_count bigint,
  follower_count bigint
)
language plpgsql
security definer
-- extensions holds pg_trgm (similarity) on Supabase; public covers older installs.
set search_path = public, extensions, pg_temp
as $$
declare
  -- Escape LIKE metacharacters so "50%" or "a_b" match literally.
  v_pattern text := '%' || replace(replace(replace(lower(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  return query
  select
    p.id,
    p.owner_id,
    p.name,
    p.description,
    p.type,
    p.visibility,
    p.published_at,
    p.created_at,
    p.updated_at,
    (select count(*) from public.portfolio_items where portfolio_id = p.id) as item_count,
    (select count(*) from public.portfolio_follows where portfolio_id = p.id) as follower_count
  from public.portfolios p
  where
    (p_visibility is null or p.visibility = p_visibility)
    and (p_type is null or p.type = p_type)
    and lower(p.name || ' ' || coalesce(p.description, '')) like v_pattern escape '\'
    and (
      p.visibility = 'public'
      or p.owner_id = auth.uid()
      or (
        p.visibility = 'followers_only' and
        exists (
          select 1 from public.follows
          where follows.follower_id = auth.uid()
          and follows.followee_id = p.owner_id
          and follows.status = 'approved'
        )
      )
      or exists (
        select 1 from public.portfolio_collaborators
        where portfolio_collaborators.portfolio_id = p.id
        and portfolio_collaborators.user_id = auth.uid()
      )
    )
  order by
    case
      when nullif(trim(coalesce(p_query, '')), '') is null then 0
      else similarity(lower(p.name || ' ' || coalesce(p.description, '')), lower(p_query))
    end desc,
    p.created_at desc
  limit 100;
end;
$$;

revoke all on function app_private.search_portfolios(text, text, text) from public, anon;
grant execute on function app_private.search_portfolios(text, text, text) to authenticated, service_role;

commit;
