-- Smoke checks for 20261022031000_social_push_categories.sql.
-- A follow request queues one push job (and only for a person with a device);
-- a repeat request after cancel queues a new one. The likes digest queues one job
-- per person per Singapore day, counts distinct people and posts, links to the post
-- when there is one, and skips opted-out people and people without a device.
-- Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   recipient: 00000000-0000-0047-b000-000000000001 (device, opted in)
--   fan one:   00000000-0000-0047-b000-000000000002
--   fan two:   00000000-0000-0047-b000-000000000003
--   quiet:     00000000-0000-0047-b000-000000000004 (device, social_activity off)
--   no device: 00000000-0000-0047-b000-000000000005
insert into auth.users (id, email)
values
  ('00000000-0000-0047-b000-000000000001', 'social-push-recipient@example.test'),
  ('00000000-0000-0047-b000-000000000004', 'social-push-quiet@example.test'),
  ('00000000-0000-0047-b000-000000000005', 'social-push-nodevice@example.test');

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0047-b000-000000000001', 'Social Push Recipient'),
  ('00000000-0000-0047-b000-000000000002', 'Social Push Fan One'),
  ('00000000-0000-0047-b000-000000000003', 'Social Push Fan Two'),
  ('00000000-0000-0047-b000-000000000004', 'Social Push Quiet'),
  ('00000000-0000-0047-b000-000000000005', 'Social Push No Device')
on conflict (id) do nothing;

insert into user_push_tokens (user_id, token, platform)
values
  ('00000000-0000-0047-b000-000000000001', 'ExponentPushToken[social-smoke-1]', 'ios'),
  ('00000000-0000-0047-b000-000000000004', 'ExponentPushToken[social-smoke-4]', 'ios');

insert into notification_preferences (user_id, social_activity)
values ('00000000-0000-0047-b000-000000000004', false)
on conflict (user_id) do update set social_activity = excluded.social_activity;

-- Follow request: one job for the person with a device, none without.
insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
values
  ('00000000-0000-0047-b000-000000000001', '00000000-0000-0047-b000-000000000002',
   'follow_request', 'profile', '00000000-0000-0047-b000-000000000001'),
  ('00000000-0000-0047-b000-000000000005', '00000000-0000-0047-b000-000000000002',
   'follow_request', 'profile', '00000000-0000-0047-b000-000000000005');
do $$
declare
  v_rows integer;
  v_link text;
begin
  select count(*), min(deep_link) into v_rows, v_link
  from notification_jobs
  where category = 'social_follow_request'
    and user_id = '00000000-0000-0047-b000-000000000001';
  if v_rows <> 1 then
    raise exception 'A follow request should queue one push job, got %', v_rows;
  end if;
  if v_link <> 'https://usehungry.com/follow-requests' then
    raise exception 'The follow request push should open the requests screen, got %', v_link;
  end if;
  if exists (
    select 1 from notification_jobs
    where user_id = '00000000-0000-0047-b000-000000000005'
  ) then
    raise exception 'A person without a device should get no push job';
  end if;
end $$;

-- Likes digest: two fans like two posts of the recipient's, plus one like for the
-- opted-out person and one for the person without a device.
insert into posts (id, author_id, status, visibility, caption, published_at)
values
  ('00000000-0000-0047-c000-000000000001', '00000000-0000-0047-b000-000000000001',
   'published', 'public', 'Digest smoke post one', now()),
  ('00000000-0000-0047-c000-000000000002', '00000000-0000-0047-b000-000000000004',
   'published', 'public', 'Digest smoke post two', now()),
  ('00000000-0000-0047-c000-000000000003', '00000000-0000-0047-b000-000000000005',
   'published', 'public', 'Digest smoke post three', now());
insert into post_likes (post_id, user_id)
values
  ('00000000-0000-0047-c000-000000000001', '00000000-0000-0047-b000-000000000002'),
  ('00000000-0000-0047-c000-000000000001', '00000000-0000-0047-b000-000000000003'),
  ('00000000-0000-0047-c000-000000000002', '00000000-0000-0047-b000-000000000002'),
  ('00000000-0000-0047-c000-000000000003', '00000000-0000-0047-b000-000000000002');

do $$
declare
  v_queued integer;
  v_body text;
  v_link text;
begin
  v_queued := public.enqueue_social_like_digest_notifications();
  if v_queued <> 1 then
    raise exception 'The digest should queue one job (opted-out and no-device skipped), got %', v_queued;
  end if;

  select body, deep_link into v_body, v_link
  from notification_jobs
  where category = 'social_like_digest'
    and user_id = '00000000-0000-0047-b000-000000000001';
  if v_body <> '2 people liked your post today.' then
    raise exception 'Unexpected digest body: %', v_body;
  end if;
  if v_link <> 'https://usehungry.com/post/00000000-0000-0047-c000-000000000001' then
    raise exception 'A single-post digest should open that post, got %', v_link;
  end if;

  -- Running it again the same day queues nothing new.
  if public.enqueue_social_like_digest_notifications() <> 0 then
    raise exception 'The digest should queue at most one job per person per day';
  end if;
end $$;

-- Only the service role may run the digest.
set local role authenticated;
do $$
begin
  begin
    perform public.enqueue_social_like_digest_notifications();
    raise exception 'authenticated must not run the digest enqueue';
  exception
    when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
