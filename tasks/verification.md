# Hungry Verification

> Current verification bundle evidence.
> Update this file for the latest known-good state.

## Standard Bundle

1. `npm run typecheck`
2. `npm test -- --runInBand`
3. `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor`

## Latest Known Good

| date | scope | command | result | notes |
|---|---|---|---|---|
| 2026-04-23 | app | `npm run typecheck` | Pass | Recorded in `tasks/todo.md` Sprint 11 gate |
| 2026-04-23 | app | `npm run test -- --runInBand` | Pass | Current suite green after follow-up fixes |
| 2026-04-23 | app | `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor` | Pass | Requires writable npm cache path |
| 2026-04-23 | marketing/web | `npm run lint` | Pass | From `marketing/web/` |
| 2026-04-23 | marketing/web | `npm run build` | Pass | Routes `/`, `/for-merchants`, `/about`, `/privacy`, `/api/waitlist` |
| 2026-04-27 | app | `npm run typecheck` | Pass | UI interaction polish pass |
| 2026-04-27 | app | `npm run test` | Pass | Uses `tsx --tsconfig tsconfig.test.json` with `HUNGRY_DISABLE_ASYNC_STORAGE=1` and `HUNGRY_DISABLE_SECURE_STORE=1` |
| 2026-04-28 | app | `bash scripts/release_ready_checklist.sh` | Pass | Typecheck + tests + expo-doctor all passed using `/tmp/hungry-npm-cache` for doctor |
| 2026-04-28 | app (ACCDEL-01) | `npm run typecheck` | Pass | Added Settings account deletion entry path, confirm dialog, and service contract/stubs with sign-out completion |
| 2026-04-28 | app (ACCDEL-01) | `npm test -- src/lib/services/mock/service-methods.test.ts` | Pass | Covers new `auth.requestAccountDeletion` mock-safe session clearing behavior |
| 2026-04-29 | app (claim CTA + CLM-04) | `npm test -- --watch=false` | Pass | 85 tests total; includes Sprint 10 claim contract checks, claim helper telemetry+submission tests, and staging/prod feature flag assertions |
| 2026-04-29 | app (test runtime trust) | `npm test -- --watch=false` | Pass | Node 25 runtime note documented in `tasks/node25-test-runtime.md`; suite is stable under current tsx harness |
| 2026-04-29 | app security (SEC-03/SEC-04) | `git ls-files .env.local` | Pass | No current index entry after `git rm --cached .env.local`; `HEAD` retains the file until commit |
| 2026-04-29 | app security (SEC-04) | `npm audit --audit-level=moderate` | Pass | Root mobile audit reports `found 0 vulnerabilities` |
| 2026-04-29 | app security (SEC-04) | `npm run typecheck` | Pass | TypeScript strict gate passed after security remediation |
| 2026-04-29 | app security (SEC-04) | `npm run test` | Pass | 97 tests: 95 pass, 2 skipped |
| 2026-04-29 | app security (SEC-04) | `npm_config_cache=/tmp/hungry-npm-cache npx expo-doctor` | Pass | 17/17 checks passed; local `.env.local` still loads in Expo Doctor but is no longer tracked |
| 2026-04-30 | app security (SEC-04) | `brew install gitleaks libpq` | Pass | Installed local `gitleaks` and Homebrew `libpq`/`psql` tooling |
| 2026-04-30 | app security (SEC-04) | `gitleaks protect --staged --redact` | Pass | No staged leaks found |
| 2026-04-30 | app security (SEC-04) | `gitleaks detect --redact --source .` | Fail | 13 historical redacted findings: prior `.env.local`, `ios/sentry.properties`, roadmap docs, and Figma concept README commits |
| 2026-04-30 | app security (SEC-04) | `gitleaks detect --redact --source . --no-git` | Fail | 50 local working-tree findings, mostly untracked/ignored `.env.local`, `.claude/worktrees`, web build cache, Pods signatures, and archived design/docs false positives |
| 2026-04-30 | app security (SEC-04) | `npm_config_cache=/tmp/hungry-npm-cache npx expo-doctor` | Pass | 17/17 checks passed |
| 2026-04-30 | app security (SEC-04) | `supabase db push --dry-run` | Pass | Would apply only `0016_mobile_storage_security.sql` |
| 2026-04-30 | app security (SEC-04) | `supabase db push --yes` | Pass | Applied `0016_mobile_storage_security.sql` to linked Supabase project |
| 2026-04-30 | app security (SEC-04) | `psql -f supabase/smoke/mobile_storage_policies.sql` | Pass | Remote has four mobile buckets, 17 storage policies, and hardened `submit_menu_photo` prefix validation |
| 2026-04-30 | security (SEC-01) | Supabase Auth leaked-password protection | Blocked | User confirmed feature is unavailable on current paid-plan tier |

## Outstanding Verification

| id | scope | required proof | owner |
|---|---|---|---|
| OCR-DG-01 | Sprint 10 OCR | Staging photo upload to `dishes_draft` within 30s | Codex |
| WEB-11 | Marketing deploy | Preview + production deploy evidence | Codex + User |
| ACCDEL-01 | Privacy/Legal | External public account deletion web endpoint + in-app/store policy link evidence | User |
| SEC-01 | Security | Supabase leaked-password protection enabled in dashboard | User; blocked until paid Supabase plan is available |
