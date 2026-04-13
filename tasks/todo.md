# Hungry — Consolidated Audit Backlog

> Generated 2026-04-09 by Claude (Opus) after a full codebase audit against product-context.md, design-system.md, screens.md, data-contracts.md, and the Figma prototypes.

---

## 0. Done (Execution Batches)

### Batch 2026-04-09A — Codex (P0/P1 + pending polish)

| ID | Status | Summary |
|----|--------|---------|
| P0-04 | Done | Added shared auth validators and wired required/format/password checks into Login, Sign Up, Forgot Password, and Reset Password forms. |
| P0-13 | Done | Refactored badge tone mapping and fixed `tone=\"orange\"` to use orange-specific token styling instead of neutral. |
| P1-28 | Done | Changed review draft default `recommend` to `false` via a shared draft factory used by store init and reset. |
| POL-2026-04-09-01 | Done | Removed remaining NEA/Hygiene text from active map/drill-down screens (`HomeMapScreen`, `BuildingDrillDownScreen`). |

Verification Note:
- `npm run typecheck` passed after all code changes.
- `npm test` passed (11 tests): auth validators, badge tone mapping, review draft defaults, and directory descriptor behavior.
- Confirmed `rg -n "Hygiene|NEA clean" src/app/screens -S` returns no matches.

---

### Batch 2026-04-13A — Claude (P0/P1/P2 audit fixes)

| ID | Status | Summary |
|----|--------|---------|
| P0-01 | Done | `updateTasteVector(values)` called in `TasteQuizScreen.handleFinish`; `updateTasteVector` + `updateDietaryPreferences` added to `useProfileStore` interface and implementation. |
| P0-02 | Done | `updateDietaryPreferences(selected)` called in `DietaryPreferencesScreen.handleNext`. |
| P0-05 | Done | Orange 56dp Decide For Me FAB added to `HomeFeedScreen` (absolutely positioned, `Utensils` icon); navigates to `DecideForMeResult` via `mockRepository.getDecideForMe`. |
| P0-06 | Done | Map pin colors corrected: `food_court → palette.teal`, `hawker_centre → palette.orange`, `restaurant → palette.textMuted`. `useMemo` deps updated. |
| P0-08 | Done | "Taste filters" button (variant secondary) added to `DishSearchScreen` and `SearchResultsScreen`; both navigate to `TasteFilter`. |
| P0-10 | Done | DishDetail delivery buttons call `Linking.openURL(nativeUrl).catch(() => Linking.openURL(webUrl))` — NotFound route removed. |
| P0-11 | Done | StallDetail delivery buttons added with `Linking.openURL`; hidden when `deliveryLinks` is empty. |
| P0-12 | Done | StallDetail directions button added; opens Google Maps with encoded building/venue name query. |
| P1-22 | Done | `stepLabel` dev IDs replaced: "SCR-006" → "Step 1 of 3", "SCR-007" → "Step 2 of 3", "SCR-008" → "Step 3 of 3". |
| P1-23 | Done | TasteQuiz `INITIAL` changed from `{sweet:5, spicy:6, sour:4, salty:5, rich:6, aromatic:6}` to neutral `{…all: 5}`. |
| P1-29 | Done | "Simulate photo failure" debug button removed from `ReviewComposeScreen`. |
| P1-31 | Done | FavouritesScreen cards wrapped in `Pressable`; taps call `navigation.getParent()?.navigate("DishDetail", …)`. |
| P1-32 | Done | FavouritesScreen now shows dish image (140dp), rating, and venue name on each card. |
| P1-47 | Done | `step={1}` added to all 6 sliders in `TasteFilterScreen`. |
| P2-01 | Done | HomeFeedScreen empty state body updated to user-facing copy. |
| P2-23 | Done | FavouritesScreen empty state body updated to user-facing copy with "Explore dishes" CTA. |

Verification Note:
- Dependencies not installed in this CI environment — `npm run typecheck` infrastructure error is pre-existing (missing `expo/tsconfig.base`).
- All code changes reviewed for type safety: new store methods typed against `TasteVector` and `DietaryFlag[]` domain types; `Linking.openURL` called correctly; navigation calls reference registered route names.

---

## 1. Unchecked Phase 1 & Phase 3 Items

### Phase 1 — Product + Architecture Planning

> P1-01 through P1-04 are completed Claude deliverables. P1-05 through P1-09 remain open for Codex.

---

#### ✅ P1-01 — Mock-First Architecture Strategy

**Service Boundary (the contract):**
- `src/lib/services/types.ts` — `HungryService` interface; 41 methods across 6 domains (auth, discovery, reviews, profile, social, content, ai)
- `src/lib/services/mock/mockService.ts` — current implementation; all methods return `Promise.resolve(...)` with fixture data
- Future: `src/lib/services/supabase/supabaseService.ts` — real implementation, same interface, zero screen changes required

**Decoupling Rules (enforce now):**
1. Screens import from stores only — never from `mock/data.ts` or `mock/repositories.ts` directly
2. Stores call `hungryService.method()` — not `mockRepository.method()` directly
3. Service provider is a single injection point (`src/lib/services/serviceProvider.ts` — Codex to create, P1-05)
4. Mock service simulates async with `Promise.resolve()` so swap to real async is drop-in

**Swap Path (single-file change):**
```ts
// serviceProvider.ts (to create — P1-05)
import { mockService } from './mock/mockService';
// import { supabaseService } from './supabase/supabaseService'; // Phase 2 swap
export const hungryService = mockService;
```

**State Persistence Gap (open — P0-14):**
- No Zustand `persist` middleware on any of the 8 stores today
- Phase 2: add MMKV-backed persist to `useSessionStore`, `useProfileStore`, `useSearchStore`
- Do NOT persist `useReviewDraftStore` — drafts must reset on cold start by design

---

#### ✅ P1-02 — Feature-Level Definition of Done

