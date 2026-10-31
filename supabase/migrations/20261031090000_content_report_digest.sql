-- smoke: supabase/smoke/content_report_digest.sql
-- App Store review 1.2 (timely response to reports): a person gets told when something is reported.
--
-- Until now a report sat in content_reports until someone opened the moderation queue. This adds
-- an email digest, sent by the report-digest Edge Function every 15 minutes.
--
-- 1. content_reports.alerted_at: when the report was included in a digest (null = not yet).
-- 2. claim_content_reports_for_alert(limit): marks up to `limit` open, unalerted reports as alerted
--    and returns them, in one statement (UPDATE .. WHERE id IN (.. FOR UPDATE SKIP LOCKED)), so two
--    overlapping runs never send the same report twice.
-- 3. release_content_report_alerts(ids): puts reports back to unalerted when the email failed, so
--    the next run sends them.
-- 4. invoke_report_digest() + a 15 minute pg_cron job. The function URL and token live in Vault,
--    never in this file:
--      select vault.create_secret('https://<ref>.supabase.co/functions/v1/report-digest', 'report_digest_url');
--      select vault.create_secret('<REPORT_DIGEST_TOKEN>', 'report_digest_token');
--    Until both secrets exist the job does nothing.
-- Reports already in the table are unalerted, so the first run sends the backlog (50 at a time).
-- Rollback: supabase/rollbacks/20261031090000_content_report_digest.down.sql.

alter table public.content_reports
  add column if not exists alerted_at timestamptz;

create index if not exists idx_content_reports_unalerted
  on public.content_reports (created_at)
  where alerted_at is null and status = 'open';

create or replace function public.claim_content_reports_for_alert(p_limit integer default 50)
returns table (
  id uuid,
  target_type text,
  target_id text,
  reason text,
  created_at timestamptz
)
language sql
volatile
security invoker
set search_path = public
as $$
  with picked as (
    select cr.id
    from public.content_reports cr
    where cr.alerted_at is null
      and cr.status = 'open'
    order by cr.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  )
  update public.content_reports cr
  set alerted_at = now()
  from picked
  where cr.id = picked.id
  returning cr.id, cr.target_type, cr.target_id, cr.reason, cr.created_at;
$$;

revoke all on function public.claim_content_reports_for_alert(integer)
  from public, anon, authenticated;
grant execute on function public.claim_content_reports_for_alert(integer) to service_role;

create or replace function public.release_content_report_alerts(p_ids uuid[])
returns integer
language sql
volatile
security invoker
set search_path = public
as $$
  with released as (
    update public.content_reports cr
    set alerted_at = null
    where cr.id = any(coalesce(p_ids, '{}'::uuid[]))
    returning cr.id
  )
  select count(*)::integer from released;
$$;

revoke all on function public.release_content_report_alerts(uuid[])
  from public, anon, authenticated;
grant execute on function public.release_content_report_alerts(uuid[]) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_report_digest()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'report_digest_url';

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'report_digest_token';

  if v_url is null or v_token is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object('limit', 50)
  );
end;
$$;

revoke all on function public.invoke_report_digest() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'report-digest') then
    perform cron.unschedule('report-digest');
  end if;
  perform cron.schedule(
    'report-digest',
    '*/15 * * * *',
    'select public.invoke_report_digest()'
  );
end;
$$;
