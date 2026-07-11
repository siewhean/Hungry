# Hungry App Security Review Findings

_Last updated: 2026-05-15_

This document summarizes the security review findings and recommendations for the Hungry app repository. It is based on a static review of the repository, including Supabase migrations, Edge Functions, React Native app code, authentication/session storage, storage policies, and security-related documentation.

This is not a full penetration test. The live Supabase dashboard, deployed Edge Function settings, production secrets, authentication-provider settings, and runtime infrastructure were not verified in this review.

## Executive summary

The app already has a solid security foundation:

- Supabase authentication is used.
- Auth session persistence is backed by `expo-secure-store` instead of default plaintext AsyncStorage.
- Many database tables have row-level security enabled.
- User-owned tables generally use `auth.uid()` checks.
- Merchant/review permissions have been hardened with RLS and triggers.
- Storage buckets have MIME and size limits.
- Account deletion, content reports, and user blocks exist.

The highest-risk areas reviewed in this pass were:

1. Ops/admin Edge Function access. Repo remediation added JWT auth, ops-admin allowlist, CORS allowlist, rate limiting, and audit logging.
2. Merchant verification status controls. Repo remediation added admin-only decision guards and private evidence metadata guards.
3. Public/followed profile privacy. Repo remediation restricts `user_profiles` direct reads to owners and exposes a safe `public_profiles` view.
4. Media upload validation and external media URL handling. Repo remediation rejects non-local UGC media and validates magic bytes before signed upload.
5. Analytics privacy. Repo remediation routes analytics, PostHog, and Sentry payloads through central scrubbers.
6. Secret hygiene and service-role tooling. Repo remediation scopes CI secrets, pins workflow Actions, and guards service-role smoke scripts.

Remaining release blockers are deployment/evidence tasks: apply the new Supabase migration, redeploy Edge Functions, rotate any previously exposed credentials, run linked Supabase smoke tests, and complete dashboard/store-console checks that cannot be proven from this repository alone.

## Severity key

| Severity | Meaning |
|---|---|
| Critical | Could lead to admin/service-role abuse, account compromise, or major data exposure. Fix before launch. |
| High | Significant privacy/security risk. Should be fixed before production release. |
| Medium | Important hardening or abuse-prevention work. Should be scheduled before public scale. |
| Low | Hygiene, maintainability, or defense-in-depth improvement. |

---

# Findings and recommendations

## 1. Critical: Ops Edge Function used service role, static API key, and wildcard CORS

Status: remediated in repo on 2026-05-15 by `supabase/functions/ops-dishes-draft/index.ts` and `supabase/migrations/0038_app_security_hardening.sql`; applied to linked Supabase and redeployed on 2026-05-16. `app_ops_admins` still needs an explicit operator UUID before ops access can be used.

### Evidence

Reviewed file:

```text
supabase/functions/ops-dishes-draft/index.ts
```

The previous function used service-role access behind static `x-ops-api-key` authorization and wildcard CORS. The current repo version requires a Supabase bearer token, checks `app_ops_admins`, uses `OPS_DISHES_DRAFT_ALLOWED_ORIGINS`, calls `app_can_make_ops_request`, and writes `app_ops_audit_events`.

### Risk

If the ops API key leaks, an attacker may be able to invoke a privileged service-role function. Wildcard CORS makes this easier to call from arbitrary origins. Service-role functions bypass normal RLS controls, so they must be treated as admin-grade surfaces.

### Recommendation

Keep the repo controls and complete the remaining live authorization verification:

- `0038_app_security_hardening.sql` applied on 2026-05-16.
- `ops-dishes-draft` redeployed on 2026-05-16.
- `OPS_DISHES_DRAFT_ALLOWED_ORIGINS` configured on 2026-05-16.
- Populate `app_ops_admins` with explicit operators.
- Confirm normal users and merchants receive 401/403.

### Suggested acceptance criteria

- A normal authenticated user cannot call the function.
- A merchant cannot call the function.
- An unauthenticated request cannot call the function.
- A request from an untrusted Origin is rejected.
- Every successful action writes an immutable audit event.

---

## 2. Critical/High: Merchants could self-verify

Status: remediated in repo on 2026-05-15 by `enforce_merchant_verification_decision_guard`; requires migration apply before production.

### Evidence

Reviewed file:

