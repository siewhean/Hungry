-- Smoke checks for 20261022050000_stall_dish_detail_reads.sql.
-- get_venue_detail returns the stall photo, opening schedule and the venue's own
-- coordinate; get_dish_detail returns taste_confidence and updated_at. Both stay
-- security invoker and readable by guests. Runs in a transaction and rolls back.

begin;

do $$
declare
  venue_def text;
  dish_def text;
begin
  select pg_get_functiondef('public.get_venue_detail(text)'::regprocedure) into venue_def;
  select pg_get_functiondef('public.get_dish_detail(text)'::regprocedure) into dish_def;

  if (select p.prosecdef from pg_proc p where p.oid = 'public.get_venue_detail(text)'::regprocedure) then
    raise exception 'get_venue_detail must stay security invoker';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = 'public.get_dish_detail(text)'::regprocedure) then
    raise exception 'get_dish_detail must stay security invoker';
  end if;

  if venue_def !~* 'display_image_url' then
    raise exception 'get_venue_detail must return display_image_url';
  end if;
  if venue_def !~* 'opening_schedule' then
    raise exception 'get_venue_detail must return opening_schedule';
  end if;
  if venue_def !~* 'catalog_display_image_url' then
    raise exception 'get_venue_detail must read the stall photo through catalog_display_image_url';
  end if;
  if dish_def !~* 'taste_confidence' then
    raise exception 'get_dish_detail must return taste_confidence';
  end if;
  if dish_def !~* 'updated_at' then
    raise exception 'get_dish_detail must return updated_at';
  end if;

  if not has_function_privilege('anon', 'public.get_venue_detail(text)', 'execute')
     or not has_function_privilege('anon', 'public.get_dish_detail(text)', 'execute') then
    raise exception 'guests must be able to read stall and dish detail';
  end if;
end $$;

-- An unknown id reads as no rows, never an error.
do $$
begin
  if exists (select 1 from public.get_venue_detail('stall-dish-detail-smoke-missing')) then
    raise exception 'unknown venue must return no rows';
  end if;
  if exists (select 1 from public.get_dish_detail('stall-dish-detail-smoke-missing')) then
    raise exception 'unknown dish must return no rows';
  end if;
end $$;

rollback;
