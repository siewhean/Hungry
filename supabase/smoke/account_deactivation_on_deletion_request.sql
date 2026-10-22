-- Smoke checks for 20261022100000_account_deactivation_on_deletion_request.sql.
-- A pending deletion request hides the account's profile, reviews, posts and
-- Lists from other viewers and anonymous visitors (the owner still sees them);
-- cancelling the request brings them back. A merchant owner cannot queue
-- deletion. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   leaver:   00000000-0000-0200-b000-000000000001 (will request deletion)
--   viewer:   00000000-0000-0200-b000-000000000002
--   merchant: 00000000-0000-0200-b000-000000000003
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0200-b000-000000000001', 'Leaving Smoke'),
  ('00000000-0000-0200-b000-000000000002', 'Viewing Smoke'),
  ('00000000-0000-0200-b000-000000000003', 'Merchant Smoke')
on conflict (id) do nothing;

select set_config(
  'smoke.dish_id',
  (select d.id from dishes d order by d.id limit 1),
  true
);

insert into reviews (id, user_id, dish_id, author_name, rating, text)
values (
  '00000000-0000-0200-e000-000000000001',
  '00000000-0000-0200-b000-000000000001',
  current_setting('smoke.dish_id'),
  'Leaving Smoke',
  4,
  'Deactivation smoke review'
);

insert into portfolios (id, owner_id, name, type, visibility)
values (
  '00000000-0000-0200-f000-000000000001',
  '00000000-0000-0200-b000-000000000001',
  'Deactivation smoke list', 'collection', 'public'
);

insert into posts (id, author_id, caption)
values (
  '00000000-0000-0200-d000-000000000001',
  '00000000-0000-0200-b000-000000000001',
  'Deactivation smoke post'
);

-- Before any request: a stranger sees everything.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0200-b000-000000000002', true);
set local role authenticated;

do $$
begin
  if not public.can_read_author_content('00000000-0000-0200-b000-000000000001') then
    raise exception 'An active public account must be readable';
  end if;
  if not exists (select 1 from public.public_profiles where id = '00000000-0000-0200-b000-000000000001') then
    raise exception 'An active public account keeps its public profile row';
  end if;
  if not exists (select 1 from public.reviews where id = '00000000-0000-0200-e000-000000000001') then
    raise exception 'An active account keeps its reviews visible';
  end if;
  if not exists (select 1 from public.portfolios where id = '00000000-0000-0200-f000-000000000001') then
    raise exception 'An active account keeps its public lists visible';
  end if;
  if public.get_public_portfolio('00000000-0000-0200-f000-000000000001') is null then
    raise exception 'An active account''s shared list should load';
  end if;
end $$;

-- The leaver queues deletion (trusted insert: the table has no client insert).
reset role;
insert into account_deletion_requests (user_id, status)
values ('00000000-0000-0200-b000-000000000001', 'requested');

do $$
begin
  if not app_private.account_is_deactivated('00000000-0000-0200-b000-000000000001') then
    raise exception 'A requested deletion should deactivate the account';
  end if;
  if app_private.account_is_deactivated('00000000-0000-0200-b000-000000000002') then
    raise exception 'An account without a request must stay active';
  end if;
  if app_private.account_is_deactivated(null) then
    raise exception 'A null user is never deactivated';
  end if;
end $$;

-- Stranger: everything is hidden.
select set_config('request.jwt.claim.sub', '00000000-0000-0200-b000-000000000002', true);
set local role authenticated;

