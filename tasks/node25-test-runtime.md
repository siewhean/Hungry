# Node 25 Test Runtime Note (OCR-DG-03)

## Issue

Earlier notes referenced a Node 25 + esbuild transform mismatch that made full test runs unreliable.

## Current resolution

`npm test` is now stable under the current repo harness:
- command: `npm test -- --watch=false`
- runner: `tsx --test` with `tsconfig.test.json`
- test env guards: `HUNGRY_DISABLE_ASYNC_STORAGE=1`, `HUNGRY_DISABLE_SECURE_STORE=1`

Latest full run (2026-04-29):
- tests: 85 total
- pass: 83
- fail: 0
- skipped: 2

## Trust boundary

- This closes the test-runner trust issue for current CI/local harness semantics.
- If native-runtime E2E tests are added later, they should be tracked separately from this Node test harness.
