# Security Policy — Hungry Mobile

## Reporting a Vulnerability

- Report vulnerabilities privately to `security@hungry.sg`. Until dedicated domain inboxes are provisioned, use `tohsh17@gmail.com` as the interim disclosure channel.
- Include the affected feature, build identifier (from Settings → About), reproduction steps, impact, and supporting artifacts (logs, screenshots, proof-of-concept code).
- Expect an acknowledgement within three business days and a remediation timeline within ten business days.
- Do not publish exploit details until the Hungry team confirms the issue is resolved. Coordinated disclosure is appreciated.
- In-scope testing should be limited to accounts you own. Do not attempt to access other users' data, exfiltrate production data, or pivot into Supabase infrastructure.

## Scope

This policy covers the Hungry consumer mobile application and its immediate backend:

- The React Native / Expo iOS app (bundle identifier `app.hungry.mobile`).
- The React Native / Expo Android app (package `app.hungry.mobile`).
- Supabase backend: Postgres schemas, Row-Level Security policies, Edge Functions, and Storage buckets serving the mobile app.
- Deep links under the `hungry://` scheme and any future `https://hungry.sg/*` Universal / App Links.
- Build and release pipeline: EAS build, EAS Secrets, and Expo Updates when enabled.

Out of scope: any separate marketing website, unrelated Anthropic products mentioned in prior drafts of this file, and third-party SDKs (report those upstream).

## Security Baseline

### Client storage

