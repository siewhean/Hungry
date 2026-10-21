-- Smoke checks for 20261021100000_account_deletion_removes_profile.sql.
-- Anonymising a deletion request removes the profile and everything that
-- hangs off it (public Lists, settings, bio, taste vector, impressions),
-- while the user's review stays as "Deleted user". Rolls back.

begin;

insert into user_profiles (id, display_name, bio)
values ('00000000-0000-0134-b000-000000000001', 'Deletion Smoke', 'Smoke bio')
on conflict (id) do nothing;

create temp table smoke_dish on commit drop as
select id, venue_id from dishes order by id limit 1;

insert into portfolios (id, owner_id, name, type, visibility)
values (
  '00000000-0000-0134-f000-000000000001', '00000000-0000-0134-b000-000000000001',
  'Smoke public list', 'collection', 'public'
);
insert into user_settings (user_id, key, value)
values ('00000000-0000-0134-b000-000000000001', 'smoke', '{}'::jsonb);
insert into user_taste_vectors (user_id, sweet)
values ('00000000-0000-0134-b000-000000000001', 9);
insert into recommendation_impressions (user_id, surface, dish_ids)
select '00000000-0000-0134-b000-000000000001', 'smoke', array[id] from smoke_dish;
insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
select '00000000-0000-0134-e000-000000000001', '00000000-0000-0134-b000-000000000001',
  id, venue_id, 'Deletion Smoke', 4, 'Smoke review'
from smoke_dish;

insert into account_deletion_requests (id, user_id, status)
values ('00000000-0000-0134-a000-000000000001', '00000000-0000-0134-b000-000000000001', 'processing');

select public.anonymize_account_deletion_request('00000000-0000-0134-a000-000000000001', null);

do $$
declare
  v_user uuid := '00000000-0000-0134-b000-000000000001';
begin
  if exists (select 1 from user_profiles where id = v_user) then
    raise exception 'user_profiles row survived deletion';
  end if;
  if exists (select 1 from public_profiles where id = v_user) then
    raise exception 'public_profiles row (bio) survived deletion';
  end if;
  if exists (select 1 from portfolios where owner_id = v_user) then
    raise exception 'Lists survived deletion';
  end if;
  if exists (select 1 from user_settings where user_id = v_user) then
    raise exception 'user_settings survived deletion';
  end if;
  if exists (select 1 from user_taste_vectors where user_id = v_user) then
    raise exception 'user_taste_vectors survived deletion';
  end if;
  if exists (select 1 from recommendation_impressions where user_id = v_user) then
    raise exception 'recommendation_impressions survived deletion';
  end if;
  if not exists (
    select 1 from reviews
    where id = '00000000-0000-0134-e000-000000000001'
      and user_id is null and author_name = 'Deleted user'
  ) then
    raise exception 'review was not kept as Deleted user';
  end if;
end $$;

select 'account_deletion_removes_profile smoke passed' as result;

rollback;
