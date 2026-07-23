# Hungry Release 0.1 — Week 1 and Week 2 Completion Report

Final implementation SHA: `91561aaca5204a81e00a6899eb81af7b89816f18`
Evidence update: E2E harness repair; all runtime evidence applies to the implementation SHA above
Report date: 2026-07-24
Verdict: **No-Go — Week 1 and Week 2 are not complete.**

## 1. Branch and integration

| Check | Result | Evidence |
|---|---:|---|
| Starting commit audited | Pass | `8a5822c99dc11e4f0aebac8349cb8485b42006f3` |
| Latest `main` comparison | Pass | `origin/main...91561aaca = 0 behind / 76 ahead` before evidence follow-up |
| PR #44 mergeability | Blocked | GitHub reports `UNSTABLE`; CI/Security executed zero steps because Actions billing/spend capacity must be restored |
| PR #43 raw-catalog path retained | Pass | Catalog V2 and non-consumer contracts pass in `npm run test` |
| Worktree at release closeout | Pending | Must be clean after this evidence commit |

## 2. Automated checks

| Command | Result | Current evidence |
|---|---:|---|
| `npm ci` | Pass | Completed successfully |
| `npm run typecheck` | Pass | 2026-07-24 |
| `npm run lint` | Pass | 2026-07-24 |
| `npm run format:check` | Pass | All matched source files formatted |
| `npm run audit:assets` | Pass | Asset budgets/provenance pass |
| `node scripts/audit-release-01-catalog.mjs` | Pass, insufficient visual proof | 273 venues; 876 dishes; 5/273 image-backed venues (1.83%); 511/876 image-backed dishes (58.33%); 100% coordinates; 0 blocked URLs |
| `npm run test` | Pass | 618 pass, 0 fail, 2 intentional credential-gated skips |
| `npm run test:e2e` | Pass locally | 29 local browser scenarios pass; 2 authenticated staging fallback/no-results scenarios remain credential-gated and are not counted as release proof |
| `npm run test:e2e:merchant-catalog` | Pass | 1/1, isolated Expo Web mock-development launcher path |
| `npx expo-doctor --non-interactive` | Invalid command form | CLI treats `--non-interactive` as an invalid path; replacement `npx expo-doctor` passes 18/18 |
| `npm run audit:supabase:static` | Pass | Static RLS/grant/audit contract passes |
| `npm run check:edge-functions` | Pass | Static edge-function checks passed |
| `npm run security:audit` | Pass | 0 vulnerabilities |
| `npm run security:gitleaks` | Pass | 0 staged leaks |
| `npm run security:trufflehog` | Pass with scanner read warnings | 0 verified and 0 unverified secrets; scanner logged nonfatal malformed Brotli reads inside local Python bytecode |
| `npm run release:ready:local` | Fail correctly | Stops on live Advisor findings; it must remain red until remote hardening is applied/rechecked |
| `git diff --check` | Pass before evidence edits | Re-run required immediately before the evidence commit |

## 3. Staging Supabase

| Check | Result | Evidence |
|---|---:|---|
| Canonical food-business staging smoke | Pass | `HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:supabase-canonical-food-business-staging` |
| Full Audit V1 smoke | Pass | `HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:supabase-full-audit-v1`; no readiness findings |
| Raw catalog boundary smoke | Pass | `npm run smoke:database:catalog-raw` returned `raw_catalog_projections_rls_and_no_direct_reads=true` |
| Location smoke | Blocked | `get_discovery_feed_by_location` returned HTTP 402 `exceed_db_size_quota` |
| Search smoke | Blocked | Not run after location gate returned HTTP 402; same remote capacity blocker |
| RLS smoke | Blocked | Not run after location gate returned HTTP 402; same remote capacity blocker |
| Advisor non-password gate | Fail | 22 unexpected app-owned findings; local hardening migration `20260724090000_release_01_advisor_hardening.sql` has not been reconciled/applied remotely |
| Active release / totals | Observed, not release proof | `68cd0682-1655-4ceb-bd53-043309c9aafb`; 119,232 venues / 156,351 dishes |
| Migration state | Blocked | 12 remote-only and 8 local-only versions; reconcile before any migration apply |

