# Repository Hygiene Audit — 2026-07-23

> Repository: `siewhean/Hungry`  
> Cleanup branch/PR: `codex/repository-hygiene-cleanup` / #45  
> Active runtime branch/PR: `codex/catalog-excel-fallback-audit` / #44  
> Integration base: `main`  
> Verdict: **No-Go** until automated checks, branch sequencing, staging/native proof and external release gates pass.

## 1. Scope and governing policy

This pass audited repository governance, recent/open pull requests, PR-associated branch history, current entrypoint/product/release/QA documents, specialist agent workflows, generated QA output and high-risk deletion candidates.

The approved product policy is authoritative:

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

- No guest mode or unauthenticated MainTabs/content.
- Supabase is mandatory for authentication and shared writes.
- Missing released-build configuration blocks app entry.
- Excel is an authenticated, read-only catalog fallback for classified catalog network/timeout/RPC/release availability failures only.
- Signed-out, missing, invalid or revoked sessions, failed auth, missing configuration and legitimate no-results cannot invoke Excel fallback.

This pass did not delete runtime code, migrations, canonical data or large workspaces merely because they appeared old. Destructive runtime/data/workspace cleanup requires a local reference graph, green tests/builds and owner/environment evidence.

## 2. Pull-request and branch disposition

### Active lines

| PR | Branch | Decision |
|---|---|---|
| #44 | `codex/catalog-excel-fallback-audit` | Keep open. Renamed/reframed around mandatory auth and authenticated read-only Excel fallback. Relevant #43 catalog performance/exclusion work is reconciled here. |
| #45 | `codex/repository-hygiene-cleanup` | Keep draft. Contains documentation/organization cleanup and safe generated-output removal. |

### Closed as superseded

| PR | Branch | Reason |
|---|---|---|
| #43 | `codex/catalog-timeout-exclusion` | Reconciled into #44. |
| #31 | `frontend-design-overhaul-no-large` | Superseded by merged #38 and later `main`. |
| #30 | `feature/hungry-passport-visual-refresh` | Current Passport implementation is newer/more complete. |
| #28 | `codex/main-integration-05-docs-website-ops` | Superseded by merged #38/current `main`. |
| #27 | `codex/main-integration-04-merchant-auth-backend` | Superseded by merged #38/current `main`. |
| #26 | `codex/main-integration-03-consumer-surfaces` | Superseded by merged #38/current `main`. |
| #25 | `codex/main-integration-02-core` | Superseded by merged #38/current `main`. |
| #23 | `code-health-fix-dietary-check-any-cast-1472434782269874449` | Current `main` already contains the typed behavior; branch is stale. |
| #22 | `palette/a11y-icon-buttons-6629553433176848557` | Later accessibility work supersedes it; branch is stale/non-mergeable. |

All other recent PRs were already merged or closed. The open PR set after the audit is #44 and #45.

### Branch-ref limitation

The available connector cannot safely delete branch refs or reliably list every ref. Closed-PR refs may still exist. After confirming no deployment, environment, tag, release or rollback process depends on them, delete superseded refs in GitHub.

Recommended temporary retained refs:

```text
main
codex/catalog-excel-fallback-audit
codex/repository-hygiene-cleanup
```

## 3. Implemented repository cleanup

### Stable root and workflow entrypoints

Replaced stale, duplicated or contradictory current documentation:

```text
README.md
AGENTS.md
CLAUDE.md
CODEX.md
WORKFLOW.md
```

The replacements define current architecture, source ownership, mandatory auth, Supabase/Excel boundaries, task/verification ledgers, branch lifecycle, retention policy and evidence rules. Volatile release status no longer belongs in root entrypoints.

Added:

```text
docs/repository/REPOSITORY_STRUCTURE.md
```

This defines root contents, directory ownership, active versus legacy workspaces, generated-output policy and keep/archive/delete criteria.

### Product and implementation plans

Reconciled current active planning documents that still described guest browsing, mock-first/backend-future architecture, old branches or static stale status:

```text
tasks/product-context.md
tasks/Roadmap/mvp-basic-features-implementation-phases.md
tasks/Roadmap/Scaling/scaling-implementation-test-qaqc-plan.md
```

They now use the mandatory-auth flow, Supabase authority, authenticated fallback, current feature-gated surfaces and evidence-based phase gates.

### Release and QA documents

Replaced stale guest-era/current-proof claims in:

```text
tasks/Roadmap/app-file-cleanup-inventory.md
tasks/Roadmap/app-screen-qc-checklist.md
tasks/Roadmap/app-production-readiness-audit.md
tasks/Roadmap/app-route-feature-flag-qc-report.md
tasks/Roadmap/app-playwright-prelaunch-report.md
tasks/Roadmap/app-maestro-native-smoke-report.md
tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md
tasks/Roadmap/app-final-prelaunch-go-nogo.md
tasks/Roadmap/app-final-go-no-go-checklist.md
```

The documents now separate historical evidence from current final-commit proof, preserve No-Go status and require current automated, staging, native, store-console, monitoring, image-rights and legal/privacy evidence.

### Agent and design workflow cleanup

Updated current specialist workflows:

```text
.agents/workflows/supervisor.md
.agents/workflows/qa_tester.md
.agents/workflows/flow_analyst.md
.agents/workflows/ui_ux_designer.md
.agents/workflows/design_system_enforcer.md
.agents/workflows/accessibility_auditor.md
.agents/workflows/security_auditor.md
.agents/workflows/performance_auditor.md
.agents/workflows/copywriter.md
.agents/workflows/ai_ml_reviewer.md
```

