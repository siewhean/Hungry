-- Schedule the process-account-deletions Edge Function.
-- The function URL and worker token live in Vault, never in this file:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/process-account-deletions', 'account_deletion_worker_url');
--   select vault.create_secret('<ACCOUNT_DELETION_WORKER_TOKEN>', 'account_deletion_worker_token');
-- Until both secrets exist the job is a no-op.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_account_deletion_worker()
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
  where name = 'account_deletion_worker_url';

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'account_deletion_worker_token';

  if v_url is null or v_token is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object('limit', 25)
  );
end;
$$;

revoke all on function public.invoke_account_deletion_worker() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-account-deletions') then
    perform cron.unschedule('process-account-deletions');
  end if;
  perform cron.schedule(
    'process-account-deletions',
    '*/15 * * * *',
    'select public.invoke_account_deletion_worker()'
  );
end;
$$;
