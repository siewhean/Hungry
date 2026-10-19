-- Smoke checks for 20261019074000_follow_requests.sql.
-- A viewer requests to follow a private user; the private user lists,
-- approves and declines requests; the requester cancels one. Checks the
-- follow_request / new_follower activity items, counts and block handling.
-- Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   requester: 00000000-0000-0043-c000-000000000001
--   private:   00000000-0000-0043-c000-000000000002
--   second:    00000000-0000-0043-c000-000000000003
--   public:    00000000-0000-0043-c000-000000000004
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0043-c000-000000000001', 'Request Smoke Requester'),
  ('00000000-0000-0043-c000-000000000002', 'Request Smoke Private'),
  ('00000000-0000-0043-c000-000000000003', 'Request Smoke Second'),
  ('00000000-0000-0043-c000-000000000004', 'Request Smoke Public')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-0043-c000-000000000002', 'private')
on conflict (user_id) do update set account_visibility = excluded.account_visibility;

set local role authenticated;

-- Requester follows the private user (pending) and the public user (approved).
select set_config('request.jwt.claim.sub', '00000000-0000-0043-c000-000000000001', true);
do $$
begin
  if public.follow_user('00000000-0000-0043-c000-000000000002') <> 'pending' then
    raise exception 'Following a private user should be pending';
  end if;
  if public.follow_user('00000000-0000-0043-c000-000000000004') <> 'approved' then
    raise exception 'Following a public user should be approved';
  end if;
  -- Re-requesting does not duplicate the request.
  perform public.follow_user('00000000-0000-0043-c000-000000000002');
end $$;

-- Second user also requests the private user.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-c000-000000000003', true);
select public.follow_user('00000000-0000-0043-c000-000000000002');

reset role;
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0043-c000-000000000002'
    and event_type = 'follow_request';
  if v_rows <> 2 then
    raise exception 'Pending follows should send one follow_request each, got %', v_rows;
  end if;

  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0043-c000-000000000002'
    and event_type = 'new_follower';
  if v_rows <> 0 then
    raise exception 'Pending follows must not send new_follower, got %', v_rows;
  end if;

  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0043-c000-000000000004'
    and event_type = 'new_follower';
  if v_rows <> 1 then
    raise exception 'Approved follow should send new_follower, got %', v_rows;
  end if;
end $$;
set local role authenticated;

-- The private user reviews requests.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-c000-000000000002', true);
do $$
declare
  v_rows integer;
  v_followers integer;
begin
  if public.count_incoming_follow_requests() <> 2 then
    raise exception 'Private user should have 2 pending requests';
  end if;

  select count(*) into v_rows from public.list_incoming_follow_requests(1, 0);
  if v_rows <> 1 then
    raise exception 'Request list should page (limit 1), got %', v_rows;
  end if;
  select count(*) into v_rows from public.list_incoming_follow_requests(50, 0);
  if v_rows <> 2 then
    raise exception 'Request list should show both requests, got %', v_rows;
  end if;

  if public.approve_follow_request('00000000-0000-0043-c000-000000000001') <> 'approved' then
    raise exception 'Approve should return approved';
  end if;

  select followers_count into v_followers
  from public.get_follow_counts('00000000-0000-0043-c000-000000000002');
  if v_followers <> 1 then
    raise exception 'Approved request should count as a follower, got %', v_followers;
  end if;

  perform public.decline_follow_request('00000000-0000-0043-c000-000000000003');

  if public.count_incoming_follow_requests() <> 0 then
    raise exception 'No requests should remain after approve + decline';
  end if;

  -- Answering a request that no longer exists is refused.
  begin
    perform public.approve_follow_request('00000000-0000-0043-c000-000000000003');
    raise exception 'Approving a declined request should be refused';
  exception
    when no_data_found then null;
  end;
  begin
    perform public.decline_follow_request('00000000-0000-0043-c000-000000000001');
    raise exception 'Declining an approved follow should be refused';
  exception
    when no_data_found then null;
  end;
end $$;

reset role;
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0043-c000-000000000002'
    and event_type = 'follow_request';
  if v_rows <> 0 then
    raise exception 'Resolved requests should clear their follow_request items, got %', v_rows;
  end if;

  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0043-c000-000000000002'
    and actor_id = '00000000-0000-0043-c000-000000000001'
    and event_type = 'new_follower';
  if v_rows <> 1 then
    raise exception 'Approving should send exactly one new_follower, got %', v_rows;
  end if;

  if exists (
    select 1 from follows
    where follower_id = '00000000-0000-0043-c000-000000000003'
      and followee_id = '00000000-0000-0043-c000-000000000002'
  ) then
    raise exception 'Declined request should be removed';
  end if;
end $$;
set local role authenticated;

-- The second user requests again, then cancels.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-c000-000000000003', true);
do $$
begin
  if public.follow_user('00000000-0000-0043-c000-000000000002') <> 'pending' then
    raise exception 'Re-requesting after a decline should be pending';
  end if;
  perform public.cancel_follow_request('00000000-0000-0043-c000-000000000002');
  -- Cancelling again is a no-op.
  perform public.cancel_follow_request('00000000-0000-0043-c000-000000000002');
  -- Cancel never removes an approved follow.
  perform public.cancel_follow_request('00000000-0000-0043-c000-000000000004');
end $$;

reset role;
do $$
begin
  if exists (
    select 1 from follows
    where follower_id = '00000000-0000-0043-c000-000000000003'
      and followee_id = '00000000-0000-0043-c000-000000000002'
  ) then
    raise exception 'Cancelled request should be removed';
  end if;
  if exists (
    select 1 from activity_events
    where recipient_id = '00000000-0000-0043-c000-000000000002'
      and event_type = 'follow_request'
  ) then
    raise exception 'Cancelled request should clear its follow_request item';
  end if;
end $$;

-- Blocked requesters are hidden and cannot be approved.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0043-c000-000000000003', true);
select public.follow_user('00000000-0000-0043-c000-000000000002');
reset role;
insert into user_blocks (blocker_id, blocked_user_key, reason)
values (
  '00000000-0000-0043-c000-000000000002',
  '00000000-0000-0043-c000-000000000003',
  'smoke'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0043-c000-000000000002', true);
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows from public.list_incoming_follow_requests();
  if v_rows <> 0 or public.count_incoming_follow_requests() <> 0 then
    raise exception 'Blocked requesters should be hidden from requests';
  end if;
  begin
    perform public.approve_follow_request('00000000-0000-0043-c000-000000000003');
    raise exception 'Approving a blocked requester should be refused';
  exception
    when insufficient_privilege then null;
  end;
  -- Declining still works so the row can be cleaned up.
  perform public.decline_follow_request('00000000-0000-0043-c000-000000000003');
end $$;

-- Signed out: refused.
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.approve_follow_request('00000000-0000-0043-c000-000000000001');
    raise exception 'Signed-out approve should be refused';
  exception
    when invalid_authorization_specification then null;
  end;
  if public.count_incoming_follow_requests() <> 0 then
    raise exception 'Signed-out count should be 0';
  end if;
end $$;

rollback;
