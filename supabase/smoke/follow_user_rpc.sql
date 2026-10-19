-- Smoke checks for 20261019060000_follow_user_rpc_and_counts.sql.
-- Follows a public and a private user through follow_user, then checks
-- counts, lists and privacy. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   viewer:  00000000-0000-0043-b000-000000000001
--   public:  00000000-0000-0043-b000-000000000002
--   private: 00000000-0000-0043-b000-000000000003
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0043-b000-000000000001', 'Follow Smoke Viewer'),
  ('00000000-0000-0043-b000-000000000002', 'Follow Smoke Public'),
  ('00000000-0000-0043-b000-000000000003', 'Follow Smoke Private')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-0043-b000-000000000003', 'private')
on conflict (user_id) do update set account_visibility = excluded.account_visibility;

select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0043-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_status text;
  v_followers integer;
  v_following integer;
  v_rows integer;
begin
  -- A direct approved insert is still refused by RLS.
  begin
    insert into follows (follower_id, followee_id, status)
    values (
      '00000000-0000-0043-b000-000000000001',
      '00000000-0000-0043-b000-000000000002',
      'approved'
    );
    raise exception 'Direct approved follow insert should be refused by RLS';
  exception
    when insufficient_privilege then null;
  end;

  v_status := public.follow_user('00000000-0000-0043-b000-000000000002');
  if v_status <> 'approved' then
    raise exception 'Following a public user should be approved, got %', v_status;
  end if;

  -- Following again is a no-op.
  v_status := public.follow_user('00000000-0000-0043-b000-000000000002');
  if v_status <> 'approved' then
    raise exception 'Re-following a public user should stay approved, got %', v_status;
  end if;

  v_status := public.follow_user('00000000-0000-0043-b000-000000000003');
  if v_status <> 'pending' then
    raise exception 'Following a private user should be pending, got %', v_status;
  end if;

  begin
    perform public.follow_user('00000000-0000-0043-b000-000000000001');
    raise exception 'Self-follow should be refused';
  exception
    when invalid_parameter_value then null;
  end;

  select followers_count, following_count
  into v_followers, v_following
  from public.get_follow_counts('00000000-0000-0043-b000-000000000002');
  if v_followers <> 1 or v_following <> 0 then
    raise exception 'Public user counts should be 1/0, got %/%', v_followers, v_following;
  end if;

  -- Pending follows are not counted.
  select followers_count, following_count
  into v_followers, v_following
  from public.get_follow_counts('00000000-0000-0043-b000-000000000001');
  if v_followers <> 0 or v_following <> 1 then
    raise exception 'Viewer counts should be 0/1, got %/%', v_followers, v_following;
  end if;

  select count(*) into v_rows
  from public.list_user_followers('00000000-0000-0043-b000-000000000002')
  where user_id = '00000000-0000-0043-b000-000000000001';
  if v_rows <> 1 then
    raise exception 'Public user followers should list the viewer';
  end if;

  select count(*) into v_rows
  from public.list_user_following('00000000-0000-0043-b000-000000000001');
  if v_rows <> 1 then
    raise exception 'Viewer following should list exactly the approved follow, got %', v_rows;
  end if;

  -- Private user's lists stay hidden until the follow is approved.
  select count(*) into v_rows
  from public.list_user_followers('00000000-0000-0043-b000-000000000003');
  if v_rows <> 0 then
    raise exception 'Private user followers should be hidden from a pending follower';
  end if;
end $$;

-- Blocking hides counts and refuses new follows.
reset role;
insert into user_blocks (blocker_id, blocked_user_key, reason)
values (
  '00000000-0000-0043-b000-000000000002',
  '00000000-0000-0043-b000-000000000001',
  'smoke'
);
delete from follows
where follower_id = '00000000-0000-0043-b000-000000000001'
  and followee_id = '00000000-0000-0043-b000-000000000002';
set local role authenticated;

do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from public.get_follow_counts('00000000-0000-0043-b000-000000000002');
  if v_rows <> 0 then
    raise exception 'Blocked pair should not see follow counts';
  end if;

  begin
    perform public.follow_user('00000000-0000-0043-b000-000000000002');
    raise exception 'Following a user who blocked the viewer should be refused';
  exception
    when insufficient_privilege then null;
  end;
end $$;

rollback;
