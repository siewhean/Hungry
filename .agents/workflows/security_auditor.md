---
description: Security auditor — audit auth, RLS, storage, navigation, secrets, privacy, and abuse controls
---

# Security Auditor Agent

Audit Hungry’s mobile app, Supabase boundary, website, native configuration, CI/release setup, and data handling. Use OWASP MASVS-style categories and the repository’s security contracts. Do not treat client checks as substitutes for server/RLS enforcement.

## Mandatory product boundary

- No guest mode.
- Main app routes require successful authentication.
- Supabase is mandatory for authentication and every shared write.
- Excel is an authenticated, read-only catalog fallback for classified catalog outages only.
- Missing configuration, failed authentication, signed-out state, invalid/revoked sessions, and legitimate no-results must not invoke Excel fallback.

## Scope

- `src/app/navigation/`, auth/onboarding screens, `useAppBootstrap.ts`, `useSessionStore.ts`
- `src/lib/services/`, storage/media, analytics, deep/external links
- `supabase/migrations/`, functions, smoke SQL, RLS and grants
- `app.config.js`, native manifests/plists, `eas.json`
- website/server routes and CI/release workflows
- dependencies, secrets, logging, privacy and abuse controls

## Checklist

### 1. Session and credential handling

- Supabase access/refresh tokens use the SecureStore-backed adapter, not plaintext AsyncStorage.
- Persisted app metadata cannot establish authentication without a valid Supabase session.
- Sign-out and invalid/revoked sessions clear account-scoped state and fallback access.
- Tokens, passwords, OTPs, reset codes, service-role keys, and sensitive user data are not logged.
- Client bundles contain only values intended to be public.

### 2. Navigation and authorization

- Signed-out users can mount only Splash, Onboarding, and Auth.
- Deep links and return routes cannot bypass authentication, feature flags, merchant roles, or admin roles.
- Disabled developer/prototype/social/merchant routes are not registered or reachable in production.
- UI guards are backed by service authorization and RLS.

### 3. Supabase database and RLS

For every table/view/function/bucket:

- identify owner, public/authenticated read rules, write rules, service-role use, and sensitive columns;
- verify RLS is enabled where applicable;
- verify users cannot read/write another user’s private data;
- verify merchants cannot mutate another outlet;
- verify admin/ops capabilities are narrowly granted and audited;
- review SECURITY DEFINER functions, search path, execute grants, rate limits, and input validation;
- run Security Advisor and matching live smoke in staging.

### 4. Catalog fallback and source boundaries

- Catalog errors distinguish authentication, invalid session, configuration, network, timeout, RPC, unavailable release, and successful empty results.
- Only eligible availability failures may invoke Excel, and only with a valid authenticated session.
- Excel adapter has no write API.
- Supabase write failures never become local/mock/Excel success.
- Released builds cannot select mock or full Excel providers.

### 5. Input, output, and media safety

- Database queries are parameterized; do not rely on stripping SQL-like text client-side.
- Route IDs, URLs, query limits, text lengths, enums, and structured payloads are validated at the trust boundary.
- External/deep links use allowlists and safe schemes.
- Uploaded media validates MIME, extension, size, duration/dimensions where relevant, storage path ownership, and moderation state.
- HTML/Markdown/web content is escaped or sanitized before rendering.

### 6. Privacy and telemetry

- Analytics and crash events scrub tokens, emails, precise coordinates, message bodies, and unintended PII.
- Location, photos, camera, notifications, and identifiers are collected only for disclosed purposes.
- Privacy, retention, deletion, export/access, and incident-response behavior matches the published policy.
- Sensitive notification and app-switcher/screenshot exposure is reviewed.

### 7. Abuse and UGC

If reviews, posts, profiles, comments, stories, chat, or merchant content are public:

- report, block, delete-own-content, moderation status, hidden-content filtering, and support contact exist;
- write and report endpoints are rate-limited;
- moderation/admin actions are authorized and audited;
- disabled/unmoderated surfaces remain off in production.

### 8. Dependencies, CI, and release

Run repository-defined checks, including:

```bash
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
npm run audit:supabase:static
npm run check:edge-functions
```

Review lockfiles, workflow permissions, untrusted PR secret exposure, artifact provenance, EAS/Vercel/GitHub environment separation, source-map handling, signing, and rollback access.

## Execution

1. Build a trust-boundary and data-flow map.
2. Search source and history for secrets and sensitive logging.
3. Run focused contracts and static scans.
4. Run RLS/storage/function smoke in approved staging with least-privilege test users.
5. Verify auth, role, fallback, upload, and abuse scenarios at runtime.
6. Record each finding with source/sink, exploit conditions, impact, severity, remediation, and evidence.
7. Write current findings to the task-specific security audit and exact proof to `tasks/verification.md`; do not create a new root `security_report.md`.

## Pass criteria

- No P0/P1 auth bypass, private-data exposure, cross-tenant mutation, secret exposure, unsafe upload, or false write success.
- Security scans and staging RLS/storage/function tests pass or have explicit accepted risk.
- Client, database, storage, function, and release boundaries agree.
- Skipped, credential-blocked, and manual checks are recorded as incomplete, not passed.
