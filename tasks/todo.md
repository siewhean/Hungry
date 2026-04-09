# Hungry — Consolidated Audit Backlog

> Generated 2026-04-09 by Claude (Opus) after a full codebase audit against product-context.md, design-system.md, screens.md, data-contracts.md, and the Figma prototypes.

---

## 1. Unchecked Phase 1 & Phase 3 Items

### Phase 1 — Product + Architecture Planning

| ID | Item | Owner |
|----|------|-------|
| P1-01 | Define/refresh architecture notes for mock-first now vs backend-connected later | Claude |
| P1-02 | Produce feature-level acceptance criteria for critical flows | Claude |
| P1-03 | Define event taxonomy for future social analytics (events, attributes, ownership) | Claude |
| P1-04 | Record tradeoffs/decisions directly in README (or linked docs) | Claude |
| P1-05 | Convert architecture decisions into concrete repository tasks | Codex |
| P1-06 | Create/update typed interfaces and TODO anchors matching planned contracts | Codex |
| P1-07 | Ensure implementation tasks are granular and checkable in this file | Codex |
| P1-08 | Planning artifacts committed and discoverable (done criteria) | Both |
| P1-09 | Every in-progress build task maps to a planned requirement (done criteria) | Both |

### Phase 2 — Core App Hardening (Done Criteria Still Open)

| ID | Item | Owner |
|----|------|-------|
| P2-DC1 | Critical user journeys run end-to-end in mock mode — verified | Both |
| P2-DC2 | Verification commands are green and logged | Both |

### Phase 3 — Data + Analytics Readiness

| ID | Item | Owner |
|----|------|-------|
| P3-01 | Specify analytics KPIs and dashboard-ready metric definitions | Claude |
| P3-02 | Define event-to-metric mapping and data quality expectations | Claude |
| P3-03 | Propose phased rollout path for backend/event ingestion | Claude |
| P3-04 | Add event instrumentation hooks in frontend service/store boundaries | Codex |
| P3-05 | Keep analytics hooks mock-safe (no backend dependency required) | Codex |
| P3-06 | Add data validation helpers for fixture integrity checks | Codex |
| P3-07 | Event schema documented and instrumentation implemented for key flows (done criteria) | Both |
| P3-08 | Mock data quality checks executable and recorded (done criteria) | Both |

---

## 2. Prioritised UX & State-Handling Backlog

### P0 — Blocker / Broken Flow

