-- Smoke checks for 20261019090000_review_auto_hide_merchant_followup.sql.
-- After 3 distinct reporters hide a pinned review, the venue merchant can no
-- longer read the review but can still reorder and unpin its pin, and the
-- merchant analytics review count leaves it out. Runs in a transaction and
-- rolls back.

begin;

-- Fixed ids for this smoke only.
--   author:    00000000-0000-0044-b000-000000000001
--   reporters: 00000000-0000-0044-b000-00000000000{2,3,4}
--   merchant:  00000000-0000-0044-b000-000000000005
--   account:   00000000-0000-0044-a000-000000000001
--   outlet:    00000000-0000-0044-d000-000000000001
--   review:    00000000-0000-0044-e000-000000000001
-- Reporters are established accounts (20261021162000 counts only accounts at
-- least 7 days old).
insert into auth.users (id, email, created_at)
values
  ('00000000-0000-0044-b000-000000000002', 'pin-hide-r1@example.test', now() - interval '30 days'),
  ('00000000-0000-0044-b000-000000000003', 'pin-hide-r2@example.test', now() - interval '30 days'),
  ('00000000-0000-0044-b000-000000000004', 'pin-hide-r3@example.test', now() - interval '30 days')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0044-b000-000000000001', 'Pin Hide Author'),
  ('00000000-0000-0044-b000-000000000002', 'Pin Hide Reporter One'),
  ('00000000-0000-0044-b000-000000000003', 'Pin Hide Reporter Two'),
  ('00000000-0000-0044-b000-000000000004', 'Pin Hide Reporter Three'),
  ('00000000-0000-0044-b000-000000000005', 'Pin Hide Merchant')
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
  '00000000-0000-0044-a000-000000000001',
  '00000000-0000-0044-b000-000000000005',
  'Pin Hide Merchant',
  'pin-hide-merchant@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, name, business_type)
values (
  '00000000-0000-0044-d000-000000000001',
  '00000000-0000-0044-a000-000000000001',
  current_setting('smoke.venue_id'),
  'Pin Hide Outlet',
  'hawker_stall'
);

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0044-e000-000000000001',
  '00000000-0000-0044-b000-000000000001',
  current_setting('smoke.dish_id'),
  current_setting('smoke.venue_id'),
  'Pin Hide Author',
  1,
  'Pin hide smoke review'
);

insert into merchant_popular_visitor_pins (
  outlet_id,
  venue_id,
  review_id,
  source_id,
  author_name,
  rating,
  visited_at
)
values (
  '00000000-0000-0044-d000-000000000001',
  current_setting('smoke.venue_id'),
  '00000000-0000-0044-e000-000000000001',
  '00000000-0000-0044-e000-000000000001',
  'Pin Hide Author',
  1,
  now()
);

-- Merchant analytics before the review is hidden.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000005', true);
set local role authenticated;
select set_config(
  'smoke.analytics_review_count_visible',
  (public.get_merchant_analytics(
    '00000000-0000-0044-d000-000000000001',
    now() - interval '1 day',
    now() + interval '1 day'
  ) ->> 'reviewCount'),
  true
);

-- Three distinct reporters hide the review.
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000002', true);
select public.report_content('review', '00000000-0000-0044-e000-000000000001', 'spam', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000003', true);
select public.report_content('review', '00000000-0000-0044-e000-000000000001', 'spam', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000004', true);
select public.report_content('review', '00000000-0000-0044-e000-000000000001', 'spam', null);

-- Merchant: cannot read the review, still sees the pin and can manage it.
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000005', true);
do $$
declare
  v_rows integer;
begin
  if exists (select 1 from reviews where id = '00000000-0000-0044-e000-000000000001') then
    raise exception 'Merchant should not read a review hidden by reports';
  end if;

  if not exists (
    select 1 from merchant_popular_visitor_pins
    where review_id = '00000000-0000-0044-e000-000000000001'
  ) then
    raise exception 'Merchant should still see the pin of a hidden review';
  end if;

  if (public.get_merchant_analytics(
    '00000000-0000-0044-d000-000000000001',
    now() - interval '1 day',
    now() + interval '1 day'
  ) ->> 'reviewCount')::int
    <> current_setting('smoke.analytics_review_count_visible')::int - 1 then
    raise exception 'Merchant analytics should leave the hidden review out of reviewCount';
  end if;

  update merchant_popular_visitor_pins
  set sort_order = 5
  where review_id = '00000000-0000-0044-e000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Merchant should be able to reorder the pin of a hidden review';
  end if;

  update merchant_popular_visitor_pins
  set is_active = false
  where review_id = '00000000-0000-0044-e000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Merchant should be able to unpin the pin of a hidden review';
  end if;
end $$;

-- A different signed-in user still cannot touch the pin.
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000002', true);
do $$
declare
  v_rows integer;
begin
  update merchant_popular_visitor_pins
  set is_active = true
  where review_id = '00000000-0000-0044-e000-000000000001';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Only the venue merchant should update the pin';
  end if;
end $$;

reset role;

select 'review_auto_hide_merchant_followup_smoke_passed' as result;

rollback;
