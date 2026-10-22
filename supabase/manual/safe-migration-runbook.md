# Safe migration runbook

Every schema change goes: **write up + down -> back up -> rehearse on staging -> ship to prod -> smokes**.
CI enforces the first and third steps for every migration newer than `20261022110000`
(`scripts/check-migration-safety.mjs`). The scripts live in `scripts/db/`.

The free Supabase plan has **no managed backups or point-in-time restore**, so the dump taken by
`scripts/db/backup.sh` is the only backup. Nothing here replaces it.

## One-time setup (owner)

1. Create a second Supabase project, `hungry-staging`, on the Free plan in the same region as production.
   Never copy production keys, secrets or user data into it.
2. In a Terminal, from the Hungry repo, set the connection details for this shell (zsh). Use the
   session/transaction pooler URL from Project Settings > Database; the URL has no password.
   Port 6543 worked from your network, 5432 timed out.

   ```bash
   export STAGING_DB_URL='postgresql://postgres.<staging-ref>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require&connect_timeout=15'
   export PROD_DB_URL='postgresql://postgres.yrlxjeovwslirseajomz@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&connect_timeout=15'
   ```

   Then, each on its own line (pasting them in a block swallows the next line):

   ```bash
   read -s "STAGING_PGPASSWORD?Staging DB password: "; echo; export STAGING_PGPASSWORD
   read -s "PROD_PGPASSWORD?Prod DB password: "; echo; export PROD_PGPASSWORD
   ```

3. `pg_dump` must be at least as new as the server (Postgres 17): `brew install postgresql@17`
   and put it first on `PATH`. The scripts stop with a clear message if it is older.
4. Build staging up to the current repo state, then check it matches production:

   ```bash
   scripts/db/staging-bootstrap.sh     # every migration in order + supabase/seed.sql
   ```

   Staging holds seed data only. To rehearse against a realistic catalog, load the Excel
   catalog into staging with `scripts/load_public_fnb_catalog.py` (never copy user tables from prod).

## Writing a migration

1. `supabase/migrations/<14-digit timestamp>_<snake_name>.sql`. No `begin;`/`commit;`: the runner wraps the
   file in one transaction. If a statement cannot run in a transaction, put `-- no-transaction: <reason>` at the top.
2. `supabase/rollbacks/<same name>.down.sql` that exactly undoes it. Rules:
   - A down that drops a table or column (or deletes rows) must first copy the data into the
     `rollback_archive` schema, or say `-- down-loses-data: <reason>`.
   - If the up legitimately removes rows (a cleanup), declare the tables:
     `-- expect-row-loss: public.table_a, public.table_b` at the top of that file. Without it, any
     table that ends with fewer rows rolls the whole migration back.
3. Header `-- smoke: supabase/smoke/<file>.sql` (repeatable) naming the smoke(s) that prove the new behaviour,
   or `-- smoke: none <reason>`.
4. Waivers, `-- no-down: <reason>` and `-- no-rehearsal: <reason>` (10+ characters), exist for emergencies.
   They need the owner's explicit approval in the PR.

## Shipping it

```bash
# 1. On the PR branch, with the migration + down file written. Rehearse on staging:
scripts/db/rehearse.sh <version>
#    - compares staging's schema with prod's (read-only), so a dirty or drifted staging is caught
#    - backs up staging, applies up, applies down, then checks schema AND every row's contents are
#      identical to before, re-applies up, runs the smokes
#    - writes supabase/rehearsals/<version>.json. Commit it with the PR; CI checks its hashes match the files.

# 2. After the PR is merged to main (pull main first):
scripts/db/ship.sh <version>
#    - re-runs the repo check, verifies the evidence is under 14 days old, the files are exactly what is on origin/main,
#      and prod has not applied it yet
#    - asks you to type the version, backs up prod, applies in ONE transaction that rolls back by itself
#      if any table ends with fewer rows, records the ledger entry, runs the smokes
#    - prints the backup folder and the undo command
```

`rehearse.sh` leaves staging with the migration applied, which is what prod will look like after `ship.sh`.

## Undoing

```bash
scripts/db/rollback.sh prod <version>      # backs up, runs the down file in one transaction, removes the ledger row
```

Then revert the migration in git or ship a forward fix so the repo matches the database. If a down
cannot be trusted (data was written in the new shape), prefer a forward-fix migration.

## Backups

`scripts/db/backup.sh staging|prod [label]` writes `~/hungry-backups/<env>-<ref>-<UTC time>/`:
`data.dump` (public, app_private, auth, storage metadata, migration ledger), `schema.sql`,
`rowstats.tsv` (count and content hash for every table), `toc.txt`, `MANIFEST` (sha256 of each).
Prod dumps contain user emails and other personal data: keep them on the encrypted Mac disk (FileVault), never
upload them to a project folder or staging.

**Not in the backup:** file bytes in Storage buckets, Edge Function secrets, Vault secret values,
Auth dashboard settings, `config.toml` pushes. Record those separately.

### Restore drill (prove a backup works)

Restore into a scratch local Postgres that has the same extensions, never into staging or prod:

```bash
pg_restore --clean --if-exists --no-owner -d "<scratch db url>" <backup dir>/data.dump
```

Two errors about the `public` schema already existing are expected. Then compare
`rowstats.tsv` with the same query run on the scratch database (`scripts/db/sql/rowstats.sql`).
This was done on the local Postgres stand-in: after deleting rows, dropping a table and editing
data, the restore brought back every table byte for byte.

### Restoring production

Manual, with the owner present: stop the writers, take a fresh backup first (`backup.sh prod before-restore`),
restore only the tables that are damaged (`pg_restore --data-only --single-transaction -t <table> ...` into emptied
tables, or the whole dump into a newly created project), and verify with `rowstats.tsv`.

## What this does not prove

- Rehearsal data is seed/catalog data, not real user rows. Migrations that rewrite user data need a
  hand-built fixture in staging (insert representative rows before `rehearse.sh`; they are then part of the before/after comparison).
- Concurrency under live traffic: a long lock on a hot table still stalls prod. Prefer additive changes,
  `if not exists`, and `not valid` constraints validated later.
- `pg_dump` through the transaction pooler (6543) has not been run against the real Supabase project yet.
  If it fails, use the session pooler or the direct connection for `backup.sh`.
