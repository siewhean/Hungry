# Changelog

## 2026-04-13

- Prompt: "Do 1+3. Use any agents/skills necessary to assist you in your task"
- Actions:
  - Confirmed graph rebuild process completion by checking PID status (original rebuild PID no longer running).
  - Completed P2-42 typed-navigation cleanup by replacing all remaining `useNavigation<any>()` callsites with typed RootStack navigation props.
  - Updated Discover map navigation to use typed root navigation to MainTabs/Maps.
  - Re-ran typecheck after patch and fixed one JSX regression from the edit.
  - Updated tasks/todo.md to mark P2-42 done, check sprint checklist items, and append session/verification evidence.

- Prompt: "Continue. Select a suitable agent to assist you in the work"
- Actions:
  - Used the `Explore` subagent to inventory direct `mockRepository` usage and produce a migration recipe for P1-ARCH-07 batch-1.
  - Migrated `DishDetailScreen` and `StallDetailScreen` from direct `mockRepository` calls to `getDataRepository()` from `serviceProvider`.
  - Verified successful compilation and tests after migration.
  - Updated `tasks/todo.md` with P1-ARCH-07 batch-1 completion and added a session log entry for Batch 2026-04-13I.
  - Continued P1-ARCH-07 batch-2 and migrated discover screens (`DecideForMeResultScreen`, `HomeMapScreen`, `CraveScreen`, `DiscoverHomeScreen`, `BuildingDrillDownScreen`) to `getDataRepository()` access.
  - Confirmed `MapZoomedInScreen` had no direct `mockRepository` usage and required no code changes.
  - Re-verified with `npm run typecheck` and `npm test -- --runInBand`, then updated `tasks/todo.md` with Batch 2026-04-13J progress.
  - Continued P1-ARCH-07 batch-3 and migrated search/review screens (`SearchResultsScreen`, `ReviewHubScreen`, `ReviewRatingScreen`, `ReviewComposeScreen`) from direct `mockRepository` imports to `getDataRepository()` access.
  - Verified batch-3 targets contain no `mockRepository` references and re-ran validation gates (`npm run typecheck`, `npm test -- --runInBand`) successfully.
  - Updated `tasks/todo.md` with Batch 2026-04-13K completion evidence and next-step handoff to batch-4 profile scope.
  - Continued P1-ARCH-07 batch-4 and migrated profile screens (`ProfileHomeScreen`, `FavouritesScreen`, `ReviewHistoryScreen`) from direct `mockRepository` imports to `getDataRepository()` access.
  - Verified batch-4 targets contain no `mockRepository` references and re-ran validation gates (`npm run typecheck`, `npm test -- --runInBand`) successfully.
  - Updated `tasks/todo.md` with Batch 2026-04-13L completion evidence and next-step handoff to batch-5 remaining-screen scope.
  - Continued P1-ARCH-07 batch-5 and migrated remaining target screens (`PostComposerScreen`, `BlogPostWebViewScreen`, `FoodSelectionScreen`, `WheelResultModal`, `WheelEntryAddSheet`) from direct `mockRepository` imports to `getDataRepository()` access.
  - Completed batch-6 and straggler cleanup by migrating `DeveloperLauncherScreen`, `ManualLocationPickerScreen`, and `src/features/home/bites.ts` to provider-backed repository access.
  - Verified direct repository-import done gate (`grep -rn 'from.*mock/repositories' src/app/ src/features/`) is now clean and re-ran validation gates (`npm run typecheck`, `npm test -- --runInBand`) successfully.
  - Updated `tasks/todo.md` with Batch 2026-04-13M/N completion evidence and marked architecture grep done gate complete.
  - Completed `P2-62` by gating `DeveloperLauncher` route registration behind `__DEV__` in `RootNavigator`, so the screen is omitted from the production navigation stack.
  - Re-ran validation gates after route-gating changes (`npm run typecheck`, `npm test -- --runInBand`) and updated `tasks/todo.md` with Batch 2026-04-13O evidence.

