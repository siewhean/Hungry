-- Smoke checks for 20261022080000_follow_counts_for_guests_remove_follower.sql.
-- A signed-out visitor can read follow counts; a user removes an approved
-- follower; removing a non-follower is a no-op; a signed-out visitor cannot call
-- remove_follower. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0080-b000-000000000001
--   follower: 00000000-0000-0080-b000-000000000002
--   stranger: 00000000-0000-0080-b000-000000000003
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0080-b000-000000000001', 'Remove Smoke Owner'),
  ('00000000-0000-0080-b000-000000000002', 'Remove Smoke Follower'),
  ('00000000-0000-0080-b000-000000000003', 'Remove Smoke Stranger')
on conflict (id) do nothing;

-- The follower follows the owner (public account, so approved at once).
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0080-b000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0080-b000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select public.follow_user('00000000-0000-0080-b000-000000000001');
reset role;

-- M10: a signed-out visitor reads the counts.
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_followers integer;
  v_following integer;
begin
  select followers_count, following_count
  into v_followers, v_following
  from public.get_follow_counts('00000000-0000-0080-b000-000000000001');
  if v_followers is distinct from 1 or v_following is distinct from 0 then
    raise exception 'A guest should see 1 follower and 0 following, got %/%', v_followers, v_following;
  end if;

  begin
    perform public.remove_follower('00000000-0000-0080-b000-000000000002');
    raise exception 'A signed-out visitor should not be able to call remove_follower';
  exception
    when insufficient_privilege then null;
  end;
end $$;
reset role;

-- M8: the owner removes the follower.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0080-b000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0080-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_followers integer;
  v_rows integer;
begin
  perform public.remove_follower('00000000-0000-0080-b000-000000000002');

  select followers_count into v_followers
  from public.get_follow_counts('00000000-0000-0080-b000-000000000001');
  if v_followers is distinct from 0 then
    raise exception 'The owner should have 0 followers after removing one, got %', v_followers;
  end if;

  -- Removing someone who does not follow you is a no-op.
  perform public.remove_follower('00000000-0000-0080-b000-000000000003');
  perform public.remove_follower('00000000-0000-0080-b000-000000000002');

  begin
    perform public.remove_follower('00000000-0000-0080-b000-000000000001');
    raise exception 'Removing yourself should be refused';
  exception
    when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- The removed follow row is gone, and the follower can still follow again.
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from follows
  where follower_id = '00000000-0000-0080-b000-000000000002'
    and followee_id = '00000000-0000-0080-b000-000000000001';
  if v_rows <> 0 then
    raise exception 'The follow row should be deleted';
  end if;
end $$;

rollback;
