# AGENTS.md — Hungry Agent Harness

> **Format:** Dictionary / Table of Contents. Prose is minimal. Every entry points to a file or defines a concrete rule.
> **Read this first.** Then follow the pointer chain to the task-specific doc.

---

## 0. Startup Sequence (mandatory, every session)

| Step | Action                         | Source                    |
| ---- | ------------------------------ | ------------------------- |
| 1    | Read project state             | `README.md`               |
| 2    | Read workflow rules            | `CLAUDE.md`               |
| 3    | Read operating model           | `WORKFLOW.md`             |
| 4    | Read tech environment          | `tasks/environment.md`    |
| 5    | Read current active backlog    | `tasks/backlog.md`        |
| 6    | Read current verification      | `tasks/verification.md`   |
| 7    | Read past lessons              | `tasks/lessons.md`        |
| 8    | Read relevant domain reference | `tasks/data-contracts.md` |

---

## 1. Document Map

| Document                        | Purpose                                                    | When to read                                 |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `README.md`                     | Project state, stack, commands, current status             | Always                                       |
| `CLAUDE.md`                     | Workflow rules, planning mode, subagent strategy           | Always                                       |
| `AGENTS.md`                     | This file — master TOC                                     | Always                                       |
| `PROJECT_INSTRUCTIONS.md`       | Design philosophy, visual rules, copy rules                | Before any UI work                           |
| `WORKFLOW.md`                   | Operating model, agent roles, verification bundle          | Always                                       |
| `ops/low-token-cheatsheet.md`   | Default low-token prompting and output rules for all LLMs  | Always                                       |
| `.codex/skills/hungry-intent-router/SKILL.md` | Automatic request expansion and skill routing for Hungry work | For vague or multi-step requests |
| `tasks/backlog.md`              | Canonical active task surface                              | Every session                                |
| `tasks/verification.md`         | Latest verification evidence                               | Every verification or closeout               |
| `tasks/session-log.md`          | Append-only execution history                              | End of each focused work block               |
| `tasks/environment.md`          | Stack versions, paths, commands, constraints               | Before writing any code                      |
| `tasks/design-system.md`        | Tokens, colors, typography, motion, component patterns     | Before any component work                    |
| `tasks/screens.md`              | Screen inventory, navigation tree, param types             | Before any navigation or screen work         |
| `tasks/data-contracts.md`       | Domain types, mock data, store interfaces                  | Before any data or state work                |
| `tasks/test-harness.md`         | Feedback loops, validation gates, test patterns            | Before any feature or bug-fix work           |
| `tasks/product-context.md`      | Full PRD summary — personas, features, UX specs, tone      | Before any product feature work              |
| `tasks/todo.md`                 | Historical roadmap, audit trail, and sprint archive        | When roadmap or historical context is needed |
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
| Platform         | iOS + Android (Expo SDK 55 / React Native 0.83.6)                            |
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

| Flag | Full Audit V1 production default | Meaning |
| --- | --- | --- |
| `directMessagesEnabled` | `true` | Direct Messages tab and chat surfaces |
| `commentsEnabled` | `true` | Community comments on posts/reviews |
| `storiesEnabled` | `true` | Story viewer and story creation |
| `collectionsEnabled` | `true` | Collection list/detail routes |
| `gamificationEnabled` | `true` | Passport, Missions, and FoodCred surfaces |
| `merchantCentreEnabled` | `true` | Merchant beta routes behind auth/role/verification checks |
| `oauthProvidersEnabled` | `false` | Google/Apple OAuth provider buttons stay disabled until live credentials are verified |
| `prototypeRoutesEnabled` | `false` | Prototype-only routes stay hidden in production |
| `floorplansEnabled` | `false` | Indoor floorplan routes and entry points stay hidden in production |
| `notificationsEnabled` | `false` | Push notifications disabled |
| `mockMapboxEnabled` | `false` | Use real Mapbox SDK; `true` = mock surface |

Source: `src/constants/featureFlags.ts`

---

## 6. Verification Budget

Choose the smallest verification set that matches the risk of the change.

| Change size | Examples | Expected checks |
| ----------- | -------- | --------------- |
| Small iterative | Copy, spacing, styling, one-screen UI polish, docs, narrowly scoped follow-up fixes | No full QA/QC, no `npm run ios`, no full test suite, and no default `npm run typecheck`; run only a focused check if directly relevant, or state "not run — small iterative change" |
| Medium bounded | 1-3 files with logic, props, store usage, navigation params, or a focused behavior change | Run the most relevant focused test or contract; add `npm run typecheck` only when TypeScript contracts/imports/props changed |
| Broad/risky | Shared stores/services, navigation architecture, auth, Supabase, dependencies, native config, release gates, many files, or regression-prone flows | Run `npm run typecheck`, relevant tests, and simulator/manual smoke as applicable |

