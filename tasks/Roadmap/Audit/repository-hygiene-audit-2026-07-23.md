# Repository Hygiene Audit — 2026-07-23

> Repository: `siewhean/Hungry`  
> Cleanup branch: `codex/repository-hygiene-cleanup`  
> Cleanup PR: #45  
> Integration base: `main`  
> Production status: **No-Go** — repository organization does not replace app, database, native, store, security, privacy, or legal verification.

## 1. Scope and safety rule

This pass reviewed:

- active and recent pull requests;
- PR-associated branch history;
- repository entrypoint and governance documents;
- current product-policy contradictions;
- generated QA output;
- active versus legacy workspace boundaries;
- keep/archive/delete rules;
- obvious stale planning surfaces.

It intentionally does **not** delete runtime code, migrations, canonical data, or large workspaces merely because they appear old. Those changes require reference, build, test, migration, and owner proof.

The governing product policy is:

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

Hungry has no guest mode. Supabase remains mandatory for authentication and shared writes. Excel is an authenticated, read-only catalog fallback for eligible catalog outages; it is not an authentication, missing-configuration, invalid-session, or no-results fallback.

## 2. Pull-request and branch audit

### Active change lines after cleanup

| PR | Branch | Decision |
|---|---|---|
| #44 | `codex/catalog-excel-fallback-audit` | Keep open. Renamed and rewritten around mandatory auth, typed outage handling, authenticated read-only Excel fallback, and PR #43 reconciliation. |
| #45 | `codex/repository-hygiene-cleanup` | Keep draft until repository checks and #44 sequencing pass. Contains documentation consolidation and safe generated-output removal. |

### Closed as superseded

| PR | Branch | Disposition |
|---|---|---|
| #43 | `codex/catalog-timeout-exclusion` | Superseded by #44; relevant query, exclusion, map, and smoke work is reconciled there. |
| #31 | `frontend-design-overhaul-no-large` | Superseded by merged #38 and later `main`. |
| #30 | `feature/hungry-passport-visual-refresh` | Current `main` Passport implementation is newer and more complete. |
| #28 | `codex/main-integration-05-docs-website-ops` | Superseded by merged #38/current `main`. |
| #27 | `codex/main-integration-04-merchant-auth-backend` | Superseded by merged #38/current `main`. |
| #26 | `codex/main-integration-03-consumer-surfaces` | Superseded by merged #38/current `main`. |
| #25 | `codex/main-integration-02-core` | Superseded by merged #38/current `main`. |
| #23 | `code-health-fix-dietary-check-any-cast-1472434782269874449` | Current `main` already contains the typed dietary behavior; branch is stale. |
| #22 | `palette/a11y-icon-buttons-6629553433176848557` | Current `main` contains later accessibility work; branch is stale/non-mergeable. |

All other recent PRs are already merged or closed. The active implementation/cleanup PR set is now #44 and #45.

### Branch-ref limitation

The available connector can create/update refs but cannot delete branch refs or reliably list every ref. PR-associated branches were audited through PR metadata. Closed PR branches may still exist. After confirming no deployment, environment, release, or rollback process depends on them, delete superseded refs in GitHub.

Recommended retained refs during this work:

```text
main
codex/catalog-excel-fallback-audit     # while PR #44 is active
codex/repository-hygiene-cleanup       # while PR #45 is active
```

## 3. Documentation reconciliation

### `README.md`

Previous problems:

- repeated command and note sections;
- mock-first/backend-optional framing;
- guest/public browsing claims;
- no reliable current repository map;
- static release prose likely to drift.

Action: replaced with a concise current project map, mandatory-auth and Supabase/Excel boundaries, setup/verification commands, source hierarchy, and branch policy.

### `AGENTS.md`

Previous problems:

- described the repo as frontend-only and mock-first;
- excluded backend, website, and data work;
- contained stale guest/no-network/media assumptions;
- embedded unrelated floorplan instructions and a large memory dump;
- used an incorrect authentication order.

Action: replaced with stable current architecture, source ownership, high-risk paths, code/document/branch rules, verification budget, and closeout policy.

### `CLAUDE.md` and `CODEX.md`

Previous problems:

- duplicated long generic guidance;
- required volatile progress in `README.md`;
- omitted the current authentication/data-source boundary;
- blurred ownership between entrypoint docs and active ledgers.

Action: replaced with concise agent entrypoints pointing to `AGENTS.md`, `WORKFLOW.md`, `tasks/backlog.md`, and `tasks/verification.md`.

### `WORKFLOW.md`

Previous problems:

- incomplete branch/PR lifecycle;
- no generated-output policy;
- no archive-versus-delete rules;
- no mandatory-auth/Excel safety boundary.

Action: replaced with source hierarchy, task model, roles, work modes, branch lifecycle, repository/document lifecycle, verification budget, safety boundaries, and closeout checklist.

### `tasks/product-context.md`

Previous problems:

- described the app as pre-backend/mock-first;
- listed guest mode as an MVP requirement;
- treated Supabase as future work;
- retained a guest/auth matrix contradicting approved policy;
- did not reflect the current feature-gated application.

Action: reconciled product context with mandatory authentication, Supabase authority, authenticated Excel fallback, approved media policy, current data sources, navigation, and feature-gated secondary surfaces.

### `tasks/Roadmap/mvp-basic-features-implementation-phases.md`

