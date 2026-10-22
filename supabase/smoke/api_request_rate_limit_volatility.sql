-- Smoke checks for 20261022130000_rate_limit_rpcs_volatile.sql.
-- Every public RPC with a cap in app_private.request_rate_rules must be VOLATILE: PostgREST runs POST
-- on STABLE and IMMUTABLE functions in a READ ONLY transaction, where the limiter cannot write its
-- counter and fails open. Read-only, changes nothing.

do $$
declare
  v_bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join app_private.request_rate_rules r on r.route = 'rpc/' || p.proname
  where n.nspname = 'public' and p.provolatile <> 'v';
  if v_bad is not null then
    raise exception 'rate-limited RPCs must be VOLATILE, but these are not: %', v_bad;
  end if;

  -- The failure being guarded against: in a read-only transaction the counter cannot be written.
  begin
    perform set_config('transaction_read_only', 'on', true);
    insert into app_private.request_rate_counters (key, bucket, hits)
    values ('smoke|read-only', now(), 1);
    raise exception 'a read-only transaction must not be able to write the counter';
  exception when read_only_sql_transaction then
    null;
  end;
end;
$$;

select 'api_request_rate_limit_volatility' as check_name, 'ok' as detail;
