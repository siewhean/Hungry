# Hungry App Final Go / No-Go Checklist

Updated: 2026-06-25
Production status: **No-Go** (Go Candidate on repo-local gates only)

## Required Gates

| Gate | Status | Notes |
|---|---:|---|
| `npm run typecheck` | ✅ pass | 0 TypeScript errors |
| `npm run lint` | ✅ pass | 0 ESLint warnings |
| `npm run format:check` | ✅ pass | Prettier check passed |
| `npm run test` | ✅ pass | 541 pass / 2 skipped / 0 fail |
| `npx expo-doctor` | ✅ pass | 18/18 checks passed |
| `npm run audit:assets` | ✅ pass | asset audit passed |
| `npm run audit:supabase:static` | ✅ pass | static audit passed; latest release cleanup migration `20260623161000_rls_performance_advisor_cleanup.sql` |
| `npm run check:edge-functions` | ✅ pass | Edge Function static checks passed |
| `npm run security:audit` | ✅ pass | 0 vulnerabilities |
| `npm run security:gitleaks` | ✅ pass | nonignored tracked/untracked scan passed; no leaks found |
| `npm run security:trufflehog` | ✅ pass | scanned ~4.41 GB; 0 verified and 0 unverified secrets |
| `npm run release:ready:local` | ✅ pass | all local-only gates pass |
| Supabase live proof | ✅ pass | linked advisory cleanup applied; non-password Security Advisor passes; Performance Advisor: no issues; full-audit, location, search, RLS, social/gamification, chat, OCR, canonical food-business staging smokes pass |
| iOS simulator build/run | ✅ pass | prepared dev-client smoke on iPhone 17 Pro simulator with LAN Metro |
| iOS prepared smoke | ✅ pass | `npm run smoke:native:ios:prepared` passed chat/activity/media flows |
| PostComposerScreen error boundary | ✅ fixed 2026-06-25 | FeedErrorBoundary added |
| Android permissions | ✅ fixed 2026-06-25 | CAMERA, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_EXTERNAL_STORAGE added to `app.json` |
| Android/EAS proof | ✅ preview artifact pass | `ANDROID_EAS_PROOF=1` means Android preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` finished and an APK artifact exists; it does not prove install/device/internal-track/production readiness |
| Android native/install proof | blocked | `NATIVE_MAESTRO_ANDROID_PROOF=0`; no Android device/emulator install smoke, Play internal-track smoke, or Android production proof attached |
| iOS EAS proof | blocked | no credentials suitable for internal distribution in non-interactive mode |
| Store API credentials | blocked | App Store Connect API key/issuer/key path and Google Play service-account env vars missing |
| Independent QA/QC agent | pass / No-Go upheld | no new repo-local P0 code defect; public launch remains blocked by external proof |
| Production website secret proof | ✅ pass | Vercel production env validation passed; console Basic Auth enforced; deprecated `HUNGRY_CONSOLE_API_TOKEN` removed |
| Production app secret proof | blocked | `PRODUCTION_SECRET_PROOF=0`; EAS/store release environment secret verification not attached |
| Store console proof | blocked | `STORE_CONSOLE_PROOF=0` |
| App Store Connect proof | blocked | `APP_STORE_CONNECT_PROOF=0`; metadata/privacy proof not attached |
| Play Console proof | blocked | `PLAY_CONSOLE_PROOF=0`; metadata/Data Safety proof not attached |
| Store ASO/reviewer/screenshot/policy approvals | blocked | `ASO_METADATA_APPROVAL_PROOF=0`; `REVIEWER_NOTES_APPROVAL_PROOF=0`; `STORE_SCREENSHOT_RIGHTS_PROOF=0`; `STORE_POLICY_CHECKLIST_APPROVAL_PROOF=0` |
| Public privacy/account deletion URL proof | blocked | `PUBLIC_PRIVACY_URL_PROOF=0`; `PUBLIC_ACCOUNT_DELETION_URL_PROOF=0`; owner/store-console URL proof not attached |
| UGC moderation proof | blocked | `UGC_MODERATION_PROOF=0`; full-platform live/report/block/moderation proof not attached |
| Supabase SQL/advisor proof | ✅ pass | legacy RPC cleanup and app-owned RLS performance cleanup applied |
| Supabase leaked-password proof | blocked by plan | Management API returned 402; leaked-password protection requires Supabase Pro or higher |
| Dirty worktree reconciled | blocked | `DIRTY_WORKTREE_RECONCILED=0` |
| SEC-06 runtime proof | blocked | `SEC_06_RUNTIME_PROOF=0` |
| SEC-08 runtime proof | ✅ pass | live multi-user Supabase social/gamification, chat, RLS, storage/OCR, Edge-function smokes passed |
| Merchant portal runtime proof | blocked | `MER_PORTAL_01_RUNTIME_PROOF=0` (not required for launch with `merchantCentreEnabled=false`) |
| Legal/privacy sign-off | blocked | owner/legal proof required |
| App Store metadata | blocked | App Store Connect proof required |
| Play Store metadata | blocked | Play Console proof required |
| Sentry staging crash proof | ✅ pass | `SENTRY_AUTH_TOKEN_2` confirms event access; latest unresolved queue = 0 after resolving four remaining groups |
| Production monitoring proof | blocked | staging Sentry/PostHog rows may stay pass, but `SENTRY_PRODUCTION_SOURCEMAP_PROOF=0`, `RELEASE_TRACKING_PROOF=0`, and `ALERT_ROUTING_PROOF=0`; production source maps, release tracking, and alert routing proof remain pending |
| Website production runtime proof | ✅ pass | Vercel deploy `dpl_G2N1y8tiwePNBQq2ELwD76oESURz` is aliased to `https://usehungry.com`; public routes 200; console routes 401 unauthenticated and 200 with Basic Auth |
| PostHog staging event proof | ✅ pass | `/capture/` HTTP 200 confirmed |
| Rollback rehearsal proof | blocked | `ROLLBACK_REHEARSAL_PROOF=0`; OTA, native binary, and DB rollback rehearsal remains pending |
| VoiceOver/TalkBack smoke | blocked | manual QA proof required |
| Demo account for store review | blocked | owner must provision reviewer credentials |

