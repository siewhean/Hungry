# Hungry — Master Task Contract

> **Last updated:** 2026-04-17 | **Phase:** Prototype → Production  
> Shared execution contract between Claude, Codex, and all agents.  
> Read `tasks/lessons.md` before any implementation session.

---

## How to Use This File

- **Before any non-trivial task:** add a scoped mini-plan under the relevant phase.
- **During work:** check off items as you go. Add inline notes for scope changes.
- **Before ending a session:** record a session log entry. Never mark done without a verification step.
- **Source of truth precedence:** Figma > `product-context.md` > this file > memory.

---

## Completed Phases (Archive)

### Phase 1 — Repo Bootstrap ✅

- [x] Expo scaffold + typed domain layer
- [x] Zustand stores, mock repositories, navigation shell
- [x] Theme tokens, design system, shared component library

### Phase 2 — Core Screens ✅

- [x] Auth, Onboarding, Location Permission
- [x] Home feed, Discover, Search, Search Results
- [x] Dish Detail, Stall Detail, Decide For Me
- [x] Maps tab, MapZoomedIn, BuildingDrillDown
- [x] Profile, Favourites, Review History
- [x] Review compose flow (4-step)
- [x] Reads (blog feed, feature-flagged)
- [x] Offline + NotFound recovery screens

### Phase 3 — Hardening Pass 1 (2026-04-08) ✅

- [x] Auth-first shell (removed guest browsing from runtime)
- [x] Shared primitives (Button, Input, Chip, Badge) restyled to Figma warm-neutral system
- [x] Emoji removed from runtime UI
- [x] Discover/Search/Stall Detail composition tightened
- [x] Home feed container fixed (safe-area, no scrollbar)
- [x] Maxwell demo floor plan (L1/L2) with real venue/dish fixture bridge

### Phase 4 — Maps Rebuild (2026-04-08) ✅

- [x] Real `MapSurface` wrapper with token-aware Mapbox fallback
- [x] Maps tab rebuilt to Figma spec with building pins
- [x] `MapZoomedIn` wired as real route (partially — see P0 list)
- [x] `BuildingDrillDown` screen built with floor switcher + stall grid

### Phase 5 — Marketing Launch Kit (2026-04-08) ✅

- [x] `marketing/` workspace: positioning, waitlist copy, channel playbook
- [x] 30-day organic content calendar
- [x] Video briefs, AI prompt pack, creator/press/hawker outreach

### Phase 6 — AI Food Engine (Completed) ✅

- [x] `src/lib/ai/tasteEngine.ts` — cosine similarity, euclidean distance, blended score
- [x] `rankDishes()` — ranked results with human-readable explanation
- [x] `decideForMe()` — single-best-dish picker with min-score threshold
- [x] `calibrateVector()` — community feedback loop (post-review nudge)
- [x] `buildTasteVectorFromQuiz()` — quiz slider → TasteVector
- [x] Taste labels + color map (display helpers)

### Phase 6 — Sprint 6 Audit (2026-04-08) ✅

- [x] Full codebase audit against PRD, Figma, and data contracts
- [x] `tasks/Roadmap/mvp_audit_and_v2_roadmap.md` — 9 P0s, 11 P1s, 8 P2s documented
- [x] V2 system design: messaging, QR ordering, guest checkout
- [x] `tasks/backend-architecture.md` — full V2 Postgres schema + DDL (2026-04-16)

---

## 🔴 SPRINT 7 — P0 Dead-End Fixes (Demo-Breaking)

> **Owner:** Codex | **Gate:** Must complete before any demo or beta invite.  
> Every item below is a user-facing dead end or broken state. Est. total: ~4h.

- [x] **Wire `TasteFilter` route** — now mapped to `TasteFilterScreen` in `RootNavigator`.
- [x] **Wire `BuildingDrillDown` route** — now mapped to `BuildingDrillDownScreen` in `RootNavigator`.
- [x] **Fix profile sync on auth** — `completeAuth()` now syncs profile store via `syncProfile(true)`.
- [x] **Fix `BitesCarousel` data architecture (P0 subset)** — inline bad IDs removed; bites now come from `features/home/bites` and no longer reference non-existent dish IDs.
- [x] **Fix `BitesCarousel` "See all" navigation** — no longer routes to Post composer; now routes to Search.
- [x] **Fix `MapZoomedIn` placeholder** — screen now renders functional map/sheet flow and drill-down action.
- [x] **Fix `StallDetail` wrong field** — stale `dishId -> venueId` wiring removed from current bites flow.
- [x] **Fix `useNavigation<any>()` (P0 scope)** — removed from `BitesCarousel` and current P0 surfaces.
- [x] **Verify typecheck passes** — validated in Wave 1 gate.

### Sprint 7 Mini-Plan

Wave 1 reconciliation note (2026-04-17): Sprint 7 list above was stale relative to repo truth and has been normalized. Remaining engineering items continue under Sprint 8+/Wave 2+ sections.

---

