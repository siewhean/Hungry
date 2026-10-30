-- Smoke checks for 20261030120000_reviews_server_side.sql.
-- submit_review refuses a review with no photo and rolls the review back with it, keeps the photo
-- thumbnail path, resumes the same review on a retry (one review, one set of photos), and refuses a
-- photo path under another user. get_review_feed_page and search_reviews return the dish, stall,
-- photo paths and cursor in one call. A review cannot be reported by its author, and a taste
-- rating goes with its review. Runs in a transaction and rolls back. Brings its own building, so it
-- runs on prod (no seed data) as well as staging.
--   users: 00000000-0000-004a-b000-000000000001 (author), ...0002 (another diner)

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-rv-building', 'Smoke RV Building', 'hawker_centre', 1.2803, 103.8448);

insert into venues (id, building_id, name, floor)
values ('smoke-rv-venue', 'smoke-rv-building', 'Smoke RV Laksa Stall', '1');

insert into dishes (id, venue_id, building_id, name, price)
values ('smoke-rv-dish', 'smoke-rv-venue', 'smoke-rv-building', 'Smoke RV Curry Laksa', 5.5);

insert into user_profiles (id, display_name)
values
  ('00000000-0000-004a-b000-000000000001', 'RV Smoke Author'),
  ('00000000-0000-004a-b000-000000000002', 'RV Smoke Reader')
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-004a-b000-000000000001', true);
set local role authenticated;

-- No photo: refused, and no review is left behind.
do $$
begin
  begin
    perform public.submit_review(
      '{"id":"aaaaaaaa-004a-4000-8000-000000000001","dish_id":"smoke-rv-dish","venue_id":"smoke-rv-venue","rating":4,"text":"Rich gravy","tags":["Rich"]}'::jsonb,
      '[]'::jsonb
    );
    raise exception 'submit_review should refuse a review with no photo';
  exception when sqlstate '23514' then
    null;
  end;
  if exists (select 1 from public.reviews where id = 'aaaaaaaa-004a-4000-8000-000000000001') then
    raise exception 'a refused review must not be left behind';
  end if;
end $$;

-- A photo under someone else's folder: refused.
do $$
begin
  begin
    perform public.submit_review(
      '{"id":"aaaaaaaa-004a-4000-8000-000000000002","dish_id":"smoke-rv-dish","venue_id":"smoke-rv-venue","rating":4,"text":"Nice","tags":[]}'::jsonb,
      '[{"storage_path":"00000000-0000-004a-b000-000000000002/x/photo-0.jpg"}]'::jsonb
    );
    raise exception 'submit_review should refuse a photo path that is not the caller''s';
  exception when sqlstate '42501' then
    null;
  end;
end $$;

-- One photo with a thumbnail: published in one call.
select public.submit_review(
  '{"id":"aaaaaaaa-004a-4000-8000-000000000003","dish_id":"smoke-rv-dish","venue_id":"smoke-rv-venue","rating":5,"text":"Best laksa in the smoke test","tags":["Rich","Spicy"],"would_recommend":true}'::jsonb,
  '[{"storage_path":"00000000-0000-004a-b000-000000000001/aaaaaaaa/photo-0-a.jpg","thumb_path":"00000000-0000-004a-b000-000000000001/aaaaaaaa/photo-0-a.thumb.jpg"}]'::jsonb
);

-- The same review id again (a retry): still one review and one photo row.
do $$
declare
  v_result jsonb;
begin
  v_result := public.submit_review(
    '{"id":"aaaaaaaa-004a-4000-8000-000000000003","dish_id":"smoke-rv-dish","venue_id":"smoke-rv-venue","rating":5,"text":"Best laksa in the smoke test","tags":["Rich","Spicy"],"would_recommend":true}'::jsonb,
    '[{"storage_path":"00000000-0000-004a-b000-000000000001/aaaaaaaa/photo-0-b.jpg"}]'::jsonb
  );
  if (v_result ->> 'resumed')::boolean is not true then
    raise exception 'a retry should resume the same review';
  end if;
  if (select count(*) from public.reviews where id = 'aaaaaaaa-004a-4000-8000-000000000003') <> 1 then
    raise exception 'a retry must not create a second review';
  end if;
  if (select count(*) from public.review_photos where review_id = 'aaaaaaaa-004a-4000-8000-000000000003') <> 1 then
    raise exception 'a retry must not add the photos twice';
  end if;
  if (select thumb_path from public.review_photos where review_id = 'aaaaaaaa-004a-4000-8000-000000000003')
       is distinct from '00000000-0000-004a-b000-000000000001/aaaaaaaa/photo-0-a.thumb.jpg' then
    raise exception 'the thumbnail path should be stored with the photo';
  end if;
