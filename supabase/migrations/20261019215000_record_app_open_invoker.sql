-- record_app_open() was a public SECURITY DEFINER function callable by
-- authenticated, which the security advisor flags. Move the body into
-- app_private and keep public.record_app_open() as an invoker wrapper.

create schema if not exists app_private;

create or replace function app_private.record_app_open()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_previous date;
begin
  if v_user is null then
    raise exception 'record_app_open requires a signed-in user' using errcode = '42501';
  end if;

  insert into public.user_activity_days (user_id, activity_date)
  values (v_user, v_today)
  on conflict do nothing;

  select max(activity_date) into v_previous
  from public.user_activity_days
  where user_id = v_user and activity_date < v_today;

  return jsonb_build_object(
    'state', public.lifecycle_state_for(v_user, v_today),
    'previousActiveDate', v_previous,
    'daysSincePrevious', v_today - v_previous
  );
end;
$$;

revoke all on function app_private.record_app_open() from public, anon, authenticated;
grant execute on function app_private.record_app_open() to authenticated, service_role;

create or replace function public.record_app_open()
returns jsonb
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.record_app_open();
$$;

revoke all on function public.record_app_open() from public, anon;
grant execute on function public.record_app_open() to authenticated, service_role;
