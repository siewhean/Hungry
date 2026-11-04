-- Smoke checks for 20261030130000_consents_and_weekly_picks_off.sql.
-- A new account has no analytics answer and AI search off. Setting a consent stamps its time on the
-- server, a later write that leaves it alone keeps the stamp, and changing it moves the stamp.
-- A new notification_preferences row has weekly picks off, and the weekly picks push goes only to a
-- person with a device who turned it on (not to someone with no preferences row, and not to
-- someone who opted out). Runs in a transaction and rolls back.
--   no row:   00000000-0000-004b-b000-000000000001 (device, no preferences row)
--   opted in: 00000000-0000-004b-b000-000000000002 (device, weekly_picks true)
--   default:  00000000-0000-004b-b000-000000000003 (device, row created without weekly_picks)
--   opted out:00000000-0000-004b-b000-000000000004 (device, weekly_picks false)

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-004b-b000-000000000001', 'consent-smoke-1@example.test'),
  ('00000000-0000-004b-b000-000000000002', 'consent-smoke-2@example.test'),
  ('00000000-0000-004b-b000-000000000003', 'consent-smoke-3@example.test'),
  ('00000000-0000-004b-b000-000000000004', 'consent-smoke-4@example.test');

insert into user_profiles (id, display_name)
values
  ('00000000-0000-004b-b000-000000000001', 'Consent Smoke One'),
  ('00000000-0000-004b-b000-000000000002', 'Consent Smoke Two'),
  ('00000000-0000-004b-b000-000000000003', 'Consent Smoke Three'),
  ('00000000-0000-004b-b000-000000000004', 'Consent Smoke Four')
on conflict (id) do nothing;

-- A new privacy row (what choosing a profile visibility creates) has not been asked about anything.
insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-004b-b000-000000000001', 'private');

do $$
declare
  v record;
begin
  select * into v from privacy_settings where user_id = '00000000-0000-004b-b000-000000000001';
  if v.analytics_consent is not null or v.analytics_consent_at is not null then
    raise exception 'a new privacy row should have no analytics answer';
  end if;
  if v.ai_search_consent or v.ai_search_consent_at is not null then
    raise exception 'a new privacy row should have AI search off with no time';
  end if;
end $$;

-- Setting a consent stamps its time on the server, whatever time the app sends.
update privacy_settings
set analytics_consent = true, analytics_consent_at = '2000-01-01'
where user_id = '00000000-0000-004b-b000-000000000001';

do $$
declare
  v record;
begin
  select * into v from privacy_settings where user_id = '00000000-0000-004b-b000-000000000001';
  if v.analytics_consent is not true or v.analytics_consent_at <> now() then
    raise exception 'allowing analytics should stamp the server time, got %', v.analytics_consent_at;
  end if;
  if v.ai_search_consent_at is not null then
    raise exception 'changing analytics should not stamp AI search';
  end if;
end $$;

-- A write that leaves the consents alone keeps the stamp, and an app-sent time is never stored.
update privacy_settings
set account_visibility = 'public', analytics_consent_at = '2000-01-01'
where user_id = '00000000-0000-004b-b000-000000000001';

do $$
declare
  v record;
begin
  select * into v from privacy_settings where user_id = '00000000-0000-004b-b000-000000000001';
  if v.analytics_consent is not true or v.analytics_consent_at < '2001-01-01' then
    raise exception 'an unrelated write should keep the server stamp, got %', v.analytics_consent_at;
  end if;
end $$;

-- Allowing AI search stamps its own time; withdrawing it stamps again and the answer is false.
update privacy_settings set ai_search_consent = true
where user_id = '00000000-0000-004b-b000-000000000001';
update privacy_settings set ai_search_consent = false
where user_id = '00000000-0000-004b-b000-000000000001';

do $$
declare
  v record;
begin
  select * into v from privacy_settings where user_id = '00000000-0000-004b-b000-000000000001';
  if v.ai_search_consent or v.ai_search_consent_at is null then
    raise exception 'withdrawn AI search should read false with a time';
  end if;
end $$;

-- A person who answers before any privacy row exists gets one (a first-time upsert).
insert into privacy_settings (user_id, analytics_consent, ai_search_consent)
values ('00000000-0000-004b-b000-000000000002', false, true)
on conflict (user_id) do update set analytics_consent = excluded.analytics_consent;

do $$
declare
  v record;
begin
  select * into v from privacy_settings where user_id = '00000000-0000-004b-b000-000000000002';
  if v.analytics_consent is not false or v.analytics_consent_at is null then
    raise exception 'declining analytics should be saved as false with a time';
  end if;
  if not v.ai_search_consent or v.ai_search_consent_at is null then
    raise exception 'allowing AI search on insert should stamp its time';
  end if;
end $$;

-- Weekly picks: a new preferences row is off.
insert into user_push_tokens (user_id, token, platform)
values
  ('00000000-0000-004b-b000-000000000001', 'ExponentPushToken[consent-smoke-1]', 'ios'),
  ('00000000-0000-004b-b000-000000000002', 'ExponentPushToken[consent-smoke-2]', 'ios'),
  ('00000000-0000-004b-b000-000000000003', 'ExponentPushToken[consent-smoke-3]', 'ios'),
  ('00000000-0000-004b-b000-000000000004', 'ExponentPushToken[consent-smoke-4]', 'ios');

insert into notification_preferences (user_id, weekly_picks)
values
  ('00000000-0000-004b-b000-000000000002', true),
  ('00000000-0000-004b-b000-000000000004', false);
insert into notification_preferences (user_id, stall_updates)
values ('00000000-0000-004b-b000-000000000003', true);

do $$
begin
  if (select weekly_picks from notification_preferences
      where user_id = '00000000-0000-004b-b000-000000000003') is not false then
    raise exception 'a new preferences row should have weekly picks off';
  end if;

  perform public.enqueue_weekly_picks_notifications();

  if not exists (
    select 1 from notification_jobs
    where category = 'weekly_picks' and user_id = '00000000-0000-004b-b000-000000000002'
  ) then
    raise exception 'weekly picks should be queued for the person who turned it on';
  end if;
  if exists (
    select 1 from notification_jobs
    where category = 'weekly_picks'
      and user_id in (
        '00000000-0000-004b-b000-000000000001',
        '00000000-0000-004b-b000-000000000003',
        '00000000-0000-004b-b000-000000000004'
      )
  ) then
    raise exception 'weekly picks should not be queued for no row, a default row or an opt-out';
  end if;
end $$;

select 'consents_and_weekly_picks_off_smoke_passed' as result;

rollback;
