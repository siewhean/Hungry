-- expect-row-loss: public.launch_zone_places, app_private.launch_zone_building_backup, app_private.launch_zone_move_backup
-- Undo 20261116130000_launch_zone: every stall, dish and other row that was moved goes back to the
-- building row it came from, every building row gets its old name, type and stall count back, the
-- catalog cards take the old building fields from those rows, and the zone list, the backups and
-- the functions are dropped. Rows moved or created since the up (a stall added to the surviving
-- row, for example) are not touched. updated_at triggers are off for the restore, as in the up.
-- Runs in one transaction: SET CONSTRAINTS ALL IMMEDIATE fires the deferred catalog refresh
-- triggers before the tables are altered, which otherwise fails with "pending trigger events".

set constraints all immediate;

alter table public.buildings disable trigger trg_buildings_updated_at;
alter table public.venues disable trigger trg_venues_updated_at;
alter table public.dishes disable trigger trg_dishes_updated_at;

update public.venues t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'venues' and k.row_id = t.id::text and t.building_id <> k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.dishes t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'dishes' and k.row_id = t.id::text and t.building_id <> k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.dishes_draft t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'dishes_draft' and k.row_id = t.id::text and t.building_id <> k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.posts t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'posts' and k.row_id = t.id::text and t.building_id is distinct from k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.stall_posts t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'stall_posts' and k.row_id = t.id::text and t.building_id is distinct from k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.bites t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'bites' and k.row_id = t.id::text and t.building_id is distinct from k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.merchant_outlets t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'merchant_outlets' and k.row_id = t.id::text and t.building_id is distinct from k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.merchant_claim_interests t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'merchant_claim_interests' and k.row_id = t.id::text and t.building_id <> k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.menu_photo_submissions t set building_id = k.old_building_id
from app_private.launch_zone_move_backup k
where k.table_name = 'menu_photo_submissions' and k.row_id = t.id::text and t.building_id <> k.old_building_id
  and exists (select 1 from public.buildings b where b.id = k.old_building_id);

update public.buildings b
set name = k.old_name, building_type = k.old_type, venue_count = k.old_venue_count
from app_private.launch_zone_building_backup k
where k.building_id = b.id;

-- The cards read the restored rows (still needs the backups, so it runs before they are dropped).
select app_private.launch_zone_sync_cards();

set constraints all immediate;

alter table public.buildings enable trigger trg_buildings_updated_at;
alter table public.venues enable trigger trg_venues_updated_at;
alter table public.dishes enable trigger trg_dishes_updated_at;

-- Keep what is about to be dropped (the zone list and both backups), so nothing is lost for good.
create schema if not exists rollback_archive;
drop table if exists rollback_archive.launch_zone_places_20261116130000;
create table rollback_archive.launch_zone_places_20261116130000 as
  select * from public.launch_zone_places;
drop table if exists rollback_archive.launch_zone_building_backup_20261116130000;
create table rollback_archive.launch_zone_building_backup_20261116130000 as
  select * from app_private.launch_zone_building_backup;
drop table if exists rollback_archive.launch_zone_move_backup_20261116130000;
create table rollback_archive.launch_zone_move_backup_20261116130000 as
  select * from app_private.launch_zone_move_backup;

drop function if exists public.get_launch_zone_places();
drop function if exists app_private.launch_zone_report();
drop function if exists app_private.apply_launch_zone();
drop function if exists app_private.launch_zone_sync_cards();
drop function if exists app_private.launch_zone_members();
drop function if exists app_private.launch_zone_definition();

drop table if exists public.launch_zone_places;
drop table if exists app_private.launch_zone_move_backup;
drop table if exists app_private.launch_zone_building_backup;
