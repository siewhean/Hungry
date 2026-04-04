# Hungry — Mobile Frontend

Hungry is a dish-first food discovery app for Singapore hawker centres and food courts. Built with Expo + React Native. Frontend-only, mock-first, iOS + Android.

---

## Quick Reference

| Need | Go to |
|------|-------|
| Start here (agents) | `AGENTS.md` |
| Workflow rules | `CLAUDE.md` |
| Tech stack + commands | `tasks/environment.md` |
| Design tokens + components | `tasks/design-system.md` |
| Screen inventory + navigation | `tasks/screens.md` |
| Domain types + mock data | `tasks/data-contracts.md` |
| Testing + feedback loops | `tasks/test-harness.md` |
| Product requirements (summarised) | `tasks/product-context.md` |
| Current task list | `tasks/todo.md` |
| Past lessons | `tasks/lessons.md` |
| Product requirements | `Research/01_Product_Requirements_Document_Hungry.docx` |
| App flow spec | `Research/02_App_Flow_Document_Hungry.docx` |
| Frontend guidelines | `Research/03_Frontend_Guidelines_Hungry.docx` |
| UI prototypes | `design/figma-v2/` and `design/figma-redesign/` |

---

## What This App Is

| Key | Value |
|-----|-------|
| Product | Hungry — dish-first food discovery |
| Market | Singapore (hawker centres, food courts, restaurants) |
| Platform | iOS + Android (Expo SDK 54 / React Native 0.81) |
| Phase | Consumer app, frontend-only, mock data only |
| Not in scope | Website, admin portal, backend API, business portal |
| Core idea | Find the dish you want, then see which stall serves it — not the other way around |
| Taste model | 6-axis vector: sweet · spicy · sour · salty · rich · aromatic |

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Expo SDK 54 + React Native 0.81 |
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
| `npm run test` | Jest test suite |

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
| Profile, Favourites, Review History | Done |
| Review flow | Done |
| Reads (feature-flagged) | Done |
| Offline + NotFound states | Done |
| Typecheck | Passing |
| Expo Doctor | Passing |
| Agent harness docs | Done |
| Unit tests | Pending |

---

## Notes

- Mock data lives exclusively in `src/lib/services/mock/data.ts`
- Design tokens live exclusively in `src/theme/tokens.ts` — never hardcode values
- The app runs fully without network or backend
- `Reads` tab is behind `FEATURE_FLAGS.readsEnabled` (default `true`)
- Map mock mode: set `FEATURE_FLAGS.mockMapboxEnabled = true` for test environments
