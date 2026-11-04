-- Smoke checks for 20261031090000_content_report_digest.sql.
-- A report is claimed for the digest once: claiming marks it, a second claim skips it, a report
-- that is not open is never claimed, and releasing a claim puts the report back. The 15 minute
-- job exists. Runs in a transaction and rolls back.
--   reporter: 00000000-0000-004c-c000-000000000001
--   open report:      00000000-0000-004c-c000-0000000000a1
--   dismissed report: 00000000-0000-004c-c000-0000000000a2

begin;

insert into auth.users (id, email)
values ('00000000-0000-004c-c000-000000000001', 'digest-smoke@example.test');

insert into user_profiles (id, display_name)
values ('00000000-0000-004c-c000-000000000001', 'Digest Smoke')
on conflict (id) do nothing;

insert into content_reports (id, reporter_id, target_type, target_id, reason, status)
values
  ('00000000-0000-004c-c000-0000000000a1', '00000000-0000-004c-c000-000000000001',
   'review', 'digest-smoke-open', 'spam', 'open'),
  ('00000000-0000-004c-c000-0000000000a2', '00000000-0000-004c-c000-000000000001',
   'review', 'digest-smoke-dismissed', 'spam', 'dismissed');

do $$
declare
  claimed uuid[];
begin
  select coalesce(array_agg(id), '{}') into claimed
  from public.claim_content_reports_for_alert(200)
  where id in (
    '00000000-0000-004c-c000-0000000000a1', '00000000-0000-004c-c000-0000000000a2'
  );
  if claimed <> array['00000000-0000-004c-c000-0000000000a1']::uuid[] then
    raise exception 'only the open report should be claimed, got %', claimed;
  end if;

  if (select alerted_at from content_reports
      where id = '00000000-0000-004c-c000-0000000000a1') is null then
    raise exception 'a claimed report should have alerted_at set';
  end if;
  if (select alerted_at from content_reports
      where id = '00000000-0000-004c-c000-0000000000a2') is not null then
    raise exception 'a dismissed report should stay unclaimed';
  end if;

  if exists (
    select 1 from public.claim_content_reports_for_alert(200)
    where id = '00000000-0000-004c-c000-0000000000a1'
  ) then
    raise exception 'a report already claimed should not be claimed again';
  end if;

  if public.release_content_report_alerts(
       array['00000000-0000-004c-c000-0000000000a1']::uuid[]) <> 1 then
    raise exception 'release should put one report back';
  end if;
  if not exists (
    select 1 from public.claim_content_reports_for_alert(200)
    where id = '00000000-0000-004c-c000-0000000000a1'
  ) then
    raise exception 'a released report should be claimable again';
  end if;

  if public.release_content_report_alerts(null) <> 0 then
    raise exception 'releasing nothing should release nothing';
  end if;

  if not exists (select 1 from cron.job where jobname = 'report-digest') then
    raise exception 'the report-digest job should be scheduled';
  end if;
end $$;

rollback;
