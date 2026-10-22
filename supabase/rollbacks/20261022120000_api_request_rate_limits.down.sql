-- Down for 20261022120000_api_request_rate_limits.sql.
-- Switches the REST limiter off first (so no request can hit a missing function), then removes it.
-- down-loses-data: the counters are throwaway per-minute tallies and the rules table is re-seeded by the up migration.

alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
    and exists (select 1 from cron.job where jobname = 'prune-request-rate-counters') then
    perform cron.unschedule('prune-request-rate-counters');
  end if;
end;
$$;

drop function if exists public.app_can_make_ip_request(text, text, integer);
drop function if exists app_private.check_request_rate();
drop table if exists app_private.request_rate_counters;
drop table if exists app_private.request_rate_rules;
