-- Test activity for STAGING (build plan package 3.2). Run through scripts/seed/staging-test-activity.sh,
-- which refuses every project but staging and clears the old test activity first.
--
-- 20 labelled accounts, "Test Diner 01" to "Test Diner 20" (email test-diner-NN@internal.hungry.test,
-- auth metadata {"internal": true}). Everything they do goes through the app's own functions where one
-- exists (reviews, taste ratings, Tried, text posts), so the same triggers, board credit and counters
-- run as for a diner. Nothing here writes a dish, a stall, a price, a photo or a menu: the diners act on
-- the dishes and stalls already in the catalog (the launch zone first; any displayable dish tops it up).
--
--   saves        about 6 to 10 dishes each (the Saved tab), and stalls (7 each on the 86-stall zone)
--   quick logs   Tried on 6 to 12 dishes each, and 3 to 6 stalls
--   ratings      3 to 6 taste ratings each, on the most popular 30 dishes
--   reviews      Diners 01 to 12 write 2 to 4 written reviews each, spread over the last 12 days; half
--                of them also put the review on their portfolio as a text entry (no photo)
--   follows      each diner follows 3 to 7 others, and likes or saves their text entries
--
-- Every choice comes from hashtextextended(), so a rerun picks the same dishes and a fresh staging
-- gets the same picture. The marker is the email domain: any count of real diners must leave out
-- email like '%@internal.hungry.test' (tasks/environment.md).
--
-- Not covered on purpose: the Active board pays only for posts with a photo, and no photo is made up.
-- The Trending board, the Passport and Home's Fresh reviews fill from what is here.

\set ON_ERROR_STOP on
-- No begin/commit here: run it with `psql -1` (the wrapper does), so a reset and this seed are one unit.

do $$
begin
  if to_regclass('public.launch_zone_places') is null then
    raise exception 'launch_zone_places is missing: apply 20261116130000_launch_zone on this project first';
  end if;
  if exists (select 1 from auth.users where email like '%@internal.hungry.test') then
    raise exception 'test diners already exist: run staging-test-activity.sh reset first';
  end if;
end $$;

-- 1. The diners.
create temporary table seed_diners on commit drop as
select g as n,
       ('00000000-0000-1119-d000-' || lpad(g::text, 12, '0'))::uuid as id,
       'test-diner-' || lpad(g::text, 2, '0') || '@internal.hungry.test' as email,
       'Test Diner ' || lpad(g::text, 2, '0') as name,
       now() - ((21 + g) || ' days')::interval as joined_at   -- all older than the board's 7 days
from generate_series(1, 20) g;

insert into auth.users (id, email, raw_user_meta_data, created_at)
select id, email, jsonb_build_object('internal', true, 'seed', 'staging-test-activity', 'name', name), joined_at
from seed_diners;

insert into user_profiles (id, display_name, email, created_at)
select id, name, email, joined_at from seed_diners
on conflict (id) do update set display_name = excluded.display_name, created_at = excluded.created_at;

-- 2. What they can act on: displayable dishes and stalls, the launch zone first.
create temporary table seed_dish_pool on commit drop as
with zone as (
  select d.id, d.venue_id, d.name, true as in_zone
  from dishes d
  join venues v on v.id = d.venue_id
  join launch_zone_places z on z.building_id = v.building_id
  where d.archived_at is null and not d.merchant_draft
    and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
), other as (
  select d.id, d.venue_id, d.name, false as in_zone
  from dishes d
  where d.archived_at is null and not d.merchant_draft
    and catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
    and d.id not in (select id from zone)
  order by hashtextextended(d.id, 7)
  limit greatest(0, 60 - (select count(*) from zone))
), both_sets as (
  select * from zone union all select * from other
)
select row_number() over (order by hashtextextended(id, 11)) as rank, id as dish_id, venue_id, name, in_zone
from both_sets;

create temporary table seed_stall_pool on commit drop as
with zone as (
  select v.id from venues v join launch_zone_places z on z.building_id = v.building_id
), other as (
  select v.id from venues v
  where v.id not in (select id from zone)
  order by hashtextextended(v.id, 13)
  limit greatest(0, 30 - (select count(*) from zone))
)
select row_number() over (order by hashtextextended(id, 17)) as rank, id as venue_id
from (select id from zone union all select id from other) s;

do $$
declare
  v_dishes integer := (select count(*) from seed_dish_pool);
  v_zone_dishes integer := (select count(*) from seed_dish_pool where in_zone);
  v_stalls integer := (select count(*) from seed_stall_pool);
begin
  if v_dishes < 12 or v_stalls < 8 then
    raise exception 'not enough catalog to act on: % dishes, % stalls (need 12 and 8)', v_dishes, v_stalls;
  end if;
  raise notice 'acting on % dishes (% in the launch zone) and % stalls', v_dishes, v_zone_dishes, v_stalls;
end $$;