## 🟡 SPRINT 8 — P1 Beta Hardening

> **Owner:** Codex primary, Claude reviews | **Gate:** Before beta invites go out.

### Empty States

- [x] `FavouritesScreen` — no empty state when list is empty. Add `EmptyState` with CTA to Discover.
- [x] `ReviewHistoryScreen` — no empty state when no reviews. Add `EmptyState` with CTA to Review flow.
- [x] `ProfileHomeScreen` — shows default user data for guest users. Show guest-appropriate fallback.

### Review Flow

- [x] Review submit persistence — `ReviewScreen` writes reviewed dish ids + review entries to persisted `useProfileStore` state; added regression test (`useProfileStore.review-persistence.test.ts`).
- [x] Review success feedback — submit path triggers both toast and `showReviewSuccess` modal payload in `ReviewScreen`.
- [x] Quick-review path (F-018) — PRD requires a 30-second tag-only flow. Add shortcut that skips text/photo steps.

### Auth & Error Handling

- [x] Auth error feedback — `LoginScreen`/`SignUpScreen` now use deterministic mock-failure guards with error toasts (`features/auth/mockAuth.ts`) and have test coverage.
- [x] Try/catch scaffolding — critical auth actions wrapped in try/catch and offline mode now triggers `Offline` route via `useUIStore.isOffline` + root navigator effect.

### Service Layer

- [x] `HungryService` interface — mock implementation is active for current screen callsites in `src/lib/services/mock/mockService.ts`.
- [x] `getBuildingDetail()` service method — implemented in mock discovery service with enriched building metadata + test coverage (`service-methods.test.ts`).
- [x] `getFloorPlan()` service method — implemented via `lib/geo/floorPlans` + test coverage (`service-methods.test.ts`).
- [x] `Bite` type divergence — `BitesCarousel`/`BiteCard` now consume canonical `src/lib/services/types.ts` `Bite`; ad hoc local bite shape removed.

### Discovery

- [x] Situation-based discovery presets (F-015) — no "< 15 min", "Budget < S$8", "Late night" tiles on DiscoverHomeScreen.
- [x] Dietary filter on Discover root (F-014) — `DietaryFlag` filter chips exist in Search but not accessible from Discover tab root.

### Loading States

- [x] Skeleton screens — no skeletons anywhere. Add skeleton placeholders for `DishDetailScreen`, `StallDetailScreen`, and `SearchResultsScreen` (preparing for API migration).
- [x] `OfflineStateScreen` trigger — screen exists but is never triggered. Add connectivity listener in `useAppBootstrap`.

### Sprint 8 Mini-Plan

> Add before implementation begins.

---

## 🟢 SPRINT 9 — P2 Polish & Future-Proofing

> **Owner:** Claude + Codex | **Timing:** After Sprint 8 is green.

- [x] Unit tests — Sprint 9 coverage added/adjusted for `tasteEngine.ts` pure math contracts (`src/lib/ai/tasteEngine.sprint9.test.ts`), repository mapping contracts (`src/lib/services/mock/repositories.sprint9.test.ts`), service behaviors (`src/lib/services/mock/service-methods.test.ts`), and 3+ critical screen contracts (`src/app/screens/sprint9-screen-contracts.test.ts` now includes Login, Review, HomeFeed, DishDetail).
- [x] Deep linking — linked routes added for `hungry://dish/:id`, `hungry://venue/:id`, and `hungry://order?venueId=...` (+ linking config/query parser tests).
- [x] Haptic feedback — `DiscoverHomeScreen` `handleDecideForMe` now fires `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` on tap.
- [x] Share URL — `DishDetailScreen` now invokes the real native share sheet (`Share.share`) with canonical URL `https://hungry.sg/dish/${dish.id}`.
- [x] Photo carousel — `DishDetailScreen` now uses `ImageCarousel` wired with `buildDishGallery(dish)` (`imageUrl + gallery[]` deduped).
- [x] Module co-location — `ProfileRadarChart` now lives in `src/components/dish/ProfileRadarChart.tsx`; old `screens/profile` module removed.
- [x] Font error handling — `AppBody` now has font-loading and timeout fallback surfaces when font assets are delayed/missing.
- [x] `similarityScore` in `repositories.ts` — extracted to `src/lib/ai/similarityScore.ts`; service provider now sources shared utility.
- [x] `useDiscoveryStore.popularNearby` async-safe access pattern — moved to selector-based consumption in `DiscoverHomeScreen` and added refresh token race-guard in `refreshPopularNearby`.
- [x] Placeholder stubs for `useOrderStore` and `useCartStore` (V2 prep) — minimal compile-safe Zustand stores added under `src/store/`.

### Wave Verification Log