These items break core user journeys or render features non-functional.

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P0-01 | Onboarding | TasteQuiz results never persisted to `useProfileStore` — user's quiz answers are silently discarded after completing the flow | `TasteQuizScreen.tsx` |
| P0-02 | Onboarding | DietaryPreferences selections never persisted to any store — dietary flags are discarded on navigation | `DietaryPreferencesScreen.tsx` |
| P0-03 | Onboarding | LocationPermission `grantLocation()` does not call the system permission API and does not update `currentLocation` to real GPS — hardcoded to Singapore CBD default | `LocationPermissionScreen.tsx`, `useLocationStore.ts` |
| P0-04 | Auth | No form validation on any auth screen — `useForm` is used but no rules are passed; blank/invalid inputs submit silently | `LoginScreen.tsx`, `SignUpScreen.tsx`, `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx` |
| P0-05 | Home | "Decide For Me" FAB is absent from HomeFeedScreen — the FAB present is a "Post" action, not the product-spec discovery CTA | `HomeFeedScreen.tsx` |
| P0-06 | Maps | Map pin colours incorrect — `food_court` uses amber instead of teal; `hawker_centre`/`restaurant` both use navy instead of orange/grey | `HomeMapScreen.tsx:144–149` |
| P0-07 | Maps | `BuildingPin`, `FloorSelector`, `BuildingLegend`, `MapBottomSheet`, `ClusterPin` components all exist but are never used — HomeMapScreen re-implements its own variants inline | `HomeMapScreen.tsx`, `BuildingDrillDownScreen.tsx` |
| P0-08 | Discover | Taste filter unreachable — no navigation path from DishSearchScreen or SearchResultsScreen to TasteFilterScreen | `DishSearchScreen.tsx`, `SearchResultsScreen.tsx` |
| P0-09 | Discover | Category chips are decorative — chips on DiscoverHomeScreen use local state disconnected from `useSearchStore`; DishSearchScreen renders no chips at all | `DishSearchScreen.tsx`, `DiscoverHomeScreen.tsx` |
| P0-10 | Detail | DishDetail delivery buttons navigate to NotFound instead of calling `Linking.openURL` | `DishDetailScreen.tsx:125–129` |
| P0-11 | Detail | StallDetail delivery buttons navigate to NotFound instead of calling `Linking.openURL` | `StallDetailScreen.tsx:361` |
| P0-12 | Detail | StallDetail directions button navigates to NotFound instead of opening Apple/Google Maps | `StallDetailScreen.tsx:349–350` |
| P0-13 | Component | Badge `tone="orange"` renders as neutral (same as `tone="neutral"`) — affects all orange badges across Reads, DishDetail, DecideForMe | `Badge.tsx:15` |
| P0-14 | State | No Zustand `persist` middleware on any store — all auth state, profile, favourites, reviews, and preferences reset on every cold start | `useSessionStore.ts`, `useProfileStore.ts`, `useReviewDraftStore.ts`, `useLocationStore.ts`, `useSearchStore.ts` |
| P0-15 | Navigation | `SoftGateSheet` referenced in screens.md and product-context.md but does not exist in the codebase — no soft-gate mechanism for unauthenticated users on protected actions | — |

### P1 — UX / UI Degradation

