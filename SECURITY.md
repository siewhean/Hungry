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
- Supabase authentication tokens are persisted via a SecureStore-backed adapter wired into `createClient`. They are chunked to respect Keychain / Keystore size limits and are never written to plain AsyncStorage.
- Cart, discovery, profile, and UI preferences use a non-secure AsyncStorage adapter; no credentials, tokens, or PII should be placed in these stores.

### Networking
- iOS App Transport Security is enabled with `NSAllowsArbitraryLoads=false`. `NSAllowsLocalNetworking` is only enabled in development builds.
- Android network security config disables cleartext traffic and pins SPKI hashes for Supabase, Mapbox, PostHog, and Sentry hosts.
- Public-key pinning is enforced on production builds for the same hosts via a pinning layer; pin failures surface a network integrity error and log to Sentry.

### Backend
- Every Supabase table has Row-Level Security enabled. Catalog content is `public_select`; all user-scoped rows require `auth.uid() = user_id` for reads and writes.
- Storage bucket policies gate writes by authenticated user UUID prefix. Signed upload URLs expire within five minutes and cannot be reused.
- Edge Functions use an allowlisted CORS origin set, per-device rate limiting, and SHA-256 token hashing for guest sessions.

### Privacy
- `ios/Hungry/PrivacyInfo.xcprivacy` enumerates every collected data type with linkage and non-tracking declarations.
- Google Play Data Safety mirrors the iOS declaration.
- Sentry and PostHog ship with `beforeSend` scrubbers that strip email, phone numbers, query strings, and reduce coordinates to three decimal places. PostHog never receives raw email addresses; identification uses the Supabase user UUID.

### Authentication
- Passwords require a minimum of 12 characters with character-class heuristics and a Have I Been Pwned k-anonymity breach check on sign-up and password reset.
- Supabase auth rate limits are enforced at the IP and email layer with exponential backoff.
- Biometric re-authentication gates destructive actions (account deletion, email or password change, device revocation).

## Secret Handling

- `.env.*` files in the repository only ever contain `EXPO_PUBLIC_*` values and placeholder comments. Real server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `MAPBOX_SECRET_TOKEN`, `SENTRY_AUTH_TOKEN`, `EXPO_TOKEN`) live only in EAS Secrets and local `.env.local` (gitignored).
- A `gitleaks` pre-commit hook and a CI security workflow gate pushes that would introduce a leak.
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

## Supabase Advisor Accepted Findings (2026-04-22)

The following Supabase Security Advisor items are currently accepted with documented rationale:

- `RLS Disabled in Public` on `public.spatial_ref_sys`
  - Status: Accepted exception.
  - Rationale: `spatial_ref_sys` is extension-owned by PostGIS and cannot be altered by project migration roles (`must be owner of table spatial_ref_sys`).
  - Mitigation: No app-owned user data is stored in this table. Core app tables enforce RLS and explicit policies.

- `Extension in Public` for `postgis`, `vector`, `pg_trgm`, `btree_gist`, `citext`
  - Status: Accepted warning.
  - Rationale: Current schema intentionally uses these extensions from `public` for compatibility with existing migrations and production queries.
  - Mitigation: Review extension schema migration in a dedicated hardening window only (high-risk change, not in active sprint scope).

Non-accepted (must fix):

- `Leaked Password Protection Disabled` (Auth)
  - Status: Action required in Supabase dashboard.
  - Required action: Enable leaked password protection under Authentication password security settings.
