# Hungry App Monitoring and Rollback Plan

Updated: 2026-06-25
Verdict: **Partial / No-Go**. Repo-local monitoring proof has improved, but public launch remains blocked by production build/source-map proof, release rollback rehearsal, native store-track proof, owner/legal proof, manual accessibility proof, and dirty-worktree reconciliation.

## Monitoring

| Check | Status | Evidence / required action |
|---|---:|---|
| Sentry SDK configured | ✅ source present | `app.json` includes `@sentry/react-native/expo`; `isUsableSentryDsn()` validation hardened in `App.tsx` |
| Sentry DSN validation hardened | ✅ fixed 2026-06-25 | Rejects template strings, `your-` placeholders, and non-sentry.io DSNs |
| Sentry DSN configured | ✅ via EAS Secrets | `EXPO_PUBLIC_SENTRY_DSN` in EAS environment |
| Sentry staging test crash appears | ✅ pass | `SENTRY_STAGING_CRASH_PROOF=1`; `SENTRY_AUTH_TOKEN_2` can read/write events; unresolved queue = 0 (`tasks/verification.md`, `tasks/Roadmap/app-final-go-no-go-checklist.md`) |
| Release tracking configured | pending | Sentry release/env proof from EAS production build required; production release proof is not attached |
| Source maps uploaded | pending | EAS production build with `SENTRY_AUTH_TOKEN` required; production source-map proof remains a blocker |
| Analytics configured | ✅ source present | PostHog sink and scrubber source present |
| PostHog staging event proof | ✅ pass | `POSTHOG_STAGING_PROOF=1`; `/capture/` accepted the release proof event with HTTP 200 (`tasks/verification.md`, `tasks/Roadmap/app-final-go-no-go-checklist.md`) |
| Failed auth/upload/search tracked | partial | verify staging events for each failure path |
| Privacy scrubber active | ✅ source-tested | security tests cover PII/token scrubbing |
| Incident owner | pending | owner assignment required |

## Release Evidence Snapshot

| Evidence key | Status | Scope / local citation |
|---|---:|---|
| `SENTRY_STAGING_CRASH_PROOF=1` | pass | Staging Sentry proof only; production release/source-map proof still pending (`tasks/verification.md`, `tasks/Roadmap/app-final-go-no-go-checklist.md`) |
| `POSTHOG_STAGING_PROOF=1` | pass | Staging event ingestion proof only; failure-path event review remains partial (`tasks/verification.md`, `tasks/Roadmap/app-final-go-no-go-checklist.md`) |
| `POST_COMPOSER_ERROR_BOUNDARY=1` | pass | `PostComposerScreen` error boundary fixed/recorded in final Go/No-Go and screen QC reports (`tasks/Roadmap/app-final-go-no-go-checklist.md`, `tasks/Roadmap/app-screen-qc-checklist.md`) |
| `ANDROID_PERMISSIONS_COMPLETE=1` | pass | Android permission declarations updated and recorded; final binary/store declaration proof still required (`tasks/Roadmap/app-native-build-readiness-report.md`, `tasks/Roadmap/app-screen-qc-checklist.md`) |
| `ANDROID_EAS_PROOF=1` | preview artifact only | Android preview APK build `b04ac43f-9a06-43f9-9f38-709cbc17e418` exists; this does not prove install smoke, internal-track upload, production AAB/APK, or Play release readiness (`tasks/Roadmap/app-native-build-readiness-report.md`) |
| `PRODUCTION_WEBSITE_SECRET_PROOF=1` | pass | Website/Vercel production env validation and console Basic Auth proof only (`tasks/Roadmap/app-final-go-no-go-checklist.md`, `tasks/verification.md`) |
| `PRODUCTION_SECRET_PROOF=0` | blocked | Mobile app production secret/source-map/release evidence remains unproven; do not collapse this into website secret proof (`tasks/release-evidence/full-audit-v1.example.env`, `tasks/verification.md`) |
| `IOS_EAS_PROOF=0` / `TESTFLIGHT_SMOKE_PROOF=0` | blocked | iOS EAS internal-distribution credentials and TestFlight smoke proof are missing (`tasks/Roadmap/app-native-build-readiness-report.md`) |
| `STORE_CONSOLE_PROOF=0` | blocked | App Store Connect / Google Play console evidence, metadata, Data Safety, and privacy-label proof remain pending (`tasks/Roadmap/app-final-go-no-go-checklist.md`) |
| `DIRTY_WORKTREE_RECONCILED=0` | blocked | Dirty-worktree reconciliation remains a release blocker (`tasks/Roadmap/app-final-go-no-go-checklist.md`, `tasks/verification.md`) |

