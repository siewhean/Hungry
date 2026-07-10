# Hungry Agent Loop State

> Updated: 2026-06-11
> Mode: supervised Codex thread loop
> Data policy: licensed or owner-authorized production display only

## Current Loop Contract

Each loop iteration must:

1. Snapshot `git status --short`, `tasks/backlog.md`, `tasks/verification.md`, and `tasks/session-log.md`.
2. Reconcile done / not done / blocked from repo evidence, not roadmap claims.
3. Select one bounded work package.
4. Implement only that package.
5. Run focused checks.
6. Run QA/QC review before closeout.
7. Update backlog, verification, session log, and lessons when applicable.
8. Continue until blocked by approval, unsafe dirty state, missing credentials, or external manual review.

## Data Display Guardrail

Production-visible catalog rows must satisfy all of the following:

- Menu facts are merchant-owned, operator-owned, user-submitted with rights, permitted API-backed, or explicitly licensed.
- Images are merchant-owned, operator-owned, user-submitted with rights, permitted API-backed, or explicitly licensed.
- Delivery-app menu/image data is treated as a private lead unless a written license explicitly covers that content.
- Unsplash and other generic placeholders are never represented as verified stall or dish photos.
- Unverified menus remain hidden from app-facing dish/menu RPCs until approved.

## Current Priority Queue

1. Verify the catalog display-provenance migration locally/staging before applying it to any linked project.
2. Run `npm run data:excel:audit` to keep the source-quality review queue current.
3. Run `npm run data:excel:display-gate` as a production-display gate; it is expected to fail while unapproved rows remain.
4. After approval metadata exists, run `npm run smoke:database:provenance` against staging.
5. Validate Discover, Dish Detail, and Stall Detail in Supabase mode with screenshots or simulator proof.
6. Validate Home posts and Review actions after catalog display is stable.

## Approval Gates

- Ask before any linked Supabase mutation or migration apply.
- Ask before promoting any source family from internal lead to production display.
- Ask before using licensed delivery-platform data unless the license is already recorded in repo evidence.

## Latest Implementation Evidence

- Added app-display approval metadata migration: `supabase/migrations/20260610120000_catalog_display_provenance_guardrails.sql`.
- Added database smoke: `supabase/smoke/catalog_display_provenance.sql`.
- Added Excel production display gate: `npm run data:excel:display-gate`.
- Added source-contract coverage: `src/lib/services/supabase/catalog-provenance-guardrails.test.ts`.

## Latest Loop Iteration

- 2026-06-11: Ran the repo-local data/provenance loop without linked Supabase mutation.
- Snapshot confirmed a heavily dirty worktree, so the loop stayed scoped to data verification and ledger updates.
- Workbook validator passed: 31,425 valid rows, 0 invalid rows.
- Source-quality audit refreshed:
  - `tasks/Roadmap/Database/excel-source-quality-audit-2026-06-11.json`
  - `tasks/Roadmap/Database/excel-source-quality-review-queue-2026-06-11.csv`
- Production display gate failed as intended:
  - 31,425 blocked rows
  - 0 menu rows approved for display
  - 0 image rows approved for display
  - 31,425 placeholder dish-image rows
  - 16,018 placeholder storefront-image rows
  - 128 delivery-app quarantined rows
- Provenance source contract passed with bundled Node.
- Static Supabase audit passed with bundled Node.

## Current Blocker

The loop must not promote or display catalog menu/image data until approval metadata is added from licensed, merchant-owned, operator-owned, permitted API-backed, or user-submitted-with-rights sources.

Next safe package: build a bounded approval intake workflow for a small licensed/owner-authorized batch, or apply the provenance migration to staging only after explicit approval.
