# Hungry — Mobile Frontend

Hungry is a dish-first food discovery app for Singapore hawker centres and food courts. Built with Expo + React Native. Mock-first for local demos, with Supabase-backed integrations staged behind release gates.

---

## Quick Reference

| Need                              | Go to                                                   |
| --------------------------------- | ------------------------------------------------------- |
| Start here (agents)               | `AGENTS.md`                                             |
| Workflow rules                    | `CLAUDE.md`                                             |
| Operating model                   | `WORKFLOW.md`                                           |
| Low-token defaults                | `ops/low-token-cheatsheet.md`                           |
| Active backlog                    | `tasks/backlog.md`                                      |
| Verification evidence             | `tasks/verification.md`                                 |
| Session history                   | `tasks/session-log.md`                                  |
| Tech stack + commands             | `tasks/environment.md`                                  |
| Design tokens + components        | `tasks/design-system.md`                                |
| Screen inventory + navigation     | `tasks/screens.md`                                      |
| Domain types + mock data          | `tasks/data-contracts.md`                               |
| Testing + feedback loops          | `tasks/test-harness.md`                                 |
| Accessibility source guide        | `docs/accessibility-style-guide.md`                     |
| Product requirements (summarised) | `tasks/product-context.md`                              |
| Marketing launch kit              | `marketing/`                                            |
| Historical roadmap + audit trail  | `tasks/todo.md`                                         |
| Past lessons                      | `tasks/lessons.md`                                      |
| Product requirements              | `Research/01_Product_Requirements_Document_Hungry.docx` |
| App flow spec                     | `Research/02_App_Flow_Document_Hungry.docx`             |
| Frontend guidelines               | `Research/03_Frontend_Guidelines_Hungry.docx`           |
| UI prototypes                     | `design/figma-v2/` and `design/stitch/`                 |

---

## What This App Is

| Key                       | Value                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product                   | Hungry — dish-first food discovery                                                                                                                                                                                       |
| Market                    | Singapore (hawker centres, food courts, restaurants)                                                                                                                                                                     |
| Platform                  | iOS + Android (Expo SDK 55 / React Native 0.83.6)                                                                                                                                                                        |
| Phase                     | Consumer mobile app, mock-first locally with Supabase-backed Full Audit V1 integrations                                                                                                                                  |
| Production posture        | DMs, comments, stories, collections, gamification, and merchant beta are enabled in code for Full Audit V1; live Supabase chat, social/gamification, and OCR smokes pass, but release remains blocked until Android/EAS, store-console, production-secret, and owner-action gates pass |
| Still production-disabled | OAuth providers, prototype routes, and indoor floorplans                                                                                                                                                                 |
| Core idea                 | Find the dish you want, then see which stall serves it — not the other way around                                                                                                                                        |
| Taste model               | 6-axis vector: sweet · spicy · sour · salty · rich · aromatic                                                                                                                                                            |

---

## Stack

| Layer      | Choice                                    |
| ---------- | ----------------------------------------- |
| Framework  | Expo SDK 55 + React Native 0.83.6         |
| Language   | TypeScript (strict mode)                  |
| Navigation | React Navigation v7                       |
| State      | Zustand                                   |
| Forms      | React Hook Form                           |
| Animation  | Reanimated 3                              |
| Sheets     | `@gorhom/bottom-sheet`                    |
| Map        | `@rnmapbox/maps` (mock surface available) |
| Icons      | `lucide-react-native`                     |
| Fonts      | Nunito + DM Mono                          |

---

## Commands

| Command                                       | Purpose                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `npm install`                                 | Install deps                                                            |
| `npm run typecheck`                           | TypeScript check — **primary gate**                                     |
| `npm run start`                               | Expo dev server                                                         |
| `npm run ios`                                 | iOS simulator                                                           |
| `npm run android`                             | Android emulator                                                        |
| `npx expo-doctor`                             | Dependency health                                                       |
| `npm run test`                                | TSX/Node test suite                                                     |
| `npm run data:supabase:stage:canonical`       | Generate staging-only SQL for the canonical Singapore food-business CSV |
| `npm run data:supabase:stage:canonical:split` | Generate chunked staging SQL files for linked Supabase imports          |

