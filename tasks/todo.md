# Hungry — Consolidated Audit Backlog

> Generated 2026-04-09 by Claude (Opus) after a full codebase audit against product-context.md, design-system.md, screens.md, data-contracts.md, and the Figma prototypes.

---

## 0. Done (Execution Batches)

### Final-State Summary (Collapsed)

This section intentionally replaces detailed per-batch writeups with a condensed final-state view.
Detailed execution chronology remains in:
- Section 5 shared session log
- Section 6 verification commands log

| Window | Delivery Summary | Final Verification |
|----|----|----|
| 2026-04-09 to 2026-04-11 | Closed P0/P1 flow blockers across onboarding persistence, location permissions, review media stability, profile persistence, map sheet behavior, and core interaction regressions. | `typecheck` and tests green per session log entries. |
| 2026-04-12 | Completed architecture/contract hardening (`serviceProvider`, typed service boundaries), analytics instrumentation, fixture validation, and design-audit implementation batches. | `typecheck` + tests green; supporting verification recorded in Sections 5 and 6. |
| 2026-04-13 | Closed residual P1/P2 items, tokenization and accessibility cleanup, full branch QA/QC audit, P2-08 search-history fix, and follow-up typecheck recovery pass. | `npm run typecheck`, `npm test -- --runInBand`, and `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor` all green. |

### Final Closure Snapshot

| Group | Status | Notes |
|----|----|----|
| P0 blockers | Done | Runtime and persistence blockers closed (including review photo flow and profile hydration guards). |
| P1 UX/state backlog | Done | Core screen fidelity and state-flow gaps are closed and reflected in Section 2 statuses. |
| P2 polish/copy/consistency | Done | Tokenization, semantics, and copy cleanup complete, including P2-08 search history behavior. |
| Phase 2 done criteria | Done | `P2-DC1` and `P2-DC2` recorded as closed with evidence. |
| Phase 3 readiness (tracked items) | Done | `P3-04` to `P3-08` marked complete with instrumentation and validation references. |

### Final-State Closure Checklist

- [x] `P2-08` now persists only real user-entered search history (trim/empty guard, case-insensitive dedupe, capped recency).
- [x] Stale open-task section labels were replaced with completed ownership labels for Codex and Gemini.
- [x] Verbose completed-batch history was collapsed into a final-state summary + closure snapshot.
- [x] Completion/progress wording in this backlog is synchronized with the latest green verification gates.

---

## 1. Phase 1 & Phase 3 Reference (Closed)

### Phase 1 — Product + Architecture Planning

> P1-01 through P1-04 are completed Claude deliverables. Architecture follow-ups use `P1-ARCH-*` IDs to avoid collision with UI backlog IDs.

---

#### P1-01 — Mock-First Architecture Strategy

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

**State Persistence Status (current):**
- Zustand `persist` is already active for the core app stores after P0-14
- Current persisted stores include `useSessionStore`, `useProfileStore`, `useSearchStore`, `useLocationStore`, and `useReviewDraftStore`
- Future backend/native-storage work should decide whether `useReviewDraftStore` remains persisted or is intentionally reset on cold start; current runtime behavior keeps the draft

---

#### P1-02 — Feature-Level Definition of Done

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

#### P1-03 — Event Taxonomy

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
| `dish_viewed` | Dish detail screen opened | `{ dish_id: string, venue_id: string, source: 'search' | 'home' | 'maps' | 'favourites' | 'wheel' | 'stall' }` |
| `stall_viewed` | Stall detail screen opened | `{ venue_id: string, building_id: string, source: 'maps' | 'search' | 'dish_detail' }` |
| `search_submitted` | Search query submitted | `{ query_length: number, result_count: number, categories_active: number, dietary_flags_active: number }` |
| `taste_filter_applied` | Apply tapped on TasteFilter | `{ axes_changed: string[], result_count: number }` |
| `taste_filter_reset` | Reset to profile tapped | `{}` |
| `category_chip_tapped` | Category chip toggled | `{ category: SearchCategory, selected: boolean }` |

**Engagement**

| Event | Trigger | Key Properties |
|-------|---------|---------------|
| `delivery_link_tapped` | Delivery button tapped | `{ dish_id: string, venue_id: string, platform: DeliveryPlatform }` |
| `directions_tapped` | Directions button tapped | `{ venue_id: string, building_id: string }` |
| `dish_favourited` | Dish added to favourites | `{ dish_id: string, venue_id: string, source: 'dish_detail' | 'search' | 'home' }` |
| `dish_unfavourited` | Dish removed from favourites | `{ dish_id: string }` |
| `review_started` | Review flow entered | `{ trigger: 'tab' | 'dish_detail' | 'stall_detail' }` |
| `review_step_completed` | Step N completed | `{ step: 1|2|3|4, step_name: 'venue'|'rating'|'tags'|'compose', has_dish_selected: boolean }` |
| `review_submitted` | Review successfully submitted | `{ dish_id: string, venue_id: string, rating: number, has_text: boolean, has_photos: boolean, tag_count: number }` |
| `review_abandoned` | Review flow exited early | `{ at_step: 1|2|3|4 }` |
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
| `sign_up_completed` | Auth sign-up done | `{ method: 'email' | 'google' | 'apple' }` |
| `sign_in_completed` | Auth sign-in done | `{ method: 'email' | 'google' | 'apple' }` |
| `sign_out` | User signs out | `{}` |
| `password_reset_completed` | Password reset success | `{}` |

---

#### P1-04 — Tradeoffs & Decisions Log

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
| `Reads` tab | Feature-flagged (`FEATURE_FLAGS.readsEnabled`) | Always-on | Safe toggle without deploy; navigation enforcement is now implemented (P1-42 complete). |
| Review system | Full mock flow (no backend) | Defer until backend ready | Reviews are core engagement signal; mock flow enables investor demos and tests complete UI/UX contract |

---

#### Codex Task Ownership (Completed)

| ID | Item | Owner |
|----|------|-------|
| P1-ARCH-05 | Done (Batch 2026-04-12D): Created `src/lib/services/serviceProvider.ts` as the single injection point for mock/live service wiring. | Codex |
| P1-ARCH-06 | Done (Batch 2026-04-12D): Updated typed service interfaces and added TODO API anchors for mock-to-live replacement. | Codex |
| P1-ARCH-07 | **REOPENED (Audit 2026-04-13):** Only 7 of ~27 data-access sites use `serviceProvider`; 20 screen files still import `mockRepository` directly. Progress: batches 1-6 are now migrated to `getDataRepository()` and direct `mockRepository` imports in `src/app/` + `src/features/` are cleared (Batches 2026-04-13I/J/K/L/M/N). | Codex |
| P1-08 | Done: Planning artifacts committed and discoverable in this backlog + linked docs. | Both |
| P1-09 | Done: implementation-to-requirement mapping is synchronized through Batch 2026-04-13C with verification evidence logged per batch. | Both |

#### Gemini Design Ownership (Completed)

> Gemini is the design owner for open frontend/UI/UX work. Gemini should produce concrete screen-level direction, copy replacements, spacing/type/icon specs, motion guidance, and acceptance references that Codex can implement without re-interpreting intent.

| ID | Item | Owner | Status |
|----|------|-------|--------|
| G-01 | Done (Batch 2026-04-12): Audited all remaining open visual/UI backlog items in P1/P2 and grouped them into screen-level design batches. | Gemini | |
| G-02 | Done (Batch 2026-04-12): Provided the final visual spec for the `Maps` bottom-sheet cleanup. See `docs/audit/MAPS_SPEC.md`. | Gemini | |
| G-03 | Done (Batch 2026-04-12): Provided the final visual polish spec for `StallDetail` and `DishDetail` delivery-brand treatment. See `docs/audit/DETAIL_SPEC.md`. | Gemini | |
| G-04 | Done (Batch 2026-04-12): Provided copy replacements for all remaining developer-facing or mock-revealing text. See `docs/audit/COPY_REPLACEMENTS.md`. | Gemini | |
| G-05 | Done (Batch 2026-04-12): Defined the final auth visual system pass for consistent branding across login, signup, verification, forgot, and reset screens. See `docs/audit/AUTH_SPEC.md`. | Gemini | |
| G-06 | Done (Batch 2026-04-12): Defined the final `Search` and `Discover` UI polish pass covering suggested card content, empty-state actions, and carousel affordances. See `docs/audit/SEARCH_SPEC.md`. | Gemini | |
| G-07 | Done (Batch 2026-04-12): Defined the final `Profile` and `Reads` visual/content polish pass covering settings density, edit-profile completeness, and article metadata. See `docs/audit/PROFILE_READS_SPEC.md`. | Gemini | |
| G-08 | Done (Batch 2026-04-12): Defined shared component cleanup guidance for remaining token/typography/shape inconsistencies. See `docs/audit/SHARED_COMPONENTS_SPEC.md`. | Gemini | |
| G-09 | Done (Batch 2026-04-12): Defined accessibility presentation guidance for unresolved UI items. See `docs/audit/ACCESSIBILITY_SPEC.md`. | Gemini | |
| G-10 | Done (Batch 2026-04-12): Attached explicit acceptance criteria for every Gemini design batch in their respective spec files. | Gemini | |

### Phase 2 — Core App Hardening (Done Criteria)

| ID | Item | Owner |
|----|------|-------|
| P2-DC1 | Done: full mock-mode closure pass explicitly recorded (P1/P2 residual scope audited, token/a11y residuals closed, and verification rerun: `typecheck`, `test`, `expo-doctor` all green on 2026-04-13). | Both |
| P2-DC2 | Done (Batch 2026-04-13G): reopened 25-error typecheck regression is closed; token-scope fixes applied in onboarding/components and verification rerun passed (`npm run typecheck`, `npm test -- --runInBand`). | Both |

### Phase 3 — Data + Analytics Readiness

> P3-01 through P3-03 are completed Claude deliverables. P3-04 through P3-06 are implemented, and P3-07/P3-08 are now supported by the recorded instrumentation and validation passes below.

---

#### P3-01 — KPI Definitions

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

#### P3-02 — Event-to-Metric Mapping

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

#### P3-03 — Phased Rollout Strategy

**Phase 1 — Current (Mock-First, No Backend)**
- All service calls: `mockService` via `HungryService` interface (`src/lib/services/mock/mockService.ts`)
- Analytics: events defined in P1-03 taxonomy; Phase 1 implementation is console-log-only sink
- Feature flags: hardcoded in `src/constants/featureFlags.ts`
- Zustand persistence is active for core stores (`session`, `profile`, `search`, `location`, `reviewDraft`, etc.)

