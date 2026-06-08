# Hungry Website Security Review

Reviewed: 2026-06-01 (Asia/Singapore)  
Scope: `marketing/website/web-v2` working tree, including public pages, merchant portal, Hungry Console, API routes, Supabase server helpers, headers, dependencies, and local runtime checks.  
Production: not touched.

## Executive Summary

Verdict: **Not production ready**.

Overall grade: **D+**. The site has useful building blocks: HttpOnly merchant cookies, server-side Supabase access, JSON-LD escaping, narrow image remote patterns, and an attempted Console API token guard. The current working tree is still unsafe for launch because it does not build, local runtime routes return 500, the Console API auth helper is miswired, CSRF/rate-limit protections are missing, and browser security headers are not configured globally.

Primary launch blockers:

| Severity | Finding | Evidence | Risk | Recommended fix |
|---|---|---|---|---|
| P0 | Website currently fails TypeScript/runtime due to broken Console auth import | `src/app/api/console/summary/route.ts:4` imports `./_auth`; helper exists at `src/app/api/console/_auth.ts`, so the correct relative import is `../_auth`. `npx tsc --noEmit` fails with TS2307. Local `curl` for `/`, `/merchant`, `/console`, `/api/merchant/session`, `/api/waitlist`, and `/api/console/summary` returned HTTP 500 with the same module-not-found error. | The website cannot be reliably served or security-tested; any production deploy would fail or serve error pages. | Fix the import, rerun typecheck/build/runtime checks, then repeat security verification. |
| P0 | Console service-role endpoints depend on a bearer/header/cookie token helper but lack a complete app-level auth model | `src/app/api/console/_auth.ts:3-50`; service-role reads/writes in `websiteData.ts:226-247`, `websiteData.ts:272-321`, and verification route lines `24-50`. | A single shared token is weaker than per-user admin auth; cookie token mode would need CSRF protection. If the helper is bypassed or misconfigured, service-role data is exposed. | Gate Console routes with real admin sessions/roles; keep token auth only for server-to-server automation, and require it on every service-role API. |
| P0 | Missing CSRF protection for cookie-authenticated merchant mutations | Merchant cookies are `SameSite=Lax` in `api/merchant/login/route.ts:17-30`; mutation routes rely on cookies in `_session.ts:6-12`; profile/menu/verification/logout do not check Origin, Fetch Metadata, or CSRF tokens. | Cross-site requests can trigger state changes if browser conditions allow cookies; `SameSite=Lax` is helpful but not a complete mutation defense. | Add middleware/helper for unsafe methods: reject cross-site `Sec-Fetch-Site`, verify `Origin`/`Host`, and require an app-issued CSRF token or custom header. |
| P0 | Critical security headers are absent from `next.config.ts` | `next.config.ts:26-64` only sets cache headers for assets; no CSP, HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy. Runtime error responses showed only cache/content headers. | Increased XSS, clickjacking, MIME sniffing, referrer leakage, and over-permissive browser API exposure risk. | Add global headers for all routes. Start with report-only CSP, then enforce after route testing. |
| P0 | Dependency audit reports current moderate advisory in Next/PostCSS chain | `npm audit --audit-level=moderate` reports `postcss <8.5.10` XSS via unescaped `</style>` through `next 16.2.6`. | Known dependency vulnerability remains in the shipped web bundle. | Upgrade Next/PostCSS to a patched release once available/compatible; do not use `npm audit fix --force` blindly because it proposes a breaking downgrade. |
| P1 | Waitlist endpoint has no rate limit, bot control, or payload size strategy | `src/app/api/waitlist/route.ts:11-43`; public POST accepts JSON and writes through `submitWebsiteWaitlist`; no IP/email throttling or captcha. | Spam, database write amplification, and noisy lead data. | Add per-IP and per-email rate limits, request-size cap, honeypot/Turnstile, and generic error responses. |
| P1 | Merchant login has no rate limit or lockout | `src/app/api/merchant/login/route.ts:7-39`; directly calls Supabase password grant. | Credential stuffing and brute-force pressure against Supabase Auth. | Add IP/email throttling and alerting; consider Supabase Auth protections and leaked-password/MFA policies for merchant users. |
| P1 | Server error messages can disclose internal Supabase paths/details | `supabaseFetch` throws `Supabase ${method} ${path} failed: ${detail}` in `server.ts:199-207`; route handlers often return `error.message`. | Attackers may learn table names, policy failures, schema details, or configuration state. | Log detailed server errors internally; return stable public error codes/messages to clients. |
| P1 | Client-side admin/merchant simulation state uses `localStorage` for privileged-looking state | `merchantVerification.ts:71-105`; Console pages store reports, users, flags, merchants, feedback, applications in localStorage. | Users can alter local-only “admin” state; screenshots/demo flows can imply security controls that are not backend-enforced. | Clearly fence prototype-only state behind dev flags or replace with authenticated backend APIs before launch. |
| P2 | Build verification blocked by stale `.next/lock` during this pass | `npm run build:webpack` failed with “Another next build process is already running”; `.next/lock` exists. | CI/release confidence incomplete in the current local state. | Clear stale local build artifacts in a controlled dev cleanup, then rerun build in CI. |