```text
supabase/migrations/0018_merchant_centre_verification_schema.sql
```

The merchant verification schema allows merchant owners/managers to write to `merchant_verifications`. The table includes fields such as:

- `status`
- `verified_at`
- `rejected_at`
- `rejection_reason`
- `expires_at`

The reviewed migrations did not clearly show a guard preventing merchants from setting their own verification status to `verified`.

### Risk

A merchant may be able to bypass the verification process and mark themselves verified if they can update those fields directly.

### Recommendation

Split merchant-submitted fields from admin decision fields.

Merchants should be able to:

- Create draft verification submissions.
- Upload evidence.
- Submit verification for review.

Only admin/service-role code should be able to:

- Set `status = 'verified'`.
- Set `verified_at`.
- Set `rejected_at`.
- Set `rejection_reason`.
- Set `expires_at`.

Add a database trigger that blocks non-admin users from updating admin-only verification fields.

Example rule:

```sql
if auth.uid() is not null and new.status = 'verified' then
  raise exception 'only admin may verify merchant accounts';
end if;
```

### Suggested acceptance criteria

- Merchant cannot set their own verification to `verified` through the client, direct API, or SQL with anon/authenticated role.
- Merchant can submit verification evidence only for their own account.
- Admin/service-role can approve/reject and every decision is audited.

---

## 3. High: Public/followed profile access may expose sensitive fields

### Evidence

Reviewed files:

```text
supabase/migrations/0002_core_schema.sql
supabase/migrations/0023_integration_posts_privacy_chat.sql
```

The `user_profiles` table contains sensitive or semi-sensitive fields such as:

- `email`
- `dietary_preferences`
- `favourite_dish_ids`
- `reviewed_dish_ids`
- `taste_profile`
- taste-vector fields

Later privacy policies allow public/followed access to profile rows via `profile_select_public_or_followed`.

### Risk

RLS controls row access, not column-level exposure. If a public/followed user can read a `user_profiles` row, they may be able to read all columns in that row, including private fields.

### Recommendation

Keep `user_profiles` private and owner-only. Create a separate safe public view.

Recommended model:

```text
user_profiles_private
- id
- email
- dietary_preferences
- taste_profile
- taste vectors
- favourite_dish_ids
- reviewed_dish_ids

public_profiles view/table
- id
- display_name
- avatar_url
- public bio
- public badges
- follower/following counts if intended
```

Use the public profile view for social/profile display. Never expose email, taste vectors, or dietary preferences in public/followed reads unless the user explicitly opted in.

### Suggested acceptance criteria

- User A cannot read User B email.
- User A cannot read User B taste vector.
- User A cannot read User B dietary preferences unless explicitly made public.
- Public profile responses contain only approved public fields.

---

## 4. High: Media upload validation is incomplete

### Evidence

Reviewed file:

```text
src/lib/services/supabase/mediaUpload.ts
```

The upload code checks file size and allowed MIME types, then uploads using Supabase signed upload URLs. This is a good start, but it relies heavily on `blob.type` or guessed content type from the URI.

Missing hardening includes:

- Magic-byte validation.
- Image re-encoding.
- EXIF stripping.
- GPS metadata removal.
- Image dimension limits.
- Malware scanning.
- Video duration/resolution limits.
- Server-side thumbnail generation.

### Risk

Attackers can spoof MIME types, upload oversized or malformed media, preserve sensitive GPS metadata, or attempt parser-based attacks through crafted files.

### Recommendation

Move upload validation to a backend-controlled processing pipeline.

For images:

- Verify magic bytes.
- Reject SVG unless heavily sanitized.
- Enforce max dimensions.
- Strip EXIF metadata.
- Re-encode to safe formats such as JPEG/WebP.
- Store random server-generated filenames.

For videos:

- Enforce duration and resolution limits.
- Transcode where possible.
- Generate thumbnails server-side.
- Scan files where possible.

Also change signed upload behavior from `upsert: true` to `upsert: false` unless overwriting is explicitly required.

### Suggested acceptance criteria

- A fake `.jpg` containing non-image bytes is rejected.
- EXIF GPS metadata is removed before public serving.
- Oversized dimensions are rejected even if file size is under the byte limit.
- Users cannot overwrite existing objects belonging to previous uploads.

---