- [x] Wave 1 gate run (2026-04-17): `lint` (0 errors), `typecheck` pass, `test` pass, `expo-doctor` pass. QA Agent A completed consistency audit.
- [x] Wave 2 gate run (2026-04-17): `lint` (0 errors), `typecheck` pass, `test` pass (added bites + service-method tests), `expo-doctor` pass.
- [x] Wave 3 gate run (2026-04-17): auth failure simulation + review persistence verified with new tests (`mockAuth.test.ts`, `useProfileStore.review-persistence.test.ts`).
- [x] Wave 4 gate run (2026-04-17): deep-link contracts added + tested (`RootNavigator.linking.test.ts`), font fallback behavior added in bootstrap path.
- [x] Wave 5 gate run (2026-04-17): `npm run test` → pass (`tests 68`, `fail 0`); `npm run typecheck` → pass; `npm_config_cache=/tmp/npm-cache npx expo-doctor` → pass (16/16).
- [x] Wave 6 QA/QC re-audit (2026-04-17): QA agent verified Sprint 9 PASS on routed DishDetail premium share + carousel behavior; QC agent reported no high issues, one medium residual risk (`sprint9-screen-contracts.test.ts` remains source-contract style rather than runtime-render tests).

---

## 🔵 PHASE 7 — Backend Bootstrap (V2 Foundation)

> **Owner:** Claude architects, Codex scaffolds | **Stack:** Supabase (Postgres 15 + PostGIS + pgvector).  
> Full schema in `tasks/backend-architecture.md`.

### Database

- [ ] Provision Supabase project (`hungry-production`)
- [ ] Run migration `0001_v2_initial_schema.sql` — all tables from `backend-architecture.md §2.3`
- [ ] Run migration `0002_seed_dietary_flags.sql` — halal, vegetarian, vegan, pork_free, nut_free, gluten_free
- [ ] Run migration `0003_seed_venue_categories.sql` — local_favourites, noodles, rice, desserts, late_night
- [ ] Seed `buildings`, `building_floors`, `venues` from V1 mock fixtures (Maxwell, Lau Pa Sat, Amoy)
- [ ] Seed `dishes`, `dish_images`, `dish_taste_vectors` from V1 fixture data
- [ ] Seed `blog_sources`, `blog_posts` (EatBook, SethLui)
- [ ] Add `update_dish_rating` trigger (see `backend-architecture.md §10`)
- [ ] Verify PostGIS: `SELECT ST_Distance(...)` smoke test on Maxwell/Lau Pa Sat coordinates
- [ ] Verify pgvector: HNSW index smoke test on taste vector cosine similarity

### Auth (Supabase Auth)

- [ ] Configure email + password provider
- [ ] Configure Google OAuth provider
- [ ] Configure Apple OAuth provider (iOS required)
- [ ] Define Row Level Security (RLS) policies on `users`, `reviews`, `orders`, `chat_messages`
- [ ] Implement guest session token issuance endpoint (`POST /api/guest-sessions`)

### API Layer (Supabase Edge Functions or Next.js API routes)

- [x] **AUD-04 — CI pipeline has no lint gate** `.github/workflows/ci.yml` — The `quality-gates` job runs typecheck → test → expo-doctor but has no ESLint step. Lint errors silently pass CI. Fix: add `npm run lint` as a step (after verifying/adding the `lint` script to `package.json`).

