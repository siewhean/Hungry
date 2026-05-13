# Changelog

## 2026-05-01

- Prompt: "Resolve all of the errors in the terminal"
- Actions:
  - Made the Supabase service provider lazily load Supabase modules via getters to avoid React Native module evaluation during Node-based tests.
  - Re-ran `npm run typecheck` and `npx tsx --test src/lib/services/serviceProvider.sprint5.test.ts` to confirm the esbuild transform error is gone.
- Prompt: "The story is still not working, the status bar is not progressing and clicking does not do anything"
- Actions:
  - Started story progress immediately (removed measurement gating) while retaining pixel/percentage fallback rendering.
  - Ensured header overlay elements and progress tracks do not consume touches by adjusting `pointerEvents`.
  - Made story "seen" updates idempotent to prevent maximum update depth loops from repeated store writes.
  - Re-ran `npm run typecheck` to confirm no TypeScript regressions.
- Prompt: "Stories that are view should be placed at the back of the story list. The transition between users did not happen when I tap on the screen"
- Actions:
  - Reordered story lists by `hasUnseen` so viewed stories move behind unseen ones after load and when marking seen.
  - Switched story viewer navigation to use `activeStoryId` to keep the same story selected even after list reordering.
  - Ensured swipe transitions are not overridden by index resets during story changes.
  - Re-ran `npm run typecheck` to confirm no TypeScript regressions.
- Prompt: "I want a rotating block transition"
- Actions:
  - Replaced user-change swipe transitions with a rotate-Y block animation and kept same-user taps instant.
  - Reset the rotation on story changes to avoid stuck transforms.
  - Re-ran `npm run typecheck` to confirm no TypeScript regressions.
- Prompt: "My story should always be first, it should not move to the back"
- Actions:
  - Pinned the "Your story" item to the front of the story list while still ordering unseen items before seen ones.

## 2026-04-16

- Prompt: "There is an error" (runtime: `Tried to register two views with the same name SkiaPictureView`)
- Actions:
  - Diagnosed package/runtime state and confirmed single install of `@shopify/react-native-skia` with no duplicate Metro aliases.
  - Tested New Architecture disable path and found it incompatible with current `@rnmapbox/maps@10.3.0` (`Old React Native Architecture is no longer supported`).
  - Implemented targeted iOS Skia guard for New Architecture by wrapping `SkiaPictureViewManager` with `#ifndef RCT_NEW_ARCH_ENABLED`.
  - Made the fix durable via `patch-package`: added `patches/@shopify+react-native-skia+2.2.12.patch`, installed `patch-package` as dev dependency, and added `postinstall` hook.
  - Verified patch and native sync with `npm run postinstall`, `cd ios && pod install`, and `npm run typecheck`.

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

- Prompt: "Refer to todo.md and work on audit findings"
- Actions:
  - Resolved `AUD-01` by removing stale `ReadsFeed` return-route handling and auth-required route references from `RootNavigator` to prevent unknown-route reset crashes.
  - Resolved `AUD-02` by clearing persisted profile state (`clearProfile()`) during `signOut()` and `clearSession()` before profile sync/reset.
  - Verified `AUD-03` was already compliant in current `App.tsx` (`EXPO_PUBLIC_SENTRY_DSN` direct usage, no dead fallback branch).
  - Resolved `AUD-04` by adding a real CI lint gate (`npm run lint`) and introducing ESLint config/dependencies with a direct `eslint .` script.
  - Resolved `AUD-05` by replacing `navigation as any` in `ProfileHomeScreen` with `NativeStackNavigationProp<ProfileStackParamList, "ProfileHome">` cast.
  - Resolved `AUD-06` by replacing remaining onboarding hardcoded pill radii with theme token usage (`radii.pill`).
  - Resolved `AUD-07` by replacing Login icon hardcoded `#FFFFFF` with `palette.white`.
  - Resolved `AUD-08` by removing hardcoded amber duplicate in wheel winner badge gradient.
  - Resolved `AUD-09` by adding `@deprecated` JSDoc to the legacy `dataRepository` proxy export in `serviceProvider.ts`.
  - Updated `tasks/todo.md` audit checklist to mark `AUD-01` through `AUD-09` complete with `AUD-03` noted as verified-noop.

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