| Feature | Definition of Done |
|---------|-------------------|
| F-001 Auth | Sign-up routes to onboarding; login routes to MainTabs; inline validation errors with red borders; password visibility toggle present; terms/privacy link tappable; loading state on submit |
| F-002 Taste Profile | 6 sliders at `step={1}` (integer only); results persisted to `useProfileStore` on submit; skip sets neutral vector (all 5s); no pre-seeded non-neutral defaults on mount |
| F-003 Location | System permission dialog shown; GPS coords written to `useLocationStore.currentLocation` on grant; manual location entry on deny; fallback does not hardcode "CBD" |
| F-004 Building Drill-Down | `FloorSelector` component used (not inline pills); stall grid ≥2 columns; `venue.closureNotice` visible via `InlineBanner`; loads <1.5s (mock: instant) |
| F-005 Dish-First Search | Text matches dish name across all venues; ranked by proximity + rating + cosine taste similarity; results <1s |
| F-006 Taste-Based Filtering | Navigation path from search/discover to `TasteFilterScreen` exists; `step={1}` on all sliders; "Reset to my profile" restores quiz values; Apply navigates back and results re-sort |
| F-007 Decide For Me | FAB visible on Home or Discover; shows best dish within 500m by cosine similarity; haptic on result; "Try another" returns different dish; expand radius option on no-match; result <2s |
| F-008 Dish Detail | Photo carousel uses `DishDetail.gallery`; taste radar chart rendered (`ProfileRadarChart`); price uses `variant="price"` (DM Mono); delivery buttons use brand colors and call `Linking.openURL` |
| F-009 Stall Detail | Hygiene grade color-coded (A=green, B=amber, C=orange, D=red); directions opens native maps; delivery buttons call `Linking.openURL`; closure notice via `InlineBanner`; reviews from venue data (not hardcoded constant) |
| F-010 Dish Reviews | Rating required before Next; step counter shows 4 steps (not 5); no debug "Simulate photo failure" button; real photo picker (`expo-image-picker`); success modal shown; draft cleared after submit |
| F-011 Favourites | Tapping a dish navigates to DishDetail; each card shows image, rating, venue name; `EmptyState` component with CTA; no developer-facing copy visible |
| F-012 Delivery Deep Links | Buttons visible only when `deliveryLinks` non-empty; taps call `Linking.openURL(nativeUrl)` with `webUrl` fallback; buttons hidden when array is empty |

---

#### ✅ P1-03 — Event Taxonomy

All events follow: `{ event: string, properties: object, user_id?: string, session_id: string, timestamp: ISO8601 }`

**App Lifecycle**

| Event | Trigger | Key Properties |
|-------|---------|---------------|
| `app_launched` | Cold start or foreground | `{ is_first_launch: boolean, is_authenticated: boolean }` |
| `onboarding_started` | First screen after auth | `{}` |
| `taste_quiz_completed` | Submit on quiz screen | `{ skipped: boolean, vector: TasteVector }` |
| `dietary_preferences_set` | Submit dietary prefs | `{ flags: DietaryFlag[] }` |
| `onboarding_completed` | Final onboarding step | `{ has_taste_vector: boolean, has_location: boolean }` |

**Discovery**

| Event | Trigger | Key Properties |
|-------|---------|---------------|
| `decide_for_me_triggered` | FAB tap | `{ location_granted: boolean, radius_m: number }` |
| `decide_for_me_result_shown` | Result card displayed | `{ dish_id: string, match_score: number, distance_m: number }` |
| `decide_for_me_no_match` | No dish within radius | `{ radius_m: number }` |
| `decide_for_me_radius_expanded` | Expand radius tapped | `{ new_radius_m: number }` |
| `map_pin_tapped` | Building pin tapped | `{ building_id: string, building_type: BuildingType }` |
| `floor_switched` | Floor tab tapped in drilldown | `{ building_id: string, from_floor: string, to_floor: string }` |
| `stall_tapped` | Stall selected in drilldown | `{ venue_id: string, building_id: string, floor: string }` |
| `dish_viewed` | Dish detail screen opened | `{ dish_id: string, venue_id: string, source: 'search' \| 'home' \| 'maps' \| 'favourites' \| 'wheel' \| 'stall' }` |
| `stall_viewed` | Stall detail screen opened | `{ venue_id: string, building_id: string, source: 'maps' \| 'search' \| 'dish_detail' }` |
| `search_submitted` | Search query submitted | `{ query_length: number, result_count: number, categories_active: number, dietary_flags_active: number }` |
| `taste_filter_applied` | Apply tapped on TasteFilter | `{ axes_changed: string[], result_count: number }` |
| `taste_filter_reset` | Reset to profile tapped | `{}` |
| `category_chip_tapped` | Category chip toggled | `{ category: SearchCategory, selected: boolean }` |

**Engagement**

| Event | Trigger | Key Properties |
|-------|---------|---------------|
| `delivery_link_tapped` | Delivery button tapped | `{ dish_id: string, venue_id: string, platform: DeliveryPlatform }` |
| `directions_tapped` | Directions button tapped | `{ venue_id: string, building_id: string }` |
| `dish_favourited` | Dish added to favourites | `{ dish_id: string, venue_id: string, source: 'dish_detail' \| 'search' \| 'home' }` |
| `dish_unfavourited` | Dish removed from favourites | `{ dish_id: string }` |
| `review_started` | Review flow entered | `{ trigger: 'tab' \| 'dish_detail' \| 'stall_detail' }` |
| `review_step_completed` | Step N completed | `{ step: 1\|2\|3\|4, step_name: 'venue'\|'rating'\|'tags'\|'compose', has_dish_selected: boolean }` |
| `review_submitted` | Review successfully submitted | `{ dish_id: string, venue_id: string, rating: number, has_text: boolean, has_photos: boolean, tag_count: number }` |
| `review_abandoned` | Review flow exited early | `{ at_step: 1\|2\|3\|4 }` |
| `blog_post_opened` | Reads article link tapped | `{ post_id: string, source_name: string }` |

**Wheel (Multiplayer)**

| Event | Trigger | Key Properties |
|-------|---------|---------------|
| `wheel_party_created` | New party created | `{ spin_mode: WheelSpinMode, trigger_mode: WheelTriggerMode }` |
| `wheel_entry_added` | Item added to wheel | `{ party_id: string, venue_id: string }` |
| `wheel_spin_triggered` | Spin initiated | `{ party_id: string, entry_count: number, spin_mode: WheelSpinMode }` |
| `wheel_party_resolved` | Final winner determined | `{ party_id: string, rounds_played: number }` |

**Auth**

