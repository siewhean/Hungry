# Hungry — Mobile Frontend

Hungry is a dish-first food discovery app for Singapore hawker centres and food courts. Built with Expo + React Native. Frontend-only, mock-first, iOS + Android.

---

## Quick Reference

| Need | Go to |
|------|-------|
| Start here (agents) | `AGENTS.md` |
| Workflow rules | `CLAUDE.md` |
| Operating model | `WORKFLOW.md` |
| Low-token defaults | `ops/low-token-cheatsheet.md` |
| Active backlog | `tasks/backlog.md` |
| Verification evidence | `tasks/verification.md` |
| Session history | `tasks/session-log.md` |
| Tech stack + commands | `tasks/environment.md` |
| Design tokens + components | `tasks/design-system.md` |
| Screen inventory + navigation | `tasks/screens.md` |
| Domain types + mock data | `tasks/data-contracts.md` |
| Testing + feedback loops | `tasks/test-harness.md` |
| Product requirements (summarised) | `tasks/product-context.md` |
| Marketing launch kit | `marketing/` |
| Historical roadmap + audit trail | `tasks/todo.md` |
| Past lessons | `tasks/lessons.md` |
| Product requirements | `Research/01_Product_Requirements_Document_Hungry.docx` |
| App flow spec | `Research/02_App_Flow_Document_Hungry.docx` |
| Frontend guidelines | `Research/03_Frontend_Guidelines_Hungry.docx` |
| UI prototypes | `design/figma-v2/` and `design/stitch/` |

---

## What This App Is

| Key | Value |
|-----|-------|
| Product | Hungry — dish-first food discovery |
| Market | Singapore (hawker centres, food courts, restaurants) |
| Platform | iOS + Android (Expo SDK 55 / React Native 0.83.6) |
| Phase | Consumer app, frontend-only, mock data only |
| Not in scope | Website, admin portal, backend API, business portal |
| Core idea | Find the dish you want, then see which stall serves it — not the other way around |
| Taste model | 6-axis vector: sweet · spicy · sour · salty · rich · aromatic |

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Expo SDK 55 + React Native 0.83.6 |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation v7 |
| State | Zustand |
| Forms | React Hook Form |
| Animation | Reanimated 3 |
| Sheets | `@gorhom/bottom-sheet` |
| Map | `@rnmapbox/maps` (mock surface available) |
| Icons | `lucide-react-native` |
| Fonts | Nunito + DM Mono |

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install deps |
| `npm run typecheck` | TypeScript check — **primary gate** |
| `npm run start` | Expo dev server |
| `npm run ios` | iOS simulator |
| `npm run android` | Android emulator |
| `npx expo-doctor` | Dependency health |
| `npm run test` | TSX/Node test suite |

---

## Feature Flags

The application uses feature flags to toggle functionality for development and release branches. These are configured in `src/constants/featureFlags.ts`.

| Flag | Description | Default |
|------|-------------|---------|
| `HUNGRY_DATA_SOURCE` | Toggle between `mock` and `supabase` data layers. | `mock` |
| `FEATURE_FLAGS.directMessagesEnabled` | Enable the Direct Messages tab and chat functionality. | `false` |
| `FEATURE_FLAGS.commentsEnabled` | Enable the community comments section on dish posts. | `true` |
| `FEATURE_FLAGS.craveEnabled` | Enable the "Daily Crave" swiping discovery mode. | `true` |
| `FEATURE_FLAGS.readsEnabled` | Enable the "Reads" (blog) tab. | `true` |
| `FEATURE_FLAGS.mockMapboxEnabled` | Use a static fallback for the map in test environments. | `false` |

To override these locally, you can use `.env.development` or modify the constants directly during prototyping.

---

## Project Status

| Area | Status |
|------|--------|
| Expo scaffold | Done |
| Domain types + stores | Done |
| Mock repositories | Done |
| Navigation shell | Done |
| Home, Discover, Maps, Search | Done |
| Auth, Onboarding | Done |
| Developer launcher (dev-only) | Done |
| Profile, Favourites, Review History | Done |
| Review flow | Done |
| Reads (feature-flagged) | Done |
| Offline + NotFound states | Done |
| Marketing launch kit | Done |
| Typecheck | Passing |
| Expo Doctor | Blocked locally (npm cache permissions) |
| Agent harness docs | Done |
| Unit tests | Basic coverage restored (`npm test`) |

---

## Notes

