# Independent browser QA — remediation

Status: **bounded six-case interaction suite and four converted composer cases pass**. Evidence is local Expo Web with mock services, installed Chrome, 390×844 viewport. It does not establish native, Supabase, staging, production, or release readiness.

## Current evidence

`E2E_PORT=8092 npx playwright test --config tasks/remediation-2026-10-20/browser/playwright.config.ts` (`browser-run-8.log`): **6 passed (1.0m)**. Fresh Welcome → existing-account Sign in validates invalid email and missing password. Actual onboarding Local selection and sweet8 survive reload; resumed Spicy → Back shows saved Sweet-forward physically centered (bounding-box assertion). Settings shows readonly authoritative fixture email after cold reload and preserves a changed haptic preference. Discover keeps the same dish across the former cycling interval and opens the corresponding detail. Composer preserves account draft text after reload. Valid mock Sign in establishes user-1 instead of a guest identity.

No page exceptions or console errors were observed in run 8. Runtime JSON preserves RN Web deprecation/native-driver warnings and an additional unsupported expo-file-system warning on account reset. The stricter legacy fixture caught the latter; the integrator guarded native export cleanup on web, and final converted run 5 passes without suppressing it. Runner also emits Node module.register and color-environment warnings.

## Defects independently reproduced

- Quiz persisted sweet8 while physically displaying Light after reload/Back. Specialist repaired programmatic answer handling, per-question list identity, derived selection, and horizontal overflow. Run 7 now passes saved-value plus rendered-centering checks.
- Discover accessibility labels retained unsupported time/editorial/trending claims despite corrected visible copy. Specialist removed these claims and added focused tests.
- Mock Settings reload retained user-1/email in storage but displayed authentication email unavailable; integrator traced profile repair mistakenly treating mock IDs as invalid production IDs.
- Valid mock Sign in used a guest identity; integrator repairing the common authentication path.
- Hydration readiness initially blocked authenticated presets (“Connecting securely…”): local session reset cleared its completed hydration flag. Integrator preserved it and added regressions. Run 8 confirms preset readiness works.
- Account reset loads native export filesystem code on web, emitting unsupported-filesystem warnings. The stricter converted-suite runtime gate caught this; integrator added a platform guard. Converted run 5 confirms the warning is gone.

## Legacy expectation repair

Updated `tests/e2e/helpers/app.ts` for supported Create post / Publish post semantics and current caption placeholder. Removed obsolete View Post success-button clicks from three existing publication specs. Replaced four prototype AI/scheduling button scenarios in `buttons-interactions.spec.ts` with supported composer actions, explicit absence of removed controls, disabled publication without media, and account draft restoration. Assertions for actual publication/feed/profile outcomes remain in their existing specs.

Bounded converted-suite command: `E2E_PORT=8093 npx playwright test --config tasks/remediation-2026-10-20/browser/composer-legacy.config.ts`. Run 1 ended with environmental ENOSPC. Run 2 stalled at the authenticated preset; only its own runner PID was terminated after more than three minutes. Run 3 raced shutdown of that reused server and recorded connection refusals. Fresh run 4 completed all actual interactions but all four cases fail the runtime-warning gate solely on `expo-file-system is not supported on web`. After the native filesystem cleanup guard, fresh run 5 records **4 passed (1.0m)**, including the stricter console-warning, page-exception, and failed-request gate.

Prettier check passed for both bounded configs/spec and all five modified legacy E2E files. Full old E2E suite was intentionally not run: unrelated prototype, signup/verification, feed sync, and cross-user suites retain unverified expectations. No full-suite green claim is made.

## Evidence handling and limits

Earlier run logs are preserved (`browser-run-1.log` through `browser-run-8.log`, `quiz-repro.log`, legacy logs). Early failures include test-selector corrections and interrupted diagnosis, not only product defects. Current screenshots/runtime JSON and `results.json` are overwritten by the latest run; use the numbered logs for provenance. Quiz storage snapshots contain mock preference state only. Settings snapshots contain fixture profile identity/email only.

No live authentication or remote data mutation was performed. Browser scrolling/keyboard rendering does not prove VoiceOver, TalkBack, native permissions, native large-text behavior, or offline-device recovery. Production-gated flows remain unverified here. Six-case evidence precedes only the final native export cleanup platform guard; the converted four-case suite was run after that guard. `source-head.txt`, `source-fingerprints.txt`, and `source-fingerprints-after-web-guard.txt` identify the bounded source evidence in this dirty shared checkout. These are not commit-wide release fingerprints.