- Prompt: "Do sprint 3 for codex primaray based on the todo. Select a suitable agent to assist you in the work"
- Actions:
  - Used the `Explore` subagent to audit Sprint-3 Codex scope (`P1-49` to `P1-53`, `P2-63`) and identify exact dead-end/UI-copy hotspots.
  - Implemented conservative Sprint-3 Codex defaults directly in production code: feature-flagged DirectMessages entry points (`directMessagesEnabled: false`), removed HomeFeed placeholder comments bottom sheet, removed Crave dead info affordance, and wired Profile "Recently saved" cards to `DishDetail`.
  - Replaced hardcoded location and gamification strings by deriving Home/Discover location labels from `useLocationStore` + nearest-building computation and replacing Profile hardcoded prose with profile-stats-driven text.
  - Re-verified using hardcoded-string grep plus validation gates (`npm run typecheck`, `npm test -- --runInBand`).
  - Updated `tasks/todo.md` Sprint-3 execution statuses and appended Batch 2026-04-13P session evidence.

- Prompt: "Are you connected to the graphify server? Do 1+2"
- Actions:
  - Confirmed Graphify runtime availability via Python import and checked active rebuild state/process metadata.
  - Ran a full parser-based Pressable semantics audit over `src/app/screens/**/*.tsx`, identified remaining misses, and fixed them in Home/Discover/Onboarding screen implementations.
  - Removed or rewired non-functional Pressables in `DirectMessagesScreen`, `HomeMapScreen`, `BuildingDrillDownScreen`, and `TasteQuizScreen` so the Sprint-3 Pressable done gate is clean.
  - Fixed a pre-existing `HomeFeedScreen` duplicate declaration issue uncovered during verification and re-ran `npm run typecheck` successfully.
  - Verified graph rebuild completion state: no active `_rebuild_code(Path('.'))` process remains.
  - Updated `tasks/todo.md` done gate, session log (`Batch 2026-04-13Q`), and verification command log.

- Prompt: "Work on the following: optional simulator smoke pass / optional device screenshot QA / optional runtime accessibility/device smoke"
- Actions:
  - Ran baseline validation gates before smoke execution (`npm run typecheck`, `npm test -- --runInBand`) and confirmed green status.
  - Confirmed iOS simulator availability and launched the app on booted simulator via `xcrun simctl launch booted app.hungry.mobile`.
  - Captured screenshot QA artifacts in `output/qa/` (`simulator-smoke-20260413-221110.png`, `simulator-wheel-join-20260413-221210.png`) including a configured deep-link route (`hungry://join/DEMO`).
  - Ran an interactive Pressable accessibility smoke heuristic and saved report to `output/qa/accessibility-smoke-20260413.txt`.
  - Logged findings: `INTERACTIVE_PRESSABLES=108`, `MISSING_A11Y_PROPS=95` (runtime accessibility hardening remains open).
  - Updated `tasks/todo.md` session and verification logs with Batch 2026-04-13R evidence.

- Prompt: "Continue"
- Actions:
  - Executed accessibility remediation batch on the highest-deficit screens from the smoke report (`DiscoverHomeScreen`, `HomeMapScreen`, `WheelEntryAddSheet`, `ProfileHomeScreen`, `BuildingDrillDownScreen`, `HomeFeedScreen`, `DirectMessagesScreen`).
  - Added explicit `accessibilityRole`/`accessibilityLabel` metadata to interactive Pressables flagged in those files.
  - Re-ran project typecheck (`npm run typecheck`) to confirm compile health after the patch.
  - Rebuilt accessibility smoke report with a multiline parser-aware heuristic to account for multi-line JSX props and saved artifact `output/qa/accessibility-smoke-20260413-postfix.txt`.
  - Recorded improved metric: remaining missing explicit accessibility metadata reduced to `MISSING_A11Y_PROPS=59`.
  - Updated `tasks/todo.md` session and verification logs with Batch 2026-04-13S evidence.

