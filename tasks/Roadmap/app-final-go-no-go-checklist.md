# Hungry App Final Go / No-Go Checklist

Updated: 2026-06-19
Production status: **No-Go**

## Required Gates

| Gate | Status | Notes |
|---|---:|---|
| `npm run typecheck` | pass | passed inside `npm run release:ready:local` before Supabase Advisor gate |
| `npm run lint` | pass | local ESLint gate passed |
| `npm run format:check` | pass | `src/` Prettier check passed |
| `npm run test` | pass | passed inside `npm run release:ready:local`: 521 total, 519 pass, 2 skipped |
| `EXPO_NO_DOTENV=1 CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` | pass | 18/18 checks passed |
| `npm run audit:assets` | pass | asset audit passed |
| `npm run audit:supabase:static` | pass | static audit passed; latest migration is `20260619110000_release_advisor_security_cleanup.sql` |
| `npm run check:edge-functions` | pass | Edge Function static checks passed |
| `npm run security:audit` | pass | 0 vulnerabilities |
| `npm run security:gitleaks` | pass | no staged leaks found |
| `npm run security:trufflehog` | pass | 0 verified and 0 unverified secrets; temp cleanup warning only |
| `git diff --check` | pass | whitespace check passed |
| `npm run release:ready:local` | blocked | linked Supabase Advisor still reports app-owned findings because pending migrations are not applied remotely |
| Supabase dry-run | pass / blocked remotely | `supabase db push --dry-run` would apply four pending migrations, including the release Advisor cleanup; no production mutation performed |
| iOS simulator build/run | partial | Prepared dev-client smoke now runs against a booted iPhone 17 Pro simulator and LAN Metro; full Xcode release build proof still pending |
| iOS prepared smoke | pass | `npm run smoke:native:ios:prepared` passed after LAN Metro startup and Expo dev-client onboarding handling |
| Android/EAS proof | blocked | Prior Android preview build errored on missing Mapbox Maven config; source fix added. Fresh EAS upload/build requires explicit owner approval because it uploads the workspace to Expo |
| Independent QA/QC agent | pass / No-Go upheld | QA/QC found no new repo-local P0 code defect, but confirmed public launch remains blocked by external proof and dirty worktree |
| Production secret proof | blocked | PRODUCTION_SECRET_PROOF=0 |
| Store console proof | blocked | STORE_CONSOLE_PROOF=0 |
| Supabase owner proof | blocked | SUPABASE_OWNER_PROOF=0 |
| Pushed CI proof | blocked | PUSHED_CI_PROOF=0 |
| Dirty worktree reconciled | blocked | DIRTY_WORKTREE_RECONCILED=0 |
| SEC-06 runtime proof | blocked | SEC_06_RUNTIME_PROOF=0 |
| SEC-08 runtime proof | blocked | SEC_08_RUNTIME_PROOF=0 |
| Merchant portal runtime proof | blocked | MER_PORTAL_01_RUNTIME_PROOF=0 |
| Merchant analytics proof | blocked | MERCH_P0_ANALYTICS_PROOF=0 |
| Legal/privacy sign-off | blocked | owner/legal proof required |
| App Store metadata | blocked | App Store Connect proof required |
| Play Store metadata | blocked | Play Console proof required |
| Sentry staging crash proof | blocked | monitoring proof required |

## Release Evidence Keys

```text
IOS_PREPARED_SMOKE_PROOF=1
IOS_EAS_PROOF=0
IOS_RELEASE_BUILD_PROOF=0
TESTFLIGHT_SMOKE_PROOF=0
ANDROID_EAS_PROOF=0
PRODUCTION_SECRET_PROOF=0
STORE_CONSOLE_PROOF=0
SUPABASE_OWNER_PROOF=0
PUSHED_CI_PROOF=0
DIRTY_WORKTREE_RECONCILED=0
SEC_06_RUNTIME_PROOF=0
SEC_08_RUNTIME_PROOF=0
MER_PORTAL_01_RUNTIME_PROOF=0
MERCH_P0_ANALYTICS_PROOF=0
```

## Verdict Rule

- **Go** only when every local gate passes and every external proof key is `1`.
- **Go Candidate** only when repo-local gates pass and the only remaining blockers are owner/store-console items with scheduled proof.
- **No-Go** while any P0 local gate fails, dirty-worktree reconciliation is missing, or external proof keys remain `0`.