What is safe to keep:

- Merchant session tokens are set as HttpOnly cookies and `secure` in production (`api/merchant/login/route.ts:17-30`).
- Merchant dish update/delete scopes requests by `venue_id` in addition to `dishId` (`api/merchant/menu/[dishId]/route.ts:49-80`).
- JSON-LD uses `JSON.stringify` and escapes `<` before `dangerouslySetInnerHTML` (`JsonLd.tsx:7-10`).
- `next.config.ts` disables `poweredByHeader` (`next.config.ts:7-8`) and constrains remote images to `images.unsplash.com` (`next.config.ts:17-24`).

## Standards Used

- OWASP HTTP Security Response Headers Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Next.js `headers` configuration: https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
- Next.js CSP guide: https://nextjs.org/docs/app/guides/content-security-policy
- Vercel response/system headers: https://vercel.com/docs/headers/response-headers and https://vercel.com/docs/headers

## Route Matrix

| Route | Type | Auth now | Runtime observed | Security notes |
|---|---|---:|---|---|
| `/` | Public page | None | HTTP 500 due Console `_auth` import error | Runtime security headers could not be fully assessed. |
| `/for-foodies` | Public page | None | Not reached after global compile error | Static page risk only. |
| `/for-merchants` | Public page | None | Not reached after global compile error | Prior memory says this route can be heavy; verify separately after build fixes. |
| `/join-waitlist` | Public page | None | Not reached after global compile error | Form posts to public waitlist API. |
| `/privacy`, `/terms`, `/account/delete` | Public legal pages | None | Not reached after global compile error | Should be cacheable, but still needs global security headers. |
| `/merchant/login` | Merchant login | Public | Not reached after global compile error | Needs rate limit and generic errors. |
| `/merchant/*` | Merchant portal | Client layout calls `/api/merchant/session` | `/merchant` returned HTTP 500 due global compile error | API auth exists, but no CSRF on mutations. |
| `/console/*` | Hungry Console UI | No route-level server auth found | `/console` returned HTTP 500 due global compile error | Console UI contains localStorage-backed admin state; needs real admin auth before launch. |
| `/api/waitlist` | Public API POST | None | HTTP 500 due global compile error | Needs rate limit/bot protection. |
| `/api/merchant/login` | Public API POST | None | Not separately reached after global compile error | Sets HttpOnly cookies on success. |
| `/api/merchant/logout` | API POST | Cookie optional | HTTP 500 due global compile error | Logout accepts POST without CSRF; low risk but should share unsafe-method protections. |
| `/api/merchant/session` | API GET | Merchant cookie required | HTTP 500 due global compile error | Expected unauthenticated result should be 401 after build fix. |
| `/api/merchant/overview` | API GET | Merchant cookie required | Not reached | Expected 401 without cookie. |
| `/api/merchant/menu` | API GET/POST | Merchant cookie required | Not reached | POST needs CSRF and input validation bounds. |
| `/api/merchant/menu/[dishId]` | API PATCH/DELETE | Merchant cookie required | Not reached | Scopes by venue, but still needs CSRF and stricter body validation. |
| `/api/merchant/profile` | API PATCH | Merchant cookie required | Not reached | Writes outlet and linked venue fields from request body; needs CSRF and stricter field validation. |
| `/api/merchant/verification` | API POST | Merchant cookie required | Not reached | Writes verification state; needs CSRF and file-upload backend integration review. |
| `/api/console/summary` | API GET | Token helper intended | HTTP 500 due wrong import | Once fixed, should return 401/503 without token, never service-role data. |
| `/api/console/merchants` | API GET | Token helper intended | Not reached | Uses service-role merchant/account/venue reads. |
| `/api/console/merchants/[outletId]/verification` | API PATCH | Token helper intended | HTTP 500 due global compile error | Service-role mutation; shared-token auth and CSRF/cookie mode need hardening. |