| Gate              | Command                           | Required when          |
| ----------------- | --------------------------------- | ---------------------- |
| Type check        | `npm run typecheck`               | Broad/risky changes, commits, release gates, or TS contract changes |
| Dependency health | `npx expo-doctor`                 | Dependency or Expo/native config changes |
| Component smoke   | `npm run test` / focused test     | Logic, store, component, or contract changes |
| Manual simulator  | `npm run ios`                     | Native/runtime/navigation-risk changes, release smoke, or explicit user request |

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
  - Keep TypeScript strict; choose checks from the verification budget instead of running broad gates for every small iteration
  - Use the design token system (useHungryTheme)
  - Keep mock data in data.ts
  - Keep types in domain.ts
  - Mark tasks in `tasks/backlog.md` as you progress
  - If a task is completed, immediately update its canonical row in `tasks/backlog.md` in the same work session
  - Record verification in `tasks/verification.md` for task/release work; for small iterative changes, final-response evidence is enough unless a task row is updated
  - Append narrative execution notes to `tasks/session-log.md`
  - Default to low-token mode: bounded prompts, bounded reads, canonical docs first, delta-only output unless the user explicitly asks for broader narration
  - Use `hungry-intent-router` as the first-pass skill when a Hungry request is vague, underspecified, or spans multiple workflows
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
  [ ] Verification budget selected — focused check run or intentionally skipped for small iterative change
  [ ] tasks/backlog.md — canonical rows updated
  [ ] tasks/verification.md — evidence updated when task/release work was changed
  [ ] tasks/session-log.md — entry appended
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

# [Hungry] recent context, 2026-05-25 2:20am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,343t read) | 335,260t work | 95% savings

### Apr 8, 2026
48 8:53p 🔵 Wisma Atria F&B stores include floor location data; Paragon uses microsite CPT
49 8:56p 🔵 Link REIT mall item IDs not exposed in HTML source code
50 8:58p 🔵 Link REIT malls expose JSON API with store metadata; other malls lack JSON APIs
51 9:02p 🟣 Created normalized Wisma Atria F&B dataset with 32 stores
52 9:03p 🔵 Alternative data access methods found for non-WordPress malls
53 " 🔵 Suntec GraphQL is false positive; store APIs require parameters; sitemaps are viable
54 9:04p 🔵 Store directory pages do not call /api/stores endpoints during page load
55 9:05p 🔵 Mall store directories use server-side rendering, not client-side JSON APIs
56 " 🔵 Store detail pages contain unit numbers, opening hours, and floor levels in HTML text
57 9:06p 🟣 Implemented async sitemap scraper for 313 Somerset, Parkway Parade, and VivoCity
58 9:07p 🟣 Successfully scraped 309 F&B stores from 313 Somerset, Parkway Parade, and VivoCity
59 9:10p 🟣 Link REIT mall scraper for AMK Hub and Jurong Point
60 " 🔵 F&B dataset spans 17 malls with 936 tenants
61 9:11p 🔵 VivoCity scraper name extraction bug causes 156 missing records
62 " 🔵 VivoCity store name extraction fix using title and og:title tags
63 9:15p 🔴 Fixed VivoCity parser and rebuilt unified F&B dataset
64 9:23p 🔵 Link REIT mall data availability mapped via pagination and HTML scraping
### Apr 9, 2026
68 1:19a 🔵 Domain Model and Data Contracts for Food-Tech Marketplace
69 10:53a 🔵 security_reminder_hook.py fails due to unquoted $CLAUDE_PLUGIN_ROOT variable with spaces in path
70 " 🔵 V2 database architecture designed for Hungry food-discovery app (PostgreSQL + PostGIS + pgvector stack)
71 " 🔴 Fixed security_reminder_hook.py command invocation by quoting $CLAUDE_PLUGIN_ROOT variable
72 10:55a 🔵 Vercel CLI upgrade failed due to missing pnpm global bin directory configuration
73 " ✅ Upgraded Vercel CLI to latest version using npm after pnpm global bin configuration issue
### Apr 17, 2026
127 2:01p 🔵 PR #19 merged to main, sprint-8-folding-cleanup branch behind
128 2:03p ✅ Sprint 8 documentation consolidation and lint tooling added
129 2:06p ✅ Sprint 7 completed with navigation refactor and mock service layer
130 " ✅ Sprint planning audit branch created from main
131 2:07p 🔵 Sprint 6 error boundary coverage completed, README documentation incomplete
132 " 🔵 Sprint 8 implementation mostly complete but offline connectivity listener missing
133 2:08p 🔵 Sprint 5/6/8 comprehensive audit completed against merged codebase
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
154 4:52p 🔴 Disabled C++ advanced features in fmt library to fix iOS build
157 4:55p ✅ CocoaPods installation completed with New Architecture and fmt workaround
160 4:59p ✅ Suppressed invalid constexpr warnings in iOS C++ build
162 5:01p ✅ Extended C++17 standard to RCT-Folly pod target
164 5:02p 🔵 Root cause traced to fmt::basic_format_string consteval errors in RCT-Folly
167 5:11p 🔵 iOS build fails due to ambiguous Expo module import access level
168 5:12p 🔴 Fixed ambiguous Expo import by removing internal access modifier
170 5:20p 🔴 Fixed app crash by binding ReactNativeFactory to ExpoAppDelegate
### Apr 19, 2026
171 4:25p 🔵 expo-secure-store package missing from node_modules
### Apr 22, 2026
172 4:25a 🔵 Sprint 5 QA/QC verification run reveals test tooling failure and mock imports in Supabase repository

Access 335k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
