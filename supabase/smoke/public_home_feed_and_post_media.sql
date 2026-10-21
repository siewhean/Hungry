-- Smoke checks for 20261021130000_public_home_feed_and_post_media.sql.
-- A visitor without a session gets public posts by public accounts in the
-- Home feed, never followers-only, moderated or private-account posts, and may
-- read only the storage objects of those public posts. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   public author:  00000000-0000-0045-b000-000000000001
--   private author: 00000000-0000-0045-b000-000000000002
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0045-b000-000000000001', 'Guest Feed Public Author'),
  ('00000000-0000-0045-b000-000000000002', 'Guest Feed Private Author')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-0045-b000-000000000002', 'private')
on conflict (user_id) do update set account_visibility = excluded.account_visibility;

insert into posts (id, author_id, status, visibility, caption, published_at)
values
  (
    '00000000-0000-0045-c000-000000000001',
    '00000000-0000-0045-b000-000000000001',
    'published',
    'public',
    'Guest feed public post',
    now() + interval '1 day'
  ),
  (
    '00000000-0000-0045-c000-000000000002',
    '00000000-0000-0045-b000-000000000001',
    'published',
    'followers',
    'Guest feed followers post',
    now() + interval '1 day'
  ),
  (
    '00000000-0000-0045-c000-000000000003',
    '00000000-0000-0045-b000-000000000001',
    'published',
    'public',
    'Guest feed removed post',
    now() + interval '1 day'
  ),
  (
    '00000000-0000-0045-c000-000000000004',
    '00000000-0000-0045-b000-000000000002',
    'published',
    'public',
    'Guest feed private-account post',
    now() + interval '1 day'
  );

insert into post_moderation_states (post_id, state)
values ('00000000-0000-0045-c000-000000000003', 'removed');

insert into post_media (post_id, media_type, storage_bucket, storage_path, sort_order)
values
  (
    '00000000-0000-0045-c000-000000000001',
    'image',
    'post-media',
    '00000000-0000-0045-b000-000000000001/guest-feed-public.jpg',
    0
  ),
  (
    '00000000-0000-0045-c000-000000000002',
    'image',
    'post-media',
    '00000000-0000-0045-b000-000000000001/guest-feed-followers.jpg',
    0
  );

-- Visitor without a session.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare
  v_ids uuid[];
  v_media_count integer;
begin
  select array_agg(feed.id), max(jsonb_array_length(feed.media))
  into v_ids, v_media_count
  from public.get_public_home_feed(50, null, null) feed
  where feed.author_id in (
    '00000000-0000-0045-b000-000000000001',
    '00000000-0000-0045-b000-000000000002'
  );

  if v_ids is distinct from array['00000000-0000-0045-c000-000000000001'::uuid] then
    raise exception 'Visitor feed should hold only the public post by a public account (got %)', v_ids;
  end if;
  if v_media_count is distinct from 1 then
    raise exception 'Visitor feed rows carry their media (got %)', v_media_count;
  end if;

  if not app_private.can_read_public_post_media_object(
    'post-media',
    '00000000-0000-0045-b000-000000000001/guest-feed-public.jpg'
  ) then
    raise exception 'Visitor should read the photo of a public post';
  end if;
  if app_private.can_read_public_post_media_object(
    'post-media',
    '00000000-0000-0045-b000-000000000001/guest-feed-followers.jpg'
  ) then
    raise exception 'Visitor must not read the photo of a followers-only post';
  end if;
end $$;

reset role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_media_select_public_post_objects_anon'
      and 'anon' = any(roles)
  ) then
    raise exception 'Missing anon select policy for public post media';
  end if;
  if has_function_privilege('anon', 'public.get_home_social_feed_v3(integer, timestamptz, uuid)', 'execute') then
    raise exception 'The signed-in feed v3 stays closed to anon';
  end if;
end $$;

rollback;
