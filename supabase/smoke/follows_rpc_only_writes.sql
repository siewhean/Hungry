-- Smoke checks for 20261019083000_follows_rpc_only_writes.sql.
-- Signed-in users can no longer insert or update follows rows directly
-- (so a followee cannot approve a blocked requester by UPDATE, and a blocked
-- user cannot send a request by INSERT). follow_user, approve_follow_request
-- and a direct unfollow DELETE still work.
-- Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   requester: 00000000-0000-0043-d000-000000000001
--   private:   00000000-0000-0043-d000-000000000002
--   blocked:   00000000-0000-0043-d000-000000000003
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0043-d000-000000000001', 'Rpc Writes Requester'),
  ('00000000-0000-0043-d000-000000000002', 'Rpc Writes Private'),
  ('00000000-0000-0043-d000-000000000003', 'Rpc Writes Blocked')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-0043-d000-000000000002', 'private')
on conflict (user_id) do update set account_visibility = excluded.account_visibility;

set local role authenticated;

-- Requester and the to-be-blocked user both request the private user via the RPC.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-d000-000000000001', true);
select public.follow_user('00000000-0000-0043-d000-000000000002');
select set_config('request.jwt.claim.sub', '00000000-0000-0043-d000-000000000003', true);
select public.follow_user('00000000-0000-0043-d000-000000000002');

reset role;
insert into user_blocks (blocker_id, blocked_user_key)
values ('00000000-0000-0043-d000-000000000002', '00000000-0000-0043-d000-000000000003');
set local role authenticated;

-- The private user cannot approve the blocked requester with a direct UPDATE.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-d000-000000000002', true);
do $$
declare
  v_rows integer;
begin
  update follows
  set status = 'approved', approved_at = now()
  where follower_id = '00000000-0000-0043-d000-000000000003'
    and followee_id = '00000000-0000-0043-d000-000000000002';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Direct UPDATE of follows should affect no rows, got %', v_rows;
  end if;
end $$;

-- The blocked user cannot send a request with a direct INSERT.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-d000-000000000003', true);
do $$
begin
  delete from follows
  where follower_id = '00000000-0000-0043-d000-000000000003'
    and followee_id = '00000000-0000-0043-d000-000000000002';
  begin
    insert into follows (follower_id, followee_id, status)
    values (
      '00000000-0000-0043-d000-000000000003',
      '00000000-0000-0043-d000-000000000002',
      'pending'
    );
    raise exception 'Direct INSERT into follows should be refused';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- The approve RPC still works for an unblocked requester.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-d000-000000000002', true);
do $$
begin
  if public.approve_follow_request('00000000-0000-0043-d000-000000000001') <> 'approved' then
    raise exception 'approve_follow_request should still approve';
  end if;
end $$;

-- Unfollow (direct DELETE by the follower) still works.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-d000-000000000001', true);
do $$
declare
  v_rows integer;
begin
  delete from follows
  where follower_id = '00000000-0000-0043-d000-000000000001'
    and followee_id = '00000000-0000-0043-d000-000000000002';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Unfollow DELETE should remove the follow, got %', v_rows;
  end if;
end $$;

reset role;
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from follows
  where followee_id = '00000000-0000-0043-d000-000000000002';
  if v_rows <> 0 then
    raise exception 'Expected no follows left for the private user, got %', v_rows;
  end if;

  if exists (
    select 1 from pg_policies
    where tablename = 'follows'
      and policyname in ('follows_insert_requester', 'follows_update_participant')
  ) then
    raise exception 'Direct follows INSERT/UPDATE policies should be dropped';
  end if;
end $$;

rollback;
