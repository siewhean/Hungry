-- Smoke checks for 20261110120000_post_publish_gate.sql.
-- 1. publish_post refuses a photo the photo check has not answered, a blocked photo, a file that is
--    not in storage and a file outside the post's folder; with a clear answer it publishes once,
--    and a retry returns the same post. (A post with no media is allowed since 20261114090000:
--    supabase/smoke/photo_optional.sql.)
-- 2. A signed-in author can no longer write posts.status, the counters or post_media
--    directly, and can still edit a caption and soft delete. (user_profiles.pinned_post_ids was
--    dropped in 20261111120000.)
-- 3. submit_review with p_portfolio makes the review and its linked entry together (posts.review_id
--    set, dish and stall from the review); a retry makes no second entry; a blocked entry photo
--    rolls the review back too.
-- 4. Editing the review's words and stars updates the linked entry.
-- 5. anon cannot run publish_post; only the service role can record photo checks; the rate rule exists.
-- Runs in a transaction and rolls back.
--   author: 00000000-0000-1110-b000-000000000001

begin;

insert into auth.users (id, email)
values ('00000000-0000-1110-b000-000000000001', 'post-publish-gate-smoke-1@example.test')
on conflict (id) do nothing;
insert into user_profiles (id, display_name)
values ('00000000-0000-1110-b000-000000000001', 'Publish Gate Author')
on conflict (id) do nothing;

-- The stall is the dish's own: a review takes its venue from its dish.
select set_config('smoke.dish', (select d.id from dishes d order by d.id limit 1), true);
select set_config('smoke.venue', (select d.venue_id from dishes d where d.id = current_setting('smoke.dish')), true);

-- Files "uploaded" for three posts and one review entry.
insert into storage.objects (bucket_id, name, owner, metadata)
values
  ('post-media', '00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000001/a.jpg',
   '00000000-0000-1110-b000-000000000001', '{"mimetype": "image/jpeg", "size": 1000}'),
  ('post-media', '00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000002/a.jpg',
   '00000000-0000-1110-b000-000000000001', '{"mimetype": "image/jpeg", "size": 1000}'),
  ('post-media', '00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000003/a.jpg',
   '00000000-0000-1110-b000-000000000001', '{"mimetype": "image/jpeg", "size": 1000}'),
  ('post-media', '00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000004/a.jpg',
   '00000000-0000-1110-b000-000000000001', '{"mimetype": "image/jpeg", "size": 1000}'),
  -- The review photos (checked like post photos since 20261111130000).
  ('review-media', '00000000-0000-1110-b000-000000000001/r1/a.jpg',
   '00000000-0000-1110-b000-000000000001', '{"mimetype": "image/jpeg", "size": 1000}'),
  ('review-media', '00000000-0000-1110-b000-000000000001/r2/a.jpg',
   '00000000-0000-1110-b000-000000000001', '{"mimetype": "image/jpeg", "size": 1000}');

-- 5. Who can do what.
do $$
begin
  if has_function_privilege('anon', 'public.publish_post(jsonb, jsonb)', 'execute') then
    raise exception 'anon can run publish_post';
  end if;
  if has_function_privilege('authenticated', 'public.record_photo_safety_checks(uuid, text, jsonb, timestamptz)', 'execute') then
    raise exception 'signed-in users can record photo checks';
  end if;
  if not exists (select 1 from app_private.request_rate_rules where route = 'rpc/publish_post') then
    raise exception 'publish_post has no rate rule';
  end if;
  if has_column_privilege('authenticated', 'public.posts', 'like_count', 'update')
     or has_column_privilege('authenticated', 'public.posts', 'status', 'update')
     or has_table_privilege('authenticated', 'public.post_media', 'insert')
     or has_table_privilege('authenticated', 'public.posts', 'insert') then
    raise exception 'a locked column or table is still writable from the phone';
  end if;
  if not has_column_privilege('authenticated', 'public.posts', 'caption', 'update')
     or not has_column_privilege('authenticated', 'public.posts', 'deleted_at', 'update')
     or not has_column_privilege('authenticated', 'public.user_profiles', 'display_name', 'update') then
    raise exception 'an editable column lost its grant';
  end if;
end $$;