- Session flags and non-sensitive UI state are persisted via `hungrySecurePersistStorage` backed by `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android) with a legacy AsyncStorage migration.
- Supabase authentication tokens are persisted via a SecureStore-backed adapter wired into `createClient`. They are chunked to respect Keychain / Keystore size limits and are never written to plain AsyncStorage in production. If SecureStore fails in production, tokens are kept memory-only and the user must re-authenticate after restart.
- Cart, discovery, profile, and UI preferences use a non-secure AsyncStorage adapter; no credentials, tokens, or PII should be placed in these stores.

### Networking

- iOS App Transport Security is enabled with `NSAllowsArbitraryLoads=false`. Release config does not declare local-network Bonjour usage.
- Android uses the platform HTTPS trust store through Expo-managed configuration. No production certificate/SPKI pinning is currently implemented.
- Public-key pinning is a future hardening item, not a current shipped control. Until then, Hungry relies on standard TLS/ATS plus provider-side token restrictions.

### Backend

- Every app-owned Supabase table has Row-Level Security enabled. Catalog content is `public_select`; all user-scoped rows require `auth.uid() = user_id` for reads and writes. The PostGIS-owned `public.spatial_ref_sys` table remains a Supabase-owner action tracked under the Advisor section below.
- Merchant Centre tables use owner/manager/member RLS policies. Merchant writes to linked venues, dishes, review replies, promotions, notification preferences, and interaction reports are restricted to merchant accounts connected to the target outlet or venue.
- Merchant venue and dish writes are additionally guarded by database triggers so merchants cannot mutate trust, aggregate, live-status, or system-managed catalog fields.
- Merchant review replies are protected by a database trigger: merchants can only change `merchant_reply_text` and `merchant_replied_at`, while review authors cannot change identity fields or merchant reply fields.
- Merchant verification decisions are admin-only database fields. Merchant evidence is uploaded to a private `merchant-verification-evidence` bucket and guarded so metadata must point to caller-owned storage paths.
- Storage bucket policies gate mobile writes by authenticated user UUID prefix. Mobile media buckets are provisioned in migrations, app uploads require signed upload URLs, overwrite uploads are disabled, and client uploads validate MIME, size, and magic bytes.
- Edge Functions use explicit CORS handling. `guest-sessions` is API-key protected with per-device rate limiting and SHA-256 token hashing. `ingest-menu-photo` requires a valid Supabase JWT, verifies submission ownership, rate-limits OCR starts, and uses an idempotent queued-state claim before service-role OCR work.
- `ops-dishes-draft` requires a Supabase JWT, checks `app_ops_admins`, enforces an origin allowlist, rate-limits operator actions, and writes audit events before using service-role operations.
- Account deletion requests, UGC content reports, and user blocks are written to RLS-protected Supabase tables for store-policy compliance and moderation follow-up.

### Privacy

- `ios/Hungry/PrivacyInfo.xcprivacy` enumerates every collected data type with linkage and non-tracking declarations.
- Google Play Data Safety mirrors the iOS declaration.
- Sentry and PostHog events pass through shared scrubbers that strip email, phone numbers, token-like values, query strings, and reduce retained coordinates to three decimal places. Sentry events and breadcrumbs are scrubbed. PostHog identification uses the Supabase user UUID plus coarse traits only.
- Location permission is preceded by an in-app disclosure and can be skipped in favor of manual area selection.

### Authentication

- Client-side password validation requires a minimum of 12 characters with uppercase, lowercase, digit, and special-character checks.
- Supabase leaked-password protection is required before public launch and tracked as `SEC-01`; enable it in the dashboard or via the guarded Management API helper once a supporting plan and auth-config PAT are available.
- Biometric re-authentication for destructive actions is not currently implemented and remains a pre-launch hardening item.

## Secret Handling

- Tracked `.env.*` template files must contain only public placeholders or blank secret keys. Real server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `MAPBOX_SECRET_TOKEN`, `SENTRY_AUTH_TOKEN`, `EXPO_TOKEN`, `SUPABASE_DB_PASSWORD`) live only in EAS Secrets and untracked local `.env.local`.
- A `gitleaks` pre-commit hook and CI security workflow gate pushes that would introduce a leak.
- Mobile CI uses least-privilege workflow permissions, SHA-pinned GitHub Actions, root `npm audit --audit-level=moderate`, gitleaks, trufflehog, and release secrets scoped only to EAS steps. Local `npm run security:trufflehog` requires the TruffleHog CLI on `PATH`; install it with `brew install trufflehog` or rely on the pinned CI action until local tooling is available.
- 2026-04-29 incident note: `.env.local` had been tracked with live values. It has been removed from current git tracking, and all exposed credentials must be rotated outside the repo. Full-history `gitleaks detect --redact --source .` still reports historical redacted findings until history is rewritten or accepted.
- Rotate credentials immediately if a leak is suspected: service role key, Mapbox secret, Sentry auth token, Expo token, and Apple ASC API key are all rotated under a documented schedule.
- Public tokens (Supabase anon key, Mapbox public token, PostHog public key, Sentry DSN) are restricted per-platform: Mapbox by bundle identifier and URL, Supabase anon by RLS coverage.

## Incident Response

1. **Detect** via Sentry alert, Supabase log signal, or inbound vulnerability report.
2. **Contain**: disable the affected Edge Function kill switch, rotate anon key if leak is suspected, rotate the service role key immediately on any server-side compromise.
3. **Eradicate**: deploy the fix, apply any new migrations, push a signed OTA update via Expo Updates when enabled.
4. **Recover**: re-enable traffic, validate from an external clean device, monitor error rates for 24 hours.
5. **Learn**: complete a blameless post-mortem within 72 hours. Update `tasks/lessons.md` and this policy with preventative controls.
6. **Notify**: if PII exposure is confirmed, notify affected users and file a PDPC breach notification per Singapore PDPA; notify EU residents per GDPR Article 33/34 where applicable.

## Owner Responsibilities Before Public Launch

- Provision `security@hungry.sg` and `privacy@hungry.sg` and list them in the privacy policy and app store listings.
- Publish `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` for Universal / App Links before enabling any deep-link authentication callbacks.
- Complete the OWASP MASVS L1 audit rehearsal with the evidence pack under `docs/security/audit-evidence/`.
- Confirm App Store Review and Google Play Data Safety pass on a pre-submission staging build.
- Enable branch protection with required security workflow on `main`, including `npm audit`, `gitleaks`, and `trufflehog` gates.

## Supabase Advisor Findings (2026-05-27)

Linked Supabase Advisor state after `20260527144633` and `20260527145534`:

- Security Advisor: one remaining warning, `auth_leaked_password_protection`.
- Performance Advisor: no issues.
- PostGIS: `postgis` is installed in `extensions`, `extrelocatable = false`.
- `spatial_ref_sys`: table is now in `extensions`, owned by `supabase_admin`, with no exposed-`public` RLS finding.

- `RLS Disabled in Public` on `public.spatial_ref_sys`
  - Status: Resolved by Supabase owner/support relocation.
  - Evidence: linked object-state query shows `spatial_ref_sys` in `extensions`, not `public`.

- `Extension in Public` for `postgis`
  - Status: Resolved by Supabase owner/support relocation.
  - Evidence: linked extension-state query shows `postgis` in `extensions`.

- `Security Definer Function Executable` on PostGIS `st_estimatedextent(...)`
  - Status: Resolved after PostGIS relocation/update.
  - Evidence: linked Security Advisor no longer reports PostGIS function warnings.

- `Security Definer Function Executable` on app-owned authenticated RPC/helper functions
  - Status: Resolved in linked staging.
  - Rationale: `20260522142004_advisor_private_rpc_wrappers.sql` and `20260527144633_advisor_security_cleanup_public_rpc_wrappers.sql` move app-owned SECURITY DEFINER bodies into non-exposed `app_private` and preserve public RPC names as SECURITY INVOKER wrappers.
  - Verification: app-owned findings are classified cleanly by `npm run audit:supabase:advisor-security`.

- `Security Definer Function Executable` on linked legacy payment/order RPCs
  - Status: External blocker.
  - Rationale: linked Supabase still exposes legacy `release_reserved_order(...)` and `submit_payment_proof(...)` SECURITY DEFINER RPCs to `anon` / `authenticated`; these functions are outside the Hungry MVP repo source.
  - Remediation: after owner approval, run `supabase/manual/legacy_payment_order_rpc_advisor_cleanup.sql` from a linked Supabase SQL session, then rerun `npm run audit:supabase:advisor-security:non-password`.

- Performance Advisor policy warnings
  - Status: Resolved in linked staging.
  - Rationale: `20260527145534_advisor_performance_policy_cleanup.sql` optimizes auth/current-setting policy calls and splits or merges overlapping permissive policies.
  - Verification: linked Performance Advisor reports `No issues found`.

Accepted external/Auth-console warning:

- `Leaked Password Protection Disabled` (Auth)
  - Status: Accepted by project owner on 2026-05-27 as an ignored Supabase Auth warning for the current Advisor cleanup pass.
  - Optional hardening: Enable leaked password protection under Authentication password security settings, or run `npm run security:supabase:enable-leaked-password` with a `SUPABASE_ACCESS_TOKEN` that has auth config write access.
  - Gate: This warning is excluded from the current non-password Security Advisor hard gate; do not treat it as an app-owned schema/RLS blocker.
