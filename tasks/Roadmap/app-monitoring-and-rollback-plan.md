# Hungry App Monitoring And Rollback Plan

Updated: 2026-06-19
Verdict: **Partial / No-Go** until monitoring is verified in staging and release rollback is rehearsed.

## Monitoring

| Check | Status | Evidence / required action |
|---|---:|---|
| Sentry SDK configured | source present | `app.json` includes `@sentry/react-native/expo` |
| Sentry DSN configured | pending | EAS/secret proof required |
| Staging test crash appears | pending | capture issue URL or screenshot |
| Release tracking configured | pending | Sentry release/env proof required |
| Source maps uploaded | pending | EAS/Sentry build proof required |
| Analytics configured | source present | PostHog sink and scrubber source present |
| Failed auth/upload/search tracked | partial | verify staging events |
| Privacy scrubber active | source-tested | security tests cover scrubbing |
| Incident owner | pending | owner assignment required |

## Rollback

| Check | Status | Evidence / required action |
|---|---:|---|
| EAS Update channel strategy | present | preview/staging and production channels exist in `eas.json` |
| OTA rollback path | pending | previous stable update republish rehearsal |
| Native rollback plan | pending | binary rollback/store phased rollout decision |
| Database rollback strategy | partial | forward-fix migrations preferred; live rollback proof pending |
| Supabase backups/PITR decision | pending | owner/project plan required |
| Release evidence file | present template | fill only after proof |

## Launch Runbook

1. Pass repo-local release gates.
2. Pass linked Supabase Advisor/smokes.
3. Pass EAS preview build and internal smoke.
4. Pass EAS production build.
5. Verify Sentry release, source maps, and staging test crash.
6. Verify public legal/support/account-deletion URLs.
7. Submit to TestFlight and Play internal track.
8. Rehearse OTA rollback or document binary-only rollback.
9. Do not public-launch until all proof keys in `tasks/release-evidence/full-audit-v1.env` are `1`.
