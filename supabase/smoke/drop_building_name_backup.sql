-- Smoke checks for 20261108090000_drop_building_name_backup.sql.
-- Runs in a transaction and rolls back. The backup table is gone.

begin;

do $$
begin
  if to_regclass('app_private.building_name_backup_20261103') is not null then
    raise exception 'the backup table app_private.building_name_backup_20261103 still exists';
  end if;
end $$;

rollback;
