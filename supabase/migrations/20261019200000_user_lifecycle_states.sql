-- Lifecycle states, after Duolingo's published growth model, adapted to food
-- use: "current" means active within the past week rather than yesterday,
-- because people decide what to eat a few times a week, not every day.
--
-- The app calls record_app_open() once per Singapore day (it is idempotent:
-- one row per user per day). Each user then has one of these states:
--
--   active today:     new (first ever day), current (previous visit within
--                     7 days), reactivated (8-30 days), resurrected (31+ days)
--   not active today: at_risk_weekly (last visit within 7 days),
--                     at_risk_monthly (8-30 days), dormant (31+ days)
--
-- lifecycle_state_for() is the single definition; the meal-time push and
-- lifecycle_state_counts() use it too. The app mirrors it in
-- src/features/lifecycle/lifecycle.ts for the mock service.

create table if not exists public.user_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

alter table public.user_activity_days enable row level security;

drop policy if exists "user_activity_days_select_own" on public.user_activity_days;
create policy "user_activity_days_select_own" on public.user_activity_days
  for select to authenticated using (user_id = (select auth.uid()));

-- Writes go through record_app_open() only.
revoke all on table public.user_activity_days from public, anon, authenticated;
grant select on table public.user_activity_days to authenticated;
grant all on table public.user_activity_days to service_role;

-- ---------------------------------------------------------------------------
-- State of one user on a Singapore date; null when they were never active.
-- ---------------------------------------------------------------------------

create or replace function public.lifecycle_state_for(
  p_user uuid,
  p_today date default (now() at time zone 'Asia/Singapore')::date
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select
      coalesce(bool_or(d.activity_date = p_today), false) as active_today,
      max(d.activity_date) filter (where d.activity_date < p_today) as previous_date
    from public.user_activity_days d
    where d.user_id = p_user
      and d.activity_date <= p_today
  )
  select case
    when days.active_today then case
      when days.previous_date is null then 'new'
      when p_today - days.previous_date <= 7 then 'current'
      when p_today - days.previous_date <= 30 then 'reactivated'
      else 'resurrected'
    end
    when days.previous_date is null then null
    when p_today - days.previous_date <= 7 then 'at_risk_weekly'
    when p_today - days.previous_date <= 30 then 'at_risk_monthly'
    else 'dormant'
  end
  from days;
$$;

revoke all on function public.lifecycle_state_for(uuid, date) from public, anon, authenticated;
grant execute on function public.lifecycle_state_for(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- Called by the app on launch and when it returns to the foreground.
-- ---------------------------------------------------------------------------

create or replace function public.record_app_open()
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

revoke all on function public.record_app_open() from public, anon;
grant execute on function public.record_app_open() to authenticated;

-- ---------------------------------------------------------------------------
-- Measurement: how many users are in each state on a date (service role).
-- ---------------------------------------------------------------------------

create or replace function public.lifecycle_state_counts(
  p_today date default (now() at time zone 'Asia/Singapore')::date
)
returns table (state text, users bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select public.lifecycle_state_for(u.user_id, p_today) as state, count(*) as users
  from (
    select distinct d.user_id
    from public.user_activity_days d
    where d.activity_date <= p_today
  ) u
  group by 1
  order by 1;
$$;

revoke all on function public.lifecycle_state_counts(date) from public, anon, authenticated;
grant execute on function public.lifecycle_state_counts(date) to service_role;
