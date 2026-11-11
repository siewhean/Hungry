-- Smoke checks for 20261111130000_security_audit_fixes.sql.
-- 1. A photo check answer counts only for the file it was about: a check made before the upload
--    records nothing, a file changed after its check, an "unchecked" answer, a HEIC file and a file
--    over 8 MB are all refused by publish_post; publish_post stores no client public_url.
-- 2. A review photo with no clear answer is refused, inserted directly or through submit_review.
-- 3. A deleted post cannot be brought back; a post's dish must belong to its stall.
-- 4. award_food_cred pays nothing for an action the phone cannot prove; mission progress counts
--    real saves, not calls; passport progress ignores a reference that is not the caller's.
-- 5. Grants and storage rules: anon cannot write user tables, orders is read-only, activity events
--    are marked read only, conversations are written by the chat functions only, post-media and
--    review-media files cannot be overwritten, a moderated review's photos are not readable.
-- Runs in a transaction and rolls back. Brings its own building, stall and dish.
--   user: 00000000-0000-1111-b000-000000000001

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-saf-building', 'Smoke SAF Building', 'hawker_centre', 1.2803, 103.8448);
insert into venues (id, building_id, name, floor)
values
  ('smoke-saf-venue', 'smoke-saf-building', 'Smoke SAF Stall', '1'),
  ('smoke-saf-venue-2', 'smoke-saf-building', 'Smoke SAF Other Stall', '1');
insert into dishes (id, venue_id, building_id, name, price, menu_approved_for_display, menu_rights_status)
values ('smoke-saf-dish', 'smoke-saf-venue', 'smoke-saf-building', 'Smoke SAF Noodles', 4.5, true, 'operator_owned');

insert into auth.users (id, email)
values ('00000000-0000-1111-b000-000000000001', 'security-audit-fixes-smoke-1@example.test')
on conflict (id) do nothing;
insert into user_profiles (id, display_name)
values ('00000000-0000-1111-b000-000000000001', 'SAF Smoke Diner')
on conflict (id) do nothing;

-- 1. Answers tied to files. Post folders c1..c6 under the diner.
do $$
declare
  v_u constant text := '00000000-0000-1111-b000-000000000001';
  v_recorded integer;
begin
  -- Checked before the file exists: nothing recorded.
  v_recorded := public.record_photo_safety_checks(
    v_u::uuid, 'post-media',
    jsonb_build_array(jsonb_build_object('path', v_u || '/00000000-0000-1111-c000-000000000001/a.jpg', 'status', 'clear'))
  );
  if v_recorded <> 0 then
    raise exception 'a check of a file that is not stored yet was recorded';
  end if;

  insert into storage.objects (bucket_id, name, owner, metadata)
  values
    ('post-media', v_u || '/00000000-0000-1111-c000-000000000001/a.jpg', v_u::uuid, '{"mimetype": "image/jpeg", "size": 1000}'),
    ('post-media', v_u || '/00000000-0000-1111-c000-000000000002/a.jpg', v_u::uuid, '{"mimetype": "image/jpeg", "size": 1000}'),
    ('post-media', v_u || '/00000000-0000-1111-c000-000000000003/a.jpg', v_u::uuid, '{"mimetype": "image/jpeg", "size": 1000}'),
    ('post-media', v_u || '/00000000-0000-1111-c000-000000000004/a.heic', v_u::uuid, '{"mimetype": "image/heic", "size": 1000}'),
    ('post-media', v_u || '/00000000-0000-1111-c000-000000000005/a.jpg', v_u::uuid, '{"mimetype": "image/jpeg", "size": 9000000}'),
    ('review-media', v_u || '/r1/a.jpg', v_u::uuid, '{"mimetype": "image/jpeg", "size": 1000}'),
    ('review-media', v_u || '/r2/a.jpg', v_u::uuid, '{"mimetype": "image/jpeg", "size": 1000}');

  perform public.record_photo_safety_checks(
    v_u::uuid, 'post-media',
    jsonb_build_array(
      jsonb_build_object('path', v_u || '/00000000-0000-1111-c000-000000000001/a.jpg', 'status', 'clear'),
      jsonb_build_object('path', v_u || '/00000000-0000-1111-c000-000000000002/a.jpg', 'status', 'clear'),
      jsonb_build_object('path', v_u || '/00000000-0000-1111-c000-000000000003/a.jpg', 'status', 'unchecked'),
      jsonb_build_object('path', v_u || '/00000000-0000-1111-c000-000000000004/a.heic', 'status', 'clear'),
      jsonb_build_object('path', v_u || '/00000000-0000-1111-c000-000000000005/a.jpg', 'status', 'clear')
    )
  );
  perform public.record_photo_safety_checks(
    v_u::uuid, 'review-media',
    jsonb_build_array(jsonb_build_object('path', v_u || '/r1/a.jpg', 'status', 'clear'))
  );

  -- File 2 changed after its check (storage stamps updated_at itself, so the answer is aged).
  update app_private.photo_safety_checks
  set object_updated_at = object_updated_at - interval '1 minute'
  where storage_bucket = 'post-media'
    and storage_path = v_u || '/00000000-0000-1111-c000-000000000002/a.jpg';
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1111-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_u constant text := '00000000-0000-1111-b000-000000000001';
  v_case record;
  v_refused boolean;