| Event | Trigger | Key Properties |
|-------|---------|---------------|
| `sign_up_completed` | Auth sign-up done | `{ method: 'email' \| 'google' \| 'apple' }` |
| `sign_in_completed` | Auth sign-in done | `{ method: 'email' \| 'google' \| 'apple' }` |
| `sign_out` | User signs out | `{}` |
| `password_reset_completed` | Password reset success | `{}` |

---

#### ✅ P1-04 — Tradeoffs & Decisions Log

| Decision | Choice Made | Alternative Rejected | Rationale |
|---------|------------|---------------------|-----------|
| Data layer | Mock-first with `HungryService` interface | Backend-first with real Supabase | Unblocks frontend build; interface contract enforces clean swap path with zero screen changes |
| Auth model | Auth-first (mandatory, gated at Splash) | Guest browsing with soft gates | Guest flow added navigation complexity; auth-first ensures taste personalization from first session and cleaner analytics |
| Taste vector precision | 0–10 integers (sliders) / 0.0–1.0 (PRD stored) | Float-only per PRD | Integer slider steps are intuitive for UX; cosine similarity is scale-invariant so range doesn't affect correctness |
| Map SDK | Mapbox (`@rnmapbox/maps`) + static fallback | React Native Maps (Google/Apple) | Mapbox supports custom indoor floor-plan styling required for hawker centre drill-down; fallback keeps repo inspectable without token |
| Indoor map UX | Polygon-first floor viewer with synced list | List-first stall directory | List-first fails directory realism at mall scale; polygon-first mirrors Google/Apple mall UX |
| Navigation stack | React Navigation v7 (Stack + Tab) | Expo Router (file-based) | Type-safe route params; predictable protected-route pattern; Expo Router auth-gate complexity not worth it at this scale |
| State management | Zustand | Redux, Context API | Minimal boilerplate; strong TypeScript inference; no Provider wrapping required |
| Delivery links | GrabFood/Foodpanda deep links | In-app ordering | Ordering is explicit PRD out-of-scope; deep links deliver 80% of user value at 0% logistics complexity |
| Taste match algorithm | Cosine similarity | Euclidean distance, weighted scoring | Cosine is direction-agnostic; correctly handles users with different absolute intensity levels |
| `Reads` tab | Feature-flagged (`FEATURE_FLAGS.readsEnabled`) | Always-on | Safe toggle without deploy; flag defined but navigation enforcement still open (P1-42) |
| Review system | Full mock flow (no backend) | Defer until backend ready | Reviews are core engagement signal; mock flow enables investor demos and tests complete UI/UX contract |

---

#### Open Codex Tasks

| ID | Item | Owner |
|----|------|-------|
| P1-05 | Create `src/lib/services/serviceProvider.ts` as the single injection point for `hungryService` | Codex |
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

> P3-01 through P3-03 are completed Claude deliverables. P3-04 through P3-08 remain open for Codex.

---

#### ✅ P3-01 — KPI Definitions

**Business / Retention KPIs**

| KPI | Definition | Year-1 Target |
|----|-----------|--------------|
| Daily Active Users (DAU) | Unique users with ≥1 event per calendar day | 5,000 |
| Monthly Active Users (MAU) | Unique users with ≥1 session in rolling 30 days | 25,000 |
| DAU/MAU Ratio | Stickiness; higher = more habitual usage | ≥20% |
| D1 Retention | % new users who return on day 2 | ≥40% |
| D7 Retention | % new users who return within 7 days | ≥25% |
| D30 Retention | % new users active within 30 days of signup | ≥15% |
| Taste Profile Completion Rate | % sign-ups who complete quiz (not skip) | ≥60% |

**Engagement KPIs**

| KPI | Definition |
|----|-----------|
| Decide For Me Adoption | % of sessions containing `decide_for_me_triggered` |
| Review Completion Rate | `review_submitted` / `review_started` |
| Dish Detail CTR | `dish_viewed` / total results surfaced to user |
| Delivery Link CTR | `delivery_link_tapped` / `dish_viewed` (dishes with links only) |
| Favourite Rate | `dish_favourited` / `dish_viewed` |
| Taste Filter Adoption | % of sessions with `taste_filter_applied` |
| Wheel Session Rate | `wheel_party_created` per MAU per month |
| Blog Read-Through Rate | `blog_post_opened` per Reads session |

---

#### ✅ P3-02 — Event-to-Metric Mapping

| KPI | Source Events | Calculation |
|----|--------------|------------|
| DAU | `app_launched` | `COUNT(DISTINCT user_id) WHERE event_date = today` |
| MAU | `app_launched` | `COUNT(DISTINCT user_id) WHERE event_date >= today - 30d` |
| DAU/MAU | derived | `DAU / MAU` |
| D1 Retention | `app_launched` | `COUNT(users with event on day N+1) / COUNT(new users on day N)` |
| D7 Retention | `app_launched` | `COUNT(users with any event in days N+1..N+7) / COUNT(new users on day N)` |
| Taste Profile Completion | `taste_quiz_completed`, `onboarding_started` | `COUNT(taste_quiz_completed WHERE skipped=false) / COUNT(onboarding_started)` |
| Decide For Me Adoption | `decide_for_me_triggered`, sessions | `COUNT(DISTINCT session_id with decide_for_me_triggered) / COUNT(DISTINCT session_id)` |
| Review Completion | `review_started`, `review_submitted` | `COUNT(review_submitted) / COUNT(review_started)` |
| Delivery Intent | `delivery_link_tapped`, `dish_viewed` | `COUNT(delivery_link_tapped) / COUNT(dish_viewed WHERE dish.deliveryLinks.length > 0)` |
| Favourite Rate | `dish_favourited`, `dish_viewed` | `COUNT(dish_favourited) / COUNT(dish_viewed)` |
| Taste Filter Adoption | `taste_filter_applied`, sessions | `COUNT(DISTINCT session_id with taste_filter_applied) / COUNT(DISTINCT session_id)` |
| Wheel Engagement | `wheel_party_created`, MAU | `COUNT(wheel_party_created) / MAU` per month |

**Data Quality Expectations:**
- Every event must carry `user_id` (or `anonymous_id` pre-auth), `session_id`, and `timestamp`
- `dish_id` / `venue_id` in events must resolve against fixtures/database — validate in CI (P3-06)
- Events are idempotent — duplicate `session_id + event + timestamp` tuples deduplicated at ingestion