---

## Feature Flags

The application uses feature flags to toggle functionality for development and release branches. These are configured in `src/constants/featureFlags.ts`.

| Flag                                   | Description                                                                      | Default                                              |
| -------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `HUNGRY_DATA_SOURCE`                   | Toggle between `mock` and `supabase` data layers.                                | `mock`                                               |
| `FEATURE_FLAGS.directMessagesEnabled`  | Enable the Direct Messages tab and chat functionality.                           | `true` in Full Audit V1 production                   |
| `FEATURE_FLAGS.prototypeRoutesEnabled` | Register V2/prototype routes outside production release builds.                  | `true` in development/staging, `false` in production |
| `FEATURE_FLAGS.merchantCentreEnabled`  | Register merchant centre beta routes behind auth, role, and verification guards. | `true` in Full Audit V1 production                   |
| `FEATURE_FLAGS.commentsEnabled`        | Enable community comments on posts and reviews.                                  | `true` in Full Audit V1 production                   |
| `FEATURE_FLAGS.oauthProvidersEnabled`  | Enable Google/Apple OAuth provider buttons.                                      | `true` in development/staging, `false` in production |
| `FEATURE_FLAGS.floorplansEnabled`      | Register indoor floorplan routes and entry points.                               | `false` in all environments until launch gates pass  |
| `FEATURE_FLAGS.gamificationEnabled`    | Enable Passport and Missions surfaces.                                           | `true` in Full Audit V1 production                   |
| `FEATURE_FLAGS.collectionsEnabled`     | Enable collection list/detail routes.                                            | `true` in Full Audit V1 production                   |
| `FEATURE_FLAGS.storiesEnabled`         | Enable story viewer and story creation surfaces.                                 | `true` in Full Audit V1 production                   |
| `FEATURE_FLAGS.craveEnabled`           | Enable the "Daily Crave" swiping discovery mode.                                 | `true`                                               |
| `FEATURE_FLAGS.readsEnabled`           | Enable the "Reads" (blog) tab.                                                   | `true`                                               |
| `FEATURE_FLAGS.mockMapboxEnabled`      | Use a static fallback for the map in test environments.                          | `false`                                              |

To override these locally, you can use `.env.development` or modify the constants directly during prototyping.

---

## Project Status

| Area                                | Status                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Expo scaffold                       | Done                                                                                       |
| Domain types + stores               | Done                                                                                       |
| Mock repositories                   | Done                                                                                       |
| Navigation shell                    | Done                                                                                       |
| Home, Discover, Maps, Search        | Done                                                                                       |
| Auth, Onboarding                    | Done                                                                                       |
| Developer launcher (dev-only)       | Done                                                                                       |
| Profile, Favourites, Review History | Done                                                                                       |
| Review flow                         | Done                                                                                       |
| Reads (feature-flagged)             | Done                                                                                       |
| Offline + NotFound states           | Done                                                                                       |
| Marketing launch kit                | Done                                                                                       |
| Typecheck                           | Passing                                                                                    |
| Expo Doctor                         | Passing 18/18 after SDK 55 patch-version alignment; rerun before RC if dependencies change |
| Agent harness docs                  | Done                                                                                       |
| Unit tests                          | Passing (`npm test`)                                                                       |
| Playwright E2E                      | Passing when run with localhost access; Codex sandbox TCP bind needs elevated/local shell  |

---

## Notes

