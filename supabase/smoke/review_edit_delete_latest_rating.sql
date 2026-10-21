-- Smoke checks for 20261021161000_review_edit_delete_latest_rating.sql (H33, H35).
-- A diner's own insert, edit and delete update the dish totals; only each
-- reviewer's latest review counts; authors cannot change identity fields.
-- Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   author A: 00000000-0000-0d33-b000-000000000001
--   author B: 00000000-0000-0d33-b000-000000000002
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0d33-b000-000000000001', 'Edit Smoke A'),
  ('00000000-0000-0d33-b000-000000000002', 'Edit Smoke B')
on conflict (id) do nothing;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values (
  'review-edit-smoke-building', 'review-edit-smoke-building',
  'Review Edit Smoke Building', 'hawker_centre', 1.3003, 103.8003, array['01']
)
on conflict (id) do nothing;

insert into venues (id, building_id, name, unit_number, floor, operating_hours)
values (
  'review-edit-smoke-venue', 'review-edit-smoke-building',
  'Review Edit Smoke Venue', '#01-03', '01', 'Mon-Sun 9am-9pm'
)
on conflict (id) do nothing;

insert into dishes (
  id, venue_id, building_id, name, distance_meters, rating_avg, review_count,
  price, price_range, menu_approved_for_display, menu_rights_status, menu_source_url,
  updated_at
)
values (
  'review-edit-smoke-dish', 'review-edit-smoke-venue', 'review-edit-smoke-building',
  'Smoke Edit Laksa', 50, 0, 0, 5.00, '$5', true, 'merchant_owned',
  'https://merchant.example/menu', '2026-01-01T00:00:00Z'
)
on conflict (id) do nothing;

do $$
begin
  if not (select p.prosecdef from pg_proc p
          where p.oid = 'app_private.sync_dish_review_stats()'::regprocedure) then
    raise exception 'sync_dish_review_stats must be security definer';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.reviews'::regclass
      and t.tgname = 'trg_update_dish_rating'
      and t.tgfoid = 'app_private.sync_dish_review_stats()'::regprocedure
  ) then
    raise exception 'trg_update_dish_rating must call app_private.sync_dish_review_stats()';
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- A: an older 1-star and a newer 5-star review of the same dish.
select set_config('request.jwt.claim.sub', '00000000-0000-0d33-b000-000000000001', true);
insert into reviews (id, user_id, dish_id, rating, text, created_at)
values
  ('00000000-0000-0d33-e000-000000000001', '00000000-0000-0d33-b000-000000000001',
   'review-edit-smoke-dish', 1, 'First try', now() - interval '1 day'),
  ('00000000-0000-0d33-e000-000000000002', '00000000-0000-0d33-b000-000000000001',
   'review-edit-smoke-dish', 5, 'Much better now', now());

reset role;
do $$
begin
  if (select review_count from dishes where id = 'review-edit-smoke-dish') <> 1
    or (select rating_avg from dishes where id = 'review-edit-smoke-dish') <> 5 then
    raise exception 'Only the latest review per reviewer should count (expected 1 / 5.00)';
  end if;
end $$;

-- B: one 3-star review.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0d33-b000-000000000002', true);
insert into reviews (id, user_id, dish_id, rating, text)
values ('00000000-0000-0d33-e000-000000000003', '00000000-0000-0d33-b000-000000000002',
        'review-edit-smoke-dish', 3, 'Okay');

-- B cannot edit A's review (RLS: 0 rows).
update reviews set rating = 1 where id = '00000000-0000-0d33-e000-000000000002';

reset role;
do $$
begin
  if (select rating from reviews where id = '00000000-0000-0d33-e000-000000000002') <> 5 then
    raise exception 'Another user must not edit the review';
  end if;
  if (select review_count from dishes where id = 'review-edit-smoke-dish') <> 2
    or (select rating_avg from dishes where id = 'review-edit-smoke-dish') <> 4 then
    raise exception 'Two reviewers (5, 3) should give 2 / 4.00';
  end if;
end $$;

-- A edits their latest review.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0d33-b000-000000000001', true);
update reviews
set rating = 4, text = 'Good, not great', tags = array['rich'], would_recommend = true
where id = '00000000-0000-0d33-e000-000000000002';

-- A cannot change identity fields.
do $$
begin
  begin
    update reviews set author_name = 'Hungry Team'
    where id = '00000000-0000-0d33-e000-000000000002';
    raise exception 'author_name change should be refused';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update reviews set created_at = now() + interval '1 day'
    where id = '00000000-0000-0d33-e000-000000000001';
    raise exception 'created_at change should be refused';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$
begin
  if (select rating_avg from dishes where id = 'review-edit-smoke-dish') <> 3.5 then
    raise exception 'Edited rating (4, 3) should give 3.50';
  end if;
end $$;

-- A deletes their latest review: their older one counts again.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0d33-b000-000000000001', true);
delete from reviews where id = '00000000-0000-0d33-e000-000000000002';

reset role;
do $$
begin
  if exists (select 1 from reviews where id = '00000000-0000-0d33-e000-000000000002') then
    raise exception 'Author delete should remove the review';
  end if;
  if (select review_count from dishes where id = 'review-edit-smoke-dish') <> 2
    or (select rating_avg from dishes where id = 'review-edit-smoke-dish') <> 2 then
    raise exception 'After delete, A''s older review (1) and B (3) should give 2 / 2.00';
  end if;
end $$;

-- A deletes the older review too: only B counts.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0d33-b000-000000000001', true);
delete from reviews where id = '00000000-0000-0d33-e000-000000000001';

reset role;
do $$
begin
  if (select review_count from dishes where id = 'review-edit-smoke-dish') <> 1
    or (select rating_avg from dishes where id = 'review-edit-smoke-dish') <> 3 then
    raise exception 'A deleted review must stop counting (expected 1 / 3.00)';
  end if;
  -- Rating totals are not catalogue edits.
  if (select updated_at from dishes where id = 'review-edit-smoke-dish')
    <> '2026-01-01T00:00:00Z'::timestamptz then
    raise exception 'Review activity must not bump dishes.updated_at';
  end if;
end $$;

select 'review_edit_delete_latest_rating_smoke_passed' as result;

rollback;