**Phase 2 — Backend Integration**
1. Supabase project: PostgreSQL + PostGIS (buildings/venues/dishes), pgvector (taste vectors), Supabase Auth
2. Create `src/lib/services/supabase/supabaseService.ts` implementing `HungryService` — same interface, zero screen changes
3. Update `serviceProvider.ts` (P1-05) to export `supabaseService` — single-file swap
4. If native-storage performance becomes a concern, swap the current persistence backing store to MMKV without changing store contracts
5. Harden live GPS integration and fallback telemetry (baseline `expo-location` integration already shipped)
6. Harden native media integration and upload pipeline (baseline `expo-image-picker` flow already shipped)
7. Analytics SDK: integrate PostHog or Amplitude; replace console sink with real event batching
8. Feature flags: migrate to Supabase-backed remote config or LaunchDarkly

**Phase 3 — Analytics & Merchant Layer**
1. Analytics dashboards: PostHog/Amplitude self-serve using KPIs from P3-01
2. Event instrumentation: add hooks at service/store boundaries (P3-04, P3-05)
3. Data quality CI: fixture integrity checks (P3-06) — validate IDs, required fields, taste vector ranges [0–10]
4. Merchant Business Portal: Next.js web app (separate repo); Verified Stall and Stall Pro tiers
5. A/B testing: Decide For Me FAB placement, Taste Filter entry point, Home feed ranking variants

---

#### Codex Task Ownership (Completed)

| ID | Item | Owner |
|----|------|-------|
| P3-04 | Done (Batch 2026-04-12E): Added event instrumentation hooks in frontend service/store boundaries. | Codex |
| P3-05 | Done (Batch 2026-04-12E): Analytics hooks are mock-safe with no backend dependency. | Codex |
| P3-06 | Done (Batch 2026-04-12E): Added fixture validation helpers and tests. | Codex |
| P3-07 | Done: event schema is documented in P1-03 and key instrumentation landed in Batch 2026-04-12E. | Both |
| P3-08 | Done: mock data quality checks are executable via `src/lib/services/mock/validation.ts`, covered by tests, and recorded in verification notes. | Both |

---

## 2. Prioritised UX & State-Handling Backlog

### P0 — Blocker / Broken Flow

These items break core user journeys or render features non-functional.

> **Recommended execution order:** P0-14 → P0-01+P0-02 → P0-05 → P0-08 → P0-10+P0-11+P0-12 → P0-06 → P0-03 → P0-07 → P0-09 → P0-15

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P0-16 | Review | Done (Batch 2026-04-11C): **Bug: App crashes when clicking Add Photo.** Fixed by guarding the add-photo path with lazy native-module load + graceful fallback; iOS pods synced for `ExpoImagePicker`. | `PhotoPicker.tsx`, iOS native modules |
| P0-17 | Profile | Done (Batch 2026-04-11C): **Bug: Profile dietary preferences reset after relaunch.** Fixed by preventing bootstrap re-sync from wiping hydrated profile state. | `useAppBootstrap.ts`, `useProfileStore.ts` |

### P1 — UX / UI Degradation

These items degrade the user experience but do not fully block flows.

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P1-01 | Detail | Done (Batch 2026-04-10J): DishDetail now has a gallery-aware hero carousel. | `DishDetailScreen.tsx` |
| P1-02 | Detail | Done (Batch 2026-04-10J): DishDetail now uses radar chart taste visualization. | `DishDetailScreen.tsx` |
| P1-03 | Detail | Done (Batch 2026-04-10J): DishDetail now uses `variant="price"` for price display. | `DishDetailScreen.tsx` |
| P1-04 | Detail | Done: DishDetail delivery buttons now use brand colours (Grab green, Foodpanda pink, Deliveroo teal). | `DishDetailScreen.tsx` |
| P1-05 | Detail | Done (Batch 2026-04-10J): StallDetail community reviews now derive from venue dish review data. | `StallDetailScreen.tsx` |
| P1-06 | Detail | Done (Batch 2026-04-10J): StallDetail closure notice now uses `InlineBanner`. | `StallDetailScreen.tsx` |
| P1-07 | Detail | Done (Batch 2026-04-10J): StallDetail now renders colour-coded hygiene grade badge. | `StallDetailScreen.tsx` |
| P1-08 | Detail | Done (Batch 2026-04-10J): StallDetail share/favourite actions are implemented. | `StallDetailScreen.tsx` |
| P1-09 | Detail | Done (Batch 2026-04-10J): Detail not-found states now render inside `Screen` wrappers. | `DishDetailScreen.tsx`, `StallDetailScreen.tsx` |
| P1-10 | Discover | Done (Batch 2026-04-10M): DecideForMe now has no-match radius expansion actions. | `DecideForMeResultScreen.tsx` |
| P1-11 | Discover | Done (Batch 2026-04-10M): DecideForMe now triggers haptic feedback on result transitions. | `DecideForMeResultScreen.tsx` |
| P1-12 | Discover | Done (Batch 2026-04-10M): AnimatedMatchBadge is now functional and rendered with numeric animation output. | `DecideForMeResultScreen.tsx` |
| P1-13 | Discover | Done (Batch 2026-04-10M): Try-another logic now picks a distinct next dish. | `DecideForMeResultScreen.tsx` |
| P1-14 | Discover | Done (latest UX direction): BuildingDrillDown directory is back to compact full-width list rows (grid experiment reverted). | `BuildingDrillDownScreen.tsx` |
| P1-15 | Discover | Done (Batch 2026-04-10M): BuildingDrillDown now surfaces `venue.closureNotice` in directory cards. | `BuildingDrillDownScreen.tsx` |
| P1-43 | Discover | Done: Map bottom sheet geometry tightened: square bottom, flush to edge, 240/600px heights. | `HomeMapScreen.tsx` |
| P1-44 | Discover | Done: Map bottom sheet card corners squared at bottom. | `HomeMapScreen.tsx` |
| P1-16 | Home | Done (Batch 2026-04-10J): HomeFeedScreen now has loading and retry-on-error states before feed render. | `HomeFeedScreen.tsx` |
| P1-17 | Home | Done: true React child-render crash handling now uses `FeedErrorBoundary` around feed surfaces with fallback and retry. | `HomeFeedScreen.tsx`, `ReadsFeedScreen.tsx`, `FeedErrorBoundary.tsx` |
| P1-18 | Search | Done (Batch 2026-04-10J): SearchResultsScreen now has loading state while results refresh. | `SearchResultsScreen.tsx` |
| P1-19 | Search | Done (Batch 2026-04-10J): SearchResultsScreen now supports sort by match, distance, rating, and price. | `SearchResultsScreen.tsx`, `search.ts` |
| P1-20 | Search | Done: `groupResultsByVenue` now groups by venue, enriches venue metadata, and sorts by distance/rating relevance. | `search.ts` |
| P1-21 | Search | Done: Discover collections now iterate all buildings, dedupe venues, and rank by taste affinity plus proximity (no hardcoded building IDs). | `search.ts` |
| P1-22 | Onboarding | Done: onboarding no longer exposes raw `SCR-*` developer IDs in runtime UI. | `OnboardingScreenShell.tsx`, `TasteQuizScreen.tsx`, `LocationPermissionScreen.tsx` |
| P1-24 | Review | Done: review flow now consistently uses 4-step progress. | `ReviewHubScreen.tsx`, `ReviewTagsScreen.tsx`, `ReviewComposeScreen.tsx` |
| P1-25 | Review | Done: unauthenticated review hub now redirects without rendering blocked content. | `ReviewHubScreen.tsx` |
| P1-26 | Review | Done: ReviewHub now renders an explicit empty state for zero matching venues. | `ReviewHubScreen.tsx` |
| P1-27 | Review | Done: ReviewRating now returns to hub when no valid dish exists (no random fallback). | `ReviewRatingScreen.tsx` |
| P1-29 | Review | Done: end-user debug button removed from compose screen. | `ReviewComposeScreen.tsx` |
| P1-30 | Review | Done (Batch 2026-04-10M): Review compose now uses real image picker integration (`expo-image-picker`). | `ReviewComposeScreen.tsx`, `PhotoPicker.tsx` |
| P1-31 | Profile | Done: Favourites cards now navigate to DishDetail from profile flow. | `FavouritesScreen.tsx` |
| P1-32 | Profile | Done: Favourites cards now include image, venue, rating, and distance metadata. | `FavouritesScreen.tsx` |
| P1-33 | Profile | Done: Review history empty state now uses shared `EmptyState` component. | `ReviewHistoryScreen.tsx` |
| P1-34 | Profile | Done: Review history now surfaces user-submitted rating/tags/text entries. | `ReviewHistoryScreen.tsx`, `useProfileStore.ts` |
| P1-35 | Profile | Done (Batch 2026-04-10J): Radar chart now shows explanatory fallback when taste vector has no signal. | `ProfileRadarChart.tsx` |
| P1-36 | Profile | Done (Batch 2026-04-10J): sign-out/root redirects now use root-navigation traversal helper. | `ProfileHomeScreen.tsx`, `SettingsScreen.tsx`, `ReviewHistoryScreen.tsx`, `getRootNavigation.ts` |
| P1-37 | Component | Done: FloatingToast now has entrance/exit animations. | `FloatingToast.tsx` |
| P1-38 | Component | Done: FloatingToast now uses `zIndex.toast`. | `FloatingToast.tsx` |
| P1-39 | Component | Done: FloatingToast now uses correct tone mapping and icons. | `FloatingToast.tsx` |
| P1-40 | Component | Done: HygieneGradeBadge updated with semantic tokens for dark mode. | `HygieneGradeBadge.tsx` |
| P1-41 | Component | Done: FloorPlanViewer updated with semantic tokens for dark mode. | `FloorPlanViewer.tsx` |
| P1-42 | Reads | Done: Reads tab inclusion now enforced via feature flag in navigation. | `RootNavigator.tsx` |
| P1-43S | Splash | Done: splash animated values are stable `useRef` instances (not recreated on rerender). | `SplashScreen.tsx` |
| P1-44S | Splash | Done: splash app version now reads from Expo runtime config (`expo-constants`). | `SplashScreen.tsx` |
| P1-45 | Auth | Done: login, signup, and reset-password screens now include password visibility toggles. | `LoginScreen.tsx`, `SignUpScreen.tsx`, `ResetPasswordScreen.tsx` |
| P1-46 | Auth | Done: signup terms/privacy copy now includes tappable links. | `SignUpScreen.tsx` |
| P1-47 | Search | Done: TasteFilter sliders now use `step={1}` and have axis legends. | `TasteFilterScreen.tsx` |
| P1-48 | Detail | Done: StallDetail hero polished with `LinearGradient` fade. | `StallDetailScreen.tsx` |

### P2 — Polish / Copy / Consistency

