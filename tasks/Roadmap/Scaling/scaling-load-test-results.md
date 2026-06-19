# Scaling Load Test Results

Date: 2026-06-07
Status: scaffolding added; no production load test run

## Scripts

| Script | Mode | Default safety |
| --- | --- | --- |
| `scripts/load/public-web.k6.js` | Read-only website | Runs against local URL by default |
| `scripts/load/search.k6.js` | Read-only Supabase/API search | Fails closed without staging Supabase env |
| `scripts/load/discovery.k6.js` | Read-only discovery RPC | Fails closed without staging Supabase env |
| `scripts/load/detail.k6.js` | Read-only detail REST reads | Fails closed without staging Supabase env |
| `scripts/load/post-publish.k6.js` | Mutating post publish | Requires explicit staging and mutation env flags |
| `scripts/load/merchant-portal.k6.js` | Authenticated merchant | Requires explicit staging and auth env flags |
| `scripts/load/admin-dashboard.k6.js` | Authenticated admin | Requires explicit staging and auth env flags |

## Thresholds

- Read-only public web: `http_req_failed < 1%`, p95 under 800ms.
- Read-only Supabase/API: `http_req_failed < 1%`, p95 under 1000ms.
- Mutating/authenticated staging checks: `http_req_failed < 5%`, p95 under 1500ms.

## Required Environment

- `LOAD_BASE_URL` for website/portal scripts.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` for Supabase read scripts.
- `LOAD_ALLOW_MUTATIONS=1` and `LOAD_STAGING_ONLY=1` for mutating scripts.
- `LOAD_AUTH_TOKEN` or a scoped test credential for merchant/admin scripts.

## Current Result

No live load script was executed in this repo-local pass. `k6` is not installed in the current local shell, and running against production is explicitly out of scope. Load safety and threshold contracts were validated statically through `src/app/scaling-readiness-contracts.test.ts`.

Additional scaffold validation is available through `npm run scaling:validate`. It verifies the load script paths, fail-closed staging guards, no production URL defaults, CI static-gate posture, and stale plan wording such as legacy `marketing/web` build commands or `.k6.ts` script examples.

## Next Evidence To Collect

- Local public-web smoke with `k6` installed.
- Staging read-only Supabase load smoke.
- Owner-approved staging mutating smoke with disposable test accounts.
- Threshold tuning from real staging p95/p99 measurements.
