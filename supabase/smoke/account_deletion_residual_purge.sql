-- Smoke checks for 20261018180000_account_deletion_residual_purge.sql.
-- The worker-only purge RPC refuses a request that is not anonymised yet, purges an
-- anonymised one and logs a residual_purge event, and clients cannot call it. Rolls back.

begin;

insert into user_profiles (id, display_name)
values ('00000000-0000-0047-b000-000000000001', 'Purge Smoke')
on conflict (id) do nothing;

insert into account_deletion_requests (id, user_id, status)
values ('00000000-0000-0047-a000-000000000001', '00000000-0000-0047-b000-000000000001', 'processing');

do $$
begin
  perform public.purge_account_deletion_residual_data('00000000-0000-0047-a000-000000000001', null);
  raise exception 'purge must refuse a request that is not anonymised';
exception
  when sqlstate '55000' then null;
end $$;

select public.anonymize_account_deletion_request('00000000-0000-0047-a000-000000000001', null);
select public.purge_account_deletion_residual_data('00000000-0000-0047-a000-000000000001', null);

do $$
begin
  if not exists (
    select 1 from account_deletion_processing_events
    where request_id = '00000000-0000-0047-a000-000000000001'
      and metadata ->> 'phase' = 'residual_purge'
  ) then
    raise exception 'purge did not log its residual_purge event';
  end if;
  if has_function_privilege('authenticated', 'public.purge_account_deletion_residual_data(uuid, uuid)', 'execute') then
    raise exception 'authenticated must not execute the purge RPC';
  end if;
  if has_function_privilege('anon', 'public.claim_account_deletion_requests(integer, uuid)', 'execute') then
    raise exception 'anon must not execute the claim RPC';
  end if;
end $$;

select 'account_deletion_residual_purge smoke passed' as result;

rollback;