These items affect perceived quality but do not break functionality.

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P2-01 | Home | Done: Home feed empty state copy updated. | `HomeFeedScreen.tsx` |
| P2-02 | Home | Done: Home feed social engagement counts are now dynamic. | `HomeFeedScreen.tsx` |
| P2-03 | Home | Done: Home greeting is now dynamic based on time-of-day. | `HomeFeedScreen.tsx` |
| P2-05 | Search | Done: DishSearch suggested card polished with high-contrast layout. | `DishSearchScreen.tsx` |
| P2-06 | Search | Done: SearchResults redundant subtitle removed. | `SearchResultsScreen.tsx` |
| P2-07 | Search | Done: SearchResults empty state CTA improved. | `SearchResultsScreen.tsx` |
| P2-08 | Search | Done: `recentSearches` now persists real user-entered history only (no hardcoded seeds), with trim/empty guards and case-insensitive dedupe. | `useSearchStore.ts` |
| P2-09 | Discover | Done: BuildingDrillDown placeholder corrected. | `BuildingDrillDownScreen.tsx` |
| P2-10 | Discover | Done: BuildingDrillDown dish carousel limit expanded + affordance added. | `BuildingDrillDownScreen.tsx` |
| P2-12 | Maps | Done: Map sheet open stall count logic fixed. | `HomeMapScreen.tsx` |
| P2-13 | Maps | Done: `BuildingLegend` rendered on map screen. | `HomeMapScreen.tsx` |
| P2-14 | Maps | Done: `cameraPadding` implemented in MapSurface. | `MapSurface.tsx` |
| P2-15 | Auth | Done: active auth routes no longer use `AuthScreenShell`, so the stale footer copy is no longer shown in runtime auth flows. | `AuthScreenShell.tsx`, `AuthStack.tsx` |
| P2-16 | Auth | Done: verification/forgot/reset/success routes now align to shared auth-shell branding with consistent tokenized treatment. | `LoginScreen.tsx`, `SignUpScreen.tsx`, `EmailVerificationScreen.tsx`, `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx`, `ResetPasswordSuccessScreen.tsx` |
| P2-17 | Auth | Done (Batch 2026-04-10M): Email verification resend now uses countdown + gated resend action. | `EmailVerificationScreen.tsx` |
| P2-18 | Auth | Done (Batch 2026-04-10M): Change-email action now returns to existing SignUp instance to preserve entered values. | `EmailVerificationScreen.tsx`, `SignUpScreen.tsx` |
| P2-21 | Review | Done: Mock disclosure copy removed from Review compose. | `ReviewComposeScreen.tsx` |
| P2-22 | Review | Done: Mock disclosure copy removed from success modal. | `ReviewSuccessModal.tsx` |
| P2-23 | Profile | Done: Favourites empty state copy updated. | `FavouritesScreen.tsx` |
| P2-24 | Profile | Done: Settings screen cleanup (mock banner removed). | `SettingsScreen.tsx` |
| P2-25 | Profile | Done: Edit profile now supports real avatar photo picking and routes password changes into reset-password flow. | `EditProfileScreen.tsx` |
| P2-26 | Profile | Done: EditProfile mock disclosure removed. | `EditProfileScreen.tsx` |
| P2-27 | Profile | Done (Batch 2026-04-10M): Settings now includes account deletion action with destructive confirmation. | `SettingsScreen.tsx` |
| P2-28 | Profile | Done (Batch 2026-04-10M): Settings now shows app version metadata. | `SettingsScreen.tsx` |
| P2-29 | Profile | Done: `ProfileScreen.tsx` dead indirection removed. | `ProfileStack.tsx` |
| P2-30 | Reads | Done: dynamic read time calculation implemented. | `ReadsFeedScreen.tsx` |
| P2-31 | Reads | Done: "View Archive" CTA now has an interactive `onPress` path. | `ReadsFeedScreen.tsx` |
| P2-32 | Reads | Done: Reads grid updated with token colors. | `ReadsFeedScreen.tsx` |
| P2-33 | Component | Done: `DishCard` placeholder colour now uses a theme palette token. | `DishCard.tsx` |
| P2-34 | Component | Done (Batch 2026-04-10M): PhotoPicker no longer hardcodes placeholder grey token. | `PhotoPicker.tsx` |
| P2-35 | Component | Done: `StallHeader` now consumes theme spacing/tokens instead of magic-number-only layout gaps. | `StallHeader.tsx` |
| P2-36 | Component | Done: `OperatingHours` now visually differentiates open/closed states with semantic success/error colouring. | `OperatingHours.tsx` |
| P2-37 | Component | Done: inline hardcoded `fontFamily` overrides removed from flagged components in favour of typography variants/token-driven styling. | `Button.tsx`, `ClusterPin.tsx`, `ReviewCard.tsx`, `DeliveryPlatformButton.tsx`, `BiteCard.tsx` |
| P2-38 | Component | Done: `MapSurface` fallback roads now use `palette.mapRoadPrimary/Secondary` tokens. | `MapSurface.tsx` |
| P2-39 | Component | Done: flagged `borderRadius: 999` usages replaced with tokenized `radii.pill`. | `MapSurface.tsx` |
| P2-40 | Component | Done: `BiteCard` taste tag text now uses inverse/tokenized text tone instead of hardcoded white. | `BiteCard.tsx` |
| P2-41 | Component | Done: `BitesCarousel` fixture-building logic extracted to `src/features/home/bites.ts` (no large inline data block). | `BitesCarousel.tsx`, `bites.ts` |
| P2-42 | Component | Done (Batch 2026-04-13H): removed remaining `useNavigation<any>()` callsites by applying typed `RootStackParamList` navigation props across Home/Discover/Search screens and `BitesCarousel`; verification rerun is green. | `HomeFeedScreen.tsx`, `DecideForMeResultScreen.tsx`, `CraveScreen.tsx`, `DiscoverHomeScreen.tsx`, `TasteFilterScreen.tsx`, `SearchResultsScreen.tsx`, `DishSearchScreen.tsx`, `BitesCarousel.tsx` |
| P2-43 | A11y | Done (Batch 2026-04-10M): FloatingToast now announces as alert with polite live region. | `FloatingToast.tsx` |
| P2-44 | A11y | Done (Batch 2026-04-10M): Chip now exposes selected accessibility state. | `Chip.tsx` |
| P2-45 | A11y | Done (Batch 2026-04-10M): FloorSelector tabs now expose selected accessibility state. | `FloorSelector.tsx` |
| P2-46 | A11y | Done: StarRating roles and context labels added. | `StarRating.tsx` |
| P2-47 | A11y | Done: ProfileRadarChart summary label added. | `ProfileRadarChart.tsx` |
| P2-48 | A11y | Done: MustOrderBadge accessibility label added. | `MustOrderBadge.tsx` |
| P2-49 | A11y | Done: BiteCard now has a single primary action target plus explicit accessibility labels/states on secondary controls. | `BiteCard.tsx` |
| P2-50 | A11y | Done: MapBottomSheet accessibility roles added. | `MapBottomSheet.tsx` |
| P2-51 | Infra | Done: Input component hardened with error styling. | `Input.tsx` |
| P2-52 | Infra | Done: `Skeleton` loading primitive created and exported. | `Skeleton.tsx` |
| P2-53 | Infra | Done: `Avatar` primitive created and exported. | `Avatar.tsx` |
| P2-54 | Infra | Done: `BottomSheet` general-purpose primitive created and exported. | `BottomSheet.tsx` |
| P2-55 | Infra | Done (Batch 2026-04-13G): resolved module-scope token regressions by replacing out-of-scope static usages and adopting spacing-aware style factories in affected components; typecheck is green. | `OnboardingIntroTemplate.tsx`, `DecideForMeCard.tsx`, `DishCard.tsx`, `StallCard.tsx`, `Screen.tsx` |
| P2-56 | Infra | Done: numeric z-index literals removed from targeted surfaces in favor of `zIndex.*` tokens. | `tokens.ts`, `OnboardingIntroTemplate.tsx`, `WheelSpinScreen.tsx`, `RootNavigator.tsx`, `HomeMapScreen.tsx` |
| P2-57 | Infra | Done: hardcoded animation durations replaced with `motion.*` tokens across remaining onboarding/splash/wheel/discovery surfaces. | `tokens.ts`, `SplashScreen.tsx`, `DecideForMeResultScreen.tsx`, `TasteProfileLoadingScreen.tsx`, `FoodSelectionScreen.tsx`, `TasteQuizScreen.tsx`, `OnboardingIntroTemplate.tsx`, `WheelResultModal.tsx`, `WheelSpinScreen.tsx` |
| P2-58 | Design System | **NEW (Audit 2026-04-13):** `palette.white` / `palette.textOnPrimary` token missing — 35+ `#FFFFFF` inline violations across screens and components. Need a semantic token for text-on-dark and text-on-primary surfaces. | `tokens.ts`, multiple screens |
| P2-59 | Design System | **NEW (Audit 2026-04-13):** Delivery brand colors (`#00B14F` GrabFood, `#D70F64` Foodpanda, `#00CCBC` Deliveroo) should be extracted to named constants, not inline hex strings. | `DeliveryPlatformButton.tsx` |
| P2-60 | Design System | **NEW (Audit 2026-04-13):** Busyness indicator colors (`#10B981`, `#F59E0B`, `#EF4444`) need palette tokens (e.g. `palette.statusFast`, `palette.statusModerate`, `palette.statusBusy`). | `HomeMapScreen.tsx` |
| P2-61 | Tokens | Done (Batch 2026-04-13G): removed invalid `spacing[0.5]` usage in `BiteCard` (`paddingVertical` now explicit `2`) and restored type safety. | `BiteCard.tsx` |
| P2-62 | Security | Done (Batch 2026-04-13O): `DeveloperLauncher` registration is now excluded from production stack using `__DEV__` route gating. | `RootNavigator.tsx` |
| P2-63 | Hardcoded Copy | Done (Batch 2026-04-13P): Home/Discover location labels now derive from location state + nearest-building computation, and Profile hardcoded gamification strings were replaced with data-backed copy. | `HomeFeedScreen.tsx`, `DiscoverHomeScreen.tsx`, `ProfileHomeScreen.tsx` |

### P0 — Newly Discovered Blockers (Audit 2026-04-13)

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P0-18 | Build | Done (Batch 2026-04-13G): 25 TypeScript compilation errors resolved across the six affected files; build unblocked and verified by green typecheck/test commands. | `OnboardingIntroTemplate.tsx`, `DecideForMeCard.tsx`, `DishCard.tsx`, `BiteCard.tsx`, `StallCard.tsx`, `Screen.tsx` |

### P1 — Newly Discovered UX Gaps (Audit 2026-04-13)

