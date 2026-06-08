# Neutral Supabase + Store Release Audit

Evidence date: May 18, 2026.  
Scope: repo-local only. No live Supabase project reads and no production database mutations. Repo docs were treated as claims and checked against code, migrations, config, tests, smoke SQL, Edge Functions, env templates, and CI.

External standards checked:
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Edge Function auth](https://supabase.com/docs/guides/functions/auth)
- [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [OWASP API1 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Singapore PDPA data protection obligations](https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act/data-protection-obligations)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple account deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [Google Play Developer Program Policies](https://support.google.com/googleplay/android-developer/answer/16070163)
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play Data safety](https://support.google.com/googleplay/answer/11416267)

## 1. Executive Summary

Overall Supabase integration grade: C+.  
Store-release readiness grade: D.  
Production readiness verdict: No-Go for public App Store / Google Play launch. The database foundation is broad and mostly RLS-aware, but account deletion, privacy disclosures, UGC safety coverage, Supabase bootstrap behavior, and several backend hardening gaps must be closed before public release.

Top 10 risks:
1. Account deletion is not wired from Settings to the Supabase deletion request path; Settings only purges local data.
2. Published privacy pages are stubs / waitlist-only and do not cover app data collection.
3. App Store privacy and Play Data Safety disclosures remain open while Supabase, Sentry, PostHog, Mapbox, location, photo/video, chat, and UGC features exist.
4. `merchant_dish_view_events` allows `insert to anon, authenticated` without binding `user_id` to `auth.uid()` or proving the dish belongs to the venue.
5. `merchant_email_outbox` is client-insertable by merchant owners/managers, creating a spam/phishing path if a worker sends queued rows.
6. `useAppBootstrap` forces the Supabase provider in user mode even when data-source fallback says `mock`.
7. Password reset is not wired end-to-end for Supabase recovery redirects.
8. Menu OCR Edge Function base64 conversion can fail for valid 10 MB menu images.
9. Home post UGC moderation affordances are incomplete compared with backend report/hide/block methods.
10. CI lacks Supabase migration dry-run, Edge Function type checks, and protected Supabase smoke gates.

Top 10 recommended improvements:
1. Wire in-app deletion to `requestAccountDeletion`, add a deletion/anonymization worker, and publish the required account deletion URL.
2. Publish a full app privacy policy covering auth, profile, location, photos/videos, UGC, chat, analytics, crash reporting, AI/OCR, retention, and deletion.
3. Complete Apple App Privacy and Google Play Data Safety matrices from actual SDK and data flows.
4. Replace direct `merchant_dish_view_events` client writes with a constrained RPC or Edge Function.
5. Make `merchant_email_outbox` service-role-owned and expose only constrained template RPCs.
6. Remove the unconditional Supabase provider override in app bootstrap and add a mock-mode regression test.
7. Add auth callback/deep-link handling for email verification and password recovery.
8. Change OCR image encoding to chunked or streaming base64.
9. Add report/hide/block controls consistently across posts, comments, profiles, chat, and reviews.
10. Add Supabase static audit, migration dry-run, Edge Function checks, smoke SQL, and RLS tests to CI.

Safe to keep:
- SecureStore-backed Supabase auth token adapter with production memory-only fallback.
- `persistSession`, `autoRefreshToken`, and `detectSessionInUrl: false` mobile client settings.
- Broad RLS enablement across repo-created public tables.
- Private buckets for menu photos, post media, and merchant verification evidence.
- Service-role Edge Functions that validate caller JWTs before privileged work for OCR and ops review.
- PostGIS, pgvector, HNSW, and trigram usage for search/recommendations.
- Existing smoke SQL and source contract tests for several Supabase slices.

Must fix before launch:
- Account deletion implementation and external deletion URL.
- Public privacy policy and store privacy/Data Safety disclosures.
- P1 RLS / write-path hardening for merchant analytics and email outbox.
- Consistent UGC moderation/report/block/hide coverage.
- Auth recovery/deep-link flows.
- Supabase/Edge CI gates and a staging verification pass.

## 2. Architecture Review

| Area | Grade | Evidence | Notes |
|---|---:|---|---|
| Client initialization | B | `src/lib/services/supabase/client.ts:7-61` | Uses env config and SecureStore storage; falls back to Supabase automatically when credentials exist. |
| Environment switching | C | `.env.example:7-59`, `.env.staging:1-15`, `.env.production:1-15`, `eas.json:11-26` | Good separation intent, but preview/production force Supabase and dashboard-only settings are not verified in repo. |
| Mock vs Supabase mode | C- | `src/lib/services/supabase/client.ts:17-28`, `src/hooks/useAppBootstrap.ts:102-107` | Data-source resolver supports mock, but bootstrap unconditionally sets Supabase provider in user mode. |
| Service provider pattern | B | `src/lib/services/serviceProvider.ts`, `src/lib/services/supabase/supabaseService.ts` | Clear abstraction; some sync repository fallbacks return empty caches before hydration. |
| Repository/service boundaries | B- | `src/lib/services/supabase/supabaseRepository.ts:544-747` | RPC-first service exists, but repo cache hydration is fire-and-forget. |
| Direct Supabase calls | C | `src/lib/services/supabase/supabaseService.ts`, prior `utils/supabase.ts` | Main direct calls are centralized; a legacy orphaned client was replaced in this audit. |
| Error handling/fallback | C+ | `src/hooks/useAppBootstrap.ts:123-150` | Avoids crash, but session is set signed-out on bootstrap failure instead of offline/stale session handling. |
| Offline fallback | D+ | `src/hooks/useAppBootstrap.ts:96-100`, `RootNavigator.tsx` | Offline state is manually forced false; NetInfo-driven offline handling is not active. |

## 3. Database Schema Review

Inventory from static audit:
- 39 migrations through `supabase/migrations/0039_merchant_portal_readiness.sql`.
- 85 repo-created tables found by static parser.
- 214 static `create policy` statements matched by the audit script; raw `rg` found 216 `create policy` strings, so live catalog verification remains required.
- Three Edge Functions: `guest-sessions`, `ingest-menu-photo`, `ops-dishes-draft`.
- PostgreSQL 17 local config in `supabase/config.toml`.

Schema strengths:
- Core entities use explicit keys, FKs, timestamps, checks, and indexes in most areas.
- Catalog/search schema uses PostGIS, pgvector, HNSW, and pg_trgm appropriately.
- Social/chat schema includes participant models and count triggers.
- Import/provenance schema separates staging/source observations from app-facing tables.
- Merchant organization and change-request tables include role models and service-role policy patterns.

Schema gaps:
- Several event tables lack FK ownership constraints (`taste_interaction_events.user_id`, `quiz_responses.user_id`, `merchant_dish_view_events.user_id`).
- `merchant_dish_view_events` has a unique dedupe key but no DB-side validation that the event `dish_id` belongs to the same `venue_id`.
- `merchant_email_outbox` stores recipient emails, subject, body, and error messages with no worker-only write boundary.
- `account_deletion_requests` captures the request but no repo-side deletion/anonymization worker is present.
- Rollback SQL exists in the numbered migration chain (`0011_rollback_supply_priming.sql`) and drops tables with cascade; future rollback scripts should be manual-only.
- Some service-role-only tables intentionally have no regular policies; this is safe by default-deny, but explicit grants/smoke coverage should be added consistently.
- No visible retention/anonymization strategy exists for chat messages, posts, media, reports, analytics events, OCR text, or merchant email outbox.

## 4. RLS and Authorization Review

Static verdict: all repo-created public tables detected by `scripts/supabase-neutral-audit.mjs` have RLS enabled. This does not replace a live `pg_class`/`pg_policies` check after migrations are applied to staging.

| Table | RLS enabled | Public read? | User write? | Admin/service only? | Risk | Fix |
|---|---:|---:|---:|---:|---|---|
| account_deletion_requests | Yes | No | Own insert/select | No | No deletion worker | Add worker + retention SLA |
| app_ops_admins | Yes | No | No | Yes | Dashboard seeding manual | Document admin bootstrap |
| app_ops_audit_events | Yes | No | No | Yes | Retention undefined | Add retention policy |
| app_ops_rate_limits | Yes | No | No | Yes | Service-only OK | Keep |
| app_user_rate_limits | Yes | No | No | Yes | Service-only OK | Keep |
| bite_reactions | Yes | No | Own | No | Legacy UGC safety | Ensure report/block coverage |
| bites | Yes | Public/followed | Own | No | UGC moderation partial | Add safety affordances |
| blog_posts | Yes | Yes | No | Service | Public CMS data | Keep public read intentional |
| blog_sources | Yes | Yes | No | Service | Public source data | Keep |
| building_floors | Yes | Yes | No | Service | Public directory data | Keep |
| buildings | Yes | Yes | No | Service | Public directory data | Keep |
| chat_messages | Yes | No | Sender | No | Legacy chat model | Retire or fully gate |
| content_reports | Yes | No | Own insert/select | Service | Ops workflow missing | Add moderation queue |
| conversation_participants | Yes | No | Participant scoped | No | BOLA risk if helper wrong | Keep helper tests |
| conversations | Yes | No | Participant scoped | No | BOLA risk if helper wrong | Keep helper tests |
| customer_interaction_reports | Yes | No | Merchant/member scoped | No | Merchant boundaries complex | Add smoke negative tests |
| data_quality_flags | Yes | No | No | Yes | Service-only OK | Keep |
| dietary_flags | Yes | Yes | No | Service | Public reference data | Keep |
| dish_dietary_flags | Yes | Yes | No | Service | Public reference data | Keep |
| dish_flavor_tags | Yes | Applied only | No | Service | Pending AI suggestions hidden | Keep gated |
| dish_images | Yes | Yes | No | Service | Public media metadata | Add moderation state if UGC |
| dish_source_observations | Yes | No | No | Yes | Raw import data | Keep service-only |
| dish_taste_vectors | Yes | Yes | No | Service | Public taste vectors | Keep if non-personal |
| dishes | Yes | Yes | No | Service/merchant via RPC | Public catalog data | Keep |
| dishes_draft | Yes | No | No | Yes | Default-deny service table | Add smoke coverage |
| external_place_refs | Yes | No | No | Yes | Raw source IDs | Keep service-only |
| external_sources | Yes | No | No | Yes | Import source registry | Keep service-only |
| follows | Yes | No | Own | No | Privacy-sensitive graph | Keep immutable guards |
| google_places_observations | Yes | No | No | Yes | Raw third-party data | Keep service-only |
| guest_sessions | Yes | No | No | Yes | Function uses API key | Add abuse monitoring |
| hidden_posts | Yes | No | Own via RPC | Service | User safety data | Keep |
| home_feed_items | Yes | No | No | Yes | Read model service-only | Keep |
| import_runs | Yes | No | No | Yes | Raw import logs | Keep service-only |
| menu_photo_submissions | Yes | No | Own via RPC | Service | OCR PII/third-party data | Add retention |
| merchant_accounts | Yes | No | Owner/member | Service | Merchant isolation critical | Add live RLS smoke |
| merchant_change_request_events | Yes | No | Member scoped | Service | Audit trail sensitive | Keep service writes |
| merchant_change_requests | Yes | No | Merchant via RPC | Service | Pending changes sensitive | Keep helper tests |
| merchant_claim_interests | Yes | No | Own via RPC | Service | Contact PII | Add retention/anonymization |
| merchant_dish_view_events | Yes | No | Anon/auth insert | No | Loose insert, spoofable user/session | Replace with RPC/Edge hardening |
| merchant_email_outbox | Yes | No | Merchant insert | No | Spam/phishing queue risk | Make service-owned |
| merchant_members | Yes | No | Org scoped | Service | Org role escalation risk | Keep manager checks |
| merchant_notification_preferences | Yes | No | Own/merchant | No | Notification consent | Add preference enforcement tests |
| merchant_notifications | Yes | No | Merchant write | No | Client can create notifications | Prefer service-owned for system notices |
| merchant_organization_outlets | Yes | No | Org scoped | Service | Linkage critical | Keep smoke tests |
| merchant_organizations | Yes | No | Org scoped | Service | Org ownership critical | Keep helper tests |
| merchant_outlets | Yes | Public selected fields? | Merchant scoped | Service | Contact fields may be sensitive | Separate public/private fields |
| merchant_promotions | Yes | Public? merchant write | Merchant scoped | Service | Promo integrity | Add status/window constraints |
| merchant_roles | Yes | No | Owner/manager | Service | Invite role escalation | Add invite acceptance checks |
| merchant_verification_evidence | Yes | No | Own private upload | Service/admin | Sensitive evidence | Keep private bucket and retention |
| merchant_verifications | Yes | No | Merchant draft/submit | Admin/service decisions | Decision guard present | Keep |
| messages | Yes | No | Participant scoped | No | DM safety incomplete | Add report/block/delete controls |
| moderation_actions | Yes | No | No | Yes | Ops-only OK | Add retention/audit access |
| orders | Yes | No | Own | No | Update policy may be too broad | Add immutable ownership guard |
| photo_source_observations | Yes | No | No | Yes | Raw media source data | Keep service-only |
| post_comments | Yes | Visible post only | Own | Service | Comment moderation incomplete | Add report/delete controls |
| post_likes | Yes | Visible post only | Own | No | Low risk | Keep |
| post_media | Yes | Visible post only | Own linked post | Service | Private bucket display complexity | Use signed/public strategy consistently |
| post_moderation_states | Yes | No | No | Yes | Service-only OK | Keep |
| post_reports | Yes | Own/ops | Own via RPC | Service | Good RPC pattern | Keep |
| post_saves | Yes | Own | Own | No | Low risk | Keep |
| post_shares | Yes | Visible post only | Own | No | Sharing privacy | Add abuse/rate limits |
| posts | Yes | Public/followed/private | Own | Service | UGC safety partial | Add report/hide/block affordances |
| privacy_settings | Yes | Own | Own | No | Good privacy primitive | Keep |
| quiz_responses | Yes | No | Own | No | Missing user FK | Add FK + retention |
| read_receipts | Yes | No | Participant scoped | No | Message privacy | Keep helper tests |
| review_photos | Yes | Yes | Own via review | Service | Public UGC media | Add moderation/delete retention |
| reviews | Yes | Yes | Own | Service | Public UGC | Keep report/block coverage |
| staging_food_businesses | Yes | No | No | Yes | Raw import data | Keep service-only |
| staging_google_places_observations | Yes | No | No | Yes | Raw third-party data | Keep service-only |
| staging_import_errors | Yes | No | No | Yes | May contain raw PII | Redact and retain briefly |
| staging_menu_items | Yes | No | No | Yes | Raw import data | Keep service-only |
| staging_photos | Yes | No | No | Yes | Raw photo metadata | Retention/cleanup |
| stall_posts | Yes | Yes | No | Service | Public content | Keep |
| taste_interaction_events | Yes | No | Own | Service | Behavioral data sensitive, missing FK | Add consent/retention/FK |
| user_blocks | Yes | No | Own | No | Good safety primitive | Surface across app |
| user_favourite_dishes | Yes | Own | Own | No | Taste signal | Keep |
| user_profiles | Yes | Own table; public view | Own | Service | Public profile now via view | Keep privacy view tests |
| user_taste_vectors | Yes | Own | Own/service | Service | Behavioral personalization | Add consent/export/delete |
| venue_aliases | Yes | No | No | Yes | Dedupe metadata | Keep service-only |
| venue_categories | Yes | Yes | No | Service | Public reference data | Keep |
| venue_category_links | Yes | Yes | No | Service | Public reference data | Keep |
| venue_delivery_links | Yes | Yes | No | Service | Public link data | Validate outbound links |
| venue_merge_events | Yes | No | No | Yes | Dedupe audit | Keep service-only |
| venue_source_observations | Yes | No | No | Yes | Raw import data | Keep service-only |
| venues | Yes | Yes | Merchant via scoped paths | Service | Public catalog data | Keep |

## 5. Auth and Session Security Review

Strengths:
- Supabase client uses `supabaseAuthStorage`, not the default React Native AsyncStorage.
- `authStorage.ts` chunks session JSON for SecureStore and migrates legacy AsyncStorage copies.
- Production fallback is memory-only if SecureStore fails.
- Sign-up, sign-in, OAuth, sign-out, refresh, and account deletion request methods exist in `supabaseService.ts`.

Gaps:
- Settings delete action only clears local stores and navigates to sign-up; it does not call `getHungryService().auth.requestAccountDeletion`.
- Password reset sends email without `redirectTo`, reset ignores the supplied token, and navigation linking has no auth callback route.
- Email verification, OAuth provider enablement, leaked password protection, MFA, and provider dashboard settings are manual verification items.
- Bootstrap network failure can mark the session signed-out rather than preserving a stale offline session.

Sensitive session material:
- Current primary client storage is acceptable for mobile. The legacy `utils/supabase.ts` AsyncStorage client was replaced in this audit with a re-export of the secure client.

## 6. Storage Security Review

Buckets found in migrations:
- `menu-photos`: private, 10 MB, image MIME restrictions, service-role OCR access.
- `post-media`: private, post visibility-backed select policy.
- `merchant-verification-evidence`: private, caller-owned prefix, service-role select.
- `review-media`, `avatars`, `bites-media`, `merchant-dish-images`, `merchant-stall-images`: public in earlier policies/config patterns and should be reviewed as intentionally public UGC/merchant media.

Strengths:
- Upload code validates MIME type, size, and magic bytes for images/videos.
- Signed upload URLs are used.
- Storage object policies use caller-owned path prefixes for user uploads.

Gaps:
- `mediaUpload.ts` returns `getPublicUrl()` for all buckets, including private buckets. Private display paths need signed download URLs or explicit authenticated storage access.
- Public UGC buckets require moderation, takedown, orphan cleanup, cache invalidation, and data deletion handling.
- No repo evidence of scheduled orphan cleanup or storage lifecycle retention.

## 7. Edge Functions Review

| Function | Auth | Service role | Input validation | Rate limit | Risk |
|---|---|---:|---|---|---|
| `guest-sessions` | API key header, `verify_jwt=false` | Yes | deviceId, metadata size, TTL | Per-device hourly count | API key is bearer-like; add rotation and abuse alerts. |
| `ingest-menu-photo` | Validates JWT via anon client | Yes | submission owner/status/attempts | Per-user RPC rate limit | 10 MB image base64 spread can fail; third-party OCR/LLM disclosure required. |
| `ops-dishes-draft` | Validates JWT and `app_ops_admins` | Yes | action/decision checks | Ops RPC rate limit | `@ts-nocheck`; add Deno type check/tests. |

Service role usage is generally contained to functions, but any function using service role must continue validating caller identity and object ownership before privileged reads/writes.

## 8. Data Privacy and Compliance Review

Personal data stored or inferred:
- Auth identity, profile display/avatar, location preferences/current location usage, posts, reviews, photos/videos, comments, likes/saves/shares, messages/read receipts, reports/blocks, taste vectors, quiz responses, behavior/taste interaction events, merchant contact details, merchant verification evidence, OCR text, analytics/crash identifiers.

Privacy gaps:
- No production app privacy policy in repo.
- No implemented deletion/anonymization worker.
- No data export path.
- Retention policies are not defined for UGC, chat, reports, OCR text, verification evidence, email outbox, analytics events, and raw import data.
- Behavioral personalization consent and opt-out are not clearly implemented.
- Singapore PDPA obligations require appropriate consent/notification, protection, correction/access processes, retention limitation, transfer limitation, and accountability.

## 9. Performance and Scalability Review

Strengths:
- Search and catalog paths include PostGIS indexes, HNSW vector indexes, trigram support, and paginated RPCs.
- Feed read models and count triggers reduce some client-side N+1 risks.
- RPCs cap result sizes.

Risks:
- `supabaseRepository` starts caches empty and `ensureHydrated()` does not await refresh, so screens can render empty initial data in Supabase mode.
- Direct `merchant_dish_view_events` inserts can become a hot table and abuse target; use batched/event RPCs with rate limiting.
- Public RPCs need explicit rate limits if they become exposed at scale.
- Realtime chat subscriptions need connection limits, pagination, and retention once DMs are enabled.
- Storage growth needs lifecycle rules, image resizing, CDN/cache policy, and orphan cleanup.

## 10. Testing and Verification Review

Existing coverage:
- Unit/source contract tests for security hardening, service provider, client data-source resolution, chat smoke script, merchant organization, change requests, social governance, and database foundation.
- Smoke SQL exists for PostGIS, pgvector, mobile storage, merchant RLS, integration readiness, social governance, database foundation, and merchant organization/change requests.
- CI runs typecheck, lint, format check, tests, Expo Doctor, npm audit, Gitleaks, and TruffleHog.

Missing coverage:
- No CI Supabase migration dry-run.
- No Edge Function `deno check`/unit tests.
- No CI execution of static Supabase audit.
- No 0039 merchant portal smoke coverage.
- No automated account deletion flow test.
- No storage upload/download/delete security tests.
- No RLS matrix test that runs against a real local/staging database.

Implemented in this audit:
- Added `scripts/supabase-neutral-audit.mjs`.
- Added `npm run audit:supabase:static`.
- Added `supabase/smoke/supabase_neutral_audit.sql`.
- Updated `.env.example` with Edge Function and smoke env placeholders.
- Replaced legacy `utils/supabase.ts` direct AsyncStorage client with secure client re-export.

## 11. Industry Gap Analysis

Already strong:
- RLS-first database shape.
- Service-role use largely isolated to Edge Functions.
- Secure mobile session storage.
- Import staging/provenance and moderation tables exist.
- Smoke SQL and source-contract test culture is already present.

Missing before public launch:
- Live RLS verification automation.
- Staging database parity and migration dry-run in CI.
- Backup/PITR verification and restore drills.
- Explicit rollback strategy outside numbered migration chain.
- Secret rotation plan and dashboard config inventory.
- Least-privilege constraints for service-role-backed functions.
- App-wide UGC/report/block/moderation controls.
- Account deletion worker and retention/anonymization policy.
- Public privacy policy and store privacy/Data Safety answers.
- Observability alerts for auth failures, function errors, rate limits, storage upload failures, and suspicious writes.

Can wait until scale:
- Partitioning hot event tables.
- Advanced collaborative recommendations.
- Formal DPA/vendor register automation.
- Warehouse-grade analytics pipeline.
- Automated media moderation beyond launch minimums if UGC volume remains low.

## 12. Concrete Fix Plan

### P0 - Must fix before public launch

| Issue | Risk | Affected files/tables | Recommended fix | Effort | Verification |
|---|---|---|---|---:|---|
| In-app deletion is local-only | Store rejection; PDPA/data retention gap | `SettingsScreen.tsx`, `account_deletion_requests` | Call service deletion request, add backend deletion/anonymization worker, publish deletion URL | M | App test + SQL smoke |
| Privacy policy is stub/waitlist-only | Store rejection; user disclosure gap | `marketing/.../privacy`, app links | Publish full app privacy policy | M | Manual URL review |
| Store privacy/Data Safety incomplete | Store rejection | `tasks/store-submission-checklists.md`, App Store Connect, Play Console | Complete disclosure matrix from actual SDK/data flows | M | Store checklist signoff |
| UGC safety incomplete on home/posts/chat | Store rejection / abuse | home posts, comments, chat, profiles | Add report/hide/block/delete affordances and moderation queue | L | UI smoke + RLS tests |

### P1 - Should fix before beta

| Issue | Risk | Affected files/tables | Recommended fix | Effort | Verification |
|---|---|---|---|---:|---|
| Loose merchant analytics insert | Spoofed analytics, hot table abuse | `merchant_dish_view_events`, `recordDishView` | Use RPC/Edge Function with dish/venue/user/session/rate checks | M | Negative RLS smoke |
| Client-writable email outbox | Spam/phishing if worker sends queued rows | `merchant_email_outbox` | Service-role-only writes + constrained template RPC | M | Negative RLS smoke |
| Bootstrap forces Supabase | Mock/offline fallback broken | `useAppBootstrap.ts` | Respect `getConfiguredDataSource()` and valid client | S | Unit regression |
| Password reset incomplete | Broken account recovery | auth service/linking | Add redirect/deep-link callback and recovery exchange | M | Auth flow smoke |
| OCR base64 conversion unsafe | Valid uploads can fail | `ingest-menu-photo` | Chunked encoding / Deno base64 encoder | S | Edge test with large fixture |
| CI lacks Supabase gates | Migration/function regressions | `.github/workflows/*` | Add static audit, dry-run, deno check, optional staging smoke | M | CI pass |

### P2 - Improve after beta

| Issue | Risk | Affected files/tables | Recommended fix | Effort | Verification |
|---|---|---|---|---:|---|
| Repository hydration empty cache | Blank/empty initial reads | `supabaseRepository.ts` | Await hydration or move screens fully async | M | Screen/service tests |
| Offline state manual | Poor resilience | `useAppBootstrap.ts`, UI store | NetInfo-driven offline/stale handling | M | Offline smoke |
| Retention/export missing | Compliance/ops debt | UGC/chat/OCR/report tables | Data retention and export tooling | L | Runbook + SQL tests |
| Public media lifecycle missing | Storage/cost/privacy | storage buckets | Orphan cleanup, resizing, signed URL strategy | M | Storage smoke |

## 13. Implementation Work

Safe changes applied in this audit:
- `scripts/supabase-neutral-audit.mjs`: dependency-free static inventory script for migrations, RLS/policies, Edge Functions, storage buckets, service-role grants, and direct app clients.
- `package.json`: added `audit:supabase:static`.
- `supabase/smoke/supabase_neutral_audit.sql`: read-only SQL that returns audit findings for missing RLS, missing policies, anon write policies, loose merchant analytics policies, client-writable email outbox, unsafe security-definer setup, and public storage buckets.
- `.env.example`: added Edge Function and Supabase smoke placeholders without secret values.
- `utils/supabase.ts`: removed the legacy direct Supabase client using AsyncStorage and re-exported the secure central client.
- `package.json` / lockfile: updated `expo-dev-client` from `~55.0.33` to `~55.0.34` to satisfy Expo SDK 55 Doctor validation.

Manual actions required:
- Verify Supabase Auth settings: email confirmation, password recovery redirect URLs, OAuth providers, leaked-password protection, MFA roadmap, allowed redirect URLs.
- Verify backups/PITR and restore drill in Supabase dashboard.
- Configure Edge Function secrets and allowed origins per environment.
- Complete App Store Connect privacy details and Google Play Data Safety.
- Publish privacy policy, terms, support URL, and account deletion URL.
- Prepare reviewer/test account notes without committing secrets.

Risky fixes intentionally not implemented in this pass:
- Changing merchant analytics/email outbox RLS because it can break current app/merchant flows without a replacement RPC and tests.
- Adding deletion/anonymization worker because retention and business rules need product/legal confirmation.
- Altering public/private media bucket behavior because current UI display paths need a signed URL plan.

## 14. Verification

Commands run:
- `npm run audit:supabase:static` - passed. Found 39 migrations, 85 repo-created tables, no static missing-RLS tables, one anon write policy (`merchant_dish_views_public_insert`), 9 storage bucket declarations, and no direct app Supabase clients outside the central client after this audit patch.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run test` - passed: 330 passing, 2 skipped.
- `npx expo-doctor --non-interactive` - failed because this Expo Doctor version interprets `--non-interactive` as a project path.
- `npx expo-doctor` - initially failed on `expo-dev-client` patch mismatch; after updating `expo-dev-client` to `~55.0.34`, rerun passed 17/17 checks.
- `git diff --check` - passed.
- `supabase migration list --local` - environment-blocked. Sandbox run could not access `127.0.0.1:54322`; unrestricted retry reached localhost but the local Supabase Postgres port was not running (`connection refused`).

Current environment limitation:
- Local DB smoke SQL was not executed because the local Supabase database was not running. This is not evidence of a migration failure; run `supabase start` then `psql "$SUPABASE_DB_URL" -f supabase/smoke/supabase_neutral_audit.sql` in a local/staging environment.

## 15. App Store / Google Play Release Policy Review

Verdict: No-Go for public store submission until P0 policy items are closed.

Apple readiness:
- Account creation exists, so account deletion must be discoverable in-app and must delete the account, not only local data.
- Privacy details must describe collected data and linked/tracked use for Supabase auth/profile, precise/coarse location, photos/videos, posts/reviews/comments/chat, taste personalization, analytics, crash logs, and third-party processing.
- UGC needs working reporting/blocking and moderation handling across all UGC surfaces.
- Reviewer notes must include test credentials or OTP/test process, feature flags, permission prompt explanations, and account deletion path.
- Permission copy is present for location/camera/photos/microphone, but microphone should be removed or gated if video/audio recording is not shipped.

Google Play readiness:
- Data Safety must match actual collection, sharing, security practices, retention, and deletion.
- Account deletion URL must be public, reachable, and explain account/data deletion clearly.
- UGC policies require in-app reporting/blocking and content moderation for posts/comments/chat/reviews.
- AI-generated/suggested content and OCR/LLM third-party processing need disclosure and user-facing clarity where shipped.
- Location/photo/video permissions must be justified by app functionality and disclosed.

Open store-specific repo evidence:
- Store submission checklist still marks privacy/Data Safety/reviewer notes open in `tasks/store-submission-checklists.md`.
- Privacy page is explicitly a stub in `marketing/website/web-v2/src/app/privacy/page.tsx`.
- `app.json` declares location, camera, microphone, and photo permissions.
- PostHog and Sentry SDKs exist in `package.json`; PostHog sink can identify users and set analytics properties.
