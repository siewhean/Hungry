-- smoke: supabase/smoke/launch_zone.sql
-- Launch zone set-up (build plan package 1.1; sh, 2026-11-14/16: Jurong West Hawker Centre, Pioneer
-- Mall and block 651). Three parts:
--
-- 1. The data fix. The hawker centre and block 651 are named by their street address
--    ("50 Jurong West Street 61", "651 Jurong West Street 61") and Pioneer Mall is split over two
--    building rows ("Pioneer Mall" and "638A Jurong West Street 61"). app_private.apply_launch_zone()
--    finds each place's building rows by exact name (the place's name or one of its street-address
--    names, see launch_zone_definition), keeps the best-stocked row, moves the other rows' stalls
--    and dishes (and any post, draft or outlet that points at them) onto it, names it, and
--    refreshes the building fields on the live catalog cards so Search shows the real names at once.
--    The emptied rows are kept (nothing is deleted). The old names, types, stall counts and every
--    moved row's old building are saved in app_private.launch_zone_*_backup for the down migration.
--    Run it again any time (it does nothing when there is nothing to do); package 1.7 calls it after
--    the zone's rows reach production, where the buildings do not exist yet.
-- 2. public.launch_zone_places + get_launch_zone_places(): the short list Home, Search and the
--    onboarding picks read.
-- 3. app_private.launch_zone_report(): the scoreboard for the phase (stalls, stalls with dishes,
--    priced dishes, photos, hours), run from scripts/db/launch-zone-report.sh. Not callable by the app.
--
-- Block 651's name is a placeholder ("Block 651") until sh says what people call it: change the one
-- line in launch_zone_definition() and run apply_launch_zone() again.
--
-- updated_at is left alone (the updated_at triggers on buildings, venues and dishes are switched off
-- for the moves and the rename, as 20261114170000 did) because moving a stall between two rows of
-- the same place is not a content edit, and so the down migration can put every row back exactly.
-- Rollback: supabase/rollbacks/20261116130000_launch_zone.down.sql.
-- race-ok: runs from the migration or from ship scripts, one caller at a time; it also takes an
-- advisory lock so two callers cannot interleave.

create schema if not exists app_private;

create table if not exists app_private.launch_zone_building_backup (
  building_id text primary key,
  old_name text not null,
  old_type text not null,
  old_venue_count integer,
  saved_at timestamptz not null default now()
);
alter table app_private.launch_zone_building_backup enable row level security;
revoke all on table app_private.launch_zone_building_backup from public, anon, authenticated;

create table if not exists app_private.launch_zone_move_backup (
  table_name text not null,
  row_id text not null,
  old_building_id text not null,
  saved_at timestamptz not null default now(),
  primary key (table_name, row_id)
);
alter table app_private.launch_zone_move_backup enable row level security;
revoke all on table app_private.launch_zone_move_backup from public, anon, authenticated;

