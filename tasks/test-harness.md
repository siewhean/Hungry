# test-harness.md — Feedback Loops & Validation Gates

> Dictionary format. Defines how agents test, verify, and iterate.
> Agents are free to design any test environment within the constraints defined here.

---

## Validation Gate Sequence

Run in this order. Never skip a gate to move forward.

```
Gate 1: Type Check      → npm run typecheck
Gate 2: Dep Health      → npx expo-doctor          (after dep changes only)
Gate 3: Unit Tests      → npm run test              (after component/logic changes)
Gate 4: Manual Smoke    → npm run ios               (after screen/flow changes)
```

**A task is NOT complete until Gate 1 and Gate 3 pass.**

---

## Gate 1 — TypeScript

| Command | `npm run typecheck` |
|---------|-------------------|
| Expected | Exit 0, no errors |
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

## Gate 3 — Unit Tests

| Command | `npm run test` |
|---------|--------------|
| Runner | Jest + React Native Testing Library |
| Config | `jest.config.js` (or `package.json jest` key) |
| Expected | All tests pass, no snapshots changed unexpectedly |

---

## Gate 4 — Manual Simulator Smoke

| Command | `npm run ios` |
|---------|-------------|
| When required | After any screen or navigation change |
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

Maps Tab
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
  [ ] "Continue as guest" dismisses gate

Auth Flow
  [ ] Login form validates
  [ ] Sign-up form validates
  [ ] Forgot password flow renders
  [ ] Email verification screen renders

DishDetail
  [ ] Hero image renders
  [ ] Taste radar chart renders
  [ ] Reviews list renders (or empty state)
  [ ] Delivery buttons render when links available
  [ ] MustOrder badge shows only on tagged dishes

StallDetail
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

### Unit Test — Pure Component

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

### Unit Test — Store Logic

```ts
// __tests__/store/useSessionStore.test.ts
import { act } from '@testing-library/react-native'
import { useSessionStore } from '@/store/useSessionStore'

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      isAuthenticated: false,
      isGuest: true,
      hasCompletedOnboarding: false,
      hasSkippedTasteQuiz: true,
      sessionExpired: false,
    })
  })

  it('completeAuth sets isAuthenticated true', () => {
    act(() => {
      useSessionStore.getState().completeAuth()
    })
    expect(useSessionStore.getState().isAuthenticated).toBe(true)
    expect(useSessionStore.getState().isGuest).toBe(false)
  })
})
```

### Unit Test — Mock Repository

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
| Location | `__tests__/` directory adjacent to the file under test |
| Naming | `ComponentName.test.tsx` or `fileName.test.ts` |
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
5. Run Gate 1 (typecheck) — verify fix doesn't break types
6. Run Gate 3 (tests) — verify fix doesn't break tests
7. If visual: run Gate 4 (simulator) — verify correct render
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
5. Run Gate 1 — npm run typecheck (must pass)
6. Write/update tests for changed logic
7. Run Gate 3 — npm run test (must pass)
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

Run this before any push:

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
