-- Smoke checks for 20261019120000_home_feed_viewer_state.sql.
-- A viewer likes (not saves) a post; the v3 feed row reports liked = true and
-- saved = false, and another viewer sees liked = false. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   viewer: 00000000-0000-0043-b000-000000000001
--   author: 00000000-0000-0043-b000-000000000002
--   other:  00000000-0000-0043-b000-000000000003
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0043-b000-000000000001', 'Feed State Viewer'),
  ('00000000-0000-0043-b000-000000000002', 'Feed State Author'),
  ('00000000-0000-0043-b000-000000000003', 'Feed State Other')
on conflict (id) do nothing;

-- Published far in the future so it is on the first feed page.
insert into posts (id, author_id, status, visibility, caption, published_at)
values (
  '00000000-0000-0043-c000-000000000001',
  '00000000-0000-0043-b000-000000000002',
  'published',
  'public',
  'Feed state smoke post',
  now() + interval '20 years'
);

insert into post_likes (post_id, user_id)
values ('00000000-0000-0043-c000-000000000001', '00000000-0000-0043-b000-000000000001');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0043-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_liked boolean;
  v_saved boolean;
begin
  select feed.viewer_has_liked, feed.viewer_has_saved
  into v_liked, v_saved
  from public.get_home_social_feed_v3(50, null, null) feed
  where feed.id = '00000000-0000-0043-c000-000000000001';

  if v_liked is distinct from true then
    raise exception 'v3 should report the viewer like (got %)', v_liked;
  end if;
  if v_saved is distinct from false then
    raise exception 'v3 should report no viewer save (got %)', v_saved;
  end if;
end $$;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0043-b000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_liked boolean;
begin
  select feed.viewer_has_liked
  into v_liked
  from public.get_home_social_feed_v3(50, null, null) feed
  where feed.id = '00000000-0000-0043-c000-000000000001';

  if v_liked is distinct from false then
    raise exception 'Another viewer must not see someone else''s like as their own (got %)', v_liked;
  end if;
end $$;

rollback;