---

#### ✅ P3-03 — Phased Rollout Strategy

**Phase 1 — Current (Mock-First, No Backend)**
- All service calls: `mockService` via `HungryService` interface (`src/lib/services/mock/mockService.ts`)
- Analytics: events defined in P1-03 taxonomy; Phase 1 implementation is console-log-only sink
- Feature flags: hardcoded in `src/constants/featureFlags.ts`
- No state persistence — cold start resets all 8 Zustand stores

**Phase 2 — Backend Integration**
1. Supabase project: PostgreSQL + PostGIS (buildings/venues/dishes), pgvector (taste vectors), Supabase Auth
2. Create `src/lib/services/supabase/supabaseService.ts` implementing `HungryService` — same interface, zero screen changes
3. Update `serviceProvider.ts` (P1-05) to export `supabaseService` — single-file swap
4. Add Zustand persist middleware (MMKV): `useSessionStore`, `useProfileStore`, `useSearchStore` — resolves P0-14
5. Real GPS: integrate `expo-location` — resolves P0-03
6. Real photo picker: integrate `expo-image-picker` — resolves P1-30
7. Analytics SDK: integrate PostHog or Amplitude; replace console sink with real event batching
8. Feature flags: migrate to Supabase-backed remote config or LaunchDarkly

**Phase 3 — Analytics & Merchant Layer**
1. Analytics dashboards: PostHog/Amplitude self-serve using KPIs from P3-01
2. Event instrumentation: add hooks at service/store boundaries (P3-04, P3-05)
3. Data quality CI: fixture integrity checks (P3-06) — validate IDs, required fields, taste vector ranges [0–10]
4. Merchant Business Portal: Next.js web app (separate repo); Verified Stall and Stall Pro tiers
5. A/B testing: Decide For Me FAB placement, Taste Filter entry point, Home feed ranking variants

---

#### Open Codex Tasks

| ID | Item | Owner |
|----|------|-------|
| P3-04 | Add event instrumentation hooks in frontend service/store boundaries | Codex |
| P3-05 | Keep analytics hooks mock-safe (no backend dependency required) | Codex |
| P3-06 | Add data validation helpers for fixture integrity checks | Codex |
| P3-07 | Event schema documented and instrumentation implemented for key flows (done criteria) | Both |
| P3-08 | Mock data quality checks executable and recorded (done criteria) | Both |

---

## 2. Prioritised UX & State-Handling Backlog

### P0 — Blocker / Broken Flow

These items break core user journeys or render features non-functional.

> **Recommended execution order:** P0-14 → P0-01+P0-02 → P0-05 → P0-08 → P0-10+P0-11+P0-12 → P0-06 → P0-03 → P0-07 → P0-09 → P0-15

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| ~~P0-01~~ | ~~Onboarding~~ | ~~TasteQuiz results never persisted~~ | Done 2026-04-13 — `updateTasteVector(values)` wired in `handleFinish`; `updateTasteVector` added to `useProfileStore` |
| ~~P0-02~~ | ~~Onboarding~~ | ~~DietaryPreferences selections never persisted~~ | Done 2026-04-13 — `updateDietaryPreferences(selected)` wired in `handleNext`; `updateDietaryPreferences` added to `useProfileStore` |
| P0-03 | Onboarding | LocationPermission `grantLocation()` does not call the system permission API and does not update `currentLocation` to real GPS — hardcoded to Singapore CBD default | `LocationPermissionScreen.tsx`, `useLocationStore.ts` |
| ~~P0-05~~ | ~~Home~~ | ~~"Decide For Me" FAB absent from HomeFeedScreen~~ | Done 2026-04-13 — Orange 56dp FAB added with `Utensils` icon; calls `mockRepository.getDecideForMe` + navigates to `DecideForMeResult` |
| ~~P0-06~~ | ~~Maps~~ | ~~Map pin colours incorrect~~ | Done 2026-04-13 — `food_court → palette.teal`, `hawker_centre → palette.orange`, `restaurant → palette.textMuted` |
| P0-07 | Maps | `BuildingPin`, `FloorSelector`, `BuildingLegend`, `MapBottomSheet`, `ClusterPin` components all exist but are never used — HomeMapScreen re-implements its own variants inline | `HomeMapScreen.tsx`, `BuildingDrillDownScreen.tsx` |
| ~~P0-08~~ | ~~Discover~~ | ~~Taste filter unreachable~~ | Done 2026-04-13 — "Taste filters" button added to `DishSearchScreen` and `SearchResultsScreen` |
| P0-09 | Discover | Category chips are decorative — chips on DiscoverHomeScreen use local state disconnected from `useSearchStore`; DishSearchScreen renders no chips at all | `DishSearchScreen.tsx`, `DiscoverHomeScreen.tsx` |
| ~~P0-10~~ | ~~Detail~~ | ~~DishDetail delivery buttons navigate to NotFound~~ | Done 2026-04-13 — Replaced with `Linking.openURL(link.nativeUrl).catch(() => Linking.openURL(link.webUrl))` |
| ~~P0-11~~ | ~~Detail~~ | ~~StallDetail delivery buttons navigate to NotFound~~ | Done 2026-04-13 — Delivery buttons added with `Linking.openURL`; hidden when no delivery links |
| ~~P0-12~~ | ~~Detail~~ | ~~StallDetail directions button navigates to NotFound~~ | Done 2026-04-13 — Directions button added; opens Google Maps with venue/building name query |
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
| ~~P1-22~~ | ~~Onboarding~~ | ~~`stepLabel` props expose raw developer IDs~~ | Done 2026-04-13 — Changed to "Step 1 of 3", "Step 2 of 3", "Step 3 of 3" |
| ~~P1-23~~ | ~~Onboarding~~ | ~~TasteQuiz pre-seeds non-neutral defaults~~ | Done 2026-04-13 — `INITIAL` changed to all-5s neutral vector |
| P1-24 | Review | Step counter says "Step X of 5" but only 4 screens exist in ReviewStack — step 5 is never reached | `ReviewScreenShell.tsx`, `ReviewComposeScreen.tsx` |
| P1-25 | Review | ReviewHub unauthenticated state double-guards: `useEffect` redirect AND conditional render — brief flash of auth-blocked content visible before redirect fires | `ReviewHubScreen.tsx:30–50` |
| P1-26 | Review | ReviewHub venue picker has no empty state when search returns zero venues | `ReviewHubScreen.tsx` |
| P1-27 | Review | ReviewRating falls back to `mockRepository.listPopularNearby()[0]` when no dish is selected — shows a random dish instead of an error | `ReviewRatingScreen.tsx:25` |
| ~~P1-29~~ | ~~Review~~ | ~~ReviewCompose exposes a "Simulate photo failure" debug button~~ | Done 2026-04-13 — Debug button removed |
| P1-30 | Review | No real photo picker — `expo-image-picker` not integrated; only mock URI strings | `ReviewComposeScreen.tsx:104–105` |
| ~~P1-31~~ | ~~Profile~~ | ~~FavouritesScreen has no navigation to DishDetail~~ | Done 2026-04-13 — `Pressable` wraps card; taps navigate to DishDetail via `getParent()` |
| ~~P1-32~~ | ~~Profile~~ | ~~FavouritesScreen dish display has no image, no rating, no venue name~~ | Done 2026-04-13 — Added dish image (140dp), rating, venue name to each card |
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
| ~~P1-47~~ | ~~Search~~ | ~~TasteFilter slider has no `step={1}`~~ | Done 2026-04-13 — `step={1}` added to all 6 sliders |
| P1-48 | Detail | StallDetail hero image-to-text fade still looks inconsistent versus Figma in runtime edge cases; gradient layering/readability needs final visual QA and polish | `StallDetailScreen.tsx` |