- Prompt: "Work on Sprint 4 for codex"
- Actions:
  - Installed production infra dependencies via Expo-compatible versions: `@sentry/react-native`, `posthog-react-native`, and `expo-secure-store`.
  - Added Sentry initialization and wrapped app root in `Sentry.ErrorBoundary` in `App.tsx`.
  - Implemented PostHog sink module (`src/lib/analytics/posthogSink.ts`) and wired it in bootstrap (`useAppBootstrap`) through `setAnalyticsSink(posthogSink)`.
  - Added PostHog identity lifecycle wiring in `useSessionStore` (`identify` on sign-in, `reset` on sign-out/session clear) with user properties `{ tasteVector, dietaryPreferences, area }`.
  - Added missing `dish_viewed` event instrumentation in `DishDetailScreen` so Sprint 4 analytics done-gates have full event coverage.
  - Added `src/store/secureStorage.ts` and migrated session persistence from AsyncStorage-backed adapter to SecureStore-backed adapter with legacy fallback migration.
  - Added CI workflow at `.github/workflows/ci.yml` with quality gates (`typecheck`, `test`, `expo-doctor`) and EAS build gate conditioned on `EXPO_TOKEN`.
  - Created environment variants (`.env.development`, `.env.staging`, `.env.production`) and updated `.gitignore` to include all env variants.
  - Extended feature flags with `commentsEnabled` and `craveEnabled`, then gated Crave route/entrypoint and comments UI surface accordingly.
  - Verified with `npm run typecheck`, `npm run test`, and `npx expo-doctor` (all green).

## 2026-04-14

- Prompt: "Execute global routing and navigation updates first, then wait for confirmation"
- Actions:
  - Renamed the former Reads tab route to `Review` and rewired the existing review-compose tab route to `Rate` to prevent duplicate tab keys while preserving both experiences.
  - Updated tab bar label rendering and icon mapping to reflect the new tab semantics (`Review` for editorial review feed, `Rate` for review submission flow).
  - Updated route references in navigation helpers and auth return-route handling (`RootNavigator`, `ReviewHubScreen`, and `DeveloperLauncherScreen`) to the new tab keys.
  - Updated `ReadsFeedScreen` copy and tab typing so section headers/messages now reflect `Review` naming.
  - Embedded the map experience directly into Discover by adding `DiscoverTabScreen` with an in-tab `Map/Explore` mode switch that mounts `HomeMapScreen` and `DiscoverHomeScreen` without removing existing functionality.
  - Verified compile and runtime safety gates after the first-block patch set: `npm run typecheck` and `npm run test` both pass.

- Prompt: "The maps should be within an icon in the discover page... Remove the labels for the page"
- Actions:
  - Removed the standalone `Maps` bottom-tab route and replaced it with a dedicated stack route (`DiscoverMap`) so map access now comes from Discover actions instead of a separate tab.
  - Restored Discover as the full Discover surface (`DiscoverHomeScreen`) and rewired Discover map entry points (header MAP pill and stalls VIEW MAP action) to open `DiscoverMap`.
  - Updated tab composition to exactly `Home`, `Discover`, `Review`, `Rate`, and `Profile`, and hid bottom-tab labels (`tabBarShowLabel: false`).
  - Remapped tab content so `Review` now uses the previous home experience, while `Home` renders a social-feed mode and `Review` renders a review-focused mode (Bites + Community favourites + Fastest near you + Comfort food).
  - Updated the developer launcher map shortcut to use `DiscoverMap` and removed stale `Maps` route references from tab-return logic.
  - Re-ran validation gates after remap (`npm run typecheck`, `npm run test`) with all checks passing.

- Prompt: "The home page social feed I am referring to is the post with stories with messages"
- Actions:
  - Updated Home social mode to explicitly restore the stories rail (`BitesCarousel`) above the social post stream.
  - Enabled feed message interaction affordances by turning on `commentsEnabled` in feature flags so post cards display message counts/icons.
  - Kept Review/Rate/Profile routing unchanged from the prior remap while refining only the Home social presentation.

- Prompt: "Refer to github to see the previous code for the home page. The current one is still not correct"
- Actions:
  - Compared current Home implementation against the git HEAD version of `HomeFeedScreen` and restored Home social mode structure to match the previous GitHub behavior.
  - Reverted Home social presentation to stories in header plus horizontal post sections (instead of vertical flattened social list), preserving post-level message interactions.
  - Kept Review tab behavior intact (Bites + community/fastest/comfort sections) while isolating the Home correction.