## 5. High/Medium: Arbitrary external media URLs could bypass upload controls

Status: remediated in repo on 2026-05-15 for review photos, post media, merchant dish gallery images, avatars, and merchant verification evidence uploads. Normal client media now must be local device media and pass MIME, size, and magic-byte validation before signed upload.

### Evidence

Reviewed file:

```text
src/lib/services/supabase/supabaseService.ts
```

Previous service code accepted non-local URLs as media and stored them directly rather than uploading them through the controlled media pipeline. Current repo code rejects those inputs in the Supabase service layer.

### Risk

External media URLs can bypass file validation, malware checks, content-type restrictions, EXIF handling, and storage policies. They may also enable tracking pixels, malicious hosts, broken content, or phishing-like media.

### Recommendation

Do not reintroduce arbitrary external media URLs from normal users.

Use one of these models:

1. Require all user media to be uploaded from local files and processed through your storage pipeline.
2. For admin/import tools, allowlist trusted external domains and proxy them through a backend scanner before storing.

### Suggested acceptance criteria

- Normal users cannot submit arbitrary external media URLs.
- Admin/import media URLs are allowlisted and fetched/scanned server-side.
- User-generated media always ends up in controlled storage.

---

## 6. Medium/High: Public storage buckets need a privacy review

### Evidence

Reviewed files:

```text
supabase/migrations/0016_mobile_storage_security.sql
supabase/migrations/0023_integration_posts_privacy_chat.sql
supabase/migrations/0025_post_media_visible_storage_policy.sql
```

Several storage buckets are public, including examples such as:

- `review-media`
- `avatars`
- `bites-media`
- `merchant-dish-images`
- `merchant-stall-images`

The `post-media` bucket is private and has a later policy allowing authenticated users to read objects only when the associated post is visible.

### Risk

Public buckets are difficult to reconcile with private accounts, deleted posts, followers-only content, and account deletion expectations. Once a public URL is shared, it may remain accessible or cached.

### Recommendation

Use private-by-default storage for user-generated content unless it is intentionally public catalog content.

Recommended policy:

| Bucket type | Recommended access |
|---|---|
| Merchant catalog/stall images | Public if intentionally public |
| Private/followers-only post media | Private + signed URL |
| Verification documents | Private only |
| Moderation evidence | Private only |
| Profile avatars | Private or public depending on profile visibility |
| Review media | Review depending on whether reviews/profiles can be private |

### Suggested acceptance criteria

- Private/followers-only media is not publicly accessible by URL.
- Deleted media is removed or made inaccessible.
- Verification evidence is never public.

---

## 7. Medium: Merchant verification evidence storage is not clearly private enough

Status: remediated in repo on 2026-05-15 with private `merchant-verification-evidence` storage policies plus `enforce_merchant_verification_evidence_guard`; requires migration apply and production bucket verification.

### Evidence

Reviewed file:

```text
supabase/migrations/0018_merchant_centre_verification_schema.sql
```

`merchant_verification_evidence` stores `file_url`, `uploaded_by`, and review notes. A dedicated private storage path/policy was not clearly visible in the reviewed code.

### Risk

Verification evidence may contain sensitive business documents, license information, identity information, or location proof. Storing public URLs for this evidence can cause serious privacy exposure.

### Recommendation

Create a dedicated private bucket:

```text
merchant-verification-evidence
```

Use path-based ownership:

```text
merchant-verification-evidence/<merchant_account_id>/<verification_id>/<random_file_id>
```

Rules:

- Merchant owner/manager can upload/read only their own evidence while verification is active.
- Admin/service-role can read evidence for review.
- No public URLs.
- Store `storage_bucket` and `storage_path`, not `file_url`.

### Suggested acceptance criteria

- Public URL access to evidence fails.
- Merchant A cannot read Merchant B evidence.
- Admin review access is audited.

---

## 8. Medium: Broad `select("*")` queries increase accidental data exposure risk

### Evidence

Reviewed file:

```text
src/lib/services/supabase/supabaseRepository.ts
```

Some Supabase client code uses broad `select("*")` queries for public or feed-style data.

### Risk

If sensitive columns are later added to a table that is already readable by clients, the app may start receiving sensitive data unintentionally.

### Recommendation

Replace broad selects with explicit column lists or views.

Recommended approach:

- Use `public_*` views for app-facing reads.
- Use explicit DTO-style RPC responses for feeds/search.
- Avoid adding private columns to public tables.
- Treat `select("*")` as disallowed in app code except for controlled internal tooling.

### Suggested acceptance criteria

- Public app queries use explicit column lists.
- Sensitive fields are not returned to the client even if they exist in the base table.

---

## 9. Medium: Navigation auth guard is useful but not a security boundary

### Evidence

Reviewed file:

```text
src/app/navigation/RootNavigator.tsx
```

The app has an `AUTH_REQUIRED_ROUTES` set in `RootNavigator`. This is useful for UX. However, route guards are not security boundaries. `MerchantTabs` is guarded as authenticated, but not clearly guarded as verified-merchant-only at the navigation layer.

### Risk

A user may reach screens they should not see through deep links, state bugs, or future route changes. Real protection still needs to happen in RLS and backend logic.

### Recommendation

Add explicit frontend route guards for clarity while keeping database/backend enforcement as the real source of truth.

Recommended guard helpers:

```text
requireAuth()
requireMerchant()
requireVerifiedMerchant()
requireAdmin()
```

### Suggested acceptance criteria

- Unauthenticated users cannot open protected screens.
- Authenticated non-merchants cannot open merchant screens.
- Unverified merchants cannot access verified-only merchant portal functionality.
- Backend/RLS denies the same actions even if the UI guard is bypassed.

---

## 10. Medium: Analytics may collect sensitive taste/location data

Status: remediated in repo on 2026-05-15 for analytics buffering, PostHog capture/identify, and Sentry event/breadcrumb payloads. Runtime verification still requires inspecting real production analytics/Sentry project settings.

### Evidence

Reviewed file:

```text
src/store/useSessionStore.ts
```

The session store identifies PostHog users and sends properties such as taste vector, dietary preferences, and location-derived area.

### Risk

Dietary preferences, taste profile, and location-related data can become sensitive personal data. Sending too much data to analytics increases privacy and compliance risk.

### Recommendation

Minimize analytics data.

Recommended changes:

- Do not send raw taste vectors unless necessary.
- Do not send precise or semi-precise location to analytics.
- Use coarse regions only if needed.
- Add analytics consent controls.
- Document analytics usage clearly in the privacy policy.
- Disable analytics for sensitive flows where possible.

### Suggested acceptance criteria

- Analytics payloads contain no email, token, precise location, or raw sensitive preference data.
- Users can opt out of analytics where required.
- Privacy policy matches actual analytics behavior.

---

## 11. Medium: Guest session abuse controls should be strengthened

### Evidence

Reviewed file:

```text
supabase/functions/guest-sessions/index.ts
```

The guest session Edge Function has helpful controls:

- TTL limits.
- Metadata size limits.
- Device ID length checks.
- API key check.
- Max sessions per device per hour.

However, device ID is client-supplied and any API key shipped in a mobile app should be considered discoverable.

### Risk

Attackers can rotate device IDs or extract client-side keys and abuse guest session creation.

### Recommendation

Treat the guest API key as friction, not a true secret.

Add:

- IP-based rate limiting.
- Abuse detection.
- Optional CAPTCHA/human challenge for web.
- Device attestation for mobile if abuse becomes serious.
- Monitoring for high-volume session creation.

### Suggested acceptance criteria

- Rotating device IDs does not bypass all throttling.
- High-volume guest creation generates alerts.
- Guest sessions are short-lived and revocable.

---

## 12. Medium: Edge Functions use `@ts-nocheck`

### Evidence

Reviewed files:

```text
supabase/functions/guest-sessions/index.ts
supabase/functions/ingest-menu-photo/index.ts
supabase/functions/ops-dishes-draft/index.ts
```

Several Supabase Edge Functions disable TypeScript checks using `// @ts-nocheck`.

### Risk

TypeScript checks are particularly valuable in service-role functions and request parsing code. Disabling checks increases the chance of authorization and validation mistakes.

### Recommendation

Remove `@ts-nocheck` from Edge Functions and add strict schema validation.

Recommended improvements:

- Use typed request schemas.
- Validate payloads explicitly.
- Add tests for invalid auth, invalid payloads, ownership failures, and rate-limit failures.
- Fail closed on unexpected input.

### Suggested acceptance criteria