begin
  for v_case in
    select * from (values
      ('a file changed after its check', '00000000-0000-1111-c000-000000000002', 'a.jpg'),
      ('an unchecked answer', '00000000-0000-1111-c000-000000000003', 'a.jpg'),
      ('a HEIC file', '00000000-0000-1111-c000-000000000004', 'a.heic'),
      ('a file over 8 MB', '00000000-0000-1111-c000-000000000005', 'a.jpg')
    ) as t(label, post_id, file)
  loop
    v_refused := false;
    begin
      perform public.publish_post(
        jsonb_build_object('id', v_case.post_id, 'venue_id', 'smoke-saf-venue'),
        jsonb_build_array(jsonb_build_object(
          'storage_path', v_u || '/' || v_case.post_id || '/' || v_case.file, 'media_type', 'image'))
      );
    exception when sqlstate '23514' then
      v_refused := true;
    end;
    if not v_refused then
      raise exception 'publish_post accepted %', v_case.label;
    end if;
  end loop;

  perform public.publish_post(
    jsonb_build_object('id', '00000000-0000-1111-c000-000000000001', 'venue_id', 'smoke-saf-venue',
      'dish_id', 'smoke-saf-dish'),
    jsonb_build_array(jsonb_build_object(
      'storage_path', v_u || '/00000000-0000-1111-c000-000000000001/a.jpg', 'media_type', 'image',
      'public_url', 'https://tracker.example.test/pixel.jpg'))
  );
  if exists (
    select 1 from post_media m
    where m.post_id = '00000000-0000-1111-c000-000000000001' and m.public_url is not null
  ) then
    raise exception 'publish_post kept the client public_url';
  end if;
end $$;

-- 2. Review photos.
do $$
declare
  v_u constant text := '00000000-0000-1111-b000-000000000001';
  v_refused boolean := false;
begin
  begin
    perform public.submit_review(
      '{"id":"00000000-0000-1111-d000-000000000002","dish_id":"smoke-saf-dish","venue_id":"smoke-saf-venue","rating":4}'::jsonb,
      jsonb_build_array(jsonb_build_object('storage_path', v_u || '/r2/a.jpg'))
    );
  exception when sqlstate '23514' then
    v_refused := true;
  end;
  if not v_refused then
    raise exception 'submit_review accepted a review photo with no answer';
  end if;

  perform public.submit_review(
    '{"id":"00000000-0000-1111-d000-000000000001","dish_id":"smoke-saf-dish","venue_id":"smoke-saf-venue","rating":4}'::jsonb,
    jsonb_build_array(jsonb_build_object('storage_path', v_u || '/r1/a.jpg'))
  );

  v_refused := false;
  begin
    insert into review_photos (review_id, url, storage_bucket, storage_path, sort_order)
    values ('00000000-0000-1111-d000-000000000001', 'https://tracker.example.test/x.jpg', 'review-media', v_u || '/r2/a.jpg', 1);
  exception when sqlstate '23514' then
    v_refused := true;
  end;
  if not v_refused then
    raise exception 'a direct review photo insert skipped the photo check';
  end if;
  if exists (
    select 1 from review_photos rp
    where rp.review_id = '00000000-0000-1111-d000-000000000001' and rp.url is distinct from rp.storage_path
  ) then
    raise exception 'a review photo url is not its own storage path';
  end if;
