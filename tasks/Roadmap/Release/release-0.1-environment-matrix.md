# Hungry Release 0.1 Environment Matrix

Updated: 2026-07-24

## Rules

- Never place secret values in source, prompts, screenshots, issue bodies, or audit files.
- `EXPO_PUBLIC_*` values are client-visible and must not contain privileged credentials.
- Supabase service-role keys remain server/CI-only.
- Internal alpha and preview use staging services.
- Production uses production services.
- Missing staging/production Supabase public configuration blocks app entry; it must not select Excel as the application provider.
- Excel is available only after a valid restored Supabase session and only for eligible catalog-read failures.

## Matrix

| Concern | Development | Internal alpha | Preview/staging | Production |
|---|---|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | `development` | `staging` | `staging` | `production` |
| Supabase project | local/dev or staging | staging | staging | production |
| `EXPO_PUBLIC_HUNGRY_DATA_SOURCE` | selectable for dev/test | `supabase` | `supabase` | `supabase` |
| Catalog V2 | local opt-in | enabled | enabled | enabled |
| Catalog diagnostics UI | enabled | enabled | enabled | disabled by default |
| Deferred feature flags | available for development | all off | all off unless one focused QA override | all off |
| Distribution | local/dev client | EAS internal | EAS internal/TestFlight/Play internal | stores |
| Test data | fixtures/staging | staging | staging | production-only validated data |
| Destructive writes | local only unless approved | prohibited by default | controlled/approved only | production operations only |

## Release 0.1 client-visible variables

Required public names by environment:

```text
EXPO_PUBLIC_APP_ENV
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_HUNGRY_DATA_SOURCE
EXPO_PUBLIC_CATALOG_READ_V2
EXPO_PUBLIC_SENTRY_DSN              # when configured
EXPO_PUBLIC_POSTHOG_API_KEY         # when configured
```

Release 0.1 scope locks:

```text
EXPO_PUBLIC_ENABLE_SOCIAL_FEED=0
EXPO_PUBLIC_ENABLE_POSTS=0
EXPO_PUBLIC_ENABLE_REVIEWS=0
EXPO_PUBLIC_ENABLE_ACTIVITY=0
EXPO_PUBLIC_ENABLE_READS=0
EXPO_PUBLIC_ENABLE_MAP=0
EXPO_PUBLIC_ENABLE_WHEEL=0
EXPO_PUBLIC_ENABLE_CRAVE=0
```

## Server/CI-only secret names

Configure through GitHub environments, EAS secrets, Supabase, Sentry, and store consoles as appropriate:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF_STAGING
SUPABASE_PROJECT_REF_PRODUCTION
SUPABASE_DB_PASSWORD_STAGING
SUPABASE_DB_PASSWORD_PRODUCTION
SUPABASE_SERVICE_ROLE_KEY_STAGING
SUPABASE_SERVICE_ROLE_KEY_PRODUCTION
EXPO_TOKEN
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
```

Do not add server-only values to `EXPO_PUBLIC_*` variables.

## Required owner proof

| Platform | Development | Staging/internal alpha | Production | Evidence |
|---|---:|---:|---:|---|
| Supabase | [ ] | [ ] | [ ] | Project refs and configured secret names, no values |
| EAS | [ ] | [ ] | [ ] | Environment/profile screenshot or sanitized export |
| GitHub Actions | [ ] | [ ] | [ ] | Environment/secret-name list and protection status |
| Sentry | [ ] | [ ] | [ ] | Project/release/source-map proof |
| PostHog/analytics | [ ] | [ ] | [ ] | Project and event proof |
| App Store Connect | n/a | [ ] | [ ] | Reviewer access/build proof |
| Play Console | n/a | [ ] | [ ] | Internal-test/build proof |

## Build commands

```bash
# Internal tester build
eas build --profile internal-alpha --platform ios
eas build --profile internal-alpha --platform android

# Broader staging candidate
eas build --profile preview --platform all

# Do not run until every P0 release gate passes
eas build --profile production --platform all
```

## Failure expectations

| Failure | Expected app behavior |
|---|---|
| Missing released-build Supabase URL/key | Blocking service/configuration state |
| Auth unavailable | Stay in auth; retry/support state |
| Signed out | Auth only; no Excel catalog access |
| Invalid/revoked session | Clear account state; auth only |
| Auth healthy, catalog RPC/network unavailable | Authenticated read-only Excel catalog |
| Successful catalog query with zero matches | No-results state |
| Supabase write unavailable | Clear unavailable/retry state; no false success |
