# Repository Hygiene Audit — 2026-07-23

> Repository: `siewhean/Hungry`  
> Cleanup branch: `codex/repository-hygiene-cleanup`  
> Cleanup PR: #45  
> Integration base: `main`  
> Production status: **No-Go** — this audit does not replace application, database, native, store, security, or legal verification.

## 1. Scope

This pass reviewed repository governance, active pull requests, PR-associated branch history, root documentation, current product-policy contradictions, generated QA output, active/legacy workspace boundaries, and retention rules.

It intentionally avoids deleting runtime code, migrations, canonical data, or large workspaces solely because they look old. Those removals require reference/build/test proof.

## 2. Governing product policy

The cleanup treats the approved mandatory-auth specification as authoritative:

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

There is no guest mode. Supabase remains mandatory for authentication and shared writes. Excel is an authenticated, read-only catalog fallback for eligible catalog outages; it is not an authentication, configuration, or no-results fallback.

## 3. Pull-request and branch audit

### Active change lines after cleanup

| PR | Branch | Decision |
|---|---|---|
| #44 | `codex/catalog-excel-fallback-audit` | Keep open. Renamed and rewritten to reflect mandatory authentication, typed outage handling, authenticated read-only Excel fallback, and PR #43 reconciliation. |
| #45 | `codex/repository-hygiene-cleanup` | Draft cleanup PR containing documentation consolidation, repository policy, and safe generated-output removal. |

### Closed as superseded during this audit

| PR | Branch | Disposition |
|---|---|---|
| #43 | `codex/catalog-timeout-exclusion` | Superseded by #44; relevant performance, exclusion, map, and smoke work is reconciled there. |
| #31 | `frontend-design-overhaul-no-large` | Superseded by merged #38 and later `main` changes. |
| #30 | `feature/hungry-passport-visual-refresh` | Current `main` Passport implementation is newer and more complete. |
| #28 | `codex/main-integration-05-docs-website-ops` | Superseded by merged #38/current `main`. |
| #27 | `codex/main-integration-04-merchant-auth-backend` | Superseded by merged #38/current `main`. |
| #26 | `codex/main-integration-03-consumer-surfaces` | Superseded by merged #38/current `main`. |
| #25 | `codex/main-integration-02-core` | Superseded by merged #38/current `main`. |
| #23 | `code-health-fix-dietary-check-any-cast-1472434782269874449` | Current `main` already contains the typed behavior; branch is stale. |
| #22 | `palette/a11y-icon-buttons-6629553433176848557` | Current `main` already contains later accessibility work; branch is stale/non-mergeable. |

All other recent PRs are already merged or closed. The only active implementation/cleanup PRs after this pass are #44 and #45.

### Branch-ref limitation

The connector used for this pass exposes branch creation/update but not branch deletion or a reliable complete branch-ref listing. PR-associated branches were audited through PR metadata. Old branch refs may still exist after their PRs were closed. The owner should delete merged/superseded refs in GitHub after confirming no deployment, environment, or rollback process depends on them.

Recommended retained refs during this work:

```text
main
codex/catalog-excel-fallback-audit     # while PR #44 is active
codex/repository-hygiene-cleanup       # while PR #45 is active
```

## 4. Root documentation findings

### `README.md`

Previous problems:

- repeated command/note sections;
- stale mock-first and backend-optional framing;
- guest/public browsing statements that conflict with approved policy;
- no reliable current repository map;
- static release-status prose likely to drift.

Action: replaced with a concise current project map, mandatory-auth policy, Supabase/Excel boundaries, setup/verification commands, source hierarchy, and branch policy.

### `AGENTS.md`

Previous problems:

- described the repo as frontend-only and mock-first;
- excluded backend, website, and data work that now exist in the repository;
- contained stale guest/no-network/Unsplash assumptions;
- embedded unrelated floorplan instructions and a large agent-memory dump;
- used an incorrect authentication order.

Action: replaced with a stable repository guide covering current mobile, Supabase, website, data, task, documentation, branch, and verification rules.

### `CLAUDE.md`

Previous problems:

- duplicated a generic long-form behaviour guide after the project entrypoint;
- repeated rules already owned by `AGENTS.md` and `WORKFLOW.md`;
- referenced stale policy and documents.

Action: replaced with a concise Claude entrypoint and task-specific read/verification rules.

### `CODEX.md`

Previous problems:

- required volatile task progress and blockers to be written into `README.md`;
- did not state the current authentication/data-source boundary;
- duplicated workflow rules without clarifying source ownership.

Action: replaced with a concise Codex entrypoint pointing to the canonical ledgers, stable-doc rule, mandatory authentication, Supabase authority, and authenticated Excel fallback.

### `WORKFLOW.md`

Previous problems:

- insufficient PR/branch lifecycle guidance;
- no explicit generated-output/document-retention policy;
- no clear archive-versus-delete rules;
- did not encode the mandatory-auth/Excel safety boundary.

Action: replaced with a current source hierarchy, work modes, branch lifecycle, documentation retention, verification budget, product safety boundaries, and closeout checklist.

### `tasks/product-context.md`

Previous problems:

- described the app as pre-backend/mock-first;
- listed guest mode as an MVP requirement;
- used future-backend language although Supabase is implemented;
- retained a guest/auth matrix that contradicted the approved policy;
- treated implemented advanced surfaces as if the repository still only contained the early MVP.

