# Security Audit Report — Hungry Mobile

Date: 2026-05-15
Scope: mobile app, Supabase backend, and mobile-root CI only. Web app and non-mobile package surfaces are excluded.

## Summary

- Status: mobile security remediation applied for secret containment, Supabase OCR authorization, ops/admin authorization, storage policies, auth-token storage fallback, analytics privacy scrubbing, allowlisted external links, root CI/security gates, Merchant Centre RLS hardening, and merchant verification evidence hardening.
- Current policy alignment: `SECURITY.md` now reflects implemented controls instead of claiming unimplemented certificate pinning or dashboard-only settings.
- Required owner action remains: rotate exposed credentials. Supabase leaked-password protection (`SEC-01`) is blocked until a paid Supabase plan is available.

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

10. High — merchant review update policy allowed over-broad row mutation
- Evidence: `supabase/migrations/0019_merchant_consumer_linkage.sql` added a merchant RLS path to update linked `reviews` rows for replies. Without a database column guard, a malicious merchant client could attempt to mutate review content fields on rows they can manage.
- Remediation applied: added `supabase/migrations/0020_merchant_rls_hardening.sql` with `trg_enforce_merchant_review_reply_update`, limiting merchant updates to `merchant_reply_text` and `merchant_replied_at`.
- Follow-up hardening: added `supabase/migrations/0021_review_author_update_guard.sql` so review authors cannot spoof merchant reply fields or move reviews across identity/linkage fields.
- Evidence files: `supabase/migrations/0020_merchant_rls_hardening.sql`, `supabase/migrations/0021_review_author_update_guard.sql`, `supabase/smoke/merchant_rls_policies.sql`, `src/lib/services/supabase/merchant-linkage.test.ts`.

11. Medium — merchant settings and report policies were too broad
- Evidence: `merchant_notification_preferences` initially used a broad member `for all` policy, and `customer_interaction_reports` allowed any authenticated insert.
- Remediation applied: split notification preference policies into member read and owner/manager write/delete policies; restricted customer interaction reports to the caller's merchant-managed review venue.
- Evidence files: `supabase/migrations/0020_merchant_rls_hardening.sql`, `supabase/smoke/merchant_rls_policies.sql`, `src/lib/security/security-hardening.test.ts`.

12. High — merchant venue/dish policies were row-scoped but not column-guarded
- Evidence: `supabase/migrations/0019_merchant_consumer_linkage.sql` allowed linked merchant owners/managers to update `venues` and perform all writes on `dishes`. Row ownership was checked, but a malicious client could attempt to alter trust or aggregate fields such as `hygiene_grade`, `top_dish_id`, `live_crowd`, `rating_avg`, or `review_count`.
- Remediation applied: added `supabase/migrations/0022_merchant_catalog_column_guards.sql` with database triggers that limit venue updates to merchant profile fields, limit dish updates to merchant menu fields, prevent aggregate/live-field writes, and require dish inserts to match a managed merchant outlet.
- Evidence files: `supabase/migrations/0022_merchant_catalog_column_guards.sql`, `supabase/smoke/merchant_rls_policies.sql`, `src/lib/services/supabase/merchant-linkage.test.ts`.

13. Critical — ops draft review function used static-key authorization
- Evidence: `ops-dishes-draft` previously used service-role operations behind `x-ops-api-key` and wildcard CORS.
- Remediation applied: replaced static-key authorization with Supabase JWT validation, `app_ops_admins` allowlist, allowlisted origins, DB-backed rate limiting, and audit events.
- Evidence files: `supabase/functions/ops-dishes-draft/index.ts`, `supabase/migrations/0038_app_security_hardening.sql`, `src/lib/security/security-hardening.test.ts`.

14. High — merchant verification evidence metadata could be forged
- Evidence: merchants could submit arbitrary `file_url` evidence metadata.
- Remediation applied: added a private `merchant-verification-evidence` bucket, storage-path metadata columns, caller-owned storage prefix checks, `uploaded_by = auth.uid()` enforcement, and service upload through signed storage.
- Evidence files: `supabase/migrations/0038_app_security_hardening.sql`, `src/lib/services/supabase/supabaseService.ts`, `src/lib/security/security-hardening.test.ts`.

15. High — external UGC media URL bypass remained in posts and merchant media
- Evidence: post media and merchant gallery paths could store external URLs without upload validation.
- Remediation applied: review photos, post media, merchant dish images, avatars, and verification evidence now reject non-local user media and require signed upload validation.
- Evidence files: `src/lib/services/supabase/supabaseService.ts`, `src/lib/services/supabase/mediaUpload.ts`, `src/lib/services/supabase/post-integration.test.ts`.

16. Medium — OAuth callback parsing trusted arbitrary callback URLs
- Evidence: OAuth callbacks were parsed for tokens/codes without validating the returned URL against the requested redirect.
- Remediation applied: OAuth now validates callback scheme/host/path, checks provider state when present, rejects implicit token fragments, and uses code exchange.
- Evidence files: `src/lib/services/supabase/supabaseService.ts`, `src/lib/security/security-hardening.test.ts`.

17. Medium — CI release secrets were exposed job-wide and Actions were mutable
- Evidence: release secrets were job-level in `ci.yml`, and `actions/checkout@v4` / `actions/setup-node@v4` were mutable tag references.
- Remediation applied: CI now has least-privilege `permissions`, SHA-pinned Actions, step-scoped release secrets, exact EAS CLI version invocation, and source tests for CI posture.
- Evidence files: `.github/workflows/ci.yml`, `package.json`, `src/lib/security/ci-supply-chain.test.ts`.

