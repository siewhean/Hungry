# Supabase Migration Rollback Runbook

Scope: Hungry staging and production Supabase migrations.

## Principles

- Prefer forward-fix migrations over destructive rollback.
- Never run rollback SQL directly in production without an owner-approved incident ticket and a database backup point.
- Numbered rollback migrations are not the default path. They can break later migrations that already depend on the reverted objects.
- Use staging first, then production only after a dry run and smoke checks pass.

## Before Applying A Migration

1. Confirm the target environment and project ref.
2. Run `npx supabase db push --dry-run` against the target.
3. Capture the pending migration list.
4. Confirm the migration is additive or has an explicit backout note in the migration header.
5. Confirm a recent backup/PITR restore point is available from the Supabase dashboard.
6. Run repo-local gates:
   - `npm run audit:supabase:static`
   - `npm run check:edge-functions`
   - relevant `npm run smoke:supabase-*` command when credentials are available

## If A Migration Fails Before Commit

1. Stop the deploy.
2. Do not retry with modified SQL in the dashboard.
3. Fix the migration file in git.
4. Re-run the dry run and smoke checks.

## If A Migration Applies But Breaks Staging

1. Keep production blocked.
2. Capture:
   - migration filename
   - error message or failing smoke command
   - affected tables, RPCs, policies, or functions
3. Create a new forward-fix migration.
4. Re-run the relevant smoke SQL and app/source gates.
5. Update `tasks/verification.md` with the failure and fix evidence.

## If A Migration Applies But Breaks Production

1. Declare an incident and freeze further writes that depend on the broken path where possible.
2. Confirm whether a forward-fix migration can safely restore service.
3. If data loss, corruption, or unsafe access is suspected, use Supabase backup/PITR restore tooling instead of ad hoc SQL.
4. If rollback SQL is required, write a one-off manual script under `supabase/manual/` and run it first against a staging clone.
5. After recovery, add a permanent forward migration that reflects the final desired schema.

## Required Evidence For Closing A Rollback Event

- Dry-run output or migration ledger evidence.
- Smoke command output for the affected subsystem.
- RLS/policy verification when authorization changed.
- `tasks/verification.md` entry with result and residual risk.
- Owner sign-off for production incidents.

## Current Release Blocker Linkage

The Full Audit V1 release gate remains No-Go until migration rollback evidence is paired with:

- Android/EAS proof.
- production secret verification.
- store-console/public URL verification.
- Supabase owner/dashboard security actions.
