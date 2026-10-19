-- Meal-time suggestions: an opt-in push before lunch (11:30 SGT) and dinner
-- (17:30 SGT) that opens Decide for me with three picks.
--
-- Off unless the user turns it on (notification_preferences.mealtime_suggestions).
-- Only users who have not opened Hungry yet that Singapore day are sent one
-- (user_activity_days, from 20261019200000_user_lifecycle_states.sql), so
-- someone already deciding is not nudged. Jobs go through the same outbox
-- and send-notifications worker as stall alerts and weekly picks, which
-- apply opt-out, quiet hours, the per-user weekly cap and dedupe, and skip a
-- meal-time job that is more than two hours old or whose user has since
-- opened the app.

alter table public.notification_preferences
  add column if not exists mealtime_suggestions boolean not null default false;

alter table public.notification_jobs
  drop constraint if exists notification_jobs_category_check;
alter table public.notification_jobs
  add constraint notification_jobs_category_check
  check (category in ('stall_update', 'weekly_picks', 'merchant_low_rating', 'mealtime'));

alter table public.notification_jobs
  drop constraint if exists notification_jobs_change_kind_check;
alter table public.notification_jobs
  add constraint notification_jobs_change_kind_check
  check (change_kind in (
    'new_dish', 'price_change', 'back_in_stock', 'weekly_picks', 'low_rating', 'mealtime'
  ));

-- ---------------------------------------------------------------------------
-- Enqueue one job per opted-in user per meal per Singapore day
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_mealtime_notifications(p_meal text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_count integer;
begin
  if p_meal not in ('lunch', 'dinner') then
    raise exception 'p_meal must be lunch or dinner' using errcode = '22023';
  end if;

  insert into public.notification_jobs (
    user_id, category, change_kind, dedupe_key, title, body, deep_link
  )
  select
    np.user_id,
    'mealtime',
    'mealtime',
    concat_ws(':', np.user_id::text, 'mealtime', v_today::text, p_meal),
    case p_meal when 'lunch' then 'Can''t decide on lunch?' else 'Dinner, sorted' end,
    'Three dishes picked for your taste are ready. Tap to see them.',
    'https://usehungry.com/decide'
  from public.notification_preferences np
  where np.mealtime_suggestions
    and exists (select 1 from public.user_push_tokens t where t.user_id = np.user_id)
    and not exists (
      select 1 from public.user_activity_days d
      where d.user_id = np.user_id and d.activity_date = v_today
    )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_mealtime_notifications(text) from public, anon, authenticated;
grant execute on function public.enqueue_mealtime_notifications(text) to service_role;

-- ---------------------------------------------------------------------------
-- Cron: 03:30 UTC = 11:30 SGT (lunch), 09:30 UTC = 17:30 SGT (dinner). The
-- existing send-notifications job drains the outbox every 10 minutes.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'mealtime-lunch-notifications') then
    perform cron.unschedule('mealtime-lunch-notifications');
  end if;
  perform cron.schedule(
    'mealtime-lunch-notifications',
    '30 3 * * *',
    'select public.enqueue_mealtime_notifications(''lunch'')'
  );

  if exists (select 1 from cron.job where jobname = 'mealtime-dinner-notifications') then
    perform cron.unschedule('mealtime-dinner-notifications');
  end if;
  perform cron.schedule(
    'mealtime-dinner-notifications',
    '30 9 * * *',
    'select public.enqueue_mealtime_notifications(''dinner'')'
  );
end;
$$;
