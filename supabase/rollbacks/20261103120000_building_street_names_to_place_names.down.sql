-- Undo 20261103120000_building_street_names_to_place_names: puts each renamed building's old
-- (street address) name back. A building renamed again since is left as it is. The backup table
-- moves to the rollback_archive schema rather than being dropped.

update public.buildings bl
set name = k.old_name
from app_private.building_name_backup_20261103 k
where k.building_id = bl.id
  and bl.name = k.new_name;

create schema if not exists rollback_archive;
alter table app_private.building_name_backup_20261103 set schema rollback_archive;
