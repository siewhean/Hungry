-- Smoke checks for 20261028090000_taste_recommendations_card_fields.sql.
-- get_taste_recommendations returns the card fields (stall, price, photo, stall pin), falls back
-- to the building's position when a stall has no pin, and leaves out archived dishes, merchant
-- drafts, dishes whose menu is not approved for display and dishes at hidden non-food venues.
-- It stays VOLATILE (the rate limiter needs that) and callable by anon. Runs in a transaction
-- and rolls back. Brings its own building, so it runs on prod (no seed data) as well as staging.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-0049-building', 'Smoke 0049 Building', 'hawker_centre', 1.2803, 103.8448);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values
  ('smoke-0049-pin', 'smoke-0049-building', 'Smoke 0049 Stall', '#01-01', '1', 1.2810, 103.8450),
  ('smoke-0049-nopin', 'smoke-0049-building', 'Smoke 0049 No Pin', '#01-02', '1', null, null),
  ('smoke-0049-seven', 'smoke-0049-building', '7-Eleven', '#01-03', '1', null, null);

insert into dishes (
  id, venue_id, building_id, name, price, price_range, taste_tags, food_type, image_url,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-0049-good', 'smoke-0049-pin', 'smoke-0049-building', 'Smoke 0049 Chicken Rice', 5.50, '$',
   array['savory'], 'chicken rice', 'https://example.com/smoke-0049.jpg', true, 'licensed', true, 'licensed'),
  ('smoke-0049-nopin', 'smoke-0049-nopin', 'smoke-0049-building', 'Smoke 0049 Laksa', 6.00, '$',
   array['spicy'], null, null, true, 'licensed', false, 'unverified'),
  ('smoke-0049-archived', 'smoke-0049-pin', 'smoke-0049-building', 'Smoke 0049 Archived', 1, '$',
   array[]::text[], null, null, true, 'licensed', false, 'unverified'),
  ('smoke-0049-draft', 'smoke-0049-pin', 'smoke-0049-building', 'Smoke 0049 Draft', 1, '$',
   array[]::text[], null, null, true, 'licensed', false, 'unverified'),
  ('smoke-0049-unapproved', 'smoke-0049-pin', 'smoke-0049-building', 'Smoke 0049 Unapproved', 1, '$',
   array[]::text[], null, null, false, 'unverified', false, 'unverified'),
  ('smoke-0049-seven-dish', 'smoke-0049-seven', 'smoke-0049-building', 'Smoke 0049 Onigiri', 2, '$',
   array[]::text[], null, null, true, 'licensed', false, 'unverified');

update dishes set archived_at = now() where id = 'smoke-0049-archived';
update dishes set merchant_draft = true where id = 'smoke-0049-draft';

insert into dish_taste_vectors (dish_id, sweet, spicy, sour, salty, rich, aromatic, vector)
select id, 5, 5, 5, 5, 5, 5, '[5,5,5,5,5,5]'::vector(6)
from dishes
where id like 'smoke-0049-%';

do $$
declare
  v_good record;
  v_nopin record;
  v_ids text[];
begin
  select array_agg(r.dish_id order by r.dish_id) into v_ids
  from public.get_taste_recommendations(
    'home', array[5, 5, 5, 5, 5, 5]::double precision[], '{}'::text[], 'Smoke 0049',
    1.2803, 103.8448, null, '{}'::text[], 50
  ) r;
  if v_ids is distinct from array['smoke-0049-good', 'smoke-0049-nopin'] then
    raise exception 'only the two visible dishes should come back, got %', v_ids;
  end if;

  select * into v_good
  from public.get_taste_recommendations(
    'home', array[5, 5, 5, 5, 5, 5]::double precision[], '{}'::text[], 'Smoke 0049 Chicken',
    null, null, null, '{}'::text[], 5
  ) r
  where r.dish_id = 'smoke-0049-good';
  if v_good.venue_id is distinct from 'smoke-0049-pin'
    or v_good.venue_name is distinct from 'Smoke 0049 Stall'
    or v_good.unit_number is distinct from '#01-01'
    or v_good.name is distinct from 'Smoke 0049 Chicken Rice'
    or v_good.price is distinct from 5.50
    or v_good.food_type is distinct from 'chicken rice'
    or v_good.image_url is distinct from 'https://example.com/smoke-0049.jpg' then
    raise exception 'the card fields are wrong: %', to_jsonb(v_good);
  end if;
  if v_good.latitude is distinct from 1.2810 or v_good.longitude is distinct from 103.8450 then
    raise exception 'a stall with a pin should return its own pin: %', to_jsonb(v_good);
  end if;
  if v_good.taste_vector is null or v_good.dietary_flags is null then
    raise exception 'taste_vector and dietary_flags should always be filled';
  end if;

  select * into v_nopin
  from public.get_taste_recommendations(
    'home', array[5, 5, 5, 5, 5, 5]::double precision[], '{}'::text[], 'Smoke 0049 Laksa',
    null, null, null, '{}'::text[], 5
  ) r
  where r.dish_id = 'smoke-0049-nopin';
  if v_nopin.latitude is distinct from 1.2803 or v_nopin.longitude is distinct from 103.8448 then
    raise exception 'a stall without a pin should return its building position: %', to_jsonb(v_nopin);
  end if;
  if v_nopin.image_url is not null then
    raise exception 'a dish with no approved photo must not borrow another picture';
  end if;

  if (select provolatile from pg_proc where oid = 'public.get_taste_recommendations(text,double precision[],text[],text,double precision,double precision,integer,text[],integer)'::regprocedure) <> 'v' then
    raise exception 'get_taste_recommendations must stay VOLATILE for the rate limiter';
  end if;
  if not has_function_privilege('anon', 'public.get_taste_recommendations(text,double precision[],text[],text,double precision,double precision,integer,text[],integer)', 'execute') then
    raise exception 'anon must be able to call get_taste_recommendations (signed-out onboarding)';
  end if;
end $$;

rollback;
