-- Smoke checks for 20261107150000_following_new_dishes_digest.sql.
-- The 18:00 digest queues one job per follower per Singapore day from today's published posts
-- by the accounts they follow (approved only), names the author who posted most and the stall
-- when every post was at one, opens the Following feed, and leaves out deleted, private and
-- older posts, pending follows, opted-out people and people without a device. A second run the
-- same day queues nothing. Runs in a transaction and rolls back.
--   follower one: 00000000-0000-1107-f000-000000000001 (device, follows Mei and Ali)
--   follower two: 00000000-0000-1107-f000-000000000002 (device, follows Mei)
--   quiet:        00000000-0000-1107-f000-000000000003 (device, social_activity off)
--   no device:    00000000-0000-1107-f000-000000000004
--   Mei:          00000000-0000-1107-f000-000000000005
--   Ali:          00000000-0000-1107-f000-000000000006
--   Pending:      00000000-0000-1107-f000-000000000007 (follow request not approved)

begin;

insert into auth.users (id, email)
select ('00000000-0000-1107-f000-00000000000' || n)::uuid, 'digest-smoke-' || n || '@example.test'
from generate_series(1, 7) as n
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-1107-f000-000000000001', 'Digest Follower One'),
  ('00000000-0000-1107-f000-000000000002', 'Digest Follower Two'),
  ('00000000-0000-1107-f000-000000000003', 'Digest Quiet'),
  ('00000000-0000-1107-f000-000000000004', 'Digest No Device'),
  ('00000000-0000-1107-f000-000000000005', 'Mei'),
  ('00000000-0000-1107-f000-000000000006', 'Ali'),
  ('00000000-0000-1107-f000-000000000007', 'Pending Poster')
on conflict (id) do update set display_name = excluded.display_name;

insert into user_push_tokens (user_id, token, platform)
values
  ('00000000-0000-1107-f000-000000000001', 'ExponentPushToken[digest-smoke-1]', 'ios'),
  ('00000000-0000-1107-f000-000000000002', 'ExponentPushToken[digest-smoke-2]', 'ios'),
  ('00000000-0000-1107-f000-000000000003', 'ExponentPushToken[digest-smoke-3]', 'ios');

insert into notification_preferences (user_id, social_activity)
values ('00000000-0000-1107-f000-000000000003', false)
on conflict (user_id) do update set social_activity = excluded.social_activity;

insert into follows (follower_id, followee_id, status, approved_at) values
  ('00000000-0000-1107-f000-000000000001', '00000000-0000-1107-f000-000000000005', 'approved', now()),
  ('00000000-0000-1107-f000-000000000001', '00000000-0000-1107-f000-000000000006', 'approved', now()),
  ('00000000-0000-1107-f000-000000000002', '00000000-0000-1107-f000-000000000005', 'approved', now()),
  ('00000000-0000-1107-f000-000000000003', '00000000-0000-1107-f000-000000000005', 'approved', now()),
  ('00000000-0000-1107-f000-000000000004', '00000000-0000-1107-f000-000000000005', 'approved', now());
insert into follows (follower_id, followee_id, status) values
  ('00000000-0000-1107-f000-000000000001', '00000000-0000-1107-f000-000000000007', 'pending');

-- Two stalls. Mei posts twice at the first today; Ali once at the second. Mei's deleted post,
-- private post and two-day-old post, and the pending account's post, must not count.
create temporary table digest_venues on commit drop as
select v.id, v.name, row_number() over (order by v.id) as n
from venues v where v.name is not null order by v.id limit 2;

insert into posts (id, author_id, status, visibility, caption, venue_id, published_at, deleted_at)
select x.id::uuid, x.author::uuid, 'published', x.visibility, 'digest smoke', dv.id, x.published_at, x.deleted_at
from (values
  ('00000000-0000-1107-f100-000000000001', '00000000-0000-1107-f000-000000000005', 1, 'public', now(), null::timestamptz),
  ('00000000-0000-1107-f100-000000000002', '00000000-0000-1107-f000-000000000005', 1, 'followers', now(), null),
  ('00000000-0000-1107-f100-000000000003', '00000000-0000-1107-f000-000000000006', 2, 'public', now(), null),
  ('00000000-0000-1107-f100-000000000004', '00000000-0000-1107-f000-000000000005', 2, 'public', now(), now()),
  ('00000000-0000-1107-f100-000000000005', '00000000-0000-1107-f000-000000000005', 2, 'private', now(), null),
  ('00000000-0000-1107-f100-000000000006', '00000000-0000-1107-f000-000000000005', 2, 'public', now() - interval '2 days', null),
  ('00000000-0000-1107-f100-000000000007', '00000000-0000-1107-f000-000000000007', 2, 'public', now(), null)
) as x(id, author, venue_n, visibility, published_at, deleted_at)
join digest_venues dv on dv.n = x.venue_n;

do $$
declare
  v_queued integer;
  v_one text;
  v_two text;
  v_link text;
  v_first_venue text := (select name from digest_venues where n = 1);
begin
  v_queued := public.enqueue_social_new_dishes_digest_notifications();
  if v_queued < 2 then
    raise exception 'The digest should queue a job for each follower with a device, got %', v_queued;
  end if;

  select body, deep_link into v_one, v_link from notification_jobs
  where category = 'social_new_dishes_digest' and user_id = '00000000-0000-1107-f000-000000000001';
  if v_one is distinct from 'Mei and 1 other posted 3 dishes today.' then
    raise exception 'Follower one digest body wrong: %', v_one;
  end if;
  if v_link <> 'https://usehungry.com/following' then
    raise exception 'The digest should open the Following feed, got %', v_link;
  end if;

  select body into v_two from notification_jobs
  where category = 'social_new_dishes_digest' and user_id = '00000000-0000-1107-f000-000000000002';
  if v_two is distinct from concat('Mei posted 2 dishes at ', v_first_venue, ' today.') then
    raise exception 'Follower two digest body wrong: %', v_two;
  end if;

  if exists (
    select 1 from notification_jobs
    where category = 'social_new_dishes_digest'
      and user_id in ('00000000-0000-1107-f000-000000000003', '00000000-0000-1107-f000-000000000004')
  ) then
    raise exception 'Opted-out people and people without a device should get no digest';
  end if;

  if (
    select count(*) from notification_jobs
    where category = 'social_new_dishes_digest'
      and user_id in ('00000000-0000-1107-f000-000000000001', '00000000-0000-1107-f000-000000000002')
  ) <> 2 then
    raise exception 'Each follower should get exactly one digest job';
  end if;

  if public.enqueue_social_new_dishes_digest_notifications() <> 0 then
    raise exception 'A second run the same day should queue nothing';
  end if;
end $$;

-- Only the service role may run it.
do $$
begin
  if has_function_privilege('anon', 'public.enqueue_social_new_dishes_digest_notifications()', 'execute')
    or has_function_privilege('authenticated', 'public.enqueue_social_new_dishes_digest_notifications()', 'execute') then
    raise exception 'anon and authenticated must not run the digest';
  end if;
end $$;

rollback;
