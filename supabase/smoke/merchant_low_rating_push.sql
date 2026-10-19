-- Smoke checks for 20261019170000_merchant_low_rating_push.sql.
-- A review rated 2 stars or below on a verified outlet records the in-app
-- alert and enqueues one push job for the merchant owner; higher ratings,
-- reviewers the owner blocked, an account with low_rating_alerts off and an
-- unverified outlet enqueue no push. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:     00000000-0000-0045-b000-000000000001
--   reviewers: 00000000-0000-0045-b000-00000000000{2,3}
--   account:   00000000-0000-0045-a000-000000000001
--   outlet:    00000000-0000-0045-d000-000000000001
--   reviews:   00000000-0000-0045-e000-00000000000{1..5}
insert into auth.users (id, email)
values ('00000000-0000-0045-b000-000000000001', 'low-rating-owner@example.test');

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0045-b000-000000000001', 'Low Rating Owner'),
  ('00000000-0000-0045-b000-000000000002', 'Low Rating Reviewer'),
  ('00000000-0000-0045-b000-000000000003', 'Blocked Reviewer')
on conflict (id) do nothing;

select set_config(
  'smoke.dish_id',
  (select d.id from dishes d where d.venue_id is not null order by d.id limit 1),
  true
);
select set_config(
  'smoke.venue_id',
  (select d.venue_id from dishes d where d.id = current_setting('smoke.dish_id')),
  true
);

do $$
begin
  if nullif(current_setting('smoke.dish_id', true), '') is null then
    raise exception 'Smoke needs at least one dish row with a venue';
  end if;
end $$;

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0045-a000-000000000001',
  '00000000-0000-0045-b000-000000000001',
  'Low Rating Merchant',
  'low-rating-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, name, business_type)
values (
  '00000000-0000-0045-d000-000000000001',
  '00000000-0000-0045-a000-000000000001',
  current_setting('smoke.venue_id'),
  'Low Rating Outlet',
  'hawker_stall'
);

insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0045-d000-000000000001', 'verified', now());

insert into user_push_tokens (token, user_id, platform)
values (
  'ExponentPushToken[smokeLowRating01]',
  '00000000-0000-0045-b000-000000000001',
  'ios'
);

-- 1. A signed-in diner posts a 2-star review: in-app alert + one push job.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000002', true);
set local role authenticated;

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0045-e000-000000000001',
  '00000000-0000-0045-b000-000000000002',
  current_setting('smoke.dish_id'),
  current_setting('smoke.venue_id'),
  'Low Rating Reviewer',
  2,
  'Cold and late.'
);

reset role;

do $$
declare
  v_job public.notification_jobs;
  v_jobs integer;
begin
  select count(*) into v_jobs
  from public.notification_jobs
  where review_id = '00000000-0000-0045-e000-000000000001'
    and user_id = '00000000-0000-0045-b000-000000000001';
  if v_jobs <> 1 then
    raise exception 'Expected 1 low-rating push job for the owner, got %', v_jobs;
  end if;

  select * into v_job
  from public.notification_jobs
  where review_id = '00000000-0000-0045-e000-000000000001'
    and user_id = '00000000-0000-0045-b000-000000000001';
  if v_job.category <> 'merchant_low_rating'
     or v_job.change_kind <> 'low_rating'
     or v_job.merchant_account_id <> '00000000-0000-0045-a000-000000000001'
     or v_job.status <> 'pending'
     or v_job.deep_link <> 'https://usehungry.com/merchant'
     or v_job.title <> 'Low Rating Outlet: new 2.0-star review'
     or v_job.body <> 'Cold and late.' then
    raise exception 'Unexpected low-rating job: %', row_to_json(v_job);
  end if;

  if not exists (
    select 1 from public.merchant_notifications
    where dedupe_key = 'low-rating:00000000-0000-0045-e000-000000000001'
      and merchant_account_id = '00000000-0000-0045-a000-000000000001'
      and kind = 'low_rating'
  ) then
    raise exception 'Expected an in-app low_rating merchant notification';
  end if;
end $$;

-- 2. A 4-star review enqueues nothing.
insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0045-e000-000000000002',
  '00000000-0000-0045-b000-000000000002',
  current_setting('smoke.dish_id'),
  current_setting('smoke.venue_id'),
  'Low Rating Reviewer',
  4,
  'Pretty good.'
);

-- 3. A reviewer the owner blocked: in-app alert only, no push.
insert into user_blocks (blocker_id, blocked_user_key)
values ('00000000-0000-0045-b000-000000000001', '00000000-0000-0045-b000-000000000003');

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0045-e000-000000000003',
  '00000000-0000-0045-b000-000000000003',
  current_setting('smoke.dish_id'),
  current_setting('smoke.venue_id'),
  'Blocked Reviewer',
  1,
  'Bad.'
);

-- 4. The account turned low-rating alerts off.
insert into merchant_notification_preferences (merchant_account_id, low_rating_alerts)
values ('00000000-0000-0045-a000-000000000001', false);

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0045-e000-000000000004',
  '00000000-0000-0045-b000-000000000002',
  current_setting('smoke.dish_id'),
  current_setting('smoke.venue_id'),
  'Low Rating Reviewer',
  1,
  'Still bad.'
);

-- 5. Alerts back on, but the outlet is no longer verified.
update merchant_notification_preferences
set low_rating_alerts = true
where merchant_account_id = '00000000-0000-0045-a000-000000000001';
update merchant_verifications
set status = 'submitted'
where outlet_id = '00000000-0000-0045-d000-000000000001';

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0045-e000-000000000005',
  '00000000-0000-0045-b000-000000000002',
  current_setting('smoke.dish_id'),
  current_setting('smoke.venue_id'),
  'Low Rating Reviewer',
  0.5,
  'Unverified outlet.'
);

do $$
declare
  v_jobs integer;
begin
  select count(*) into v_jobs
  from public.notification_jobs
  where review_id in (
    '00000000-0000-0045-e000-000000000002',
    '00000000-0000-0045-e000-000000000003',
    '00000000-0000-0045-e000-000000000004',
    '00000000-0000-0045-e000-000000000005'
  );
  if v_jobs <> 0 then
    raise exception 'Expected no push jobs for high, blocked, opted-out or unverified cases, got %',
      v_jobs;
  end if;

  if exists (
    select 1 from public.merchant_notifications
    where dedupe_key = 'low-rating:00000000-0000-0045-e000-000000000002'
  ) then
    raise exception 'A 4-star review must not create a low_rating notification';
  end if;

  if not exists (
    select 1 from public.merchant_notifications
    where dedupe_key = 'low-rating:00000000-0000-0045-e000-000000000003'
  ) then
    raise exception 'A blocked reviewer still lists the in-app low_rating notification';
  end if;

  if has_function_privilege(
    'authenticated', 'app_private.enqueue_merchant_low_rating_alert()', 'execute'
  ) then
    raise exception 'Clients must not execute the low-rating trigger function';
  end if;
end $$;

rollback;
