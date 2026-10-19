-- Account deletion requests go through one server function instead of a direct
-- table insert, so a client cannot pick its own scheduled_for, status or
-- legal_hold. A repeat request returns the date already scheduled instead of a
-- unique-index error.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.request_my_account_deletion(p_reason text default null)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_scheduled_for timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select adr.scheduled_for
  into v_scheduled_for
  from public.account_deletion_requests adr
  where adr.user_id = v_user_id
    and adr.status in ('requested', 'processing')
  order by adr.created_at desc
  limit 1;

  if v_scheduled_for is not null then
    return v_scheduled_for;
  end if;

  -- status, scheduled_for and legal_hold come from the table defaults.
  insert into public.account_deletion_requests (user_id, reason)
  values (v_user_id, left(nullif(trim(coalesce(p_reason, '')), ''), 200))
  returning scheduled_for into v_scheduled_for;

  return v_scheduled_for;
end;
$$;

revoke all on function app_private.request_my_account_deletion(text) from public, anon, authenticated;
grant execute on function app_private.request_my_account_deletion(text) to authenticated, service_role;

create or replace function public.request_my_account_deletion(p_reason text default null)
returns timestamptz
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.request_my_account_deletion(p_reason);
$$;

revoke all on function public.request_my_account_deletion(text) from public, anon;
grant execute on function public.request_my_account_deletion(text) to authenticated, service_role;

-- Clients no longer insert rows directly; they still read their own request.
revoke insert on table public.account_deletion_requests from anon, authenticated;
drop policy if exists "account_deletion_insert_own" on public.account_deletion_requests;
