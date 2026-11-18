-- Smoke checks for 20261116120000_reviews_survive_dish_removal.sql.
-- A dish that has reviews cannot be deleted; archiving it keeps the review and the dish name;
-- a dish with no reviews can still be deleted. Creates its own building, stall, dishes and diner
-- and rolls back.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-r02-building', 'Smoke R02 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values ('smoke-r02-venue', 'smoke-r02-building', 'Smoke R02 Stall', '#01-01', 'L1', 1.301, 103.801);

insert into dishes (
  id, venue_id, building_id, name, price, price_range,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-r02-reviewed', 'smoke-r02-venue', 'smoke-r02-building', 'Smoke R02 Laksa', 5, 'S$5.00',
   true, 'licensed', true, 'licensed'),
  ('smoke-r02-unreviewed', 'smoke-r02-venue', 'smoke-r02-building', 'Smoke R02 Kopi', 2, 'S$2.00',
   true, 'licensed', true, 'licensed');

insert into auth.users (id, email)
values ('00000000-0000-0201-b000-000000000001', 'r02-diner@example.test');

select set_config('request.jwt.claim.role', 'service_role', true);
insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0201-e000-000000000001',
  '00000000-0000-0201-b000-000000000001',
  'smoke-r02-reviewed',
  'smoke-r02-venue',
  'R02 Diner',
  4,
  'Survives the dish being removed'
);

-- 1. The key restricts.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.conrelid = 'public.reviews'::regclass
      and c.confrelid = 'public.dishes'::regclass
      and a.attname = 'dish_id'
      and c.confdeltype = 'r'
  ) then
    raise exception 'reviews.dish_id is not ON DELETE RESTRICT';
  end if;
end $$;

-- 2. Deleting a reviewed dish is refused, and the review is untouched.
do $$
begin
  begin
    delete from dishes where id = 'smoke-r02-reviewed';
    raise exception 'a dish with reviews was deleted';
  exception when foreign_key_violation then null;
  end;
  if not exists (select 1 from dishes where id = 'smoke-r02-reviewed') then
    raise exception 'the reviewed dish is gone after a refused delete';
  end if;
  if not exists (select 1 from reviews where id = '00000000-0000-0201-e000-000000000001') then
    raise exception 'the review is gone after a refused delete';
  end if;
end $$;

-- 3. Archiving keeps the review, and the dish name is still readable for the profile card.
update dishes set archived_at = now() where id = 'smoke-r02-reviewed';

do $$
begin
  if not exists (select 1 from reviews where id = '00000000-0000-0201-e000-000000000001') then
    raise exception 'archiving the dish removed its review';
  end if;
  if not exists (
    select 1 from public.get_item_details(array['smoke-r02-reviewed'], '{}'::text[])
    where dish_id = 'smoke-r02-reviewed' and name = 'Smoke R02 Laksa'
  ) then
    raise exception 'an archived dish lost its name for the review card';
  end if;
end $$;

-- 4. A dish with no reviews can still be deleted.
delete from dishes where id = 'smoke-r02-unreviewed';
do $$
begin
  if exists (select 1 from dishes where id = 'smoke-r02-unreviewed') then
    raise exception 'an unreviewed dish could not be deleted';
  end if;
end $$;

select 'reviews_survive_dish_removal smoke passed' as result;

rollback;
