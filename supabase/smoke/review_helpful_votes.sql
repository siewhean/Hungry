-- Smoke checks for 20261020110000_review_helpful_votes.sql.
-- A signed-in user marks another user's review helpful and un-marks it;
-- reviews.helpful_count follows. Authors cannot vote on their own review or
-- write helpful_count directly, voters read only their own votes, guests read
-- the count but not the votes, and the same author can review one dish twice
-- in a row (no repeat-review limit). Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   author:  00000000-0000-0045-b000-000000000001
--   voter:   00000000-0000-0045-b000-000000000002
--   other:   00000000-0000-0045-b000-000000000003
--   review:  00000000-0000-0045-e000-000000000001
--   repeats: 00000000-0000-0045-e000-00000000000{2,3}
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0045-b000-000000000001', 'Helpful Author'),
  ('00000000-0000-0045-b000-000000000002', 'Helpful Voter'),
  ('00000000-0000-0045-b000-000000000003', 'Helpful Other')
on conflict (id) do nothing;

-- Reuse an existing dish; never create catalog rows.
select set_config(
  'smoke.dish_id',
  (select d.id from dishes d where d.venue_id is not null order by d.id limit 1),
  true
);

do $$
begin
  if nullif(current_setting('smoke.dish_id', true), '') is null then
    raise exception 'Smoke needs at least one dish row with a venue';
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- The author reviews the same dish three times in a row: nothing blocks it.
select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000001', true);
insert into reviews (id, user_id, dish_id, author_name, rating, text)
values
  ('00000000-0000-0045-e000-000000000001', '00000000-0000-0045-b000-000000000001',
   current_setting('smoke.dish_id'), 'Helpful Author', 5, 'Helpful smoke review'),
  ('00000000-0000-0045-e000-000000000002', '00000000-0000-0045-b000-000000000001',
   current_setting('smoke.dish_id'), 'Helpful Author', 4, 'Helpful smoke repeat one'),
  ('00000000-0000-0045-e000-000000000003', '00000000-0000-0045-b000-000000000001',
   current_setting('smoke.dish_id'), 'Helpful Author', 4, 'Helpful smoke repeat two');

do $$
begin
  if (select count(*) from reviews
      where user_id = '00000000-0000-0045-b000-000000000001'
        and dish_id = current_setting('smoke.dish_id')) <> 3 then
    raise exception 'Repeat reviews of one dish should all be saved';
  end if;

  -- Authors cannot vote on their own review.
  begin
    insert into review_helpful_votes (review_id, user_id)
    values ('00000000-0000-0045-e000-000000000001', '00000000-0000-0045-b000-000000000001');
    raise exception 'Author should not mark their own review helpful';
  exception when insufficient_privilege then
    null;
  end;

  -- Authors cannot write helpful_count directly.
  begin
    update reviews set helpful_count = 99
    where id = '00000000-0000-0045-e000-000000000001';
    raise exception 'Author should not set helpful_count';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- The voter marks the review helpful.
select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000002', true);
insert into review_helpful_votes (review_id, user_id)
values ('00000000-0000-0045-e000-000000000001', '00000000-0000-0045-b000-000000000002');

do $$
begin
  if (select helpful_count from reviews where id = '00000000-0000-0045-e000-000000000001') <> 1 then
    raise exception 'helpful_count should be 1 after one vote';
  end if;

  -- A vote for someone else is refused.
  begin
    insert into review_helpful_votes (review_id, user_id)
    values ('00000000-0000-0045-e000-000000000002', '00000000-0000-0045-b000-000000000003');
    raise exception 'Voter should not vote as another user';
  exception when insufficient_privilege then
    null;
  end;

  -- A second vote by the same user is a duplicate.
  begin
    insert into review_helpful_votes (review_id, user_id)
    values ('00000000-0000-0045-e000-000000000001', '00000000-0000-0045-b000-000000000002');
    raise exception 'Duplicate helpful vote should be refused';
  exception when unique_violation then
    null;
  end;
end $$;

-- Another user votes too, then cannot see the first voter's row.
select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000003', true);
insert into review_helpful_votes (review_id, user_id)
values ('00000000-0000-0045-e000-000000000001', '00000000-0000-0045-b000-000000000003');

do $$
begin
  if (select helpful_count from reviews where id = '00000000-0000-0045-e000-000000000001') <> 2 then
    raise exception 'helpful_count should be 2 after two votes';
  end if;
  if (select count(*) from review_helpful_votes) <> 1 then
    raise exception 'A voter should read only their own helpful votes';
  end if;
end $$;

-- The first voter takes the vote back.
select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000002', true);
delete from review_helpful_votes
where review_id = '00000000-0000-0045-e000-000000000001'
  and user_id = '00000000-0000-0045-b000-000000000002';

do $$
begin
  if (select helpful_count from reviews where id = '00000000-0000-0045-e000-000000000001') <> 1 then
    raise exception 'helpful_count should drop to 1 after a vote is removed';
  end if;
end $$;

-- Guests read the count but not the votes.
reset role;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  if (select helpful_count from reviews where id = '00000000-0000-0045-e000-000000000001') <> 1 then
    raise exception 'Guests should read helpful_count';
  end if;

  begin
    perform 1 from review_helpful_votes limit 1;
    raise exception 'Guests should not read helpful votes';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

select 'review_helpful_votes_smoke_passed' as result;

rollback;
