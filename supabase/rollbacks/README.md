Down migrations for the safe-migration process. One file per migration, same name plus `.down.sql`:
`supabase/migrations/20261022110000_x.sql` -> `supabase/rollbacks/20261022110000_x.down.sql`.
This folder is deliberately outside `supabase/migrations/` so `supabase db push` never applies them.
See `supabase/manual/safe-migration-runbook.md`.
