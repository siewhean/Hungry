# Hungry App Security And Privacy QC Report

Updated: 2026-06-19
Verdict: **Partial / No-Go for public launch** until live Supabase, store-console, legal, and monitoring proof is complete.

## Source Evidence

| Area | Evidence | Status |
|---|---|---|
| Auth token storage | `src/lib/services/supabase/authStorage.ts` | SecureStore-backed chunked storage; plaintext fallback guarded |
| Session metadata | `src/store/useSessionStore.ts` | No Supabase refresh/access tokens in Zustand persist |
| Account cleanup | `useSessionStore.signOut`, `clearSession` | Clears account-scoped stores and profile |
| Account deletion | `SettingsScreen.tsx`, `supabase/functions/process-account-deletions` | Queue path exists; live processing proof pending |
| Analytics privacy | `src/lib/analytics/privacy.ts`, `security-hardening.test.ts` | PII/token scrubbing source-tested |
| Media upload validation | `src/lib/services/supabase/mediaUpload.ts` | MIME/signature/size validation source-tested |
| Deep link safety | `src/app/navigation/linking.ts` | Unsafe params rejected, protected links redirect |
| Service-role exposure | `SECURITY.md`, static scans | App source should not include service-role keys |
| UGC safety | `communitySafety` service and Supabase tests | Source-backed for reports/blocks; social surfaces remain production-gated where incomplete |

## P0 Gaps

| Gap | Risk | Owner | Required fix/proof |
|---|---|---|---|
| Dirty worktree | unreviewed changes in release candidate | Engineering | reconcile and commit/stash intentionally |
| Live RLS/storage smoke missing | private data leakage could go undetected | Engineering/Ops | linked multi-user smoke with service-role opt-in |
| Supabase Advisor owner proof missing | live security findings may remain | Owner/Ops | dashboard/support actions and Advisor rerun |
| Public privacy/account-deletion proof missing | store rejection risk | Owner/Web/Ops | reachable URLs and policy consistency proof |
| App Store/Play metadata missing | store rejection risk | Owner | screenshots, labels, Data Safety, demo notes |
| Sentry staging crash proof missing | no production incident visibility | Engineering/Ops | staging crash event, release, source maps |

## Required Checks

- `npm run audit:supabase:static`
- `npm run check:edge-functions`
- `npm run security:audit`
- `npm run security:gitleaks`
- `npm run security:trufflehog`
- `npm run audit:supabase:advisor-security:non-password` when linked credentials are available.
- `npm run smoke:supabase-full-audit-v1` when linked credentials are available.
- `npm run smoke:supabase-social-gamification` when linked credentials are available.

## Privacy And Store Alignment

- Data collection and retention must match privacy policy and store forms.
- Account deletion must be discoverable in-app and on the web.
- Location/media use must match iOS/Android permission copy.
- Public UGC requires report/block/moderation and support escalation.
- Analytics/crash logs must avoid PII and token capture.
