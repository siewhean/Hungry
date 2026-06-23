# App Route Feature Flag QC Report

Updated: 2026-06-21  
Status: **Repo-local contracts in place; external native/deep-link proof pending.**

## Production Rule

Production must not expose advanced surfaces unless the feature is launch-approved and has policy/security/native proof.

| Surface | Production default | Required proof before enabling |
|---|---:|---|
| DeveloperLauncher / DesignGallery / prototypes | off | never for public store binary |
| Merchant centre | off | merchant RBAC, outlet isolation, native smoke, store notes |
| Direct messages / chat | off | realtime, report/block, abuse moderation |
| Stories/comments | off | UGC moderation, reporting, blocking, admin queue |
| Passport/gamification | off | data-backed copy, no misleading claims |
| Collections/floorplans | off | data correctness and route smoke |
| OAuth providers | off | Apple-equivalent login and callback proof |
| Admin/dev routes | off/private | server-side guard and non-admin denial proof |

## Required Tests

- `src/app/navigation/route-production-readiness.test.ts`
- `src/app/production-readiness-contracts.test.ts`
- `tests/e2e/production-route-gating.spec.ts`
- New prelaunch contracts in `src/app/app-store-prelaunch-contracts.test.ts`

## Remaining Proof

- Native deep-link attempts from installed iOS/Android builds.
- Notification payload route-open attempts for protected/disabled routes.
- Store build generated with `EXPO_PUBLIC_APP_ENV=production`.

