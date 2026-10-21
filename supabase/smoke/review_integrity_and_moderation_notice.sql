-- Smoke checks for 20261022060000_review_integrity_and_moderation_notice.sql
-- and 20261022060100_orphan_media_purge.sql (round-two G6).
--   L3: a staff member of the stall's merchant account cannot review that stall.
--   L5: tags must come from the allowed list, at most 8; changing other fields of a
--       review with an old free-form tag still works.
--   L2: edited_at is set by the server when the author edits, and cannot be written.
--   M3: an author sees their own hidden review's state, nobody else does.
--   M15: orphan draft posts and unreferenced media objects are listed/purged for
--        service_role only.
-- Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   author:   00000000-0000-0d60-b000-000000000001
--   staff:    00000000-0000-0d60-b000-000000000002
--   other:    00000000-0000-0d60-b000-000000000003
--   account:  00000000-0000-0d60-a000-000000000001
--   outlet:   00000000-0000-0d60-d000-000000000001
--   reviews:  00000000-0000-0d60-e000-00000000000{1,2}
insert into auth.users (id, email, created_at)
values
  ('00000000-0000-0d60-b000-000000000001', 'd60-author@example.test', now() - interval '30 days'),
  ('00000000-0000-0d60-b000-000000000002', 'd60-staff@example.test', now() - interval '30 days'),
  ('00000000-0000-0d60-b000-000000000003', 'd60-other@example.test', now() - interval '30 days');

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0d60-b000-000000000001', 'D60 Author'),
  ('00000000-0000-0d60-b000-000000000002', 'D60 Staff'),
  ('00000000-0000-0d60-b000-000000000003', 'D60 Other')
on conflict (id) do nothing;

-- Reuse two existing dishes at different venues; never create catalog rows.
select set_config(
  'smoke.dish_a',
  (select d.id from dishes d where d.venue_id is not null order by d.id limit 1),
  true
);
select set_config(
  'smoke.venue_a',
  (select d.venue_id from dishes d where d.id = current_setting('smoke.dish_a')),
  true
);
select set_config(
  'smoke.dish_b',
  (select d.id from dishes d
   where d.venue_id is not null and d.venue_id <> current_setting('smoke.venue_a')
   order by d.id limit 1),
  true
);

do $$
begin
  if nullif(current_setting('smoke.dish_a', true), '') is null
     or nullif(current_setting('smoke.dish_b', true), '') is null then
    raise exception 'Smoke needs dishes at two different venues';
  end if;
end $$;

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0d60-a000-000000000001',
  '00000000-0000-0d60-b000-000000000003',
  'D60 Merchant',
  'd60-merchant@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, name, business_type)
values (
  '00000000-0000-0d60-d000-000000000001',
  '00000000-0000-0d60-a000-000000000001',
  current_setting('smoke.venue_a'),
  'D60 Outlet',
  'hawker_stall'
);

insert into merchant_roles (merchant_account_id, user_id, role)
values ('00000000-0000-0d60-a000-000000000001', '00000000-0000-0d60-b000-000000000002', 'staff');

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- L3: staff of the stall's merchant account cannot review it.
select set_config('request.jwt.claim.sub', '00000000-0000-0d60-b000-000000000002', true);
do $$
begin
  begin
    insert into reviews (user_id, dish_id, rating, text)
    values ('00000000-0000-0d60-b000-000000000002', current_setting('smoke.dish_a'), 5, 'staff review');
    raise exception 'A staff member should not be able to review their own stall';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- The author reviews the dish, with allowed tags.
select set_config('request.jwt.claim.sub', '00000000-0000-0d60-b000-000000000001', true);
insert into reviews (id, user_id, dish_id, rating, text, tags)
values (
  '00000000-0000-0d60-e000-000000000001',
  '00000000-0000-0d60-b000-000000000001',
  current_setting('smoke.dish_a'),
  4,
  'good',
  array['Wok Hei', 'Worth the queue']
);

