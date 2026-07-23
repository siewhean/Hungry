# Hungry Release 0.1 Execution Board

Updated: 2026-07-24  
Branch: `codex/catalog-excel-fallback-audit`  
PR: #44  
Canonical scope: `tasks/Roadmap/Release/release-0.1-week-1-2-plan.md`

Use only these four sections for Week 1–2 work. Do not add unrelated features.

## Release blockers — P0

| ID | Owner | Work | Acceptance evidence | Status |
|---|---|---|---|---|
| R01-CI-01 | Codex + GitHub owner | Fix current CI quality-gate failure | Green CI on final PR SHA; exact failing step and fix recorded | Blocked: Actions billing/spend cap |
| R01-SEC-01 | Codex + Supabase/GitHub owner | Fix current Security workflow failure | Green Security workflow on final PR SHA | In progress: hardening migration prepared; remote quota and Actions billing block verification |
| R01-MAIN-01 | Codex | Rebase/update PR #44 against latest `main` | Clean comparison; conflicts resolved; PR mergeable | Open |
| R01-SCOPE-01 | Codex | Prove deferred routes cannot open in staging/production | Source, Playwright, and native route-gating results | Repo-local pass; signed-in staging/native proof pending |
| R01-IMG-01 | Codex | Centralize catalog image sanitization | Shared mapper tests; Discover/Browse/Search/detail parity | Repo-local pass |
| R01-DIAG-01 | Codex | Extend catalog diagnostics beyond Discover | Browse/search/detail/menu diagnostics tests | Repo-local pass |
| R01-GOLD-01 | Codex + Owner | Create exact Jurong East pilot manifest | 10 dish IDs, 10 venue IDs, expected image/location/detail fields | Open |
| R01-CAT-01 | Codex | Run and fix bundled pilot audit | `node scripts/audit-release-01-catalog.mjs` passes | Pass |
| R01-AUTH-01 | Codex | Verify mandatory auth and no guest route | Unit/E2E/Maestro/native proof | Repo-local + iOS sign-in render pass |
| R01-FALL-01 | Codex | Verify authenticated-only Excel fallback | Targeted catalog outage with auth healthy; signed-out denial | Open |
| R01-NORES-01 | Codex | Prove successful no-results is not replaced | Source/E2E/native no-results proof | Open |
| R01-PAGE-01 | Codex | Prove three Supabase and Excel pages are distinct | IDs/source/release evidence for dishes and stalls | Excel pass; live Supabase continuation pending quota recovery |
| R01-WRITE-01 | Codex | Prove no false write success during outage | Save/profile and every enabled write audited; disabled writes hidden | Open |
| R01-SUPA-01 | Owner + Codex | Run staging Supabase/advisor/RLS/catalog smokes | No skipped checks; exact output attached | Blocked: RLS REST smoke HTTP 402 quota; Advisor remediation un-applied |
| R01-IOS-01 | Owner + Codex | Build/install iOS internal alpha | EAS build ID, install, screenshots, logs, scenarios pass | Local simulator pass; EAS artifact pending |
| R01-AND-01 | Owner + Codex | Build/install Android internal alpha | EAS build ID, install, screenshots, logs, scenarios pass | Blocked on device/EAS access |
| R01-TEST-01 | Owner | Recruit first five internal testers | Tester list and access confirmed; no passwords in repo | Open |

## Next — P1 after P0 is green

| ID | Work | Exit condition |
|---|---|---|
| R01-FEED-01 | Add in-app beta issue/data-report entry | Report reaches owned support queue with record/source context |
| R01-OBS-01 | Verify Sentry release/source-map setup | Controlled staging error resolves to readable stack and release |
| R01-METRIC-01 | Add core funnel dashboard | Auth → catalog load → detail → save/directions metrics visible |
| R01-PERF-01 | Profile startup and catalog latency | p50/p95 recorded on representative iOS and Android devices |
| R01-A11Y-01 | VoiceOver/TalkBack smoke | Primary journey completes without P0 accessibility issue |

## Later — not part of Release 0.1

- social Home feed;
- post creation;
- review creation;
- Activity/notifications;
- Reads/blog surfaces;
- Map unless pilot coordinate and native map gates pass;
- Wheel and Crave;
- DMs, stories, comments;
- Passport, missions, gamification;
- collections, checklists, portfolios;
- merchant centre and claims;
- floorplans;
- OAuth providers;
- prototype/admin/developer routes.

## Remove or hide for Release 0.1

Any visible control that:

- does nothing;
- opens a placeholder;
- depends on a disabled feature;
- shows fake counts, ratings, hours, or success;
- routes to a screen excluded from Release 0.1;
- performs a write without confirmed Supabase success.

## Daily closeout

At the end of each Codex session update:

1. final commit SHA;
2. blockers fixed;
3. commands run and exact results;
4. native/staging evidence collected;
5. blockers still open and their owner;
6. Go / Go Candidate / No-Go verdict.