-- Answers from the photo check: post 1 clear, post 2 blocked, entry 4 clear; post 3 unanswered.
select public.record_photo_safety_checks(
  '00000000-0000-1110-b000-000000000001', 'post-media',
  '[{"path": "00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000001/a.jpg", "status": "clear"},
    {"path": "00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000002/a.jpg", "status": "blocked"},
    {"path": "00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000004/a.jpg", "status": "clear"}]'
);
select public.record_photo_safety_checks(
  '00000000-0000-1110-b000-000000000001', 'review-media',
  '[{"path": "00000000-0000-1110-b000-000000000001/r1/a.jpg", "status": "clear"},
    {"path": "00000000-0000-1110-b000-000000000001/r2/a.jpg", "status": "clear"}]'
);
-- A blocked answer never turns back to clear.
select public.record_photo_safety_checks(
  '00000000-0000-1110-b000-000000000001', 'post-media',
  '[{"path": "00000000-0000-1110-b000-000000000001/00000000-0000-1110-c000-000000000002/a.jpg", "status": "clear"}]'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1110-b000-000000000001', true);
set local role authenticated;

-- 1. publish_post.
do $$
declare
  v_author constant text := '00000000-0000-1110-b000-000000000001';
  v_result jsonb;
  v_refused boolean;
  v_case record;
begin
  for v_case in
    select * from (values
      ('unanswered photo', '00000000-0000-1110-c000-000000000003',
        '[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000003/a.jpg", "media_type": "image"}]'),
      ('blocked photo', '00000000-0000-1110-c000-000000000002',
        '[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000002/a.jpg", "media_type": "image"}]'),
      ('missing file', '00000000-0000-1110-c000-000000000001',
        '[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000001/nope.jpg", "media_type": "image"}]'),
      ('other folder', '00000000-0000-1110-c000-000000000001',
        '[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000004/a.jpg", "media_type": "image"}]'),
      ('wrong type', '00000000-0000-1110-c000-000000000001',
        '[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000001/a.jpg", "media_type": "video"}]')
    ) as t(label, post_id, media)
  loop
    v_refused := false;
    begin
      perform public.publish_post(
        jsonb_build_object('id', v_case.post_id, 'caption', 'smoke', 'venue_id', current_setting('smoke.venue')),
        v_case.media::jsonb
      );
    exception when others then
      v_refused := true;
    end;
    if not v_refused then
      raise exception 'publish_post accepted a post with %', v_case.label;
    end if;
  end loop;

  v_result := public.publish_post(
    jsonb_build_object(
      'id', '00000000-0000-1110-c000-000000000001', 'caption', 'smoke post',
      'venue_id', current_setting('smoke.venue'), 'dish_id', current_setting('smoke.dish')
    ),
    ('[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000001/a.jpg", "media_type": "image"}]')::jsonb
  );
  if (v_result ->> 'resumed')::boolean then
    raise exception 'first publish reported resumed';
  end if;
  if not exists (
    select 1 from posts p
    where p.id = '00000000-0000-1110-c000-000000000001' and p.status = 'published'
      and p.published_at is not null and p.post_type = 'image'
  ) or (select count(*) from post_media m where m.post_id = '00000000-0000-1110-c000-000000000001') <> 1 then
    raise exception 'publish_post did not publish the post with its media';
  end if;

  v_result := public.publish_post(
    jsonb_build_object('id', '00000000-0000-1110-c000-000000000001', 'venue_id', current_setting('smoke.venue')),
    ('[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000001/a.jpg", "media_type": "image"}]')::jsonb
  );
  if not (v_result ->> 'resumed')::boolean
     or (select count(*) from post_media m where m.post_id = '00000000-0000-1110-c000-000000000001') <> 1 then
    raise exception 'a retry did not resume the same post';
  end if;
end $$;

-- 2. Direct writes.
do $$
declare
  v_refused boolean;
  v_sql text;
begin
  foreach v_sql in array array[
    'update posts set like_count = 999 where id = ''00000000-0000-1110-c000-000000000001''',
    'update posts set status = ''draft'' where id = ''00000000-0000-1110-c000-000000000001''',
    'update posts set board_credit_points = 999 where id = ''00000000-0000-1110-c000-000000000001''',
    'insert into posts (author_id, status) values (''00000000-0000-1110-b000-000000000001'', ''published'')',
    'insert into post_media (post_id, media_type, storage_path) values (''00000000-0000-1110-c000-000000000001'', ''image'', ''x'')'
  ] loop
    v_refused := false;
    begin
      execute v_sql;
    exception when insufficient_privilege then
      v_refused := true;
    end;
    if not v_refused then
      raise exception 'direct write was allowed: %', v_sql;
    end if;
  end loop;

  update posts set caption = 'smoke edited' where id = '00000000-0000-1110-c000-000000000001';
  update user_profiles set display_name = 'Publish Gate Renamed' where id = '00000000-0000-1110-b000-000000000001';
end $$;

-- 3 and 4. A review and its entry.
do $$
declare
  v_author constant text := '00000000-0000-1110-b000-000000000001';
  v_result jsonb;
  v_refused boolean := false;
begin
  -- A blocked entry photo rolls the review back as well.
  begin
    perform public.submit_review(
      jsonb_build_object('id', '00000000-0000-1110-d000-000000000002', 'dish_id', current_setting('smoke.dish'),
        'venue_id', current_setting('smoke.venue'), 'rating', 4, 'text', 'blocked entry'),
      ('[{"storage_path": "' || v_author || '/r2/a.jpg"}]')::jsonb,
      jsonb_build_object(
        'post', jsonb_build_object('id', '00000000-0000-1110-c000-000000000002'),
        'media', ('[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000002/a.jpg", "media_type": "image"}]')::jsonb
      )
    );
  exception when others then
    v_refused := true;
  end;
  if not v_refused or exists (select 1 from reviews r where r.id = '00000000-0000-1110-d000-000000000002') then
    raise exception 'a blocked entry photo left the review behind';
  end if;

  v_result := public.submit_review(
    jsonb_build_object('id', '00000000-0000-1110-d000-000000000001', 'dish_id', current_setting('smoke.dish'),
      'venue_id', current_setting('smoke.venue'), 'rating', 4, 'text', 'smoke review'),
    ('[{"storage_path": "' || v_author || '/r1/a.jpg"}]')::jsonb,
    jsonb_build_object(
      'post', jsonb_build_object('id', '00000000-0000-1110-c000-000000000004', 'caption', 'smoke review',
        'generated_content', jsonb_build_object('rating', 4)),
      'media', ('[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000004/a.jpg", "media_type": "image"}]')::jsonb
    )
  );
  if (v_result ->> 'post_id') is distinct from '00000000-0000-1110-c000-000000000004' then
    raise exception 'submit_review did not return the entry: %', v_result;
  end if;
  if not exists (
    select 1 from posts p
    where p.id = '00000000-0000-1110-c000-000000000004'
      and p.review_id = '00000000-0000-1110-d000-000000000001'
      and p.dish_id = current_setting('smoke.dish')
      and p.venue_id = current_setting('smoke.venue')
      and p.status = 'published'
  ) then
    raise exception 'the entry is not linked to its review';
  end if;

  -- A retry with a fresh entry id finds the linked entry.
  v_result := public.submit_review(
    jsonb_build_object('id', '00000000-0000-1110-d000-000000000001', 'dish_id', current_setting('smoke.dish'),
      'venue_id', current_setting('smoke.venue'), 'rating', 4, 'text', 'smoke review'),
    ('[{"storage_path": "' || v_author || '/r1/a.jpg"}]')::jsonb,
    jsonb_build_object(
      'post', jsonb_build_object('id', '00000000-0000-1110-c000-000000000009'),
      'media', ('[{"storage_path": "' || v_author || '/00000000-0000-1110-c000-000000000009/a.jpg", "media_type": "image"}]')::jsonb
    )
  );
  if not (v_result ->> 'post_resumed')::boolean
     or (select count(*) from posts p where p.review_id = '00000000-0000-1110-d000-000000000001') <> 1 then
    raise exception 'a retry made a second entry';
  end if;

  update reviews set text = 'smoke review, edited', rating = 5
  where id = '00000000-0000-1110-d000-000000000001';
  if not exists (
    select 1 from posts p
    where p.id = '00000000-0000-1110-c000-000000000004'
      and p.caption = 'smoke review, edited'
      and (p.generated_content ->> 'rating')::numeric = 5
  ) then
    raise exception 'a review edit did not reach its entry';
  end if;
end $$;

rollback;
