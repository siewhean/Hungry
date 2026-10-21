-- Smoke checks for 20261021162000_review_report_established_reporters.sql (H34).
-- New accounts and the stall's own merchant can report a review but do not
-- count towards auto-hide; three established, independent reporters still
-- hide it, and ops can restore it. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   author:            00000000-0000-0d34-b000-000000000001
--   established (old): 00000000-0000-0d34-b000-00000000000{2,3,4}
--   new account:       00000000-0000-0d34-b000-000000000005
--   stall merchant:    00000000-0000-0d34-b000-000000000006
--   bystander:         00000000-0000-0d34-b000-000000000007
--   review:            00000000-0000-0d34-e000-000000000001
insert into auth.users (id, email, created_at)
values
  ('00000000-0000-0d34-b000-000000000001', 'd34-author@example.test', now() - interval '60 days'),
  ('00000000-0000-0d34-b000-000000000002', 'd34-old-1@example.test', now() - interval '30 days'),
  ('00000000-0000-0d34-b000-000000000003', 'd34-old-2@example.test', now() - interval '30 days'),
  ('00000000-0000-0d34-b000-000000000004', 'd34-old-3@example.test', now() - interval '30 days'),
  ('00000000-0000-0d34-b000-000000000005', 'd34-new@example.test', now() - interval '1 day'),
  ('00000000-0000-0d34-b000-000000000006', 'd34-merchant@example.test', now() - interval '90 days'),
  ('00000000-0000-0d34-b000-000000000007', 'd34-bystander@example.test', now() - interval '30 days');

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0d34-b000-000000000001', 'D34 Author'),
  ('00000000-0000-0d34-b000-000000000002', 'D34 Old One'),
  ('00000000-0000-0d34-b000-000000000003', 'D34 Old Two'),
  ('00000000-0000-0d34-b000-000000000004', 'D34 Old Three'),
  ('00000000-0000-0d34-b000-000000000005', 'D34 New'),
  ('00000000-0000-0d34-b000-000000000006', 'D34 Merchant'),
  ('00000000-0000-0d34-b000-000000000007', 'D34 Bystander')
on conflict (id) do nothing;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values (
  'review-report-d34-building', 'review-report-d34-building',
  'Report Smoke Building', 'hawker_centre', 1.3004, 103.8004, array['01']
)
on conflict (id) do nothing;

insert into venues (id, building_id, name, unit_number, floor, operating_hours)
values (
  'review-report-d34-venue', 'review-report-d34-building',
  'Report Smoke Venue', '#01-04', '01', 'Mon-Sun 9am-9pm'
)
on conflict (id) do nothing;

insert into dishes (
  id, venue_id, building_id, name, distance_meters, rating_avg, review_count,
  price, price_range, menu_approved_for_display, menu_rights_status, menu_source_url
)
values (
  'review-report-d34-dish', 'review-report-d34-venue', 'review-report-d34-building',
  'Smoke Report Rice', 50, 0, 0, 4.00, '$4', true, 'merchant_owned',
  'https://merchant.example/menu'
)
on conflict (id) do nothing;

-- The stall's merchant (setup as ops so outlet guards allow it).
select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0d34-a000-000000000001',
  '00000000-0000-0d34-b000-000000000006',
  'D34 Merchant',
  'd34-merchant@example.test'
);
insert into merchant_outlets (id, merchant_account_id, venue_id, name, business_type)
values (
  '00000000-0000-0d34-d000-000000000001',
  '00000000-0000-0d34-a000-000000000001',
  'review-report-d34-venue',
  'D34 Outlet',
  'hawker_stall'
);

insert into reviews (id, user_id, dish_id, rating, text)
values (
  '00000000-0000-0d34-e000-000000000001',
  '00000000-0000-0d34-b000-000000000001',
  'review-report-d34-dish',
  1,
  'Cold and bland'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- Two established reporters, the new account, the merchant and the author.
select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000002', true);
select public.report_content('review', '00000000-0000-0d34-e000-000000000001', 'spam', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000003', true);
select public.report_content('review', '00000000-0000-0d34-e000-000000000001', 'spam', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000005', true);
select public.report_content('review', '00000000-0000-0d34-e000-000000000001', 'spam', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000006', true);
select public.report_content('review', '00000000-0000-0d34-e000-000000000001', 'spam', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000001', true);
select public.report_content('review', '00000000-0000-0d34-e000-000000000001', 'other', null);

-- Five reporters, two qualifying: still visible.
select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000007', true);
do $$
begin
  if not exists (select 1 from reviews where id = '00000000-0000-0d34-e000-000000000001') then
    raise exception 'New accounts and the stall merchant must not count towards auto-hide';
  end if;
end $$;

reset role;
do $$
begin
  if (select count(*) from content_reports
      where target_type = 'review'
        and target_id = '00000000-0000-0d34-e000-000000000001') <> 5 then
    raise exception 'Every report should still be recorded';
  end if;
  if (select state from review_moderation_states
      where review_id = '00000000-0000-0d34-e000-000000000001') <> 'under_review' then
    raise exception 'Below the qualifying threshold the review should be under_review';
  end if;
end $$;

-- A third established reporter hides it.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000004', true);
select public.report_content('review', '00000000-0000-0d34-e000-000000000001', 'spam', null);

select set_config('request.jwt.claim.sub', '00000000-0000-0d34-b000-000000000007', true);
do $$
begin
  if exists (select 1 from reviews where id = '00000000-0000-0d34-e000-000000000001') then
    raise exception 'Three established reporters should hide the review';
  end if;
end $$;

reset role;
do $$
begin
  if not exists (
    select 1 from moderation_actions
    where target_type = 'review'
      and target_id = '00000000-0000-0d34-e000-000000000001'
      and action = 'hide'
      and metadata ->> 'source' = 'auto_report_threshold'
      and (metadata ->> 'report_count')::int = 3
  ) then
    raise exception 'Auto-hide should record 3 qualifying reporters';
  end if;
end $$;

-- Ops can reverse it.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select public.set_review_moderation_state(
  '00000000-0000-0d34-e000-000000000001', 'visible', 'smoke_restore', '{}'::jsonb
);
reset role;

do $$
begin
  if (select state from review_moderation_states
      where review_id = '00000000-0000-0d34-e000-000000000001') <> 'visible' then
    raise exception 'Ops restore should make the review visible again';
  end if;
end $$;

select 'review_report_established_reporters_smoke_passed' as result;

rollback;
