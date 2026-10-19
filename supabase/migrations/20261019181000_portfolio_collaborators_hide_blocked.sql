-- Hide collaborators the viewer has blocked, or been blocked by.
--
-- 20261019180000 returned every collaborator's display name and avatar to every
-- other collaborator on the same list. Like list_user_following, skip rows where
-- a block exists between the viewer and that collaborator. The list owner still
-- sees every collaborator so they can manage the list, and everyone sees their
-- own row.

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
    and (
      pc.user_id = auth.uid()
      or p.owner_id = auth.uid()
      or not app_private.app_user_block_exists(auth.uid(), pc.user_id)
    )
  order by pc.created_at, pc.id;
$$;

revoke all on function app_private.list_portfolio_collaborators(uuid) from public, anon, authenticated;
grant execute on function app_private.list_portfolio_collaborators(uuid) to authenticated, service_role;