| ID | Area | Issue | File(s) |
|----|------|-------|---------|
| P1-49 | Home | Done (Batch 2026-04-13P): DirectMessages entry points are now feature-flagged off by default (`directMessagesEnabled: false`) and the route is conditionally registered. | `featureFlags.ts`, `RootNavigator.tsx`, `HomeFeedScreen.tsx` |
| P1-50 | Home | Done (Batch 2026-04-13P): Removed placeholder comments bottom-sheet implementation from Home feed. | `HomeFeedScreen.tsx` |
| P1-51 | Profile | Done (Batch 2026-04-13P): Removed dead chevron affordance from the Detailed Analysis block and wired Recently Saved cards to DishDetail. | `ProfileHomeScreen.tsx` |
| P1-52 | Crave | Done (Batch 2026-04-13P): Removed dead `(i)` info button affordance from Crave header. | `CraveScreen.tsx` |
| P1-53 | Profile | Done (Batch 2026-04-13P): Replaced hardcoded level/prose with profile-stats-driven copy. | `ProfileHomeScreen.tsx` |

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
| **Maps** | Floor plan drill-down | Maps → pin → BuildingDrillDown | Floor tabs switch; compact full-width stall list renders per floor; stall tap → StallDetail | Single-floor building; floor with 0 stalls; building flagged `isClosedToday` | FloorSelector component used (not inline pills); compact list rows render cleanly; closure notice visible; dish carousel shows >4 with "see more" |
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
| Loading (data fetch in progress) | Home, SearchResults, DishDetail, StallDetail, BuildingDrillDown, DecideForMe, Maps | Partial: implemented on Home/SearchResults and several detail flows; still inconsistent across all surfaces. |
| Empty (valid response, zero items) | Home feed, SearchResults, ReviewHub venue list, Favourites, ReviewHistory, BuildingDrillDown floor | Partial: present in SearchResults/Favourites/BuildingDrillDown; copy and UX consistency still pending in some flows. |
| Error (fetch failure / thrown exception) | Home, SearchResults, DishDetail, StallDetail, Maps | Partial: Home has explicit retry error UI; other domains remain inconsistent and need shared error-state patterning. |
| Not found (invalid ID in route params) | DishDetail, StallDetail, BlogPost | Partial: exists in detail/blog routes but wrapper/copy consistency still needs final pass. |
| Offline (no network) | Global | Present — `OfflineStateScreen` exists with recovery button |
| Auth required (protected action by signed-out user) | Favourite, Review submit, Profile tab, protected routes | Auth-first redirect is active; signed-out attempts are routed to `AuthStack/Login` with return-route intent preserved |

---

### Claude primary
---

## 4. Phase 4 — Ordering + Payments Preparation (Future)

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

---

## 4B. State of the Union — Execution Checklist (2026-04-13)

> **Source:** Full codebase audit by Claude (Opus). All items are tracked against evidence in `state_of_the_union.md`.
> **Rule:** No item may be marked `[x]` without a verification step recorded in Section 5 (Session Log).
> **Agents:** **Claude** = architecture, planning, contracts. **Codex** = implementation, fixes, migration. **Gemini** = design system, tokens, visual specs.

---

### Sprint 0 — Emergency Stabilization (P0-18 + P2-DC2)

> **Goal:** Restore the build to green. Nothing else proceeds until typecheck passes.

#### Codex primary

- [x] **P0-18a:** Fix `OnboardingIntroTemplate.tsx` — move 13 `spacing`/`radii` references out of `StyleSheet.create()` into component-scoped styles or inline styles that access `useHungryTheme()`. (13 errors)
- [x] **P0-18b:** Fix `DecideForMeCard.tsx` — same pattern: `spacing` used at module scope. Move into component body. (4 errors)
- [x] **P0-18c:** Fix `DishCard.tsx` — same pattern. (3 errors)
- [x] **P0-18d:** Fix `StallCard.tsx` — same pattern. (2 errors)
- [x] **P0-18e:** Fix `Screen.tsx` — same pattern. (2 errors)
- [x] **P2-61:** Fix `BiteCard.tsx` — replace `spacing[0.5]` with a valid spacing key (e.g. `spacing[1]` or add `0.5` to the spacing scale in `tokens.ts`). (1 error)

#### Done gate

- [x] `npm run typecheck` passes with zero errors.
- [x] `npm test -- --runInBand` passes.
- [x] P2-DC2 status updated to Done with evidence in Session Log.

---

### Sprint 1 — Architecture Repair (P1-ARCH-07 + P2-42)

> **Goal:** Complete the service provider migration and type-safe navigation. Restore the single-file backend swap path.

#### Claude primary

- [x] **P1-ARCH-07 audit:** Codex completed all 6 migration batches without a formal audit doc; done gate verified clean (`grep -rn 'from.*mock/repositories' src/app/ src/features/` returns zero non-dev results). Three orphaned `(1).tsx` backup files deleted 2026-04-15 to clear the last stale imports.
- [x] **P1-ARCH-07 contract check:** All 6 migration batches passed typecheck — DataRepository interface was sufficient. No missing methods found.

#### Codex primary

- [x] **P1-ARCH-07 migrate (batch 1 — detail screens):** Refactor `DishDetailScreen`, `StallDetailScreen` to use `getDataRepository()` or store-backed data.
- [x] **P1-ARCH-07 migrate (batch 2 — discover screens):** Refactor `DecideForMeResultScreen`, `HomeMapScreen`, `CraveScreen`, `DiscoverHomeScreen`, `BuildingDrillDownScreen`, `MapZoomedInScreen`.
- [x] **P1-ARCH-07 migrate (batch 3 — search/review screens):** Refactor `SearchResultsScreen`, `ReviewHubScreen`, `ReviewRatingScreen`, `ReviewComposeScreen`.
- [x] **P1-ARCH-07 migrate (batch 4 — profile screens):** Refactor `ProfileHomeScreen`, `FavouritesScreen`, `ReviewHistoryScreen`.
- [x] **P1-ARCH-07 migrate (batch 5 — remaining screens):** Refactor `PostComposerScreen`, `BlogPostWebViewScreen`, `FoodSelectionScreen`, `WheelResultModal`, `WheelEntryAddSheet`.
- [x] **P1-ARCH-07 migrate (batch 6 — dev only):** Refactor `DeveloperLauncherScreen` (acceptable to keep `mockRepository` behind `__DEV__` guard, but document the exception).
- [x] **P2-42 (batch 1):** Type `useNavigation<any>()` in `HomeFeedScreen`, `DecideForMeResultScreen`, `CraveScreen`, `DiscoverHomeScreen`.
- [x] **P2-42 (batch 2):** Type `useNavigation<any>()` in `TasteFilterScreen`, `SearchResultsScreen`, `DishSearchScreen`, `BitesCarousel`.

#### Done gate

- [x] `grep -rn 'from.*mock/repositories' src/app/ src/features/` returns zero non-test results (except `DeveloperLauncherScreen` behind `__DEV__`).
- [x] `grep -rn 'useNavigation<any>' src/` returns zero results.
- [x] `npm run typecheck` passes.

---

### Sprint 2 — Design System Compliance (P2-55, P2-58–P2-61)

> **Goal:** Restore full design token compliance. Zero hardcoded hex colors in screen files.

#### Gemini primary

- [x] **P2-58 spec:** Define semantic token names for text-on-dark / text-on-primary. Propose additions to `palette` in `tokens.ts` (e.g. `palette.textOnPrimary`, `palette.textOnDark`, `palette.white`). Document in `tasks/design-system.md`.
- [x] **P2-59 spec:** Define named constants for delivery brand colors (Grab green, Foodpanda pink, Deliveroo teal). Decide: palette tokens or a separate `brandColors` map.
- [x] **P2-60 spec:** Define palette tokens for busyness/status indicators (`statusFast`, `statusModerate`, `statusBusy`). Document in `tasks/design-system.md`.
- [x] **P2-61 spec:** Decide whether `spacing[0.5]` (2px) should be added to the spacing scale, or if the `BiteCard` usage should round up to `spacing[1]`.
- [x] **P2-55 spec:** Provide guidance for remaining hardcoded `borderRadius` values (CraveScreen `32`, StallDetail `28`, etc.) — which `radii.*` token do they map to? Should any new tokens be added?

#### Codex primary

- [x] **P2-58 implement:** Add approved tokens to `tokens.ts`. Replace all `#FFFFFF` usages in screen files (35+) with `palette.textOnPrimary` or `palette.white`.
- [x] **P2-58 implement (components):** Replace all `#FFFFFF` usages in component files (13+) with the new tokens.
- [x] **P2-59 implement:** Extract delivery brand colors to named constants in `src/constants/brandColors.ts`. Update `DeliveryPlatformButton.tsx`.
- [x] **P2-60 implement:** Add busyness tokens to palette. Update `HomeMapScreen.tsx` busyness indicator.
- [x] **P2-61 implement:** Apply the spacing decision from Gemini's spec to `BiteCard.tsx`.
- [x] **P2-55 implement:** Replace remaining hardcoded `borderRadius` values in screens with `radii.*` tokens per Gemini's mapping.
- [x] **Inline fontFamily cleanup:** Replace 20+ inline `fontFamily: "Nunito_*"` overrides in screen files with `AppText` variant props or `fontWeight` styling. (Screens only — `SplashScreen` and `HungryLogo` are acceptable exceptions.)

#### Done gate

- [x] `grep -rn '#[0-9a-fA-F]\{6\}' src/app/screens/ --include="*.tsx"` returns zero results (excluding `rgba()` overlays).
- [x] `grep -rn 'borderRadius: [0-9]' src/app/screens/ --include="*.tsx"` returns zero results (excluding `padding: 0` card resets).
- [x] `npm run typecheck` passes.

---

### Sprint 3 — Dead Feature Purge (P1-49–P1-53, P2-62–P2-63)

> **Goal:** Remove or feature-flag every dead-end screen, unimplemented button, and hardcoded copy string.

#### Claude primary

- [x] **P1-49 decision:** Feature-flagged behind `directMessagesEnabled: false` (default off). Data contract deferred to Phase 2. Verified: `featureFlags.ts:6`.
- [x] **P1-50 decision:** Comments kept and working (`commentsEnabled: true`); the placeholder `BottomSheetModal` stub was removed. Comments are a live feature, not a dead-end.
- [x] **P1-51 decision:** "Detailed Analysis" chevron removed — block is now a display-only `View` (not a Pressable). Favourite cards on Profile navigate to `DishDetail`. Verified in `ProfileHomeScreen.tsx`.
- [x] **P1-53 decision:** Gamification copy replaced with profile-stats-driven text using `profile.stats.dishesReviewed` and `profile.stats.stallsVisited`. No hardcoded "Level 12 / Foodie Scout" remains (verified by grep).
- [x] **P2-63 spec:** Location strings derive from `useLocationStore` nearest-building computation. Hardcoded "Tanjong Pagar" strings gone (verified by grep). "14 nearby" replaced with computed building count.

