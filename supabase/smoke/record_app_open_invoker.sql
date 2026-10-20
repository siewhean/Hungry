-- Smoke: public.record_app_open() is an invoker wrapper and still records a
-- day for the signed-in user. Rolled back.
begin;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_app_open' and p.prosecdef
  ) then
    raise exception 'public.record_app_open must be security invoker';
  end if;
end $$;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000a0a1', 'record-app-open-smoke@example.com');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a0a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v jsonb := public.record_app_open();
begin
  if v->>'state' <> 'new' then
    raise exception 'expected new, got %', v;
  end if;
end $$;

reset role;

do $$
begin
  if (select count(*) from public.user_activity_days
      where user_id = '00000000-0000-0000-0000-00000000a0a1') <> 1 then
    raise exception 'expected one activity day';
  end if;
end $$;

select 'smoke ok';
rollback;
