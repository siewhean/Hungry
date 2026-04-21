# AGENTS.md — Hungry Agent Harness

> **Format:** Dictionary / Table of Contents. Prose is minimal. Every entry points to a file or defines a concrete rule.
> **Read this first.** Then follow the pointer chain to the task-specific doc.

---

## 0. Startup Sequence (mandatory, every session)

| Step | Action                         | Source                    |
| ---- | ------------------------------ | ------------------------- |
| 1    | Read project state             | `README.md`               |
| 2    | Read workflow rules            | `CLAUDE.md`               |
| 3    | Read tech environment          | `tasks/environment.md`    |
| 4    | Read current task list         | `tasks/todo.md`           |
| 5    | Read past lessons              | `tasks/lessons.md`        |
| 6    | Read relevant domain reference | `tasks/data-contracts.md` |

---

## 1. Document Map

| Document                        | Purpose                                                    | When to read                                 |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `README.md`                     | Project state, stack, commands, current status             | Always                                       |
| `CLAUDE.md`                     | Workflow rules, planning mode, subagent strategy           | Always                                       |
| `AGENTS.md`                     | This file — master TOC                                     | Always                                       |
| `PROJECT_INSTRUCTIONS.md`       | Design philosophy, visual rules, copy rules                | Before any UI work                           |
| `tasks/environment.md`          | Stack versions, paths, commands, constraints               | Before writing any code                      |
| `tasks/design-system.md`        | Tokens, colors, typography, motion, component patterns     | Before any component work                    |
| `tasks/screens.md`              | Screen inventory, navigation tree, param types             | Before any navigation or screen work         |
| `tasks/data-contracts.md`       | Domain types, mock data, store interfaces                  | Before any data or state work                |
| `tasks/test-harness.md`         | Feedback loops, validation gates, test patterns            | Before any feature or bug-fix work           |
| `tasks/product-context.md`      | Full PRD summary — personas, features, UX specs, tone      | Before any product feature work              |
| `tasks/todo.md`                 | Current task checklist                                     | Every session                                |
| `tasks/lessons.md`              | Self-improvement log — rules derived from past corrections | Every session                                |
| `Research/`                     | PRD, App Flow, Frontend Guidelines (`.docx`)               | When requirements are ambiguous — raw source |
| `design/`                       | HTML prototypes for each major screen group                | Before UI implementation                     |
| `src/types/domain.ts`           | Canonical TypeScript types                                 | Authoritative — do not duplicate             |
| `src/lib/services/mock/data.ts` | All fixture data                                           | Authoritative mock source                    |
| `src/theme/tokens.ts`           | All design tokens                                          | Authoritative — never hardcode values        |

---

## 2. App Identity

| Key              | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Product name     | Hungry                                                                       |
| Platform         | iOS + Android (Expo SDK 54 / React Native 0.81)                              |
| Phase            | Consumer mobile app, frontend-only, mock-first                               |
| Out of scope     | Website, admin portal, backend API, push notifications                       |
| Market           | Singapore — hawker centres, food courts, restaurants                         |
| Core proposition | **Dish-first** food discovery. Users find dishes they want, not just venues. |
| Taste model      | 6-axis vector: `sweet · spicy · sour · salty · rich · aromatic` (each 0–10)  |
| Auth model       | Splash → Auth → Onboarding → full access                                     |

---

## 3. Goal Hierarchy

```
Level 1 — User Goal
  "I want to know what to eat right now, near me."

Level 2 — Product Goal
  Surface the right dish at the right hawker, for this user's taste profile.

Level 3 — Engineering Goal
  A mock-first demo app that proves the UX end-to-end without backend.

Level 4 — Current Sprint Goal
  All screens implemented, typecheck passes, app runs on simulator.
```

---

## 4. Protected Paths (do not refactor without explicit instruction)

| Path                                   | Risk                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| `src/app/navigation/RootNavigator.tsx` | Navigation wiring — auth gate, tab order, deep links        |
| `src/store/useSessionStore.ts`         | Auth state machine — signed-out/auth/onboarding transitions |
| `src/lib/services/mock/data.ts`        | Single source of fixture truth                              |
| `src/types/domain.ts`                  | Canonical type definitions                                  |
| `src/theme/tokens.ts`                  | Design token source of truth                                |

---

## 5. Feature Flag Registry

| Flag                   | Default | Meaning                                    |
| ---------------------- | ------- | ------------------------------------------ |
| `readsEnabled`         | `true`  | Reads tab is visible                       |
| `notificationsEnabled` | `false` | Push notifications disabled                |
| `mockMapboxEnabled`    | `false` | Use real Mapbox SDK; `true` = mock surface |

Source: `src/constants/featureFlags.ts`

---

## 6. Validation Gates (run in order, must all pass)

| Gate              | Command                           | Must pass before       |
| ----------------- | --------------------------------- | ---------------------- |
| Type check        | `npm run typecheck`               | Every commit           |
| Dependency health | `npx expo-doctor`                 | Every dep change       |
| Component smoke   | `npm run test` (when tests exist) | Every component change |
| Manual simulator  | `npm run ios`                     | Feature completion     |

See `tasks/test-harness.md` for full feedback loop specification.

---

## 7. Code Generation Rules

