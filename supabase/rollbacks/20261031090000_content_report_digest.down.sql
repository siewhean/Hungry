-- Down for 20261031090000_content_report_digest.
-- Stops the 15 minute digest job and removes its functions and the alerted_at column. Reports
-- themselves are untouched; the column only records when a digest mentioned them. The times are
-- copied to rollback_archive first, so nothing is lost.
create schema if not exists rollback_archive;
drop table if exists rollback_archive.content_report_alerts_20261031090000;
create table rollback_archive.content_report_alerts_20261031090000 as
  select id, alerted_at from public.content_reports where alerted_at is not null;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'report-digest') then
    perform cron.unschedule('report-digest');
  end if;
end;
$$;

drop function if exists public.invoke_report_digest();
drop function if exists public.release_content_report_alerts(uuid[]);
drop function if exists public.claim_content_reports_for_alert(integer);
drop index if exists public.idx_content_reports_unalerted;
alter table public.content_reports drop column if exists alerted_at;
