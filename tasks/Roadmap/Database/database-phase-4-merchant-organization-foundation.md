# DB-P0-06 Merchant Organization Foundation

## Scope

Phase 4 first slice only. This adds merchant organization/member compatibility beside the current `merchant_accounts`, `merchant_roles`, and `merchant_outlets` model.

## Implemented

- `merchant_organizations`: future multi-outlet merchant root with optional legacy account bridge.
- `merchant_members`: expanded member roles (`owner`, `manager`, `staff`, `ops`, `accountant`, `viewer`).
- `merchant_organization_outlets`: bridge from organizations to existing outlets.
- Backfill from existing merchant accounts, roles, and outlets.
- RLS enabled on all new tables.
- Service-role manage policies on all new tables.
- Bounded authenticated policies for organization reads, member invites/updates, and outlet bridge management.
- Helper functions for organization/outlet membership checks.
- Smoke SQL and source-contract tests.

## Explicitly Deferred

- Replacing `merchant_accounts` or `merchant_outlets` in app services.
- Updating `merchant_can_manage_venue`.
- Merchant change requests.
- Merchant claim conversion tables.
- Verification event timeline.
- Menu versioning.
- Media asset library.
- Background jobs, analytics summaries, partitioning, QR ordering, payments, refunds, and payouts.

## Compatibility Notes

- Existing merchant app calls still use `merchant_accounts`, `merchant_roles`, and `merchant_outlets`.
- Existing venue/dish/review merchant guards remain unchanged.
- The new helper functions are `security definer` with pinned `search_path` to avoid RLS recursion in membership policies. They only return boolean access decisions and do not expose row payloads.

## Verification

To close this phase:

```sh
node --import tsx --test src/lib/services/supabase/merchant-organization-foundation.test.ts
npm run typecheck
npm test
git diff --check
git diff --cached --check
supabase db push --dry-run -p "$SUPABASE_DB_PASSWORD"
supabase db push --yes -p "$SUPABASE_DB_PASSWORD"
supabase db query --linked -f supabase/smoke/merchant_organization_foundation.sql -o table
gitleaks protect --staged --redact
```

Local DB reset remains optional and depends on Docker availability.