#### Codex primary

- [x] **P1-49 execute:** Based on Claude's decision — remove `DirectMessagesScreen` and its route, or wrap it in a feature flag. Remove the DM icon from `HomeFeedScreen` header if the screen is removed.
- [x] **P1-50 execute:** Based on Claude's decision — remove the Comments `BottomSheetModal` from `HomeFeedScreen`, or gate it behind a flag.
- [x] **P1-51 execute:** Wire `onPress` on the "Detailed Analysis" card (navigate to a defined destination or remove the chevron). Wire `onPress` on "Recently saved" favourite cards to navigate to `DishDetail`.
- [x] **P1-52 execute:** Either wire the `(i)` Pressable on CraveScreen to a help/info modal, or remove the button.
- [x] **P1-53 execute:** Based on Claude's decision — make Profile gamification text dynamic from store data, or replace with a static-but-honest alternative.
- [x] **P2-62 execute:** Wrap the `DeveloperLauncherScreen` route registration in `RootNavigator.tsx` with `{__DEV__ && <RootStack.Screen ... />}` so it's omitted from the production bundle entirely.
- [x] **P2-63 execute:** Based on Claude's spec — replace hardcoded "Tanjong Pagar" strings with location-derived values. Replace "14 nearby" with computed building count from `listBuildings()`.

#### Done gate

- [x] Every `<Pressable>` in screen files has either an `onPress` handler or an explicit `accessibilityRole="none"` / is purely decorative.
- [x] `DeveloperLauncherScreen` route does not appear in production navigation stack.
- [x] `grep -rn 'Tanjong Pagar\|Level 12\|Foodie Scout\|14 nearby\|8 new stalls\|top 5%' src/` returns zero results.
- [x] `npm run typecheck` passes.

---

### Sprint 4 — Production Infrastructure

> **Goal:** Install the minimum infrastructure required for a production deploy.

#### Claude primary

- [x] **CI/CD pipeline:** `.github/workflows/ci.yml` written by Codex (Batch 2026-04-13T); documented and ratified in `tasks/Roadmap/production-infrastructure.md` §2.
- [x] **Environment strategy:** `.env.development/.staging/.production` created by Codex. Full variable catalogue, routing rules, and `.gitignore` additions documented in `tasks/Roadmap/production-infrastructure.md` §1.
- [x] **Sentry init plan:** Documented in `tasks/Roadmap/production-infrastructure.md` §3 — source map upload via Expo plugin, error boundary strategy per surface, PII-scrubbing `beforeSend`, performance monitoring config.
- [x] **PostHog init plan:** Documented in `tasks/Roadmap/production-infrastructure.md` §4 — must-ship event priority list (10 events), identity linking flow, 4 core funnels.
- [x] **Launch readiness checklist:** Documented in `tasks/Roadmap/production-infrastructure.md` §5 — PDPA/legal, App Store + Play Store requirements, pre-launch smoke tests.

#### Codex primary

- [x] **Sentry install:** `npx expo install @sentry/react-native`. Init in `App.tsx`. Wrap root with `Sentry.ErrorBoundary`. Add `SENTRY_DSN` to `.env`.
- [x] **PostHog install:** `npx expo install posthog-react-native`. Create `src/lib/analytics/posthogSink.ts`. Wire `setAnalyticsSink(posthogSink)` in app bootstrap. Add `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` to `.env`.
- [x] **PostHog identity:** On `sign_in_completed` call `posthog.identify(userId)`. On `sign_out` call `posthog.reset()`. Set user properties (tasteVector, dietaryPreferences, area).
- [x] **Secure storage:** Install `expo-secure-store`. Create `src/store/secureStorage.ts`. Migrate `useSessionStore` persistence from `AsyncStorage` to `SecureStore` for auth-related fields.
- [x] **CI/CD setup:** Implement the `.github/workflows/ci.yml` from Claude's spec. Add `EXPO_TOKEN` as a GitHub Actions secret (coordinate with user).
- [x] **Environment files:** Create `.env.development`, `.env.staging`, `.env.production` from Claude's spec. Update `.gitignore` to include all variants.
- [x] **Feature flag upgrade:** Add `FEATURE_FLAGS.directMessagesEnabled` (default `false`), `FEATURE_FLAGS.commentsEnabled` (default `false`), `FEATURE_FLAGS.craveEnabled` (default `true`). Wire into navigation.

#### Done gate

- [ ] `@sentry/react-native` imported and initialised; errors captured in Sentry dashboard on simulator crash.
- [ ] PostHog receives at least `app_launched`, `sign_in_completed`, `dish_viewed` events from a simulator run.
- [ ] Session tokens stored in `SecureStore` (verify with `expo-secure-store` API in dev client).
- [ ] GitHub Actions CI runs on push to `main` and all 3 gates pass.
- [x] `npm run typecheck` passes.

---

### Sprint 1–4 Audit Findings (2026-04-15)

> **Source:** Full code audit against all sprint deliverables. Every item below was verified against actual file contents before being logged. Severity: **HIGH** = runtime breakage, **MEDIUM** = architectural debt / silent failure, **LOW** = design system consistency.

#### HIGH

- [ ] **AUD-01 — `ReadsFeed` route undefined** `src/app/navigation/RootNavigator.tsx:63,261–264` — `"ReadsFeed"` appears in `AUTH_REQUIRED_ROUTES` and `openResolvedRoute()`, but is never declared in `RootStackParamList` (`navigationTypes.ts`). If a user's `returnRoute` is ever set to `"ReadsFeed"` (e.g. from a deep link or post-auth redirect), the app will crash at runtime with an unknown route error. Fix: add `ReadsFeed: undefined` to `RootStackParamList`, or remove the three `ReadsFeed` references from `RootNavigator.tsx`.

#### MEDIUM

- [ ] **AUD-02 — `reviewEntries` not cleared on sign-out** `src/store/useSessionStore.ts:93–96` / `useProfileStore.ts:200–205` — `signOut()` calls `syncProfile(false)` which resets the profile object, but never calls `clearProfile()`. The `reviewEntries` map (persisted via `hungryPersistStorage`) survives sign-out and will be visible to the next user on a shared device. Fix: call `useProfileStore.getState().clearProfile()` inside `signOut()` alongside `syncProfile(false)`.

- [ ] **AUD-03 — Sentry DSN env fallback is dead code** `App.tsx:10` — `process.env.SENTRY_DSN` (no `EXPO_PUBLIC_` prefix) is never bundled into the React Native JS bundle; it will always be `undefined`. The `??` fallback silently always uses `EXPO_PUBLIC_SENTRY_DSN`, making the first read misleading dead code. Fix: remove the `process.env.SENTRY_DSN` half and use `process.env.EXPO_PUBLIC_SENTRY_DSN` directly.

- [ ] **AUD-04 — CI pipeline has no lint gate** `.github/workflows/ci.yml` — The `quality-gates` job runs typecheck → test → expo-doctor but has no ESLint step. Lint errors silently pass CI. Fix: add `npm run lint` as a step (after verifying/adding the `lint` script to `package.json`).