These items degrade the user experience but do not fully block flows.

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P1-01 | Detail | DishDetail has no photo carousel — renders a single static image; `gallery` field from `DishDetail` type is unused | `DishDetailScreen.tsx:50–54` |
| P1-02 | Detail | DishDetail uses horizontal bars for taste profile instead of radar chart — `ProfileRadarChart` component exists but is not used here | `DishDetailScreen.tsx:74–110` |
| P1-03 | Detail | DishDetail price does not use `variant="price"` (DM Mono font) — plain `AppText` with `tone="secondary"` | `DishDetailScreen.tsx:68` |
| P1-04 | Detail | DishDetail delivery buttons lack brand colours — GrabFood green (#00B14F) and Foodpanda pink (#D70F64) not applied | `DishDetailScreen.tsx:120–132` |
| P1-05 | Detail | StallDetail reviews are hardcoded `MOCK_REVIEWS` constant — not linked to the venue's actual review data | `StallDetailScreen.tsx:25–40` |
| P1-06 | Detail | StallDetail closure notice rendered as plain text instead of `InlineBanner` (inconsistent with DishDetail which uses `InlineBanner`) | `StallDetailScreen.tsx:244–248` |
| P1-07 | Detail | StallDetail hygiene grade badge is a plain tile card — no colour-coding for A/B/C/D per the product spec | `StallDetailScreen.tsx:72–74` |
| P1-08 | Detail | StallDetail bookmark and share buttons show "coming soon" toasts — unimplemented | `StallDetailScreen.tsx:149–159` |
| P1-09 | Detail | DishDetail and StallDetail not-found fallback renders `EmptyState` without a `Screen` wrapper — navigation header disappears | `DishDetailScreen.tsx:29–31`, `StallDetailScreen.tsx:51–58` |
| P1-10 | Discover | DecideForMe screen has no "expand radius" option when no match is found — required by product spec | `DecideForMeResultScreen.tsx` |
| P1-11 | Discover | DecideForMe has no haptic feedback on result — product spec requires haptic | `DecideForMeResultScreen.tsx` |
| P1-12 | Discover | DecideForMe `AnimatedMatchBadge` is dead code — defined but never rendered; the `counter.interpolate` return value would render as `[object Object]` if used | `DecideForMeResultScreen.tsx:75–120` |
| P1-13 | Discover | DecideForMe "Try another dish" can return the same dish — no deduplication | `DecideForMeResultScreen.tsx:319–325` |
| P1-14 | Discover | BuildingDrillDown stall list is a single-column list, not a grid as specified | `BuildingDrillDownScreen.tsx` |
| P1-15 | Discover | BuildingDrillDown does not display `venue.closureNotice` | `BuildingDrillDownScreen.tsx` |
| P1-16 | Home | No loading state on HomeFeedScreen — feed renders synchronously from mock data with no skeleton or spinner | `HomeFeedScreen.tsx` |
| P1-17 | Home | No error boundary on HomeFeedScreen — a child component throw crashes the entire screen | `HomeFeedScreen.tsx` |
| P1-18 | Search | No loading state on SearchResultsScreen | `SearchResultsScreen.tsx` |
| P1-19 | Search | No sort options on SearchResultsScreen — no way to sort by price, rating, distance, or match score | `SearchResultsScreen.tsx` |
| P1-20 | Search | `groupResultsByVenue` is a no-op stub — returns raw results unchanged | `search.ts:27–29` |
| P1-21 | Search | Discovery feed hardcodes three specific building IDs — ignores other buildings and user proximity | `search.ts:43–45` |
| P1-22 | Onboarding | `stepLabel` props expose raw developer IDs ("SCR-006", "SCR-007", "SCR-008") to end users | `OnboardingScreenShell.tsx`, `TasteQuizScreen.tsx:79`, `DietaryPreferencesScreen.tsx`, `LocationPermissionScreen.tsx:29` |
| P1-23 | Onboarding | TasteQuiz pre-seeds non-neutral values (sweet:5, spicy:6, sour:4, salty:5, rich:6, aromatic:6) — users who tap "Next" without selecting submit hidden defaults | `TasteQuizScreen.tsx:15` |
| P1-24 | Review | Step counter says "Step X of 5" but only 4 screens exist in ReviewStack — step 5 is never reached | `ReviewScreenShell.tsx`, `ReviewComposeScreen.tsx` |
| P1-25 | Review | ReviewHub unauthenticated state double-guards: `useEffect` redirect AND conditional render — brief flash of auth-blocked content visible before redirect fires | `ReviewHubScreen.tsx:30–50` |
| P1-26 | Review | ReviewHub venue picker has no empty state when search returns zero venues | `ReviewHubScreen.tsx` |
| P1-27 | Review | ReviewRating falls back to `mockRepository.listPopularNearby()[0]` when no dish is selected — shows a random dish instead of an error | `ReviewRatingScreen.tsx:25` |
| P1-28 | Review | `recommend` toggle defaults to `true` — users who never touch it silently submit "Would recommend" even on a 1-star review | `useReviewDraftStore.ts` |
| P1-29 | Review | ReviewCompose exposes a "Simulate photo failure" debug button to end users | `ReviewComposeScreen.tsx:105` |
| P1-30 | Review | No real photo picker — `expo-image-picker` not integrated; only mock URI strings | `ReviewComposeScreen.tsx:104–105` |
| P1-31 | Profile | FavouritesScreen has no navigation to DishDetail — only a "Remove favourite" action | `FavouritesScreen.tsx` |
| P1-32 | Profile | FavouritesScreen dish display has no image, no rating, no venue name — text only | `FavouritesScreen.tsx` |
| P1-33 | Profile | ReviewHistoryScreen empty state is plain `AppText` — inconsistent with FavouritesScreen which uses `EmptyState` component | `ReviewHistoryScreen.tsx:34–35` |
| P1-34 | Profile | ReviewHistoryScreen shows dish's public `reviewCount` instead of the user's own review content/rating | `ReviewHistoryScreen.tsx` |
| P1-35 | Profile | ProfileRadarChart renders invisible polygon when all taste values are 0 — no explanatory text | `ProfileRadarChart.tsx` |
| P1-36 | Profile | Sign-out navigation uses fragile `getParent()?.getParent()` chain — breaks if nesting depth changes | `ProfileHomeScreen.tsx:22–24`, `SettingsScreen.tsx:18–19` |
| P1-37 | Component | FloatingToast has no entrance/exit animation despite `motion.toast = 250` token existing | `FloatingToast.tsx` |
| P1-38 | Component | FloatingToast has no `zIndex` despite `zIndex.toast = 30` token existing — may render under modals/FABs | `FloatingToast.tsx` |
| P1-39 | Component | FloatingToast ignores `tone` field from `useUIStore` — always renders navy background regardless of success/warning/error | `FloatingToast.tsx` |
| P1-40 | Component | `HygieneGradeBadge` uses hardcoded hex colours that do not adapt to dark mode | `HygieneGradeBadge.tsx:12–15` |
| P1-41 | Component | `FloorPlanViewer` uses extensive hardcoded colours for stall open/closed/selected states — not dark-mode safe | `FloorPlanViewer.tsx:28–52` |
| P1-42 | Reads | `readsEnabled` feature flag is defined but never enforced in navigation — ReadsFeedScreen renders regardless | `featureFlags.ts`, navigation |
| P1-43 | Splash | Animated values created inside component body without `useRef` — animation values recreated on every render | `SplashScreen.tsx:29–36` |
| P1-44 | Splash | App version "Hungry v0.1.0 · Singapore" is hardcoded — should source from `expo-constants` or `package.json` | `SplashScreen.tsx:182` |
| P1-45 | Auth | No "show password" toggle on login, signup, or reset password screens | `LoginScreen.tsx`, `SignUpScreen.tsx`, `ResetPasswordScreen.tsx` |
| P1-46 | Auth | No terms/privacy policy tappable link on signup — only static text | `SignUpScreen.tsx:63` |
| P1-47 | Search | TasteFilter slider has no `step={1}` — stores float values (e.g. 3.7821) instead of integers | `TasteFilterScreen.tsx:30–31` |

### P2 — Polish / Copy / Consistency

These items affect perceived quality but do not break functionality.

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P2-01 | Home | Empty state copy is developer-facing: "The home feed is ready, but there are no items in the current mock feed." | `HomeFeedScreen.tsx:308–310` |
| P2-02 | Home | Social engagement counts (reactions, comments, shares) are fabricated arithmetic, not real data | `HomeFeedScreen.tsx:45–47` |
| P2-03 | Home | "Tonight's food stories" heading is hardcoded — does not reflect actual time of day | `HomeFeedScreen.tsx:243` |
| P2-04 | Home | Hardcoded `paddingBottom: 88` to avoid tab bar — fragile if tab bar height changes | `HomeFeedScreen.tsx:315` |
| P2-05 | Search | DishSearch "Suggested for tonight" card has no image, no dish name, no pricing — blank CTA box | `DishSearchScreen.tsx:36–55` |
| P2-06 | Search | SearchResults shows "0 dishes matched your current search" subtitle simultaneously with the empty state — redundant | `SearchResultsScreen.tsx:108` |
| P2-07 | Search | SearchResults empty state does not suggest clearing taste filters as an action | `SearchResultsScreen.tsx:196–203` |
| P2-08 | Search | `recentSearches` in `useSearchStore` hardcoded to `["laksa", "chicken rice", "satay"]` on every session — not actual user history | `useSearchStore.ts:25` |
| P2-09 | Discover | BuildingDrillDown search field placeholder "Search on this building" — grammatically awkward, should be "Search stalls in this building" | `BuildingDrillDownScreen.tsx:192` |
| P2-10 | Discover | BuildingDrillDown dish carousel always limited to 4 items with no "see more" affordance | `BuildingDrillDownScreen.tsx:372–403` |
| P2-11 | Maps | Hardcoded disclaimer text visible to users: "This map uses Singapore mock building data and a demo Maxwell drill-down plan." | `HomeMapScreen.tsx:304` |
| P2-12 | Maps | Map bottom sheet open stall count is computed from `.slice(0, 2)` — `openStallCount` is always ≤ 2, falling through to the static field | `HomeMapScreen.tsx:154, 259` |
| P2-13 | Maps | `BuildingLegend` component not rendered anywhere on the map screen — legend exists but is invisible to users | `HomeMapScreen.tsx` |
| P2-14 | Maps | `MapSurface` `cameraPadding` prop declared in interface but silently ignored in implementation | `MapSurface.tsx:35–40` |
| P2-15 | Auth | AuthScreenShell footer copy "Hungry keeps this flow simple so you can get into dish discovery quickly." appears on every auth screen including Reset Password Success — contextually wrong | `AuthScreenShell.tsx:31` |
| P2-16 | Auth | No logo/brand image on auth screens — only a text "HUNGRY" eyebrow label | `AuthScreenShell.tsx` |
| P2-17 | Auth | No countdown timer on "Resend email" button — can be tapped repeatedly without rate limiting | `EmailVerificationScreen.tsx` |
| P2-18 | Auth | "Back to sign up" from EmailVerification loses all filled form state | `EmailVerificationScreen.tsx` |
| P2-19 | Onboarding | LocationPermission hardcodes "CBD" as default manual location — arbitrary default that may not match the user | `LocationPermissionScreen.tsx:19` |
| P2-20 | Onboarding | "Finish setup" on LocationPermission calls `denyLocation()` then `finish()` — manual location text field value is discarded | `LocationPermissionScreen.tsx:65–69` |
| P2-21 | Review | ReviewCompose submit toast says "Review saved locally. It appears on your history immediately." — explicitly reveals mock nature to users | `ReviewComposeScreen.tsx:85` |
| P2-22 | Review | ReviewSuccess modal text: "Your profile and review history have been updated in this mock session." — mock disclosure visible to users | `ReviewSuccessModal.tsx:75` |
| P2-23 | Profile | FavouritesScreen empty state body: "The list fills up once the detail flow is wired in." — developer-facing copy visible to users | `FavouritesScreen.tsx:35` |
| P2-24 | Profile | SettingsScreen shows only 2 mock toggles with explicit "This section is mock-only" banner | `SettingsScreen.tsx:32` |
| P2-25 | Profile | EditProfileScreen has no avatar upload, no dietary preferences edit, no taste quiz redo, no password change | `EditProfileScreen.tsx` |
| P2-26 | Profile | EditProfileScreen explicit mock disclosure: "This mock build keeps profile editing local to the device state." | `EditProfileScreen.tsx:42` |
| P2-27 | Profile | No account deletion option in SettingsScreen | `SettingsScreen.tsx` |
| P2-28 | Profile | No app version display in SettingsScreen | `SettingsScreen.tsx` |
| P2-29 | Profile | `ProfileScreen.tsx` is just a re-export alias for `ProfileHomeScreen` — dead indirection | `ProfileScreen.tsx:1` |
| P2-30 | Reads | "8 MIN READ" hardcoded on every blog post — `BlogPost` type has no `readTime` field | `ReadsFeedScreen.tsx:54` |
| P2-31 | Reads | "View Archive" label is non-interactive `AppText` — no `onPress`, no `Pressable` | `ReadsFeedScreen.tsx:82–83` |
| P2-32 | Reads | Atmosphere grid colours use raw hex values instead of `palette` tokens | `ReadsFeedScreen.tsx:14–17` |
| P2-33 | Component | `DishCard` image placeholder uses hardcoded `"#E5E7EB"` instead of a palette token | `DishCard.tsx:101` |
| P2-34 | Component | `PhotoPicker` image placeholder uses hardcoded `"#E5E7EB"` instead of a palette token | `PhotoPicker.tsx:56` |
| P2-35 | Component | `StallHeader` uses no `useHungryTheme()` — all gap values are magic numbers | `StallHeader.tsx:14–21` |
| P2-36 | Component | `OperatingHours` does not distinguish open (green) vs closed (red) visually — both use `tone="secondary"` | `OperatingHours.tsx` |
| P2-37 | Component | Multiple components use inline `fontFamily: "Nunito_700Bold"` instead of typography tokens | `Button.tsx:102`, `ClusterPin.tsx:44`, `ReviewCard.tsx:36`, `DeliveryPlatformButton.tsx:67`, `BiteCard.tsx:116` |
| P2-38 | Component | `MapSurface` FallbackMap road colours use raw rgba instead of existing `palette.mapRoadPrimary/Secondary` tokens | `MapSurface.tsx:168–171` |
| P2-39 | Component | Multiple components use `borderRadius: 999` instead of `radii.pill` | `MapSurface.tsx:299,306,329,330` |
| P2-40 | Component | `BiteCard` taste tag text uses hardcoded `"#FFFFFF"` instead of `tone="inverse"` or token | `BiteCard.tsx:83` |
| P2-41 | Component | `BitesCarousel` contains large inline mock data array — should live in fixture file | `BitesCarousel.tsx` |
| P2-42 | Component | `useNavigation<any>()` used in multiple files — bypasses type safety | `ReadsFeedScreen.tsx:23`, `SettingsScreen.tsx:11` |
| P2-43 | A11y | FloatingToast has no `accessibilityRole="alert"` or `accessibilityLiveRegion` — not announced by screen readers | `FloatingToast.tsx` |
| P2-44 | A11y | Chip has no `accessibilityState={{ selected }}` — screen readers cannot announce selection state | `Chip.tsx` |
| P2-45 | A11y | FloorSelector tabs have no `accessibilityState={{ selected }}` | `FloorSelector.tsx` |
| P2-46 | A11y | StarRating (non-editable) has no `accessibilityRole`; editable stars lack "X out of Y" context in label | `StarRating.tsx` |
| P2-47 | A11y | ProfileRadarChart is not screen-reader navigable — no accessible value text for the 6 axes | `ProfileRadarChart.tsx:38` |
| P2-48 | A11y | MustOrderBadge has no `accessibilityLabel` | `MustOrderBadge.tsx` |
| P2-49 | A11y | BiteCard root `Pressable` has no `accessibilityRole`; inner dish-name `Pressable` has neither role nor label | `BiteCard.tsx:40,112` |
| P2-50 | A11y | MapBottomSheet container has no `accessibilityRole` | `MapBottomSheet.tsx` |
| P2-51 | Infra | `Input` component has no `error` prop / error border styling — screens must implement validation visuals inline | `Input.tsx` |
| P2-52 | Infra | No `Skeleton` / loading placeholder primitive in the component library | `src/components/ui/` |
| P2-53 | Infra | No `Avatar` primitive — implemented ad hoc in ReviewCard (initials circle) and BiteCard (image circle) | `ReviewCard.tsx`, `BiteCard.tsx` |
| P2-54 | Infra | No general-purpose `BottomSheet` primitive — `MapBottomSheet` is domain-specific | `src/components/map/` |
| P2-55 | Infra | `shadows.card` uses hardcoded `shadowColor: "#111827"` — not adaptive for dark mode | `tokens.ts` |
| P2-56 | Infra | `zIndex` tokens (`toast:30`, `fab:20`, `overlay:10`) defined but never consumed by any component | `tokens.ts` |
| P2-57 | Infra | `motion` tokens defined but no component in the library uses them for animations | `tokens.ts` |

---

## 3. Verification Matrix

### Core Flow Testing Matrix

| Domain | Flow | Entry Point | Happy Path | Edge Cases | Verification Criteria |
|--------|------|-------------|------------|------------|----------------------|
| **Home** | Feed load | App launch → Home tab | Feed renders personalised dish cards sorted by taste similarity | Empty feed (no mock data); feed with closed venues only | Feed populates without crash; DishCard taps navigate to DishDetail; Decide For Me FAB visible and functional; no developer-facing copy visible |
| **Home** | Decide For Me | Home → FAB tap | Dish result card shown with photo, name, stall, floor/unit, match % | No match within radius; user has neutral taste vector (all 5s) | Result renders within 2s; haptic fires; "Try another" returns a different dish; expand radius option shown on no-match |
| **Discover** | Category browse | Discover tab → category chip tap | Chips filter search store; SearchResults update accordingly | All chips deselected; single chip selected; multiple chips | Chip `selected` state syncs with `useSearchStore.categories`; results reflect active filters |
| **Discover** | Taste filter | Discover → Taste Filter → Apply | Sliders update `useSearchStore.tasteValues`; results rank by cosine similarity | All sliders at 0; all at 10; reset to profile | Slider values are integers (step=1); "Reset to my profile" restores quiz values; "Apply" navigates back and results re-sort |
| **Search** | Text search | Discover tab → search input → submit | Results screen shows matching dishes ranked by relevance + taste | Empty query; query with no matches; special characters | Loading state shown during fetch; empty state with clear CTA; "0 dishes" subtitle hidden when empty state shown |
| **Search** | Sort & display | SearchResults → sort toggle / grid toggle | Results re-order by selected sort; grid/list layout switches cleanly | Single result; 100+ results; sort by price ascending | Sort dropdown present with options (price, rating, distance, match); grid remounts correctly via `key` prop |
| **Maps** | Building selection | Maps tab → pin tap | Bottom sheet shows building name, type, stall count, hero dish | Closed building tap; building with 0 open stalls | Pin colours match spec (hawker=orange, food_court=teal, restaurant=grey); bottom sheet is gesture-draggable; "View stalls" navigates to BuildingDrillDown |
| **Maps** | Floor plan drill-down | Maps → pin → BuildingDrillDown | Floor tabs switch; stall grid renders per floor; stall tap → StallDetail | Single-floor building; floor with 0 stalls; building flagged `isClosedToday` | FloorSelector component used (not inline pills); stall grid layout (not single-column list); closure notice visible; dish carousel shows >4 with "see more" |
| **Maps** | Current location | Maps tab → location button | Camera re-centres to user's GPS coordinates with appropriate zoom | Location permission denied; GPS unavailable | Button re-centres camera; zoom level adjusts; fallback to manual location if permission denied |
| **Auth** | Email sign-up | Splash → Auth → SignUp → EmailVerification → Onboarding | User completes sign-up, verifies email, enters onboarding | Invalid email format; short password; mismatched passwords; blank fields | Form validation errors shown inline with red border; loading state on submit button; password visibility toggle present; terms/privacy link tappable |
| **Auth** | Email login | Auth → Login | User authenticates and lands on MainTabs (or Onboarding if first time) | Wrong password; unregistered email; session expired re-auth | Validation errors shown; loading spinner on submit; expired session redirects to Login with return route preserved |
| **Auth** | Password reset | Login → Forgot → Reset → Success → Login | User resets password and returns to login | Invalid email on forgot; token expired on reset | Toast confirmation on email sent; password match validation on reset; success screen navigates to Login |
| **Auth** | Social auth | Auth → Google/Apple button | Auth completes, user enters onboarding | Provider unavailable; user cancels consent | Loading state on provider button; cancel returns to auth screen; success routes through onboarding |
| **Review** | Full review flow | Review tab → ReviewHub → Rating → Tags → Compose → Submit | User selects venue+dish, rates, tags, writes, submits | No venues found; switch dish mid-flow; submit while unauthenticated | Hub shows searchable venue list with empty state; rating disables "Next" when 0; tags are optional; compose has real photo picker; submit shows success modal; draft cleared after submit |
| **Review** | Quick tag review | Review tab → ReviewHub → Rating → Tags → Submit (skip compose) | User completes quick 3-step review without text/photos | — | Tags screen has a "Submit without text" affordance or compose step is skippable |
| **Profile** | View profile | Profile tab | Profile overview with radar chart, stats, quick links | New user with 0 reviews and 0 favourites; user who skipped taste quiz | Radar chart renders non-zero polygon (or shows explanatory text for all-zero); stats show correct counts; sign-out works |
| **Profile** | Favourites | Profile → Favourites | Saved dishes list with images, prices, venues, tap-to-detail | 0 favourites; removing last favourite | `EmptyState` component with CTA to discover; each dish card navigates to DishDetail; remove action updates count |
| **Profile** | Review history | Profile → Review History | User's past reviews with their rating, tags, text, date | 0 reviews | `EmptyState` component with CTA to write review; each entry shows the user's own review content (not dish's public reviewCount) |
| **Profile** | Edit profile | Profile → Edit | User updates display name, email | No changes saved; empty name | Input validation (non-empty name, valid email format); save persists to `useProfileStore` |
| **Profile** | Settings | Profile → Settings | Dietary filters, notifications, sign-out, app version | — | Sign-out clears session and routes to Splash; app version sourced from package.json; account deletion option present |

### State-Handling Verification Checklist

| State | Screens That Must Handle It | Current Status |
|-------|-----------------------------|----------------|
| Loading (data fetch in progress) | Home, SearchResults, DishDetail, StallDetail, BuildingDrillDown, DecideForMe, Maps | Missing on all screens — synchronous mock calls mask the gap |
| Empty (valid response, zero items) | Home feed, SearchResults, ReviewHub venue list, Favourites, ReviewHistory, BuildingDrillDown floor | Present on some (SearchResults, Favourites, BuildingDrillDown); missing on others (ReviewHub, Home feed copy is developer-facing) |
| Error (fetch failure / thrown exception) | Home, SearchResults, DishDetail, StallDetail, Maps | Missing on all screens — no error boundaries, no error UI |
| Not found (invalid ID in route params) | DishDetail, StallDetail, BlogPost | Partial — `EmptyState` rendered but without `Screen` wrapper (missing navigation header) |
| Offline (no network) | Global | Present — `OfflineStateScreen` exists with recovery button |
| Auth required (protected action by guest) | Favourite, Review submit, Profile tab | Partially broken — `SoftGateSheet` does not exist; auth gates use `useEffect` redirect with visible flash |

---

## 4. Session Log

| Date | Actor | Summary | Status | Next Step |
|------|-------|---------|--------|-----------|
| 2026-04-09 | Claude | Full codebase audit: 4 parallel subagents audited Home/Discover, Maps/Detail, Auth/Review/Profile, and Components/Theme. Generated consolidated backlog with 15 P0, 47 P1, and 57 P2 items. Created verification matrix for 7 domains. | Completed | Codex to triage and begin executing P0 items; Claude to define acceptance criteria for P0 fixes |

---

## 5. Verification Commands Log

- [x] `npm run typecheck` — 2026-04-08
- [ ] `npx expo-doctor`
- [ ] `npm run test` (test script not yet defined in package.json)

---

## Notes

- This backlog supersedes the previous Phase 1–5 checklist structure. Completed phases (1–5 original) are archived above for reference.
- P0 items should be addressed before any new feature work.
- The verification matrix should be used as the acceptance gate for Phase 2 "done criteria".
- Future phases (6–10: Ordering, Payments, Vendor Analytics, Crowd Signals, Platform Data) remain unchanged and are tracked in the original phase definitions.
