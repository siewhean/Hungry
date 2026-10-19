-- Portfolio item private notes are "only for you and collaborators".
--
-- The portfolio_items SELECT policy lets anyone who can view the list read its
-- rows (public lists, approved followers of followers_only lists), and
-- authenticated had a table-wide SELECT grant, so private_notes was readable by
-- every viewer. RLS cannot hide a single column, so:
--
-- 1. Clients get SELECT on every portfolio_items column except private_notes.
--    Row visibility is unchanged. Writes already go through the checked
--    SECURITY DEFINER RPCs (add/update_portfolio_item_*), which are unaffected.
-- 2. get_portfolio_private_notes(p_portfolio_id) returns (item_id, private_notes)
--    only to the list owner and its collaborators; everyone else gets no rows.

revoke select on table public.portfolio_items from public, anon, authenticated;
grant select (
  id,
  portfolio_id,
  item_type,
  dish_id,
  stall_id,
  score,
  public_notes,
  position,
  created_at,
  updated_at
) on table public.portfolio_items to authenticated;

create or replace function app_private.get_portfolio_private_notes(p_portfolio_id uuid)
returns table (item_id uuid, private_notes text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pi.id, pi.private_notes
  from public.portfolio_items pi
  join public.portfolios p on p.id = pi.portfolio_id
  where pi.portfolio_id = p_portfolio_id
    and pi.private_notes is not null
    and auth.uid() is not null
    and (
      p.owner_id = auth.uid()
      or exists (
        select 1
        from public.portfolio_collaborators pc
        where pc.portfolio_id = p.id
          and pc.user_id = auth.uid()
      )
    )
  order by pi.position, pi.id;
$$;

revoke all on function app_private.get_portfolio_private_notes(uuid)
  from public, anon, authenticated;
grant execute on function app_private.get_portfolio_private_notes(uuid)
  to authenticated, service_role;

create or replace function public.get_portfolio_private_notes(p_portfolio_id uuid)
returns table (item_id uuid, private_notes text)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_portfolio_private_notes(p_portfolio_id);
$$;

revoke all on function public.get_portfolio_private_notes(uuid) from public, anon;
grant execute on function public.get_portfolio_private_notes(uuid)
  to authenticated, service_role;
