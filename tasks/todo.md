# Hungry — Master Task Contract
> **Last updated:** 2026-04-16 | **Phase:** Prototype → Production  
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

- [ ] **Wire `TasteFilter` route** — `RootNavigator.tsx` maps `TasteFilter` to `DeferredRouteScreen`. Replace with `TasteFilterScreen` import. File: `src/app/navigation/RootNavigator.tsx` ~L266.
- [ ] **Wire `BuildingDrillDown` route** — Same issue. Replace `DeferredRouteScreen` with `BuildingDrillDownScreen`. File: `src/app/navigation/RootNavigator.tsx` ~L275.
- [ ] **Fix profile sync on auth** — `useSessionStore.completeAuth()` never calls `useProfileStore.getState().syncProfile(true)`. After login, profile stays as `guestProfile`. Files: `src/store/useSessionStore.ts`, `src/store/useProfileStore.ts`.
- [ ] **Fix `BitesCarousel` data architecture** — `MOCK_BITES` inlined with wrong IDs (`"dish-1"` doesn't exist). Move to `data.ts`, align with `services/types.ts → Bite`, add `getBites()` repo method. File: `src/components/social/BitesCarousel.tsx`.
- [ ] **Fix `BitesCarousel` "See all" navigation** — navigates to `"Post"` (PostComposerScreen). Should navigate to a Bites feed or be removed. File: `src/components/social/BitesCarousel.tsx` ~L148.
- [ ] **Fix `MapZoomedIn` placeholder** — renders static text. Wire to `BuildingDrillDownScreen` or remove. File: `src/app/screens/discover/MapZoomedInScreen.tsx`.
- [ ] **Fix `StallDetail` wrong field** — `navigation.navigate("StallDetail", { venueId: item.dishId })` passes `dishId` as `venueId`. File: `src/components/social/BitesCarousel.tsx` ~L123.
- [ ] **Fix `useNavigation<any>()`** — replace with typed `NativeStackNavigationProp<RootStackParamList>` in `BitesCarousel.tsx` and any other components using `any` navigation type.
- [ ] **Verify typecheck passes** — `npm run typecheck` must be green after all P0 fixes.

### Sprint 7 Mini-Plan
> Add before implementation begins.

---

## 🟡 SPRINT 8 — P1 Beta Hardening
> **Owner:** Codex primary, Claude reviews | **Gate:** Before beta invites go out.

### Empty States
- [ ] `FavouritesScreen` — no empty state when list is empty. Add `EmptyState` with CTA to Discover.
- [ ] `ReviewHistoryScreen` — no empty state when no reviews. Add `EmptyState` with CTA to Review flow.
- [ ] `ProfileHomeScreen` — shows default user data for guest users. Show guest-appropriate fallback.

### Review Flow
- [ ] Review submit persistence — `ReviewComposeScreen` completes but writes nothing. Add review to `useProfileStore` + `data.ts` runtime state.
- [ ] Review success feedback — no toast or modal shown after submit. Add `ReviewSuccessModal` or `showToast` call.
- [ ] Quick-review path (F-018) — PRD requires a 30-second tag-only flow. Add shortcut that skips text/photo steps.

### Auth & Error Handling
- [ ] Auth error feedback — `LoginScreen` and `SignUpScreen` call `completeAuth()` with no failure simulation. Add error state + toast for bad credentials.
- [ ] Try/catch scaffolding — zero try/catch in any screen. Add error boundary pattern + `OfflineStateScreen` trigger before API migration.

### Service Layer
- [ ] `HungryService` interface — 41 methods defined, ~10 implemented. Complete mock implementations for all methods called by screens. File: `src/lib/services/mock/repositories.ts`.
- [ ] `getBuildingDetail()` repo method — defined in `HungryService` but missing from mock. Add it using `SingaporeBuilding` geo data.
- [ ] `getFloorPlan()` repo method — `FloorPlan` type exists in `services/types.ts` but no repo method. Add using `floorPlans.ts`.
- [ ] `Bite` type divergence — `services/types.ts → Bite` and local `BiteCard.tsx` `Bite` are different shapes. Reconcile to single source.

### Discovery
- [ ] Situation-based discovery presets (F-015) — no "< 15 min", "Budget < S$8", "Late night" tiles on DiscoverHomeScreen.
- [ ] Dietary filter on Discover root (F-014) — `DietaryFlag` filter chips exist in Search but not accessible from Discover tab root.

### Loading States
- [ ] Skeleton screens — no skeletons anywhere. Add skeleton placeholders for `DishDetailScreen`, `StallDetailScreen`, and `SearchResultsScreen` (preparing for API migration).
- [ ] `OfflineStateScreen` trigger — screen exists but is never triggered. Add connectivity listener in `useAppBootstrap`.

### Sprint 8 Mini-Plan
> Add before implementation begins.

---

## 🟢 SPRINT 9 — P2 Polish & Future-Proofing
> **Owner:** Claude + Codex | **Timing:** After Sprint 8 is green.

- [ ] Unit tests — `__tests__/` directory is empty. Write tests for `tasteEngine.ts` (pure functions), `repositories.ts`, and at least 3 critical screens.
- [ ] Deep linking — no `Linking` config. Set up universal links for `hungry://dish/:id`, `hungry://venue/:id`, and `hungry://order?venueId=X`.
- [ ] Haptic feedback — `Decide For Me` FAB should fire `Haptics.impactAsync` on tap (PRD spec).
- [ ] Share URL — `DishDetailScreen` share target is `"https://hungry.sg/dish/${dish.id}"` (placeholder). Implement real share sheet.
- [ ] Photo carousel — `DishDetailScreen` doesn't use `DishDetail.gallery` array. Wire to `ImageCarousel` component.
- [ ] Module co-location — `ProfileRadarChart` is in `screens/profile/` not `components/dish/`. Move.
- [ ] Font error handling — `useAppBootstrap` has no visible font-loading failure path. Add fallback.
- [ ] `similarityScore` in `repositories.ts` — pure utility. Extract to `src/lib/ai/` alongside `tasteEngine.ts`.
- [ ] `useDiscoveryStore.popularNearby` computed at store creation — guard for async-safe access pattern.
- [ ] Placeholder stubs for `useOrderStore` and `useCartStore` (V2 prep).

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
- [ ] `GET /api/buildings` — with `?lat&lng&radius&type` PostGIS proximity filter
- [ ] `GET /api/buildings/:id` — detail + open venues
- [ ] `GET /api/venues/:id` — detail + menu (cache in Redis 60s)
- [ ] `GET /api/dishes/:id` — detail + reviews
- [ ] `GET /api/search` — FTS on `search_tsv` + dietary + category filter
- [ ] `POST /api/recommendations/dishes` — pgvector cosine similarity endpoint
- [ ] `PATCH /api/users/me/taste-vector` — update user taste profile
- [ ] Health check endpoint + Vercel deploy config

### Frontend API Integration (replace mock repositories)
- [ ] Create `src/lib/services/api/` directory with real API client (typed fetch wrapper)
- [ ] Replace `mockRepositories` with real `apiRepositories` behind feature flag `FEATURE_FLAGS.useRealApi`
- [ ] Migrate `getDishById`, `getVenueById`, `getBuildingById`, `searchDishes` first
- [ ] Add error handling + loading state propagation through all screens
- [ ] `npm run typecheck` must pass after migration

---

## 🔵 PHASE 8 — QR Order & Pay
> **Owner:** Claude designs, Codex implements | **Revenue critical path.**  
> Full system design in `tasks/Roadmap/mvp_audit_and_v2_roadmap.md §2.2`.

### Backend
- [ ] Orders schema deployed (see `backend-architecture.md` — `orders`, `order_items`, `order_item_modifiers`, `order_status_history`, `payments`, `refunds`, `qr_sessions`)
- [ ] `POST /api/qr/scan` — validate QR token, return session + venue menu
- [ ] `POST /api/orders` — create order + Stripe PaymentIntent
- [ ] `PATCH /api/orders/:id/status` — vendor status updates (accepted/preparing/ready/cancelled)
- [ ] `GET /api/orders/:id` — status polling endpoint
- [ ] `GET /api/orders/history` — consumer order history (paginated)
- [ ] `POST /api/payments/confirm` — Stripe webhook handler
- [ ] Stripe account setup (SGD, PayNow + card enabled)
- [ ] QR code generation script for stall QR codes

### Frontend
- [ ] `QRScannerScreen.tsx` — camera-based QR scan entry
- [ ] `StallMenuScreen.tsx` — live menu with add-to-cart
- [ ] `CartSheet.tsx` — bottom sheet cart summary
- [ ] `CheckoutScreen.tsx` — payment method selector + confirm
- [ ] `OrderConfirmationScreen.tsx` — success + estimated wait
- [ ] `OrderTrackingScreen.tsx` — polling-based status (15s interval)
- [ ] `OrderHistoryScreen.tsx` — past orders + reorder shortcut
- [ ] `useCartStore.ts` — items, quantities, notes, stale-cart detection
- [ ] `useOrderStore.ts` — active order state, polling lifecycle
- [ ] `orderRepository.ts` — REST API wrapper
- [ ] `paymentService.ts` — Stripe `PaymentSheet` integration
- [ ] Deep link handler: `hungry://order?venueId=X&tableId=Y`

### Vendor Dashboard (separate surface)
- [ ] Next.js vendor portal scaffold (separate repo or `apps/vendor/`)
- [ ] Order inbox with real-time push (Socket.IO or Supabase Realtime)
- [ ] Accept / reject / mark-ready controls
- [ ] Basic analytics: orders/day, avg order value, top dishes

---

## 🔵 PHASE 9 — Guest Checkout
> **Owner:** Codex implements, Claude reviews security model.  
> Full system design in `tasks/Roadmap/mvp_audit_and_v2_roadmap.md §2.3`.

- [ ] `POST /api/guest-sessions` — create session (UUID + Stripe ephemeral key)
- [ ] `POST /api/guest-sessions/:id/upgrade` — migrate orders to full account
- [ ] `GuestCheckoutScreen.tsx` — Stripe PaymentSheet, no email required
- [ ] `GuestReceiptScreen.tsx` — order receipt + soft "Create account?" prompt
- [ ] `GuestUpgradeSheet.tsx` — bottom sheet: save details for next time
- [ ] `useGuestStore.ts` — session ID, saved methods, expiry tracking
- [ ] Guest session stored in `expo-secure-store` (Keychain / EncryptedSharedPreferences)
- [ ] 24-hour auto-expiry + server-side cleanup cron
- [ ] Verify: card details never touch Hungry servers (Stripe-native payment sheet)

---

## 🔵 PHASE 10 — Real-Time Messaging
> **Owner:** Claude designs, Codex implements.  
> Full system design in `tasks/Roadmap/mvp_audit_and_v2_roadmap.md §2.1`.

- [ ] `chat_threads`, `chat_participants`, `chat_messages`, `chat_message_receipts` tables deployed
- [ ] Socket.IO server deployed (Railway / Fly.io)
- [ ] `POST /api/chat/threads` — create or resume conversation
- [ ] `GET /api/chat/threads/:id/messages` — paginated history
- [ ] `PATCH /api/messages/:id/read` — mark read
- [ ] Socket.IO events: `message:send`, `message:new`, `typing:start`, `typing:stop`, `read:receipt`
- [ ] `ConversationListScreen.tsx`
- [ ] `ChatScreen.tsx` + `ChatBubble.tsx` + `ChatInputBar.tsx`
- [ ] `ChatStack.tsx` — stack navigator for chat
- [ ] `useChatStore.ts` — messages, typing state, unread counts
- [ ] `socketClient.ts` — connection manager with reconnect
- [ ] `chatRepository.ts` — REST wrapper for history + create
- [ ] Unread badge on tab bar (integrate with `useUIStore`)
- [ ] Push notification on new message (Expo Push + FCM/APNs)

---

## 🔵 PHASE 11 — Analytics & Vendor Intelligence
> **Owner:** Claude designs | **Timing:** After Phase 8 (orders generate the data).

- [ ] PostHog integration for event instrumentation
- [ ] Event taxonomy: `dish_viewed`, `search_performed`, `decide_for_me_used`, `order_placed`, `review_submitted`, `favourite_toggled`
- [ ] Vendor analytics dashboard: top dishes, peak hours, revenue trend, avg order value
- [ ] Export: CSV order data for inventory planning
- [ ] Dish popularity rankings across hawker centres
- [ ] Crowd signal: busyness indicator derived from active order volume per stall
- [ ] Wait-time estimate shown on stall card and map pin

---

## 🏗️ Platform Infra (Cross-Cutting)
> These run in parallel with all phases above.

- [ ] **CI/CD** — GitHub Actions: lint → typecheck → test → build on every PR
- [ ] **Unit test suite** — Jest + React Native Testing Library; target 60% coverage on business logic
- [ ] **Sentry** — crash reporting for both Expo app and API layer
- [ ] **Environment management** — `.env.local` + Vercel env vars; separate staging/prod Supabase projects
- [ ] **CDN** — Vercel Blob for review photos + menu images; `blurhash` on all food images
- [ ] **Rate limiting** — Redis-backed rate limits on order creation, guest session creation, search
- [ ] **GDPR / PDPA** — data deletion endpoint; audit log for personal data access
- [ ] **App Store submission** — iOS App Store + Google Play setup; metadata, screenshots, privacy policy

---

## Shared Session Log
> Append: `YYYY-MM-DD | Actor | Tasks touched | Status | Blockers | Next`

- 2026-04-05 | Codex | Project-fit task requirements, phased checklist, planning cadence | ✅ Done | None | Keep checklist current
- 2026-04-06 | Codex | Screen inventory, design artifacts, Stitch design system + screen briefs | ✅ Done | Stitch not editable from sandbox | Generate in Stitch, sync to Figma + code
- 2026-04-08 | Codex | Repo housekeeping, removed stale `AGENT.md`, archived old design iterations | ✅ Done | None | Phase 2 as active workstream
- 2026-04-08 | Codex | Figma-fidelity hardening: auth-first shell, guest removal, emoji purge, shared primitives | ✅ Done | Simulator unavailable in sandbox | Run on-device visual smoke tests locally
- 2026-04-08 | Codex | Maps deliverables: MapSurface, Maps tab, MapZoomedIn, BuildingDrillDown, Maxwell L2 floor plan | ✅ Done | Mapbox token required for live render | Configure `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` locally
- 2026-04-08 | Codex | Home feed container fix, app-wide scrollbar suppression | ✅ Done | Simulator verification needed | Open app locally, verify Home/Review/Search/Dish Detail
- 2026-04-08 | Codex | Marketing launch workspace under `marketing/` | ✅ Done | Could not write to `.agents/` from sandbox | Mirror to `.agents/` in less-restricted env
- 2026-04-08 | Codex | Sprint 6 audit: full codebase vs PRD/Figma/data-contracts; V2 system design (messaging, ordering, guest checkout) | ✅ Done | None | Fix P0 dead ends in Sprint 7
- 2026-04-16 | Claude | V2 database schema (30+ tables, DDL, indexes) → `tasks/backend-architecture.md` | ✅ Done | None | Provision Supabase, run migrations
- 2026-04-16 | Claude | Fixed `security_reminder_hook.py` — quoted `${CLAUDE_PLUGIN_ROOT}` in both hooks.json copies | ✅ Done | None | Restart Claude Code to reload hooks
- 2026-04-16 | Claude | Upgraded Vercel CLI 50.37.3 → 50.42.0 via npm | ✅ Done | None | —
- 2026-04-16 | Claude | Rebuilt `tasks/todo.md` (this file) + `war-room-report-2026-04-16.md` from scratch | ✅ Done | None | Sprint 7 P0 fixes are next

---

## Verification Commands

| Command | When | Gate |
|---------|------|------|
| `npm run typecheck` | After every code change | **Required** — blocks commit |
| `npx expo-doctor` | After any package change | Required |
| `npm run test` | After any logic change | Required (once tests exist) |
| `npm run ios` | After any navigation/UI change | Manual verification |
| `npm run android` | After any navigation/UI change | Manual verification |

### Verification Log
- 2026-04-05: `npm run typecheck` ✅
- 2026-04-08: `npm run typecheck` ✅ (multiple passes through hardening)
- 2026-04-08: `npx expo-doctor` ✅
- 2026-04-08: `npm run test` ❌ — script not defined in `package.json`
- 2026-04-16: Hook fix verified — `python3 "${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py"` in both hooks.json
- 2026-04-16: Vercel CLI ✅ `50.42.0`