## 4. Jurong East pilot and images

| Metric | Result | Threshold | Release result |
|---|---:|---:|---:|
| Candidate venues | 273 | 10 | Aggregate pass only |
| Candidate dishes | 876 | 20 | Aggregate pass only |
| Image-backed venues | 5 (1.83%) | 5 | Not visual-ready; initial Discover requires approved image coverage per shown card |
| Image-backed dishes | 511 (58.33%) | 10 | Not visual-ready; approval and device verification still required |
| Coordinate coverage | 100% | 95% | Pass |
| Blocked image URLs in Excel audit | 0 | 0 | Pass |
| Exact 10-dish / 10-venue manifest | Populated, blocked | 10 / 10 | See `release-0.1-pilot-catalog.md`; only three candidate pairs have approved/permitted media and none has final installed-app proof |

The active raw release also has 38,966 unverified dish URLs, 212 placeholder dish URLs, 310 unverified venue URLs, `dsh-mock-*` rows on a third live dish page, and semantic venue duplicates. The strict media mapper now withholds all media lacking explicit approval and recognised rights; this fixes unsafe display but does not make live imagery release-ready.

## 5. Data-source behavior

| Scenario | Result | Evidence |
|---|---:|---|
| Healthy Supabase | Partial | Active release/totals and raw boundary SQL observed; authenticated device record/badge proof blocked |
| Authenticated catalog RPC failure | Contract pass; staging blocked | Fallback contracts pass; no credentialed staging Playwright account/base URL |
| Signed out | Contract pass | Signed-out fallback denial test passes |
| Invalid/revoked session | Contract pass; staging blocked | Auth bootstrap contracts pass; no staging revocation run |
| Missing released configuration | Contract pass | Released config blocks catalog/auth fallback contract |
| Legitimate no-results | Contract pass; staging blocked | Cursor/no-results contracts pass; staging credentials absent |
| Write unavailable | Pass by deferral | Favourites and review writes are hidden in staging/production; no optimistic false-success control remains in Release 0.1 path |

Credential-gated staging fallback/no-results Playwright tests are **blocked**, not skipped-as-pass: `PLAYWRIGHT_STAGING_EMAIL`, `PLAYWRIGHT_STAGING_PASSWORD`, and staging base URL are not available in the secure environment.

## 6. Paging and source continuity

| Surface/source | Pages tested | Duplicate IDs | Release/source retained | Result |
|---|---:|---:|---:|---:|
| Supabase dishes | 3 candidate pages | Raw IDs distinct; mock rows on page 3 | Yes in RPC contract | Fail release parity: mock/semantic quality rows remain |
| Supabase stalls | 3 candidate pages | Raw IDs distinct; semantic duplicates found | Yes in RPC contract | Fail release parity |
| Excel dishes | 3 | 0 | Yes | Pass — targeted contracts |
| Excel stalls | 3 | 0 | Yes | Pass — targeted contracts |
| Query/filter cursor reset | Contract | n/a | Yes | Pass |
| Dish detail | Contract | n/a | Release-bound | Pass |
| Stall detail/menu | Contract | n/a | Release-bound | Pass |

## 7. Image behavior and diagnostics

| Surface | Shared strict media mapper | Visual/device proof | Release result |
|---|---:|---:|---:|
| Discover | Pass | Blocked | No-Go |
| Browse Dishes | Pass | Blocked | No-Go |
| Browse Stalls | Pass | Blocked | No-Go |
| Search | Pass | Blocked | No-Go |
| Dish detail | Pass | Blocked | No-Go |
| Stall detail/menu | Pass | Blocked | No-Go |

The mapper rejects missing approval, unverified/placeholder/restricted rights, malformed hosts, Unsplash, Picsum, generic placeholders and social-hero assets. Tests cover the raw mapping boundary, but five dish and five venue screenshots across all Release 0.1 surfaces are still required.

## 8. Native build and QA

