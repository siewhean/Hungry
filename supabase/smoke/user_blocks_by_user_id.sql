-- Smoke checks for 20261019041100_user_blocks_by_user_id.sql.
-- Blocks a user by id, then confirms the viewer's post, feed-visibility,
-- comment and review reads exclude them. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   viewer:  00000000-0000-0042-b000-000000000001
--   blocked: 00000000-0000-0042-b000-000000000002
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0042-b000-000000000001', 'Block Smoke Viewer'),
  ('00000000-0000-0042-b000-000000000002', 'Block Smoke Author')
on conflict (id) do nothing;

insert into posts (id, author_id, status, visibility, caption, published_at)
values (
  '00000000-0000-0042-c000-000000000001',
  '00000000-0000-0042-b000-000000000002',
  'published',
  'public',
  'Block smoke post',
  now()
);

insert into post_comments (id, post_id, user_id, body)
values (
  '00000000-0000-0042-d000-000000000001',
  '00000000-0000-0042-c000-000000000001',
  '00000000-0000-0042-b000-000000000002',
  'Block smoke comment'
);

insert into reviews (id, user_id, dish_id, author_name, rating, text)
select
  '00000000-0000-0042-e000-000000000001',
  '00000000-0000-0042-b000-000000000002',
  d.id,
  'Block Smoke Author',
  4,
  'Block smoke review'
from dishes d
order by d.id
limit 1;

-- Name-keyed blocks are rejected: they can never match a server check.
do $$
begin
  begin
    insert into user_blocks (blocker_id, blocked_user_key)
    values ('00000000-0000-0042-b000-000000000001', 'block-smoke-author');
    raise exception 'Name-keyed block should be rejected by user_blocks_blocked_user_key_is_user_id';
  exception
    when check_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0042-b000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0042-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if not public.can_read_post('00000000-0000-0042-c000-000000000001') then
    raise exception 'Viewer should read the post before blocking';
  end if;
end $$;

-- Block the author the way the app does: by auth user id (uppercase is normalised).
insert into user_blocks (blocker_id, blocked_user_key, reason)
values (
  '00000000-0000-0042-b000-000000000001',
  upper('00000000-0000-0042-b000-000000000002'),
  'smoke'
);

do $$
declare
  v_comment_count integer;
  v_review_count integer;
  v_feed_count integer;
begin
  if not public.app_user_block_exists(
    '00000000-0000-0042-b000-000000000001',
    '00000000-0000-0042-b000-000000000002'
  ) then
    raise exception 'app_user_block_exists should see the id-keyed block';
  end if;

  if public.can_read_author_content('00000000-0000-0042-b000-000000000002') then
    raise exception 'Blocked author content should not be readable';
  end if;

  -- The Home feed RPC filters rows with can_read_post.
  if public.can_read_post('00000000-0000-0042-c000-000000000001') then
    raise exception 'Blocked author post should not be readable';
  end if;

  select count(*)
  into v_feed_count
  from public.get_home_social_feed_v2(100, null, null) feed
  where feed.author_id = '00000000-0000-0042-b000-000000000002';
  if v_feed_count > 0 then
    raise exception 'Home feed RPC returned a blocked author post';
  end if;

  select count(*)
  into v_comment_count
  from post_comments
  where id = '00000000-0000-0042-d000-000000000001';
  if v_comment_count > 0 then
    raise exception 'Blocked author comment should be hidden';
  end if;

  select count(*)
  into v_review_count
  from reviews
  where id = '00000000-0000-0042-e000-000000000001';
  if v_review_count > 0 then
    raise exception 'Blocked author review should be hidden';
  end if;
end $$;

-- Unblock: the review comes back; reporting it hides it again for the reporter.
delete from user_blocks
where blocker_id = '00000000-0000-0042-b000-000000000001'
  and blocked_user_key = '00000000-0000-0042-b000-000000000002';

do $$
begin
  if exists (select 1 from dishes)
    and not exists (select 1 from reviews where id = '00000000-0000-0042-e000-000000000001') then
    raise exception 'Review should be visible again after unblocking';
  end if;

  if exists (select 1 from dishes) then
    perform public.report_content(
      'review',
      '00000000-0000-0042-e000-000000000001',
      'smoke',
      '00000000-0000-0042-b000-000000000002'
    );
    if exists (select 1 from reviews where id = '00000000-0000-0042-e000-000000000001') then
      raise exception 'Reported review should be hidden from the reporter';
    end if;
  end if;
end $$;

select 'user_blocks_by_user_id_smoke_passed' as result;

rollback;
