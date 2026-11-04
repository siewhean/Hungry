-- Down for 20261030130000_consents_and_weekly_picks_off.
-- The consent columns are copied to rollback_archive before they are dropped, so no consent record
-- is lost. Weekly picks goes back to "on unless the person opts out" (column default true and a
-- person with no preferences row is included again). Rows saved while the migration was live keep
-- the value the person chose.
create schema if not exists rollback_archive;
drop table if exists rollback_archive.privacy_consents_20261030130000;
create table rollback_archive.privacy_consents_20261030130000 as
  select user_id, analytics_consent, analytics_consent_at, ai_search_consent, ai_search_consent_at
  from public.privacy_settings
  where analytics_consent is not null or ai_search_consent;

drop trigger if exists trg_privacy_settings_stamp_consent on public.privacy_settings;
drop function if exists app_private.stamp_privacy_consent_times();

alter table public.privacy_settings
  drop column if exists analytics_consent,
  drop column if exists analytics_consent_at,
  drop column if exists ai_search_consent,
  drop column if exists ai_search_consent_at;

alter table public.notification_preferences
  alter column weekly_picks set default true;

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