- Prompt: "The automatic should either show light mode or dark mode based on the user's preference on their device. Currently, the automatic does not change to either light or dark mode and the dark mode looks different from the dark mode setting."
- Actions:
  - Hardened `HungryThemeProvider` automatic color-scheme resolution in `src/theme/index.tsx` by combining `useColorScheme()` with `Appearance` listener updates.
  - Added app-foreground refresh (`AppState` active transition) to re-read `Appearance.getColorScheme()` so scheduled or out-of-app system theme changes are reflected when returning to the app.
  - Synchronized global React Native appearance override with user preference using `Appearance.setColorScheme(...)`: explicit `light`/`dark` now forces app-wide scheme, while `automatic` releases override (`null`) to follow device setting.
  - Kept manual `light`/`dark` override behavior unchanged while making `automatic` reliably mirror device preference.
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "There is still no difference after the change"
- Actions:
  - Identified `HomeFeedScreen` as a visual override source: it was applying time-of-day (`isLateNight`) tint logic independent of theme preference/device scheme.
  - Removed the time-based color override and aligned feed tinting to active theme tokens (`colorScheme`/`palette`) so automatic-dark and manual-dark render consistently.
  - Removed debug-only theme text from the Home header and updated overlay/badge styling to use theme-derived colors.
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "The discover page is dark even though the rest are light mode when it is on automatic"
- Actions:
  - Identified the same root cause pattern in `DiscoverHomeScreen`: time-based `isLateNight` tint overrides were forcing dark visuals independent of active theme mode.
  - Removed Discover time-based visual overrides and switched tinting to active `colorScheme`/theme palette only.
  - Preserved late-night chip ordering behavior as a non-visual UX hint (separate from theme rendering).
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "Allow users to reply to the comments in the reviews and comment section"
- Actions:
  - Added reply support to Home social comments sheet in `HomeFeedScreen`: per-comment `Reply` actions, nested reply rendering, inline reply composer, and local reply persistence by comment ID.
  - Added reply support to detail review surfaces in `DishDetailScreen` and `StallDetailScreen`: per-review `Reply` actions, nested reply threads, and inline reply composer with local reply state.
  - Preserved existing comment/review posting behavior while extending it with local threaded replies.
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "Indicate the time in terms of how long ago the user sent the comment. Within the bites section, the user should be able to click on the hearts and comments section. It should not open the food info when the user click on the card."
- Actions:
  - Added shared relative-time utility `formatTimeAgo` in `src/lib/date/formatTimeAgo.ts` and applied it to Home comment/reply timestamps, detail review/reply timestamps, and shared `ReviewCard` timestamp rendering.
  - Updated `BiteCard` and `BitesCarousel` interaction wiring so bites cards no longer route to dish-detail on card tap, while heart/comment controls remain explicitly clickable with visible count feedback.
  - Removed comment-button fallback navigation to dish details inside `BiteCard` so comment interaction no longer opens food info.
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "[TextInputUI] Result accumulator timeout ... Attempted to update accumulator ... after completion has already been called"
- Actions:
  - Traced the warning path to iOS keyboard/prediction internals interacting with React Native text fields, then added a low-risk mitigation in shared input handling.
  - Hardened `src/components/ui/Input.tsx` so secure text fields default to `autoCorrect={false}`, `spellCheck={false}`, and `autoComplete="off"` unless explicitly overridden by a caller.
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "Help me to remove it in the discoverhomepage"
- Actions:
  - Removed Discover-only extra bottom scroll spacing in `src/app/screens/discover/DiscoverHomeScreen.tsx` (`paddingBottom: spacing[24]`) to eliminate the visible horizontal gap above the tab bar without changing shared `Screen` behavior.
  - While validating, fixed an unrelated existing compile break in `src/app/screens/onboarding/OnboardingIntroTemplate.tsx` by restoring theme palette access inside `SlideIllustration`.
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "The bites section within the review section do not have the right left padding."
- Actions:
  - Added a `horizontalInset` prop to `BitesCarousel` (default `0`) and applied it in Review mode (`HomeFeedScreen`) as `spacing[3]` so the Bites section aligns with other left-padded sections on the page.
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "Remove the Good morning and number of stalls nearby on the top of the screen in the home and review page" + reported JSX transform error in `HomeFeedScreen`.
- Actions:
  - Removed the greeting and nearby-stalls summary row from `HomeFeedScreen` header rendering so both Home and Review surfaces no longer show that top text.
  - Preserved DirectMessages entry for social mode by rendering it in a compact top-right control without the removed text row.
  - Fixed malformed JSX in `HomeFeedScreen` by removing duplicated `BottomSheetScrollView`/`BottomSheetModal` closing tags that caused the transform parser error.
  - Repaired a concurrent syntax corruption in `src/components/ui/Input.tsx` (accidental placeholder token and missing `forwardRef` closure), then corrected `Input` usage in `HomeFeedScreen` (`maxHeight` moved to `style`).
  - Revalidated with `npm run typecheck` in root; passed.