18. Medium — service-role helper scripts read `.env.local` directly
- Evidence: root helper scripts read `.env.local` and used/decode service-role keys without explicit opt-in.
- Remediation applied: helpers now require `HUNGRY_ALLOW_SERVICE_ROLE_SMOKE=1` and `HUNGRY_SMOKE_SUPABASE_SERVICE_ROLE_KEY`, and no longer read `.env.local`.
- Evidence files: `test_service_role.ts`, `test_trigger.ts`, `test_jwt.js`, `src/lib/security/ci-supply-chain.test.ts`.

## Live Deployment Evidence

- 2026-05-16: restored local migration history through remote-applied `0028`-`0037` and renumbered the app security migration to `0038_app_security_hardening.sql`.
- 2026-05-16: `supabase db push --dry-run` passed and reported only `0038_app_security_hardening.sql` pending.
- 2026-05-16: `supabase db push` applied `0038_app_security_hardening.sql` to the linked project.
- 2026-05-16: `supabase migration list` confirmed local and remote are aligned through `0038`.
- 2026-05-16: deployed `ops-dishes-draft` and `ingest-menu-photo` Edge Functions.
- 2026-05-16: configured `OPS_DISHES_DRAFT_ALLOWED_ORIGINS` and `INGEST_MENU_PHOTO_ALLOWED_ORIGINS` as Edge Function secrets for `https://hungry.sg`.
- 2026-05-16: live bounded DB check confirmed `merchant-verification-evidence` storage bucket exists and is private.
- Remaining live setup: `app_ops_admins` currently has 0 enabled operators. Seed a specific Supabase auth user UUID before using the ops review function.

## Threat Model Snapshot

| Boundary | Main risk | Current control |
|---|---|---|
| Mobile app -> local storage | Token disclosure on device compromise | SecureStore-backed Supabase storage; production memory-only fallback |
| Mobile app -> external URLs | Phishing or unsafe native scheme launch | Trusted URL helpers for Hungry, delivery, and blog/article links |
| Mobile app -> Supabase Storage | Cross-user media writes | Signed uploads plus `<uid>/` storage policies |
| Edge Function -> Supabase service role | Service-role abuse | JWT validation, ownership/admin checks, idempotency/rate guards, audit logs |
| Merchant portal -> consumer catalog | Merchant tampering with trust, aggregate, or live fields | Venue/dish RLS plus catalog column-guard triggers |
| Merchant portal -> consumer reviews | Merchant or reviewer tampering with review content/reply fields | Venue-linked RLS plus reply-only database trigger |
| Merchant portal -> settings/reports | Staff privilege escalation or arbitrary report inserts | Owner/manager write policies and review-venue ownership checks |
| Analytics SDKs | PII/location overcollection | Shared Sentry/PostHog event and breadcrumb scrubbers |
| CI/supply chain | Vulnerable dependencies or leaked secrets | Root `npm audit`, gitleaks, trufflehog, SHA-pinned Actions, step-scoped release secrets |

## Verification Run

- `git ls-files .env.local`: pass; no current index entry for `.env.local`.
- `npm audit --audit-level=moderate`: pass; `found 0 vulnerabilities`.
- `npm run typecheck`: pass.
- `TMPDIR=/private/tmp HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/lib/security/security-hardening.test.ts src/lib/security/ci-supply-chain.test.ts src/lib/services/supabase/post-integration.test.ts`: pass; 23/23 focused security tests.
- `TMPDIR=/private/tmp npm run test`: pass; 252 tests, 250 pass, 2 skipped.
- `npm run lint`: pass with 0 errors and 14 pre-existing warnings outside this security patch.
- `npm_config_cache=/tmp/hungry-npm-cache npx expo-doctor`: pass; 17/17 checks.
- `brew install gitleaks libpq`: pass; local `gitleaks` and `psql` tooling installed.
- `gitleaks protect --staged --redact`: pass; no staged leaks found.
- `git diff --check`: pass.
- `gitleaks detect --redact --source .`: fail; 13 historical redacted findings remain in prior commits for `.env.local`, `ios/sentry.properties`, roadmap docs, and Figma concept README.
- `gitleaks detect --redact --source . --no-git`: fail; 50 local working-tree findings, mostly untracked/ignored `.env.local`, `.claude/worktrees`, web build cache, Pods signatures, and archived design/docs false positives. These are not clean-checkout CI-equivalent.
- `supabase db push --dry-run`: pass; only `0016_mobile_storage_security.sql` would apply.
- `supabase db push --yes`: pass; applied migration `0016` to the linked Supabase project.
- `psql -f supabase/smoke/mobile_storage_policies.sql`: pass; remote now has all four mobile buckets, 17 storage policies, and hardened `submit_menu_photo` prefix validation.
- `supabase db push --yes`: pass; applied Merchant Centre migrations through `0022_merchant_catalog_column_guards.sql` to the linked Supabase project.
- `supabase db query --linked`: pass; RLS enabled on 8 merchant tables, 24 merchant/linked policies visible, catalog/review guard triggers present, helper functions are security invoker. Local `psql` is installed but has no default DB connection in this shell.
- `TMPDIR=/private/tmp npx tsx --test src/lib/services/supabase/merchant-linkage.test.ts src/lib/security/security-hardening.test.ts`: pass; 10/10 targeted merchant security tests.

## Residual Risks / Follow-ups

1. Rotate exposed credentials outside the repo; code cannot perform provider rotation.
2. Enable Supabase leaked-password protection in the dashboard (`SEC-01`) after upgrading to a paid Supabase plan.
3. Certificate/SPKI pinning is not implemented; `SECURITY.md` now documents standard TLS/ATS only.
4. Historical gitleaks findings will continue failing full-history scans until credentials are rotated and history is rewritten or findings are explicitly accepted/ignored.
5. Run a manual signed-in merchant runtime smoke on simulator/device for verified and unverified merchant accounts before public store submission.
