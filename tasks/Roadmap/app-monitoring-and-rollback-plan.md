# Hungry App Monitoring and Rollback Plan

Updated: 2026-06-25
Verdict: **Partial / No-Go** until monitoring is verified in staging and release rollback is rehearsed.

## Monitoring

| Check | Status | Evidence / required action |
|---|---:|---|
| Sentry SDK configured | ✅ source present | `app.json` includes `@sentry/react-native/expo`; `isUsableSentryDsn()` validation hardened in `App.tsx` |
| Sentry DSN validation hardened | ✅ fixed 2026-06-25 | Rejects template strings, `your-` placeholders, and non-sentry.io DSNs |
| Sentry DSN configured | ✅ via EAS Secrets | `EXPO_PUBLIC_SENTRY_DSN` in EAS environment |
| Sentry staging test crash appears | ✅ pass | `SENTRY_AUTH_TOKEN_2` can read/write events; 28 release/smoke/proof groups resolved; unresolved queue = 0 |
| Release tracking configured | pending | Sentry release/env proof from EAS production build required |
| Source maps uploaded | pending | EAS production build with `SENTRY_AUTH_TOKEN` required |
| Analytics configured | ✅ source present | PostHog sink and scrubber source present |
| PostHog staging event proof | ✅ pass | `/capture/` accepted `hungry_release_proof_event` with HTTP 200 |
| Failed auth/upload/search tracked | partial | verify staging events for each failure path |
| Privacy scrubber active | ✅ source-tested | security tests cover PII/token scrubbing |
| Incident owner | pending | owner assignment required |

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
   - `ANDROID_EAS_PROOF=1`
   - `IOS_RELEASE_BUILD_PROOF=1`
   - `TESTFLIGHT_SMOKE_PROOF=1`
   - `PRODUCTION_SECRET_PROOF=1`
   - `STORE_CONSOLE_PROOF=1`
   - `SENTRY_STAGING_CRASH_PROOF=1` ✅ (already passes)
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