### P2 — Polish / Copy / Consistency

These items affect perceived quality but do not break functionality.

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| ~~P2-01~~ | ~~Home~~ | ~~Empty state copy is developer-facing~~ | Done 2026-04-13 — Updated to user-facing copy |
| P2-02 | Home | Social engagement counts (reactions, comments, shares) are fabricated arithmetic, not real data | `HomeFeedScreen.tsx:45–47` |
| P2-03 | Home | "Tonight's food stories" heading is hardcoded — does not reflect actual time of day | `HomeFeedScreen.tsx:243` |
| P2-05 | Search | DishSearch "Suggested for tonight" card has no image, no dish name, no pricing — blank CTA box | `DishSearchScreen.tsx:36–55` |
| P2-06 | Search | SearchResults shows "0 dishes matched your current search" subtitle simultaneously with the empty state — redundant | `SearchResultsScreen.tsx:108` |
| P2-07 | Search | SearchResults empty state does not suggest clearing taste filters as an action | `SearchResultsScreen.tsx:196–203` |
| P2-08 | Search | `recentSearches` in `useSearchStore` hardcoded to `["laksa", "chicken rice", "satay"]` on every session — not actual user history | `useSearchStore.ts:25` |
| P2-09 | Discover | BuildingDrillDown search field placeholder "Search on this building" — grammatically awkward, should be "Search stalls in this building" | `BuildingDrillDownScreen.tsx:192` |
| P2-10 | Discover | BuildingDrillDown dish carousel always limited to 4 items with no "see more" affordance | `BuildingDrillDownScreen.tsx:372–403` |
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
| ~~P2-23~~ | ~~Profile~~ | ~~FavouritesScreen empty state body is developer-facing~~ | Done 2026-04-13 — Updated to user-facing copy with "Explore dishes" CTA |
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

### Claude primary
- [x] Identify highest-risk UX/logic gaps in current implemented flows.
- [x] Prioritise bug/quality backlog by user impact.
- [x] Define verification matrix for Home, Discover, Search, Maps, Auth, Review, and Profile.

### Codex primary
- [ ] Implement high-priority flow fixes with minimal scoped changes.
- [ ] Add or refine loading, error, and empty states where missing.
- [ ] Keep navigation contracts, mock repositories, and type safety aligned after each patch.
- [ ] Run and record verification commands after each batch.

### Phase 2 mini-plan — 2026-04-09 Favourites sorting and retrieval
- [ ] Define the Favourites browsing contract for sorting by dish type, rating, taste profile, and location.
- [ ] Decide whether dish type should be a first-class domain field or a derived taxonomy from existing dish metadata.
- [ ] Add mock-data and repository support so favourites sorting does not rely on screen-local sorting logic.
- [ ] Implement Favourites screen controls and empty/sorted states after the contract is approved.
- [ ] Run `npm run typecheck` after implementation and record verification notes.

### Phase 2 mini-plan — 2026-04-08 Figma-fidelity hardening
- [x] Remove guest browsing from the session model, auth flow, soft gates, and developer launcher.
- [x] Make signed-out launch always resolve Splash -> Auth before MainTabs.
- [x] Rebuild shared input/button/chip/badge patterns to match the approved warm neutral Figma system.
- [x] Restyle Discover/Search and Stall Detail to match the Figma hierarchy and remove low-contrast pill/card drift.
- [x] Remove emoji usage from runtime UI, onboarding, social sample content, and share labels.
- [x] Run typecheck plus multi-device QA review notes for iPhone 16e, 16, 16 Pro, 16 Pro Max, and one Android sanity pass.

### Phase 2 mini-plan — 2026-04-08 Maps + building layout
- [x] Replace the fake `Maps` tab surface with a token-aware Mapbox wrapper plus a repo-visible fallback preview.
- [x] Rebuild `HomeMapScreen` to match the Figma map composition with live building pins, current-location affordance, and selected-building sheet.
- [x] Turn `MapZoomedIn` into a real focused-building map route instead of a placeholder card.
- [x] Wire `BuildingDrillDown` to the real screen and rebuild it around the Figma drill-down flow.
- [x] Add a demo Maxwell `L2` floor-plan plus mock venues/dishes so the floor switch and menu preview are visible in repo runtime.

### Phase 2 mini-plan — 2026-04-08 Mall directory floor-map realism
- [x] Replace the ordered list-first drill-down framing with a directory-map-first screen that syncs polygon selection with stall details.
- [x] Add realistic custom mall floor maps (Wisma + JEM) with non-grid stall polygons and a Google-style vertical floor selector.
- [x] Ensure floor switching, polygon highlight, and stall detail overlay work together for mall drill-down navigation.
- [x] Run `npm run typecheck` and record results with session notes.

