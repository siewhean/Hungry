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

## Notes

- Source-of-truth product requirements currently live in the three Hungry docx files in the repo root.
- Added an interview question bank for multi-persona customer and stall-operator research at `Research/agent_interview_question_bank.md`.
- Reads stays behind a feature flag even though the tab contract exists now.
- The app is designed to demo end-to-end without backend availability.
