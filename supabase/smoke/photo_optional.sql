-- Smoke checks for 20261114090000_photo_optional.sql.
-- 1. submit_review saves a review with no photo (no photo rows), and a retry of it can add one.
-- 2. publish_post publishes a post with no media as a text post with no media rows.
-- 3. submit_review with p_portfolio and no media makes the review and a text entry together.
-- 4. A photo outside the caller's folder is still refused, and the review is not left behind.
-- Runs in a transaction and rolls back. Brings its own building, so it runs on prod as well.
--   user: 00000000-0000-1114-b000-000000000001

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-po-building', 'Smoke PO Building', 'hawker_centre', 1.2803, 103.8448);
insert into venues (id, building_id, name, floor)
values ('smoke-po-venue', 'smoke-po-building', 'Smoke PO Noodle Stall', '1');
insert into dishes (id, venue_id, building_id, name, price, menu_approved_for_display, menu_rights_status)
values ('smoke-po-dish', 'smoke-po-venue', 'smoke-po-building', 'Smoke PO Wanton Mee', 4.5, true, 'operator_owned');

insert into auth.users (id, email)
values ('00000000-0000-1114-b000-000000000001', 'photo-optional-smoke-1@example.test')
on conflict (id) do nothing;
insert into user_profiles (id, display_name)
values ('00000000-0000-1114-b000-000000000001', 'Photo Optional Smoke')
on conflict (id) do nothing;

-- A photo for the retry in 1, stored and answered clear.
insert into storage.objects (bucket_id, name, owner, metadata)
values ('review-media', '00000000-0000-1114-b000-000000000001/r1/a.jpg',
        '00000000-0000-1114-b000-000000000001', '{"mimetype": "image/jpeg", "size": 1000}');
select public.record_photo_safety_checks(
  '00000000-0000-1114-b000-000000000001', 'review-media',
  '[{"path": "00000000-0000-1114-b000-000000000001/r1/a.jpg", "status": "clear"}]'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1114-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_result jsonb;
  v_refused boolean := false;
begin
  -- 1. A review with no photo.
  v_result := public.submit_review(
    '{"id":"aaaaaaaa-1114-4000-8000-000000000001","dish_id":"smoke-po-dish","venue_id":"smoke-po-venue","rating":4,"text":"Springy noodles","tags":[]}'::jsonb,
    '[]'::jsonb
  );
  if (v_result ->> 'photos_added')::integer <> 0 then
    raise exception 'a review with no photo reported photos added: %', v_result;
  end if;
  if not exists (select 1 from public.reviews where id = 'aaaaaaaa-1114-4000-8000-000000000001') then
    raise exception 'a review with no photo was not saved';
  end if;
  if exists (select 1 from public.review_photos where review_id = 'aaaaaaaa-1114-4000-8000-000000000001') then
    raise exception 'a review with no photo has photo rows';
  end if;

  -- A retry of the same review with a photo resumes it and adds the photo.
  v_result := public.submit_review(
    '{"id":"aaaaaaaa-1114-4000-8000-000000000001","dish_id":"smoke-po-dish","venue_id":"smoke-po-venue","rating":4,"text":"Springy noodles","tags":[]}'::jsonb,
    '[{"storage_path":"00000000-0000-1114-b000-000000000001/r1/a.jpg"}]'::jsonb
  );
  if not (v_result ->> 'resumed')::boolean or (v_result ->> 'photos_added')::integer <> 1 then
    raise exception 'a retry did not add the photo to the photo-less review: %', v_result;
  end if;
  if (select count(*) from public.reviews where id = 'aaaaaaaa-1114-4000-8000-000000000001') <> 1 then
    raise exception 'a retry made a second review';
  end if;

  -- 2. A post with no media.
  v_result := public.publish_post(
    jsonb_build_object(
      'id', '00000000-0000-1114-c000-000000000001', 'caption', 'no photo today',
      'venue_id', 'smoke-po-venue', 'dish_id', 'smoke-po-dish'
    ),
    '[]'::jsonb
  );
  if not exists (
    select 1 from public.posts
    where id = '00000000-0000-1114-c000-000000000001'
      and status = 'published' and post_type = 'text'
  ) then
    raise exception 'a post with no media was not published as a text post';
  end if;
  if exists (select 1 from public.post_media where post_id = '00000000-0000-1114-c000-000000000001') then
    raise exception 'a post with no media has media rows';
  end if;

  -- 3. A review and its portfolio entry, neither with a photo.
  v_result := public.submit_review(
    '{"id":"aaaaaaaa-1114-4000-8000-000000000002","dish_id":"smoke-po-dish","venue_id":"smoke-po-venue","rating":5,"text":"Best in the west","tags":[]}'::jsonb,
    '[]'::jsonb,
    '{"post":{"id":"00000000-0000-1114-c000-000000000002","caption":"Best in the west"},"media":[]}'::jsonb
  );
  if (v_result ->> 'post_id') is distinct from '00000000-0000-1114-c000-000000000002' then
    raise exception 'the photo-less review made no portfolio entry: %', v_result;
  end if;
  if not exists (
    select 1 from public.posts
    where id = '00000000-0000-1114-c000-000000000002'
      and review_id = 'aaaaaaaa-1114-4000-8000-000000000002'
      and post_type = 'text' and status = 'published'
  ) then
    raise exception 'the photo-less portfolio entry is not a published text post linked to its review';
  end if;

  -- 4. Photos sent are still checked: one outside the caller's folder is refused.
  begin
    perform public.submit_review(
      '{"id":"aaaaaaaa-1114-4000-8000-000000000003","dish_id":"smoke-po-dish","venue_id":"smoke-po-venue","rating":3,"text":"Fine","tags":[]}'::jsonb,
      '[{"storage_path":"00000000-0000-1114-b000-000000000002/x/a.jpg"}]'::jsonb
    );
  exception when sqlstate '42501' then
    v_refused := true;
  end;
  if not v_refused then
    raise exception 'submit_review accepted a photo outside the caller''s folder';
  end if;
  if exists (select 1 from public.reviews where id = 'aaaaaaaa-1114-4000-8000-000000000003') then
    raise exception 'a refused review was left behind';
  end if;
end $$;

select 'photo_optional_smoke_passed' as result;

rollback;
