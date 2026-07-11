# test-harness.md — Feedback Loops & Validation Gates

> Dictionary format. Defines how agents test, verify, and iterate.
> Agents are free to design any test environment within the constraints defined here.

---

## Verification Budget

Run the smallest useful check for the change. Small iterative builds do not require full QA/QC, `npm run ios`, the full test suite, or default `npm run typecheck`.

| Change size | Examples | Expected checks |
|-------------|----------|-----------------|
| Small iterative | Copy, spacing, styling, docs, one-screen polish, narrow follow-up fixes | No broad checks by default; run a focused command only if it directly covers the change, or state "not run — small iterative change" |
| Medium bounded | A few files with logic, props, store usage, route params, or behavior | Focused contract/unit test; add `npm run typecheck` only when TS contracts/imports/props changed |
| Broad/risky | Shared stores/services, navigation, auth, Supabase, dependencies, native config, many files, release gates | Typecheck, relevant tests, dependency/native health, and simulator/manual smoke as applicable |

## Validation Gate Sequence

When broad/risky verification is warranted, run in this order.

```
Gate 1: Type Check      → npm run typecheck
Gate 2: Dep Health      → npx expo-doctor          (after dep changes only)
Gate 3: Unit Tests      → npm run test              (after component/logic changes)
Gate 4: Manual Smoke    → npm run ios               (after native/runtime/navigation-risk changes)
```

**Small iterative changes are complete with a focused check or an explicit "not run — small iterative change" note. Broad/risky tasks are not complete until the relevant gates pass.**

---

## Gate 1 — TypeScript

| Command | `npm run typecheck` |
|---------|-------------------|
| Expected | Exit 0, no errors |
| When required | Broad/risky changes, commits, release gates, or TS contract/import/prop changes |
| On failure | Fix type errors immediately — do not proceed |
| Common causes | Missing type annotations, wrong prop types, unresolved imports, `any` usage |

**TypeScript strict rules:**
- `noImplicitAny: true`
- `strictNullChecks: true`
- All component props must be explicitly typed (no inferred `any`)

---

## Gate 2 — Dependency Health

| Command | `npx expo-doctor` |
|---------|-----------------|
| Expected | All checks pass |
| On failure | Address flagged packages — run `npm dedupe` if duplicate warnings |
| When to run | After `npm install`, after adding/removing any package |

---

## Gate 3 — Source, Service, and Contract Tests

| Command | `npm run test` |
|---------|--------------|
| Runner | Node test runner with `tsx` |
| Config | `package.json` `scripts.test` + `tsconfig.test.json` |
| Expected | All `.test.ts` files under `src/` pass; skipped provider-mode tests must be intentional |
| Current shape | Service tests, source contracts, store tests, migration SQL contracts, and security contracts |

Run focused source/service contracts directly when one slice changes:

```bash
TMPDIR=/private/tmp HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/app/user-mode-coverage-contracts.test.ts
```

## Gate 3b — Playwright Web/Mobile Browser

| Command | `npm run test:e2e -- --reporter=line` |
|---------|---------------------------------------|
| Runner | Playwright |
| Config | `playwright.config.ts` |
| Expected | Primary user/merchant browser flows pass against Expo Web |
| Local note | Codex sandbox may block localhost; rerun with approved localhost access when Expo Web fails before app load |

## Gate 4 — Manual Simulator Smoke

| Command | `npm run ios` |
|---------|-------------|
| When required | Native/runtime/navigation-risk changes, release smoke, or explicit user request |
| Checklist | See smoke test checklist below |

---

## Smoke Test Checklist (Manual)

```
App Launch
  [ ] Splash screen appears, resolves without hang
  [ ] Navigates to MainTabs (or Onboarding if first run)

Home Tab
  [ ] Dish cards render with image, name, rating, price, distance
  [ ] DecideForMe card tappable
  [ ] Tapping dish card navigates to DishDetail

Discover Tab
  [ ] Search input accepts text
  [ ] Taste filter screen opens
  [ ] Search results render

Map Surfaces (merchant/developer only)
  [ ] Map renders (or mock surface if flag enabled)
  [ ] Building pins visible
  [ ] Tapping pin opens bottom sheet
  [ ] BuildingDrillDown opens with floor selector

Review Tab
  [ ] ReviewHub loads, can select venue/dish
  [ ] Star rating screen works
  [ ] Tags screen works
  [ ] Compose screen accepts text

Profile Tab (unauthenticated)
  [ ] Soft gate appears (bottom sheet)
  [ ] "Log in" navigates to Login screen
  [ ] Signed-out users cannot bypass auth to reach protected tabs

Auth Flow
  [ ] Login form validates
  [ ] Sign-up form validates
  [ ] Forgot password flow renders
  [ ] Email verification screen renders

DishDetail
  [ ] Hero image renders
  [ ] Taste radar chart renders
  [ ] Reviews list renders (or empty state)
  [ ] MustOrder badge shows only on tagged dishes

StallDetail
  [ ] Hero image renders at dish-detail scale
  [ ] Address and menu sections render
  [ ] No cart/footer/order controls are visible in user mode
  [ ] Operating hours shown
  [ ] Hygiene grade badge correct colour
  [ ] Closure notice shown when applicable

Dark Mode
  [ ] All screens respect palette.surface, palette.text, etc.
  [ ] No hardcoded colours visible
```

---

## Agent-Authored Test Patterns

Agents may freely write tests. Use these patterns.

### Component Test — Pure Component

```ts
// __tests__/components/ui/Badge.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { Badge } from '@/components/ui/Badge'
import { HungryThemeProvider } from '@/theme'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HungryThemeProvider>{children}</HungryThemeProvider>
)

describe('Badge', () => {
  it('renders label', () => {
    render(<Badge label="A" color="success" />, { wrapper })
    expect(screen.getByText('A')).toBeTruthy()
  })
})
```

