# Hungry App Security and Privacy QC Report

Updated: 2026-06-25
Verdict: **Partial / No-Go for public launch** until live Supabase, store-console, legal, and monitoring proof is complete.

## Source Evidence

| Area | Evidence | Status |
|---|---|---|
| Auth token storage | `src/lib/services/supabase/authStorage.ts` | SecureStore-backed chunked storage; plaintext fallback guarded ✅ |
| Session metadata | `src/store/useSessionStore.ts` | No Supabase refresh/access tokens in Zustand persist ✅ |
| Account cleanup | `useSessionStore.signOut`, `clearSession` | Clears account-scoped stores and profile ✅ |
| Account deletion | `SettingsScreen.tsx`, `supabase/functions/process-account-deletions` | Queue path exists; live processing proof pending |
| Analytics privacy | `src/lib/analytics/privacy.ts`, `security-hardening.test.ts` | PII/token scrubbing source-tested ✅ |
| Media upload validation | `src/lib/services/supabase/mediaUpload.ts` | MIME/signature/size validation source-tested ✅ |
| Deep link safety | `src/app/navigation/linking.ts` | Unsafe params rejected, protected links redirect ✅ |
| Service-role exposure | `SECURITY.md`, static scans | App source does not include service-role keys ✅ |
| UGC safety | `communitySafety` service and Supabase tests | Source-backed for reports/hide/block; focused contracts passed 2026-06-25 ✅ |
| Error boundary — Post composer | `PostComposerScreen.tsx` | **Fixed 2026-06-25** — FeedErrorBoundary added ✅ |
| Android camera permissions | `app.json` | **Fixed 2026-06-25** — CAMERA, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_EXTERNAL_STORAGE added ✅ |
| Sentry DSN validation | `App.tsx` `isUsableSentryDsn()` | Hardened to reject placeholder/invalid DSN strings ✅ |
| Sentry unresolved issues | External Sentry dashboard | Cleared 28 release/smoke groups; unresolved queue = 0 ✅ |
| PostHog analytics | `src/lib/analytics/posthogSink.ts` | Staging event proof pass ✅ |

## Key Security Controls Verified

### Client Storage
- Supabase auth tokens: SecureStore-backed chunked adapter, never AsyncStorage in production ✅
- Legacy AsyncStorage migration: one-shot migration on first read, deletes old value ✅
- Zustand persist: no credentials or tokens in any store slice ✅

### Networking
- iOS ATS: `NSAllowsArbitraryLoads=false` ✅
- Android: platform HTTPS trust store ✅
- All API calls: HTTPS only ✅
- No HTTP fallback or downgrade ✅

### Backend
- RLS: 127 tables confirmed enabled ✅
- No anon write policies ✅
- Signed upload URLs only ✅
- Magic byte validation on all uploads ✅
- MIME allowlist enforced ✅
- Edge functions: API-key protected, JWT-verified, rate-limited ✅

### Secrets
- `SUPABASE_SERVICE_ROLE_KEY` never has `EXPO_PUBLIC_` prefix ✅
- `MAPBOX_SECRET_TOKEN` server-only ✅
- gitleaks + trufflehog in CI ✅
- 0 npm vulnerabilities ✅
- Historical `.env.local` leak acknowledged; credentials rotated ✅

## Accepted Risk

| Item | Risk | Acceptance | Follow-up |
|---|---|---|---|
| Supabase Auth leaked-password dashboard protection | Users can choose passwords found in breach corpuses until the dashboard feature is enabled | Owner accepted as a documented release-candidate risk on 2026-06-25 because the Management API returned 402 on the current Supabase plan | Upgrade to Supabase Pro or higher, enable leaked-password protection, and rerun auth/security proof before broad public launch scale-up |

## P0 Security Gaps

| Gap | Risk | Owner | Required fix/proof |
|---|---|---|---|
| Live RLS/storage reviewer cross-device proof | service-role smoke passed; reviewer/staging account proof needed | Engineering/Ops | attach reviewer/staging account smoke evidence |
| Public privacy/account-deletion URL | store rejection risk | Owner/Web/Ops | reachable URLs and policy consistency proof |
| App Store/Play metadata | store rejection risk | Owner | screenshots, labels, Data Safety, demo notes |
| Biometric re-auth for destructive actions | medium hardening item | Engineering | pre-launch hardening task |

## Required Checks (Current Pass Status)

| Command | Status |
|---|---|
| `npm run audit:supabase:static` | ✅ pass |
| `npm run check:edge-functions` | ✅ pass |
| `npm run security:audit` | ✅ pass (0 vulnerabilities) |
| `npm run security:gitleaks` | ✅ pass (no staged leaks) |
| `npm run security:trufflehog` | ✅ pass (0 verified secrets) |
| `npm run audit:supabase:advisor-security:non-password` | ✅ pass (live Supabase, app-owned advisories clean) |
| `npm run smoke:supabase-full-audit-v1` | ✅ pass (live Supabase credentials) |
| `npm run smoke:supabase-social-gamification` | ✅ pass (live Supabase credentials) |

## Privacy and Store Alignment

- Data collection and retention must match privacy policy and store forms — pending owner review
- Account deletion discoverable in-app (Settings → Delete Account) and on web (pending URL)
- Location/media use matches iOS/Android permission copy ✅
- Public UGC requires report/block/moderation — present in source, disabled in production until full moderation proof ✅
- Analytics/crash logs avoid PII and token capture — source-tested ✅
