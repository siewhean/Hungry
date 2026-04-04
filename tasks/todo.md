# Hungry Mobile Frontend TODO

- [x] Create root Expo app scaffold and repo bootstrap docs
- [x] Install app dependencies and verify typecheck
- [x] Build shared theme, tokens, types, stores, and mock services
- [x] Implement navigation shell and guest/auth gating
- [x] Implement Discover and Search flows
- [x] Implement Dish and Stall detail flows
- [x] Implement Auth, Onboarding, Profile, and Review flows
- [x] Implement Reads and recovery states
- [x] Run typecheck and record review notes

## Review

- Mock discovery dataset expanded to include additional food courts/hawker centres and their stalls/dishes.
- `npm run typecheck` passes.
- `npx expo-doctor` passes after adding `react-native-worklets` and running a dedupe pass.
- The app is frontend-only and mock-first; no backend or security work was started.