### Phase 2 mini-plan — 2026-04-08 Single-mall pilot (Koufu @ JEM)
- [x] Replace the fixed Maps bottom card with a draggable `@gorhom/bottom-sheet` surface using snap points `16% / 44% / 82%`.
- [x] Wire map camera padding to bottom-sheet state so selected map pins remain visible above the sheet.
- [x] Keep real Mapbox as the primary runtime path, with an interactive fallback when token is absent.
- [x] Ship a JEM-only floor-directory pilot (`L2`, `L3`) with tenant, corridor, and facility polygon layers.
- [x] Keep non-pilot mall behavior unchanged in this pass and keep route contracts stable.
- [x] Run `npm run typecheck` and record the result in verification notes.

### Phase 2 mini-plan — 2026-04-08 JEM directory realism pass (official-layout aligned)
- [x] Replace synthetic JEM polygons with unit footprints traced against official JEM floor-plan images (L2/L3).
- [x] Add floor-plan background image support in the floor-plan contract and render it in `FloorPlanViewer`.
- [x] Keep polygon IDs and unit numbers aligned to real tenant units so list and map selections are one-to-one.
- [x] Keep non-pilot malls untouched while hardening only the JEM pilot.
- [x] Run `npm run typecheck` and record verification + residual limitations.

### Phase 2 mini-plan — 2026-04-08 Directory map standardization + zoom controls
- [x] Standardize drill-down map fitting so every mall floor uses a computed fit-to-viewport base scale.
- [x] Add explicit directory zoom controls (`-`, reset, `+`) so zoom in/out works reliably even when pinch is unavailable.
- [x] Reduce visual clutter for image-backed floor maps by hiding synthetic corridor overlays and suppressing dense labels at low zoom.
- [x] Keep polygon/list selection contract unchanged while improving visual alignment readability.
- [x] Run `npm run typecheck` and record verification notes.

### Done criteria
- [ ] Critical user journeys run end-to-end in mock mode.
- [ ] Verification commands are green and logged.
| Date | Actor | Summary | Status | Next Step |
|------|-------|---------|--------|-----------|
| 2026-04-09 | Claude | Full codebase audit: 4 parallel subagents audited Home/Discover, Maps/Detail, Auth/Review/Profile, and Components/Theme. Generated consolidated backlog with 15 P0, 47 P1, and 57 P2 items. Created verification matrix for 7 domains. | Completed | Codex to triage and begin executing P0 items; Claude to define acceptance criteria for P0 fixes |

---

## 5. Verification Commands Log

### Claude primary
- [x] Specify analytics KPIs and dashboard-ready metric definitions.
- [x] Define event-to-metric mapping and data quality expectations.
- [x] Propose phased rollout path for backend/event ingestion.

### Codex primary
- [ ] Add event instrumentation hooks in frontend service/store boundaries.
- [ ] Keep analytics hooks mock-safe (no backend dependency required).
- [ ] Add data validation helpers for fixture integrity checks.

### Done criteria
- [ ] Event schema is documented and instrumentation is implemented for key flows.
- [ ] Mock data quality checks are executable and recorded.

---

## Phase 4 — Ordering + Payments Preparation (Future)

### Claude primary
- [ ] Break down ordering system architecture (consumer, vendor, platform analytics).
- [ ] Document payment/provider tradeoffs and compliance constraints.
- [ ] Define queue-time/crowd-estimation model assumptions.

### Codex primary
- [ ] Scaffold frontend contracts and placeholders for order/cart/checkout flows.
- [ ] Add feature flags for future ordering capabilities.
- [ ] Maintain separation between MVP shell and future ordering modules.

### Done criteria
- [ ] Future-facing contracts exist without destabilising current MVP.
- [ ] Feature flags gate unfinished modules cleanly.

---

## Shared Session Log (Claude + Codex must append)

- [ ] Session log maintained with: date, actor (Claude/Codex), tasks touched, status, blockers, next step.