-- 3. Saved and tried stalls (Passport, Saved tab). Written the way the app writes them: one row per
-- stall; the triggers on user_stall_interactions record the stall history.
insert into user_stall_interactions (user_id, stall_id, is_saved, is_tried, saved_at, tried_at)
select d.id, s.venue_id,
       h.saved, h.tried,
       case when h.saved then now() - ((hashtextextended(d.id::text || s.venue_id, 3) & 1023) % 14 + 1 || ' days')::interval end,
       case when h.tried then now() - ((hashtextextended(d.id::text || s.venue_id, 4) & 1023) % 14 + 1 || ' days')::interval end
from seed_diners d
join seed_stall_pool s on true
cross join lateral (
  select ((hashtextextended(d.id::text || s.venue_id, 1) & 1023) % 100) < least(60, 700 / (select count(*) from seed_stall_pool)) as saved,
         ((hashtextextended(d.id::text || s.venue_id, 2) & 1023) % 100) < least(40, 450 / (select count(*) from seed_stall_pool)) as tried
) h
where h.saved or h.tried;

-- 4. Saved dishes (the Saved tab). The popular 30 dishes are saved more often.
insert into user_favourite_dishes (user_id, dish_id, created_at)
select d.id, p.dish_id, now() - ((hashtextextended(d.id::text || p.dish_id, 6) & 1023) % 14 + 1 || ' days')::interval
from seed_diners d
join seed_dish_pool p on true
where ((hashtextextended(d.id::text || p.dish_id, 5) & 1023) % 100) < case when p.rank <= 30 then 22 else 2 end;

-- 5. The plan of what each diner does through the app's functions.
create temporary table seed_plan (
  step integer generated always as identity,
  diner_id uuid not null,
  kind text not null,          -- tried | rating | review
  dish_id text not null,
  venue_id text,
  payload jsonb,
  age_days numeric
) on commit drop;

-- Tried: 6 to 12 dishes each, the popular ones more often.
insert into seed_plan (diner_id, kind, dish_id, venue_id)
select d.id, 'tried', p.dish_id, p.venue_id
from seed_diners d
join lateral (
  select p.* from seed_dish_pool p
  order by (p.rank > 30), hashtextextended(d.id::text || p.dish_id, 21)
  limit 6 + (d.n % 7)
) p on true;

-- Taste ratings: 3 to 6 each on the popular 30, two or three axes each (spicy, rich, sweet, salty, sour).
insert into seed_plan (diner_id, kind, dish_id, payload)
select d.id, 'rating', p.dish_id,
       jsonb_strip_nulls(jsonb_build_object(
         'spicy',  case when (h & 3) <> 0 then 1 + ((h >> 4) & 255) % 9 end,
         'rich',   case when (h & 4) <> 0 then 1 + ((h >> 12) & 255) % 9 end,
         'sweet',  case when (h & 8) <> 0 then 1 + ((h >> 20) & 255) % 9 end,
         'salty',  case when (h & 16) <> 0 then 1 + ((h >> 28) & 255) % 9 end,
         'sour',   case when (h & 32) <> 0 then 1 + ((h >> 36) & 255) % 9 end
       ) || jsonb_build_object('rich', 1 + ((h >> 12) & 255) % 9))
from seed_diners d
join lateral (
  select p.dish_id, abs(hashtextextended(d.id::text || p.dish_id, 31)) as h
  from seed_dish_pool p where p.rank <= 30
  order by hashtextextended(d.id::text || p.dish_id, 33)
  limit 3 + (d.n % 4)
) p on true;

-- Written reviews: Diners 01 to 12, 2 to 4 each, on the popular 30, over the last 12 days.
create temporary table seed_review_text (i integer primary key, body text) on commit drop;
insert into seed_review_text values
  (0, 'Solid and filling. I would order this again.'),
  (1, 'Came out fast and hot. Good for a quick lunch.'),
  (2, 'Decent, though I would ask for less oil next time.'),
  (3, 'Flavour was balanced and the portion fair for the price.'),
  (4, 'Better than I expected. Worth queuing for at lunch.'),
  (5, 'Not my favourite, but fine when nothing else is open.'),
  (6, 'Really enjoyed this one. Brought a friend back the next day.'),
  (7, 'Good value. The sauce made the dish.'),
  (8, 'A little salty for me, otherwise a good meal.'),
  (9, 'Reliable. It tastes the same every time I come.'),
  (10, 'Generous serving and friendly service.'),
  (11, 'Tasty, and nothing like what I had before. Would recommend.');

insert into seed_plan (diner_id, kind, dish_id, venue_id, payload, age_days)
select d.id, 'review', p.dish_id, p.venue_id,
       jsonb_build_object(
         'id', md5('seed-review:' || d.id::text || p.dish_id)::uuid,
         'rating', (array[3, 3.5, 4, 4, 4.5, 4.5, 5, 2.5])[1 + (abs(hashtextextended(d.id::text || p.dish_id, 41)) % 8)],
         'text', (select body from seed_review_text where i = abs(hashtextextended(d.id::text || p.dish_id, 42)) % 12),
         'with_entry', (abs(hashtextextended(d.id::text || p.dish_id, 43)) % 2) = 0
       ),
       (abs(hashtextextended(d.id::text || p.dish_id, 44)) % 12) + 0.25
