-- smoke: supabase/smoke/drop_building_name_backup.sql
-- expect-row-loss: app_private.building_name_backup_20261103
-- Drop the one-off backup of building names (thread "Audit features, add A/B tests, clean up
-- project", 2026-11-08). 20261103120000 renamed 422 street-named buildings to their place names and
-- kept the old names in app_private.building_name_backup_20261103 so it could be undone. sh asked
-- for the backup to go. Nothing in the app, an RPC or a job reads it.
-- The 422 rows are written out in full in the down file, so the down puts the table back exactly
-- as it was. To undo 20261103120000 after this has shipped, undo this migration first.
-- Rollback: supabase/rollbacks/20261108090000_drop_building_name_backup.down.sql.

drop table if exists app_private.building_name_backup_20261103;