- Default LLM operating mode for this repo is low-token mode: use bounded task IDs or files, canonical docs first, and delta-only output unless a broad summary is explicitly requested.
- Mock data lives exclusively in `src/lib/services/mock/data.ts`
- Design tokens live exclusively in `src/theme/tokens.ts` — never hardcode values
- The app runs fully without network or backend
- Signed-out users now enter through auth before the main shell; guest browsing is no longer part of the current runtime flow
- The old browse-as-guest soft gate has been removed from runtime navigation; protected actions now route directly into auth
- `Reads` tab is behind `FEATURE_FLAGS.readsEnabled` (default `true`)
- Map mock mode: set `FEATURE_FLAGS.mockMapboxEnabled = true` for test environments
- Real map runtime: set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` locally to enable the live Mapbox surface; without it, the map falls back to a static coordinate preview so the repo screens stay inspectable.
- Maps now use a draggable bottom sheet (`16% / 44% / 82%`) and dynamic camera padding; the active pilot directory overlay is Koufu @ JEM (`L2` + `L3`) with official floor-map image backplates, unit-aligned polygons, computed fit-to-viewport scaling, and explicit zoom controls.
- Map marker semantics are standardized across map surfaces: hawker centre = orange, food court = teal, restaurant = grey/text-muted.
- Core client state now persists across cold starts (session, profile, search filters/history, location, review draft) using Zustand persist + AsyncStorage.
- Root Expo scaffold, typed domain layer, Zustand stores, and mock repositories are in place
- Discover, Search, Details, Auth, Onboarding, Profile, Review, Reads, and recovery flows are implemented in the mobile app shell
- Review compose now supports real library photo attachments via `expo-image-picker` (dev client/native build required).
- The current runtime shell is auth-first. Signed-out users route through Splash into Auth before the main app shell.
- In `__DEV__`, app now boots into the Developer Launcher to speed QA state setup (signed out / onboarding incomplete / onboarding complete presets).
- Developer Launcher Merchant Mode now seeds the dev merchant state and bypasses the merchant sign-in gate before opening MerchantTabs.
- Mock discovery data now includes a broader set of Singapore hawker centres and food courts with expanded stall/dish coverage
- Maps now include a Figma-shaped `Maps` tab, a real `MapZoomedIn` route, and polygon-based building directory layouts (including Wisma and JEM mall-style floor overlays with vertical level switching).
- **Design Specifications** — Comprehensive visual, UX, and accessibility specs for all remaining backlog items are now available in `docs/audit/`. These serve as the authoritative implementation guide for Batch 1–8.
- Current audit status: `npm run typecheck` passes, `npm run test` passes, `npm audit --audit-level=moderate` reports 0 vulnerabilities, and `npx expo-doctor` passes (17/17) when run with a writable npm cache path.


## Commands

- `npm install`
- `npm run start`
- `npm run ios`
- `npm run android`
- `npm run typecheck`
- `npm run data:enrich`

## Notes

- Source-of-truth product requirements currently live in the three Hungry docx files in the repo root.
- Added an interview question bank for multi-persona customer and stall-operator research at `Research/agent_interview_question_bank.md`.
- Reads stays behind a feature flag even though the tab contract exists now.
- The app is designed to demo end-to-end without backend availability.
- The `data/` folder also contains the Singapore food-business workbook, a checked-in curated seed snapshot, and the refresh pipeline for rebuilding the database from public datasets plus supplementary hawker- and food-court-source discovery.
- The `marketing/` workspace now contains repo-grounded launch materials plus the Next.js marketing site in `marketing/web/` with the homepage, `for-merchants`, `about`, and `privacy` routes.

## Delivery Governance

- Shared active task requirements live in `tasks/backlog.md`.
- Verification evidence lives in `tasks/verification.md`.
- Claude and Codex should both update the canonical task rows frequently during execution (at minimum once per focused work block and before ending a session).
- Planning-first execution is required: create/update scoped backlog rows before non-trivial implementation work, then record verification before checking tasks complete.
- `tasks/todo.md` remains the historical roadmap and audit trail, not the live status surface.

## Future Roadmap

See `tasks/todo.md` for the historical/full roadmap and `tasks/backlog.md` for the currently active work. Key future features include:

- **Digital Ordering & Payments** — In-app ordering + PayNow/card checkout for hawker centres, food courts, and restaurants. Includes a vendor analytics dashboard (top dishes, peak hours, revenue), real-time crowd/busyness indicators per stall, and queue wait-time estimates. Crowd monitoring is derived from active order volume — no hardware sensors required for the MVP signal.
- **Interactive Indoor Maps** — SVG floor plans with polygon-level stall selection, open/closed colour coding, and pinch-to-zoom (see `design/figma-v2/building-layout.html` for mockups).
- **"Decide for Me" AI** — Personalised dish recommendation surfaced prominently in Discover.
- **Group Wishlists** — Shared save lists for planning meals with friends.
