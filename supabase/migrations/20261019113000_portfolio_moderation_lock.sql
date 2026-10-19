-- A moderator's "removed" made the list private and unpublished, but the owner
-- could make it public again (portfolios UPDATE or publish_portfolio_with_passport)
-- with one tap. portfolios.moderation_removed_at records the takedown:
--   * app_private.resolve_portfolio_flag sets it on 'removed';
--   * a BEFORE UPDATE trigger rejects any row that has it set and is not
--     private and unpublished, so both the table UPDATE path and the publish
--     RPC (which updates the same row) are refused;
--   * only ops admins (or server-side roles) may set or clear it.

alter table public.portfolios
  add column if not exists moderation_removed_at timestamptz;

create or replace function app_private.enforce_portfolio_moderation_lock()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.moderation_removed_at is distinct from old.moderation_removed_at
    and current_user in ('anon', 'authenticated')
    and not public.app_is_current_user_ops_admin()
  then
    raise exception 'Only moderators can change a list''s moderation state'
      using errcode = '42501';
  end if;

  if new.moderation_removed_at is not null
    and (new.visibility <> 'private' or new.published_at is not null)
  then
    raise exception 'This list was removed by moderators and can''t be shared'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_portfolio_moderation_lock()
  from public, anon, authenticated;

drop trigger if exists portfolios_moderation_lock on public.portfolios;
create trigger portfolios_moderation_lock
before update on public.portfolios
for each row
execute function app_private.enforce_portfolio_moderation_lock();

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
        published_at = null,
        moderation_removed_at = now()
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