create table if not exists public.launch_zone_places (
  slug text primary key,
  building_id text not null unique references public.buildings(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.launch_zone_places enable row level security;
revoke all on table public.launch_zone_places from public, anon, authenticated;

-- The places of the zone. aliases are the street-address names the catalog gave the same place.
create or replace function app_private.launch_zone_definition()
returns table (slug text, display_name text, building_type text, aliases text[], sort_order integer)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    ('jurong-west-hawker-centre', 'Jurong West Hawker Centre', 'hawker_centre'::text,
      array['50 Jurong West Street 61'], 1),
    ('pioneer-mall', 'Pioneer Mall', 'mall'::text,
      array['638A Jurong West Street 61', '638 Jurong West Street 61'], 2),
    -- Placeholder name: sh to confirm what people call block 651. The type stays as loaded.
    ('block-651', 'Block 651', null::text,
      array['651 Jurong West Street 61'], 3)
  ) as z(slug, display_name, building_type, aliases, sort_order);
$$;

-- Every building row that belongs to a zone place, and the row that survives for it (the one with the
-- most stalls; ties by id, so the pick is stable between runs).
create or replace function app_private.launch_zone_members()
returns table (slug text, building_id text, survivor_id text, display_name text, building_type text, sort_order integer)
language sql
stable
set search_path = public, app_private
as $$
  with found as (
    select d.slug, d.display_name, d.building_type, d.sort_order, b.id as building_id,
           (select count(*) from public.venues v where v.building_id = b.id) as stalls
    from app_private.launch_zone_definition() d
    join public.buildings b
      on lower(btrim(b.name)) = any (select lower(btrim(n)) from unnest(d.aliases || d.display_name) n)
      -- the row already registered for the slug stays found after display_name is changed
      or b.id in (select lp.building_id from public.launch_zone_places lp where lp.slug = d.slug)
  )
  select f.slug, f.building_id,
         first_value(f.building_id) over (partition by f.slug order by f.stalls desc, f.building_id),
         f.display_name, f.building_type, f.sort_order
  from found f;
$$;

-- Refreshes building_id / building_name / building_type on the cards of the live and not yet expired
-- catalog releases for every card whose building is part of the zone work (current, moved from or
-- saved in a backup). The values come from the stall's own row, so this undoes a move as well.
create or replace function app_private.launch_zone_sync_cards()
returns integer
language plpgsql
security definer
set search_path = public, app_private, extensions
as $$
declare
  v_venues integer;
  v_dishes integer;
begin
  with touched as (
    select building_id from app_private.launch_zone_building_backup
    union select old_building_id from app_private.launch_zone_move_backup
    union select building_id from public.launch_zone_places
  )
  update public.catalog_raw_venue_cards c
  set building_id = v.building_id, building_name = b.name, building_type = b.building_type
  from public.venues v
  join public.buildings b on b.id = v.building_id
  where c.id = v.id
    and c.building_id in (select building_id from touched)
    and (c.building_id, c.building_name, c.building_type) is distinct from (v.building_id, b.name, b.building_type)
    and c.release_id in (
      select r.id from public.catalog_releases r
      where r.status = 'active' or (r.status = 'retired' and r.expires_at > now())
    );
  get diagnostics v_venues = row_count;

  with touched as (
    select building_id from app_private.launch_zone_building_backup
    union select old_building_id from app_private.launch_zone_move_backup
    union select building_id from public.launch_zone_places
  )
  update public.catalog_raw_dish_cards c
  set building_id = v.building_id, building_name = b.name, building_type = b.building_type
  from public.venues v
  join public.buildings b on b.id = v.building_id
  where c.venue_id = v.id
    and c.building_id in (select building_id from touched)
    and (c.building_id, c.building_name, c.building_type) is distinct from (v.building_id, b.name, b.building_type)
    and c.release_id in (
      select r.id from public.catalog_releases r
      where r.status = 'active' or (r.status = 'retired' and r.expires_at > now())
    );
  get diagnostics v_dishes = row_count;

  return v_venues + v_dishes;
end;
$$;

create or replace function app_private.apply_launch_zone()
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, extensions
as $$
declare
  v_places integer;
  v_renamed integer;
  v_moved integer := 0;
  v_step integer;
  v_cards integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('launch_zone', 0));
  -- Run pending deferred catalog triggers now: ALTER TABLE below fails with "pending trigger events".
  set constraints all immediate;

  -- The first copy of a building's name, type and stall count is the original; a re-run never overwrites it.
  insert into app_private.launch_zone_building_backup (building_id, old_name, old_type, old_venue_count)
  select b.id, b.name, b.building_type, b.venue_count
  from public.buildings b
  where b.id in (select m.building_id from app_private.launch_zone_members() m)
  on conflict (building_id) do nothing;

  alter table public.buildings disable trigger trg_buildings_updated_at;
  alter table public.venues disable trigger trg_venues_updated_at;
  alter table public.dishes disable trigger trg_dishes_updated_at;

  -- Stalls and dishes first: the catalog's own tables.
  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.venues t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'venues', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.dishes t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'dishes', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  -- Anything else that points at an emptied row follows its stall. updated_at moves with these.
  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.dishes_draft t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'dishes_draft', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.posts t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'posts', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.stall_posts t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'stall_posts', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.bites t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'bites', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.merchant_outlets t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'merchant_outlets', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.merchant_claim_interests t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'merchant_claim_interests', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  with m as (select m.building_id, m.survivor_id from app_private.launch_zone_members() m where m.building_id <> m.survivor_id),
  moved as (
    update public.menu_photo_submissions t set building_id = m.survivor_id
    from m where t.building_id = m.building_id
    returning t.id::text as row_id, m.building_id as old_building_id
  ), saved as (
    insert into app_private.launch_zone_move_backup (table_name, row_id, old_building_id)
    select 'menu_photo_submissions', row_id, old_building_id from moved
    on conflict (table_name, row_id) do nothing
    returning 1
  )
  select count(*) into v_step from moved;
  v_moved := v_moved + v_step;

  -- Name the surviving row, and recount stalls on every row touched.
  update public.buildings b
  set name = m.display_name, building_type = coalesce(m.building_type, b.building_type)
  from app_private.launch_zone_members() m
  where b.id = m.survivor_id
    and m.building_id = m.survivor_id
    and (b.name, b.building_type) is distinct from (m.display_name, coalesce(m.building_type, b.building_type));
  get diagnostics v_renamed = row_count;

  update public.buildings b
  set venue_count = (select count(*)::integer from public.venues v where v.building_id = b.id)
  where b.id in (select m.building_id from app_private.launch_zone_members() m)
    and b.venue_count is distinct from (select count(*)::integer from public.venues v where v.building_id = b.id);

  -- The short list. The surviving row of each place; a place with no row yet is simply absent.
  insert into public.launch_zone_places (slug, building_id, sort_order)
  select distinct m.slug, m.survivor_id, m.sort_order from app_private.launch_zone_members() m
  on conflict (slug) do update set building_id = excluded.building_id, sort_order = excluded.sort_order;
  get diagnostics v_places = row_count;

  -- Catalog cards (what Search reads) take the new names now, without waiting for a republish.
  v_cards := app_private.launch_zone_sync_cards();

  -- Fire the deferred catalog triggers before the ALTER TABLEs, then put the updated_at triggers back.
  set constraints all immediate;
  alter table public.buildings enable trigger trg_buildings_updated_at;
  alter table public.venues enable trigger trg_venues_updated_at;
  alter table public.dishes enable trigger trg_dishes_updated_at;

  return jsonb_build_object('places', v_places, 'renamed', v_renamed, 'rows_moved', v_moved, 'cards_updated', v_cards);
