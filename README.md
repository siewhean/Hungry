# Hungry Mobile Frontend

Hungry is a mock-first Expo + React Native mobile app for dish-first food discovery in Singapore. This repo currently focuses on the iOS and Android consumer app only.

## Current Scope

- Consumer mobile app only
- Frontend-first implementation with local fixtures and typed service adapters
- No website, business portal, backend wiring, or security implementation in this phase

## Stack

- Expo SDK 54
- React Native 0.81
- TypeScript strict mode
- React Navigation
- Zustand
- React Hook Form
- Reanimated
- `@gorhom/bottom-sheet`
- `@rnmapbox/maps` wrapper with mock-friendly surface fallback

## Status

- Root Expo scaffold, typed domain layer, Zustand stores, and mock repositories are in place
- Discover, Search, Details, Auth, Onboarding, Profile, Review, Reads, and recovery flows are implemented in the mobile app shell
- Mock discovery data now includes a broader set of Singapore hawker centres and food courts with expanded stall/dish coverage
- `npm run typecheck` and `npx expo-doctor` both pass in the local environment

## Commands

- `npm install`
- `npm run start`
- `npm run ios`
- `npm run android`
- `npm run typecheck`
- `npm run data:enrich`

## Notes

- Source-of-truth product requirements currently live in the three Hungry docx files in the repo root.
- Reads stays behind a feature flag even though the tab contract exists now.
- The app is designed to demo end-to-end without backend availability.
- The `data/` folder also contains the Singapore food-business workbook, a checked-in curated seed snapshot, and the refresh pipeline for rebuilding the database from public datasets plus supplementary hawker- and food-court-source discovery.

## Delivery Governance

- Shared task requirements and cross-agent checklist live in `tasks/todo.md`.
- Claude and Codex should both update `tasks/todo.md` frequently during execution (at minimum once per focused work block and before ending a session).
- Planning-first execution is required: create/update a scoped mini-plan before non-trivial implementation work, then record verification before checking tasks complete.

## Future Roadmap

See `tasks/todo.md` for the full backlog. Key future features include:

- **Digital Ordering & Payments** — In-app ordering + PayNow/card checkout for hawker centres, food courts, and restaurants. Includes a vendor analytics dashboard (top dishes, peak hours, revenue), real-time crowd/busyness indicators per stall, and queue wait-time estimates. Crowd monitoring is derived from active order volume — no hardware sensors required for the MVP signal.
- **Interactive Indoor Maps** — SVG floor plans with polygon-level stall selection, open/closed colour coding, and pinch-to-zoom (see `design/figma-v2/building-layout.html` for mockups).
- **"Decide for Me" AI** — Personalised dish recommendation surfaced prominently in Discover.
- **Group Wishlists** — Shared save lists for planning meals with friends.
