# Hungry Release 0.1 Execution Board

Updated: 2026-07-24  
Branch: `codex/catalog-excel-fallback-audit`  
PR: #44  
Implementation SHA: `a7fcd2e7fa8ee47c9f71bb7540927ed6fcb8b880`
Canonical scope: `tasks/Roadmap/Release/release-0.1-week-1-2-plan.md`

Use only these four sections for Week 1–2 work. Do not add unrelated features.

## Release blockers — P0

| ID             | Owner                         | Work                                                                 | Acceptance evidence                                                                   | Status                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R01-CI-01      | Codex + GitHub owner          | Restore and pass CI quality/merge gates                              | Green CI on final PR SHA; exact failing step and fix recorded                         | Blocked: Actions jobs still fail with zero steps/logs on `a7fcd2e7`; owner billing/spend/runner action required                                                                                                                                                                                                                                                                                              |
| R01-SEC-01     | Codex + Supabase/GitHub owner | Restore and pass Security workflow                                   | Green Security workflow on final PR SHA                                               | Blocked: Security job still fails with zero steps/logs; Advisor/migration findings remain                                                                                                                                                                                                                                                                                                                    |
| R01-MAIN-01    | Codex                         | Keep PR #44 current with `main`                                      | Clean comparison; conflicts resolved; PR mergeable                                    | Mergeable; rerun comparison before final evidence                                                                                                                                                                                                                                                                                                                                                            |
| R01-SCOPE-01   | Codex                         | Prove deferred routes and controls cannot open in staging/production | Source, Playwright, and native route/control results                                  | Partial: dead Release Profile favourites link fixed at `9275bcce`; 2026-10-15 `fix/release-mvp-scope` audit gated Settings social/activity rows plus unwired location-badge/dietary/favourites-only toggles (dev-only via `prototypeRoutesEnabled`), NotFound feed CTA, catalog-mode search suggestion, and fixed DishDetailV2 dead links (`release01-mvp-scope-contracts.test.ts`); native proof still open |
| R01-OFF-01     | Codex                         | Preserve authenticated catalog routes during network outages         | Authenticated offline Excel fallback; signed-out denial; reconnect without route loss | Repo fix at `476d3982`; automated and native proof pending                                                                                                                                                                                                                                                                                                                                                   |
| R01-PROFILE-01 | Codex                         | Correct profile update semantics                                     | No premature avatar success; no profile-table-only auth email mutation                | Repo fix at `bdd39179`; automated/native proof pending                                                                                                                                                                                                                                                                                                                                                       |
| R01-ENV-01     | Codex                         | Fail closed when released environment is omitted                     | Compiled non-development build treated as release and blocks missing Supabase config  | Repo fix at `1563afd7`; generated-config/native proof pending                                                                                                                                                                                                                                                                                                                                                |
| R01-IMG-01     | Codex                         | Centralize catalog image sanitization                                | Shared mapper tests; Discover/Browse/Search/detail parity                             | Source mapper pass; visual parity blocked by quota/artifacts                                                                                                                                                                                                                                                                                                                                                 |
| R01-DIAG-01    | Codex                         | Extend catalog diagnostics beyond Discover                           | Browse/search/detail/menu diagnostics tests                                           | Repo-local pass; privacy/native inspection still required                                                                                                                                                                                                                                                                                                                                                    |
| R01-GOLD-01    | Codex + Owner                 | Validate exact Jurong East pilot manifest                            | 10 dish IDs, 10 venue IDs, image/location/detail evidence                             | Populated; No-Go because most media/live/device results remain blocked                                                                                                                                                                                                                                                                                                                                       |
| R01-CAT-01     | Codex                         | Run and fix bundled pilot audit                                      | `node scripts/audit-release-01-catalog.mjs` passes                                    | Aggregate pass; image-led release quality still not proven                                                                                                                                                                                                                                                                                                                                                   |
| R01-AUTH-01    | Codex                         | Verify mandatory auth and no guest route                             | Unit/E2E/Maestro/native proof                                                         | Repo-local pass; final native artifact proof missing                                                                                                                                                                                                                                                                                                                                                         |
| R01-FALL-01    | Codex                         | Verify authenticated-only Excel fallback                             | Targeted catalog outage with auth healthy; signed-out denial                          | Contract pass; credentialed staging/native run blocked                                                                                                                                                                                                                                                                                                                                                       |
| R01-NORES-01   | Codex                         | Prove successful no-results is not replaced                          | Source/E2E/native no-results proof                                                    | Contract pass; credentialed staging/native proof blocked                                                                                                                                                                                                                                                                                                                                                     |
| R01-PAGE-01    | Codex                         | Prove three Supabase and Excel pages are distinct                    | IDs/source/release evidence for dishes and stalls                                     | Excel pass; live Supabase release has mock/duplicate quality failures                                                                                                                                                                                                                                                                                                                                        |
| R01-WRITE-01   | Codex                         | Prove no false write success during outage                           | Every enabled write audited; deferred controls hidden                                 | Favourites now MVP scope and default-on in release (`favouritesEnabled: true`); `toggleFavourite` resolves saved/removed/failed after the Supabase write and all favourite toasts follow that result; catalog detail Save + catalog Favourites list added. Detail Mark Tried/social/merchant controls already behind `showDeferredDetailControls`. Live Supabase outage proof still open                     |
| R01-SUPA-01    | Owner + Codex                 | Run staging Supabase/advisor/RLS/catalog smokes                      | No skipped checks; exact output attached                                              | Blocked: HTTP 402 quota, migration drift, and Advisor findings                                                                                                                                                                                                                                                                                                                                               |
| R01-IOS-01     | Owner + Codex                 | Build/install iOS internal alpha                                     | Final-head EAS build ID, install, screenshots, logs, scenarios pass                   | Blocked: iOS internal-distribution credential and final artifact required                                                                                                                                                                                                                                                                                                                                    |
| R01-AND-01     | Owner + Codex                 | Build/install Android internal alpha                                 | Final-head EAS build ID, install, screenshots, logs, scenarios pass                   | Blocked: no final-head installed/device evidence                                                                                                                                                                                                                                                                                                                                                             |
| R01-TEST-01    | Owner                         | Recruit first five internal testers                                  | Tester list and completed journeys; no passwords in repo                              | Open                                                                                                                                                                                                                                                                                                                                                                                                         |

## Next — Week 3–4 work only after P0 is green

| ID            | Work                                    | Exit condition                                                  |
| ------------- | --------------------------------------- | --------------------------------------------------------------- |
| R01-FEED-01   | Add in-app beta issue/data-report entry | Report reaches owned support queue with record/source context   |
| R01-OBS-01    | Verify Sentry release/source-map setup  | Controlled staging error resolves to readable stack and release |
| R01-METRIC-01 | Add core funnel dashboard               | Auth → catalog load → detail action metrics visible             |
| R01-PERF-01   | Profile startup and catalog latency     | p50/p95 recorded on representative iOS and Android devices      |
| R01-A11Y-01   | VoiceOver/TalkBack smoke                | Primary journey completes without P0 accessibility issue        |

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

1. final implementation SHA;
2. evidence/documentation SHA;
3. blockers fixed;
4. commands run and exact results;
5. native/staging evidence collected;
6. blockers still open and their owner;
7. Go / Go Candidate / No-Go verdict.
