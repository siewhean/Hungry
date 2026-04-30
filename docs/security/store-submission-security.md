# Store Submission Security Review

Date: 2026-04-30
Scope: Hungry mobile app, Supabase backend, and mobile release evidence. Web app implementation is excluded.

## Official Policy Sources

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion guidance: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Developer Program policy, UGC section: https://support.google.com/googleplay/android-developer/answer/16070163

## Implemented Controls

| Requirement | Store policy driver | Repo evidence |
|---|---|---|
| Privacy policy/support links are available in-app | Apple 5.1.1; Google User Data privacy policy | `src/app/screens/profile/SettingsScreen.tsx`, `src/lib/security/safeLinking.ts` |
| Account deletion can be initiated in-app and creates backend evidence | Apple account deletion guidance; Google account deletion requirement | `src/app/screens/profile/SettingsScreen.tsx`, `src/lib/services/supabase/supabaseService.ts`, `supabase/migrations/0017_store_policy_safety_controls.sql` |
| UGC reviews have report and block affordances | Apple 1.2; Google UGC policy | `src/lib/security/communitySafety.ts`, review feed screens, stall detail reviews |
| UGC moderation reports and user blocks are protected by RLS | Apple data security 1.6; Google secure handling | `supabase/migrations/0017_store_policy_safety_controls.sql`, `supabase/smoke/store_policy_safety_controls.sql` |
| Location permission has a clear in-app disclosure before runtime permission | Apple 5.1.1(ii); Google prominent disclosure/consent | `src/app/screens/onboarding/LocationPermissionScreen.tsx` |
| Release build does not declare local-network development access | Apple data minimization and purpose strings | `app.json` |
| Security regression tests cover store-policy controls | Release gate evidence | `src/lib/security/security-hardening.test.ts` |

## Remaining Store-Console / Owner Items

- `SEC-01`: Supabase leaked-password protection remains blocked until a paid plan is available.
- `PRIV-01`: Public privacy policy URL must be reachable and linked in App Store Connect and Play Console.
- `PLAY-01`: Play Data Safety answers must match actual data collection, sharing, deletion, and security practices.
- `APPLE-02`: App Store metadata, screenshots, review notes, and demo account/full demo mode must be completed.
- External account deletion web URL must be submitted in Play Console and be reachable without reinstalling the app.

## Readiness Verdict

No-Go for public App Store / Play Store submission until external privacy/deletion URLs, store metadata, Play Data Safety, SEC-01, and staging/manual smoke evidence are completed. Repo-side mobile security controls for account deletion initiation, UGC safety, location disclosure, and mobile storage are implemented.