## Header And Runtime Matrix

Runtime was blocked by the global module-resolution error, so observed headers came from Next error responses rather than valid app pages.

| Check | Observed | Risk |
|---|---|---|
| HTTP status for representative routes | `/`, `/merchant`, `/console`, `/api/merchant/session`, `/api/waitlist`, `/api/console/summary` returned 500 | P0 build/runtime blocker. |
| `Content-Security-Policy` | Not present in source headers and not present in observed error response | XSS/code-injection defense missing. |
| `Strict-Transport-Security` | Not present in source headers and not present in observed error response | HTTPS downgrade resilience missing in production unless supplied by hosting. |
| `X-Frame-Options` / `frame-ancestors` | Not present | Clickjacking defense missing. |
| `X-Content-Type-Options` | Not present | MIME sniffing defense missing. |
| `Referrer-Policy` | Not present | Referrer leakage risk. |
| `Permissions-Policy` | Not present | Browser feature surface not constrained. |
| Cache-Control | Asset-only custom cache rules in `next.config.ts`; error responses use `no-cache, must-revalidate` | Asset rules are fine after valid source syntax, but global app/API cache policy should be explicit for sensitive routes. |

Recommended baseline after build fix:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in production only
- CSP report-only first, then enforce. Start with `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https://images.unsplash.com; connect-src 'self' https://*.supabase.co; script-src 'self' 'unsafe-inline' 'unsafe-eval'` for development only; tighten production with nonce/SRI per Next guidance.

## Supabase And Service-Role Risk Matrix

| Area | Evidence | Risk | Fix |
|---|---|---|---|
| Service-role env resolution | `server.ts:65-68` reads `SUPABASE_SERVICE_ROLE_KEY` / `HUNGRY_SUPABASE_SERVICE_ROLE_KEY`. | Correctly server-only if never exposed; high blast radius if any Console route lacks auth. | Keep service role only in server runtime; add static tests forbidding service role in client modules. |
| Generic Supabase fetch | `server.ts:168-184` sends anon/service key as `apikey` and bearer token. | Correct pattern, but route callers decide privilege. | Require explicit justification wrappers for service-role calls. |
| Console summary | `websiteData.ts:226-247` counts waitlist, users, merchants, verifications, reports with service role. | Sensitive business/admin metrics exposed if auth fails. | Enforce admin session/token before every call; return 401 by default. |
| Console merchants | `websiteData.ts:272-321` reads merchant outlets, accounts, venues, verification rows, dish counts with service role. | Merchant/customer data exposure. | Admin-only API, field minimization, audit logging. |
| Console verification mutation | `api/console/merchants/[outletId]/verification/route.ts:24-50` service-role upserts verification and audit event. | Any authorized caller can mutate arbitrary `outletId`. | Validate outlet exists, require admin role, log real actor, rate-limit, use Postgres RPC with checks if possible. |
| Waitlist service-role upsert | `websiteData.ts:184-191` upserts waitlist when service role configured. | Public endpoint can drive service-role writes. | Rate-limit and validate input; keep payload minimal. |
| Merchant user access | `getMerchantPortalOverview` loads merchant account by Supabase user id/role and outlet ownership. | Good direction if RLS is correct; current website depends on Supabase RLS for write safety. | Add tests for cross-merchant access denial and prefer checked RPCs for complex writes. |