Key changes:

- removed GuestSoftGate/guest-mode requirements;
- removed stale future-backend and mock-only assumptions;
- replaced loose root `*_report.md` outputs with task-specific audits and `tasks/verification.md`;
- aligned security, accessibility, performance, data provenance and no-false-write checks with current architecture;
- replaced brittle absolute rules with evidence-based platform-aware requirements.

Replaced `design/stitch/STITCH_BRIEFS.md` to remove developer-specific absolute paths, guest screen briefs, generic stock/Unsplash imagery and enabled-looking disabled features. It now uses repository-relative sources and current auth/fallback/media states.

### Ignore policy and generated-output removal

Normalized `.gitignore` for build/test/native output, local environments/secrets, editor/agent caches, Python/Supabase local state, generated QA/scratch output and temporary data work products.

Deleted reproducible stale grep snapshots:

```text
output/qa/accessibility-smoke-20260413.txt
output/qa/accessibility-smoke-20260413-postfix.txt
```

They contained obsolete line references and were not canonical release evidence.

### Source-contract cleanup

On PR #45:

- updated `src/app/navigation/mobile-route-inventory-contracts.test.ts` so the production audit classifies mobile content as authenticated rather than guest/public.

On PR #44:

- updated `src/app/app-store-prelaunch-contracts.test.ts` so required native flows and scripts use mandatory-auth and authenticated-fallback coverage rather than obsolete guest smoke files/names.

## 4. Deliberately retained areas

| Area | Reason retained | Follow-up condition for removal/change |
|---|---|---|
| `marketing/web/` | Possible legacy content/deployment dependency | reference search, route/content parity, build/deploy proof, owner approval |
| `tasks/Roadmap/Archive/` | Unique historical decisions/audit context | archive remains non-authoritative; delete exact duplicates only after review |
| root `accessibility-audit-report.md` | Unique detailed remediation/manual history | consolidate into Accessibility roadmap and update references first |
| canonical workbook/runtime catalog | Intentional release inputs with validation pipelines | preserve provenance/generator; ignore temporary outputs |
| Supabase migrations/smoke SQL | Append-only schema/security/evidence history | never delete merely as “old”; use corrective migrations |
| current runtime files | No local executable reference graph in this environment | remove only after reference, typecheck, tests, build and native proof |
| guest-session backend paths | May support anonymous abuse-control/operational behavior rather than app guest mode | explicit backend/security/product audit |
| old design exports/concepts | May have review, provenance or asset-rights value | reference and rights audit |

## 5. Runtime/code cleanliness assessment

PR #45 is intentionally documentation/organization focused. It would be unsafe to claim all runtime code is clean without executing the repository.

Runtime cleanup remains concentrated in #44:

- pre-auth versus authenticated navigator separation;
- guest route/deep-link removal;
- fail-closed session/configuration behavior;
- typed catalog errors;
- authenticated-only read-only Excel fallback;
- no-results preservation;
- current Playwright/Maestro/source contracts;
- Supabase/catalog performance and exclusion reconciliation.

Known follow-up categories requiring executable proof include unused imports/dependencies, duplicate route/screen variants, one-off scripts, legacy website removal, obsolete backend functions and stale assets. They are documented as candidates rather than deleted speculatively.

## 6. Verification required

### PR #45 repository checks

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

### Reference, duplicate and policy checks

```bash
git grep -n "Continue as Guest\|GuestSoftGate\|guest browse" -- ':!tasks/Roadmap/Archive/**'
git grep -n "frontend-design-overhaul" -- ':!tasks/Roadmap/Archive/**' ':!tasks/session-log.md' ':!tasks/verification.md'
git grep -n "output/qa/accessibility-smoke-20260413"
git grep -n "marketing/web" -- .github package.json scripts tasks docs README.md AGENTS.md WORKFLOW.md
git ls-files | sort | uniq -d
git status --short
```

### PR #44/runtime checks

Run the full typecheck/lint/format/test/Playwright/Expo Doctor/assets/Supabase/edge/security/release set plus staging catalog/RLS/advisor checks and current iOS/Android mandatory-auth/fallback scenarios.

This audit environment had GitHub repository operations but no local checkout. The commands were not executed here. Recent GitHub Actions runs for the active branches failed before returning usable step logs, so they are not green evidence.

## 7. Merge sequencing

1. Obtain current local/CI proof for #45.
2. Resolve why #45 currently reports non-mergeable and update it against `main` if needed.
3. Merge or rebase the documentation cleanup deliberately.
4. Update #44 against the resulting `main` and resolve overlapping policy documents/tests.
5. Run the full runtime, staging and native verification again.
6. Delete superseded branch refs after owner review.

## 8. Final verdict

| Area | Status |
|---|---|
| Recent/open PR audit | complete |
| Superseded PR closure | complete |
| Active PR set | #44 implementation, #45 cleanup |
| Root/governance documentation | reconciled on #45 |
| Current product/MVP/scaling/store/QA documents | reconciled on #45 |
| Agent/design workflows | reconciled on #45 |
| Generated QA junk | removed on #45 |
| Stale native prelaunch contract on #44 | corrected |
| Branch-ref deletion | blocked by connector capability and owner review |
| Runtime dead-code/dependency cleanup | pending executable proof |
| PR #45 mergeability | unresolved; currently reported non-mergeable |
| Automated/staging/native/external proof | incomplete |
| Overall | **No-Go** |
