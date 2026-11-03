-- expect-row-loss: app_private.building_name_backup_20261103
-- Undo 20261103120000_building_street_names_to_place_names: puts each renamed building's old
-- (street address) name back. A building renamed again since is left as it is. The backup rows
-- move to the rollback_archive schema rather than being dropped, and a second run (up, down, up,
-- down) merges into the archive table instead of failing.

update public.buildings bl
set name = k.old_name
from app_private.building_name_backup_20261103 k
where k.building_id = bl.id
  and bl.name = k.new_name;

create schema if not exists rollback_archive;
create table if not exists rollback_archive.building_name_backup_20261103
  (like app_private.building_name_backup_20261103 including all);
insert into rollback_archive.building_name_backup_20261103
select * from app_private.building_name_backup_20261103
on conflict (building_id) do nothing;
drop table app_private.building_name_backup_20261103;