- Prompt: "There are 1099 warnings within xcode, resolve all of the warnings with minimal code changes while not affecting usability and main code base"
- Actions:
  - Audited iOS build warning sources with repeated `xcodebuild` log extraction and warning-family aggregation.
  - Applied minimal iOS build-configuration changes in `ios/Podfile` to suppress non-functional third-party warning classes and keep linker noise lower (`inhibit_all_warnings!`, pod/user target warning flags, deployment-target normalization, and duplicate-library linker suppression flag).
  - Repaired transient lockfile conflict markers in `ios/Podfile.lock` introduced during interrupted CocoaPods runs and resynced the sandbox via `pod install`.
  - Reverted a failed header-wrapper suppression experiment that introduced ExpoModulesCore compile errors, then restored dependency headers and revalidated.
  - Final verification: `xcodebuild` succeeds (`BUILD_EXIT:0`, `ERROR_COUNT:0`, `TOTAL_WARNING_LINES:1`), `npm run typecheck` passes, and `npm test -- --runInBand` passes (23/23).
  - Remaining warning is a single Xcode AppIntents metadata processor notice (`Metadata extraction skipped. No AppIntents.framework dependency found.`); app usability and feature behavior are unchanged.

## 2026-04-15

- Prompt: "Refer to the document and update the existing code based on the documnet guidelines. Create and complete the task in multiple phases. Activate the appropriate agents for the respective tasks"
- Actions:
  - Activated `Project Shepherd` subagent to generate a phased implementation plan from `tasks/Roadmap/production-infrastructure.md` and activated `Backend Architect` subagent to validate a minimal-diff patch set before code edits.
  - Phase 1 (environment strategy): expanded `.env.development`, `.env.staging`, and `.env.production` placeholder templates to the full variable catalog (`Supabase`, `Mapbox`, `PostHog`, `Sentry`, `EAS`) and aligned staging/production `HUNGRY_DATA_SOURCE=supabase`.
  - Phase 2 (pipeline/config): updated `.gitignore` to keep committed template env files while ignoring local secret overlays, aligned `eas.json` channels/env blocks, and added Sentry-related GitHub secret pass-through in `.github/workflows/ci.yml` EAS build gate.
  - Phase 3 (observability + analytics): hardened `Sentry.init` in `App.tsx` with environment tagging, non-production trace suppression, and `beforeSend` PII stripping; extended analytics event union; added explicit `sign_up_completed` event on email verification; instrumented `decide_for_me_triggered`, `decide_for_me_result_shown`, `decide_for_me_no_match`, `decide_for_me_radius_expanded`, and `delivery_link_tapped` events in discover/detail flows.
  - Updated Sprint 4 execution tracking in `tasks/todo.md` with phase-based completion status and remaining launch-smoke evidence gate.
  - Re-validated project health: `npm run typecheck`, `npm run test`, and `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor` all passed.

