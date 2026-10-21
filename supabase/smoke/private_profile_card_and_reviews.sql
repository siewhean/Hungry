-- Smoke checks for 20261021132000_private_profile_card_and_reviews.sql.
-- A private account's profile review list is empty for a stranger and a
-- visitor, full for an approved follower; its dish reviews stay public; the
-- profile card still names it and flags it private. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   private author: 00000000-0000-0063-b000-000000000001
--   stranger:       00000000-0000-0063-b000-000000000002
--   follower:       00000000-0000-0063-b000-000000000003
--   review:         00000000-0000-0063-e000-000000000001
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0063-b000-000000000001', 'Private Reviewer'),
  ('00000000-0000-0063-b000-000000000002', 'Profile Stranger'),
  ('00000000-0000-0063-b000-000000000003', 'Profile Follower')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-0063-b000-000000000001', 'private')
on conflict (user_id) do update set account_visibility = excluded.account_visibility;

insert into follows (follower_id, followee_id, status)
values (
  '00000000-0000-0063-b000-000000000003',
  '00000000-0000-0063-b000-000000000001',
  'approved'
);

select set_config(
  'smoke.dish_id',
  (select d.id from dishes d order by d.id limit 1),
  true
);

insert into reviews (id, user_id, dish_id, author_name, rating, text)
values (
  '00000000-0000-0063-e000-000000000001',
  '00000000-0000-0063-b000-000000000001',
  current_setting('smoke.dish_id'),
  'Private Reviewer',
  4,
  'Private profile smoke review'
);

-- Stranger.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0063-b000-000000000002', true);
set local role authenticated;

do $$
declare
  v_private boolean;
  v_can_view boolean;
  v_name text;
begin
  if exists (
    select 1 from public.get_user_profile_reviews('00000000-0000-0063-b000-000000000001')
  ) then
    raise exception 'A stranger must not list a private account''s reviews on its profile';
  end if;
  if not exists (
    select 1
    from public.reviews r
    where r.id = '00000000-0000-0063-e000-000000000001'
  ) then
    raise exception 'The review stays public on the dish page';
  end if;

  select card.display_name, card.is_private, card.can_view_content
  into v_name, v_private, v_can_view
  from public.get_profile_card('00000000-0000-0063-b000-000000000001') card;
  if v_name is distinct from 'Private Reviewer' or v_private is distinct from true
    or v_can_view is distinct from false then
    raise exception 'Stranger card should be named, private, not viewable (got %, %, %)',
      v_name, v_private, v_can_view;
  end if;
end $$;

-- Approved follower.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0063-b000-000000000003', true);
set local role authenticated;

do $$
begin
  if not exists (
    select 1 from public.get_user_profile_reviews('00000000-0000-0063-b000-000000000001')
  ) then
    raise exception 'An approved follower sees the private account''s reviews';
  end if;
  if not (
    select card.can_view_content
    from public.get_profile_card('00000000-0000-0063-b000-000000000001') card
  ) then
    raise exception 'An approved follower can view the private account';
  end if;
end $$;

-- Visitor without a session.
reset role;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  if exists (
    select 1 from public.get_user_profile_reviews('00000000-0000-0063-b000-000000000001')
  ) then
    raise exception 'A visitor must not list a private account''s reviews on its profile';
  end if;
end $$;

rollback;
