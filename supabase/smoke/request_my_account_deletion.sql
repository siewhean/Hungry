-- Smoke checks for 20261020050000_request_my_account_deletion.sql.
-- A signed-in user queues deletion through the RPC and gets the server's date; a
-- repeat call returns the same date; direct inserts and anon calls are refused.
-- Runs in a transaction and rolls back.

begin;

select set_config('request.jwt.claim.sub', '00000000-0000-0050-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_first timestamptz;
  v_second timestamptz;
begin
  v_first := public.request_my_account_deletion('smoke');
  if v_first < now() + interval '29 days' or v_first > now() + interval '31 days' then
    raise exception 'scheduled_for should be about 30 days out, got %', v_first;
  end if;

  v_second := public.request_my_account_deletion('smoke again');
  if v_second <> v_first then
    raise exception 'a repeat request should return the pending date';
  end if;

  if (select count(*) from public.account_deletion_requests
      where user_id = '00000000-0000-0050-a000-000000000001') <> 1 then
    raise exception 'exactly one pending request expected';
  end if;

  begin
    insert into public.account_deletion_requests (user_id, scheduled_for, status)
    values ('00000000-0000-0050-a000-000000000001', now(), 'requested');
    raise exception 'direct insert should be refused';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.request_my_account_deletion(text)', 'execute') then
    raise exception 'anon must not execute request_my_account_deletion';
  end if;
  if has_function_privilege('authenticated', 'public.request_my_account_deletion(text)', 'execute') is not true then
    raise exception 'authenticated must execute request_my_account_deletion';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.request_my_account_deletion(text)'::regprocedure) then
    raise exception 'public wrapper must be security invoker';
  end if;
  if has_table_privilege('authenticated', 'public.account_deletion_requests', 'insert') then
    raise exception 'authenticated must not insert account_deletion_requests directly';
  end if;
end;
$$;

select 'request_my_account_deletion' as check_name, 'ok' as detail;

rollback;