- Prompt: "Replace the sensitive information with the variables in the .env file"
- Actions:
  - Sanitized `tasks/Roadmap/production-infrastructure.md` Section 1.2 by removing hardcoded credential/token literals.
  - Replaced each sensitive value with environment-variable references (for example `${EXPO_PUBLIC_SENTRY_DSN}`, `${SENTRY_AUTH_TOKEN}`, `${EXPO_TOKEN}`) so the document retains the variable contract without exposing secrets.

- Prompt: "Try again"
- Actions:
  - Re-ran implementation validation for the AI recommendation engine after a prior incomplete attempt and confirmed app-shell integrity was unchanged.
  - Used the `Explore` subagent to compare roadmap requirements against current recommendation implementation and identify high-impact correctness gaps.
  - Updated `src/lib/ai/tasteEngine.ts` to enforce diversity caps in recommendation slates (max 3 dishes per venue, max 2 per dominant taste axis, with wildcard backfill when available).
  - Corrected feedback update math so negative explicit/implicit signals now move taste vectors away from disliked dishes.
  - Added explicit feedback recency decay support and propagated timestamps from profile interactions in `src/store/useProfileStore.ts`.
  - Added regression coverage in `src/lib/ai/tasteEngine.pipeline.test.ts` for negative-signal behavior, recency decay weighting, and diversity-cap enforcement.
  - Revalidated with `npm run typecheck` and `npm run test -- --runInBand` (30 tests passing).

## 2026-04-17

- Prompt: "solve this and I am unable to access dishdetail"
- Actions:
  - Fixed JSX transform failure in `src/app/screens/search/SearchResultsScreen.tsx` by closing the `isLoading ? ... : ...` conditional render block with the missing `)}` before `</Screen>`.
  - Fixed Dish Detail quick-review payload typing in `src/app/screens/detail/DishDetailScreen_Premium.tsx` by supplying required `venueId` and passing `dishId`/`dishName` in `showQuickReview(...)`.
  - Fixed missing React hook import in `src/app/screens/detail/StallDetailScreen.tsx` by adding `useEffect` to the React import list.
  - Corrected `PressableProps` import semantics in `src/components/ui/Button.tsx` to ensure it is imported as a type-only specifier.
  - Revalidated with `npm run typecheck`; passed.

- Prompt: "I am not able to click on the cards in the review section"
- Actions:
  - Updated review-mode card rendering in `src/app/screens/home/HomeFeedScreen.tsx` so each review card container is a `Pressable` that routes to `DishDetail` using the first dish ID, with fallback to `StallDetail` when no dish exists.
  - Added `event.stopPropagation()` to nested review-card controls (like/save/profile/stall links) to prevent parent card press from overriding inner actions.
  - Revalidated with `npm run typecheck`; passed.

- Prompt: "WARN [expo-av]: Expo AV has been deprecated... Use expo-audio and expo-video"
- Actions:
  - Installed `expo-audio` and `expo-video`, then removed `expo-av` from dependencies and lockfile.
  - Migrated music preview playback in `src/components/review/MusicPicker.tsx` from `Audio.Sound` to `createAudioPlayer` from `expo-audio` with playback-complete state reset handling.
  - Migrated video playback in `src/components/social/ZoomableMedia.tsx` from `Video` (`expo-av`) to `VideoView` + `useVideoPlayer` (`expo-video`), preserving tap play/pause, mute toggle, and long-press 2x playback.
  - Verified no remaining `expo-av` usage via workspace search and revalidated with `npm run typecheck`; passed.
