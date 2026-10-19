-- Smoke checks for 20261019121000_get_post_by_id.sql.
-- A visitor without a session reads a public post but not a followers-only
-- or moderated one; a signed-in viewer sees their own like. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   viewer: 00000000-0000-0044-b000-000000000001
--   author: 00000000-0000-0044-b000-000000000002
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0044-b000-000000000001', 'Post Link Viewer'),
  ('00000000-0000-0044-b000-000000000002', 'Post Link Author')
on conflict (id) do nothing;

insert into posts (id, author_id, status, visibility, caption, published_at)
values
  (
    '00000000-0000-0044-c000-000000000001',
    '00000000-0000-0044-b000-000000000002',
    'published',
    'public',
    'Public link smoke post',
    now()
  ),
  (
    '00000000-0000-0044-c000-000000000002',
    '00000000-0000-0044-b000-000000000002',
    'published',
    'followers',
    'Followers link smoke post',
    now()
  ),
  (
    '00000000-0000-0044-c000-000000000003',
    '00000000-0000-0044-b000-000000000002',
    'published',
    'public',
    'Moderated link smoke post',
    now()
  );

insert into post_moderation_states (post_id, state)
values ('00000000-0000-0044-c000-000000000003', 'removed');

insert into post_likes (post_id, user_id)
values ('00000000-0000-0044-c000-000000000001', '00000000-0000-0044-b000-000000000001');

-- Visitor without a session.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_caption text;
  v_liked boolean;
begin
  select post.caption, post.viewer_has_liked
  into v_caption, v_liked
  from public.get_post_by_id('00000000-0000-0044-c000-000000000001') post;
  if v_caption is distinct from 'Public link smoke post' then
    raise exception 'Visitor should read a public post by link (got %)', v_caption;
  end if;
  if v_liked is distinct from false then
    raise exception 'Visitor has no like state (got %)', v_liked;
  end if;

  if exists (select 1 from public.get_post_by_id('00000000-0000-0044-c000-000000000002')) then
    raise exception 'Visitor must not read a followers-only post';
  end if;

  if exists (select 1 from public.get_post_by_id('00000000-0000-0044-c000-000000000003')) then
    raise exception 'Nobody reads a removed post by link';
  end if;
end $$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0044-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_liked boolean;
begin
  select post.viewer_has_liked
  into v_liked
  from public.get_post_by_id('00000000-0000-0044-c000-000000000001') post;
  if v_liked is distinct from true then
    raise exception 'Signed-in viewer should see their own like (got %)', v_liked;
  end if;
end $$;

rollback;
