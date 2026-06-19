# Release Rollout And Rollback Plan

Date: 2026-06-07

## Rollout Phases

1. Repo-local gates: typecheck, lint, format, tests, scaling scaffold validation, static Supabase, Edge, assets, release checklist.
2. Staging deploy: website preview, Supabase staging dry run, mobile preview/OTA channel.
3. Staging smoke: guest browse, auth, feed, search, detail, post, review, favourite, merchant/admin guards.
4. Read-only load smoke: public website, discovery, search, detail.
5. Limited beta: invite-only accounts, monitored with Sentry/Supabase/Vercel dashboards.
6. Public launch: only after external blockers are cleared.

## Rollback

| Surface | Rollback action |
| --- | --- |
| Mobile OTA | Publish previous known-good update to preview/production channel |
| Native build | Halt rollout in App Store Connect / Play Console; ship hotfix build if needed |
| Public website | Revert Vercel deployment to previous known-good deployment |
| Supabase migration | Prefer forward-fix migration; destructive rollback requires owner approval |
| Feature flag | Disable advanced or risky surface at env/config level |
| Edge Function | Revert function deployment or disable route if safe |

## No-Go Conditions

- Production advanced feature flags enabled without approval.
- Live RLS smoke fails.
- Security Advisor reports unexpected app-owned critical/warn findings.
- Public website emits fake structured data or indexes private routes.
- Merchant/admin mutation route lacks server-side auth/RBAC.
- Crash/error rate crosses launch thresholds in staging.

## Required Evidence Before Public Launch

- Android/EAS proof.
- Live Supabase staging smoke.
- Production observability proof.
- Owner-approved legal/privacy/security sign-off.
- Load-test results from staging, not production.
