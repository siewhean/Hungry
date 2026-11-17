-- Rollback requires stopping the notification worker first. Preserve unknown/accepted
-- work as failed (never pending) to avoid duplicate pushes after downgrade.
begin;
update public.notification_jobs set status='failed',skip_reason='receipt_rollout_rollback'
where status in ('accepted','delivery_unknown');
drop function if exists public.settle_notification_receipts(jsonb);
drop function if exists public.claim_notification_receipts(integer);
drop function if exists public.record_notification_tickets(uuid,jsonb);
-- Retain receipt evidence; remove only the worker's scheduler dependency.
create or replace function public.invoke_notification_worker()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_token text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='notification_worker_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name='notification_worker_token';
  if v_url is null or v_token is null then return; end if;
  if not exists(select 1 from public.notification_jobs where status in ('pending','sending')) then return; end if;
  perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_token),body:=jsonb_build_object('limit',100));
end;
$$;
revoke all on function public.invoke_notification_worker() from public,anon,authenticated;
alter table public.notification_jobs drop constraint notification_jobs_status_check;
alter table public.notification_jobs add constraint notification_jobs_status_check check(status in ('pending','sending','sent','skipped','failed'));
commit;