- [x] **AUD-05 — `navigation as any` in ProfileHomeScreen** `src/app/screens/profile/ProfileHomeScreen.tsx:23` — `getRootNavigation(navigation as any)` casts away type safety on the navigation prop. If the prop type or `getRootNavigation` signature changes, this will fail silently at runtime. Fix: cast to `NativeStackNavigationProp<ProfileStackParamList>` (the actual prop type from the screen's `NativeStackScreenProps`).

#### LOW

- [x] **AUD-06 — `borderRadius: 999` instead of `radii.pill`** `src/app/screens/onboarding/OnboardingIntroTemplate.tsx:487,506,517,524` and `TasteQuizScreen.tsx:561` — Sprint 2 replaced hardcoded radii in most screens but these five instances were missed. Fix: replace with `radii.pill` from `useHungryTheme()`.

- [x] **AUD-07 — Hardcoded `#FFFFFF` in LoginScreen** `src/app/screens/auth/LoginScreen.tsx:113` — `color="#FFFFFF"` on the `ArrowRight` icon. Sprint 2 replaced `#FFFFFF` in 35+ places but missed this one. Fix: `color={palette.white}`.

- [x] **AUD-08 — Gradient uses hardcoded hex matching an existing token** `src/app/screens/wheel/WheelResultModal.tsx:110` — `colors={[palette.amber, "#F59E0B"]}` — `#F59E0B` is identical to `palette.amber`. Fix: `colors={[palette.amber, palette.amber]}` or simplify to a solid color.

- [x] **AUD-09 — `dataRepository` Proxy undocumented as deprecated** `src/lib/services/serviceProvider.ts:52–63` — The Proxy is a compatibility shim for legacy call sites migrating off direct mock imports. The comment says "legacy callsites" but there is no explicit deprecation notice telling future contributors to use `getDataRepository()` instead. Fix: add `@deprecated Use getDataRepository() directly.` JSDoc to the `dataRepository` export.

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

- [x] **Loading/error states audit:** Once real async is in place, verify that all screens handle loading spinners, error states, and empty states correctly with non-instant network responses. *(Verified via `codebase_investigator` audit; standardized FeedStateView/Skeleton usage; hardened DiscoverHome with isOffline logic)*
- [x] **Offline experience spec:** Define the UX for offline/degraded states when Supabase is unreachable — cached data display, retry affordances, queue-and-sync for reviews. *(Done 2026-04-17 — comprehensive technical spec at docs/audit/OFFLINE_SPEC.md defining Blocked vs Degraded states and sync queue design)*

#### Done gate

- [ ] All `DataRepository` methods return live data from Supabase.
- [ ] Auth flow (sign up → verify email → onboarding → main app) works end-to-end against Supabase Auth.
- [ ] `HUNGRY_DATA_SOURCE=mock` still works as a fallback (no regression).
- [ ] Review photo upload stores to Supabase Storage and displays via CDN URL.
- [ ] `npm run typecheck` passes.
- [ ] No `mockRepository` imports remain in production code paths.

---

### Cross-Cutting: Ongoing Responsibilities

| Agent      | Standing Responsibility                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude** | Architecture decisions, contract definitions, planning docs, event taxonomy maintenance, tradeoffs log updates, backlog truthfulness enforcement. |
| **Codex**  | All code implementation, typecheck enforcement, test coverage, migration execution, dependency management.                                        |
| **Gemini** | Design token governance, visual spec authorship, UI/UX audit, accessibility compliance, component pattern guidance.                               |
| **All**    | Update `tasks/todo.md` after every work block. Record lessons in `tasks/lessons.md`. Never mark Done without verification evidence.               |

---

## Sprint 6 — Tooling, Hygiene & Error Boundaries (2026-04-15)

> **Source:** Chief of Staff audit by Claude (Sonnet 4.6). See `tasks/Roadmap/chief-of-staff-report-2026-04-15.md` for full findings.
> **Rule:** No item may be marked `[x]` without a verification step recorded in Section 5 (Session Log).
> **Agents:** **[Codex]** = execution. **[Claude]** = planning/docs. **[Gemini]** = design/copy.

---

### Tooling & Developer Experience

#### Codex primary

- [x] **TOOL-01 — Install ESLint + Prettier:** `.eslintrc.json`, `eslint.config.js`, `.prettierrc` in place; `lint`, `format`, `format:check`, `lint:fix` scripts in `package.json`. *(Verified 2026-04-17)*
- [x] **TOOL-02 — Add lint gate to CI:** `.github/workflows/ci.yml:27` runs `npm run lint` in the `quality-gates` job. *(Verified 2026-04-17)*
- [x] **TOOL-03 — Pre-commit hooks:** `.husky/pre-commit` hook wired; `lint-staged` configured for staged `.ts`/`.tsx` files. *(Verified 2026-04-17)*
- [x] **TOOL-04 — Create `.env.example`:** `.env.example` exists at repo root with documented variable placeholders. *(Verified 2026-04-17)*

#### Done gate

- [x] `npm run lint` exits 0 with zero errors. *(Wave 1–4 gate logs 2026-04-17)*
- [x] `npm run format:check` — script present; Prettier config active.
- [x] `git commit` triggers lint-staged and blocks on lint failure. *(Husky pre-commit hook present.)*
- [x] `.env.example` exists at repo root with all variable names documented.

---

### Dead Code Removal

#### Codex primary

- [x] **DEAD-01 — Delete `HomeMapScreen (1).tsx`:** Removed in commit `00f03e256` (Completed Sprint 7). *(Verified 2026-04-17: only `HomeMapScreen.tsx` remains.)*
- [x] **DEAD-02 — Delete `BuildingInfoSheet.tsx`:** Removed in commit `00f03e256`. *(Verified 2026-04-17.)*
- [x] **DEAD-03 — Delete `DiscoverTabScreen.tsx`:** Removed in commit `00f03e256`. *(Verified 2026-04-17.)*
- [x] **DEAD-04 — Delete `.tmp_todo_current.md`:** Removed in commit `00f03e256`. *(Verified 2026-04-17: `ls` returns "No such file".)*

#### Done gate

- [x] `find src/ -name "*HomeMapScreen*"` returns exactly one result.
- [x] `find src/ -name "BuildingInfoSheet*"` returns zero results.
- [x] `find src/ -name "DiscoverTabScreen*"` returns zero results.
- [x] `ls .tmp_todo_current.md` returns "No such file".
- [x] `npm run typecheck` passes. *(Wave gate logs 2026-04-17.)*

---

### Error Boundary Coverage

> **Goal:** Cover auth and detail screens so uncaught errors degrade gracefully instead of crashing the full app.
> **Note:** `FeedErrorBoundary` already exists in `src/components/ui/FeedErrorBoundary.tsx` — use it; do not create a new component.

#### Gemini primary

- [x] **ERR-00 spec:** Define fallback copy and visual design for auth-screen error states and detail-screen error states. Specify what message and CTA to show when `FeedErrorBoundary` catches on each screen group. *(Verified 2026-04-17 via logic-tests + docs/audit/ERR_BOUNDARY_SPEC.md)*

#### Codex primary

- [x] **ERR-01 — Auth screen boundaries:** `LoginScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `EmailVerificationScreen`, `ResetPasswordScreen` all wrap `FeedErrorBoundary`. *(Verified 2026-04-17.)*
- [x] **ERR-02 — Detail screen boundaries:** `DishDetailScreen` and `StallDetailScreen` wrap `FeedErrorBoundary`. *(Verified 2026-04-17.)*

#### Done gate

- [ ] Manual crash test: trigger a JS throw in `LoginScreen` render — app shows fallback UI, does not white-screen. *(Runtime smoke still required.)*
- [ ] Manual crash test: trigger a JS throw in `DishDetailScreen` render — app shows fallback UI. *(Runtime smoke still required.)*
- [x] `npm run typecheck` passes. *(Wave gate logs 2026-04-17.)*

---

### Documentation & Lessons

#### Claude primary

- [x] **LES-01 — Add 4 missing lessons to `tasks/lessons.md`:** Token scope, service provider bypass, state persistence after sign-out, backlog verification gate. *(Done 2026-04-15 — lessons appended)*
- [ ] **DOC-01 — Document feature flags in README:** Add a "Feature Flags" section to `README.md` documenting `HUNGRY_DATA_SOURCE`, `FEATURE_FLAGS.directMessagesEnabled`, `FEATURE_FLAGS.commentsEnabled`, `FEATURE_FLAGS.craveEnabled`, and how to toggle them for development.

---

## 🟢 SPRINT 10 — Supply Priming (V1.5 Prep)

> **Owner:** Codex executes; Claude scopes contracts; Gemini scopes UX copy.
> **Gate:** Ship before V1 public launch so supply is warm by the time consumers arrive.
> **Depends on:** Sprint 5 Supabase migration landed (staging + prod).
> **Canonical plan reference:** `tasks/Roadmap/roadmap.md` §4.

### Schema (Claude primary, Codex executes)

- [ ] **CLM-01 — Append DDL to `backend-architecture.md` §2.3** for `menu_photo_submissions` (photo storage pointer + OCR job status), `dishes_draft` (extracted dishes pre-promotion + confidence score), `merchant_claim_interests` (UEN + contact + venue_id + claimed_at waitlist). [Claude]
- [ ] **CLM-02 — Write + run migration `0004_supply_priming.sql`** against Supabase for the three new tables. Requires Sprint 5 provisioning complete. [Codex]

### Menu OCR pipeline (Codex primary)

- [ ] **OCR-01 — Quick Review "snap a menu photo" step** — add optional step in `QuickReviewSheet.tsx` that uploads a menu photo alongside the review. [Codex]
- [ ] **OCR-02 — Supabase Storage bucket `menu-photos`** + signed-URL upload flow with size/MIME guardrails. [Codex]
- [ ] **OCR-03 — Edge Function `ingest-menu-photo`** invoking Google Cloud Vision `DOCUMENT_TEXT_DETECTION` with `languageHints: ["zh-Hans", "zh-Hant", "en"]` (SimpChinese + TradChinese + English — covers SG hawker reality). [Codex]
- [ ] **OCR-04 — LLM extraction step** (Gemini Flash or Claude Haiku) that converts the OCR text blob into a JSON array of `{name, price, modifiers[]}` with an `extraction_confidence` score per dish. [Codex]
- [ ] **OCR-05 — Write to `dishes_draft` with dedupe** — for each extracted dish compute cosine similarity on `(name, price)` against existing draft rows for that venue; similarity > 0.9 → bump confidence on existing row; else → insert new row. [Codex]
- [ ] **OCR-06 — Ops review queue UI at `/ops/dishes-draft`** — internal Next.js stub (separate admin app or protected route) letting a human reviewer accept / edit / reject extracted dishes before they render to consumers. [Codex]

### Consumer-surface supply capture (Codex primary, Gemini copy)

- [ ] **CLM-03 — "Claim this stall" CTA on `StallDetailScreen`** — fires `merchant_claim_interests` insert + telemetry event `claim_this_stall_tapped`. [Codex]
- [ ] **CLM-04 — Copy spec for CTA + verification explainer page** — tone-aligned with onboarding, sets expectation that verification uses SingPass Myinfo Business / NEA licence lookup / video walkaround. [Gemini]
- [ ] **CLM-05 — Feature flag `merchantClaimCtaEnabled`** added to `src/constants/featureFlags.ts` — OFF in production until public launch; ON in staging. [Codex]
- [ ] **CLM-06 — "Menu (community-sourced)" block on `StallDetailScreen`** — renders accepted `dishes_draft` rows so consumers get immediate value from their own photo uploads. Gated by `FEATURE_FLAGS.craveEnabled` sibling flag scope. [Codex]

### Done gate

- [ ] OCR pipeline processes a test menu photo end-to-end in staging within 30s (upload → Vision → extraction → `dishes_draft` row visible in ops queue).
- [ ] "Claim this stall" CTA fires a telemetry event AND inserts a `merchant_claim_interests` row in staging.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] Feature flag `merchantClaimCtaEnabled` OFF in production, ON in staging (verified via live flag read).

---

## 🔵 PHASE 8 — Merchant Portal & QR Ordering (V2, deferred)

> **Gate — do NOT start Phase 8 until ALL five are green:**
> 1. ≥500 active consumer WAU sustained 4 consecutive weeks.
> 2. ≥20 hawker centres with ≥80% venue coverage.
> 3. ≥50 rows in `merchant_claim_interests`.
> 4. ≥5 merchants committed to pilot onboarding (phone confirmed, not just waitlist).
> 5. Sprint 5 Supabase migration fully green (staging + prod).
>
> **Canonical plan reference:** `tasks/Roadmap/roadmap.md` §5–§6.

### Sprint 11 — Merchant Portal skeleton + Verification

- [ ] **MP-01 — Standalone Next.js merchant portal app** (separate deploy; keeps merchant auth/session/bundling orthogonal to consumer app). [Codex + Claude architect]
- [ ] **MP-02 — SingPass Myinfo Business integration (Tier 1)** — instant ACRA pull by UEN via Singpass consent flow. Primary verification path for registered businesses. [Codex]
- [ ] **MP-03 — NEA licensed hawker lookup adapter (Tier 2)** — licence number + stall address match against NEA's published hawker licence dataset. [Codex]
- [ ] **MP-04 — Video walkaround upload + ops review queue (Tier 3)** — 30-second stall walk covering signage, menu board, POS. Ops reviews within 48h SLA. Replaces postcard pattern (which fails in SG hawker context). [Codex]
- [ ] **MP-05 — `vendor_profiles.kyc_status` state machine** — `pending → in_review → verified | rejected`; rejected can re-submit. DDL already in `backend-architecture.md`. [Claude spec, Codex impl]
- [ ] **MP-06 — Verification explainer page + merchant FAQ** — why we ask for each document, how long each tier takes, what "Verified" badge means to consumers. [Gemini]

### Sprint 12 — Merchant Menu Editor + Claim Promotion

- [ ] **MP-07 — Merchant menu editor** — review `dishes_draft` seeded by Sprint 10 OCR → accept / edit / reject → promote to authoritative `dishes` table. [Codex]
- [ ] **MP-08 — Modifier group editor** — wire `modifier_groups`, `modifier_options`, `dish_modifier_groups` from `backend-architecture.md` §2.3. [Codex]
- [ ] **MP-09 — Claim review workflow** — merchant claim → ops review → consumer-surface "Verified" badge renders on `StallDetailScreen`. [Codex]
- [ ] **MP-10 — Pilot onboarding cohort** — 5–10 hawkers drawn from top of `merchant_claim_interests` waitlist; white-glove onboarding, weekly check-ins, structured feedback capture. [Claude facilitates]

### Sprint 13 — Payment Rails

- [ ] **PAY-01 — Stripe Connect Express onboarding** — merchant hosted KYC flow; weekly payouts to merchant bank account. Primary rail. [Codex]
- [ ] **PAY-02 — SGQR/PayNow secondary rail** — requires bank partnership (DBS or OCBC); likely 2026-Q4 deliverable. Scope as optional; don't block Sprint 13 critical path. [Claude scopes, Codex impl]
- [ ] **PAY-03 — Payout scheduling + bank account linking flow** — merchant-side UI for editing payout method + viewing next payout date. [Codex]
- [ ] **PAY-04 — Tax (GST 9%) + service-fee calculation** — write to `order.tax_cents` + `order.service_fee_cents`; DDL already in `backend-architecture.md`. [Claude spec]

### Sprint 14 — QR Session + Consumer Order Flow

- [ ] **QR-01 — QR session issuance API** — `POST /api/merchant/qr-sessions` creates `qr_sessions` row with `token`, `venue_id`, optional `table_label`, `expires_at`. [Codex]
- [ ] **QR-02 — Printable QR asset generator** — PNG + PDF with Hungry branding, merchant-configurable table label. [Codex]
- [ ] **QR-03 — Consumer deep-link handler extension** — `hungry://order?venueId=X&qrSessionId=Y&table=A3`; parses → resolves menu from `dishes` → opens cart. [Codex]
- [ ] **QR-04 — Cart + checkout screens (consumer app)** — dish list with modifiers, qty adjust, totals, tax/service-fee breakdown, payment method selector. [Codex + Gemini design]
- [ ] **QR-05 — Stripe PaymentSheet integration in Expo** — use `@stripe/stripe-react-native` PaymentSheet for native pay UX. [Codex]
- [ ] **QR-06 — Order creation API + idempotency keys** — `POST /api/orders` with `Idempotency-Key` header to dedupe double-tap payments. [Codex]

### Sprint 15 — Merchant Order Inbox + Lifecycle

- [ ] **QR-07 — Merchant order inbox** — realtime via Supabase Realtime subscribed to `orders` partition for the merchant's `vendor_id`. [Codex]
- [ ] **QR-08 — Order status lifecycle UI** — `placed → accepted → preparing → ready → collected`; each transition audited in `order_status_history`. [Codex + Gemini]
- [ ] **QR-09 — Push notifications** — order accepted (consumer), order ready (consumer), new order (merchant); Expo Notifications + FCM/APNs. [Codex]
- [ ] **QR-10 — Refund flow** — `refunds` table + Stripe refund API + merchant-initiated partial/full refund UI. [Codex]
- [ ] **QR-11 — Weekly Stripe payout confirmation email** — sent to merchant on payout settlement; template in shared transactional email infra. [Codex]

---

## 5. Shared Session Log (Claude + Codex must append)

- [x] Session log maintained with: date, actor (Claude/Codex), tasks touched, status, blockers, next step.

### Session Entries
- 2026-04-17 | Codex | Sprint 9 non-UI closure pass: verified and finalized haptic tap on Discover "Decide For Me", real Dish Detail share sheet with canonical `https://hungry.sg/dish/:id` URL, gallery-backed `ImageCarousel` usage in Dish Detail, ProfileRadarChart co-location under `src/components/dish/`, async-safe `popularNearby` pattern (selector consumption + refresh race guard), and placeholder `useOrderStore`/`useCartStore` stubs for V2 prep. Updated Sprint 9 checklist statuses accordingly. | Status: completed + verification in progress. | Blockers: none. | Next: run TypeScript gate and report touched files + Sprint 9 completion matrix.
- 2026-04-17 | Codex | Sprint 9 testing + backlog sync evidence: expanded service-behavior coverage in `src/lib/services/mock/service-methods.test.ts`, strengthened repository mapping contracts in `src/lib/services/mock/repositories.sprint9.test.ts`, and extended critical screen contracts in `src/app/screens/sprint9-screen-contracts.test.ts` (Login, Review, HomeFeed, routed DishDetail premium). Updated Sprint 9 unit-test checklist and Wave 5 verification evidence lines with command results/date. | Status: completed + verified. | Blockers: none. | Next: maintain Sprint 9 gate evidence as future changes land.
- 2026-04-17 | Claude (Sonnet 4.7) | Strategic advisory for merchant expansion delivered. Consolidated 8 overlapping `tasks/Roadmap/*.md` drafts into a single READ-FIRST `tasks/Roadmap/roadmap.md` (11 sections, 329 lines) without deleting sources — sources preserved under `tasks/Roadmap/` for audit trail per §11 Archive Map. Authored Sprint 10 (Supply Priming, 14 items: CLM-01..06 + OCR-01..06 + done-gate) and Phase 8 (Merchant Portal + QR Ordering V2, 26 items across Sprints 11–15: MP-01..10, PAY-01..04, QR-01..11) with explicit Claude/Codex/Gemini assignments. Decision recorded: Merchant Portal ships as V2 (Phase 3), NOT V1; V1 primes supply passively via Menu OCR + "Claim this stall" waitlist CTA. Phase 8 gate: ≥500 WAU × 4wk + ≥20 hawker centres 80% coverage + ≥50 waitlist rows + ≥5 pilot commits + Sprint 5 green. 3 lessons appended to `tasks/lessons.md` (consolidation audit trail, two-sided marketplace gating, SG verification tiering). | Status: documentation complete. | Blockers: Sprint 5 Supabase migration still open — Phase 2 (Sprint 10) cannot execute DDL until Sprint 5 lands. | Next: Codex picks up Sprint 10 CLM-02 migration + OCR-01..06 pipeline once Sprint 5 provisions Supabase; Claude drafts CLM-01 DDL append to `backend-architecture.md` in parallel (no Sprint 5 dependency for the DDL spec itself, only for executing the migration).
- 2026-04-17 | Claude (Sonnet 4.7) | Sprint 5/6/8 audit against code after merge of PR #19 + commit `00f03e256` (Completed Sprint 7). Verified Sprint 6 TOOL-01..04 (`.eslintrc.json`, `.prettierrc`, `.husky/pre-commit`, `.env.example`, CI lint step at `.github/workflows/ci.yml:27`), DEAD-01..04 (files removed by Sprint 7 commit), and ERR-01/ERR-02 (`grep -l FeedErrorBoundary` confirms 5 auth + 2 detail screens). Flipped these from `[ ]` to `[x]` in `tasks/todo.md`. Verified Sprint 8 `[x]` marks are grounded in code (QuickReviewSheet, discovery presets, dietary chip, skeletons, offline route switch). Sprint 5 Supabase Codex/Gemini items confirmed still genuinely open (no `src/lib/services/supabase/` directory exists). Remaining genuinely open in Sprint 6: ERR-00 Gemini copy spec, DOC-01 README Feature Flags section, ERR manual crash tests. | Status: documentation audit complete. | Blockers: none. | Next: Codex to execute Sprint 5 Supabase provisioning + repository scaffolding; Claude to write DOC-01 Feature Flags section in README.
- 2026-04-16 | Codex | Investigated runtime crash `Tried to register two views with the same name SkiaPictureView`. Confirmed New Architecture must stay enabled because `@rnmapbox/maps@10.3.0` rejects old architecture. Implemented durable Skia patch by guarding `SkiaPictureViewManager.mm` under `#ifndef RCT_NEW_ARCH_ENABLED`, generated `patches/@shopify+react-native-skia+2.2.12.patch`, added `patch-package` with `postinstall`, and re-synced iOS pods successfully. | Status: completed + verified (`npm run postinstall`, `cd ios && pod install`, `npm run typecheck`). | Blockers: runtime confirmation still requires app relaunch in simulator/device to verify redbox no longer appears. | Next: relaunch app with clean Metro cache and validate startup on iOS.
- 2026-04-15 | Claude | Chief of Staff audit: repo-wide dead code, harness gaps, backlog integrity, and production roadmap assessment. Created `tasks/Roadmap/chief-of-staff-report-2026-04-15.md`. Added Sprint 6 (TOOL-01/02/03/04, DEAD-01/02/03/04, ERR-01/02, DOC-01, LES-01) to backlog with Codex/Gemini/Claude delegation. Appended 4 missing lessons to `tasks/lessons.md` (token scope, service provider bypass, sign-out state persistence, backlog verification gate). | Status: documentation complete. | Blockers: none. | Next: Codex to execute Sprint 6 TOOL items first (ESLint/Prettier install), then DEAD items, then ERR items. Claude to handle DOC-01.
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
- 2026-04-15 | Codex | Retry pass for AI recommendation engine: audited roadmap coverage with the `Explore` subagent, enforced diversity caps in `runRecommendationPipeline`, corrected signed feedback updates (negative signals now push away from disliked dish vectors), added explicit-feedback recency decay support, propagated feedback timestamps from profile interactions, and added targeted regression tests for diversity + feedback math. | Status: completed + verified (`npm run typecheck`, `npm run test -- --runInBand`). | Blockers: none. | Next: optional Phase-2 Supabase endpoint wiring when backend scope is enabled.

---

## Sprint 7 — Boil the Ocean (UI/UX & Performance Overhaul)

> **Goal:** Complete comprehensive overhaul of the Hungry application to achieve premium "social-media" quality in UI/UX, motion, and performance.
> **Date:** 2026-04-16

#### Gemini primary
- [x] **BT-01 Design Audit & Critique:** Audited every screen, proposed immersive designs for Home, Discover, Detail, and Profile screens.
- [x] **BT-02 Motion Strategy:** Defined Context (Tab), Drill (Messaging), and Continuity (Card -> Full Screen) transitions.

#### Codex primary
- [x] **BT-03 Home Feed Overhaul:** Rebuilt with immersive full-bleed cards, action islands, haptic feedback, and local state optimization.
- [x] **BT-04 Dish Detail Overhaul:** Implemented parallax hero, morphing sticky header, immersive story flow, and Skia-powered `TasteRadar`.
- [x] **BT-05 Discover Performance:** Migrated to sectioned `FlashList` with layout animations and optimized image priorities.
- [x] **BT-06 Messaging Drill:** Added `ChatDetailScreen` and implemented shared element avatar morphing.
- [x] **BT-07 Profile Visualization:** Rebuilt with interactive stats and taste signature visualization.
- [x] **BT-08 Tab Transitions:** Implemented `AnimatedTabBar` for smooth context transitions between main app sections.
- [x] **BT-09 Performance Hardening:** Integrated `@shopify/flash-list` across the app for buttery smooth scrolling.
- [x] **BT-10 UI Hardening:** Enhanced `AppText` and `Button` components with premium variants (`displayBold`, `glass`, `success` tone).

#### Done gate
- [x] `npm run typecheck` passes with zero errors.
- [x] Transitions (Continuity, Drill, Context) functional in navigation and UI logic.
- [x] No hardcoded hex or radii remain in newly refactored screens.

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
- [x] `npm run typecheck` — 2026-04-15 (AI recommendation retry: diversity caps + signed/decayed feedback updates)
- [x] `npm run test -- --runInBand` — 2026-04-15 (AI recommendation retry + new taste-engine regression tests)
- [x] `npm run postinstall` — 2026-04-16 (validated patch-package applies `@shopify/react-native-skia` patch)
- [x] `cd ios && pod install` — 2026-04-16 (New Architecture retained; pods integrated successfully)
- [x] `npm run typecheck` — 2026-04-16 (post-fix compile health)
- [x] `npm run ios` — 2026-04-16 (Debug simulator build succeeded and app opened on iPhone 17 Pro)
