-- smoke: supabase/smoke/consents_and_weekly_picks_off.sql
-- App Store review fixes for Settings (round five): consent saved on the account, and no push
-- nudge until the person opts in.
--
-- 1. privacy_settings gets two consent records (the table is already one row per account, owned by
--    the person, in the data export and purged at deletion):
--      analytics_consent  null = never asked, true = shares usage analytics, false = declined
--      ai_search_consent  false until the person allows AI search (their typed search text is sent
--                         to Anthropic); App Review 5.1.2(i)
--    A trigger stamps the *_at time on the server whenever a value is set or changed, so the app
--    cannot back-date a consent. The app writes only the boolean (a partial upsert), so a change on
--    one phone is never overwritten by a stale value from another.
-- 2. Weekly picks is an engagement nudge, so it is off until turned on (App Review 4.5.4):
--    the column default becomes false, and a person with no notification_preferences row is no
--    longer sent it (enqueue_weekly_picks_notifications and send-notifications). Rows that
--    already exist keep their saved value.
-- Rollback: supabase/rollbacks/20261030130000_consents_and_weekly_picks_off.down.sql.

alter table public.privacy_settings
  add column if not exists analytics_consent boolean,
  add column if not exists analytics_consent_at timestamptz,
  add column if not exists ai_search_consent boolean not null default false,
  add column if not exists ai_search_consent_at timestamptz;

create or replace function app_private.stamp_privacy_consent_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.analytics_consent_at := case when new.analytics_consent is null then null else now() end;
    new.ai_search_consent_at := case when new.ai_search_consent then now() else null end;
    return new;
  end if;
  if new.analytics_consent is distinct from old.analytics_consent then
    new.analytics_consent_at := case when new.analytics_consent is null then null else now() end;
  else
    new.analytics_consent_at := old.analytics_consent_at;
  end if;
  if new.ai_search_consent is distinct from old.ai_search_consent then
    new.ai_search_consent_at := now();
  else
    new.ai_search_consent_at := old.ai_search_consent_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_privacy_settings_stamp_consent on public.privacy_settings;
create trigger trg_privacy_settings_stamp_consent
  before insert or update on public.privacy_settings
  for each row execute function app_private.stamp_privacy_consent_times();

alter table public.notification_preferences
  alter column weekly_picks set default false;

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
  where coalesce(np.weekly_picks, false)
  on conflict (dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_weekly_picks_notifications() from public, anon, authenticated;
grant execute on function public.enqueue_weekly_picks_notifications() to service_role;
