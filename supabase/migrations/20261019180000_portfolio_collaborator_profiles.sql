-- Collaborators show a name and avatar instead of a raw user id.
--
-- The list collaborator picker adds people the owner follows (insert/delete
-- still go through the existing portfolio_collaborators policies). Reading
-- collaborators now goes through list_portfolio_collaborators, which joins
-- user_profiles for display_name/avatar_url. Only the list owner and its
-- collaborators get rows; everyone else (including anon) gets none.

create schema if not exists app_private;

create or replace function app_private.list_portfolio_collaborators(p_portfolio_id uuid)
returns table (
  id uuid,
  portfolio_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id, pc.portfolio_id, pc.user_id, pc.role, pc.created_at, up.display_name, up.avatar_url
  from public.portfolio_collaborators pc
  join public.portfolios p on p.id = pc.portfolio_id
  left join public.user_profiles up on up.id = pc.user_id
  where pc.portfolio_id = p_portfolio_id
    and auth.uid() is not null
    and (
      p.owner_id = auth.uid()
      or exists (
        select 1
        from public.portfolio_collaborators me
        where me.portfolio_id = p_portfolio_id
          and me.user_id = auth.uid()
      )
    )
  order by pc.created_at, pc.id;
$$;

revoke all on function app_private.list_portfolio_collaborators(uuid) from public, anon, authenticated;
grant execute on function app_private.list_portfolio_collaborators(uuid) to authenticated, service_role;

create or replace function public.list_portfolio_collaborators(p_portfolio_id uuid)
returns table (
  id uuid,
  portfolio_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  display_name text,
  avatar_url text
)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.list_portfolio_collaborators(p_portfolio_id);
$$;

revoke all on function public.list_portfolio_collaborators(uuid) from public, anon;
grant execute on function public.list_portfolio_collaborators(uuid) to authenticated, service_role;
