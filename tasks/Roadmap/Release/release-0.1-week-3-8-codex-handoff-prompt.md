# Codex Handoff Prompt — Execute Hungry Release 0.1 Weeks 3–8

Work on:

- Repository: `siewhean/Hungry`
- Branch: `codex/catalog-excel-fallback-audit`
- PR: `#44`
- Week 1–2 implementation baseline: `3c74cd16b48a7e59e1b2695042f9d26365af1cd7`
- Week 1–2 evidence baseline: `2dd695fc7e8f8e6a16a7db3cb2daa4f7e23b5365`

The branch now contains Week 3–8 preparation commits and operational templates. Do not treat those documents as execution proof.

## Mandatory product contract

Hungry has no guest mode.

```text
Splash
→ Onboarding
→ Create Account / Sign In
→ verification when required
→ authenticated app
```

Supabase is mandatory for authentication and all shared writes. Supabase is the primary catalog source. Excel is an authenticated, read-only catalog fallback only for classified catalog network, timeout, RPC, release or availability failures.

Excel must never be used for missing authentication, signed-out state, invalid/revoked session, failed login/signup, missing released configuration, unsafe deep links or successful no-results.

## Preparation already completed

### Week 3 — commit `6e52cb769a06a511069f2b8135b4c9fba8b20bc5`

Added:

- `release-0.1-week-3-core-flow-stability.md`;
- `release-0.1-week-3-screen-action-matrix.md`;
- beta app defect issue form;
- catalog/data-quality issue form.

### Week 4 — commit `a2d27718ce4034bd08dd0f5489ad43d643f3e450`

Added:

- operational-readiness plan;
- incident/rollback runbook;
- monitoring and analytics event catalog;
- privacy/account-deletion proof matrix;
- release-incident issue form.

### Week 5 — commit `f4b28272c8e9a7d5b8d04bf60c2350543507623d`

Added:

- closed-beta launch plan;
- tester guide;
- cohort register;
- beta session-report issue form.

### Week 6 — commit `d778daf73a1da04fd0e96196eb62556b510fafaa`

Added:

- beta iteration plan;
- metrics scorecard;
- regression matrix;
- build-note template;
- defect severity/response policy.

### Week 7 — commit `5d32390af329b47c97b562dc41cffb073b00ec44`

Added:

- Release Candidate plan;
- RC manifest;
- final Go/No-Go checklist;
- `scripts/validate-release-01-evidence.mjs`;
- release-evidence JSON template.

### Week 8 — Week 8 preparation commit

Added:

- soft-launch plan;
- daily launch dashboard;
- rollout/rollback checklist;
- first 14-day operating calendar;
- Week 3–8 audit;
- this handoff prompt.

# First priority — close inherited Week 1–2 gates

Do not claim Week 3 execution has started until these are resolved:

1. GitHub Actions billing/spending capacity restored.
2. Secretless CI and Security green on the final head.
3. Protected `release-candidate` environment and branch protection configured.
4. Supabase HTTP 402 capacity resolved.
5. 12 remote-only/9 local-only migration history reconciled and reviewed.
6. Hardening/catalog migrations applied to a staging snapshot safely.
7. Security Advisor, location, search, RLS, canonical, full and raw catalog checks pass without skips.
8. Protected staging credentials/base URL supplied.
9. Final-head iOS/Android internal-alpha builds created and installed.
10. Five initial internal tester journeys completed.

Do not blindly run `supabase db push`. Do not print or commit credentials.

# Execute Week 3

Read:

- `tasks/Roadmap/Release/release-0.1-week-3-core-flow-stability.md`;
- `tasks/Roadmap/Release/release-0.1-week-3-screen-action-matrix.md`.

Tasks:

1. Inventory every visible control and complete the action matrix.
2. Remove/gate any dead, deferred or misleading control.
3. Run all auth, route, source, no-results, offline and write-failure scenarios.
4. Ensure authenticated disconnect retains the route and uses Excel fallback.
5. Ensure signed-out/invalid sessions never retain Excel access.
6. Verify loading, empty, error, retry and image-unavailable states.
7. Run complete repo-local, staging Playwright, iOS and Android suites.
8. Fix and retest every P0/P1.

Week 3 is complete only when zero dead controls, false successes, route dead ends and P0/P1 issues remain.

# Execute Week 4

Read:

- operational-readiness plan;
- incident response runbook;
- monitoring event catalog;
- privacy/account-deletion proof matrix.

Tasks:

1. Implement/verify Sentry staging/production separation and source maps.
2. Implement privacy-safe core funnel events and prohibited-field tests.
3. Assign named operational owners/backups.
4. Prove privacy, terms, support and account-deletion flows.
5. Rehearse OTA, native, catalog, feature-flag and migration rollback paths.
6. Conduct one incident tabletop exercise.
7. Complete legal/privacy/DPO and release-owner sign-off.

Week 4 is complete only when monitoring, deletion, support, ownership and rollback evidence is current and tied to the final artifacts.

# Execute Week 5

Read:

- closed-beta launch plan;
- beta tester guide;
- cohort register.

Tasks:

1. Distribute final-head TestFlight and Play closed-test builds.
2. Recruit 20–30 target testers with iOS/Android and accessibility coverage.
3. Have testers complete the structured primary journey without live coaching.
4. Use the issue forms for app, data and session evidence.
5. Monitor daily crash/auth/catalog/support metrics.
6. Fix P0/P1 findings and issue a new beta build.

Week 5 is complete only when the approved active cohort exists, at least 15 non-developer journeys complete, both platforms are represented, no P0 remains and real feedback produced at least one retested build.

# Execute Week 6

Read:

- beta iteration plan;
- metrics scorecard;
- regression matrix;
- defect severity policy;
- build-notes template.

Tasks:

1. Run the daily defect-driven loop.
2. Add regression coverage for every P0/P1 fix.
3. Fill the scorecard with real session/device data.
4. Run complete cross-platform regression and accessibility/performance sweeps.
5. Produce two consecutive candidate builds without a new P0 regression.
6. Freeze RC scope and known limitations.

Week 6 is complete only when all P0s are closed, every P1 is closed or explicitly accepted with owner/date, and beta thresholds pass.

# Execute Week 7

Read:

- Week 7 RC plan;
- RC manifest;
- final Go/No-Go checklist.

Tasks:

1. Cut an immutable `release-0.1.0-rc.N` tag.
2. Run local, CI, Security, protected Supabase/staging, catalog and native checks against the exact SHA.
3. Complete store metadata, screenshots, privacy/data declarations and app-access instructions.
4. Fill a real evidence JSON file based on the example.
5. Run:

```bash
node scripts/validate-release-01-evidence.mjs tasks/release-evidence/release-0.1-candidate.json
```

6. Verify evidence authenticity manually; the validator checks completeness, not external dashboard truth.
7. Hold formal multi-role Go/No-Go review.

Week 7 is complete only when the validator reports GO CANDIDATE and the signed Go/No-Go review approves the same SHA/artifacts/catalog release.

# Execute Week 8

Read:

- soft-launch plan;
- daily dashboard;
- rollout/rollback checklist;
- first 14-day calendar.

Tasks:

1. Release to the smallest approved Jurong East cohort.
2. Verify production install/auth/catalog/details/settings/deletion and monitoring.
3. Review the dashboard daily.
4. Expand only after the previous cohort passes thresholds.
5. Pause/rollback immediately on a stop condition.
6. Operate support and catalog correction workflows.
7. Record seven healthy days and complete the 14-day expansion review.

Week 8 is complete only when the soft launch has operated safely, no P0/unowned P1 remains, support is manageable, rollback remains proven and the owner records a hold/iterate/expand decision.

# Required repository checks

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run audit:assets
node scripts/audit-release-01-catalog.mjs
npm run test
npm run test:e2e
npm run test:e2e:merchant-catalog
npx expo-doctor
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
git diff --check
```

# Evidence rules

- Blocked and skipped are never pass.
- Final artifacts must point to the final implementation SHA.
- Documentation/evidence SHA is recorded separately.
- Old native builds cannot certify new code.
- No P0 risk may be accepted.
- Never lower thresholds solely to make a release green.
- Do not enable deferred features during this schedule.
- Do not declare production-ready from source contracts alone.

# Final response format

For each week return:

1. implementation SHA;
2. evidence SHA;
3. artifacts/files changed;
4. automated results;
5. native and staging results;
6. tester/operations results;
7. QC grade;
8. remaining blockers and owner;
9. Week status: Not Started / In Progress / Complete;
10. overall Go / Go Candidate / No-Go.
