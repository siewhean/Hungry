# Security Audit Report — Hungry Mobile

Date: 2026-04-29
Scope: mobile app, Supabase backend, and mobile-root CI only. Web app and non-mobile package surfaces are excluded.

## Summary

- Status: mobile security remediation applied for secret containment, Supabase OCR authorization, storage policies, auth-token storage fallback, analytics privacy scrubbing, allowlisted external links, and root CI/security gates.
- Current policy alignment: `SECURITY.md` now reflects implemented controls instead of claiming unimplemented certificate pinning or dashboard-only settings.
- Required owner action remains: rotate exposed credentials and enable Supabase leaked-password protection (`SEC-01`).

## Findings & Remediation

1. Critical — tracked `.env.local` contained live secrets
- Evidence: `.env.local` was tracked and contained server-side secret names including `SENTRY_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_PASSWORD`.
- Remediation applied: staged removal of `.env.local` from git tracking with `git rm --cached .env.local`; `.gitignore` already ignores local env files. The removal is durable only after commit.
- Required owner action: rotate exposed credentials immediately. No destructive git history rewrite was performed.

2. High — `ingest-menu-photo` used service role without caller ownership proof
- Evidence: `supabase/functions/ingest-menu-photo/index.ts` previously accepted `submissionId` and performed service-role reads/writes without JWT ownership validation.
- Remediation applied: added JWT validation through Supabase anon client, submission `submitted_by` ownership check, allowlisted CORS handling, retry limit, and idempotent `pending`/`failed` state gate.
- Evidence files: `supabase/functions/ingest-menu-photo/index.ts`, `supabase/config.toml`, `src/lib/security/security-hardening.test.ts`.

3. Medium — mobile storage bucket policies did not cover all app upload buckets
- Evidence: app used `menu-photos`, `review-media`, `avatars`, and `bites-media`, while migrations only provisioned `menu-photos`.
- Remediation applied: added `supabase/migrations/0016_mobile_storage_security.sql` to provision all mobile buckets, enforce authenticated `<uid>/` write policies, add service-role select policy, and harden `submit_menu_photo` path-prefix validation.
- Evidence files: `supabase/migrations/0016_mobile_storage_security.sql`, `supabase/smoke/mobile_storage_policies.sql`.

4. Medium — Supabase auth tokens could fall back to plaintext AsyncStorage
- Evidence: `authStorage.ts` previously degraded to AsyncStorage when SecureStore failed.
- Remediation applied: production now uses memory-only fallback on SecureStore failure; plaintext fallback is limited to `__DEV__` or `HUNGRY_ALLOW_INSECURE_AUTH_STORAGE=1`.
- Evidence files: `src/lib/services/supabase/authStorage.ts`, `src/lib/security/security-hardening.test.ts`.

5. Medium — analytics privacy scrubber claims exceeded implementation
- Evidence: Sentry only removed email/username, and PostHog forwarded unsanitized properties.
- Remediation applied: added shared analytics scrubber for Sentry/PostHog that redacts email, phone, token-like keys, query strings, and rounds coordinates to three decimals.
- Evidence files: `src/lib/analytics/privacy.ts`, `src/lib/analytics/posthogSink.ts`, `App.tsx`, `src/store/useSessionStore.ts`.

6. Medium — signed-upload guarantee had a direct upload fallback
- Evidence: `mediaUpload.ts` fell back from `createSignedUploadUrl` to direct SDK `upload`.
- Remediation applied: removed production direct-upload fallback and added shared blob size/MIME validation for image uploads.
- Evidence files: `src/lib/services/supabase/mediaUpload.ts`, `src/lib/security/security-hardening.test.ts`.

7. Low — external-link allowlist was incomplete
- Evidence: delivery links and article links still opened raw URLs.
- Remediation applied: added allowlisted delivery/blog helpers and routed delivery/article opens through them.
- Evidence files: `src/lib/security/safeLinking.ts`, `src/components/dish/DeliveryPlatformButton.tsx`, `src/app/screens/reads/BlogPostWebViewScreen.tsx`.

8. Medium — mobile-root security gate failed dependency audit
- Evidence: root `npm audit --audit-level=moderate` reported 13 moderate+ advisories before remediation.
- Remediation applied: added root overrides for `postcss`, `@xmldom/xmldom`, and `uuid`; regenerated the root lockfile. `@expo/ngrok` remains as dev tooling but is covered by the root `uuid` override.
- Evidence files: `package.json`, `package-lock.json`.

9. Medium — local and CI secrets gates were incomplete
- Evidence: pre-commit hook only ran lint-staged; CI actions used mutable tags/branches.
- Remediation applied: added `gitleaks protect --staged --redact`, SHA-pinned third-party Actions, and least-privilege `contents: read` permissions.
- Evidence files: `.husky/pre-commit`, `.github/workflows/security.yml`.

## Threat Model Snapshot

| Boundary | Main risk | Current control |
|---|---|---|
| Mobile app -> local storage | Token disclosure on device compromise | SecureStore-backed Supabase storage; production memory-only fallback |
| Mobile app -> external URLs | Phishing or unsafe native scheme launch | Trusted URL helpers for Hungry, delivery, and blog/article links |
| Mobile app -> Supabase Storage | Cross-user media writes | Signed uploads plus `<uid>/` storage policies |
| Edge Function -> Supabase service role | Service-role abuse | JWT validation, ownership check, idempotency/rate guard |
| Analytics SDKs | PII/location overcollection | Shared Sentry/PostHog scrubber |
| CI/supply chain | Vulnerable dependencies or leaked secrets | Root `npm audit`, gitleaks, trufflehog, SHA-pinned Actions |

## Verification Run

- `git ls-files .env.local`: pass; no current index entry for `.env.local`. `HEAD` still contains the prior file until the staged deletion is committed.
- `npm audit --audit-level=moderate`: pass; `found 0 vulnerabilities`.
- `npm run typecheck`: pass.
- `npm run test`: pass; 97 tests, 95 pass, 2 skipped.
- `npm_config_cache=/tmp/hungry-npm-cache npx expo-doctor`: pass; 17/17 checks.
- `gitleaks detect --redact --source .`: blocked locally because the `gitleaks` binary is not installed. Pre-commit and CI configuration were added.

## Residual Risks / Follow-ups

1. Rotate exposed credentials outside the repo; code cannot perform provider rotation.
2. Enable Supabase leaked-password protection in the dashboard (`SEC-01`).
3. Remove iOS local-network development config from production native builds before public launch.
4. Certificate/SPKI pinning is not implemented; `SECURITY.md` now documents standard TLS/ATS only.
5. Live Supabase smoke checks require a linked DB and `SUPABASE_DB_URL`.
