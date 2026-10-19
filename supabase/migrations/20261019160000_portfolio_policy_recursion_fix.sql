-- Break the RLS cycle between portfolios and portfolio_collaborators.
--
-- portfolios_select_visible (20260527145534) checks portfolio_collaborators,
-- and the portfolio_collaborators SELECT policy checks portfolios, so any
-- signed-in read of either table fails with "infinite recursion detected in
-- policy". The collaborator check now goes through a SECURITY DEFINER helper in
-- app_private that reads portfolio_collaborators without RLS. It only answers
-- "is this user a collaborator on this list", for the caller's own user id
-- (always false for a visitor without a session).

create schema if not exists app_private;

create or replace function app_private.is_portfolio_collaborator(p_portfolio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.portfolio_collaborators
    where portfolio_collaborators.portfolio_id = p_portfolio_id
      and portfolio_collaborators.user_id = auth.uid()
  );
$$;

revoke all on function app_private.is_portfolio_collaborator(uuid) from public;
grant usage on schema app_private to anon, authenticated, service_role;
grant execute on function app_private.is_portfolio_collaborator(uuid) to anon, authenticated, service_role;

drop policy if exists portfolios_select_visible on public.portfolios;
create policy portfolios_select_visible
on public.portfolios
for select
to public
using (
  visibility = 'public'
  or owner_id = (select auth.uid())
  or (
    visibility = 'followers_only'
    and exists (
      select 1
      from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.followee_id = portfolios.owner_id
        and follows.status = 'approved'
    )
  )
  or app_private.is_portfolio_collaborator(portfolios.id)
);