- Default LLM operating mode for this repo is low-token mode: use bounded task IDs or files, canonical docs first, and delta-only output unless a broad summary is explicitly requested.
- Mock data lives exclusively in `src/lib/services/mock/data.ts`
- Design tokens live exclusively in `src/theme/tokens.ts` — never hardcode values
- The app runs fully without network or backend
- Signed-out users can browse Home, Discover, Search, dish/stall details, Reads, and basic discovery/map surfaces
- Protected actions route to auth and keep a return route: create post, review, save/favourite, messages/chat, profile-private pages, merchant tools, claim/order/cart
- V2/prototype routes are registered only when `FEATURE_FLAGS.prototypeRoutesEnabled` is true; production builds keep unfinished prototype/design routes off the root navigator
- `MerchantTabs` is registered only when `FEATURE_FLAGS.merchantCentreEnabled` is true
- Direct messages and chat entry points are hidden or disabled when `FEATURE_FLAGS.directMessagesEnabled` is false
- Indoor floorplan routes and layout entry points are registered only when `FEATURE_FLAGS.floorplansEnabled` is true
- `Reads` tab is behind `FEATURE_FLAGS.readsEnabled` (default `true`)
- Map mock mode: set `FEATURE_FLAGS.mockMapboxEnabled = true` for test environments
- Real map runtime: set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` locally to enable the live Mapbox surface; without it, the map falls back to a static coordinate preview so the repo screens stay inspectable.
- Maps now use a draggable bottom sheet (`16% / 44% / 82%`) and dynamic camera padding; the active pilot directory overlay is Koufu @ JEM (`L2` + `L3`) with official floor-map image backplates, unit-aligned polygons, computed fit-to-viewport scaling, and explicit zoom controls.
- Map marker semantics are standardized across map surfaces: hawker centre = orange, food court = teal, restaurant = grey/text-muted.
- Core client state now persists across cold starts (session, profile, search filters/history, location, review draft) using Zustand persist + AsyncStorage.
- Root Expo scaffold, typed domain layer, Zustand stores, and mock repositories are in place
- Discover, Search, Details, Auth, Onboarding, Profile, Review, Reads, and recovery flows are implemented in the mobile app shell
- Review compose now supports real library photo attachments via `expo-image-picker` (dev client/native build required).
- The current runtime shell is browse-first for public discovery surfaces. Signed-out users route through Splash into `MainTabs` and are redirected to auth only for protected actions.
- In `__DEV__`, app now boots into the Developer Launcher to speed QA state setup (signed out / onboarding incomplete / onboarding complete presets).
- Developer Launcher Merchant Mode now seeds the dev merchant state and bypasses the merchant sign-in gate before opening MerchantTabs.
- Mock discovery data now includes a broader set of Singapore hawker centres and food courts with expanded stall/dish coverage
- Maps now include a Figma-shaped `Maps` tab, a real `MapZoomedIn` route, and polygon-based building directory layouts (including Wisma and JEM mall-style floor overlays with vertical level switching).
- **Design Specifications** — Comprehensive visual, UX, and accessibility specs for all remaining backlog items are now available in `docs/audit/`. These serve as the authoritative implementation guide for Batch 1–8.
- Current Full Audit V1 status: source/static gates pass, Supabase migrations through `20260524032500_fix_upsert_stall_interaction_return_query.sql` are applied to linked Hungry staging, and the Supabase Advisor cleanup resolved app-owned public SECURITY DEFINER findings. The linked Security Advisor is still not clean: 9 findings remain for Supabase-owner PostGIS objects plus leaked-password protection. Expo Doctor now passes 18/18 after SDK 55 patch-version alignment; local TruffleHog now runs with 0 verified/unverified secrets. Prepared iOS Maestro smoke now passes on iPhone 17 Pro / iOS 26.1 when Metro runs in LAN mode with Watchman disabled and the smoke is given the generated LAN Metro URL. Live Supabase chat/DM smoke now passes through checked RPCs, Realtime delivery, direct-write denial, non-participant denial, and read receipts; live social/gamification smoke now passes report, moderation, block, FoodCred, stall interaction, and mission-progress checks; live OCR smoke now uploads a menu image, invokes `ingest-menu-photo`, reaches `succeeded`, and creates `dishes_draft` rows. Android/EAS proof is missing, and store/security owner gates remain open; see `tasks/verification.md`.

## Commands

- `npm install`
- `npm run start`
- `npm run ios`
- `npm run android`
- `npm run typecheck`
- `npm run data:enrich`
- `npm run data:supabase:stage:canonical`
- `npm run data:supabase:stage:canonical:split`

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
