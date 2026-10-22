-- Smoke checks for 20261022120000_api_request_rate_limits.sql.
-- PostgREST sets request.method / request.path / request.headers / request.jwt.claims before it
-- calls the pre-request function; this fakes those and calls app_private.check_request_rate()
-- directly. Runs in a transaction and rolls back.

begin;

create function pg_temp.hit(
  p_method text, p_path text, p_claims jsonb, p_ip text default null
) returns text language plpgsql as $$
begin
  perform set_config('request.method', p_method, true);
  perform set_config('request.path', p_path, true);
  perform set_config('request.jwt.claims', coalesce(p_claims::text, ''), true);
  perform set_config('request.headers',
    case when p_ip is null then '{}' else json_build_object('cf-connecting-ip', p_ip)::text end, true);
  perform app_private.check_request_rate();
  return 'ok';
exception when sqlstate 'PGRST' then
  return 'limited:' || (sqlerrm::jsonb ->> 'code');
end;
$$;

do $$
declare
  v_res text;
  v_i integer;
  v_anon jsonb := '{"role":"anon"}';
  v_user jsonb := '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
  v_other jsonb := '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}';
begin
  -- Wiring: PostgREST runs the function for the request roles, and the setting is on.
  if not has_function_privilege('anon', 'app_private.check_request_rate()', 'execute')
    or not has_function_privilege('authenticated', 'app_private.check_request_rate()', 'execute') then
    raise exception 'anon and authenticated must be able to run the pre-request function';
  end if;
  if not exists (
    select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
    where r.rolname = 'authenticator'
      and s.setconfig @> array['pgrst.db_pre_request=app_private.check_request_rate']
  ) then
    raise exception 'authenticator must have pgrst.db_pre_request set';
  end if;
  if has_function_privilege('anon', 'public.app_can_make_ip_request(text,text,integer)', 'execute')
    or has_function_privilege('authenticated', 'public.app_can_make_ip_request(text,text,integer)', 'execute') then
    raise exception 'app_can_make_ip_request is for service_role only';
  end if;
  if has_table_privilege('anon', 'app_private.request_rate_counters', 'select')
    or has_table_privilege('authenticated', 'app_private.request_rate_rules', 'select') then
    raise exception 'rate-limit tables must not be readable through the API';
  end if;

  -- Anon: catalog_suggest allows 150/min per IP; the 151st is refused with 429 and a JSON error.
  for v_i in 1..150 loop
    v_res := pg_temp.hit('POST', '/rpc/catalog_suggest', v_anon, '203.0.113.7');
    if v_res <> 'ok' then raise exception 'call % of 150 must pass, got %', v_i, v_res; end if;
  end loop;
  v_res := pg_temp.hit('POST', '/rpc/catalog_suggest', v_anon, '203.0.113.7');
  if v_res <> 'limited:rate_limited' then raise exception 'call 151 must be limited, got %', v_res; end if;

  -- A different IP, and a different route from the same IP, have their own counters.
  if pg_temp.hit('POST', '/rpc/catalog_suggest', v_anon, '203.0.113.8') <> 'ok' then
    raise exception 'another IP must not share the counter';
  end if;
  if pg_temp.hit('POST', '/rpc/catalog_raw_dish_detail', v_anon, '203.0.113.7') <> 'ok' then
    raise exception 'another route must not share the counter';
  end if;

  -- Signed-in users count by user id, not IP.
  for v_i in 1..3 loop
    if pg_temp.hit('POST', '/rpc/export_my_data', v_user, '203.0.113.9') <> 'ok' then
      raise exception 'export_my_data call % must pass', v_i;
    end if;
  end loop;
  if pg_temp.hit('POST', '/rpc/export_my_data', v_user, '203.0.113.10') <> 'limited:rate_limited' then
    raise exception 'the 4th export_my_data in a minute must be limited whatever the IP';
  end if;
  if pg_temp.hit('POST', '/rpc/export_my_data', v_other, '203.0.113.9') <> 'ok' then
    raise exception 'another user must not share the counter';
  end if;

  -- Table writes count by table; PATCH and DELETE share the table counter with POST.
  for v_i in 1..20 loop
    v_res := pg_temp.hit(case when v_i % 2 = 0 then 'PATCH' else 'POST' end, '/reviews', v_user);
    if v_res <> 'ok' then raise exception 'reviews write % must pass, got %', v_i, v_res; end if;
  end loop;
  if pg_temp.hit('DELETE', '/reviews', v_user) <> 'limited:rate_limited' then
    raise exception 'the 21st reviews write must be limited';
  end if;

  -- A route with no rule shares one combined default counter (signed-in default 300/min), so a
  -- caller cannot dodge it by inventing paths.
  for v_i in 1..300 loop
    v_res := pg_temp.hit('POST', '/rpc/made_up_' || v_i, v_other);
    if v_res <> 'ok' then raise exception 'default call % must pass, got %', v_i, v_res; end if;
  end loop;
  if pg_temp.hit('POST', '/rpc/yet_another_one', v_other) <> 'limited:rate_limited' then
    raise exception 'the 301st unruled call must be limited';
  end if;
  if (select count(*) from app_private.request_rate_counters where key like 'u:2222%|%made_up%') <> 0 then
    raise exception 'unruled routes must not get their own counter rows';
  end if;

  -- Reads that cannot be counted: GET on a table passes; GET on an RPC is refused.
  if pg_temp.hit('GET', '/venues', v_anon, '203.0.113.7') <> 'ok' then
    raise exception 'GET on a table must pass';
  end if;
  if pg_temp.hit('GET', '/rpc/catalog_suggest', v_anon, '203.0.113.99') <> 'limited:method_not_allowed' then
    raise exception 'GET on an RPC must be refused';
  end if;

  -- Exempt: service_role, preflight, requests with no path (older PostgREST), anon with no IP.
  for v_i in 1..400 loop
    if pg_temp.hit('POST', '/rpc/catalog_suggest', '{"role":"service_role"}') <> 'ok' then
      raise exception 'service_role must never be limited';
    end if;
  end loop;
  if pg_temp.hit('OPTIONS', '/rpc/catalog_suggest', v_anon, '203.0.113.7') <> 'ok' then
    raise exception 'OPTIONS must pass';
  end if;
  if pg_temp.hit('POST', '', v_anon, '203.0.113.7') <> 'ok' then
    raise exception 'a request without a path must pass';
  end if;
  for v_i in 1..200 loop
    if pg_temp.hit('POST', '/rpc/catalog_suggest', v_anon, null) <> 'ok' then
      raise exception 'anon without an IP cannot be counted and must pass';
    end if;
  end loop;

  -- Fail open: a broken counter table must not turn into a refused request.
  alter table app_private.request_rate_counters rename to request_rate_counters_off;
  if pg_temp.hit('POST', '/rpc/export_my_data', v_user) <> 'ok' then
    raise exception 'a counter error must fail open';
  end if;
  alter table app_private.request_rate_counters_off rename to request_rate_counters;

  -- Edge Function helper: the (p_limit+1)th call from one IP in a minute is refused.
  for v_i in 1..5 loop
    if not public.app_can_make_ip_request('198.51.100.1', 'smoke', 5) then
      raise exception 'edge call % must pass', v_i;
    end if;
  end loop;
  if public.app_can_make_ip_request('198.51.100.1', 'smoke', 5) then
    raise exception 'the 6th edge call must be refused';
  end if;
  if not public.app_can_make_ip_request('', 'smoke', 5) or not public.app_can_make_ip_request(null, 'smoke', 5) then
    raise exception 'an unknown IP must not be locked out';
  end if;
end;
$$;

rollback;

select 'api_request_rate_limits' as check_name, 'ok' as detail;
