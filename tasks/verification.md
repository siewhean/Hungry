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

## Outstanding Verification

| id | scope | required proof | owner |
|---|---|---|---|
| OCR-DG-01 | Sprint 10 OCR | Staging photo upload to `dishes_draft` within 30s | Codex |
| WEB-11 | Marketing deploy | Preview + production deploy evidence | Codex + User |
| ACCDEL-01 | Privacy/Legal | External public account deletion web endpoint + in-app/store policy link evidence | User |