### Session Entries
- 2026-04-05 | Codex | Updated project-fit task requirements, phased Claude/Codex ownership checklist, and planning cadence. | Status: completed for documentation update. | Blockers: none. | Next: keep this checklist current during implementation sessions.
- 2026-04-06 | Codex | Audited app screen inventory, research docs, and design artifacts; created Stitch-ready design-system and screen-brief files under `design/stitch/`. | Status: completed for design planning artifact. | Blockers: direct Stitch editing is not available in this environment. | Next: generate remaining screens in Stitch using `design/stitch/DESIGN.md` and `design/stitch/STITCH_BRIEFS.md`, then sync the chosen outputs back into Figma and code.
- 2026-04-08 | Codex | Reconciled repo housekeeping and status docs with the actual codebase: removed stale `AGENT.md`, archived older design iterations under `design/archive/`, cleaned local artifacts, and updated instruction references. | Status: completed for repository cleanup and documentation alignment. | Blockers: none. | Next: use Phase 2 as the active workstream and keep verification notes current as UI hardening continues.
- 2026-04-08 | Codex | Started Figma-fidelity hardening pass: auth-first shell, guest-flow removal, emoji purge, shared primitive restyle, and device-matrix QA prep. | Status: in progress. | Blockers: final visual fidelity depends on runtime verification against simulators after code changes. | Next: update auth/session flow, restyle Search and Stall Detail to match Figma, then run multi-device QA.
- 2026-04-08 | Codex | Completed the Figma-fidelity hardening pass for auth/session, shared primitives, Discover/Search, Stall Detail, and runtime emoji removal. | Status: completed for the code pass with review notes recorded. | Blockers: simulator access from this sandbox is limited because CoreSimulatorService is unavailable here, and `npm run test` is not defined in package.json. | Next: run on-device or local simulator visual smoke tests outside the sandbox, then continue with Home/Reads/Profile polish if needed.
- 2026-04-08 | Codex | Continued the hardening pass: removed the remaining runtime soft-gate path, made signed-out protected actions route directly into auth, aligned login methods to the same onboarding-first flow, prevented review-compose from falling back to the wrong dish, tightened Discover/Search composition, reduced pill-heavy styling, and improved Home/Stall Detail layout behavior. | Status: completed for this implementation batch. | Blockers: the remaining work is visual polish, especially Home feed overlay density, tighter Search fidelity, and flatter Stall Detail composition. | Next: run local simulator checks on iPhone 16e/16/16 Pro/16 Pro Max and Android, then finish the remaining visual polish based on screenshots instead of code-only review.
- 2026-04-08 | Codex | Added the Hungry marketing launch workspace under `marketing/` with positioning, waitlist copy, wireframe, channel playbook, 30-day calendar, copy pack, video briefs, AI prompt pack, outreach playbook, and brand/visual rules. | Status: completed for documentation implementation. | Blockers: the sandbox can read `.agents/` but cannot write into it, so the product marketing context draft currently lives at `marketing/strategy/product-marketing-context.md` instead of `.agents/product-marketing-context.md`. | Next: if a less restricted local environment is available, mirror that file into `.agents/` so other marketing skills can consume it automatically.
- 2026-04-08 | Codex | Implemented the Figma-based maps deliverables: real `MapSurface` wrapper with token-aware fallback, rebuilt `Maps` and `MapZoomedIn`, rewired `BuildingDrillDown`, bridged Singapore/mock building IDs, and added a demo Maxwell `L2` floor plan with matching mock venues and dishes. | Status: completed for the code pass. | Blockers: live Mapbox rendering still requires `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in the local environment; without it, the repo falls back to a static coordinate preview. | Next: run the app locally on simulator/device to visually inspect the live map route and the Maxwell drill-down flow with a real token configured.
- 2026-04-08 | Codex | Fixed the Home route container to render as a direct safe-area feed surface, added a feed empty state, and removed visible scroll indicators from shared screen wrappers plus remaining explicit scrollable surfaces. | Status: completed for this UI hardening patch. | Blockers: runtime simulator verification is still needed to confirm the Home tab now renders correctly on-device. | Next: open the app locally and verify Home, Review, Search Results, Dish Detail, and the developer launcher no longer show scrollbars.
- 2026-04-08 | Codex | Reworked `BuildingDrillDown` into a directory-map-first mall flow with synced polygon selection, selected-stall overlay details, a Google-style vertical floor pill, and realistic custom Wisma/JEM floor plans with alias-aware loading. | Status: completed for this implementation batch. | Blockers: visual parity still needs manual simulator/device confirmation against Figma using real map runtime where applicable. | Next: run local iOS/Android visual QA on mall drill-down flows (Wisma/JEM) and tune spacing/polygon labeling from screenshots.
- 2026-04-08 | Codex | Implemented the single-mall pilot pass for Koufu @ JEM: fixed `Maps` sheet drag behavior, added dynamic camera padding, and rebuilt JEM L2/L3 floor plans with tenant/corridor/facility polygons plus tenant-list sync. | Status: completed for code + typecheck. | Blockers: visual QA on-device is still needed to tune map-sheet feel and directory readability at runtime densities. | Next: run local simulator checks with a real Mapbox token and review JEM drill-down touch targets on compact and large iPhone screens.
- 2026-04-08 | Codex | Started the JEM realism correction pass after user feedback: switching to official JEM floor-map references, adding background map rendering support, and re-tracing JEM tenant polygons to match actual unit geometry for L2/L3. | Status: in progress. | Blockers: precise polygon quality depends on manual tracing quality against static mall map assets in this repo pass. | Next: complete polygon/data sync updates, run typecheck, then share what can be visually verified from the app.
- 2026-04-08 | Codex | Completed JEM realism correction pass: added official JEM L2/L3 map backgrounds, replaced synthetic unit geometry with official-layout-aligned polygons, synced list/map IDs, and tuned JEM directory scale for map readability in drill-down. | Status: completed for implementation + typecheck. | Blockers: unit polygon tracing is still manually authored and may need one more visual pass from simulator screenshots for pixel-level parity. | Next: run on-device visual QA and tighten any outlier polygons based on screenshots.
- 2026-04-08 | Codex | Implemented directory-map standardization + zoom controls: switched floor maps to computed fit-scale per floor, added explicit zoom controls (`-`, reset, `+`), and reduced overlay clutter on image-backed maps by hiding corridor fills and label density at low zoom. | Status: completed for implementation + typecheck. | Blockers: true 1:1 fidelity for every mall still requires per-mall official floor maps and per-unit tracing pass (data authoring, not renderer logic). | Next: ingest remaining mall floor-map assets and trace unit polygons using the same standardized coordinate contract.
- 2026-04-09 | Codex | Began the staged UI polish pass for global navigation and Home interactions only: hid tab labels with larger icons, tightened global back-button scroll behavior, removed Home feed card chrome/FAB, fixed Bites routing to real dishes, and added exclusive single/double-tap text gestures for expand/like. | Status: completed for block 1 implementation + typecheck. | Blockers: remaining blocks (Discover, Map, Stall Detail) are intentionally pending user confirmation before implementation. | Next: continue block-by-block after approval.
- 2026-04-09 | Codex | Closed high-priority QA gaps: made stall-detail community review cards actionable via Quick review/Post selection, removed the Stall Detail open/closed status metadata card, and kept auth-gated routing for both actions. | Status: completed for targeted fixes + typecheck. | Blockers: none for this patch. | Next: continue remaining XML blocks after user confirmation.
- 2026-04-09 | Codex | Added a product and planning requirement for richer Favourites retrieval: users should be able to sort saved dishes by dish type (for example chicken rice, nasi lemak), rating, taste profile, and location. | Status: completed for documentation update only. | Blockers: the current domain layer does not yet define an explicit dish-type taxonomy for favourites sorting. | Next: decide the dish-type contract, then implement repository-backed sorting in the Favourites flow.
- 2026-04-09 | Codex | Rebuilt `StallDetailScreen` against Figma node `113:811` composition (top nav, hero overlap, location badge, pricing/rating hierarchy, attribute grid, primary taste-profile CTA, opening-hours split, signature dish tile grid, and community card styling) while preserving review action choices. | Status: completed for visual alignment pass + typecheck. | Blockers: final pixel-level fit still needs simulator screenshot QA. | Next: run device screenshot comparison and tighten spacing/typography deltas if needed.
- 2026-04-09 | Codex | Executed backlog batch `P0-04`, `P0-13`, `P1-28`, and pending map polish: auth form validation added across all auth forms, orange badge tone fixed, review recommend default changed to false, and NEA/Hygiene map text removed. Added/ran new TypeScript unit tests and restored `npm test` script. | Status: completed for batch + verification. | Blockers: remaining P0/P1 backlog items still pending and will be handled in next batches. | Next: continue with the next highest-priority P0 flow blockers (onboarding state persistence and detail delivery handoff behavior).
- 2026-04-09 | Codex | Implemented targeted UI bug-fix batch for onboarding/review/stall detail polish: removed onboarding top-left back icon, hardened global back safe-area behavior to prevent header overlap, removed review flow "Choose another dish", redesigned Recommend UI into a segmented control, set chip borders to primary orange, replaced stall-card opening-hours metric with distance, and rebuilt hero fade using Figma node `113:811` gradient stops. | Status: completed for block 1 (`global_navigation_and_layout` + `review_flow_and_cards`) with verification. | Blockers: `map_and_data_logic` block is intentionally pending next step. | Next: fix map polygon tap hit-testing and strict F&B filtering in building directory list.
- 2026-04-09 | Codex | Addressed follow-up regressions from screenshot QA: removed non-food units from stall directory list by enforcing venue-backed F&B filtering, and replaced `expo-linear-gradient` usage in Stall Detail with a pure RN layered fade to remove native runtime crash while restoring readable image-to-text transition. | Status: completed + verified. | Blockers: map polygon hit-testing fix still pending in next block. | Next: implement map polygon interaction reliability improvements (`onStallPress` hit target/z-index audit).
- 2026-04-10 | Claude | Phase 1 architecture strategy (P1-01), feature-level DoD (P1-02), event taxonomy with 33 named events (P1-03), and tradeoffs/decisions log (P1-04) written. Phase 3 KPI definitions (P3-01), event-to-metric mapping (P3-02), and phased rollout strategy (P3-03) written. Pruned P2-04 (paddingBottom now computed — confirmed in HomeFeedScreen.tsx:307) and P2-11 (map disclaimer text resolved — confirmed in HomeMapScreen.tsx:358-363). P0 items annotated with recommended execution order. | Status: completed. | Blockers: none. | Next: Codex to implement P1-05 (serviceProvider.ts) and P3-04/P3-05 (analytics instrumentation hooks).

---

## Verification Commands Log

- [x] `npm run typecheck`
- [ ] `npx expo-doctor`

Add dated command outputs under each active workstream when run.


### Verification Notes
- 2026-04-05: `npm run typecheck` passed after task-document updates.
- 2026-04-08: Repository audit shows implemented screens for Splash, Auth, Onboarding, Home, Discover, Search, Maps, Review, Profile, Reads, Offline, NotFound, and developer utilities are present under `src/app/screens/`.
- 2026-04-08: `npm run typecheck` passed after the Figma-fidelity hardening patch set.
- 2026-04-08: `npm run typecheck` passed again after removing the runtime soft-gate path and tightening Discover/Search/Home/Stall Detail.
- 2026-04-08: `npm run test` could not run because `package.json` does not define a `test` script.
- 2026-04-08: Device QA was completed as a code-based review matrix for iPhone 16e, 16, 16 Pro, 16 Pro Max, and Android sanity because `xcrun simctl` could not access CoreSimulatorService from this sandbox.
- 2026-04-08: `npm run typecheck` passed after the JEM official-layout correction pass (background floor map rendering + L2/L3 polygon remap).
- 2026-04-08: `npm run typecheck` passed after directory map standardization updates (fit-to-viewport scale, zoom controls, and image-map overlay cleanup).
- 2026-04-08: Marketing launch documentation was added under `marketing/`; the sandbox could not write into `.agents/`, so the repo-grounded product marketing context is stored at `marketing/strategy/product-marketing-context.md`.
- 2026-04-08: `npm run typecheck` passed after the marketing launch documentation, README index, and task-log updates.
- 2026-04-08: `npm run typecheck` passed after the map deliverable, route rewiring, Maxwell demo L2 floor plan, and building-layout drill-down implementation.
- 2026-04-08: `npm run typecheck` passed after the Home feed container fix and app-wide scrollbar suppression cleanup.
- 2026-04-08: `npm run typecheck` passed after the mall directory-map realism pass (Wisma/JEM custom floor overlays, vertical level pill, and drill-down sync logic).
- 2026-04-08: `npm run typecheck` passed after the single-mall pilot pass (draggable Maps sheet, dynamic camera padding, and JEM L2/L3 tenant/corridor/facility polygon overlays).
- 2026-04-09: `npm run typecheck` passed after global navigation and Home interaction updates (tab labels removed, smart back visibility tuning, Home gesture rewiring, and Bites data/routing fixes).
- 2026-04-09: `npm run typecheck` passed after stall-detail review-card action-sheet wiring and open/closed status-card removal.
- 2026-04-09: `npm run typecheck` passed after Figma-driven Stall Detail rebuild for node `113:811`.
- 2026-04-09: `npm run typecheck` and `npm test` both passed after auth validation hardening, orange badge-tone fix, review default-recommend change, NEA/Hygiene label removal from map screens, and test harness restoration.
- 2026-04-09: `npm run typecheck` and `npm test` both passed after onboarding back-button removal, global back safe-area/header spacing hardening, review CTA cleanup + segmented recommend control, chip border-orange update, and Figma-based hero gradient update on Stall Detail.
- 2026-04-09: `npm run typecheck` and `npm test` both passed after replacing `expo-linear-gradient` with a native-module-free layered fade and applying strict venue-backed filtering for F&B-only stall directory rows.
- [x] `npm run typecheck` — 2026-04-08
- [ ] `npx expo-doctor`
- [x] `npm run test` — 2026-04-09

---

## Notes

- This backlog supersedes the previous Phase 1–5 checklist structure. Completed phases (1–5 original) are archived above for reference.
- P0 items should be addressed before any new feature work.
- The verification matrix should be used as the acceptance gate for Phase 2 "done criteria".
- Future phases (6–10: Ordering, Payments, Vendor Analytics, Crowd Signals, Platform Data) remain unchanged and are tracked in the original phase definitions.
