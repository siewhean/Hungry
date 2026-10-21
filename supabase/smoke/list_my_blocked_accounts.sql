-- Smoke checks for 20261022100300_list_my_blocked_accounts.sql.
-- The blocker sees the name of each person they blocked (although the block
-- hides that profile elsewhere), nobody else sees that list, and unblocking is
-- a delete of the blocker's own row. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   blocker: 00000000-0000-0203-b000-000000000001
--   blocked: 00000000-0000-0203-b000-000000000002
--   other:   00000000-0000-0203-b000-000000000003
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0203-b000-000000000001', 'Blocker Smoke'),
  ('00000000-0000-0203-b000-000000000002', 'Blocked Smoke'),
  ('00000000-0000-0203-b000-000000000003', 'Other Smoke')
on conflict (id) do nothing;

insert into user_blocks (blocker_id, blocked_user_key, reason)
values (
  '00000000-0000-0203-b000-000000000001',
  '00000000-0000-0203-b000-000000000002',
  'smoke'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0203-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_name text;
begin
  select b.display_name into v_name
  from public.list_my_blocked_accounts() b
  where b.blocked_user_id = '00000000-0000-0203-b000-000000000002';
  if v_name is distinct from 'Blocked Smoke' then
    raise exception 'The blocker should see the blocked account''s name, got %', v_name;
  end if;
end $$;

-- Somebody else's list is empty.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0203-b000-000000000003', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.list_my_blocked_accounts()) then
    raise exception 'A user must only list their own blocks';
  end if;
  -- RLS keeps another user from deleting the block.
  delete from public.user_blocks
  where blocker_id = '00000000-0000-0203-b000-000000000001';
end $$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.user_blocks
    where blocker_id = '00000000-0000-0203-b000-000000000001'
  ) then
    raise exception 'Another user must not be able to delete the block';
  end if;
  if has_function_privilege('anon', 'public.list_my_blocked_accounts()', 'execute') then
    raise exception 'anon must not execute list_my_blocked_accounts';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.list_my_blocked_accounts()'::regprocedure) then
    raise exception 'the public wrapper must be security invoker';
  end if;
end $$;

-- The blocker unblocks by deleting their own row.
select set_config('request.jwt.claim.sub', '00000000-0000-0203-b000-000000000001', true);
set local role authenticated;

delete from public.user_blocks
where blocker_id = '00000000-0000-0203-b000-000000000001'
  and blocked_user_key = '00000000-0000-0203-b000-000000000002';

do $$
begin
  if exists (select 1 from public.list_my_blocked_accounts()) then
    raise exception 'The list should be empty after unblocking';
  end if;
end $$;

reset role;

select 'list_my_blocked_accounts' as check_name, 'ok' as detail;

rollback;
