# Observability Runbook

Date: 2026-06-07

## Signals

| Signal | Tool | Threshold |
| --- | --- | --- |
| Mobile crash-free sessions | Sentry | Alert below 99.5% over 1 hour |
| Mobile fatal error spike | Sentry | Alert on 2x baseline or 10 events in 10 minutes |
| Public web 5xx | Vercel/Sentry | Alert above 1% for 5 minutes |
| Supabase API errors | Supabase logs | Alert above 1% by endpoint/RPC |
| Supabase DB latency | Supabase dashboards | Alert when p95 query latency exceeds 750ms on hot paths |
| Edge Function errors | Supabase logs | Alert on 5 failures in 10 minutes |
| Feed/search/detail latency | PostHog/Sentry spans | Alert when p95 exceeds 1000ms in staging/prod |
| Merchant/admin mutation failures | Sentry/Supabase logs | Alert on any sustained failure cluster |

## Privacy Sanitization

- Do not send tokens, emails, phone numbers, exact coordinates, payment details, raw review private metadata, or storage signed URLs to analytics/error tools.
- Sanitizer evidence lives in `src/lib/analytics/privacy.ts` and security contracts.
- Sentry init must remain no-op unless a DSN/environment is configured.

## Dashboards

- Mobile app health: crash-free, fatal errors, boot time, route transition p95.
- Public website health: 5xx, TTFB, static page build status, crawler errors.
- Supabase health: RPC p95, row counts, failed auth/RLS attempts, Edge Function failures.
- Merchant/admin health: mutation success rate, verification queue age, audit-log volume.
- Product usage: search, discovery, detail open, post publish, review submit, save/favourite.

## Triage Flow

1. Confirm whether issue is mobile, website, Supabase, storage, or third-party.
2. Check recent deploy/OTA/migration changes.
3. Check Sentry issue, Supabase logs, and Vercel deployment logs.
4. Apply feature-flag rollback when possible.
5. If data integrity or security is involved, escalate as SEV-1 or SEV-2.
6. Record incident timeline and follow-up tasks.

## Error Tracking and Alerts (2026-10-22)

- App: `react-native` Sentry project, `EXPO_PUBLIC_SENTRY_DSN`; `reportError` in `src/lib/monitoring/reportError.ts`.
- Edge Functions: `edge-functions` Sentry project, DSN set as the Supabase function secret `SENTRY_DSN` (`supabase secrets set SENTRY_DSN=... --project-ref yrlxjeovwslirseajomz`), then redeploy the functions. Optional `APP_ENV` secret sets the Sentry environment (default `production`). Without the secret the wrapper does nothing.
- Edge events carry only the error, stack, and tags (`function`, `region`, `execution_id`); request, user, tokens, and emails are stripped (`_shared/sentryScrub.ts`). 5xx responses are reported as `<function> responded <status>: <error code>`.
- Alert: Sentry alert "New issue (app and Edge Functions) - email sh" emails on the first event of any new issue in either project. Sentry can only email members of the organisation, so it goes to the account owner's Sentry login, not the support inbox.
- CI contract: `src/lib/monitoring/error-reporting-contracts.test.ts`.

## Remaining Proof

- Production/staging Sentry DSN verification.
- Test event with sanitized payload.
- Dashboard links and owner rotation.
- Alert delivery channel proof.