## Client Storage And Prototype State

The website currently stores security-adjacent UI state in browser storage:

- Merchant verification state in `src/lib/merchantVerification.ts:71-105`.
- Console merchants, reports, feedback, users, feature flags, and merchant applications in localStorage-backed pages.
- `src/app/console/page.tsx` changes environment display based on `localStorage.getItem("env")`.

This is acceptable for internal prototypes only. For production, these controls must be treated as display-only until backed by authenticated APIs, role checks, server audit logs, and tamper-resistant state.

## Dependency And CI Gate Review

Checks run:

| Command | Result | Notes |
|---|---|---|
| `npm audit --audit-level=moderate` | Fail | 2 moderate vulnerabilities: `postcss <8.5.10` via Next. The suggested `npm audit fix --force` would install `next@9.3.3`, so do not run it blindly. |
| `npx tsc --noEmit` | Fail | `src/app/api/console/summary/route.ts(4,41): Cannot find module './_auth'`. |
| Focused `npx eslint --no-cache ...` | Pass | Security-critical API/Supabase files lint clean. |
| `npm run build:webpack` | Blocked | Existing `.next/lock` caused “Another next build process is already running.” |
| Runtime `curl` checks | Fail | Representative routes returned HTTP 500 from the Console auth import error. |
| Secret scan by `rg` | No committed secret values found in searched website files | Only env variable names and password field variable references were found. |

Missing gates:

- No website-specific security test suite was found under `marketing/website/web-v2/src`.
- No route authorization tests were found for Console or Merchant APIs.
- No automated header/CSP smoke was found.
- No API rate-limit/CSRF tests were found.

## Prioritized Remediation Plan

### P0 - Must Fix Before Any Public Deploy

1. **Fix build/runtime blocker**
   - Change `src/app/api/console/summary/route.ts` import from `./_auth` to `../_auth`.
   - Clear stale local `.next` lock/cache only in dev or CI workspace.
   - Verify: `npx tsc --noEmit`, `npm run build:webpack`, `curl -I /`, and route smoke.

2. **Finish Console API authorization**
   - Require `requireConsoleApiAccess` on every `src/app/api/console/**/route.ts`.
   - In production, fail closed if `HUNGRY_CONSOLE_API_TOKEN` is absent.
   - Prefer real admin session/role authorization before public launch; shared token is acceptable only for temporary server-to-server/internal use.
   - Verify unauthenticated `/api/console/summary`, `/api/console/merchants`, and `/api/console/merchants/:id/verification` return 401/503, never service-role data.

3. **Add CSRF and origin protections**
   - Create one unsafe-method guard for merchant and cookie-enabled console routes.
   - Reject `Sec-Fetch-Site: cross-site`; verify `Origin`/`Host`; require a same-origin custom header or signed CSRF token for POST/PATCH/DELETE.
   - Verify cross-site-style POST/PATCH requests are rejected.

4. **Add global security headers**
   - Implement global headers in `next.config.ts` or middleware/proxy.
   - Use CSP report-only first; enforce after route/browser compatibility checks.
   - Verify representative pages and APIs include expected headers.

5. **Address dependency advisory**
   - Track Next/PostCSS patched release and upgrade safely.
   - Do not run `npm audit fix --force` because the current recommendation is a breaking downgrade.

### P1 - Should Fix Before Beta

1. Add rate limits for waitlist, merchant login, merchant mutations, and console mutations.
2. Replace route-returned raw `error.message` with stable client-safe error codes.
3. Add strict request body validation and field length limits for waitlist, profile, menu, verification, and console verification status updates.
4. Add server audit logs with real actor identity for Console changes.
5. Add website-specific tests:
   - Console unauthenticated denial.
   - Merchant unauthenticated denial.
   - CSRF rejection.
   - Security headers.
   - Waitlist validation/rate-limit behavior.
