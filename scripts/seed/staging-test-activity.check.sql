-- Assertions on the test activity, run by scripts/seed/test-staging-test-activity.sh right after a seed
-- (against the local Postgres stand-in; never staging). Raises on the first thing that is wrong.
\set ON_ERROR_STOP on

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from auth.users
  where email like 'test-diner-__@internal.hungry.test' and (raw_user_meta_data ->> 'internal')::boolean;
  if v_n <> 20 then raise exception '% marked test diners, expected 20', v_n; end if;

  select count(*) into v_n from user_profiles
  where email like '%@internal.hungry.test' and display_name ~ '^Test Diner [0-9]{2}$' and created_at < now() - interval '7 days';
  if v_n <> 20 then raise exception '% labelled profiles older than 7 days, expected 20', v_n; end if;

  -- Every diner has something on each surface they feed.
  select count(*) into v_n from user_profiles up
  where up.email like '%@internal.hungry.test'
    and (not exists (select 1 from user_favourite_dishes f where f.user_id = up.id)
      or not exists (select 1 from user_stall_interactions s where s.user_id = up.id and s.is_saved)
      or not exists (select 1 from user_stall_interactions s where s.user_id = up.id and s.is_tried)
      or cardinality(up.reviewed_dish_ids) = 0
      or (select count(*) from dish_taste_ratings t where t.user_id = up.id) < 3);
  if v_n <> 0 then raise exception '% diners are missing saves, quick logs or ratings', v_n; end if;

  -- Diners 01 to 12 wrote 2 to 4 reviews each, with text, no photo, and their own label as author.
  select count(*) into v_n from (
    select r.user_id from reviews r join auth.users u on u.id = r.user_id
    where u.email like '%@internal.hungry.test' group by r.user_id having count(*) between 2 and 4
  ) x;
  if v_n <> 12 then raise exception '% diners with 2 to 4 reviews, expected 12', v_n; end if;
  if exists (select 1 from reviews r join auth.users u on u.id = r.user_id
             where u.email like '%@internal.hungry.test' and (btrim(r.text) = '' or r.author_name is distinct from u.raw_user_meta_data ->> 'name')) then
    raise exception 'a test review has no text or the wrong author name';
  end if;
  if exists (select 1 from review_photos p join reviews r on r.id = p.review_id join auth.users u on u.id = r.user_id
             where u.email like '%@internal.hungry.test') then
    raise exception 'a test review has a photo: none may be made up';
  end if;
  select count(distinct r.created_at::date) into v_n from reviews r join auth.users u on u.id = r.user_id
  where u.email like '%@internal.hungry.test';
  if v_n < 5 then raise exception 'reviews cover % days, expected them spread over the last 12', v_n; end if;
  if exists (select 1 from reviews r join auth.users u on u.id = r.user_id
             where u.email like '%@internal.hungry.test'
               and (r.created_at < now() - interval '12 days' or r.created_at > now() + interval '1 minute')) then
    raise exception 'a test review is dated outside the last 12 days';
  end if;

  -- The dish's own numbers moved with the reviews, as for a real review.
  if exists (
    select 1 from dishes d
    where d.id in (select r.dish_id from reviews r join auth.users u on u.id = r.user_id where u.email like '%@internal.hungry.test')
      and d.review_count <> (select count(*) from reviews r where r.dish_id = d.id)
  ) then raise exception 'a dish review_count does not match its reviews'; end if;

  -- Text entries have no photo, and the boards have the diners on them.
  if exists (select 1 from post_media m join posts p on p.id = m.post_id join auth.users u on u.id = p.author_id
             where u.email like '%@internal.hungry.test') then
    raise exception 'a test entry has media: none may be made up';
  end if;
  select count(*) into v_n from leaderboard_standings s join auth.users u on u.id = s.user_id
  where u.email like '%@internal.hungry.test';
  if v_n < 5 then raise exception 'only % test diners on the boards', v_n; end if;
  select count(*) into v_n from follows f join auth.users u on u.id = f.follower_id
  where u.email like '%@internal.hungry.test' and f.status = 'approved';
  if v_n < 40 then raise exception 'only % follows', v_n; end if;
end $$;

select 'staging test activity checks passed' as result;
