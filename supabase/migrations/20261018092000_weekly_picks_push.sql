-- Re-engagement: a weekly "Your new picks are ready" push, Mondays 11:00 SGT.
--
-- Reuses the outbox from 20261018003000_retention_follows_push_alerts.sql:
-- jobs go into public.notification_jobs and the send-notifications worker
-- applies opt-out, quiet hours (Singapore time), the per-user weekly cap,
-- staleness and dedupe before sending.
--
-- Who gets it: users with a registered push token (they granted notification
-- permission) whose weekly_picks preference is on. It defaults to on, and a
-- user without a notification_preferences row is treated as on. Setting
-- weekly_picks = false opts out of this push without touching stall alerts.

-- ---------------------------------------------------------------------------
-- Preference: separate opt-out for the weekly picks push
-- ---------------------------------------------------------------------------

alter table public.notification_preferences
  add column if not exists weekly_picks boolean not null default true;

-- ---------------------------------------------------------------------------
-- Outbox: allow the weekly_picks category
-- ---------------------------------------------------------------------------

alter table public.notification_jobs
  drop constraint if exists notification_jobs_category_check;
alter table public.notification_jobs
  add constraint notification_jobs_category_check
  check (category in ('stall_update', 'weekly_picks'));

alter table public.notification_jobs
  drop constraint if exists notification_jobs_change_kind_check;
alter table public.notification_jobs
  add constraint notification_jobs_change_kind_check
  check (change_kind in ('new_dish', 'price_change', 'back_in_stock', 'weekly_picks'));

-- ---------------------------------------------------------------------------
-- Enqueue one job per opted-in user per Singapore ISO week
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_weekly_picks_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week text := to_char(now() at time zone 'Asia/Singapore', 'IYYY-"W"IW');
  v_count integer;
begin
  insert into public.notification_jobs (
    user_id, category, change_kind, dedupe_key, title, body, deep_link
  )
  select
    t.user_id,
    'weekly_picks',
    'weekly_picks',
    concat_ws(':', t.user_id::text, 'weekly_picks', v_week),
    'Your new picks are ready',
    'Five dishes to try this week are waiting on Home.',
    'https://usehungry.com/home'
  from (select distinct user_id from public.user_push_tokens) t
  left join public.notification_preferences np on np.user_id = t.user_id
  where coalesce(np.weekly_picks, true)
  on conflict (dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_weekly_picks_notifications() from public, anon, authenticated;
grant execute on function public.enqueue_weekly_picks_notifications() to service_role;

-- ---------------------------------------------------------------------------
-- Cron: Mondays 03:00 UTC = 11:00 SGT. The existing send-notifications job
-- drains the outbox every 10 minutes.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-picks-notifications') then
    perform cron.unschedule('weekly-picks-notifications');
  end if;
  perform cron.schedule(
    'weekly-picks-notifications',
    '0 3 * * 1',
    'select public.enqueue_weekly_picks_notifications()'
  );
end;
$$;
