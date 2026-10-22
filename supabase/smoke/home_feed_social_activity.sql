-- Smoke checks for 20261022030000_social_activity_dedupe_and_block_cleanup.sql.
-- Like, unlike and like again leaves one inbox item; follow, unfollow and follow
-- again the same; an unlike after the author read the item keeps it. mark_all_
-- activity_read clears the unread items. block_user removes follows in both
-- directions, hides the blocked person's old activity from the inbox, and the
-- blocked / hidden lists and unblock work. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   author: 00000000-0000-0046-b000-000000000001
--   liker:  00000000-0000-0046-b000-000000000002
--   post:   00000000-0000-0046-c000-000000000001 (author)
--   post 2: 00000000-0000-0046-c000-000000000002 (liker)
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0046-b000-000000000001', 'Activity Smoke Author'),
  ('00000000-0000-0046-b000-000000000002', 'Activity Smoke Liker')
on conflict (id) do nothing;

insert into posts (id, author_id, status, visibility, caption, published_at)
values
  ('00000000-0000-0046-c000-000000000001', '00000000-0000-0046-b000-000000000001',
   'published', 'public', 'Activity smoke post', now()),
  ('00000000-0000-0046-c000-000000000002', '00000000-0000-0046-b000-000000000002',
   'published', 'public', 'Activity smoke post two', now());

-- Like, unlike, like again: one inbox item.
insert into post_likes (post_id, user_id)
values ('00000000-0000-0046-c000-000000000001', '00000000-0000-0046-b000-000000000002');
delete from post_likes
where post_id = '00000000-0000-0046-c000-000000000001'
  and user_id = '00000000-0000-0046-b000-000000000002';
do $$
begin
  if exists (
    select 1 from activity_events
    where recipient_id = '00000000-0000-0046-b000-000000000001'
      and event_type = 'new_like'
  ) then
    raise exception 'Unlike should remove the unread like item';
  end if;
end $$;
insert into post_likes (post_id, user_id)
values ('00000000-0000-0046-c000-000000000001', '00000000-0000-0046-b000-000000000002');
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0046-b000-000000000001'
    and event_type = 'new_like';
  if v_rows <> 1 then
    raise exception 'Like, unlike, like should leave one item, got %', v_rows;
  end if;

  -- The unique index refuses a second copy even if a trigger path ran twice.
  insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
  values (
    '00000000-0000-0046-b000-000000000001',
    '00000000-0000-0046-b000-000000000002',
    'new_like', 'post', '00000000-0000-0046-c000-000000000001'
  )
  on conflict do nothing;
  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0046-b000-000000000001'
    and event_type = 'new_like';
  if v_rows <> 1 then
    raise exception 'A duplicate like item should be ignored, got %', v_rows;
  end if;
end $$;

-- Follow, unfollow, follow again: one item.
insert into follows (follower_id, followee_id, status)
values ('00000000-0000-0046-b000-000000000002', '00000000-0000-0046-b000-000000000001', 'approved');
delete from follows
where follower_id = '00000000-0000-0046-b000-000000000002'
  and followee_id = '00000000-0000-0046-b000-000000000001';
insert into follows (follower_id, followee_id, status)
values ('00000000-0000-0046-b000-000000000002', '00000000-0000-0046-b000-000000000001', 'approved');
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from activity_events
  where recipient_id = '00000000-0000-0046-b000-000000000001'
    and event_type = 'new_follower';
  if v_rows <> 1 then
    raise exception 'Follow, unfollow, follow should leave one item, got %', v_rows;
  end if;
end $$;

-- An item the author already read stays after the unlike.
update activity_events
set read_at = now()
where recipient_id = '00000000-0000-0046-b000-000000000001'
  and event_type = 'new_like';
delete from post_likes
where post_id = '00000000-0000-0046-c000-000000000001'
  and user_id = '00000000-0000-0046-b000-000000000002';
do $$
begin
  if not exists (
    select 1 from activity_events
    where recipient_id = '00000000-0000-0046-b000-000000000001'
      and event_type = 'new_like'
  ) then
    raise exception 'A read like item should survive the unlike';
  end if;
end $$;

-- The author marks everything read in one call.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000001', true);
do $$
declare
  v_marked integer;
begin
  v_marked := public.mark_all_activity_read();
  if v_marked <> 1 then
    raise exception 'mark_all_activity_read should mark the one unread item, got %', v_marked;
  end if;
  if exists (
    select 1 from activity_events
    where recipient_id = '00000000-0000-0046-b000-000000000001'
      and read_at is null
  ) then
    raise exception 'No item should stay unread after mark_all_activity_read';
  end if;
end $$;

-- The author hides the liker's post, then blocks the liker. The liker follows
-- the author and the author follows the liker, so both follows must go.
reset role;
insert into follows (follower_id, followee_id, status)
values ('00000000-0000-0046-b000-000000000001', '00000000-0000-0046-b000-000000000002', 'approved')
on conflict do nothing;
insert into hidden_posts (viewer_id, post_id, reason)
values ('00000000-0000-0046-b000-000000000001', '00000000-0000-0046-c000-000000000002', 'smoke');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000001', true);
do $$
declare
  v_rows integer;
begin
  perform public.block_user('00000000-0000-0046-b000-000000000002', 'smoke');
  -- Blocking again is a no-op.
  perform public.block_user('00000000-0000-0046-b000-000000000002', 'smoke');

  select count(*) into v_rows
  from follows
  where (follower_id = '00000000-0000-0046-b000-000000000001'
         and followee_id = '00000000-0000-0046-b000-000000000002')
     or (follower_id = '00000000-0000-0046-b000-000000000002'
         and followee_id = '00000000-0000-0046-b000-000000000001');
  if v_rows <> 0 then
    raise exception 'block_user should remove follows in both directions, got %', v_rows;
  end if;

  -- Old activity from the blocked person is hidden from the author's inbox.
  select count(*) into v_rows
  from activity_events
  where actor_id = '00000000-0000-0046-b000-000000000002';
  if v_rows <> 0 then
    raise exception 'A blocked actor''s activity should be hidden, got %', v_rows;
  end if;

  select count(*) into v_rows from public.list_my_blocked_users();
  if v_rows <> 1 then
    raise exception 'list_my_blocked_users should list the one block, got %', v_rows;
  end if;
  if (select display_name from public.list_my_blocked_users() limit 1) <> 'Activity Smoke Liker' then
    raise exception 'list_my_blocked_users should carry the display name';
  end if;

  select count(*) into v_rows from public.list_my_hidden_posts();
  if v_rows <> 1 then
    raise exception 'list_my_hidden_posts should list the one hidden post, got %', v_rows;
  end if;

  -- Unblock (the service deletes the viewer's own block row).
  delete from user_blocks
  where blocker_id = auth.uid()
    and blocked_user_key = '00000000-0000-0046-b000-000000000002';
  select count(*) into v_rows from public.list_my_blocked_users();
  if v_rows <> 0 then
    raise exception 'An unblocked person should leave the blocked list, got %', v_rows;
  end if;
end $$;

-- Another viewer cannot see the author's lists.
select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000002', true);
do $$
begin
  if exists (select 1 from public.list_my_hidden_posts()) then
    raise exception 'list_my_hidden_posts must only return the caller''s rows';
  end if;
end $$;

reset role;
rollback;
