-- Rebuild a venue's raw catalog cards once per transaction, not once per row.
--
-- 20261018150000_merchant_live_sync.sql added row-level AFTER triggers on
-- venues, dishes, dish_images and dish_dietary_flags. Each fired
-- catalog_raw_refresh_venue, which deletes and rebuilds all of the venue's
-- cards, so saving one dish with four photos and three dietary labels rebuilt
-- the venue about ten times.
--
-- The triggers are now deferred constraint triggers: they run at commit, after
-- every write in the transaction, and the first one for a venue rebuilds it and
-- marks the venue done in a transaction-local setting, so the rest skip. The
-- refresh still runs only for app-user writes (role authenticated), exactly as
-- before. merchant_save_dish (20261020060200) saves a dish and its children in
-- one transaction, so a save is one rebuild.
--
-- The trigger body lives in app_private (SECURITY DEFINER) and is not callable
-- by clients.

create schema if not exists app_private;

create or replace function app_private.catalog_raw_refresh_venue_deferred()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id text;
  v_dish_id text;
  v_marker text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return null;
  end if;

  if tg_table_name = 'venues' then
    if tg_op = 'DELETE' then v_venue_id := old.id; else v_venue_id := new.id; end if;
  elsif tg_table_name = 'dishes' then
    if tg_op = 'DELETE' then v_venue_id := old.venue_id; else v_venue_id := new.venue_id; end if;
  else
    if tg_op = 'DELETE' then v_dish_id := old.dish_id; else v_dish_id := new.dish_id; end if;
    select d.venue_id into v_venue_id from public.dishes d where d.id = v_dish_id;
  end if;

  if v_venue_id is null then
    return null;
  end if;

  v_marker := 'hungry.catalog_refreshed_' || md5(v_venue_id);
  if coalesce(current_setting(v_marker, true), '') = '1' then
    return null;
  end if;
  perform set_config(v_marker, '1', true);

  perform public.catalog_raw_refresh_venue(v_venue_id);
  return null;
end;
$$;

revoke all on function app_private.catalog_raw_refresh_venue_deferred()
  from public, anon, authenticated;

drop trigger if exists trg_catalog_raw_refresh_venue on public.venues;
create constraint trigger trg_catalog_raw_refresh_venue
after update on public.venues
deferrable initially deferred
for each row execute function app_private.catalog_raw_refresh_venue_deferred();

drop trigger if exists trg_catalog_raw_refresh_dish on public.dishes;
create constraint trigger trg_catalog_raw_refresh_dish
after insert or update or delete on public.dishes
deferrable initially deferred
for each row execute function app_private.catalog_raw_refresh_venue_deferred();

drop trigger if exists trg_catalog_raw_refresh_dish_image on public.dish_images;
create constraint trigger trg_catalog_raw_refresh_dish_image
after insert or update or delete on public.dish_images
deferrable initially deferred
for each row execute function app_private.catalog_raw_refresh_venue_deferred();

drop trigger if exists trg_catalog_raw_refresh_dish_dietary on public.dish_dietary_flags;
create constraint trigger trg_catalog_raw_refresh_dish_dietary
after insert or update or delete on public.dish_dietary_flags
deferrable initially deferred
for each row execute function app_private.catalog_raw_refresh_venue_deferred();
