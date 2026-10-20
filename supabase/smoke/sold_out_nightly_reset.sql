-- Smoke checks for 20261020130200_sold_out_nightly_reset.sql.
-- The nightly job is scheduled for 16:00 UTC (00:00 Singapore); the reset
-- clears sold_out in any spelling, keeps featured and section flags, leaves
-- other dishes alone, rebuilds the venue's raw catalog card, and is not
-- callable by app users. Rolls back.

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-d28-building', 'Smoke D28 Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values ('smoke-d28-venue', 'smoke-d28-building', 'Smoke D28 Stall', '#01-01', 'L1', 1.301, 103.801);

insert into dishes (id, venue_id, building_id, name, price, price_range, availability_flags)
values
  ('smoke-d28-sold-out', 'smoke-d28-venue', 'smoke-d28-building', 'Sold Out Dish', 4, 'S$4.00',
   array['section:Mains', 'Sold Out', 'featured']),
  ('smoke-d28-available', 'smoke-d28-venue', 'smoke-d28-building', 'Available Dish', 4, 'S$4.00',
   array['section:Drinks']);

-- Reuse the live database's active release; only one may be active.
insert into catalog_releases (id, status, activated_at)
select '00000000-0000-0132-c000-000000000001', 'active', now()
where not exists (select 1 from catalog_releases where status = 'active');
select public.catalog_raw_refresh_venue('smoke-d28-venue');
-- Pretend the card is stale so the rebuild is visible.
update catalog_raw_dish_cards set name = 'stale'
where id = 'smoke-d28-sold-out'
  and release_id = (select id from catalog_releases where status = 'active' limit 1);

do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'reset-sold-out-dishes'
      and schedule = '0 16 * * *'
      and command = 'select app_private.reset_sold_out_dishes()'
  ) then
    raise exception 'reset-sold-out-dishes is not scheduled for Singapore midnight';
  end if;
  if has_function_privilege('authenticated', 'app_private.reset_sold_out_dishes()', 'execute')
     or has_function_privilege('anon', 'app_private.reset_sold_out_dishes()', 'execute') then
    raise exception 'app users can run the sold-out reset';
  end if;
end $$;

do $$
declare
  v_reset integer := app_private.reset_sold_out_dishes();
begin
  if v_reset < 1 then
    raise exception 'reset turned no dishes back on';
  end if;
  if (select availability_flags from dishes where id = 'smoke-d28-sold-out')
     is distinct from array['section:Mains', 'featured'] then
    raise exception 'reset did not clear only sold_out: %',
      (select availability_flags from dishes where id = 'smoke-d28-sold-out');
  end if;
  if (select availability_flags from dishes where id = 'smoke-d28-available')
     is distinct from array['section:Drinks'] then
    raise exception 'reset changed a dish that was not sold out';
  end if;
  if (
    select name from catalog_raw_dish_cards
    where id = 'smoke-d28-sold-out'
      and release_id = (select id from catalog_releases where status = 'active' limit 1)
  ) <> 'Sold Out Dish' then
    raise exception 'reset did not rebuild the venue catalog card';
  end if;
end $$;

select 'sold_out_nightly_reset smoke passed' as result;

rollback;
