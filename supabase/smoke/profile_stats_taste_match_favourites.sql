-- Smoke checks for 20261028100000_profile_stats_taste_match_favourites.sql.
-- Review stats cover all of the caller's reviews and only theirs; the taste match is a score and
-- nothing else, empty for yourself, a blocked pair, a private stranger and a diner with no taste
-- yet; pinned dishes keep their order, are capped at four, must be saved or reviewed, and
-- follow the owner's privacy. Anon cannot call any of it. Brings its own building, so it runs on
-- prod (no seed data) as well as staging. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   reviewer:  00000000-0000-0071-b000-000000000001   (public, strong taste)
--   close:     00000000-0000-0071-b000-000000000002   (public, similar taste)
--   neutral:   00000000-0000-0071-b000-000000000003   (public, no taste yet)
--   private:   00000000-0000-0071-b000-000000000004   (private, similar taste)
--   blocked:   00000000-0000-0071-b000-000000000005   (public, similar taste, blocked by reviewer)
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0071-b000-000000000001', 'Smoke Reviewer'),
  ('00000000-0000-0071-b000-000000000002', 'Smoke Close'),
  ('00000000-0000-0071-b000-000000000003', 'Smoke Neutral'),
  ('00000000-0000-0071-b000-000000000004', 'Smoke Private'),
  ('00000000-0000-0071-b000-000000000005', 'Smoke Blocked')
on conflict (id) do nothing;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-0071-building', 'Smoke 0071 Building', 'hawker_centre', 1.2803, 103.8448);
insert into venues (id, building_id, name, floor)
values ('smoke-0071-venue', 'smoke-0071-building', 'Smoke 0071 Stall', '1');
insert into dishes (id, venue_id, building_id, name, price)
values
  ('smoke-0071-d1', 'smoke-0071-venue', 'smoke-0071-building', 'Smoke Dish 1', 4),
  ('smoke-0071-d2', 'smoke-0071-venue', 'smoke-0071-building', 'Smoke Dish 2', 4),
  ('smoke-0071-d3', 'smoke-0071-venue', 'smoke-0071-building', 'Smoke Dish 3', 4),
  ('smoke-0071-d4', 'smoke-0071-venue', 'smoke-0071-building', 'Smoke Dish 4', 4),
  ('smoke-0071-d5', 'smoke-0071-venue', 'smoke-0071-building', 'Smoke Dish 5', 4),
  ('smoke-0071-d6', 'smoke-0071-venue', 'smoke-0071-building', 'Smoke Dish 6', 4);

-- Tastes: reviewer sweet 9, spicy 2; close sweet 8, spicy 3 (mean gap 2/6); neutral all 5.
insert into user_taste_vectors (user_id, sweet, spicy, sour, salty, rich, aromatic)
values
  ('00000000-0000-0071-b000-000000000001', 9, 2, 5, 5, 5, 5),
  ('00000000-0000-0071-b000-000000000002', 8, 3, 5, 5, 5, 5),
  ('00000000-0000-0071-b000-000000000003', 5, 5, 5, 5, 5, 5),
  ('00000000-0000-0071-b000-000000000004', 8, 3, 5, 5, 5, 5),
  ('00000000-0000-0071-b000-000000000005', 8, 3, 5, 5, 5, 5)
on conflict (user_id) do update set
  sweet = excluded.sweet, spicy = excluded.spicy, sour = excluded.sour,
  salty = excluded.salty, rich = excluded.rich, aromatic = excluded.aromatic;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-0071-b000-000000000004', 'private')
on conflict (user_id) do update set account_visibility = excluded.account_visibility;

insert into user_blocks (blocker_id, blocked_user_key)
values ('00000000-0000-0071-b000-000000000001', '00000000-0000-0071-b000-000000000005');

-- Reviewer's reviews: 5, 4.5, 4, 2, 1 on five dishes; they saved d1, d2, d3 and d6.
insert into reviews (user_id, dish_id, author_name, rating, text)
values
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d1', 'Smoke Reviewer', 5, 'a'),
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d2', 'Smoke Reviewer', 4.5, 'b'),
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d3', 'Smoke Reviewer', 4, 'c'),
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d4', 'Smoke Reviewer', 2, 'd'),
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d5', 'Smoke Reviewer', 1, 'e');
insert into user_favourite_dishes (user_id, dish_id)
values
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d1'),
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d2'),
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d3'),
  ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d6');

-- The private owner saves a dish too, so their pins can be read once followed.
insert into user_favourite_dishes (user_id, dish_id)
values ('00000000-0000-0071-b000-000000000004', 'smoke-0071-d1');

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- Review stats ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000001', true);
do $$
declare
  v record;
begin
  select * into v from public.get_my_review_stats();
  if v.review_count <> 5 or v.average_rating is distinct from 3.3 then
    raise exception 'stats count/average wrong: % / %', v.review_count, v.average_rating;
  end if;
  if (v.rating_1, v.rating_2, v.rating_3, v.rating_4, v.rating_5) is distinct from (1, 1, 0, 1, 2) then
    raise exception 'histogram wrong: % % % % %', v.rating_1, v.rating_2, v.rating_3, v.rating_4, v.rating_5;
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000002', true);
do $$
declare
  v record;
begin
  select * into v from public.get_my_review_stats();
  if v.review_count <> 0 or v.average_rating is not null or v.rating_5 <> 0 then
    raise exception 'someone with no reviews must get zeros and no average';
  end if;
end $$;

