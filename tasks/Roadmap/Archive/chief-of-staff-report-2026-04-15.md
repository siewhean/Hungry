# Chief of Staff Report — Hungry App
**Audit Date:** 2026-04-15 | **Auditor:** Claude (Sonnet 4.6) | **Branch:** `claude/research-food-app-monetization-HTYoi`

---

## Executive Summary

The Hungry app has a **solid architectural skeleton** and a **clean service-abstraction pattern**, but is being undermined by three systemic failures: (1) absent developer tooling — no linter, no formatter, no pre-commit hooks; (2) three confirmed dead files cluttering the screen directory and reducing AI agent navigability; (3) error boundary coverage at 2 of 69 screens, meaning any uncaught exception on auth, detail, profile, or discover screens crashes the full app.

The backlog (`tasks/todo.md`) is in reasonable shape for sprint work but missing the new TOOL/DEAD/ERR items discovered by this audit, and the session log is 10 days stale.

**Scorecard:**

| Dimension | Grade | Top Issue |
|-----------|-------|-----------|
| Code correctness | B | TypeScript passes; AUD-01–09 are debt not breakage |
| Tooling maturity | D | No ESLint, Prettier, or pre-commit hooks |
| Test coverage | D+ | 1.1% (~279 lines / 24,649 production lines) |
| Error boundary coverage | D | 2 / 69 screens protected |
| Architecture | B+ | Service provider pattern is clean; Supabase plan is solid |
| Folder structure | B | 3 dead files; otherwise well-organized and agent-digestible |
| Documentation | A- | Harness docs are accurate and comprehensive |
| Production readiness | D | No linting, no broad error boundaries, no Supabase code |

---

## Phase 1 — Repo Audit

### 1.1 Dead Code & Redundant Files

**Confirmed dead — delete with zero risk:**

| File | Evidence |
|------|----------|
| `src/app/screens/discover/HomeMapScreen (1).tsx` | 419-line stale duplicate; zero imports anywhere; active version is `HomeMapScreen.tsx` |
| `src/app/screens/discover/BuildingInfoSheet.tsx` | Not exported in `discover/index.ts`; zero imports anywhere in codebase |
| `src/app/screens/discover/DiscoverTabScreen.tsx` | Not exported in `discover/index.ts`; zero imports anywhere; superseded by `DiscoverHomeScreen` |
| `.tmp_todo_current.md` (repo root) | Shadow of `tasks/todo.md`; should not exist at repo root |

**Archive candidates (Roadmap folder):**

| File | Reason |
|------|--------|
| `tasks/Roadmap/Archive/mvp_audit_and_v1_roadmap.md` | Superseded by v2 |
| `tasks/Roadmap/Archive/mvp_audit_and_v2_roadmap.md` | Superseded by state-of-union + active sprint plans |

**Empty directories to remove:**

| Directory | Action |
|-----------|--------|
| `docs/audit/` | Remove if empty |
| `docs/handoff/` | Remove if empty |

**Out-of-place large files:**

The `data/` folder contains a `singapore_food_businesses_canonical.csv` at ~160 MB. This is a one-time seed asset that should not live in the mobile app repo indefinitely — it inflates clone times and confuses AI agents doing file discovery. Move to a separate `hungry-data` private repo or object storage once the Supabase seed script is written.

---

### 1.2 Harness Gaps

#### 🔴 HIGH SEVERITY

| Gap | Detail | Impact |
|-----|--------|--------|
| **No ESLint** | No `.eslintrc.*`, no ESLint in devDeps, no `lint` script | Code quality unenforced; AUD-07/08 (hardcoded colors) would be auto-caught by a color-literals rule |
| **No Prettier** | No `.prettierrc`, not in devDeps, no `format` script | Inconsistent formatting across 24,649 lines of TypeScript |
| **No lint gate in CI** | `.github/workflows/ci.yml` quality-gates runs typecheck + tests + expo-doctor but no lint step | Unformatted/unlinted code merges to `main` silently |

#### 🟠 MEDIUM SEVERITY

| Gap | Detail | Impact |
|-----|--------|--------|
| **No pre-commit hooks** | No `.husky/` directory, no `lint-staged` | Developers commit without any local quality gate |
| **No `.env.example`** | Three env files exist but no documented template for onboarding | New developer setup requires tribal knowledge |
| **Error boundaries cover 2 / 69 screens** | Root `Sentry.ErrorBoundary` + `FeedErrorBoundary` in `HomeFeedScreen` / `ReadsFeedScreen` only | Uncaught error on any auth, detail, profile, or discover screen crashes the full app with a blank white screen |
| **Test coverage ~1.1%** | 9 test files, 279 lines across 24,649 lines of production code; no UI/screen tests | Core business logic (recommendations, quiz, navigation) has zero coverage |

#### 🟡 LOW SEVERITY

| Gap | Detail |
|-----|--------|
| **No `tsconfig.test.json`** | Single tsconfig covers all code; test-specific overrides not isolated |
| **PostHog not Expo-plugin-configured** | Works via manual init in `useAppBootstrap.ts`; not integrated as `app.json` plugin |
| **No security scanning in CI** | No `npm audit`, no Dependabot |
| **`HUNGRY_DATA_SOURCE` not in README** | Feature flag is buried in `environment.md`; not discoverable from the repo homepage |