### Store Logic Test

```ts
// __tests__/store/useSessionStore.test.ts
import { act } from '@testing-library/react-native'
import { useSessionStore } from '@/store/useSessionStore'

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      hasSkippedTasteQuiz: false,
      sessionExpired: false,
    })
  })

  it('completeAuth sets isAuthenticated true', () => {
    act(() => {
      useSessionStore.getState().completeAuth()
    })
    expect(useSessionStore.getState().isAuthenticated).toBe(true)
  })
})
```

### Source Contract Test

```ts
import test from "node:test";
import { assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

test("screen keeps the required interaction wired", () => {
  const source = readRepoFile("src/app/screens/example/ExampleScreen.tsx");
  assertSourceIncludes(source, [/onPress=\{handleSave\}/, /navigation\.navigate/], "ExampleScreen");
});
```

### Service Test — Mock Repository

```ts
// __tests__/lib/repositories.test.ts
import { getDishById } from '@/lib/services/mock/repositories'

describe('getDishById', () => {
  it('returns dish for valid id', async () => {
    const dish = await getDishById('dish-chicken-rice')
    expect(dish).not.toBeNull()
    expect(dish?.name).toBe('Chicken Rice')
  })

  it('returns null for unknown id', async () => {
    const dish = await getDishById('dish-unknown')
    expect(dish).toBeNull()
  })
})
```

### Snapshot Test — Pure Presentational Component

```ts
// Only snapshot components with no navigation dependencies
import React from 'react'
import renderer from 'react-test-renderer'
import { MustOrderBadge } from '@/components/dish/MustOrderBadge'
import { HungryThemeProvider } from '@/theme'

it('MustOrderBadge matches snapshot', () => {
  const tree = renderer
    .create(<HungryThemeProvider><MustOrderBadge /></HungryThemeProvider>)
    .toJSON()
  expect(tree).toMatchSnapshot()
})
```

### Integration Test — Screen with Mock Data

```ts
// Use mock data from data.ts, not inline fixtures
import { dishes } from '@/lib/services/mock/data'
import { render, screen } from '@testing-library/react-native'
import { DishCard } from '@/components/dish/DishCard'

it('DishCard renders dish name', () => {
  const dish = dishes[0]
  render(<DishCard dish={dish} onPress={() => {}} />, { wrapper: ThemeWrapper })
  expect(screen.getByText(dish.name)).toBeTruthy()
})
```

---

## Test File Conventions

| Rule | Detail |
|------|--------|
| Location | Prefer adjacent source area or `src/app/*-contracts.test.ts`; Playwright specs live in `tests/e2e/` |
| Naming | `fileName.test.ts`, `feature-contracts.test.ts`, or Playwright `*.spec.ts` |
| Imports | Use `@/` aliases — same as production code |
| Mock data | Import from `@/lib/services/mock/data` — never inline |
| Theme | Always wrap with `HungryThemeProvider` for component tests |
| No navigation | Snapshot tests must not depend on a navigation provider |

---

## Feedback Loop — Bug Fix Cycle

```
1. Identify failing gate (type error / test failure / visual regression)
2. Read the error message fully — do not guess
3. Locate the source file (use Grep or Glob to find the exact location)
4. Apply the minimal fix
5. Select the smallest relevant check for the changed surface
6. Run Gate 1 / Gate 3 only when the fix changes TS contracts or test-covered logic
7. Run Gate 4 only for native/runtime/navigation-risk changes or explicit request
8. Record: if correction required was non-obvious → update tasks/lessons.md
```

---

## Feedback Loop — Feature Development Cycle

```
1. Read tasks/todo.md — identify next unchecked item
2. Read relevant harness docs:
   - tasks/screens.md    (if screen work)
   - tasks/design-system.md (if UI work)
   - tasks/data-contracts.md (if data work)
3. Read the existing file(s) that will change
4. Write the implementation
5. Select the smallest relevant verification budget
6. Write/update tests for changed logic
7. Run focused tests or broad gates according to the selected budget
8. Mark todo item [x]
9. Update tasks/todo.md review section
10. Update README.md if status changed
```

---

## Test Constraints (Hard Limits)

| Allowed | Not allowed |
|---------|-------------|
| Jest + RNTL | New test frameworks (Vitest, Mocha, etc.) |
| `@/lib/services/mock/data` for fixtures | Inline fixture data in test files |
| `__tests__/utils/` for shared test helpers | Modifying `data.ts` just for tests |
| Mocking stores via `useStore.setState()` | Full Zustand re-implementation in tests |
| Custom test environments | Network requests in tests |
| Snapshot tests for pure components | Snapshot tests for screens with navigation |

---

## CI-Equivalent Local Check

Run this before broad pushes or release gates:

```bash
npm run typecheck && npm run test
```

Both must exit 0.

---

## Known Limitations & Workarounds

| Limitation | Workaround |
|-----------|-----------|
| Mapbox requires native build | Set `mockMapboxEnabled: true` in `featureFlags.ts` for unit test environments |
| Reanimated requires native runtime | Mock with `jest-reanimated` or shallow render |
| Photo picker requires device camera | Mock `expo-image-picker` in test setup |
| Navigation requires `NavigationContainer` | Use mock navigation context from RNTL |

---

## Self-Improvement Loop

After any correction from the user or unexpected test failure:

```
1. Identify the root cause — not the symptom
2. Write a rule that prevents recurrence
3. Add to tasks/lessons.md:

## YYYY-MM-DD — <short title>
- What happened: <1 sentence>
- Root cause: <1 sentence>
- Rule: <imperative statement that prevents recurrence>
```