## Rollback

| Check | Status | Evidence / required action |
|---|---:|---|
| EAS Update channel strategy | ✅ present | preview/staging and production channels exist in `eas.json` |
| OTA rollback path | pending | previous stable update republish rehearsal required; OTA currently disabled (`"enabled": false`) |
| OTA enable plan | pending | enable with `checkAutomatically: "ON_ERROR_RECOVERY"` after first stable release |
| Native rollback plan | pending | binary rollback / store phased rollout decision required |
| Database rollback strategy | partial | forward-fix migrations preferred; live rollback proof pending |
| Supabase backups/PITR decision | pending | owner/project plan required |
| Release evidence file | ✅ template present | `tasks/release-evidence/full-audit-v1.example.env` — fill only after proof |
| EAS build rollback rehearsal | pending | identify last known-good build ID before public launch |

## Remaining No-Go Blockers

| Blocker | Status | Required proof |
|---|---:|---|
| Production Sentry release tracking + source maps | pending | EAS production build with `SENTRY_AUTH_TOKEN`, release/env visible in Sentry, and source maps uploaded |
| Rollback rehearsal | pending | OTA republish rehearsal after OTA is enabled or documented binary-only rollback with last known-good build ID |
| iOS EAS/TestFlight | blocked | iOS internal-distribution credentials, EAS artifact, and TestFlight smoke |
| Android install/internal-track/production proof | pending | Install finished preview APK on emulator/device, attach Play internal-track proof, then attach production AAB/APK proof |
| Store console evidence | blocked | App Store Connect and Google Play metadata, reviewer/demo account, Data Safety, and privacy labels |
| Legal/privacy | blocked | Legal/privacy sign-off and public privacy/support/account-deletion proof for final launch packet |
| VoiceOver/TalkBack | blocked | Manual screen-reader smoke sessions; source/accessibility contracts are not enough for final accessibility sign-off |
| Dirty-worktree reconciliation | blocked | Release branch clean/reconciled before tag or public launch |

## Launch Runbook

1. Pass all repo-local release gates (`npm run release:ready:local`).
2. Pass linked Supabase Advisor/smokes (`npm run smoke:supabase-full-audit-v1`).
3. Pass EAS preview build and internal smoke (iOS TestFlight + Android internal track).
4. Pass EAS production build (both platforms).
5. Verify Sentry release, source maps, and staging test crash.
6. Verify public legal/support/account-deletion URLs are reachable.
7. Submit to TestFlight and Play internal track.
8. Rehearse OTA rollback or document binary-only rollback.
9. Confirm release evidence keys:
   - `IOS_EAS_PROOF=1`
   - `ANDROID_EAS_PROOF=1` (preview APK artifact only until install/internal-track/production proof is attached)
   - `IOS_RELEASE_BUILD_PROOF=1`
   - `TESTFLIGHT_SMOKE_PROOF=1`
   - `PRODUCTION_WEBSITE_SECRET_PROOF=1` ✅ (website/Vercel only)
   - `PRODUCTION_SECRET_PROOF=0` (still `0` for mobile production release secrets/source-map proof)
   - `STORE_CONSOLE_PROOF=1`
   - `SENTRY_STAGING_CRASH_PROOF=1` ✅ (already passes)
   - `POSTHOG_STAGING_PROOF=1` ✅ (already passes)
   - `POST_COMPOSER_ERROR_BOUNDARY=1` ✅ (already passes)
   - `ANDROID_PERMISSIONS_COMPLETE=1` ✅ (already passes)
10. Do not public-launch until all proof keys in `tasks/release-evidence/full-audit-v1.env` are `1`.

## Incident Response (from SECURITY.md)

1. **Detect** via Sentry alert, Supabase log, or inbound report.
2. **Contain**: disable affected Edge Function, rotate anon key if suspected leak, rotate service role key immediately on server-side compromise.
3. **Eradicate**: deploy fix, apply migrations, push signed OTA update (when enabled).
4. **Recover**: re-enable traffic, validate from external clean device, monitor error rates 24 hours.
5. **Learn**: blameless post-mortem within 72 hours, update `tasks/lessons.md` and `SECURITY.md`.
6. **Notify**: PII exposure → notify users + PDPC PDPA breach notification within 3 days; EU residents per GDPR Article 33/34.

## Key Contacts

- Security disclosures: `security@hungry.sg` (interim: `tohsh17@gmail.com`)
- Privacy: `privacy@hungry.sg` (to be provisioned before public launch)
- Incident owner: [owner assignment required]
