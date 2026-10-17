# AGENTS.md — Hungry Repository Guide

This file is the stable entrypoint for agents working in the Hungry repository. Keep volatile status out of this file; use the canonical task and verification ledgers instead.

## 1. Required startup sequence

1. Read `README.md` for the current product and repository shape.
2. Read `CLAUDE.md` for execution rules.
3. Read `WORKFLOW.md` for task, verification, and branch governance.
4. Read `tasks/backlog.md` for active work.
5. Read `tasks/verification.md` for current evidence and blockers.
6. Read only the task-specific code, design, data, or roadmap files needed next.

Do not begin broad implementation from archived roadmap documents.

## 2. Current product architecture

Hungry is a Singapore-focused, dish-first food platform with:

- an Expo/React Native iOS and Android app;
- Supabase authentication, database, storage, RPCs, and Edge Functions;
- a bundled, rights-reviewed Excel catalog used only as an authenticated read-only catalog fallback;
- a Next.js public website and merchant/developer web surfaces under `marketing/website/web-v2`;
- merchant, moderation, data-enrichment, QA, and release tooling.

### Mandatory authentication policy

The supported first-use flow is:

```text
Splash → Onboarding → Create Account / Sign In → email verification when required → authenticated app
```

There is no guest mode. MainTabs and app data surfaces must not mount for signed-out, missing-session, invalid-session, or revoked-session states.

### Data-source policy

- Supabase is mandatory for authentication and all shared writes.
- Supabase is the primary catalog source.
- Excel may provide read-only catalog continuity only after a valid Supabase-authenticated session has been restored and a classified catalog network/RPC/release outage occurs.
- Excel must never replace failed authentication, missing production configuration, a revoked session, or a legitimate no-results response.
- Mock providers are development/test-only and must not be selectable in released builds.

## 3. Canonical source map

| Area | Canonical source |
|---|---|
| Active work | `tasks/backlog.md` |
| Verification evidence | `tasks/verification.md` |
| Execution history | `tasks/session-log.md` |
| Lessons | `tasks/lessons.md` |
| Historical roadmap | `tasks/todo.md` and `tasks/Roadmap/Archive/` |
| Product requirements | `tasks/product-context.md` and approved files in `Research/` |
| Repository structure | `docs/repository/REPOSITORY_STRUCTURE.md` |
| App routes | `src/app/navigation/navigationTypes.ts` and navigator files |
| Feature flags | `src/constants/featureFlags.ts` |
| Domain model | `src/types/domain.ts` |
| Service contracts | `src/lib/services/types.ts` |
| Supabase implementation | `src/lib/services/supabase/` and `supabase/` |
| Excel catalog | `src/lib/services/excel/`, generated catalog data, and data scripts |
| Theme | `src/theme/` |
| App tests | `src/**/*.test.ts`, `tests/e2e/`, `.maestro/` |
| Public website | `marketing/website/web-v2/` |
| Design sources | `design/`, `PROJECT_INSTRUCTIONS.md`, `tasks/design-system.md` |

## 4. High-blast-radius paths

Patch these narrowly and run relevant verification:

- `src/app/navigation/`
- `src/store/useSessionStore.ts`
- `src/lib/services/serviceProvider.ts`
- `src/lib/services/supabase/`
- `src/lib/services/catalog/`
- `src/types/domain.ts`
- `src/lib/services/types.ts`
- `src/constants/featureFlags.ts`
- `src/theme/tokens.ts`
- `supabase/migrations/`, `supabase/functions/`, and RLS policies
- `app.config.js`, `app.json`, `eas.json`
- release and security workflows

## 5. Code rules

- Keep TypeScript strict. Avoid `any`; explain unavoidable exceptions.
- Import canonical domain and service types rather than redeclaring them.
- Use `useHungryTheme()` and existing UI primitives; do not hardcode a parallel design system.
- Use Zustand for shared client state. Supabase remains canonical for shared multi-user data.
- Local stores may cache or stage optimistic state, but must not pretend failed backend writes succeeded.
- Keep secrets and service-role credentials out of app/client code.
- Use SecureStore-backed auth persistence for sensitive session material.
- Add dependencies only when existing platform or repository tools cannot solve the requirement.
- Preserve feature flags and role checks at navigation and service boundaries.
- Do not add Unsplash or generic placeholder media to production catalog surfaces.
- Do not edit generated data by hand when a generator or reconciliation script is authoritative.

## 6. Documentation rules

- Keep root documentation limited to stable entrypoints and repository-wide policy.
- Keep active status only in `tasks/backlog.md` and `tasks/verification.md`.
- Put current domain plans under the matching `tasks/Roadmap/<Domain>/` folder.
- Move superseded historical documents to `tasks/Roadmap/Archive/`; do not keep duplicate active copies.
- Store generated logs and reports as CI artifacts or ignored local output unless they are required release evidence.
- Update references when files move or are removed.

## 7. Branch and pull-request rules

- `main` is the integration source of truth.
- Use one branch per active change set and one PR per branch.
- Close superseded chained PRs once their content is merged or reconciled elsewhere.
- Do not merge stale branches simply to preserve history; Git already preserves it.
- Delete merged/superseded branch refs after owner review when repository tooling permits.
- Rebase or update active branches before final verification.

## 8. Verification budget

| Change | Minimum verification |
|---|---|
| Docs/repository organization | link/reference review and diff check |
| Focused component or script | focused test plus typecheck when contracts changed |
| Shared state/navigation/service | focused tests, typecheck, and affected runtime smoke |
| Supabase/security/native/release | full relevant static, integration, native, and external proof gates |

Never describe a skipped or credential-blocked check as a pass.

## 9. Session closeout

For non-trivial work:

- update the relevant row in `tasks/backlog.md`;
- record commands and evidence in `tasks/verification.md`;
- append a concise entry to `tasks/session-log.md`;
- update `tasks/lessons.md` only when a correction or reusable lesson was learned;
- report changed files, verification, and remaining blockers.
