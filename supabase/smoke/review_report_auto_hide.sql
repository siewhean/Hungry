-- Smoke checks for 20261019080000_review_report_auto_hide.sql.
-- Three distinct reporters hide a review from everyone but its author and drop
-- it from the dish totals; an ops restore brings it back for everyone except
-- the people who reported it. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   author:    00000000-0000-0043-b000-000000000001
--   reporters: 00000000-0000-0043-b000-00000000000{2,3,4}
--   bystander: 00000000-0000-0043-b000-000000000005
--   review:    00000000-0000-0043-e000-000000000001
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0043-b000-000000000001', 'Auto Hide Author'),
  ('00000000-0000-0043-b000-000000000002', 'Auto Hide Reporter One'),
  ('00000000-0000-0043-b000-000000000003', 'Auto Hide Reporter Two'),
  ('00000000-0000-0043-b000-000000000004', 'Auto Hide Reporter Three'),
  ('00000000-0000-0043-b000-000000000005', 'Auto Hide Bystander')
on conflict (id) do nothing;

select set_config('smoke.dish_id', (select d.id from dishes d order by d.id limit 1), true);

do $$
begin
  if nullif(current_setting('smoke.dish_id', true), '') is null then
    raise exception 'Smoke needs at least one dish row';
  end if;
end $$;

insert into reviews (id, user_id, dish_id, author_name, rating, text)
values (
  '00000000-0000-0043-e000-000000000001',
  '00000000-0000-0043-b000-000000000001',
  current_setting('smoke.dish_id'),
  'Auto Hide Author',
  1,
  'Auto hide smoke review'
);

select set_config(
  'smoke.review_count_visible',
  (select review_count::text from dishes where id = current_setting('smoke.dish_id')),
  true
);

-- Reporters one and two: the review stays visible to everyone else.
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000002', true);
select public.report_content('review', '00000000-0000-0043-e000-000000000001', 'spam', null);
-- A repeat report from the same person is still one reporter.
select public.report_content('review', '00000000-0000-0043-e000-000000000001', 'other', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000003', true);
select public.report_content('review', '00000000-0000-0043-e000-000000000001', 'spam', null);

select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000005', true);
do $$
begin
  if not exists (select 1 from reviews where id = '00000000-0000-0043-e000-000000000001') then
    raise exception 'Review should stay visible below the report threshold';
  end if;
end $$;

-- Reporter three crosses the threshold.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000004', true);
select public.report_content('review', '00000000-0000-0043-e000-000000000001', 'spam', null);

-- Bystander: hidden.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000005', true);
do $$
begin
  if exists (select 1 from reviews where id = '00000000-0000-0043-e000-000000000001') then
    raise exception 'Review should be hidden from other users after 3 distinct reporters';
  end if;
end $$;

-- Bystander: cannot restore it.
do $$
begin
  begin
    perform public.set_review_moderation_state(
      '00000000-0000-0043-e000-000000000001',
      'visible',
      'smoke',
      '{}'::jsonb
    );
    raise exception 'Non-admin restore should be refused';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- Author: still sees their own review.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000001', true);
do $$
begin
  if not exists (select 1 from reviews where id = '00000000-0000-0043-e000-000000000001') then
    raise exception 'Author should still see their hidden review';
  end if;
end $$;

-- Signed-out reads: hidden.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
do $$
begin
  if exists (select 1 from reviews where id = '00000000-0000-0043-e000-000000000001') then
    raise exception 'Hidden review should not be readable signed out';
  end if;
end $$;
reset role;

do $$
begin
  if (select state from review_moderation_states
      where review_id = '00000000-0000-0043-e000-000000000001') <> 'hidden' then
    raise exception 'Review moderation state should be hidden';
  end if;

  if not exists (
    select 1 from moderation_actions
    where target_type = 'review'
      and target_id = '00000000-0000-0043-e000-000000000001'
      and action = 'hide'
      and metadata ->> 'source' = 'auto_report_threshold'
      and (metadata ->> 'report_count')::int = 3
  ) then
    raise exception 'Auto-hide should record a moderation action with 3 reporters';
  end if;

  if (select review_count from dishes where id = current_setting('smoke.dish_id'))
    <> current_setting('smoke.review_count_visible')::int - 1 then
    raise exception 'Hidden review should leave the dish review_count';
  end if;
end $$;

-- Ops restore (service role).
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select public.set_review_moderation_state(
  '00000000-0000-0043-e000-000000000001',
  'visible',
  'smoke_restore',
  '{"source":"smoke"}'::jsonb
);
reset role;

do $$
begin
  if (select state from review_moderation_states
      where review_id = '00000000-0000-0043-e000-000000000001') <> 'visible' then
    raise exception 'Restore should set the review back to visible';
  end if;

  if exists (
    select 1 from content_reports
    where target_type = 'review'
      and target_id = '00000000-0000-0043-e000-000000000001'
      and status in ('open', 'reviewing')
  ) then
    raise exception 'Restore should dismiss the open reports';
  end if;

  if (select review_count from dishes where id = current_setting('smoke.dish_id'))
    <> current_setting('smoke.review_count_visible')::int then
    raise exception 'Restored review should count in the dish review_count again';
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000005', true);
do $$
begin
  if not exists (select 1 from reviews where id = '00000000-0000-0043-e000-000000000001') then
    raise exception 'Restored review should be visible to other users';
  end if;
end $$;

-- Reporters keep their own per-viewer hiding.
select set_config('request.jwt.claim.sub', '00000000-0000-0043-b000-000000000002', true);
do $$
begin
  if exists (select 1 from reviews where id = '00000000-0000-0043-e000-000000000001') then
    raise exception 'A reporter should still not see the review they reported';
  end if;
end $$;

reset role;

select 'review_report_auto_hide_smoke_passed' as result;

rollback;
