-- Removes every test diner of scripts/seed/staging-test-activity.seed.sql and what they made, and puts
-- the dish ratings and the boards back as they were without them. STAGING ONLY (run it through
-- scripts/seed/staging-test-activity.sh). The test diners are the accounts whose email ends
-- @internal.hungry.test; nothing else is touched. Safe to run when there are none.

\set ON_ERROR_STOP on
begin;

create temporary table seed_ids on commit drop as
select id from auth.users where email like '%@internal.hungry.test'
union
select id from user_profiles where email like '%@internal.hungry.test';

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

-- Standings are rebuilt from what is left.
select app_private.refresh_leaderboards();

select count(*) as test_diners_left from auth.users where email like '%@internal.hungry.test';

commit;
