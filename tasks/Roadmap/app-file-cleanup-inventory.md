# Hungry Repository File Cleanup Inventory

Updated: 2026-07-23  
Cleanup branch: `codex/repository-hygiene-cleanup` / PR #45  
Status: **Partial and safe-by-evidence.** Documentation and generated-output cleanup is implemented; runtime and large-workspace deletion remains blocked until executable reference/build/test proof exists.

Do not rely on historical file counts. Generate exact tracked-file and size inventories from the final checkout before merge.

## 1. Area ownership and retention

| Area | Ownership | Production relevance | Current decision | Follow-up proof |
|---|---|---|---|---|
| `src/app/`, `src/components/`, `src/features/` | mobile UI/flows | app binary and behavior | keep; PR #44 removes guest/runtime drift | typecheck, tests, Playwright, native QA |
| `src/store/`, `src/lib/services/` | state/data/service boundaries | auth, shared data, fallback, writes | keep; remove only proven dead paths | source tests, RLS/staging/native proof |
| `src/lib/services/mock/` | development/test fixtures | must not enter released path | keep while tests/dev tools use it; production-gate | bundle/source contracts |
| `supabase/migrations/` | append-only schema/security history | production database | keep | dry run, staging apply, RLS/advisor smoke |
| `supabase/functions/`, `supabase/smoke/` | backend operations/evidence | production functions and checks | keep; audit unused functions separately | reference, static and live smoke |
| `tests/e2e/`, `.maestro/` | web/native QA | release proof | keep current flows; remove obsolete guest flows on PR #44 | successful current suites |
| `marketing/website/web-v2/` | active public/merchant web workspace | deployed website and support/privacy surfaces | keep | build, route/security, deployment proof |
| `marketing/web/` | legacy web workspace | possible historical/deployment dependency | retain but freeze; dedicated removal PR | reference, parity, build/deploy, owner approval |
| `data/` | canonical/derived catalog sources | app/catalog releases | keep canonical and intentional runtime inputs | provenance, generator and validation |
| `scripts/` | release/data/security/smoke automation | operational workflows | keep referenced scripts; audit one-offs in follow-up | package/workflow/doc search and tests |
| `tasks/` | active ledgers, plans, audits, evidence | governance/release | consolidate current docs; archive unique history | reference and policy search |
| `docs/`, `design/`, `Research/` | stable engineering/design/product sources | implementation and review | keep authoritative/unique sources; label archives | source/provenance and reference review |
| `output/`, `scratch/`, generated reports | local/CI output | usually not runtime | ignore/delete reproducible junk; retain explicit release evidence only | reference scan and evidence owner |
| `ios/`, app/EAS config | native project/configuration | store builds | keep; do not delete generated/native files blindly | Xcode/EAS build and config audit |

## 2. Implemented cleanup on PR #45

### Root and governance consolidation

Replaced stale or duplicated current entrypoints:

```text
README.md
AGENTS.md
CLAUDE.md
CODEX.md
WORKFLOW.md
```

Added:

```text
docs/repository/REPOSITORY_STRUCTURE.md
tasks/Roadmap/Audit/repository-hygiene-audit-2026-07-23.md
```

### Product, QA and planning reconciliation

Updated current documents that still described guest browsing, mock-first architecture, old branches or obsolete report locations, including:

```text
tasks/product-context.md
tasks/Roadmap/mvp-basic-features-implementation-phases.md
tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md
tasks/Roadmap/Scaling/scaling-implementation-test-qaqc-plan.md
tasks/Roadmap/app-screen-qc-checklist.md
tasks/Roadmap/app-production-readiness-audit.md
tasks/Roadmap/app-route-feature-flag-qc-report.md
tasks/Roadmap/app-playwright-prelaunch-report.md
tasks/Roadmap/app-maestro-native-smoke-report.md
tasks/Roadmap/app-final-prelaunch-go-nogo.md
tasks/Roadmap/app-final-go-no-go-checklist.md
design/stitch/STITCH_BRIEFS.md
.agents/workflows/*.md (current specialist workflows)
```

### Deleted generated junk

```text
output/qa/accessibility-smoke-20260413.txt
output/qa/accessibility-smoke-20260413-postfix.txt
```

These were reproducible stale grep snapshots, not canonical evidence.

### Ignore rules

`.gitignore` now groups and ignores:

- build, test, Playwright and native artifacts;
- local environment and secret files;
- editor/agent/runtime caches;
- Python/Supabase local state;
- generated QA/scratch/Graphify output;
- temporary workbook backups and data-review outputs.

## 3. Branch and PR cleanup

Closed as superseded:

```text
#22, #23, #25, #26, #27, #28, #30, #31, #43
```

Active lines:

```text
#44 codex/catalog-excel-fallback-audit
#45 codex/repository-hygiene-cleanup
```

The connector cannot delete refs, so closed-PR branch refs still require owner review/deletion in GitHub.

## 4. Deferred deletion candidates

| Candidate | Why not deleted now | Required decision/evidence |
|---|---|---|
| Runtime files/imports/routes | no local executable verification | reference graph, typecheck, tests, native/build proof |
| Old guest Playwright/Maestro/runtime paths | owned by active PR #44 | merge/rebase #44 and run current suites |
| `marketing/web/` | possible deployment/content dependency | parity and deployment audit, owner approval |
| root `accessibility-audit-report.md` | unique historical/manual evidence | consolidate to Accessibility roadmap, update references |
| historical audit/roadmap docs | may preserve unique decisions | label/archive/delete exact duplicates after reference review |
| one-off `scripts/` files | operational references may be indirect | package/workflow/docs search, focused replacement tests |
| guest-session backend function(s) | may serve abuse/anonymous operational use rather than app guest mode | security/product/backend audit before removal |
| old design exports/assets | rights and implementation references may be indirect | source/provenance/reference review |
| branch refs | connector lacks safe deletion and owner must confirm no deploy/rollback dependency | GitHub branch deletion after review |

## 5. Exact inventory commands required

Run on the final checkout:

```bash
git ls-files | wc -l
git ls-files | awk -F/ '{print $1}' | sort | uniq -c | sort -nr
git ls-files -z | xargs -0 du -h | sort -h | tail -100
git ls-files | sort | uniq -d
git status --short
git diff --check
```

Reference/policy searches:

```bash
git grep -n "Continue as Guest\|GuestSoftGate\|guest browse" -- ':!tasks/Roadmap/Archive/**'
git grep -n "frontend-design-overhaul" -- ':!tasks/Roadmap/Archive/**' ':!tasks/session-log.md' ':!tasks/verification.md'
git grep -n "output/qa/accessibility-smoke-20260413"
git grep -n "marketing/web" -- .github package.json scripts tasks docs README.md AGENTS.md WORKFLOW.md
git grep -nE '(^|/)(tmp|temp|backup|copy|old|unused)([-_.]|$)' -- $(git ls-files)
```

Then run the repository checks documented in the hygiene audit. Do not delete a candidate solely because its name contains `old`, `temp` or `backup`; inspect references and provenance first.

## 6. Current verdict

The repository is materially better organised and stale generated output/current-policy documents were cleaned. It is not honest to claim every runtime file is clean or every branch ref is removed without a local reference graph, green tests/builds and branch-deletion capability. PR #45 remains draft and **No-Go** until those checks and #44/#45 sequencing are complete.