- Prompt: "ERROR [runtime not ready]: Error: [@RNC/AsyncStorage]: NativeModule: AsyncStorage is null"
- Actions:
  - Hardened `persistStorage` and `secureStorage` by replacing eager AsyncStorage imports with guarded lazy loading.
  - Added runtime checks so when AsyncStorage native module is unavailable, adapters transparently fall back to in-memory storage without crashing.
  - Preserved legacy migration behavior in `secureStorage` when AsyncStorage is available, while avoiding runtime-null failures when it is not.

- Prompt: "The home feed is still different... use the iteration with stories, like, saved, comment, messages, post"
- Actions:
  - Compared Home feed against prior git iterations and restored Home social mode to a stories-plus-post stream flow instead of sectioned "Fastest near you" style grouping.
  - Added a social-feed source (`getHomeSocialFeed`) that ranks posts by taste similarity and removed section-title dependency from Home social rendering.
  - Kept interaction affordances in Home social cards (like, save, comment, message/share, and post CTA) while preserving review-mode section rendering separately.

- Prompt: "ERROR [ReferenceError: Property 'colorScheme' doesn't exist]"
- Actions:
  - Fixed runtime crash in `ProfileHomeScreen` by adding `colorScheme` to the `useHungryTheme()` destructuring in the main screen component.
  - Preserved existing light/dark card color behavior for the taste-summary block without changing UI logic.

- Prompt: "ERROR [ReferenceError: Property 'useUIStore' doesn't exist]"
- Actions:
  - Fixed runtime crash in `SettingsScreen` by adding the missing `useUIStore` import from `@/store/useUIStore`.
  - Preserved existing appearance preference behavior (`themePreference` and `setThemePreference`) with no logic changes.

- Prompt: "Remove the hygeine grade in the project"
- Actions:
  - Removed hygiene-grade UI from all active stall-facing surfaces: `StallDetailScreen`, `StallCard`, `StallHeader`, and `WheelResultModal`.
  - Removed `HygieneGradeBadge` from stall barrel exports and deleted the now-unused component file.
  - Kept domain/data fields intact to avoid disruptive schema refactors while fully removing hygiene-grade presentation from runtime UI.
  - Fixed a surfaced compatibility break in `useImplicitSignalCollector` by replacing stale `getService()` usage with `getHungryService()` from `serviceProvider` so validation gates remain green.

- Prompt: "ERROR Encountered two children with the same key ... '.$d5h2sz27gv'"
- Actions:
  - Traced the duplicate key signature to wheel entry IDs generated by `useWheelStore` (`Math.random().toString(36).substring(2, 12)`), where local optimistic append and realtime echo could both append the same entry.
  - Added `appendEntryUnique()` and `dedupeEntries()` safeguards in `useWheelStore` to guarantee entry uniqueness by `entry.id` across local adds, realtime `entry_added` events, and party-join hydration.
  - Preserved immediate local add UX while preventing duplicate entry objects that caused React duplicate-key warnings in wheel render surfaces.
  - Revalidated with `npm run typecheck` and `npm test -- --runInBand`; both passed.

## 2026-04-15

- Prompt: "Allow users to view other user's profile and comment when the users click on the icon"
- Actions:
  - Added a new root route `UserProfile` and implemented `UserProfileScreen` to display another user's avatar, location, post stats, comment stats, and recent posts.
  - Wired Home social-feed icon interactions to this profile route: story avatars, post author avatar/name, review-card author text, and comment-row avatars now open the selected user's profile.
  - Upgraded the Home comments bottom sheet from read-only display to interactive commenting by adding composer state, comment submission, local comment persistence per post, and live comment-count increment after posting.
  - Registered `UserProfileScreen` in `RootNavigator` and updated `RootStackParamList` typing for end-to-end typed navigation.
  - Revalidated with `npm run typecheck` and `npm run test -- --runInBand`; both passed.

- Prompt: "ERROR [ReferenceError: Property 'useUIStore' doesn't exist]"
- Actions:
  - Fixed `HomeFeedScreen` runtime crash by adding the missing `useUIStore` import from `@/store/useUIStore`.
  - Revalidated with `npm run typecheck` and `npm run test -- --runInBand`; both passed.