---

### 1.3 Folder Structure Assessment

**Strengths — do not change:**
- Feature-driven `src/features/` mirrors screen architecture cleanly
- Service abstraction via `serviceProvider.ts` is the right pattern — zero screen changes needed when Supabase lands
- Barrel `index.ts` files are lean and non-bloated
- `tasks/` harness docs (`environment.md`, `screens.md`, `data-contracts.md`, `design-system.md`) are accurate and current

**Weaknesses — fix in next cleanup sprint:**
- Three dead screen files in `src/app/screens/discover/` reduce navigability for AI agents doing navigation or screen audits
- `data/` folder has a 160 MB CSV; inflates clone times
- `docs/audit/` and `docs/handoff/` appear empty; either populate or remove
- `tasks/Roadmap/Archive/mvp_audit_and_v1_roadmap.md` and `mvp_audit_and_v2_roadmap.md` are historical artifacts creating noise when AI agents scan the Roadmap folder

**AI agent digestibility rating: 7 / 10.** Main issues are the dead screens and absent linting config. Everything else is well-structured.

---

### 1.4 TODO / FIXME Comment Inventory

Only 3 intentional TODOs exist in `src/`:

| Location | Comment | Disposition |
|----------|---------|-------------|
| `src/lib/services/serviceProvider.ts:24–25` | `TODO(api): replace with real provider wired to Supabase` | Intentional — marks Phase 2 swap point |
| `src/lib/services/types.ts:202` | `TODO(api): include upload references once media service is wired` | Intentional — marks Phase 2 media work |
| `src/lib/services/mock/mockService.ts:87` | `TODO(api): remove fixture validation once backend contracts are live` | Intentional — temporary during mock mode |

No spurious or forgotten TODOs. Code discipline is good here.

---

## Phase 2 — Production Roadmap

### 2.1 Backend Migration (Sprint 5 — Supabase)

Zero Supabase code exists in `src/`. The migration plan is fully documented in `tasks/Roadmap/backend-migration-plan.md`. All Sprint 5 Claude planning deliverables are complete.

**Blocking prerequisite before Codex starts Supabase work:** AUD-01 (undefined `ReadsFeed` route) must be resolved first, or the Supabase auth integration will inherit the broken navigation state.

**Sprint 5 Codex execution sequence:**

| Step | Gate |
|------|------|
| Supabase project provisioning — extensions, DDL migrations | Migrations run clean in `supabase/migrations/` |
| `supabaseRepository.ts` implementing `DataRepository` (11 methods) | `npm run typecheck` passes |
| `supabaseService.ts` implementing `HungryService` (41 methods) | `npm run typecheck` passes |
| RLS policies + seed data from `mock/data.ts` fixtures | Data parity script passes |
| Swap `serviceProvider.ts` to use `supabaseService` behind `HUNGRY_DATA_SOURCE=supabase` | Staging EAS build works end-to-end |
| Internal beta (10 testers) on staging EAS preview channel | P95 latencies pass: feed <1.5s, decide <2s, search <1s |

### 2.2 Tooling Maturity (Before Sprint 5)

ESLint and Prettier should be installed **before** Supabase work begins. Reason: once `supabaseService.ts` and `supabaseRepository.ts` are created, linting them immediately catches style drift before it accumulates.

**Recommended ESLint stack for Expo/RN:**
```json
{
  "extends": ["expo", "plugin:@typescript-eslint/recommended"],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-restricted-syntax": ["error", { "selector": "Literal[value=/^#[0-9a-fA-F]{6}$/]", "message": "Use palette tokens instead of hardcoded hex colors." }]
  }
}
```

The color-literal rule above would have caught AUD-07 and AUD-08 automatically.

### 2.3 Analytics Maturity

PostHog is wired but the P0/P1 must-ship events from `production-infrastructure.md §4.2` need verification against a live PostHog project. The analytics sink swallows events silently in mock mode.

**Action:** Add a `__DEV__` console sink that logs every event locally so instrumentation can be verified without a PostHog project.

| Priority | Event | Status |
|----------|-------|--------|
| P0 | `app_launched`, `onboarding_completed`, `taste_quiz_completed`, `sign_up_completed`, `dish_viewed` | Wired in code; untested against live PostHog |
| P1 | `decide_for_me_triggered`, `delivery_link_tapped`, `review_submitted`, `dish_favourited` | Wired; untested |

### 2.4 CI/CD Hardening

Three concrete additions needed before production:

```yaml
# .github/workflows/ci.yml — add to quality-gates job:
- name: Lint
  run: npm run lint              # requires ESLint setup (TOOL-01)

- name: Format check
  run: npm run format:check      # requires Prettier setup (TOOL-01)

- name: Security audit
  run: npm audit --audit-level=high
```

EAS build profiles are documented in `production-infrastructure.md §2.3`. The `eas.json` file needs three profiles (`development`, `preview`, `production`) before EAS builds run.