## Release Evidence Keys

```text
NATIVE_MAESTRO_IOS_PROOF=1
IOS_EAS_PROOF=0
IOS_RELEASE_BUILD_PROOF=0
TESTFLIGHT_SMOKE_PROOF=0
ANDROID_EAS_PROOF=1
NATIVE_MAESTRO_ANDROID_PROOF=0
PRODUCTION_SECRET_PROOF=0
PRODUCTION_WEBSITE_SECRET_PROOF=1
STORE_CONSOLE_PROOF=0
APP_STORE_CONNECT_PROOF=0
PLAY_CONSOLE_PROOF=0
ASO_METADATA_APPROVAL_PROOF=0
REVIEWER_NOTES_APPROVAL_PROOF=0
STORE_SCREENSHOT_RIGHTS_PROOF=0
STORE_POLICY_CHECKLIST_APPROVAL_PROOF=0
PUBLIC_PRIVACY_URL_PROOF=0
PUBLIC_ACCOUNT_DELETION_URL_PROOF=0
SUPABASE_OWNER_PROOF=0
PUSHED_CI_PROOF=0
DIRTY_WORKTREE_RECONCILED=0
SEC_06_RUNTIME_PROOF=0
SEC_08_RUNTIME_PROOF=1
MER_PORTAL_01_RUNTIME_PROOF=0
MERCH_P0_ANALYTICS_PROOF=0
SENTRY_STAGING_CRASH_PROOF=1
SENTRY_PRODUCTION_SOURCEMAP_PROOF=0
POSTHOG_STAGING_PROOF=1
RELEASE_TRACKING_PROOF=0
ALERT_ROUTING_PROOF=0
POST_COMPOSER_ERROR_BOUNDARY=1
ANDROID_PERMISSIONS_COMPLETE=1
UGC_MODERATION_PROOF=0
ROLLBACK_REHEARSAL_PROOF=0
```

## Verdict Rule

- **Go** only when every local gate passes and every external proof key is `1`.
- **Go Candidate** is repo-local only: local gates may be green, but public launch remains blocked until every external proof key is `1`.
- **No-Go** while any P0 local gate fails, dirty-worktree reconciliation is missing, or external proof keys remain `0`.

## P0 Items Remaining

1. Dirty worktree — reconcile and commit/stash before release tag
2. Android install smoke — attach an Android emulator/device and install the finished preview APK
3. iOS EAS preview — configure internal-distribution ASC credentials
4. iOS + Android production build proofs
5. Store-console metadata, Data Safety, privacy labels
6. Legal/privacy sign-off
7. Demo account for store review
8. VoiceOver/TalkBack manual smoke sessions
9. Production monitoring proof — source maps, release tracking, and alert routing
10. Rollback rehearsal proof — OTA, native binary, and DB rollback

## Non-Blocking Pre-Launch Hardening Items

- `useReduceMotion()` hook for 22 unguarded Reanimated animations
- Systematic `accessibilityLabel` pass on primary screen Pressable elements
- Gate 49 KB mock data behind `__DEV__` to exclude from production bundle
- `eas.json submit.production` credentials populated
- Enable OTA updates with `ON_ERROR_RECOVERY` after first stable release