do $$
begin
  if public.can_read_author_content('00000000-0000-0200-b000-000000000001') then
    raise exception 'A deactivated account must not be readable by others';
  end if;
  if exists (select 1 from public.public_profiles where id = '00000000-0000-0200-b000-000000000001') then
    raise exception 'A deactivated account must leave public_profiles reads';
  end if;
  if exists (select 1 from public.reviews where id = '00000000-0000-0200-e000-000000000001') then
    raise exception 'A deactivated account''s reviews must be hidden';
  end if;
  if exists (select 1 from public.portfolios where id = '00000000-0000-0200-f000-000000000001') then
    raise exception 'A deactivated account''s lists must be hidden';
  end if;
  if public.get_public_portfolio('00000000-0000-0200-f000-000000000001') is not null then
    raise exception 'A deactivated account''s shared list must not load';
  end if;
  if exists (
    select 1 from public.search_portfolios('Deactivation smoke list', null, 'public')
  ) then
    raise exception 'A deactivated account''s lists must not appear in list search';
  end if;
  if public.can_read_post('00000000-0000-0200-d000-000000000001') then
    raise exception 'A deactivated account''s posts must be hidden';
  end if;
end $$;

-- The owner still sees their own content.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0200-b000-000000000001', true);
set local role authenticated;

do $$
begin
  if not public.can_read_author_content('00000000-0000-0200-b000-000000000001') then
    raise exception 'The owner must still read their own content';
  end if;
  if not exists (select 1 from public.reviews where id = '00000000-0000-0200-e000-000000000001') then
    raise exception 'The owner must still see their own reviews';
  end if;
  if not exists (select 1 from public.portfolios where id = '00000000-0000-0200-f000-000000000001') then
    raise exception 'The owner must still see their own lists';
  end if;
end $$;

-- Visitors without a session see nothing either.
reset role;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  if public.get_public_portfolio('00000000-0000-0200-f000-000000000001') is not null then
    raise exception 'A visitor must not load a deactivated account''s shared list';
  end if;
  if exists (select 1 from public.public_profiles where id = '00000000-0000-0200-b000-000000000001') then
    raise exception 'A visitor must not read a deactivated account''s profile';
  end if;
end $$;

-- Keep my account: cancelling the request brings everything back.
reset role;
update account_deletion_requests
set status = 'cancelled', cancelled_at = now()
where user_id = '00000000-0000-0200-b000-000000000001';

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0200-b000-000000000002', true);
set local role authenticated;

do $$
begin
  if not public.can_read_author_content('00000000-0000-0200-b000-000000000001') then
    raise exception 'A cancelled request must reactivate the account';
  end if;
  if not exists (select 1 from public.reviews where id = '00000000-0000-0200-e000-000000000001') then
    raise exception 'A cancelled request must bring the reviews back';
  end if;
end $$;

-- M2: a merchant owner cannot queue deletion.
reset role;
insert into merchant_accounts (user_id, display_name, email)
values ('00000000-0000-0200-b000-000000000003', 'Smoke Stall', 'smoke-owner@example.com');

select set_config('request.jwt.claim.sub', '00000000-0000-0200-b000-000000000003', true);
set local role authenticated;

do $$
begin
  if public.get_my_account_deletion_blocker() is distinct from 'merchant_owner_must_transfer' then
    raise exception 'The blocker check should name the merchant owner reason';
  end if;
  perform public.request_my_account_deletion('smoke');
  raise exception 'A merchant owner must not be able to queue deletion';
exception
  when sqlstate 'P0001' then
    if sqlerrm <> 'merchant_owner_must_transfer' then
      raise;
    end if;
end $$;

reset role;

do $$
begin
  if exists (
    select 1 from account_deletion_requests
    where user_id = '00000000-0000-0200-b000-000000000003'
  ) then
    raise exception 'The refused merchant owner must not have a request row';
  end if;
end $$;

-- A user who owns no business has no blocker.
select set_config('request.jwt.claim.sub', '00000000-0000-0200-b000-000000000002', true);
set local role authenticated;

do $$
begin
  if public.get_my_account_deletion_blocker() is not null then
    raise exception 'A non-merchant has no deletion blocker';
  end if;
end $$;

reset role;

select 'account_deactivation_on_deletion_request' as check_name, 'ok' as detail;

rollback;