| Rule         | Detail                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Types        | Import from `@/types/domain` — never redeclare                                                  |
| Theme        | Consume via `useHungryTheme()` — never hardcode colors, spacing, radii                          |
| Stores       | Zustand only — no local useState for shared state                                               |
| Mock data    | Extend `src/lib/services/mock/data.ts` — never inline fixture data in components                |
| Repositories | Use/extend `src/lib/services/mock/repositories.ts` — never call mock data directly from screens |
| Navigation   | Params must be declared in `src/app/navigation/navigationTypes.ts`                              |
| Async        | No real network calls — mock repositories return `Promise.resolve()`                            |
| Images       | Unsplash CDN URLs from existing `FOOD_*` constants or add new named constants                   |
| TypeScript   | Strict mode — no `any` unless unavoidable and commented                                         |
| Fonts        | `Nunito_*` for UI text, `DMMono_400Regular` for prices and code                                 |
| Icons        | `lucide-react-native` — no other icon library                                                   |

---

## 8. Constraint Boundaries (hard limits)

```
DO NOT:
  - Add a backend, API calls, or network requests
  - Add a web or admin interface
  - Add a new navigation library
  - Add a new state management library
  - Add new font families
  - Add any icon library other than lucide-react-native
  - Hardcode colors, spacing, or radii
  - Duplicate domain types from domain.ts
  - Add purple gradients, sparkle emojis, or generic SaaS UI patterns
  - Add placeholder testimonials or fake marketing copy

ALWAYS:
  - Keep TypeScript strict — run typecheck after every change
  - Use the design token system (useHungryTheme)
  - Keep mock data in data.ts
  - Keep types in domain.ts
  - Mark tasks in tasks/todo.md as you progress
  - If a task is completed, immediately update that task's status/progress in tasks/todo.md in the same work session
  - Record lessons in tasks/lessons.md after any correction
```

---

## 9. Agent-Authored Tests

Agents may create test files freely within these bounds:

| Allowed                                                    | Not allowed                                              |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Unit tests in `__tests__/` adjacent to the file under test | Tests that require a live network                        |
| Jest + React Native Testing Library                        | New test frameworks                                      |
| Mock data from `src/lib/services/mock/data.ts`             | Inline fixture data in test files                        |
| Snapshot tests for pure components                         | Snapshot tests for screens with navigation               |
| Custom test utilities in `__tests__/utils/`                | Test utilities that import from `node_modules` internals |

See `tasks/test-harness.md` for patterns and examples.

---

## 10. Session-End Checklist

```
Before ending any session that changed code:
  [ ] npm run typecheck — passes
  [ ] tasks/todo.md — all done items marked [x]
  [ ] tasks/todo.md — each completed task has updated progress/status notes
  [ ] tasks/todo.md — review section added
  [ ] tasks/lessons.md — any correction recorded
  [ ] README.md — status section updated if progress/decisions changed
```

This project is a floor-plan and store-directory tracing tool.

Rules:

- Geometry is the source of truth.
- Never store layout edits only as raster pixels.
- All store units must be saved as polygons or rectangles in JSON.
- Prefer SVG rendering over canvas bitmap rendering.
- Keep drawing logic modular.
- Use OpenCV only for image rectification, not final geometry storage.
- Add snapping and validation before adding advanced auto-detection.
- Avoid changing geometry schema without updating import/export logic.

---

## 11. Design Source Gating (mandatory)

| Rule                   | Detail                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Design-first           | Before implementing or changing UI, open the governing design source first: Figma, `design/` prototype, or approved research/design file. |
| No code-first guessing | If a design file exists, do not improvise the UI from existing code or memory.                                                            |
| Missing design         | If no design file exists for the requested screen/component, stop and define the design before implementation.                            |
| Verification           | UI work is not complete until the implementation is checked back against the design artifact.                                             |
| Review standard        | Run the approved design checklist skill or equivalent structured visual review before considering the screen done.                        |


<claude-mem-context>
# Memory Context

# [Hungry] recent context, 2026-04-22 4:16am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 20 obs (5,874t read) | 176,419t work | 97% savings

### Apr 17, 2026
136 2:59p 🔵 Dual radar chart implementations found in codebase
### Apr 18, 2026
137 2:01p 🔴 Removed undefined bindReactNativeFactory call from iOS AppDelegate
139 2:03p 🔵 bindReactNativeFactory function missing in iOS AppDelegate
141 2:04p 🔵 CoreSimulator service connection failure on macOS
142 " 🔴 Force Metro bundler to prevent stale expo-updates bundles
147 2:05p 🟣 Font loading timeout and fallback handling in AppBody
148 4:29p ✅ iOS JavaScript engine switched from Hermes to JavaScriptCore
150 4:45p 🔵 Git index lock creation blocked by file system permissions
151 4:46p 🔵 Git index lock creation blocked by file system permissions
152 4:47p 🔵 iOS Simulator unavailable due to incorrect xcode-select path
153 4:52p 🔵 iOS Simulator unavailable due to incorrect xcode-select path
154 " 🔴 Disabled C++ advanced features in fmt library to fix iOS build
157 4:55p ✅ CocoaPods installation completed with New Architecture and fmt workaround
160 4:59p ✅ Suppressed invalid constexpr warnings in iOS C++ build
161 5:01p ✅ Suppressed invalid constexpr warnings in iOS C++ build
162 " ✅ Extended C++17 standard to RCT-Folly pod target
164 5:02p 🔵 Root cause traced to fmt::basic_format_string consteval errors in RCT-Folly
167 5:11p 🔵 iOS build fails due to ambiguous Expo module import access level
168 5:12p 🔴 Fixed ambiguous Expo import by removing internal access modifier
170 5:20p 🔴 Fixed app crash by binding ReactNativeFactory to ExpoAppDelegate

Access 176k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
