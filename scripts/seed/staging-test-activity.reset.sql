-- Removes every test diner of scripts/seed/staging-test-activity.seed.sql and what they made, and puts
-- the dish ratings and the boards back as they were without them. STAGING ONLY (run it through
-- scripts/seed/staging-test-activity.sh). The test diners are the accounts whose email ends
-- @internal.hungry.test; nothing else is touched. Safe to run when there are none.

\set ON_ERROR_STOP on
-- No begin/commit here: run it with `psql -1` (the wrapper does).

create temporary table seed_ids on commit drop as
select id from auth.users where email like '%@internal.hungry.test'
union
select id from user_profiles where email like '%@internal.hungry.test';

-- What the reviewed dishes held before the seed (kept by the seed with the first diner).
create temporary table seed_dish_restore on commit drop as
select e.key as dish_id, (e.value ->> 'rating_avg')::numeric as rating_avg, (e.value ->> 'review_count')::integer as review_count
from auth.users u
cross join lateral jsonb_each(coalesce(u.raw_user_meta_data -> 'dish_ratings_before', '{}'::jsonb)) e
where u.id in (select id from seed_ids);

-- Rows with no foreign key to the profile. The rest go with the profile (on delete cascade).
delete from reviews where user_id in (select id from seed_ids);
delete from user_favourite_dishes where user_id in (select id from seed_ids);
delete from user_taste_vectors where user_id in (select id from seed_ids);
delete from quiz_responses where user_id in (select id from seed_ids);
delete from taste_interaction_events where user_id in (select id from seed_ids);
delete from recommendation_impressions where user_id in (select id from seed_ids);
delete from bite_reactions where user_id in (select id from seed_ids);
delete from bites where author_id in (select id from seed_ids);
delete from user_blocks where blocker_id in (select id from seed_ids);

delete from user_profiles where id in (select id from seed_ids);
delete from auth.users where id in (select id from seed_ids);

-- Deleting the reviews recomputed each dish from the reviews left. A dish with none left goes back
-- to what it held before; a dish a real diner has reviewed keeps the recomputed value, as in the app.
update dishes d
set rating_avg = r.rating_avg, review_count = r.review_count
from seed_dish_restore r
where d.id = r.dish_id and not exists (select 1 from reviews x where x.dish_id = d.id);

-- Standings are rebuilt from what is left, but only when there was something to remove: a reset
-- with no test diners changes nothing at all.
do $$
begin
  if exists (select 1 from seed_ids) then
    perform app_private.refresh_leaderboards();
  end if;
end $$;

select count(*) as test_diners_left from auth.users where email like '%@internal.hungry.test';
