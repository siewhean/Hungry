# Mobile Scaling QA Report

Date: 2026-06-07

## Mobile Scaling Targets

- Cold start renders the app shell without blocking on non-critical work.
- Primary tabs switch without evaluating heavy routes unnecessarily.
- Media uploads validate file type/size and use signed/private storage where required.
- Offline and timeout states show retryable UI, not silent failure.
- Supabase shared data hydrates on auth/app start and clears on sign-out/user switch.
- Sentry is gated by DSN/env and sanitizes events before transport.

## Repo-Local Evidence

- Production feature flags hide advanced heavy surfaces.
- Route registration uses lazy `getComponent` for non-critical surfaces.
- Media upload and security sanitizer contracts exist in source tests.
- Release gates include `npm run typecheck`, `npm run test`, `npm run audit:assets`, `npm run check:edge-functions`, and Expo Doctor.

## Manual QA Matrix

| Surface | Checks |
| --- | --- |
| Auth | cold start, sign-in, sign-out to Login, no private back navigation |
| Home | refresh, feed pagination, followed-first ordering, media load fallback |
| Discover/Search | bounded reads, empty state, detail navigation, image loading |
| Detail | not-found state, honest ratings/hours, protected action redirect |
| Create/Review | auth requirement, media picker, write rollback, cross-account visibility |
| Profile/Settings | account-scoped hydration, cache clear, privacy/taste/dietary persistence |

## Remaining Blockers

- Fresh Android/EAS proof.
- Live iOS/Android staging smoke with approved accounts.
- Production Sentry DSN and test-event proof.
- Real device media upload proof across network interruption.
