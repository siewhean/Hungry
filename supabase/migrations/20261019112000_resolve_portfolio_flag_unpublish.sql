-- Moderation "Remove" on a reported list only set portfolio_flags.status, so
-- the list stayed public. resolve_portfolio_flag(p_flag_id, p_resolution):
--   * ops admins only (app_is_current_user_ops_admin, same as the flags UPDATE policy);
--   * 'dismissed' closes that flag;
--   * 'removed' closes every pending flag on the list and takes the list down
--     (visibility 'private', published_at cleared) in the same transaction.

create or replace function app_private.resolve_portfolio_flag(
  p_flag_id uuid,
  p_resolution text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_portfolio_id uuid;
begin
  if not public.app_is_current_user_ops_admin() then
    raise exception 'Only moderators can resolve list reports'
      using errcode = '42501';
  end if;

  if p_resolution not in ('dismissed', 'removed') then
    raise exception 'Unknown resolution %', p_resolution
      using errcode = '22023';
  end if;

  update public.portfolio_flags
  set status = p_resolution,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_flag_id
  returning portfolio_id into v_portfolio_id;

  if v_portfolio_id is null then
    raise exception 'Report % not found', p_flag_id
      using errcode = 'P0002';
  end if;

  if p_resolution = 'removed' then
    update public.portfolios
    set visibility = 'private',
        published_at = null
    where id = v_portfolio_id;

    update public.portfolio_flags
    set status = 'removed',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where portfolio_id = v_portfolio_id
      and status = 'pending';
  end if;
end;
$$;

revoke all on function app_private.resolve_portfolio_flag(uuid, text)
  from public, anon, authenticated;
grant execute on function app_private.resolve_portfolio_flag(uuid, text)
  to authenticated, service_role;

create or replace function public.resolve_portfolio_flag(
  p_flag_id uuid,
  p_resolution text
)
returns void
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.resolve_portfolio_flag(p_flag_id, p_resolution);
$$;

revoke all on function public.resolve_portfolio_flag(uuid, text) from public, anon;
grant execute on function public.resolve_portfolio_flag(uuid, text)
  to authenticated, service_role;