end $$;

reset role;

-- A guest reads the feed page: dish, stall, author and photo paths come back in one call.
set local role anon;

do $$
declare
  v_page jsonb;
  v_entry jsonb;
begin
  v_page := public.get_review_feed_page(10, null, null, null, 'smoke-rv-venue', null, true);
  if jsonb_array_length(v_page -> 'entries') <> 1 then
    raise exception 'the stall feed should hold the one smoke review, got %', v_page;
  end if;
  v_entry := (v_page -> 'entries') -> 0;
  if v_entry ->> 'dish_name' is distinct from 'Smoke RV Curry Laksa'
     or v_entry ->> 'venue_name' is distinct from 'Smoke RV Laksa Stall' then
    raise exception 'the entry should carry dish and stall names, got %', v_entry;
  end if;
  if (v_entry -> 'photos' -> 0 ->> 'thumb_path') is null then
    raise exception 'the entry should carry the thumbnail path, got %', v_entry;
  end if;
  if (v_page ->> 'has_more')::boolean is not false or (v_page -> 'next_cursor') is null then
    raise exception 'a one-review page has no more pages but still has a cursor, got %', v_page;
  end if;
  -- Paging past the only review returns nothing.
  v_page := public.get_review_feed_page(
    10, (v_page -> 'next_cursor' ->> 'before')::timestamptz, (v_page -> 'next_cursor' ->> 'before_id')::uuid,
    null, 'smoke-rv-venue', null, true
  );
  if jsonb_array_length(v_page -> 'entries') <> 0 then
    raise exception 'the page after the last review should be empty, got %', v_page;
  end if;
end $$;

-- Search finds it by dish name, stall name, text and taste tag, and not by something unrelated.
do $$
begin
  if jsonb_array_length(public.search_reviews('curry laksa') -> 'entries') < 1 then
    raise exception 'search should find a review by dish name';
  end if;
  if jsonb_array_length(public.search_reviews('RV Laksa Stall') -> 'entries') < 1 then
    raise exception 'search should find a review by stall name';
  end if;
  if jsonb_array_length(public.search_reviews('best laksa in the smoke') -> 'entries') < 1 then
    raise exception 'search should find a review by its text';
  end if;
  if jsonb_array_length(public.search_reviews('spicy') -> 'entries') < 1 then
    raise exception 'search should find a review by taste tag';
  end if;
  if jsonb_array_length(public.search_reviews('zzzzqqqq') -> 'entries') <> 0 then
    raise exception 'search should find nothing for gibberish';
  end if;
  if jsonb_array_length(public.search_reviews('a') -> 'entries') <> 0 then
    raise exception 'a one-letter search should return nothing';
  end if;
end $$;

reset role;

-- The author cannot report their own review (even straight into the table).
do $$
begin
  begin
    insert into content_reports (reporter_id, target_type, target_id, reason, status)
    values (
      '00000000-0000-004a-b000-000000000001', 'review',
      'aaaaaaaa-004a-4000-8000-000000000003', 'spam', 'open'
    );
    raise exception 'a report of the reporter''s own review should be refused';
  exception when sqlstate '42501' then
    null;
  end;
  -- Another diner can.
  insert into content_reports (reporter_id, target_type, target_id, reason, status)
  values (
    '00000000-0000-004a-b000-000000000002', 'review',
    'aaaaaaaa-004a-4000-8000-000000000003', 'spam', 'open'
  );
end $$;

-- A taste rating written with the review goes when the review goes.
select set_config('request.jwt.claim.sub', '00000000-0000-004a-b000-000000000001', true);
set local role authenticated;
select public.submit_dish_taste_rating(
  'smoke-rv-dish', '{"spicy": 6}'::jsonb, 'aaaaaaaa-004a-4000-8000-000000000003'
);
reset role;

do $$
begin
  if not exists (select 1 from public.dish_taste_ratings where review_id = 'aaaaaaaa-004a-4000-8000-000000000003') then
    raise exception 'the taste rating should be linked to the review';
  end if;
  delete from public.reviews where id = 'aaaaaaaa-004a-4000-8000-000000000003';
  if exists (select 1 from public.dish_taste_ratings where dish_id = 'smoke-rv-dish') then
    raise exception 'deleting the review should delete its taste rating';
  end if;
end $$;

select 'reviews_server_side_smoke_passed' as result;

rollback;