- Edge Functions compile with TypeScript checking enabled.
- Tests cover unauthorized, forbidden, invalid payload, and success cases.

---

## 13. Low/Medium: Tracked environment files are risky

Status: partially remediated in repo. The current tree removes a tracked Sentry token from roadmap docs and keeps staged gitleaks coverage. Previously exposed credentials still require external rotation and, if desired, explicit approval for git-history cleanup.

### Evidence

Reviewed files:

```text
.env.production
.env.staging
.env.development
.gitignore
```

The repo tracks environment files such as `.env.production`, `.env.staging`, and `.env.development`. They are currently blank placeholders, but include sensitive variable names like:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MAPBOX_SECRET_TOKEN`
- `SENTRY_AUTH_TOKEN`
- `EXPO_TOKEN`

The `.gitignore` ignores local variants such as `.env.local`, `.env.*.local`, and `secrets*`, but the tracked environment files could accidentally receive real values in the future.

### Risk

Secrets may accidentally be committed to Git history.

### Recommendation

Track only `.env.example` unless there is a strong reason to track blank environment templates.

Recommended changes:

- Add `.env.production`, `.env.staging`, and `.env.development` to `.gitignore`, or keep them as clearly marked templates with no real values ever.
- Store real values in EAS secrets, Supabase secrets, GitHub Actions secrets, and local `.env.*.local` files.
- Add secret scanning to CI.

### Suggested acceptance criteria

- No real secret values exist in tracked files.
- Secret scanning runs in CI.
- Production deployments load secrets only from secret managers.

---

## 14. Low/Medium: Service-role debugging files should be isolated

Status: remediated in repo on 2026-05-15 by requiring `HUNGRY_ALLOW_SERVICE_ROLE_SMOKE=1` and `HUNGRY_SMOKE_SUPABASE_SERVICE_ROLE_KEY`; scripts no longer read `.env.local` directly.

### Evidence

Reviewed files:

```text
test_service_role.ts
test_jwt.js
```

Root-level test/debug scripts read `.env.local` and use or decode the Supabase service-role key.

### Risk

These scripts increase the chance of accidentally logging service-role data or being run in the wrong environment.

### Recommendation

Move service-role test scripts into a clearly marked local-only folder and prevent them from running in CI.

Recommended path:

```text
scripts/local-only/
```

Add warnings:

```text
DO NOT RUN IN CI.
DO NOT COMMIT SERVICE ROLE OUTPUT.
LOCAL DEBUGGING ONLY.
```

Avoid printing decoded service-role JWT contents.

### Suggested acceptance criteria

- Service-role debug scripts are not in the repo root.
- CI cannot run them accidentally.
- Scripts do not print sensitive token contents.

---

# Authentication recommendations

## Current good controls

- Supabase authentication is used.
- Email confirmation is handled.
- Generic invalid-credential errors are shown.
- SecureStore-backed auth token storage exists.
- Password validation currently requires at least 12 characters and a mix of character types.

## Recommended improvements

- Require MFA/passkeys for admin users.
- Require or strongly encourage MFA for merchants.
- Add known-compromised password checks.
- Add rate-limit tests for login, signup, password reset, OTP, and email verification.
- Revoke sessions on password change or reset.
- Require re-authentication before sensitive actions:
  - email change
  - password change
  - merchant verification submission
  - merchant business/profile changes
  - account deletion

---

# Authorization recommendations

Authorization should always be enforced server-side through RLS, database functions, or Edge Functions. Frontend route guards are not sufficient.

## Required authorization tests

Add regression tests for:

- User A cannot read User B private profile fields.
- User A cannot edit or delete User B content.
- Merchant A cannot edit Merchant B outlet, dish, image, promotion, verification, or notification preferences.
- Merchant cannot set themselves as verified.
- Normal user cannot call ops/admin functions.
- Unverified merchant cannot access verified-only merchant features.
- Client-supplied `user_id`, `merchant_account_id`, `role`, or `verified` values are ignored or denied where inappropriate.

---

# Storage and upload recommendations

## Recommended bucket model

| Bucket | Recommended access |
|---|---|
| Public merchant catalog images | Public read, merchant-owner write |
| Public stall images | Public read, merchant-owner write |
| Post media | Private + visibility-aware signed URLs |
| Review media | Private unless review/media is intentionally public |
| Avatars | Private or public depending on profile visibility |
| Merchant verification evidence | Private only |
| Moderation evidence | Private only |

## Required upload controls

- Allowlist file types.
- Verify magic bytes.
- Enforce file size and dimensions.
- Strip EXIF metadata.
- Re-encode images.
- Generate safe filenames server-side.
- Do not allow user-controlled paths except under authenticated owner prefix.
- Use `upsert: false` unless overwrite is needed.
- Scan or quarantine risky uploads where possible.

---

# Privacy recommendations

## Data minimization

Do not expose or send more data than necessary.

Sensitive or semi-sensitive data includes:

- email
- phone number
- location
- dietary preferences
- taste vector
- saved/favourite dishes
- review history
- private posts
- merchant verification evidence
- moderation reports
- analytics identifiers

## Recommended privacy architecture

- Separate public and private profile data.
- Use private buckets for private media.
- Minimize analytics payloads.
- Add consent controls.
- Define retention/deletion rules.
- Ensure account deletion covers related records and media.

---

# Release-blocking checklist

Do not treat the app as production-security-ready until these are complete or explicitly accepted as risks:

- [x] Replace ops Edge Function static-key auth with real admin auth in repo code.
- [x] Restrict ops/admin CORS to trusted origins in repo code.
- [x] Add audit logs for ops/admin actions in repo code.
- [x] Prevent merchants from setting verification status to `verified` in repo code.
- [x] Move merchant verification evidence into a private bucket in repo code.
- [x] Split public profile data from private profile data in repo code.
- [x] Prevent public/followed reads from exposing email, taste vectors, dietary preferences, or private profile data in repo code.
- [ ] Harden media uploads with EXIF stripping, re-encoding, and dimension checks.
- [x] Add MIME, size, and magic-byte validation for controlled uploads in repo code.
- [x] Stop accepting arbitrary external media URLs from normal users in repo code.
- [ ] Review all public buckets and make user-generated/private media private-by-default.
- [ ] Replace broad `select("*")` queries with explicit fields or views.
- [ ] Add merchant/admin route guards in the app.
- [ ] Keep RLS/backend authorization as the source of truth.
- [x] Minimize and scrub analytics data sent to PostHog/Sentry in repo code.
- [ ] Remove `@ts-nocheck` from security-sensitive Edge Functions.
- [ ] Clean up tracked environment-file history and rotate exposed credentials externally.
- [x] Guard service-role debug scripts with explicit local smoke envs.
- [x] Add static/source regression tests for user, merchant, admin, storage, CI, and analytics controls.
- [ ] Add live linked Supabase multi-user RLS smoke tests for user, merchant, admin, and storage access.

---

# Suggested PR sequence

## PR 1: Lock down ops/admin access

- Keep JWT/admin auth; do not reintroduce `x-ops-api-key` only auth.
- Require authenticated admin user.
- Restrict CORS.
- Add audit logging.
- Add rate limiting.

## PR 2: Harden merchant verification

- Add private evidence bucket.
- Move evidence from `file_url` to `storage_bucket` + `storage_path`.
- Add admin-only verification decision trigger/function.
- Add tests proving merchants cannot self-verify.

## PR 3: Split public/private profiles

- Create public profile view.
- Restrict raw `user_profiles` to owner-only.
- Update app queries to use public profile DTOs.

## PR 4: Harden upload pipeline

- Add magic-byte checks.
- Add image re-encoding and EXIF stripping.
- Add dimension limits.
- Prevent arbitrary external media URLs.
- Change signed upload overwrite behavior where appropriate.

## PR 5: Add security regression tests

- RLS tests for private user data.
- Merchant ownership tests.
- Admin/ops authorization tests.
- Storage access tests.
- Edge Function auth tests.

## PR 6: Privacy and analytics cleanup

- Minimize analytics payloads.
- Add consent/opt-out behavior where needed.
- Update privacy documentation.

---

# Final assessment

Hungry already has meaningful security work in place, especially around Supabase RLS, SecureStore-backed session persistence, storage prefix policies, and merchant/review hardening.

The main remaining work is to remove assumptions that a client, static key, public row, or public URL can be trusted. For production readiness, prioritize admin/ops lockdown, merchant verification integrity, profile privacy, and upload/media hardening first.