do $$
begin
  -- L5: unknown tag, and more than 8 tags, are refused.
  begin
    insert into reviews (user_id, dish_id, rating, text, tags)
    values ('00000000-0000-0d60-b000-000000000001', current_setting('smoke.dish_b'), 4, 'x',
            array['definitely-not-a-tag']);
    raise exception 'An unknown tag should be refused';
  exception when check_violation then
    null;
  end;
  begin
    insert into reviews (user_id, dish_id, rating, text, tags)
    values ('00000000-0000-0d60-b000-000000000001', current_setting('smoke.dish_b'), 4, 'x',
            array['Spicy','Sweet','Sour','Savoury','Rich','Light','Fragrant','Crispy','Soft']);
    raise exception 'More than 8 tags should be refused';
  exception when check_violation then
    null;
  end;
  begin
    update reviews set tags = array['Spicy', 'nope']
    where id = '00000000-0000-0d60-e000-000000000001';
    raise exception 'Updating to an unknown tag should be refused';
  exception when check_violation then
    null;
  end;

  -- L2: never edited yet.
  if (select edited_at from reviews where id = '00000000-0000-0d60-e000-000000000001') is not null then
    raise exception 'A new review should not be marked edited';
  end if;
end $$;

-- The author edits the text: edited_at is set by the server.
update reviews set text = 'really good'
where id = '00000000-0000-0d60-e000-000000000001';

do $$
begin
  if (select edited_at from reviews where id = '00000000-0000-0d60-e000-000000000001') is null then
    raise exception 'An edit by the author should set edited_at';
  end if;
end $$;

-- The author cannot write edited_at: a client value is replaced by the server's.
update reviews set edited_at = '2000-01-01T00:00:00Z'
where id = '00000000-0000-0d60-e000-000000000001';
do $$
begin
  if (select edited_at from reviews where id = '00000000-0000-0d60-e000-000000000001')
     < now() - interval '1 hour' then
    raise exception 'The author should not be able to write edited_at';
  end if;
end $$;

-- M3: hide the review (as the service would), then ask who can see the state.
reset role;
insert into review_moderation_states (review_id, state, reason_code)
values ('00000000-0000-0d60-e000-000000000001', 'hidden', 'spam');

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0d60-b000-000000000001', true);
do $$
begin
  if (select count(*) from public.get_my_review_moderation_states(
        array['00000000-0000-0d60-e000-000000000001']::uuid[])) <> 1 then
    raise exception 'The author should see their hidden review state';
  end if;
  if (select state from public.get_my_review_moderation_states(
        array['00000000-0000-0d60-e000-000000000001']::uuid[])) <> 'hidden' then
    raise exception 'The state should be hidden';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0d60-b000-000000000003', true);
do $$
begin
  if (select count(*) from public.get_my_review_moderation_states(
        array['00000000-0000-0d60-e000-000000000001']::uuid[])) <> 0 then
    raise exception 'Other users should not see the moderation state of a review';
  end if;
  -- The table itself stays closed to clients.
  begin
    perform 1 from review_moderation_states limit 1;
    raise exception 'Clients should not read review_moderation_states';
  exception when insufficient_privilege then
    null;
  end;
  -- M15: the purge functions are not callable by clients.
  begin
    perform public.purge_orphan_post_drafts();
    raise exception 'Clients should not run the draft purge';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform 1 from public.list_orphan_media_objects('review-media');
    raise exception 'Clients should not list orphan media';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- M15: an old draft post is purged, a recent draft and a published post stay.
reset role;
insert into posts (id, author_id, status, caption, created_at)
values
  ('00000000-0000-0d60-f000-000000000001', '00000000-0000-0d60-b000-000000000001', 'draft', 'old', now() - interval '2 days'),
  ('00000000-0000-0d60-f000-000000000002', '00000000-0000-0d60-b000-000000000001', 'draft', 'new', now()),
  ('00000000-0000-0d60-f000-000000000003', '00000000-0000-0d60-b000-000000000001', 'published', 'live', now() - interval '2 days');

set local role service_role;
do $$
declare
  v_removed integer;
begin
  v_removed := public.purge_orphan_post_drafts();
  if v_removed < 1 then
    raise exception 'The old draft post should be purged';
  end if;
  if exists (select 1 from posts where id = '00000000-0000-0d60-f000-000000000001') then
    raise exception 'The old draft should be gone';
  end if;
  if not exists (select 1 from posts where id = '00000000-0000-0d60-f000-000000000002') then
    raise exception 'A recent draft should stay';
  end if;
  if not exists (select 1 from posts where id = '00000000-0000-0d60-f000-000000000003') then
    raise exception 'A published post should stay';
  end if;
  -- Listing runs and rejects unknown buckets.
  perform 1 from public.list_orphan_media_objects('post-media');
  begin
    perform 1 from public.list_orphan_media_objects('avatars');
    raise exception 'Only review-media and post-media can be listed';
  exception when invalid_parameter_value then
    null;
  end;
end $$;
reset role;

select 'review_integrity_and_moderation_notice_smoke_passed' as result;

rollback;
