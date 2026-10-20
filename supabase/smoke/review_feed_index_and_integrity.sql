-- Smoke checks for 20261020030000_review_feed_index_and_integrity.sql.
-- The recent-reviews feed index exists; a new review takes its venue from the
-- dish and its author name from the profile; a 0-star rating is refused; a
-- stall owner cannot review their own stall. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   reviewer: 00000000-0000-0046-b000-000000000001
--   owner:    00000000-0000-0046-b000-000000000002
--   account:  00000000-0000-0046-a000-000000000001
--   outlet:   00000000-0000-0046-d000-000000000001
--   reviews:  00000000-0000-0046-e000-00000000000{1..3}
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'reviews'
      and indexname = 'idx_reviews_created_at_id'
      and indexdef ilike '%(created_at DESC, id DESC)%'
  ) then
    raise exception 'idx_reviews_created_at_id is missing or has the wrong shape';
  end if;
end $$;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0046-b000-000000000001', 'Integrity Reviewer'),
  ('00000000-0000-0046-b000-000000000002', 'Integrity Owner')
on conflict (id) do update set display_name = excluded.display_name;

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
select set_config(
  'smoke.other_venue_id',
  (
    select v.id
    from venues v
    where v.id <> current_setting('smoke.venue_id')
    order by v.id
    limit 1
  ),
  true
);

do $$
begin
  if nullif(current_setting('smoke.dish_id', true), '') is null then
    raise exception 'Smoke needs at least one dish row with a venue';
  end if;
end $$;

-- 1. The client sends a wrong venue and a spoofed name: the trigger corrects both.
insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0046-e000-000000000001',
  '00000000-0000-0046-b000-000000000001',
  current_setting('smoke.dish_id'),
  nullif(current_setting('smoke.other_venue_id', true), ''),
  'Hungry Official',
  4,
  'Integrity smoke review'
);

do $$
declare
  v_row record;
begin
  select venue_id, author_name into v_row
  from reviews
  where id = '00000000-0000-0046-e000-000000000001';

  if v_row.venue_id is distinct from current_setting('smoke.venue_id') then
    raise exception 'venue_id was not taken from the dish (got %)', v_row.venue_id;
  end if;
  if v_row.author_name is distinct from 'Integrity Reviewer' then
    raise exception 'author_name was not taken from the profile (got %)', v_row.author_name;
  end if;
end $$;

-- 2. A 0-star rating is refused.
do $$
begin
  begin
    insert into reviews (id, user_id, dish_id, rating, text)
    values (
      '00000000-0000-0046-e000-000000000002',
      '00000000-0000-0046-b000-000000000001',
      current_setting('smoke.dish_id'),
      0,
      'Zero stars'
    );
    raise exception 'a 0-star review was accepted';
  exception
    when check_violation then
      null;
  end;
end $$;

-- 3. The stall's owner cannot review their own stall.
insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0046-a000-000000000001',
  '00000000-0000-0046-b000-000000000002',
  'Integrity Merchant',
  'integrity-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, name, business_type)
values (
  '00000000-0000-0046-d000-000000000001',
  '00000000-0000-0046-a000-000000000001',
  current_setting('smoke.venue_id'),
  'Integrity Outlet',
  'hawker_stall'
);

do $$
begin
  begin
    insert into reviews (id, user_id, dish_id, rating, text)
    values (
      '00000000-0000-0046-e000-000000000003',
      '00000000-0000-0046-b000-000000000002',
      current_setting('smoke.dish_id'),
      5,
      'Best stall ever (I run it)'
    );
    raise exception 'a stall owner reviewed their own stall';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- 4. The trigger function is not executable by app roles.
do $$
begin
  if has_function_privilege('authenticated', 'app_private.reviews_before_insert_integrity()', 'execute')
    or has_function_privilege('anon', 'app_private.reviews_before_insert_integrity()', 'execute') then
    raise exception 'reviews_before_insert_integrity is executable by an app role';
  end if;
end $$;

rollback;
