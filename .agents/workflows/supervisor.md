---
description: Supervisor agent — orchestrate Hungry audits and produce one evidence-backed Go/No-Go report
---

# Supervisor Agent

Coordinate the Hungry specialist workflows without creating parallel source-of-truth files. Use current code, registered routes, feature flags, the active task, and the canonical verification ledger.

## Governing policy

- No guest mode.
- Main app surfaces require successful authentication.
- Supabase is mandatory for auth and shared writes.
- Excel is an authenticated read-only catalog fallback only for eligible catalog outages.
- A skipped, credential-blocked, simulator-blocked, or failing check is not a pass.

## Agent roster

| Agent | Workflow |
|---|---|
| QA | `qa_tester.md` |
| Flow | `flow_analyst.md` |
| UI/UX | `ui_ux_designer.md` |
| Design system | `design_system_enforcer.md` |
| Accessibility | `accessibility_auditor.md` |
| Security | `security_auditor.md` |
| Performance | `performance_auditor.md` |
| Copy | `copywriter.md` |
| AI/recommendation | `ai_ml_reviewer.md` |
| Personas | `persona_*.md` |

Specialist outputs belong in the current task-specific audit and `tasks/verification.md`. Do not create loose root files such as `qa_report.md`, `security_report.md`, or `release_readiness_report.md`.

## Execution order

1. **Scope and baseline**
   - resolve branch, current task, product policy, feature flags, route inventory, and required environments;
   - run the smallest static baseline that can expose an invalid working state.
2. **Architecture and flow**
   - Flow Analyst;
   - Design System Enforcer;
   - Copywriter.
3. **Functional and visual quality**
   - QA Tester;
   - UI/UX Designer;
   - Accessibility Auditor.
4. **Risk and scale**
   - Security Auditor;
   - Performance Auditor;
   - AI/ML Reviewer where recommendation behavior is in scope.
5. **User validation**
   - relevant personas only; do not run all personas when the task is narrow.
6. **Regression loop**
   - assign each issue to an owner;
   - fix;
   - rerun the focused check;
   - repeat until resolved, accepted, or explicitly blocked.
7. **Final gates**
   - broad automated checks;
   - staging/database proof;
   - native/device proof;
   - store/monitoring/legal proof where release readiness is claimed.

## Severity

| Level | Definition | Release effect |
|---|---|---|
| P0 | Auth bypass, private-data exposure, data loss, launch crash, destructive release defect | Block |
| P1 | Core flow unusable, serious accessibility/security/privacy failure, cross-user inconsistency | Block |
| P2 | Significant friction, performance, copy, layout, or recoverability issue with workaround | Fix before public release unless accepted |
| P3 | Minor polish or maintainability improvement | Backlog |

## Required evidence format

For each finding record:

```text
ID
Area/screen/route
Environment and account role
Severity
Steps to reproduce
Expected
Actual
Evidence (test, trace, screenshot, log, query)
Root cause
Fix/owner
Retest result
Residual risk
```

## Verification baseline

Use repository scripts rather than ad-hoc equivalents:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
```

Add Playwright, Maestro, Supabase, security, asset, build, load, and release commands according to risk. Do not claim repository-wide readiness from source contracts alone.

## Final report

Update the task-specific audit with:

1. scope and branch/commit;
2. agents/checks run;
3. issues found and fixed;
4. exact command results;
5. native/staging/external evidence;
6. unresolved P0/P1 blockers;
7. accepted risks and owner;
8. Go, Go Candidate, or No-Go verdict.

Also add concise evidence to `tasks/verification.md` and an execution entry to `tasks/session-log.md` when appropriate.

## Pass criteria

- No unresolved P0/P1 finding.
- Mandatory auth, route/role/flag boundaries, and data-source policy are proven.
- Core flows pass automated and native tests.
- Staging and external release gates are complete for any Go claim.
- Repository status is recorded in one canonical audit/ledger set, not duplicated across loose reports.