Previous problems:

- defined the core loop as browsing before login;
- required guest browsing as a launch gate;
- referred to guest taste migration as the primary auth path;
- was tied to the superseded `frontend-design-overhaul` branch;
- embedded static feature-flag values and stale implementation status.

Action: replaced with the current authenticated MVP sequence, data-source/fallback matrix, phases 0–7, acceptance gates, verification commands, and an explicit rule that volatile status belongs in the canonical ledgers.

### `.agents/workflows/qa_tester.md`

Previous problems:

- required `GuestSoftGate` and Continue as Guest;
- used obsolete route/tab expectations;
- accepted generic placeholders;
- lacked authenticated fallback and no-false-write testing.

Action: rewrote the QA agent around mandatory auth, deep-link/role/flag protection, catalog source behavior, native/web/accessibility testing, and exact pass/fail/blocked evidence.

## 4. Repository organization changes

Created `docs/repository/REPOSITORY_STRUCTURE.md` to define:

- stable root contents;
- mobile, backend, tests, web, data, scripts, tasks, docs, research, and design directory purposes;
- active `marketing/website/web-v2` versus legacy `marketing/web` boundaries;
- generated-output handling;
- keep/archive/delete criteria;
- branch retention policy.

Updated `.gitignore` to consolidate duplicate patterns and ignore build/test output, generated QA text, scratch files, local environment values, local data work products, and scanner/tool caches.

## 5. Files removed

Deleted reproducible stale QA snapshots:

```text
output/qa/accessibility-smoke-20260413.txt
output/qa/accessibility-smoke-20260413-postfix.txt
```

They were machine-generated grep output with obsolete line references, not canonical release evidence. Current accessibility status remains in source contracts, active verification records, and dedicated audit material. Equivalent generated text output is now ignored.

## 6. Areas retained deliberately

### `marketing/web/`

Retained as a documented legacy workspace. Add no new work. Delete only after reference search, route/content parity, build/deployment proof, and owner approval show that `marketing/website/web-v2` fully replaces it.

### `tasks/Roadmap/Archive/`

Retained for unique historical context. Archived guest/mock/product assumptions are not current requirements.

### Root accessibility audit

`accessibility-audit-report.md` remains temporarily because it contains unique detailed remediation and manual-proof history. Consolidate it into the Accessibility roadmap and remove the root copy only after preserving references/evidence.

### Canonical workbook and generated runtime catalog

Retained as intentional runtime/release inputs with validation and reconciliation pipelines. Temporary backups, review queues, and intermediate outputs are ignored.

### Supabase migrations and smoke SQL

Retained as append-only schema/security history and reproducible backend evidence.

## 7. Remaining cleanup candidates requiring proof

| Candidate | Required proof before removal |
|---|---|
| `marketing/web/` | reference search, route/content parity, build/deploy proof, owner approval |
| root `accessibility-audit-report.md` | consolidate unique evidence into `tasks/Roadmap/Accessibility/`, update references |
| old design exports/concepts | verify no implementation, review, source-rights, or legal dependency |
| one-off scripts at `scripts/` root | package/workflow/doc reference search and focused replacement tests |
| historical root docs outside the stable root set | reconcile unique content, then archive or delete |
| guest-session backend paths | security/product audit to distinguish unsupported app guest mode from operational abuse-control/anonymous infrastructure |
| stale branch refs | owner review and GitHub branch deletion |

## 8. Code-cleanliness assessment

PR #45 intentionally limits itself to documentation/organization and generated-output removal. Runtime deletion without executable verification would be unsafe.

Known runtime cleanup is concentrated in PR #44:

- mandatory pre-auth/authenticated navigator separation;
- removal of guest route and deep-link bypasses;
- typed catalog errors;
- fail-closed session/configuration behavior;
- authenticated-only Excel catalog fallback;
- replacement of obsolete guest Playwright/Maestro/source contracts;
- current runtime documentation reconciliation.

Do not merge #45 in a way that overwrites newer #44 versions of overlapping files. Update both branches against `main` and resolve any overlap deliberately.

## 9. Verification plan

Required for PR #45:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run audit:assets
npm run security:gitleaks
npm run security:trufflehog
git diff --check
```

Reference and duplicate checks:

```bash
git grep -n "Continue as Guest\|GuestSoftGate\|guest browse" -- ':!tasks/Roadmap/Archive/**'
git grep -n "output/qa/accessibility-smoke-20260413"
git grep -n "marketing/web" -- .github package.json scripts tasks docs README.md AGENTS.md WORKFLOW.md
git ls-files | sort | uniq -d
```

This audit environment had GitHub repository operations but no local checkout. These commands were not executed here; CI or a local/Codex checkout must provide proof before merge.

## 10. Current verdict

| Area | Status |
|---|---|
| PR-associated branch audit | Complete |
| Superseded PR closure | Complete |
| Active PR set | #44 implementation, #45 cleanup |
| Root governance docs | Reconciled on cleanup branch |
| Product context, MVP plan, QA agent | Reconciled on cleanup branch |
| Generated QA output removal | Complete on cleanup branch |
| Complete branch-ref deletion | Blocked by connector capability and owner review |
| Runtime dead-code removal | Deferred to verified implementation work |
| Automated cleanup verification | Pending |
| Merge readiness | **No-Go until CI/local checks pass and #44/#45 sequencing is reconciled** |