end;
$$;

revoke all on function app_private.launch_zone_definition() from public, anon, authenticated;
revoke all on function app_private.launch_zone_members() from public, anon, authenticated;
revoke all on function app_private.launch_zone_sync_cards() from public, anon, authenticated;
revoke all on function app_private.apply_launch_zone() from public, anon, authenticated;

-- What Home, Search and the onboarding picks read: the launch zone's places, in order, with the
-- stall count from the live catalog release (so it matches what Search will return for the place).
create or replace function public.get_launch_zone_places()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_release uuid;
  v_items jsonb;
begin
  perform public.catalog_raw_require_authenticated();
  select r.id into v_release from public.catalog_releases r where r.status = 'active' limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id,
      'slug', z.slug,
      'name', b.name,
      'building_type', b.building_type,
      'venue_count', (
        select count(*) from public.catalog_raw_venue_cards c
        where c.release_id = v_release and c.building_id = b.id
      ),
      'latitude', b.latitude,
      'longitude', b.longitude
    ) order by z.sort_order, z.slug), '[]'::jsonb)
  into v_items
  from public.launch_zone_places z
  join public.buildings b on b.id = z.building_id;

  return v_items;
end;
$$;

revoke all on function public.get_launch_zone_places() from public, anon;
grant execute on function public.get_launch_zone_places() to authenticated;

-- The scoreboard. One row per place and a last row named 'total'. Counts the live tables (not a
-- release), so a stall approved a minute ago shows. A dish counts when it is not archived and not a
-- merchant draft; a photo counts when the app would display it (approved, with rights).
create or replace function app_private.launch_zone_report()
returns table (
  place text,
  stalls integer,
  stalls_with_dishes integer,
  dishes integer,
  priced_dishes integer,
  dishes_with_photo integer,
  stalls_with_hours_text integer,
  stalls_with_schedule integer
)
language sql
stable
set search_path = public, app_private
as $$
  with per_place as (
    select z.sort_order, b.name as place,
      (select count(*) from public.venues v where v.building_id = b.id)::integer as stalls,
      (select count(distinct d.venue_id) from public.dishes d
        where d.building_id = b.id and d.archived_at is null and coalesce(d.merchant_draft, false) = false)::integer as stalls_with_dishes,
      (select count(*) from public.dishes d
        where d.building_id = b.id and d.archived_at is null and coalesce(d.merchant_draft, false) = false)::integer as dishes,
      (select count(*) from public.dishes d
        where d.building_id = b.id and d.archived_at is null and coalesce(d.merchant_draft, false) = false
          and d.price is not null and d.price > 0)::integer as priced_dishes,
      (select count(*) from public.dishes d
        where d.building_id = b.id and d.archived_at is null and coalesce(d.merchant_draft, false) = false
          and (public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url) is not null
            or exists (
              select 1 from public.dish_images di
              where di.dish_id = d.id
                and public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) is not null
            )))::integer as dishes_with_photo,
      (select count(*) from public.venues v
        where v.building_id = b.id and nullif(btrim(coalesce(v.operating_hours, '')), '') is not null)::integer as stalls_with_hours_text,
      (select count(*) from public.venues v
        where v.building_id = b.id and v.opening_schedule is not null and v.opening_schedule not in ('null'::jsonb, '{}'::jsonb, '[]'::jsonb))::integer as stalls_with_schedule
    from public.launch_zone_places z
    join public.buildings b on b.id = z.building_id
  )
  select p.place, p.stalls, p.stalls_with_dishes, p.dishes, p.priced_dishes, p.dishes_with_photo,
         p.stalls_with_hours_text, p.stalls_with_schedule
  from per_place p
  union all
  select 'total', coalesce(sum(p.stalls), 0)::integer, coalesce(sum(p.stalls_with_dishes), 0)::integer,
         coalesce(sum(p.dishes), 0)::integer, coalesce(sum(p.priced_dishes), 0)::integer,
         coalesce(sum(p.dishes_with_photo), 0)::integer, coalesce(sum(p.stalls_with_hours_text), 0)::integer,
         coalesce(sum(p.stalls_with_schedule), 0)::integer
  from per_place p;
$$;

revoke all on function app_private.launch_zone_report() from public, anon, authenticated;

select app_private.apply_launch_zone();
