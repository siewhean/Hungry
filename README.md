# Hungry

Hungry is a Singapore-focused, dish-first food platform. The repository contains the Expo/React Native consumer app, Supabase backend assets, the public and merchant web workspace, data-enrichment pipelines, automated QA, and release operations.

## Product rule

The supported app entry flow is:

```text
Splash → Onboarding → Create Account / Sign In → email verification when required → authenticated app
```

Hungry does not support guest mode. Main app routes and catalog surfaces require authentication.

Supabase is mandatory for authentication and shared writes. The bundled Excel catalog may be used only as a read-only catalog fallback for an already authenticated user during an eligible catalog network/RPC/release outage. It must not bypass authentication, missing production configuration, a revoked session, or a legitimate no-results response.

## Repository map

| Area | Path |
|---|---|
| Mobile app | `src/`, `App.tsx`, `app.config.js`, `app.json`, `eas.json` |
| App navigation and auth | `src/app/navigation/`, `src/store/useSessionStore.ts`, `src/hooks/useAppBootstrap.ts` |
| Supabase client services | `src/lib/services/supabase/` |
| Catalog services and Excel fallback | `src/lib/services/catalog/`, `src/lib/services/excel/` |
| Database, RLS, functions, smoke SQL | `supabase/` |
| App tests | `src/**/*.test.ts`, `tests/e2e/`, `.maestro/` |
| Public/merchant website | `marketing/website/web-v2/` |
| Legacy website workspace | `marketing/web/` — retain only until its remaining dependencies are removed |
| Canonical data and pipelines | `data/`, `scripts/` |
| Product/design sources | `Research/`, `design/`, `PROJECT_INSTRUCTIONS.md` |
| Active task state | `tasks/backlog.md` |
| Verification evidence | `tasks/verification.md` |
| Execution history | `tasks/session-log.md` |
| Repository organization policy | `docs/repository/REPOSITORY_STRUCTURE.md` |

## Technology

| Layer | Choice |
|---|---|
| Mobile | Expo SDK 55, React Native 0.83, TypeScript |
| Navigation | React Navigation 7 |
| Client state | Zustand |
| Forms | React Hook Form |
| Media | Expo Image, Image Picker, Video |
| Maps | Mapbox through `@rnmapbox/maps` |
| Backend | Supabase Auth, Postgres, Storage, RPCs, Edge Functions |
| Monitoring | Sentry; PostHog where enabled |
| Web | Next.js in `marketing/website/web-v2` |
| UI tests | Node source contracts, Playwright, Maestro |
| Data | Canonical workbook, generated runtime catalog, Supabase release catalog |

## Setup

```bash
npm install
npm run start
```

Native development:

```bash
npm run ios
npm run android
```

Do not commit local environment values. Use the checked-in example files and owner-controlled GitHub, EAS, Vercel, and Supabase environment configuration.

## Core verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:e2e
npx expo-doctor --non-interactive
npm run audit:assets
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
npm run release:ready:local
```

Credential-backed checks and native/store proof are separate release gates. A skipped check is not a pass.

## Data and Supabase checks

```bash
npm run data:excel:validate
npm run data:excel:audit
npm run smoke:database:location
npm run smoke:database:search
npm run smoke:database:rls
```

With staging credentials:

```bash
npm run smoke:supabase-canonical-food-business-staging
npm run smoke:supabase-full-audit-v1
```

## Source-of-truth hierarchy

1. Approved product/design source for the requested feature.
2. Current application and database code.
3. `tasks/backlog.md` for active task status.
4. `tasks/verification.md` for evidence.
5. `tasks/session-log.md` for chronological history.
6. `tasks/todo.md` and `tasks/Roadmap/Archive/` for historical context only.

Do not use old audit reports or archived roadmaps as current implementation requirements without reconciling them against code and the active backlog.

## Branch policy

- `main` is the integration source of truth.
- Keep one active branch and one PR per change set.
- Close superseded chained or duplicate PRs once their work is merged or reconciled.
- Rebase or update active branches before final verification.
- Remove merged/superseded branch refs after owner review when tooling permits.

## Current release posture

Repository-local implementation and verification have advanced substantially, but production remains **No-Go** until the current active branches pass automated checks, linked Supabase proof, iOS and Android native QA, store-console requirements, monitoring proof, and legal/privacy sign-off. Consult `tasks/backlog.md` and `tasks/verification.md` rather than relying on a static status paragraph here.

## Agent entrypoints

- `AGENTS.md` — repository rules and current architecture
- `CLAUDE.md` — concise execution behavior
- `WORKFLOW.md` — task, verification, and branch operating model