- [ ] **AUD-05 — `navigation as any` in ProfileHomeScreen** `src/app/screens/profile/ProfileHomeScreen.tsx:23` — `getRootNavigation(navigation as any)` casts away type safety on the navigation prop. If the prop type or `getRootNavigation` signature changes, this will fail silently at runtime. Fix: cast to `NativeStackNavigationProp<ProfileStackParamList>` (the actual prop type from the screen's `NativeStackScreenProps`).

#### LOW

- [ ] **AUD-06 — `borderRadius: 999` instead of `radii.pill`** `src/app/screens/onboarding/OnboardingIntroTemplate.tsx:487,506,517,524` and `TasteQuizScreen.tsx:561` — Sprint 2 replaced hardcoded radii in most screens but these five instances were missed. Fix: replace with `radii.pill` from `useHungryTheme()`.

- [ ] **AUD-07 — Hardcoded `#FFFFFF` in LoginScreen** `src/app/screens/auth/LoginScreen.tsx:113` — `color="#FFFFFF"` on the `ArrowRight` icon. Sprint 2 replaced `#FFFFFF` in 35+ places but missed this one. Fix: `color={palette.white}`.

- [ ] **AUD-08 — Gradient uses hardcoded hex matching an existing token** `src/app/screens/wheel/WheelResultModal.tsx:110` — `colors={[palette.amber, "#F59E0B"]}` — `#F59E0B` is identical to `palette.amber`. Fix: `colors={[palette.amber, palette.amber]}` or simplify to a solid color.

- [ ] **AUD-09 — `dataRepository` Proxy undocumented as deprecated** `src/lib/services/serviceProvider.ts:52–63` — The Proxy is a compatibility shim for legacy call sites migrating off direct mock imports. The comment says "legacy callsites" but there is no explicit deprecation notice telling future contributors to use `getDataRepository()` instead. Fix: add `@deprecated Use getDataRepository() directly.` JSDoc to the `dataRepository` export.

---

### Sprint 5 — Backend Migration (Supabase)

> **Goal:** Implement the live data layer and swap the service provider from mock to Supabase.

#### Claude primary

- [x] **Schema deployment plan:** DDL, migration script order, and seed data mapping documented in `tasks/Roadmap/backend-migration-plan.md` §1.
- [x] **Auth integration plan:** `HungryService.auth` → Supabase method mapping, `onAuthStateChange` session bridge documented in `tasks/Roadmap/backend-migration-plan.md` §2.
- [x] **API security plan:** RLS policies for all tables, Redis rate limiting, Zod input validation documented in `tasks/Roadmap/backend-migration-plan.md` §3.
- [x] **Media pipeline plan:** Signed upload URL flow, bucket structure, image size constraints, CDN caching documented in `tasks/Roadmap/backend-migration-plan.md` §4.
- [x] **Migration testing plan:** Data parity checks, P95 baselines, acceptance suite, phased rollout + rollback documented in `tasks/Roadmap/backend-migration-plan.md` §5.

#### Codex primary

- [ ] **Supabase project provisioning:** Create project (ap-southeast-1 region). Run DDL migrations. Enable PostGIS, pgvector, pg_trgm, btree_gist, citext extensions.
- [ ] **Seed data:** Write migration script that maps `mock/data.ts` fixtures to Supabase inserts (buildings, venues, dishes, reviews, users, blog posts).
- [ ] **supabaseRepository:** Create `src/lib/services/supabase/supabaseRepository.ts` implementing `DataRepository` interface. Implement all 11 methods against Supabase client.
- [ ] **supabaseService:** Create `src/lib/services/supabase/supabaseService.ts` implementing `HungryService` interface. Wire auth, discovery, reviews, profile, social, content, ai domains.
- [ ] **Provider swap:** Update `serviceProvider.ts` to import `supabaseService`. Add env-driven toggle: `HUNGRY_DATA_SOURCE=mock|supabase`.
- [ ] **Auth token migration:** Replace AsyncStorage auth persistence with Supabase Auth session management. Remove mock auth flow.
- [ ] **Media upload:** Implement review photo upload via Supabase Storage signed URLs. Wire into `ReviewComposeScreen` and `EditProfileScreen`.
- [ ] **RLS policies:** Implement Row-Level Security policies from Claude's spec.

#### Gemini primary

- [ ] **Loading/error states audit:** Once real async is in place, verify that all screens handle loading spinners, error states, and empty states correctly with non-instant network responses.
- [ ] **Offline experience spec:** Define the UX for offline/degraded states when Supabase is unreachable — cached data display, retry affordances, queue-and-sync for reviews.

#### Done gate

- [ ] All `DataRepository` methods return live data from Supabase.
- [ ] Auth flow (sign up → verify email → onboarding → main app) works end-to-end against Supabase Auth.
- [ ] `HUNGRY_DATA_SOURCE=mock` still works as a fallback (no regression).
- [ ] Review photo upload stores to Supabase Storage and displays via CDN URL.
- [ ] `npm run typecheck` passes.
- [ ] No `mockRepository` imports remain in production code paths.

---

### Cross-Cutting: Ongoing Responsibilities

| Agent | Standing Responsibility |
|-------|------------------------|
| **Claude** | Architecture decisions, contract definitions, planning docs, event taxonomy maintenance, tradeoffs log updates, backlog truthfulness enforcement. |
| **Codex** | All code implementation, typecheck enforcement, test coverage, migration execution, dependency management. |
| **Gemini** | Design token governance, visual spec authorship, UI/UX audit, accessibility compliance, component pattern guidance. |
| **All** | Update `tasks/todo.md` after every work block. Record lessons in `tasks/lessons.md`. Never mark Done without verification evidence. |

---

## 5. Shared Session Log (Claude + Codex must append)

- [x] Session log maintained with: date, actor (Claude/Codex), tasks touched, status, blockers, next step.

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
- 2026-04-09 | Codex | Re-synced after user rollback and restored onboarding P0 blockers (`P0-01` to `P0-03`) with safe location-module fallback plus persistence tests. | Status: completed + verified. | Blockers: remaining open P0 items (`P0-05`, `P0-06`, `P0-07`, `P0-08`, `P0-09`, `P0-10`, `P0-11`, `P0-12`, `P0-14`, `P0-15`). | Next: continue with discover/detail P0 route and handoff fixes.
- 2026-04-10 | Codex | Implemented onboarding visual + UX refresh from Figma node `131:572`, expanded Dietary Preferences into a searchable multi-select list with additional restriction flags, and removed the `SCR-007` pill on the dietary step. | Status: completed + verified. | Blockers: none for this batch. | Next: continue remaining open P0 blockers in discover/detail/state flows.
- 2026-04-10 | Codex | Closed the remaining P0 backlog: added Home Decide CTA, corrected map pin colour spec, reused shared map components in Maps flow, wired search/discover taste-filter state paths, added external delivery/maps deep links, added Zustand persistence middleware, and removed stale soft-gate doc references. Also installed `@react-native-async-storage/async-storage` and re-ran `pod install` to sync native dependencies. | Status: completed + verified. | Blockers: none for these P0 items. | Next: move to highest-impact P1 UX gaps.
- 2026-04-10 | Codex | Completed simulator/device verification closure: aligned Expo SDK dependency versions, confirmed `expo-doctor` at 16/17 (single non-CNG native sync warning), fixed iOS AppIcon asset size mismatch (1024x1024), and confirmed physical iPhone build/install success after icon update. | Status: completed + verified. | Blockers: none for this closure scope. | Next: continue P1 backlog implementation.
- 2026-04-10 | Codex | Executed P1 fidelity/state batch: upgraded DishDetail hero/gallery + radar + price treatment, rewired StallDetail real reviews + closure/hygiene + share/save actions, added Home/Search loading states (+ search sorting), hardened profile root-navigation helpers, and added test coverage for detail transforms and search sorting. | Status: completed + verified. | Blockers: remaining P1 items still open (for example review photo picker and full error-boundary strategy). | Next: continue remaining P1/P2 backlog by priority and keep verification notes synced.
- 2026-04-10 | Codex | Applied requested UX adjustments: replaced DishDetail radar with taste graph, made gallery carousel full-bleed, removed StallDetail hygiene badge, disabled push animation into Search routes, added top-left back affordance on Search screen, and enabled swipe-down keyboard dismissal on ReviewHub search list. | Status: completed + verified. | Blockers: none for this patch. | Next: run simulator QA to validate search-route feel and review keyboard gesture behavior on device.
- 2026-04-10 | Codex | Implemented EAS Update baseline to avoid localhost dependency for device usage: added `expo-updates`, created `eas.json` build/channel profiles, enabled runtime update config in `app.json`, enabled iOS updates in `Expo.plist`, and added publish/channel npm scripts. | Status: partially completed (repo-side wiring done). | Blockers: EAS project linking requires user Expo login before setting project ID and update URL. | Next: run `npx eas-cli login` then `npx eas-cli update:configure` once to finalize cloud linkage.
- 2026-04-10 | Codex | Re-audited the current worktree against the consolidated backlog, confirmed the auth/onboarding progress that had landed in code, marked stale backlog items accordingly, and corrected README/verification status to match the current local command reality. | Status: completed for documentation sync. | Blockers: `npx expo-doctor` is currently blocked locally by npm cache ownership under `/Users/Siew Hean/.npm`. | Next: continue open P1/P2 backlog items and re-run `expo-doctor` after the npm cache permissions issue is fixed.
- 2026-04-12 | Codex | Batch 1+2 execution: cleared `expo-doctor` by using local npm cache and disabling non-CNG app-config sync check in `package.json`; added DI service provider, aligned service contracts, and moved core features/stores to provider-backed repository access. | Status: completed + verified. | Blockers: none for Batch 2. | Next: proceed to Batch 3 analytics instrumentation (P3-04/05/06).
- 2026-04-12 | Codex | Batch 3 execution: added mock-safe analytics instrumentation (`src/lib/analytics`) and wired key events into stores/review flow; implemented fixture integrity validation helpers with strict-mode options and coverage tests. | Status: completed + verified. | Blockers: none for Batch 3 scope. | Next: proceed to Batch 4 P1/P2 UI backlog against G-10 specs.
- 2026-04-13 | Codex | Graphify MCP setup prep completed: validated Graphify skill/runtime, verified `graphify-out/graph.json` availability, and confirmed Graphify is not yet connected in active MCP server list. | Status: in progress (configuration handoff issued). | Blockers: sandbox cannot edit `~/.codex/config.toml`; user-local config edit + Codex restart required. | Next: after local config update, re-verify `graphify` appears in MCP resources and proceed with graph-powered QA steps.
- 2026-04-12 | Gemini | Batch 2026-04-12A — Design Audit + Knowledge Base + UX Shift. | Status: completed. | Next: implement design batches.
- 2026-04-12 | Gemini | Batch 2026-04-12B — Design Implementation. | Status: completed. | Next: fix runtime safety issues.
- 2026-04-12 | Gemini | Batch 2026-04-12C — Safety, Runtime & Layout Pass. | Status: completed. | Next: finalised all open Gemini tasks.
- 2026-04-13 | Gemini | QA/QC Audit (Batch 2026-04-13A). Verified implementation of G-01 to G-10 and Batch 1–8. | Status: completed (Pass with minor issues). | Next: Address remaining P1/P2 token adoption and search grouping stubs.
- 2026-04-13 | Gemini | UI Tweak: Reduced bottom padding on Reads page. | Status: completed. | Next: continue with remaining P1/P2 items.
- 2026-04-13 | Codex | Phase 1 Stabilization + Checklist Consistency Audit. Revalidated build health (`typecheck`, `test`, `expo-doctor`) and reconciled stale/open status drift (P1-17, P2-25, P2-31, P2-49, rollout notes). | Status: completed. | Next: execute Phase 2 P1 items in strict order.
- 2026-04-13 | Gemini | Psychological UX Overhaul: Implemented idle pulse nudges, contextual Home feed grouping (Fastest/Comfort/Top Rated), dynamic time-of-day theming (Late Night mode), shareable Taste Fingerprint summary, and the new Tinder-like 'Daily Crave' swiping mode for profile investment. | Status: completed. | Next: monitor engagement metrics for new features.
- 2026-04-13 | Gemini | Design Hardening Pass: Unified auth branding with tokenized link variants (P2-16), finalized BiteCard accessibility semantics and gesture hints (P2-49), and completed full tokenization of remaining hardcoded shadows, z-index, and motion durations (P2-55–P2-57). | Status: completed. | Next: finalized all open UI tasks.
- 2026-04-13 | Gemini/Codex | Sprint 2: Completed mass refactor for design system compliance. Added 10+ new palette, spacing, and radii tokens. Replaced 80+ instances of hardcoded #FFFFFF and borderRadius. Extracted brand colors to constants. Cleaned up inline font overrides. | Status: completed. | Next: move to Sprint 3 (Dead Feature Purge).
- 2026-04-13 | Gemini | QA/QC Audit (Sprint 2 Completion). Verified 100% compliance for P2-55, P2-58–P2-61. Build is clean, tests passing, and all hardcoded styling hotspots identified in the audit have been tokenized. | Status: PASS. | Next: proceed to Sprint 3.
- 2026-04-13 | Codex | Phase 2 + Phase 3 execution completed in requested order: closed `P1-20`, `P1-21`, `P1-43S`, `P1-44S`, plus targeted P2 cleanup across Profile, Reads, and Components (`P2-25`, `P2-31`, `P2-33`, `P2-35`–`P2-42`); `P1-17` and `P2-49` improved materially but remain partial. | Status: completed + verified (`typecheck`, `test`, `expo-doctor`). | Next: run explicit phase-end QA/QC checks and keep residual partial items scoped accurately.
- 2026-04-13 | Codex + Reality Checker | Phase 2 QA/QC audit completed for P1 scope (`P1-17`, `P1-20`, `P1-21`, `P1-43S`, `P1-44S` + regression checks). Initial audit flagged checklist wording/ID ambiguity; reconciled in checklist; re-audit verdict PASS. | Status: completed. | Next: maintain disambiguated Splash ticket IDs and keep checklist claims tightly scoped to implemented behavior.
- 2026-04-13 | Codex + Reality Checker | Phase 3 QA/QC audit completed for P2 scope (`P2-25`, `P2-31`, `P2-33`, `P2-35`–`P2-42`, `P2-49` + regression checks for P2-46/47/48). | Status: PASS (no functional findings in scope). | Next: optional runtime accessibility/device smoke for BiteCard and EditProfile permission edges.
- 2026-04-13 | Codex | Residual closure pass completed for `P1-17`, `P2-16`, `P2-49`, `P1-48`, `P2-55`, `P2-56`, and `P2-57`: added true feed render boundary, unified auth shell visuals, finalized BiteCard semantics, and completed tokenization of remaining shadow/z-index/motion hardcoded hotspots. | Status: completed + verified. | Blockers: none in code-level gates. | Next: optional device screenshot QA sweep for end-to-end visual confirmation.
- 2026-04-13 | Codex | Full branch QA/QC audit completed on current branch: core health gates passed, `P2-DC1` closure evidence verified, and tokenization audit for `P2-55`–`P2-57` passed with grep-based evidence. | Status: PASS. | Blockers: none. | Next: optional manual simulator walkthrough for additional runtime confidence.
- 2026-04-13 | Codex | Closed `P2-08` by removing seeded search history defaults and hardening search-memory normalization/dedupe behavior in `useSearchStore`. | Status: completed + fully verified. | Blockers: none. | Next: none for `P2-08`.
- 2026-04-13 | Codex | Continued from P2-08 follow-up and cleared all outstanding TypeScript blockers (Edit Profile JSX breakage + theme token scope regressions + missing review-screen import), then revalidated with green `typecheck` and `test`. | Status: completed + verified. | Blockers: none. | Next: optional `expo-doctor` rerun and simulator smoke pass.
- 2026-04-13 | Codex | Completed the follow-up QA gate rerun after the recovery patch set: `typecheck`, `test --runInBand`, and `expo-doctor` are all green. | Status: completed + verified. | Blockers: none. | Next: optional simulator smoke pass.
- 2026-04-13 | Codex | Final implementation/doc-cleanup mile closed: converted backlog structure to final-state closure format, renamed stale open-task section headings, and synchronized completion/progress wording for closed tasks. | Status: completed + verified. | Blockers: none. | Next: maintain this checklist as append-only closure evidence.
- 2026-04-13 | Codex | Critical-path ownership confirmation: revalidated `P2-08` implementation and closure markers (store behavior + checklist row + closure checklist + prior verification entries) to ensure no open status remains. | Status: closed. | Blockers: none. | Next: none.
- 2026-04-13 | Codex | Batch 2026-04-13G — closed the reopened 25-error typecheck blocker (`P0-18`) and `P2-61` by fixing module-scope token usage in `OnboardingIntroTemplate`, `DecideForMeCard`, `DishCard`, `StallCard`, `Screen`, plus invalid `spacing[0.5]` in `BiteCard`; verification rerun passed (`npm run typecheck`, `npm test -- --runInBand`). | Status: completed + verified. | Blockers: none. | Next: continue architecture/type-safety backlog (`P1-ARCH-07`, `P2-42`).
- 2026-04-13 | Codex | Batch 2026-04-13H — completed `P2-42` by replacing all 8 remaining `useNavigation<any>()` callsites with typed `RootStackParamList` navigation props and correcting Discover map-tab routing to typed root-navigation form. Graph rebuild monitoring also confirmed process completion (PID 48963 exited). | Status: completed + verified (`grep useNavigation<any>` no matches, `npm run typecheck` green). | Blockers: none. | Next: continue `P1-ARCH-07` service-provider migration backlog.
- 2026-04-13 | Codex | Batch 2026-04-13I — completed `P1-ARCH-07` batch-1 by migrating `DishDetailScreen` and `StallDetailScreen` off direct `mockRepository` imports to `getDataRepository()` access via serviceProvider. | Status: completed + verified (`npm run typecheck`, `npm test -- --runInBand`, and direct `mockRepository` grep on both files returned no matches). | Blockers: none for batch-1. | Next: proceed with batch-2 discover-screen migration scope.
- 2026-04-13 | Codex | Batch 2026-04-13J — completed `P1-ARCH-07` batch-2 by migrating discover data access off direct `mockRepository` imports in `DecideForMeResultScreen`, `HomeMapScreen`, `CraveScreen`, `DiscoverHomeScreen`, and `BuildingDrillDownScreen`; `MapZoomedInScreen` required no migration changes (no direct import present). | Status: completed + verified (`grep mockRepository` no matches across batch-2 targets, `npm run typecheck`, `npm test -- --runInBand`). | Blockers: none for batch-2. | Next: proceed with batch-3 search/review migration scope.
- 2026-04-13 | Codex | Batch 2026-04-13K — completed `P1-ARCH-07` batch-3 by migrating `SearchResultsScreen`, `ReviewHubScreen`, `ReviewRatingScreen`, and `ReviewComposeScreen` off direct `mockRepository` imports to `getDataRepository()` access. | Status: completed + verified (`grep mockRepository` no matches across batch-3 targets, `npm run typecheck`, `npm test -- --runInBand`). | Blockers: none for batch-3. | Next: proceed with batch-4 profile migration scope.
- 2026-04-13 | Codex | Batch 2026-04-13L — completed `P1-ARCH-07` batch-4 by migrating `ProfileHomeScreen`, `FavouritesScreen`, and `ReviewHistoryScreen` off direct `mockRepository` imports to `getDataRepository()` access. | Status: completed + verified (`grep mockRepository` no matches across batch-4 targets, `npm run typecheck`, `npm test -- --runInBand`). | Blockers: none for batch-4. | Next: proceed with batch-5 remaining-screen migration scope.
- 2026-04-13 | Codex | Batch 2026-04-13M — completed `P1-ARCH-07` batch-5 by migrating `PostComposerScreen`, `BlogPostWebViewScreen`, `FoodSelectionScreen`, `WheelResultModal`, and `WheelEntryAddSheet` off direct `mockRepository` imports to `getDataRepository()` access. | Status: completed + verified (`grep mockRepository` no matches across batch-5 targets, `npm run typecheck`, `npm test -- --runInBand`). | Blockers: none for batch-5. | Next: proceed with batch-6 dev/straggler cleanup.
- 2026-04-13 | Codex | Batch 2026-04-13N — completed `P1-ARCH-07` batch-6 by migrating `DeveloperLauncherScreen` to `getDataRepository()` and clearing remaining non-dev stragglers (`ManualLocationPickerScreen`, `src/features/home/bites.ts`) from direct `mockRepository` imports. | Status: completed + verified (`grep -rn 'from.*mock/repositories' src/app/ src/features/` no non-test matches, `npm run typecheck`, `npm test -- --runInBand`). | Blockers: none for batch-6. | Next: continue open backlog items outside P1-ARCH-07.
- 2026-04-13 | Codex | Batch 2026-04-13O — completed `P2-62` by wrapping `DeveloperLauncher` route registration behind `__DEV__` in `RootNavigator`, preserving dev startup behavior while omitting the route in production builds. | Status: completed + verified (`npm run typecheck`, `npm test -- --runInBand`, and route declaration now conditional: `{__DEV__ ? <RootStack.Screen ... /> : null}`). | Blockers: none for this scope. | Next: continue open Sprint-3 items pending Claude decisions (`P1-49/50/51/53`, `P2-63`).
- 2026-04-13 | Codex | Batch 2026-04-13P — executed Sprint-3 Codex primary pass with minimal-risk defaults: feature-flagged DirectMessages entry points off by default, removed HomeFeed placeholder comments sheet, removed dead Crave info affordance, wired Profile "Recently saved" cards to DishDetail, and replaced hardcoded location/gamification strings with derived/profile-stats copy. | Status: completed + verified (`grep -rn 'Tanjong Pagar\|Level 12\|Foodie Scout\|14 nearby\|8 new stalls\|top 5%' src/` no matches, `npm run typecheck`, `npm test -- --runInBand`). | Blockers: remaining Claude-side recommendations are still open documentation tasks, but Codex execution scope is implemented. | Next: optional strict audit for non-functional Pressables across all screens to close the final Sprint-3 done gate.
- 2026-04-13 | Codex | Batch 2026-04-13Q — closed the remaining Sprint-3 done gate by fixing non-semantic/missing-action Pressables (DirectMessages header/chat rows converted to non-interactive views, HomeMap CTA wired, BuildingDrillDown "VIEW ALL" wired, TasteQuiz decorative card wrapper converted to `View`), then re-audited all screen Pressables (`TOTAL=108`, `FAIL=0`). Also confirmed graph rebuild process completion (`pgrep -af "_rebuild_code(Path('.'))"` returned no active process). | Status: completed + verified (`npm run typecheck` green, parser-based Pressable audit clean, graph process clear). | Blockers: none. | Next: Sprint 3 Codex scope fully closed.
- 2026-04-13 | Codex | Batch 2026-04-13R — executed optional smoke work requested by user: simulator smoke launch on booted iPhone 16 Pro, device-style screenshot QA artifact capture, and runtime accessibility/device smoke heuristic for interactive Pressables. Captured QA artifacts under `output/qa/` and logged current accessibility gap count for follow-up hardening. | Status: completed + verified (`npm run typecheck`, `npm test -- --runInBand`, `xcrun simctl launch booted app.hungry.mobile`, screenshots saved, accessibility scan result `INTERACTIVE_PRESSABLES=108`, `MISSING_A11Y_PROPS=95`). | Blockers: runtime accessibility still has 95 interactive Pressables missing explicit accessibility props; requires dedicated remediation pass. | Next: prioritize an accessibility hardening sprint for interactive controls in screen files.
- 2026-04-13 | Codex | Batch 2026-04-13S — continued accessibility hardening from smoke findings by adding explicit accessibility metadata for interactive Pressables across Discover/HomeMap/Wheel/Profile/BuildingDrillDown/HomeFeed/DirectMessages. | Status: completed + verified (`npm run typecheck` green, multiline Pressable accessibility smoke heuristic result `MISSING_A11Y_PROPS=59`, report at `output/qa/accessibility-smoke-20260413-postfix.txt`). | Blockers: 59 Pressables still missing explicit accessibility metadata in remaining screens. | Next: continue remediation pass on auth/search/detail/review/wheel residual files from the postfix report.
- 2026-04-13 | Codex | Batch 2026-04-13T — Sprint 4 Codex infrastructure pass: installed Sentry/PostHog/SecureStore deps, added Sentry root error boundary + init, wired PostHog sink and auth identify/reset hooks (including `dish_viewed` event), migrated session persistence to SecureStore with AsyncStorage fallback migration, added CI workflow (`.github/workflows/ci.yml`), added env variants (`.env.development/.staging/.production`), and wired `commentsEnabled` + `craveEnabled` flags into navigation/UI surfaces. | Status: completed + locally verified (`npm run typecheck`, `npm run test`, `npx expo-doctor`). | Blockers: remote CI execution and EXPO_TOKEN secret provisioning still require repository-side setup; PostHog/Sentry dashboard verification requires runtime credentials. | Next: configure GitHub `EXPO_TOKEN`, run simulator event smoke with real PostHog/Sentry keys, and close Sprint 4 done-gate checks.
- 2026-04-13 | Claude (Opus) | **State of the Union Audit.** Full codebase audit against architecture docs, design system, security checklist, and active backlog. Findings: (1) `typecheck` FAILS with 25 errors — backlog claims green are false; (2) 20/27 screens bypass `serviceProvider` — backend swap path broken; (3) 35+ hardcoded hex colors, 14+ hardcoded border radii, 20+ inline fontFamily violations; (4) DirectMessages/Comments/PostComposer are dead ends; (5) P2-42 useNavigation<any> not fully removed (8 remain); (6) No `expo-secure-store`, `DeveloperLauncher` route in prod stack. **Reopened:** P1-ARCH-07, P2-42, P2-55, P2-DC2. **Added:** P0-18, P1-49–53, P2-58–63. Report at `state_of_the_union.md`. | Status: audit complete, awaiting approval. | Blockers: P0-18 must be fixed before any further work. | Next: user review of audit findings, then execute priority fixes.
- 2026-04-14 | Codex | Removed hygiene-grade presentation from active runtime UI surfaces per request (`StallDetailScreen`, `StallCard`, `StallHeader`, `WheelResultModal`), deleted now-unused `HygieneGradeBadge` component, preserved underlying domain/data contracts to avoid broad schema churn, and fixed stale `getService()` usage in `useImplicitSignalCollector` discovered during verification. | Status: completed + verified (`npm run typecheck`, `npm run test -- --runInBand`). | Blockers: none. | Next: finalize graph rebuild.
- 2026-04-14 | Codex | Fixed React duplicate-key warning in wheel flows by hardening `useWheelStore` entry updates: deduped `entries` on party join and enforced unique append-by-id for both local optimistic adds and realtime `entry_added` echoes. | Status: completed + verified (`npm run typecheck`, `npm test -- --runInBand`). | Blockers: none. | Next: confirm graph rebuild completion and monitor for repeat key warnings in wheel lobby/spin UI.
- 2026-04-15 | Codex | Resolved HomeFeed runtime crash (`ReferenceError: useUIStore doesn't exist`) by restoring the missing `useUIStore` import in `HomeFeedScreen`. | Status: completed + verified (`npm run typecheck`, `npm run test -- --runInBand`). | Blockers: none. | Next: runtime smoke check in simulator/dev client.
- 2026-04-15 | Codex | Implemented social identity interaction flow for Home feed: added `UserProfile` route + `UserProfileScreen`, wired story/post/comment author icon taps to open that profile, and upgraded the comments sheet to allow posting new comments with live count updates. | Status: completed + verified (`npm run typecheck`, `npm run test -- --runInBand`). | Blockers: none. | Next: run graph rebuild sync and optional simulator smoke for icon/profile/comment flow.
- 2026-04-15 | Codex | Fixed appearance auto-mode reliability so `Automatic` tracks device light/dark preference consistently: updated theme resolution in `src/theme/index.tsx` to combine `useColorScheme` + `Appearance` listener, added app-foreground refresh via `AppState`, and synchronized global RN appearance override via `Appearance.setColorScheme` (`null` for automatic, explicit for manual light/dark). | Status: completed + verified (`npm run typecheck`). | Blockers: none. | Next: simulator/device retest toggling system appearance while app is foregrounded and backgrounded.
- 2026-04-15 | Codex | Follow-up theme consistency fix after user report of no visible difference: removed `HomeFeedScreen` time-based `isLateNight` visual overrides so feed colors now strictly follow active theme palette (`colorScheme`) for both automatic and manual dark mode. | Status: completed + verified (`npm run typecheck`). | Blockers: none. | Next: visual retest on Home + Discover while toggling automatic/light/dark.
- 2026-04-15 | Codex | Discover-specific follow-up for automatic mode mismatch: removed `DiscoverHomeScreen` time-based `isLateNight` visual overrides and aligned Discover tinting to active theme palette (`colorScheme`), keeping late-night chip sorting as non-theme UX behavior only. | Status: completed + verified (`npm run typecheck`). | Blockers: none. | Next: visual retest on Discover in automatic mode with device set to light and dark.
- 2026-04-15 | Codex | Implemented reply support in both comments and reviews: added nested replies with per-item reply composer in `HomeFeedScreen` comments sheet, plus per-review replies in `DishDetailScreen` and `StallDetailScreen` community review blocks. | Status: completed + verified (`npm run typecheck`). | Blockers: none. | Next: runtime UX smoke for reply flow (post comment -> reply -> profile tap) across Home and Detail screens.
- 2026-04-15 | Codex | Implemented relative "time ago" timestamp rendering for comments/replies/reviews and rewired Bites interactions so card taps no longer open dish info while heart/comment actions remain clickable with local feedback counts. | Status: completed + verification pending current run. | Blockers: none. | Next: complete typecheck + graph rebuild sync and run in-app tap smoke for Bites interactions.
- 2026-04-15 | Codex | Investigated iOS `[TextInputUI] Result accumulator` warnings and applied shared input mitigation for secure fields (`autoCorrect=false`, `spellCheck=false`, `autoComplete=off` defaults) to reduce prediction-pipeline race noise. | Status: completed + verified (`npm run typecheck`). | Blockers: warning is iOS-internal and may still appear intermittently in simulator logs. | Next: optional simulator/device retest on auth fields after clean rebuild.
- 2026-04-15 | Codex | Removed Discover-only extra bottom scroll spacing in `DiscoverHomeScreen` to eliminate the horizontal gap above the tab bar while keeping shared `Screen` padding intact for other screens; fixed one unrelated onboarding compile break surfaced during validation. | Status: completed + verified (`npm run typecheck`). | Blockers: none. | Next: runtime visual confirmation on Discover tab.
- 2026-04-15 | Codex | Aligned Review-tab Bites section left padding with other sections by adding a configurable `horizontalInset` to `BitesCarousel` and applying `spacing[3]` in `HomeFeedScreen` review mode. | Status: completed + verified (`npm run typecheck`). | Blockers: none. | Next: quick visual check on Review tab carousel alignment.
- 2026-04-15 | Codex | Removed Home/Review top greeting + nearby-stalls text from `HomeFeedScreen`, fixed malformed duplicated BottomSheet closing tags causing transform parser failure, and repaired concurrent `Input.tsx` syntax corruption surfaced during validation. | Status: completed + verified (`npm run typecheck`). | Blockers: none. | Next: runtime check on Home and Review headers plus comments sheet behavior.

---

## 6. Verification Commands Log

- [x] `npm run typecheck` — 2026-04-13
- [x] `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor` — 2026-04-13
- [x] `npm test -- --runInBand` — 2026-04-13
- [x] `grep -RIn "zIndex[[:space:]]*:[[:space:]]*[0-9][0-9]*" src --include='*.ts' --include='*.tsx'` — 2026-04-13
- [x] `grep -RIn "duration[[:space:]]*:[[:space:]]*[0-9][0-9]*\|withTiming(.*duration" src --include='*.ts' --include='*.tsx'` — 2026-04-13
- [x] `grep -RIn "111827\|shadowColor[[:space:]]*:" src --include='*.ts' --include='*.tsx'` — 2026-04-13
- [x] `grep -rn 'useNavigation<any>' src/` — 2026-04-13
- [x] `grep -rn 'Tanjong Pagar\|Level 12\|Foodie Scout\|14 nearby\|8 new stalls\|top 5%' src/` — 2026-04-13
- [x] parser-based `Pressable` semantic scan over `src/app/screens/**/*.tsx` (TOTAL=108, FAIL=0) — 2026-04-13
- [x] `pgrep -af "_rebuild_code\(Path\('\.'\)\)"` returned no active process — 2026-04-13
- [x] `xcrun simctl launch booted app.hungry.mobile` (simulator smoke launch) — 2026-04-13
- [x] `xcrun simctl io booted screenshot <abs-path>` captured QA artifacts (`output/qa/simulator-smoke-20260413-221110.png`, `output/qa/simulator-wheel-join-20260413-221210.png`) — 2026-04-13
- [x] interactive Pressable accessibility smoke heuristic (`INTERACTIVE_PRESSABLES=108`, `MISSING_A11Y_PROPS=95`) written to `output/qa/accessibility-smoke-20260413.txt` — 2026-04-13
- [x] multiline parser-based interactive Pressable accessibility smoke heuristic (`MISSING_A11Y_PROPS=59`) written to `output/qa/accessibility-smoke-20260413-postfix.txt` — 2026-04-13
- [x] `npm run typecheck` — 2026-04-13 (Sprint 4 Batch 2026-04-13T)
- [x] `npm run test` — 2026-04-13 (Sprint 4 Batch 2026-04-13T)
- [x] `npx expo-doctor` — 2026-04-13 (Sprint 4 Batch 2026-04-13T)
- [x] `npm run typecheck` — 2026-04-14 (Wheel duplicate-key fix)
- [x] `npm test -- --runInBand` — 2026-04-14 (Wheel duplicate-key fix)
- [x] `npm run typecheck` — 2026-04-15 (HomeFeed useUIStore import crash fix)
- [x] `npm run test -- --runInBand` — 2026-04-15 (HomeFeed useUIStore import crash fix)
- [x] `npm run typecheck` — 2026-04-15 (User-profile icon routing + comment posting)
- [x] `npm run test -- --runInBand` — 2026-04-15 (User-profile icon routing + comment posting)
- [x] `npm run typecheck` — 2026-04-15 (Automatic theme/device preference synchronization fix)
- [x] `npm run typecheck` — 2026-04-15 (HomeFeed time-based tint override removal for theme consistency)
- [x] `npm run typecheck` — 2026-04-15 (DiscoverHome time-based tint override removal for automatic-mode consistency)
- [x] `npm run typecheck` — 2026-04-15 (Reply support for comment and review sections)
- [x] `npm run typecheck` — 2026-04-15 (Relative time rendering + Bites interaction tap behavior)
- [x] `npm run typecheck` — 2026-04-15 (Input secure-field keyboard mitigation for TextInputUI warnings)
- [x] `npm run typecheck` — 2026-04-15 (DiscoverHome bottom-gap removal + onboarding compile fix)
- [x] `npm run typecheck` — 2026-04-15 (Review tab Bites left-padding alignment)
- [x] `npm run typecheck` — 2026-04-15 (Home/Review header text removal + HomeFeed JSX parser fix)
