# App Playwright Prelaunch Report

Updated: 2026-06-21  
Status: **Scaffolded; Expo webServer prompt blocker fixed for merchant-catalog smoke.**

## Required Suites

| Scenario | Existing / target file | Status |
|---|---|---:|
| guest browse | `tests/e2e/guest-browsing.spec.ts` | existing |
| auth gates | `tests/e2e/auth.spec.ts` | existing |
| search/discovery/detail | `tests/e2e/routes.spec.ts`, `tests/e2e/hardcoded-data-regression.spec.ts` | existing |
| review/post composer | `tests/e2e/post-generation.spec.ts` | partial |
| cross-user visibility | `tests/e2e/cross-user-visibility.spec.ts` | existing |
| production route flags | `tests/e2e/production-route-gating.spec.ts` | existing |
| merchant catalog | `tests/e2e/merchant-catalog.spec.ts` | existing |
| accessibility smoke | to add if gaps remain | pending |
| admin route security | website/console route checks | pending |

## Required Command

`npm run test:e2e` and `npm run test:e2e:merchant-catalog`

## Latest Evidence

- `scripts/run-expo.cjs` now preflights non-interactive `expo start --port=...`, sets `RCT_METRO_PORT`, and fails with a deterministic localhost-bind error instead of allowing Expo's `Use port null instead?` prompt.
- `playwright.config.ts` marks the Playwright webServer process with `HUNGRY_EXPO_E2E_WEBSERVER=1`.
- Focused E2E webServer contract passed.
- Elevated `E2E_PORT=8082 npm run test:e2e:merchant-catalog -- --reporter=line` passed 1/1 when localhost binding was available.

## Remaining Blockers

- Full `npm run test:e2e` was not rerun end-to-end in this pass.
- Sandboxed localhost binding can still return `EPERM`; run Playwright from a CI/local environment that permits binding `127.0.0.1`.
- Playwright validates Expo web behavior, not native store binaries.
- Full-platform social/merchant/admin flows require Supabase-backed staging users before Go.