6. Remove or clearly fence prototype localStorage admin state from production builds.

### P2 - Improve After Beta

1. Move Console auth to Supabase Auth/admin role or a dedicated internal identity provider.
2. Use checked Postgres RPCs for merchant and console mutations.
3. Add CSP violation reporting, Sentry/server logging, and alerting on 401/403 spikes.
4. Add dependency/license/security gates to CI for `marketing/website/web-v2`.
5. Add a repeatable production header smoke and rollback checklist.

## QA/QC Review Notes

- The biggest finding changed during the audit: the Console APIs now have an attempted auth helper, but the summary route import is wrong, causing source and runtime failure. The report therefore treats unauthenticated service-role exposure as a design risk to verify after the build fix, not as a proven runtime leak in this exact broken state.
- The working tree is dirty and includes untracked `src/app/api`, `src/app/console`, `src/app/merchant`, and `src/lib` directories under `web-v2`; release/staging state may differ from this local audit.
- Runtime evidence is from localhost only. Production headers and deployment behavior were not checked.

## Implementation Pass - 2026-06-01

Scope: safe repo-side hardening only. Production was not touched.

Implemented:

- Fixed the Console summary auth-helper import in the current tree so TypeScript/build/runtime no longer fail on `./_auth`.
- Added global security headers in `marketing/website/web-v2/next.config.ts`:
  - `Content-Security-Policy-Report-Only`
  - `Cross-Origin-Opener-Policy`
  - `Permissions-Policy`
  - `Referrer-Policy`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - production-only `Strict-Transport-Security`
- Preserved and extended the existing merchant double-submit CSRF mechanism:
  - merchant login/session issue or refresh a readable CSRF cookie
  - merchant mutation routes reject missing/mismatched CSRF headers
  - merchant mutation routes reject `Sec-Fetch-Site: cross-site`
  - merchant UI mutation calls use `merchantMutationFetch`
- Added same-origin mutation protection for the Console merchant verification route.
- Added basic in-memory rate limits for:
  - waitlist submissions
  - merchant login
  - merchant menu create/update/delete
  - merchant profile updates
  - merchant verification submissions
  - Console merchant verification updates
- Replaced route-returned raw `error.message` bodies with stable client-safe messages for the security-critical API routes.
- Added `npm run security:audit` using `scripts/security-route-contracts.mjs` to assert the route/source security contracts.
- Cleared blocking React lint errors in merchant/console child pages that prevented a clean focused website lint run.

Verification after implementation:

| Command/check | Result | Notes |
|---|---|---|
| `npm run security:audit` | Pass | Security source contracts passed. |
| `npx tsc --noEmit` | Pass | Web-v2 TypeScript clean. |
| Focused `npx eslint --no-cache next.config.ts src/app/api src/lib/security src/lib/merchantPortal src/lib/supabase src/app/merchant src/app/console` | Pass with warnings | 0 errors; 21 pre-existing warnings remain for unused imports and `<img>` usage. |
| `npm run build:webpack` | Pass | Production build compiled and generated 42 static pages. |
| `npm audit --audit-level=moderate` | Fail | Existing `next` / `postcss <8.5.10` advisory remains; `npm audit fix --force` still proposes a breaking downgrade and was not run. |
| Local `GET /` | Pass | HTTP 200 with the configured security headers. |
| Local unauthenticated `GET /api/merchant/session` | Pass | HTTP 401 with stable client-safe error. |
| Local cross-site `POST /api/merchant/logout` | Pass | HTTP 403. |
| Local cross-site `PATCH /api/console/merchants/test-outlet/verification` | Pass | HTTP 403. |
| Local invalid `POST /api/waitlist` with no Supabase env configured | Pass | HTTP 400 with stable client-safe error. |
| Local `GET /api/console/summary` in dev with no Supabase env configured | Pass | HTTP 200 with `{ configured: false }`; production still fails closed when the Console token is absent. |

Remaining launch risks after the first pass:

- Replace prototype localStorage-backed Console fallback state with server-backed admin APIs before relying on those controls for real operations. The browser-local persistence is now fenced off in production unless explicitly enabled.
- Configure production Redis REST rate-limit secrets so the durable limiter is active across server instances.
- Apply and seed the Console admin-role migration, then decide whether the shared token remains for automation or is removed.
- Continue replacing page-level mock data with server-backed read/write APIs as each Console area leaves prototype mode.

## Implementation Pass - 2026-06-01 Continued

Scope: remaining safe repo-side findings from the first security-review pass. Production was not touched.

Implemented:

- Resolved the current `npm audit --audit-level=moderate` finding by pinning `postcss` to `8.5.10` through the web-v2 package override and regenerating the lockfile. `npm audit` now reports zero vulnerabilities in the website package.
- Upgraded the shared API rate limiter from process-local only to Redis REST-backed when `HUNGRY_RATE_LIMIT_REDIS_REST_URL` / `HUNGRY_RATE_LIMIT_REDIS_REST_TOKEN` or the Upstash equivalents are configured. The in-memory limiter remains only as a local/fallback safety net.
- Added `public.website_console_admins` with RLS, service-role-only grants, role/status constraints, and a smoke check so Console API access can be bound to real Supabase Auth users with `admin` or `ops` role.
- Updated Console API authorization to accept either the existing static break-glass/automation token or a Supabase Auth bearer token whose user is active in `website_console_admins`.
- Updated route-contract checks and environment documentation for the admin-role and durable-rate-limit paths.
- Added bounded JSON parsing and type/length validation to the security-critical waitlist, merchant auth, merchant profile/menu/verification, and Console verification mutation routes.
- Fenced Console prototype `localStorage` persistence behind `NEXT_PUBLIC_HUNGRY_CONSOLE_PROTOTYPE_STORAGE`, with production defaulting to no browser-local admin persistence.

Manual actions required before production:

- Apply `supabase/migrations/20260601090000_website_console_admin_roles.sql` to staging, then production after smoke verification.
- Insert at least one active Console admin row for a real Supabase Auth user in `public.website_console_admins`.
- Configure Redis REST rate-limit secrets in production. Without them, the limiter is not durable across server instances.
- Decide whether the shared Console token remains enabled for automation only or is removed after admin-role sign-in is fully wired in the Console UI.

Verification after continued pass:

| Command/check | Result | Notes |
|---|---|---|
| `npm run security:audit` in `marketing/website/web-v2` | Pass | Security source contracts passed. |
| `npm audit --audit-level=moderate` in `marketing/website/web-v2` | Pass | `found 0 vulnerabilities` after the `postcss` override. |
| `npx tsc --noEmit` in `marketing/website/web-v2` | Pass | Web-v2 TypeScript clean. |
| `npm run lint` in `marketing/website/web-v2` | Pass | Full web-v2 ESLint now exits with no errors or warnings. |
| `npm run build:webpack` in `marketing/website/web-v2` | Pass | Production build compiled and generated 46 static pages. |
| Scoped `git diff --check` | Pass | No whitespace errors in touched paths. |
| Root `npm run audit:supabase:static` via `/opt/homebrew/bin/npm` | Pass | Static audit completed with the new migration included. |
| Linked `supabase db push --dry-run --include-all` | Pass | Non-mutating dry-run lists six pending migrations, including `20260601090000_website_console_admin_roles.sql`; no migration was applied. |
| Local `GET /` | Pass | HTTP 200 with configured security headers. |
| Local unauthenticated `GET /api/merchant/session` | Pass | HTTP 401 with stable client-safe error. |
| Local cross-site `POST /api/merchant/logout` | Pass | HTTP 403. |
| Local cross-site `PATCH /api/console/merchants/test-outlet/verification` | Pass | HTTP 403. |
| Local malformed JSON `POST /api/waitlist` | Pass | HTTP 400 with stable validation error. |
| Local malformed JSON `POST /api/merchant/login` | Pass | HTTP 400 with stable validation error. |