end $$;

-- 3. Posts.
do $$
declare
  v_refused boolean := false;
begin
  update posts set deleted_at = now() where id = '00000000-0000-1111-c000-000000000001';
  begin
    update posts set deleted_at = null where id = '00000000-0000-1111-c000-000000000001';
  exception when insufficient_privilege then
    v_refused := true;
  end;
  if not v_refused then
    raise exception 'a deleted post was brought back from the phone';
  end if;
end $$;

reset role;
do $$
declare
  v_refused boolean := false;
begin
  begin
    insert into posts (author_id, status, dish_id, venue_id)
    values ('00000000-0000-1111-b000-000000000001', 'draft', 'smoke-saf-dish', 'smoke-saf-venue-2');
  exception when sqlstate '22023' then
    v_refused := true;
  end;
  if not v_refused then
    raise exception 'a post accepted a dish from another stall';
  end if;
end $$;
set local role authenticated;

-- 4. Points, missions and passport.
do $$
declare
  v_u constant uuid := '00000000-0000-1111-b000-000000000001';
  v_points integer;
begin
  select points_awarded into v_points from public.award_food_cred('review_created', 'x');
  if v_points <> 0 then
    raise exception 'the phone was paid for review_created';
  end if;
  select points_awarded into v_points from public.award_food_cred('stall_saved', 'smoke-saf-venue');
  if v_points <> 0 then
    raise exception 'the phone was paid for saving a stall it has not saved';
  end if;
  perform public.upsert_stall_interaction('smoke-saf-venue', true, null, null);
  select points_awarded into v_points from public.award_food_cred('stall_saved', 'smoke-saf-venue');
  if v_points <= 0 then
    raise exception 'a real save was not paid';
  end if;

  perform public.record_passport_progress('contributor', 'stall_submitted', gen_random_uuid()::text);
  if exists (select 1 from passport_progress_events e where e.user_id = v_u) then
    raise exception 'passport progress counted a submission that is not the caller''s';
  end if;
end $$;

reset role;

-- 5. Grants and storage rules.
do $$
begin
  if has_table_privilege('anon', 'public.posts', 'insert')
     or has_table_privilege('anon', 'public.review_photos', 'insert')
     or has_table_privilege('anon', 'public.user_profiles', 'update') then
    raise exception 'anon can still write a user table';
  end if;
  if has_table_privilege('authenticated', 'public.orders', 'update')
     or has_table_privilege('authenticated', 'public.orders', 'insert') then
    raise exception 'orders is still writable';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'UPDATE'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(post-media|review-media)'
  ) then
    raise exception 'post-media or review-media files can still be overwritten';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'review_media_select_signed_public_reviews'
      and qual like '%review_moderation_states%'
  ) then
    raise exception 'review photos are readable after moderation';
  end if;
  if has_function_privilege('authenticated', 'app_private.photo_check_verdict(text, text, uuid)', 'execute') then
    raise exception 'signed-in users can call photo_check_verdict';
  end if;
  if has_column_privilege('authenticated', 'public.activity_events', 'actor_id', 'update')
     or not has_column_privilege('authenticated', 'public.activity_events', 'read_at', 'update') then
    raise exception 'activity events are not limited to marking read';
  end if;
  if has_table_privilege('authenticated', 'public.conversations', 'update')
     or has_table_privilege('authenticated', 'public.conversations', 'insert')
     or has_table_privilege('authenticated', 'public.conversation_participants', 'insert') then
    raise exception 'conversations can still be written directly';
  end if;
  if position('can_read_post' in (select prosrc from pg_proc
       where oid = 'app_private.list_my_hidden_posts()'::regprocedure)) = 0 then
    raise exception 'the hidden posts list shows posts the caller cannot read';
  end if;
end $$;

rollback;
