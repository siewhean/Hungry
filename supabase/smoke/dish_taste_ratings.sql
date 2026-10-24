-- Smoke checks for 20261024100000_dish_taste_ratings.sql.
-- A signed-in diner rates a dish once (a second rating replaces the first), sees only their
-- own rows, cannot write the table directly, and the summary stays hidden under 3 raters.
-- Runs in a transaction and rolls back.

begin;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0046-b000-000000000001', 'Taste Rater One'),
  ('00000000-0000-0046-b000-000000000002', 'Taste Rater Two'),
  ('00000000-0000-0046-b000-000000000003', 'Taste Rater Three')
on conflict (id) do nothing;

create temp table smoke_dish on commit drop as
select id from dishes order by id limit 1;
grant select on smoke_dish to authenticated;

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- Rater one rates twice: the second call replaces the first in place.
select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000001', true);
select public.submit_dish_taste_rating(id, '{"spicy": 4, "rich": 6}'::jsonb) from smoke_dish;
select public.submit_dish_taste_rating(id, '{"spicy": 5.04}'::jsonb) from smoke_dish;

do $$
declare
  v_row public.dish_taste_ratings;
begin
  if (select count(*) from public.dish_taste_ratings) <> 1 then
    raise exception 'expected one row for the caller';
  end if;
  select * into v_row from public.dish_taste_ratings;
  if v_row.spicy <> 5.0 or v_row.rich is not null then
    raise exception 'second rating should replace the first (spicy %, rich %)', v_row.spicy, v_row.rich;
  end if;
end $$;

do $$
begin
  insert into public.dish_taste_ratings (user_id, dish_id, spicy)
  select '00000000-0000-0046-b000-000000000001', id, 3 from smoke_dish;
  raise exception 'clients must not insert ratings directly';
exception
  when insufficient_privilege then null;
end $$;

do $$
begin
  perform public.submit_dish_taste_rating((select id from smoke_dish), '{"spicy": 11}'::jsonb);
  raise exception 'a level above 10 must be refused';
exception
  when check_violation then null;
end $$;

do $$
begin
  perform public.submit_dish_taste_rating((select id from smoke_dish), '{}'::jsonb);
  raise exception 'a rating with no axis must be refused';
exception
  when check_violation then null;
end $$;

-- Two more raters: the summary appears at 3 for spicy only.
select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000002', true);
select public.submit_dish_taste_rating(id, '{"spicy": 7, "sour": 2}'::jsonb) from smoke_dish;
do $$
begin
  if (select count(*) from public.dish_taste_ratings) <> 1 then
    raise exception 'RLS should hide other diners'' ratings';
  end if;
  if (select count(*) from public.get_dish_taste_rating_summary((select id from smoke_dish))) <> 0 then
    raise exception 'summary must stay hidden under 3 raters';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0046-b000-000000000003', true);
select public.submit_dish_taste_rating(id, '{"spicy": 6}'::jsonb) from smoke_dish;
do $$
declare
  v_avg numeric;
begin
  select average into v_avg
  from public.get_dish_taste_rating_summary((select id from smoke_dish))
  where axis = 'spicy';
  if v_avg is distinct from 6.0 then
    raise exception 'spicy average % <> 6.0', v_avg;
  end if;
  if exists (
    select 1 from public.get_dish_taste_rating_summary((select id from smoke_dish)) where axis = 'sour'
  ) then
    raise exception 'sour has one rater and must stay hidden';
  end if;
end $$;

-- Delete-own works.
delete from public.dish_taste_ratings;
do $$
begin
  if (select count(*) from public.dish_taste_ratings) <> 0 then
    raise exception 'delete-own should clear the caller''s rating';
  end if;
end $$;

reset role;
do $$
begin
  if (select count(*) from public.dish_taste_ratings d join smoke_dish s on s.id = d.dish_id) <> 2 then
    raise exception 'delete-own must leave other diners alone';
  end if;
end $$;

rollback;