-- Taste match ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000001', true);
do $$
begin
  -- gaps 1 and 1 -> sum 2 -> 100 - 100 * 2 / 36 = 94.4 -> 94
  if public.get_taste_match('00000000-0000-0071-b000-000000000002') is distinct from 94 then
    raise exception 'close taste should score 94, got %',
      public.get_taste_match('00000000-0000-0071-b000-000000000002');
  end if;
  if public.get_taste_match('00000000-0000-0071-b000-000000000001') is not null then
    raise exception 'no score against yourself';
  end if;
  if public.get_taste_match('00000000-0000-0071-b000-000000000003') is not null then
    raise exception 'no score against someone with no taste yet';
  end if;
  if public.get_taste_match('00000000-0000-0071-b000-000000000004') is not null then
    raise exception 'no score for a private account the viewer does not follow';
  end if;
  if public.get_taste_match('00000000-0000-0071-b000-000000000005') is not null then
    raise exception 'no score for a blocked pair';
  end if;
  if public.get_taste_match(null) is not null then
    raise exception 'a null id has no score';
  end if;
end $$;

-- The neutral diner has no taste yet either, in the other direction.
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000003', true);
do $$
begin
  if public.get_taste_match('00000000-0000-0071-b000-000000000001') is not null then
    raise exception 'a diner with no taste yet gets no score either';
  end if;
end $$;

-- Following the private account unlocks the score.
reset role;
insert into follows (follower_id, followee_id, status)
values ('00000000-0000-0071-b000-000000000001', '00000000-0000-0071-b000-000000000004', 'approved');
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000001', true);
do $$
begin
  if public.get_taste_match('00000000-0000-0071-b000-000000000004') is distinct from 94 then
    raise exception 'an approved follower should see the private account''s score';
  end if;
end $$;

-- Favourite dishes -----------------------------------------------------------------------
-- Order is kept, duplicates collapse, a reviewed-but-unsaved dish (d4) is allowed.
select public.set_profile_favourite_dishes(array['smoke-0071-d3', 'smoke-0071-d1', 'smoke-0071-d3', 'smoke-0071-d4']);
do $$
begin
  if (select array_agg(dish_id order by position) from public.profile_favourite_dishes
      where user_id = '00000000-0000-0071-b000-000000000001')
     is distinct from array['smoke-0071-d3', 'smoke-0071-d1', 'smoke-0071-d4'] then
    raise exception 'pins should keep order and drop the duplicate';
  end if;
end $$;

-- Replacing shrinks the set; an empty list clears it.
select public.set_profile_favourite_dishes(array['smoke-0071-d2']);
do $$
begin
  if (select count(*) from public.profile_favourite_dishes
      where user_id = '00000000-0000-0071-b000-000000000001') <> 1 then
    raise exception 'a new list replaces the old one';
  end if;
end $$;

do $$
begin
  perform public.set_profile_favourite_dishes(
    array['smoke-0071-d1', 'smoke-0071-d2', 'smoke-0071-d3', 'smoke-0071-d4', 'smoke-0071-d6']);
  raise exception 'five pins must be refused';
exception
  when invalid_parameter_value then null;
end $$;

do $$
begin
  -- d5 is reviewed; a dish nobody saved or reviewed is not: reuse a venue-less id check via d6 -> saved.
  -- Pinning a dish the caller neither saved nor reviewed must be refused.
  perform public.set_profile_favourite_dishes(array['smoke-0071-nope']);
  raise exception 'pinning a stranger dish must be refused';
exception
  when invalid_parameter_value then null;
end $$;

do $$
begin
  insert into public.profile_favourite_dishes (user_id, dish_id, position)
  values ('00000000-0000-0071-b000-000000000001', 'smoke-0071-d1', 2);
  raise exception 'clients must not write the table directly';
exception
  when insufficient_privilege then null;
end $$;

-- The owner pins from the saved dish on the private account too (as that owner).
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000004', true);
select public.set_profile_favourite_dishes(array['smoke-0071-d1']);

-- Reading: a stranger sees the public reviewer's pins but not the private owner's.
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000003', true);
do $$
begin
  if (select count(*) from public.profile_favourite_dishes
      where user_id = '00000000-0000-0071-b000-000000000001') <> 1 then
    raise exception 'a public account''s pins are readable by anyone';
  end if;
  if (select count(*) from public.profile_favourite_dishes
      where user_id = '00000000-0000-0071-b000-000000000004') <> 0 then
    raise exception 'a private account''s pins are hidden from a stranger';
  end if;
end $$;
-- The reviewer follows the private owner (above) and can read them.
select set_config('request.jwt.claim.sub', '00000000-0000-0071-b000-000000000001', true);
do $$
begin
  if (select count(*) from public.profile_favourite_dishes
      where user_id = '00000000-0000-0071-b000-000000000004') <> 1 then
    raise exception 'an approved follower reads the private account''s pins';
  end if;
end $$;

select public.set_profile_favourite_dishes('{}');
do $$
begin
  if exists (select 1 from public.profile_favourite_dishes
             where user_id = '00000000-0000-0071-b000-000000000001') then
    raise exception 'an empty list clears the pins';
  end if;
end $$;

-- Anon cannot call any of it -------------------------------------------------------------
reset role;
set local role anon;
do $$
begin
  perform public.get_my_review_stats();
  raise exception 'anon must not run get_my_review_stats';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.get_taste_match('00000000-0000-0071-b000-000000000001');
  raise exception 'anon must not run get_taste_match';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.set_profile_favourite_dishes('{}');
  raise exception 'anon must not run set_profile_favourite_dishes';
exception when insufficient_privilege then null;
end $$;

reset role;
do $$
begin
  if (select count(*) from app_private.request_rate_rules
      where route in ('rpc/get_my_review_stats', 'rpc/get_taste_match', 'rpc/set_profile_favourite_dishes')) <> 3 then
    raise exception 'all three RPCs need a rate rule';
  end if;
end $$;

rollback;