from seed_diners d
join lateral (
  select p.* from seed_dish_pool p where p.rank <= 30
  order by hashtextextended(d.id::text || p.dish_id, 45)
  limit 2 + (d.n % 3)
) p on true
where d.n <= 12;

-- A review recomputes its dish's rating_avg and review_count from the reviews. Keep what the reviewed
-- dishes held before, with the first diner, so the reset can put them back (see the reset file).
update auth.users u
set raw_user_meta_data = u.raw_user_meta_data || jsonb_build_object('dish_ratings_before', coalesce((
  select jsonb_object_agg(d.id, jsonb_build_object('rating_avg', d.rating_avg, 'review_count', d.review_count))
  from dishes d where d.id in (select p.dish_id from seed_plan p where p.kind = 'review')
), '{}'::jsonb))
where u.id = '00000000-0000-1119-d000-000000000001';

grant select on seed_plan to authenticated;

-- 6. Run the plan as each diner.
do $$
declare
  r record;
  v_result jsonb;
  v_text text;
begin
  for r in select * from seed_plan order by diner_id, step loop
    perform set_config('request.jwt.claim.sub', r.diner_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', r.diner_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    if r.kind = 'tried' then
      perform public.set_dish_tried(r.dish_id, true);
    elsif r.kind = 'rating' then
      perform public.submit_dish_taste_rating(r.dish_id, r.payload);
    else
      v_text := r.payload ->> 'text';
      v_result := public.submit_review(
        jsonb_build_object(
          'id', r.payload ->> 'id', 'dish_id', r.dish_id, 'venue_id', r.venue_id,
          'rating', (r.payload ->> 'rating')::numeric, 'text', v_text, 'tags', '[]'::jsonb
        ),
        '[]'::jsonb,
        case when (r.payload ->> 'with_entry')::boolean
             then jsonb_build_object(
                    'post', jsonb_build_object('id', md5('seed-post:' || (r.payload ->> 'id'))::uuid, 'caption', v_text),
                    'media', '[]'::jsonb) end
      );
    end if;
    execute 'reset role';
  end loop;
end $$;

-- 7. Date the reviews and entries over the last 12 days (a review is stamped when it is written, and
-- the review guard refuses any date change, so it is off for these two statements only; the table
-- change is part of this transaction and is undone with it if anything fails).
alter table public.reviews disable trigger trg_enforce_merchant_review_reply_update;

update reviews r
set created_at = now() - (p.age_days || ' days')::interval
from seed_plan p
where p.kind = 'review' and r.id = (p.payload ->> 'id')::uuid;

update posts po
set created_at = r.created_at, published_at = r.created_at, updated_at = r.created_at
from reviews r
where po.review_id = r.id and r.user_id in (select id from seed_diners);

alter table public.reviews enable trigger trg_enforce_merchant_review_reply_update;

-- 8. Follows, and likes and saves on each other's entries.
insert into follows (follower_id, followee_id, status, requested_at, approved_at)
select a.id, b.id, 'approved', now() - interval '10 days', now() - interval '10 days'
from seed_diners a
join seed_diners b on b.id <> a.id
where (abs(hashtextextended(a.id::text || b.id::text, 51)) % 100) < 25;

insert into post_likes (post_id, user_id, created_at)
select po.id, d.id, greatest(now() - interval '3 days', po.published_at)
from posts po
join seed_diners d on d.id <> po.author_id
where po.author_id in (select id from seed_diners) and po.status = 'published' and po.visibility = 'public'
  and (abs(hashtextextended(po.id::text || d.id::text, 61)) % 100) < 35;

insert into post_saves (post_id, user_id, created_at)
select po.id, d.id, greatest(now() - interval '3 days', po.published_at)
from posts po
join seed_diners d on d.id <> po.author_id
where po.author_id in (select id from seed_diners) and po.status = 'published' and po.visibility = 'public'
  and (abs(hashtextextended(po.id::text || d.id::text, 62)) % 100) < 15;

-- 9. Standings, so the boards show it now rather than at the next scheduled refresh.
select app_private.refresh_leaderboards();

select 'test diners' as what, count(*) as n from seed_diners
union all select 'saved dishes', count(*) from user_favourite_dishes where user_id in (select id from seed_diners)
union all select 'saved stalls', count(*) from user_stall_interactions where is_saved and user_id in (select id from seed_diners)
union all select 'tried stalls', count(*) from user_stall_interactions where is_tried and user_id in (select id from seed_diners)
union all select 'tried dishes', coalesce(sum(cardinality(reviewed_dish_ids)), 0) from user_profiles where id in (select id from seed_diners)
union all select 'taste ratings', count(*) from dish_taste_ratings where user_id in (select id from seed_diners)
union all select 'reviews', count(*) from reviews where user_id in (select id from seed_diners)
union all select 'text entries', count(*) from posts where author_id in (select id from seed_diners) and status = 'published'
union all select 'follows', count(*) from follows where follower_id in (select id from seed_diners)
union all select 'board rows', count(*) from leaderboard_standings where user_id in (select id from seed_diners);