Action: reconciled the product context with mandatory authentication, Supabase authority, authenticated Excel fallback, current feature-gated secondary surfaces, approved media policy, and current navigation/data-source rules.

### `.agents/workflows/qa_tester.md`

Previous problems:

- required `GuestSoftGate` and Continue as Guest behaviour;
- used obsolete tab/route expectations;
- treated generic placeholders as acceptable media fallback;
- lacked Supabase/Excel outage and no-false-write testing.

Action: rewrote the QA agent around mandatory auth, deep-link/role/flag protection, authenticated fallback, native/web coverage, accessibility, and exact evidence states.

## 5. Repository organization changes

Created `docs/repository/REPOSITORY_STRUCTURE.md` as the stable directory/retention policy. It defines:

- which files belong at root;
- the purpose of mobile, Supabase, tests, website, data, scripts, tasks, docs, research, and design directories;
- active website versus legacy website boundaries;
- generated-output handling;
- keep/archive/delete criteria;
- branch retention policy.

Updated `.gitignore` to consolidate duplicate patterns and ignore generated QA text, build/test output, scratch files, local environment values, local data work products, and scanner/tool caches.

## 6. Files removed

Deleted two stale generated grep snapshots:

```text
output/qa/accessibility-smoke-20260413.txt
output/qa/accessibility-smoke-20260413-postfix.txt
```

Why:

- they were reproducible machine output, not canonical release evidence;
- they contained stale line-number references to already-changed/deleted files;
- current accessibility status is recorded in source contracts, backlog/verification evidence, and dedicated audit material;
- `.gitignore` now prevents equivalent generated text output from returning.

## 7. Areas retained deliberately

### `marketing/web/`

Retained as a documented legacy workspace. It must not receive new work. Delete only after a dedicated dependency/route/content/deployment parity audit proves `marketing/website/web-v2` fully replaces it.

### `tasks/Roadmap/Archive/`

Retained as historical context. Archived documents may contain obsolete guest/mock/product assumptions and must not be used as current requirements.

### Root accessibility audit

`accessibility-audit-report.md` remains temporarily because it contains unique detailed remediation and manual-proof history. It should be consolidated into the Accessibility roadmap and removed from root in a follow-up after all references/evidence are preserved.

### Canonical workbook and generated runtime catalog

Retained because they are intentional runtime/release inputs with validation and reconciliation pipelines. Temporary/back-up/review outputs are ignored instead.

### Supabase migrations and smoke SQL

Retained as append-only schema/security history and reproducible backend evidence.

## 8. Remaining cleanup candidates requiring proof

| Candidate | Required proof before removal |
|---|---|
| `marketing/web/` | reference search, route/content parity, build/deploy proof, owner approval |
| root `accessibility-audit-report.md` | consolidate unique evidence into `tasks/Roadmap/Accessibility/`, update references |
| old design exports/concepts | confirm no implementation, review, or legal asset dependency |
| one-off scripts at `scripts/` root | package/workflow/doc reference search and focused test replacement |
| historical root docs not in stable root set | reconcile unique content, then move to Archive or delete |
| obsolete guest-session backend paths | security/product audit: distinguish unsupported app guest mode from operational anonymous/abuse-control infrastructure before deletion |
| stale branch refs | owner review and GitHub branch deletion |

## 9. Code-cleanliness assessment

This hygiene branch intentionally contains documentation/organization and generated-output removal only. Runtime deletion without executable verification would be unsafe.

Known runtime work is concentrated in PR #44, which must complete:

- mandatory pre-auth/authenticated navigator separation;
- no guest route or deep-link bypass;
- typed catalog errors;
- fail-closed session/configuration handling;
- authenticated-only Excel catalog fallback;
- replacement of old guest Playwright/Maestro/source contracts;
- current documentation reconciliation where it overlaps runtime behaviour.

Do not merge the hygiene branch in a way that overwrites newer PR #44 versions of overlapping files; update/rebase both branches before merge.

## 10. Verification plan

Required for this cleanup branch:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run audit:assets
npm run security:gitleaks
npm run security:trufflehog
```

Repository/reference checks:

```bash
git diff --check
git grep -n "Continue as Guest\|GuestSoftGate\|guest browse" -- ':!tasks/Roadmap/Archive/**'
git grep -n "output/qa/accessibility-smoke-20260413"
git grep -n "marketing/web" -- .github package.json scripts tasks docs README.md AGENTS.md WORKFLOW.md
git ls-files | sort | uniq -d
```

The cleanup environment used for this audit had GitHub repository operations but no local checkout, so these commands were not executed here. CI or a local/Codex checkout must produce the proof before merge.

## 11. Current verdict

| Area | Status |
|---|---|
| PR-associated branch audit | Complete |
| Superseded PR closure | Complete |
| Active PR set | #44 implementation, #45 cleanup |
| Root governance docs | Reconciled on cleanup branch |
| Product-context/QA-agent policy | Reconciled on cleanup branch |
| Generated QA output removal | Complete on cleanup branch |
| Complete branch-ref deletion | Blocked by connector capability/owner review |
| Runtime dead-code removal | Deferred until reference/test proof |
| Automated cleanup verification | Pending |
| Merge readiness | **No-Go until CI/local checks pass and branch overlap with #44 is reconciled** |