### 2.5 Error Boundary Strategy

The current two-surface model (root Sentry + Feed-level) is insufficient. Recommended minimal expansion:

| Screen Group | Boundary Type | Fallback |
|-------------|---------------|---------|
| Auth screens (Login, SignUp, etc.) | Inline `try/catch` + error state | Show inline error banner |
| DishDetailScreen, StallDetailScreen | `FeedErrorBoundary` | "Couldn't load dish — try again" |
| MapScreen / HomeMapScreen | Inline `try/catch` | Static coordinate overlay |
| Profile screens | `FeedErrorBoundary` | "Couldn't load profile" |

This does not require a new component — `FeedErrorBoundary` already exists and accepts a `fallback` prop.

---

## Phase 3 — Backlog Grooming & Delegation

### 3.1 New Items Added to `tasks/todo.md`

All items below have been added to the backlog under **Sprint 6 — Tooling & Hygiene**:

| ID | Task | Owner | Priority |
|----|------|-------|----------|
| **TOOL-01** | Install ESLint + Prettier; add `lint`, `format`, `lint:fix` scripts to `package.json` | [Codex] | 🔴 HIGH |
| **TOOL-02** | Add `npm run lint` and `npm run format:check` steps to CI pipeline | [Codex] | 🔴 HIGH |
| **TOOL-03** | Set up Husky + lint-staged pre-commit hooks | [Codex] | 🟠 MED |
| **TOOL-04** | Create `.env.example` by stripping secret values from `.env.development` | [Codex] | 🟠 MED |
| **DEAD-01** | Delete `src/app/screens/discover/HomeMapScreen (1).tsx` | [Codex] | 🟠 MED |
| **DEAD-02** | Delete `src/app/screens/discover/BuildingInfoSheet.tsx` | [Codex] | 🟠 MED |
| **DEAD-03** | Delete `src/app/screens/discover/DiscoverTabScreen.tsx` | [Codex] | 🟠 MED |
| **DEAD-04** | Delete `.tmp_todo_current.md` from repo root | [Codex] | 🟡 LOW |
| **ERR-01** | Wrap auth screens (LoginScreen, SignUpScreen, ForgotPasswordScreen) with `FeedErrorBoundary` | [Codex] | 🟠 MED |
| **ERR-02** | Wrap `DishDetailScreen` and `StallDetailScreen` with `FeedErrorBoundary` | [Codex] | 🟠 MED |
| **DOC-01** | Document `HUNGRY_DATA_SOURCE` feature flag and all `FEATURE_FLAGS` constants in `README.md` | [Claude] | 🟡 LOW |
| **LES-01** | Add 4 missing lessons to `tasks/lessons.md` (token scope, service bypass, state persistence, backlog verification gate) | [Claude] | 🟡 LOW |

### 3.2 Delegation Summary

| Agent | Role | Assigned Items |
|-------|------|----------------|
| **[Codex]** | Execution / coding | TOOL-01/02/03/04, DEAD-01/02/03/04, ERR-01/02, AUD-01–09 |
| **[Claude]** | Architecture / planning | Sprint 5 Supabase sequencing, DOC-01, LES-01 |
| **[Gemini]** | UI/UX / design | Error boundary fallback UI copy and design, any token additions for new design system items |

### 3.3 Lessons Added to `tasks/lessons.md`

Four new lessons have been appended to capture recurring patterns not yet recorded:

1. **Token scope:** Never read theme tokens at module scope inside `StyleSheet.create()`. Always read inside the component body via `useHungryTheme()` — module-scope access runs before the provider mounts.
2. **Service provider bypass:** All data access in `src/app/` must go through `getDataRepository()` or `getHungryService()`. Never import from `src/lib/services/mock/` directly in screen or feature files.
3. **State persistence after sign-out:** Any persisted Zustand state keyed by user identity must be cleared in `clearProfile()`. `clearProfile()` must always be called from `signOut()`.
4. **Backlog verification gate:** No item is done until `npm run typecheck` passes AND a verification command is recorded in Section 5 (Session Log) of `todo.md` with the agent name and date.

---

## Appendix — File Reference

| Document | Purpose |
|----------|---------|
| `tasks/Roadmap/backend-migration-plan.md` | Sprint 5 Supabase DDL, auth, RLS, media pipeline, testing plan |
| `tasks/Roadmap/Scaling/production-infrastructure.md` | Env strategy, CI/CD, Sentry, PostHog, App Store checklist |
| `tasks/Roadmap/AI/AI Food Recommendation Engine Design.md` | Taste vector schema, recommendation algorithm, Edge Function API |
| `tasks/todo.md` | Live backlog — source of truth for all sprint work |
| `tasks/lessons.md` | Correction registry — read at session start |
| `tasks/environment.md` | Stack versions, path aliases, commands |
| `tasks/design-system.md` | Token reference, typography, spacing |
| `tasks/screens.md` | Navigation graph, screen file index, param types |
| `tasks/data-contracts.md` | Domain type reference, mock fixture map |
