# Hungry Repository Structure

This document defines where current work belongs, which directories are authoritative, and how files should be retained, archived, or removed.

## 1. Root policy

The repository root is reserved for stable project entrypoints, workspace manifests, security/governance files, and build configuration.

Expected root files include:

```text
README.md
AGENTS.md
CLAUDE.md
WORKFLOW.md
SECURITY.md
PROJECT_INSTRUCTIONS.md
package.json
package-lock.json
tsconfig*.json
app.config.js
app.json
eas.json
metro.config.js
playwright.config.ts
supabase/
src/
tests/
.maestro/
marketing/
data/
scripts/
tasks/
docs/
design/
Research/
ops/
```

Do not leave ad-hoc logs, one-off query files, temporary JSON, local screenshots, generated reports, or copied documents at the root.

## 2. Mobile application

### `src/app/`

Application shell, navigation, screens, route-specific orchestration, and app-level source contracts.

- `navigation/` — root/pre-auth/tab/merchant navigators, route types, deep links and route guards.
- `screens/` — user-visible mobile screens grouped by domain.
- `AppBody.tsx` — bootstrap/configuration boundary.

Screens should not create parallel data providers or redefine canonical domain types.

### `src/components/`

Reusable presentational and domain components. Put broadly reusable primitives under `src/components/ui/`; keep domain-specific components in their matching folder.

### `src/features/`

Reusable feature behavior that is not a screen and not a general infrastructure service: prefetch, post composition, auth profile merging, search helpers, merchant validation, and similar logic.

### `src/store/`

Zustand stores and persistence adapters. Stores may cache or stage optimistic state, but Supabase remains canonical for shared multi-user data.

### `src/lib/`

Shared infrastructure and pure logic:

- `services/types.ts` — canonical service interfaces.
- `services/supabase/` — Supabase-backed implementation.
- `services/catalog/` — release catalog and authenticated fallback boundary.
- `services/excel/` — bundled Excel runtime adapter.
- `services/mock/` — development/test-only provider and fixtures.
- analytics, network, security, geo, performance, and other shared infrastructure.

### `src/types/`, `src/constants/`, `src/theme/`

Canonical domain types, feature flags/configuration, and design tokens. Avoid duplicate definitions elsewhere.

## 3. Backend and database

### `supabase/migrations/`

Append-only schema, RLS, grants, indexes, RPCs, storage policies, and security changes. Use unique sortable timestamps and do not rewrite migrations already applied to shared environments unless the migration workflow explicitly requires it.

### `supabase/functions/`

Edge Functions. Each function must have authentication/authorization, validation, safe error behavior, and matching static/smoke coverage where applicable.

### `supabase/smoke/`

Reproducible SQL checks for schema, RLS, grants, RPC behavior, and representative data.

### `supabase/seed.sql`

Intentional development/test seed only. Production catalog publishing and canonical data pipelines should not be hidden inside ad-hoc seed edits.

## 4. Tests

### `src/**/*.test.ts`

Source, unit, integration, and contract tests colocated with the implementation domain.

### `tests/e2e/`

Playwright tests for Expo web and web workspaces. Keep helper code in `tests/e2e/helpers/`. A Playwright result does not replace native device verification.

### `.maestro/`

Native iOS/Android smoke flows. Names must describe the supported product behavior; obsolete guest-mode flows should be removed rather than retained as current smoke coverage.

Generated test reports belong in ignored local output or CI artifacts, not committed source directories.

## 5. Web workspaces

### `marketing/website/web-v2/`

Active Next.js public website, merchant portal, and related web surfaces. This is the canonical website workspace.

### `marketing/web/`

Legacy website workspace. Retain only while an explicit dependency or migration task remains. New work should not be added here. Remove it in a dedicated PR after:

1. dependency/reference search;
2. route/content parity check;
3. CI/deployment confirmation;
4. owner approval for deletion.

### Other `marketing/` files

Strategy, copy, launch assets, and research should be grouped by purpose. Avoid duplicate copies of product policy already maintained in canonical app/task docs.

## 6. Data and scripts

### `data/`

Canonical source workbooks, curated source snapshots, generated runtime catalog inputs, and intentionally versioned reference data. Every large generated runtime input should identify:

- its source;
- its generator/reconciliation script;
- its validation command;
- whether it is safe for app display;
- whether it is canonical, derived, or quarantined.

Temporary workbooks, backups, review queues, scrape outputs, and intermediate enrichment files are ignored or stored as CI artifacts.

### `scripts/`

Repeatable automation only. One-off investigation scripts should be deleted after their finding is incorporated, or moved into an explicitly documented diagnostic folder when they retain operational value.

Organise new scripts by domain when the root script count becomes hard to navigate:

```text
scripts/data/
scripts/release/
scripts/security/
scripts/smoke/
scripts/load/
scripts/floorplan/
```

Do not move existing operational scripts without updating package scripts, workflows, docs, and tests in the same change.

## 7. Tasks and documentation

### Canonical top-level task files

```text
tasks/backlog.md
tasks/verification.md
tasks/session-log.md
tasks/lessons.md
tasks/todo.md
tasks/environment.md
tasks/design-system.md
tasks/screens.md
tasks/data-contracts.md
tasks/test-harness.md
tasks/product-context.md
```

- `backlog.md` is the only active status surface.
- `verification.md` stores evidence and blockers.
- `session-log.md` is append-only narrative history.
- `todo.md` is historical roadmap context, not live status.

### `tasks/Roadmap/<Domain>/`

Current plans, implementation phases, audits, QA reports, and runbooks grouped by domain.

### `tasks/Roadmap/Archive/`

Unique historical documents with continuing audit/context value. Archived documents must not be presented as current requirements.

### `docs/`

Stable engineering, design, security, accessibility, handoff, and repository references. Avoid duplicating active task status here.

### `Research/` and `design/`

Raw/approved product research and visual design sources. Derived summaries should link back to their source and state whether they remain authoritative.

## 8. Generated output

Use ignored local locations or CI artifacts for:

- Playwright HTML reports, traces, videos and screenshots;
- Maestro screenshots and recordings;
- accessibility grep output;
- build logs and Xcode results;
- temporary database/query output;
- security scanner output;
- temporary enrichment and reconciliation output.

Commit output only when it is required release evidence that cannot be reproduced or is explicitly part of the audit record. Prefer a concise Markdown evidence index over raw machine logs.

## 9. Retention decisions

### Keep

- active runtime code;
- source tests;
- current configuration;
- migrations and security history;
- canonical data and deterministic generators;
- current product/design sources;
- concise evidence and runbooks;
- unique historical audits in Archive.

### Archive

- superseded but uniquely informative plans/audits;
- completed roadmap phases referenced by later decisions;
- historical architectural decisions not already preserved adequately by PRs/commits.

### Delete

- exact duplicates;
- stale generated logs and screenshots;
- empty files and abandoned temporary scripts;
- obsolete unreferenced implementation files;
- outdated active docs after useful history is reconciled;
- copied source material without provenance;
- credentials, local environment values, or private data.

## 10. Branch policy

- `main` is authoritative.
- One active branch and PR per coherent change set.
- Close duplicate/superseded PRs with a disposition note.
- Delete merged/superseded branch refs after review when tooling permits.
- Do not keep obsolete branches as documentation; use commits, tags, closed PRs, and archived decision records.
- Active branches must be updated against `main` and fully verified before merge.
