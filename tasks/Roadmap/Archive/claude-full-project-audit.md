# Hungry Frontend Design Overhaul - Full Project Audit

**Branch:** `frontend-design-overhaul`
**Base:** `main`
**Original audit date:** 2026-05-25
**Current reconciliation:** 2026-05-26
**Scope:** Pre-merge release readiness assessment for the `frontend-design-overhaul` branch.

## Executive Summary

The branch is still a large release-candidate integration branch, not a simple feature branch.
Current diff evidence from `main...HEAD`: **548 files changed, 47,047 insertions, 8,082 deletions**.
Current working tree evidence from the latest sample: **214 dirty status entries** (**191 modified tracked paths, 23 untracked paths**). Treat `git status --porcelain=v1` as authoritative at release closeout, because this checkout is actively changing and is not merge-ready until unrelated/local changes are reconciled.

**Release readiness verdict:** **No-Go for public production release.**
Repo-side source/static gates are broadly mature, but external release evidence is still missing.

## Current Top-Level Status

| Area                         | Status                          | Evidence                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend design overhaul     | Partial / release-candidate     | Large branch diff remains; split-PR manifest exists at `tasks/Roadmap/Archive/claude-full-project-audit-pr-split-manifest.md`.                                                                                                                                                                                                                          |
| Mobile source gates          | Green in current local run      | 2026-05-26 local gates pass: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` (406 total / 404 passing / 2 skipped), `npm run audit:assets`, and `git diff --check`.                                                                                                                                                 |
| Supabase repo/static gates   | Green in current local run      | 2026-05-26 `npm run audit:supabase:static` passes with 58 migrations, 100 created tables, 226 policies, and 0 anon write policies; `npm run check:edge-functions` passes.                                                                                                                                                                       |
| Security/dependency gates    | Green in current local run      | 2026-05-26 staged Gitleaks gate passed with no staged files, verified-only filesystem TruffleHog scan passed with no verified findings after excluding ignored local env files, and `npm audit --audit-level=moderate` passed. Advisor live check is skip-safe here because the linked Supabase Advisor is not reachable from this environment. |
| Supabase live smokes         | Green for audited staging paths | `tasks/verification.md` records live chat, social/gamification, OCR, and Full Audit V1 smoke passes.                                                                                                                                                                                                                                            |
| iOS native smoke             | Green for prepared smoke        | `tasks/verification.md` records prepared iOS Maestro smoke passing on iPhone 17 Pro / iOS 26.1.                                                                                                                                                                                                                                                 |
| Android / EAS proof          | Blocked / missing               | No local `android/` directory; CI EAS gate skips without `EXPO_TOKEN`; public release still needs Android/EAS proof.                                                                                                                                                                                                                            |
| Store / production ops proof | Blocked / missing               | Store-console/public URL proof, production secret verification, and Supabase owner/dashboard actions remain external gates.                                                                                                                                                                                                                     |

## Reconciled P0 / P1 Findings

| ID   | Original finding                                           | Current status                    | Evidence                                                                                                                                                                                | Action taken / remaining work                                                                                                                                                          |
| ---- | ---------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | `dishes.map` contract violation in `StallDetailScreen.tsx` | **Done / original finding stale** | `src/app/screens/detail/StallDetailScreen.tsx` uses `dishes.map((dish, index) => (`; current contracts reference the menu surface.                                                      | No code change required.                                                                                                                                                               |
| P0-2 | 96 MB marketing food images                                | **Done repo-side**                | The food image folder is now about **39 MB** after downscaling to 768 px max dimension. `npm run audit:assets` now enforces a 45 MiB total and 1.5 MiB max-file budget for this folder. | Keep web image optimization/CDN review before marketing-site production traffic.                                                                                                       |
| P0-3 | Missing Android EAS build verification                     | **Open / external gate**          | `.github/workflows/ci.yml` has an EAS gate on pushes to `main`, but it skips when `EXPO_TOKEN` is missing. There is no local `android/` directory.                                      | Run Android/EAS build or Android device smoke in a tokened release environment before public launch.                                                                                   |
| P1-1 | Merchant catalog E2E test not verified in CI               | **Done repo-side**                | `tests/e2e/merchant-catalog.spec.ts` exists. CI now installs Playwright Chromium and runs `npm run test:e2e:merchant-catalog`.                                                          | Wait for GitHub CI evidence on a pushed PR/branch.                                                                                                                                     |
| P1-2 | No Supabase migration rollback plan                        | **Partial / dirty-worktree only** | `supabase/manual/migration_rollback_runbook.md` exists locally, but is untracked in this checkout.                                                                                      | Track/commit the runbook before claiming clean repo-side completion; production use still requires owner approval, backup/PITR confirmation, staging rehearsal, and incident evidence. |
| P1-3 | `src/assets/discover` compression review                   | **Done / within budget**          | Folder is about **4.8 MB**. `npm run audit:assets` reports 10 referenced assets, 4.77 MiB total, under the 6 MiB total and 1 MiB max-file budgets.                                      | Continue to keep Discover assets under the existing asset gate.                                                                                                                        |

## Current Release Blockers

These are the remaining blockers before a public App Store / Google Play production launch:

1. Android/EAS build or Android device smoke proof.
2. Production secret verification for EAS/store release environments.
3. Store-console metadata, privacy, and public account-deletion URL proof.
4. Supabase owner/dashboard actions, including leaked-password protection and remaining owner-managed Advisor items.
5. GitHub CI run evidence for the new merchant-catalog E2E gate after this branch is pushed.
6. Dirty-worktree reconciliation before merge or public-release claims.
7. Outstanding runtime verification gates from `tasks/verification.md`: `SEC-06` signed-in verified/unverified merchant runtime smoke, `SEC-08` `app_ops_admins` seeding plus live multi-user RLS/storage/Edge Function smoke, and `MER-PORTAL-01` merchant email outbox provider/worker plus prepared native merchant smoke.
8. `MERCH-P0-ANALYTICS-01` completion proof: local menu/direction/save/share/profile emitters and mock analytics behavior are now covered; no contact/social controls were found in the inspected consumer detail surfaces. Live Supabase migration smoke and analytics behavior evidence are still missing.

## Verification Snapshot

Current local evidence gathered during this reconciliation:

- `git diff --shortstat main...HEAD`: 548 files changed, 47,047 insertions, 8,082 deletions.
- `git diff --name-only main...HEAD -- supabase/migrations | wc -l`: 30 migration files differ from `main`, so the old "5 new migrations" claim was stale.
- `find marketing/website/web-v2/public/images/food ... du -ch`: about 39 MB after downscaling.
- `find src/assets/discover ... du -ch`: about 4.8 MB.
- `find src/assets/onboarding/food ... du -ch`: about 13 MB for the generated professional onboarding food set.
- `npm run test`: 406 total, 404 passing, 2 skipped.
- `npm run audit:supabase:static`: 58 migrations, 100 created tables, 226 policies, 0 anon write policies.
- `npm run audit:assets`: Discover 4.77 MiB, Passport 0.43 MiB, Onboarding food 12.51 MiB, marketing food 39.32 MiB, all referenced and within configured budgets.
- `npm run check:edge-functions`: pass.
- `npm run typecheck`; `npm run lint`; `npm run format:check`; `git diff --check`: pass.
- `npm run security:gitleaks`: pass for the staged-files gate; current index has 0 staged files, so dirty-worktree secret coverage comes from `npm run security:trufflehog`.
- `npm run security:trufflehog`: verified-only filesystem scan passed with no verified findings after excluding ignored local env files such as `.env.local`; the wrapper now uses `--fail` so verified findings fail the command.
- `npm audit --audit-level=moderate`: pass after unrestricted network retry; the first `npm run release:ready:local` attempt reached this step and failed only on sandbox DNS for `registry.npmjs.org`.
- `CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .`: 18/18 checks passed.
- `npm run release:ready:local`: pass after unrestricted network retry. This proves the repo-local gate rehearsal only; it intentionally does not enforce Android/EAS, production secret, store-console, Supabase owner/dashboard, pushed-CI, dirty-worktree, `SEC-06`, `SEC-08`, `MER-PORTAL-01`, or `MERCH-P0-ANALYTICS-01` release evidence.
- Focused merchant analytics contracts after the latest emitter pass: `src/lib/services/supabase/merchant-linkage.test.ts` and `src/lib/services/mock/service-methods.test.ts` pass 40/40, and `npm run typecheck` passes.
- `npm run audit:supabase:advisor-security`: skip-safe in this environment because linked Supabase Advisor is not reachable. Treat Advisor owner/dashboard verification as an external blocker until live evidence is captured.
- QA/QC subagent audit completed on 2026-05-26 and confirmed current local gates are green, the dirty worktree must be captured before merge, and external release blockers still keep the decision at No-Go.

## Tasks Done In This Reconciliation

- Replaced the incomplete audit snapshot with this current status matrix.
- Downscaled marketing food PNGs from 1254 px square images to 768 px max dimension, preserving the generated visual set while cutting the folder size from 96 MB to about 39 MB.
- Tightened the marketing food asset audit budget in `scripts/audit-assets.mjs`.
- Added the generated onboarding food image bucket to `npm run audit:assets`, documented professional generated-photo provenance, and contract-guarded against stock, placeholder, or homemade-looking onboarding images.
- Added `npm run test:e2e:merchant-catalog`.
- Added a CI step to install Playwright Chromium and run the merchant catalog E2E smoke.
- Drafted `supabase/manual/migration_rollback_runbook.md`; it remains untracked in the current checkout and must be tracked/committed before this is clean repo-side evidence.
- Deployed an independent QA/QC subagent to audit the document and current code state.
- Hardened the local release gate so non-interactive missing Supabase CLI prompts stay Advisor skip-safe, TruffleHog fails on verified findings, ignored local env files are excluded from repo-content secret scans, and `scripts/release_ready_checklist.sh` lists pushed-CI and dirty-worktree evidence as remaining release blockers.
- Incorporated the latest QA/QC findings: dirty-worktree evidence now records the latest sample and treats `git status --porcelain=v1` as the closeout source of truth, TruffleHog evidence is described as verified-only, and outstanding `SEC-06` / `SEC-08` / `MER-PORTAL-01` / `MERCH-P0-ANALYTICS-01` runtime verification gates are listed as release blockers.
- Incorporated the latest QA/QC correction that the release evidence example and migration rollback runbook are still untracked in this dirty checkout; they must be tracked/committed during dirty-worktree reconciliation before they count as clean repo-side proof.
- Added local merchant analytics coverage for the existing menu, directions, save, share, and profile-view controls, and made mock merchant analytics update from explicit action events instead of no-oping.

## Go / No-Go

**Current decision:** **No-Go for public launch.**

The repo-side P0/P1 items named in the original audit snapshot are fixed, drafted only in the dirty worktree, or explicitly tracked as external release gates. This does not mean every active backlog P0 is complete. The branch can continue as a release-candidate integration branch, but it should not be represented as production-ready until the external blockers above have evidence.
