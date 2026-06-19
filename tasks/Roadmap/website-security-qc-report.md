# Website Security QC Report

Date: 2026-06-18

## Fixed

- Added `marketing/website/web-v2/src/proxy.ts` using the Next 16 proxy convention.
- Proxy gates `/merchant/**` private pages by `hungry_merchant_access_token`.
- Proxy gates `/console/**` pages by console token/header/cookie and keeps the no-token bypass out of production.
- Added security headers in `marketing/website/web-v2/next.config.ts`:
  - `Content-Security-Policy`
  - `Content-Security-Policy-Report-Only`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - production-only `Strict-Transport-Security`
- Added no-store/noindex headers for private/auth surfaces:
  - `/merchant`, `/merchant/**`
  - `/console`, `/console/**`
  - `/api/merchant/**`
  - `/api/console/**`
- Proxy-generated merchant/console redirects and JSON denials also set no-store/noindex headers.
- Extended `marketing/website/web-v2/scripts/security-route-contracts.mjs` to assert proxy coverage.
- Added `marketing/website/web-v2/scripts/deployment-env-contracts.mjs` to fail closed when staging/production lacks a strong console token or configured Supabase admin bearer path.
- Added `marketing/website/web-v2/scripts/private-route-qc.mjs` to verify unauthenticated merchant/console denial and optionally exercise authenticated merchant/console page/API access when staging tokens are provided.
- Added server-side console waitlist redaction. Waitlist emails and sensitive metadata are masked by default before API responses reach the console UI.
- Added a service-role client exposure contract. `SUPABASE_SERVICE_ROLE_KEY` and `HUNGRY_SUPABASE_SERVICE_ROLE_KEY` are rejected anywhere under `web-v2/src` except `src/lib/supabase/server.ts`.
- Added merchant mutation audit logging. Merchant menu create/update/delete, profile update, and verification submit write `merchant_audit_logs` after authenticated, CSRF-protected, outlet-scoped mutations.
- Hardened `/api/waitlist` request validation. The public waitlist endpoint now rejects non-JSON content and enforces merchant business name, business type, and explicit non-generic "other" values server-side.
- Added shared console redaction helpers for table/detail surfaces. Console Users and Feedback now render masked emails, and Merchant Applications now render masked contacts, UENs, and SFA licence numbers by default.
- Extended Console Merchants details so UEN values are masked by default, the edit field is a replacement-only input, and audit logs do not include raw replacement UEN values.
- Made console prototype storage production-fail-closed. `NEXT_PUBLIC_HUNGRY_CONSOLE_PROTOTYPE_STORAGE` can no longer enable localStorage persistence in production, and console prototype tables use empty production fallbacks instead of sample records.
- Made the Console overview production fallback empty and truthful. Sample claims, sample alerts, sample traffic charts, fabricated active-user/merchant counts, and fabricated SLA values are not rendered in production fallback mode.
- Made Console notifications production fallback empty and action-safe. Sample campaigns are non-production only, and local-only notification actions are blocked in production fallback mode until a server-backed notification service exists.
- Made Console product analytics fail closed in production fallback mode. Prototype growth, funnel, release, website, and feature-flag dashboards are hidden until a live analytics warehouse or PostHog reporting connection is wired.
- Hardened Console Users production fallback behavior. Empty production fallback data no longer renders `NaN%`, and export/warn/suspend/activate/metric edits are blocked with a backend-not-connected error until server-backed user management exists.
- Hardened Merchant verification fallback behavior. Production fallback state uses a generic stall identity, does not expose demo merchant names or fake ACRA details, and fences the Corppass modal behind non-production prototype mode.
- Confirmed existing contracts for merchant CSRF, console API auth, waitlist rate limits, waitlist JSON/content validation, and rate-limit env markers.

## Remaining Security Blockers

- Need authenticated staging browser/API proof that non-merchant users cannot access merchant pages. The private-route QC is wired, but real staging merchant/non-merchant credentials are still required.
- Need authenticated staging browser/API proof that non-admin users cannot access console pages. The private-route QC supports admin/non-admin bearer proof, but real staging accounts are still required.
- Need final owner-controlled proof that production/staging runs `npm run env:validate` with real env and passes. Local skip mode and synthetic proof mode are verified, but real secret configuration is not visible from this repo.

## Command Evidence

- `cd marketing/website/web-v2 && npm run security:audit`: passed on 2026-06-18.
- `cd marketing/website/web-v2 && WEBSITE_BASE_URL=http://127.0.0.1:3016 npm run private-routes:qc`: passed on 2026-06-18 against the local production server for unauthenticated merchant/console denial; authenticated branches skipped because staging tokens were not set.
- `cd marketing/website/web-v2 && npm run env:validate`: passed on 2026-06-18 in local skip mode.
- `cd marketing/website/web-v2 && HUNGRY_REQUIRE_DEPLOY_ENV_PROOF=1 ... npm run env:validate`: passed on 2026-06-18 with synthetic non-secret staging values.
- Local production header probe on `http://127.0.0.1:3004`: `/merchant`, `/merchant/login`, `/console`, `/console/waitlist`, `/api/console/waitlist`, and `/api/merchant/session` returned `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` and `X-Robots-Tag: noindex, nofollow, noarchive`.
- Local token-authenticated console probe on `http://127.0.0.1:3005`: `/console` and `/console/waitlist` returned 200 with private headers; `/api/console/waitlist` returned data with the temporary token cookie and 401 without it.
- `npm run security:gitleaks`: passed on 2026-06-18.
- `npm run security:trufflehog`: passed on 2026-06-18 with no verified or unverified secrets.
- `npm run security:audit`: passed on 2026-06-18 after `ws`, `esbuild`, and `js-yaml` were pinned to patched transitive versions through root package overrides.
- `npm run website:predeploy:local`: passed on 2026-06-18 after adding console waitlist email and metadata redaction contracts.
- `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`: passed on 2026-06-18 after the console waitlist response shape change.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after expanding console redaction to Users, Feedback, and Merchant Applications.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after masking Console Merchants drawer UEN display/audit behavior.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after making console prototype storage and local seed fallbacks production-fail-closed.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after removing fabricated Console overview production fallback data.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after making Console notifications seed campaigns and local-only actions fail closed in production fallback mode.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after making Console product analytics prototype dashboards fail closed in production fallback mode.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after hardening Console Users empty-state rate calculations and production-local action guards.
- `npm run website:predeploy:local`, `cd marketing/website/web-v2 && npm run lint`, `cd marketing/website/web-v2 && npx tsc --noEmit --project tsconfig.json --incremental false`, and `git diff --check`: passed on 2026-06-18 after making Merchant verification fallback identity and Corppass prototype behavior production-safe.
- `cd marketing/website/web-v2 && npm run build`: passed on 2026-06-18 after rerunning outside the sandbox for Google Fonts access; webpack cache emitted local `ENOSPC` warnings due 366 MiB free disk, then `.next` was cleared with `npm run clean`.