| Platform | Final-SHA internal-alpha artifact | Install/device QA | Result |
|---|---|---|---|
| iOS | None | Prior Debug simulator login render is not final-SHA evidence; `eas build --profile internal-alpha --platform ios --non-interactive` refused because no suitable credential exists | Blocked: EAS iOS internal-distribution credential required |
| Android | `5090a020-c49b-47e9-ad9c-ce98521b4dda` (queued) | Internal Android build for `da3d6dd49`; no artifact/install/device evidence yet | Blocked until the queued final-SHA build completes and is installed |

The earlier Android build `b4eb5445-f343-4d15-8f18-7efd5aeba1cb` is queued for old SHA `08b9fa…`; it is ineligible. The new Android build is currently `IN_QUEUE` and has no artifact. There are no iOS EAS builds. No accessibility, offline, source fallback, three-page, image, reduced-motion, VoiceOver, or TalkBack acceptance may be inferred from source tests.

## 9. Internal testers

| Requirement | Result | Evidence |
|---|---:|---|
| Five named internal testers | Blocked | No final iOS/Android artifact and no tester recruitment records |
| Primary journey completions | 0/5 | No completion evidence |
| P0/P1 feedback retest build | Blocked | Depends on first tester build and findings |

## 10. Issues fixed through `91561aaca`

| ID | Severity | Fix | Verification |
|---|---:|---|---|
| R01-AUTH-01 | P0 | Existing-account sign-in records completed onboarding and routes directly to the authenticated shell; no success toast | Mandatory Playwright 3/3; source suite pass |
| R01-SCOPE-01 | P0 | Deferred routes, review hosts and visible detail/profile controls are feature-gated; return routes validate release availability | Route contracts pass |
| R01-WRITE-01 | P0 | Favourites deferred from staging/production until full Supabase write proof exists | Source contracts pass |
| R01-IMG-01 | P0 | Raw catalog media requires explicit approval plus recognised rights state | Media contracts pass |
| R01-PAGE-01 | P0 | Excel dish/stall three-page, cursor reset, source/release detail/menu and signed-out denial tests added | Targeted contracts pass |
| R01-SEC-LOCAL | P0 | Updated Expo and transitive security dependencies | `npm audit` 0 vulnerabilities; Expo Doctor 18/18 |
| R01-E2E-01 | P0 test harness | Isolated the mock-development launcher behind Expo config plus an E2E-only browser-storage request; release builds retain the signed-out pre-auth navigator | Full local Playwright suite passes; production-gate and mandatory-auth contracts pass |

## 11. Remaining blockers and owner action

| Blocker | Owner | Required action |
|---|---|---|
| CI/Security zero-step failures | GitHub owner | Restore Actions billing/spend capacity; rerun both checks on the evidence SHA |
| Advisor findings / drift | Supabase owner + Codex | Reconcile migration history; review/apply hardening migration; rerun Advisor gate |
| Database quota HTTP 402 | Supabase owner | Upgrade/remove spend cap or reduce database below quota; rerun location, search and RLS smokes with no skips |
| Raw data quality | Catalog owner | Quarantine mock/duplicate/non-consumer data and publish a release with approved media projections |
| Staging fallback/no-results | Release owner | Provide secure staging test account and base URL through approved secret environment |
| iOS internal alpha | Apple/EAS owner | Configure internal-distribution credentials, build final SHA, install and complete matrix |
| Android internal alpha | Android/EAS owner | Monitor queued `5090a020-c49b-47e9-ad9c-ce98521b4dda`, then install the resulting final-SHA artifact on two representative devices |
| Five tester journeys | Release owner | Recruit five testers and record completed journeys without credentials |

## 12. Final decision

**No-Go. Week 1 and Week 2 remain incomplete.** The final implementation improves release safety and all repo-local source/security gates pass, but the definition of done is not met: GitHub CI/Security are not green, live Supabase paging/data/image parity fails, Advisor and quota gates are unresolved, authenticated staging Playwright is unavailable, no final-SHA iOS/Android artifacts exist, and no internal tester journey is complete.
