# 🔥 Hungry — State of the Union: Architectural Audit Report

> **Date:** 2026-04-13  
> **Auditor:** Chief of Staff / Principal Technical Advisor  
> **Scope:** End-to-end codebase audit, backlog hygiene, production transition strategy  
> **Verdict:** ⛔ **NOT PRODUCTION-READY** — Critical regressions, architectural leaks, and unfinished features

---

## Executive Summary

The Hungry codebase has made impressive progress as a mock-first MVP. The service interface contract (`HungryService`), navigation wiring, design token system, and store architecture are fundamentally sound. However, the repo is **not in a shippable state**. A cascade of recent multi-agent edits has introduced **25 TypeScript compilation errors**, **20+ screens bypassing the service provider**, **35+ hardcoded hex color violations**, widespread hardcoded copy, and several fully unimplemented features that are wired into the navigation graph.

The backlog (`tasks/todo.md`) claims all P0/P1/P2 items are closed. **This is false.** Multiple regressions are live in the current branch. The backlog has accumulated status inflation from rapid agent handoffs without rigorous verification.

---

## Phase 1: End-to-End Audit

---

### 1.1 — Build Health: ⛔ FAILING

> [!CAUTION]
> **`npm run typecheck` fails with 25 errors across 7 files.** The README and backlog both claim typecheck is passing. This is incorrect.

| File | Error Count | Root Cause |
|------|-------------|------------|
| [OnboardingIntroTemplate.tsx](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/app/screens/onboarding/OnboardingIntroTemplate.tsx) | 13 | `spacing` and `radii` referenced outside hook scope in `StyleSheet.create` |
| [DecideForMeCard.tsx](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/components/dish/DecideForMeCard.tsx) | 4 | `spacing` referenced outside hook scope |
| [DishCard.tsx](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/components/dish/DishCard.tsx) | 3 | `spacing` referenced outside hook scope |
| [BiteCard.tsx](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/components/social/BiteCard.tsx) | 1 | `spacing[0.5]` — key `0.5` doesn't exist in the spacing scale |
| [StallCard.tsx](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/components/stall/StallCard.tsx) | 2 | `spacing` referenced outside hook scope |
| [Screen.tsx](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/components/ui/Screen.tsx) | 2 | `spacing` referenced outside hook scope |

**Pattern:** These are all the same bug — theme tokens used inside `StyleSheet.create()` blocks that run at module scope, where `useHungryTheme()` hasn't been called. This is a systematic regression introduced during the recent "tokenization" pass that moved hardcoded values to theme tokens but placed them in the wrong scope.

---

### 1.2 — Architecture Adherence

#### 1.2.1 Service Provider Bypass: ⛔ CRITICAL

The documented architecture (P1-01) specifies:
> *"Screens import from stores only — never from `mock/data.ts` or `mock/repositories.ts` directly"*

**Reality: 20 screen files directly import `mockRepository` from `@/lib/services/mock/repositories`.**

| Category | Files |
|----------|-------|
| **Screens importing `mockRepository` directly** | `DecideForMeResultScreen`, `HomeMapScreen`, `CraveScreen`, `DiscoverHomeScreen`, `BuildingDrillDownScreen`, `PostComposerScreen`, `WheelResultModal`, `WheelEntryAddSheet`, `SearchResultsScreen`, `BlogPostWebViewScreen`, `StallDetailScreen`, `DishDetailScreen`, `ProfileHomeScreen`, `FavouritesScreen`, `ReviewHistoryScreen`, `ReviewComposeScreen`, `ReviewRatingScreen`, `ReviewHubScreen`, `DeveloperLauncherScreen`, `FoodSelectionScreen` |
| **Files correctly using `serviceProvider`** | `TasteProfileResultScreen`, `feed.ts`, `discovery.ts`, `search.ts`, `feed.ts` (reads), `useDiscoveryStore`, `useProfileStore` |

This means **75% of data access bypasses the service provider entirely**. When you swap to a Supabase backend, you won't get a single-file change — you'll need to refactor 20 screen files. The clean swap path promised by P1-01 does not exist in practice.

#### 1.2.2 Navigation Type Safety: ⚠️ DEGRADED

**8 files use `useNavigation<any>()`**, throwing away TypeScript's route parameter checking:

- `HomeFeedScreen.tsx`
- `DecideForMeResultScreen.tsx`
- `CraveScreen.tsx`
- `DiscoverHomeScreen.tsx`
- `TasteFilterScreen.tsx`
- `SearchResultsScreen.tsx`
- `DishSearchScreen.tsx`
- `BitesCarousel.tsx`

The backlog claimed P2-42 ("removed `useNavigation<any>()` callsites") was **Done**. This is false — there are still 8 callsites.

#### 1.2.3 Token Storage Security: ⚠️ RISK

- Session tokens (auth state) are persisted via **AsyncStorage** (unencrypted on-device storage).
- **`expo-secure-store` is not installed** — no encrypted storage exists in the dependency tree.
- For a mock app this is acceptable; for production with real auth tokens, this is a **security vulnerability**.

#### 1.2.4 .env File Exposure: ⚠️ RISK

The `.env` file contains a **Mapbox access token** in plaintext:
```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoic2lld2hlYW4i...
```
- `.gitignore` includes `.env` — ✅ properly excluded from commits.
- However, `EXPO_PUBLIC_*` variables are **compiled into the JS bundle** and visible to anyone who inspects the app binary. This is expected for Mapbox public tokens but should be documented as a known exposure.

#### 1.2.5 Developer Launcher in Production: ⚠️ PARTIAL GUARD

The `DeveloperLauncherScreen` is only guarded by the `initialRouteName` check:
```tsx
initialRouteName={__DEV__ ? "DeveloperLauncher" : "Splash"}
```

However, the screen is **still registered as a route in the production stack**. A deep link to `hungry://DeveloperLauncher` could theoretically navigate there in a production build. The screen should be conditionally registered or fully removed from the stack in production.

---

### 1.3 — The Button Purge 🔍

#### Fully Unimplemented / Dead-End Features

| Feature | Route/Button | Current State | Severity |
|---------|--------------|---------------|----------|
| **Direct Messages** | Home → DM icon | Renders a screen with 4 hardcoded `MOCK_CHATS`. Chat items have empty `onPress`. No real messaging. | ⛔ Dead end |
| **Comments** | Home Feed → any card comment interactions | Opens a bottom sheet that says "Community discussions coming soon." | ⚠️ Placeholder |
| **Post Composer** | Route `Post` exists | Renders a card with a randomly-selected first dish. "Publish" shows a toast. "Save draft" shows a toast. No real compose/media flow. | ⛔ Skeleton |
| **Crave (Daily Swipe)** | Discover → Crave button | **Fully functional** as a Tinder-style swiper with haptics and favouriting. But imports directly from `mockRepository`, uses 11+ hardcoded hex colors, and hardcoded spacing. | ⚠️ Unpolished |
| **Info button on Crave** | Crave screen → `(i)` icon top-right | `<Pressable>` with **no `onPress`** handler. Dead button. | ⛔ Dead button |
| **Edit3 button on DM** | DM screen → compose icon top-right | `<Pressable>` with **no `onPress`** handler. Dead button. | ⛔ Dead button |
| **Wheel (Group Decision)** | Discover → Wheel button | Full multi-screen flow exists (Home, Lobby, Spin, Result, AddSheet). Uses `useWheelStore`. **Functional but heavily hardcoded.** | ⚠️ Needs polish |
| **WheelResultModal dismiss** | WheelResultModal → background tap | Has `onPress={() => {}}` — empty handler intentional (backdrop tap absorber), but should use a proper dismiss. | ⚠️ UX gap |
| **"Detailed Analysis" Pressable** | Profile → Taste Fingerprint card | Entire card is a `<Pressable>` but **no `onPress` navigates anywhere**. Chevron arrow suggests it's tappable but it does nothing. | ⛔ Dead button |
| **Favourites card tap on Profile** | Profile → Recently Saved cards | `<Pressable>` but **no `onPress` handler**. Cards cannot be tapped to navigate to DishDetail. | ⛔ Dead button |

#### Hardcoded / Static-State Content

| Location | Issue |
|----------|-------|
| `HomeFeedScreen:135` | **"Tanjong Pagar · 14 nearby"** — hardcoded location and count |
| `DiscoverHomeScreen:130` | **"Tanjong Pagar"** — hardcoded location header |
| `ProfileHomeScreen:91` | **"Level 12 • Foodie Scout"** — hardcoded gamification string |
| `ProfileHomeScreen:144` | **"8 new stalls"**, **"top 5%"**, **"Tanjong Pagar"** — entire analytics paragraph is hardcoded prose |
| `HomeFeedScreen:72-73` | Default interaction counts `{ likeCount: 12, saveCount: 4, shareCount: 2, commentCount: 3 }` hardcoded as fallbacks |
| `DirectMessagesScreen:10-15` | **4 hardcoded mock chat entries** with inline avatar URLs — not from `mock/data.ts` |
| `HomeMapScreen:27-29` | Busyness indicator colors `#10B981`, `#F59E0B`, `#EF4444` hardcoded |

---

### 1.4 — Design System Enforcer Results

#### Hardcoded Hex Colors: ⛔ 35+ violations in screens, 13+ in components

**Screen violations (35+):**

| File | Count | Primary Offenders |
|------|-------|--------------------|
| `HomeFeedScreen.tsx` | 4 | `#FFFFFF` in late-night theme tints |
| `HomeMapScreen.tsx` | 3 | `#10B981`, `#F59E0B`, `#EF4444` busyness colors |
| `CraveScreen.tsx` | 7 | `#FFFFFF` throughout entire screen |
| `DiscoverHomeScreen.tsx` | 7 | `#FFFFFF` in late-night conditional paths |
| `LoginScreen.tsx` | 1 | `#FFFFFF` on button icon |
| `WheelSpinScreen.tsx` | 2 | `#FFFFFF` on button text/icon |
| `WheelEntryAddSheet.tsx` | 1 | `#FFFFFF` on category chip text |
| `ReadsFeedScreen.tsx` | 1 | `#FFFFFF` on featured card |
| `StallDetailScreen.tsx` | 2 | `#FFFFFF` on heart icon, `#F3F4F6` hardcoded border |
| `DishDetailScreen.tsx` | 3 | `#FFFFFF` on rating badge, gallery dots |
| `ProfileHomeScreen.tsx` | 2 | `#3B82F6`, `#10B981` taste bar colors |
| `NotFoundScreen.tsx` | 1 | `#FFFFFF` in orange tint |

**Component violations (13+):**

| File | Count | Offenders |
|------|-------|-----------|
| `AppText.tsx` | 1 | `#FFFFFF` for inverse text |
| `Button.tsx` | 1 | `#FFFFFF` for primary variant text |
| `FloatingToast.tsx` | 5 | `#FFFFFF` for all toast icon/text |
| `DeliveryPlatformButton.tsx` | 3 | `#00B14F` (Grab), `#D70F64` (Foodpanda), `#00CCBC` (Deliveroo) + `#FFFFFF` |
| `MemberAvatarRow.tsx` | 1 | `#FFFFFF` for host text |
| `WheelSvg.tsx` | 1 | `#FFFFFF` for alternating segment text |

**Assessment:** The delivery brand colors (`#00B14F`, etc.) are arguably acceptable as external brand constants — but they should be extracted into named constants, not inline hex. The `#FFFFFF` usage is systemic: the token system needs a `palette.white` / `palette.textOnPrimary` / `palette.textOnDark` token.

#### Hardcoded Border Radius: ⚠️ 14 violations in screens, 4 in components

Notable: `borderRadius: 32` in CraveScreen, `borderRadius: 999` in TasteQuizScreen, various `26`, `28`, `20` values scattered across screens.

#### Hardcoded Spacing: ⚠️ 8 violations in screens

Including `padding: 0` in Cards (acceptable reset), `padding: 24` in CraveScreen, `padding: 8` in FoodSelection back button, `padding: 4` in SearchResults.

#### Raw `<Text>` Usage: ✅ PASS

Zero violations — all text uses `<AppText>`.

#### Inline `fontFamily`: ⚠️ 20+ violations

Many screens directly specify `fontFamily: "Nunito_700Bold"` or `fontFamily: "Nunito_800ExtraBold"` instead of using AppText variants. This is a design system leak — font weight should be controlled through `variant` or `style.fontWeight`, not raw fontFamily strings.

---

## Phase 2: Backlog Hygiene

---

### 2.1 — Backlog Truthfulness Audit

The current `tasks/todo.md` claims **all P0, P1, P2 items are Done** with Phase 2 Done Criteria (`P2-DC1`, `P2-DC2`) verified. This conflicts with reality:

| Claim | Reality | Verdict |
|-------|---------|---------|
| `npm run typecheck` — passing | **25 errors across 7 files** | ⛔ FALSE |
| P2-42 "removed `useNavigation<any>()`" — Done | **8 callsites remain** | ⛔ FALSE |
| P1-ARCH-07 "migrated core feature/store code to provider-backed data access" — Done | **20 screens still import `mockRepository` directly** | ⛔ FALSE |
| P2-DC1 "full mock-mode closure pass" — Done | Service provider bypass undermines this claim | ⚠️ PARTIALLY FALSE |
| "Tokenization of remaining hardcoded values complete (P2-55–P2-57)" | 25 type errors introduced by tokenization in component StyleSheet blocks | ⛔ REGRESSED |

### 2.2 — Items to REOPEN (Proven Regressions)

| ID | Item | Evidence |
|----|------|----------|
| **P2-42** | `useNavigation<any>()` removal | 8 callsites found via grep |
| **P1-ARCH-07** | Service provider migration | 20 screen files still import `mockRepository` directly |
| **P2-55/P2-56/P2-57** | Tokenization of shadows/z-index/motion | 25 typecheck errors from tokens used at module scope |
| **P2-DC2** | Verification gates green | `typecheck` is RED |

### 2.3 — New Issues Discovered

| New ID | Severity | Area | Issue |
|--------|----------|------|-------|
| **P0-18** | ⛔ P0 | Build | 25 TypeScript compilation errors. App cannot build. |
| **P1-49** | ⚠️ P1 | Home | DirectMessages screen is a dead end with inline hardcoded data. Remove or feature-flag. |
| **P1-50** | ⚠️ P1 | Home | Comments sheet is a placeholder. Should either be removed or properly stubbed with feature flag. |
| **P1-51** | ⚠️ P1 | Profile | "Detailed Analysis" card and "Recently saved" cards have no `onPress` — dead tap targets. |
| **P1-52** | ⚠️ P1 | Crave | Info button `(i)` has no onPress handler. |
| **P1-53** | ⚠️ P1 | Profile | Hardcoded "Level 12 • Foodie Scout" and analytics prose in ProfileHome. |
| **P2-58** | 🟡 P2 | Design System | `palette.white` / `palette.textOnPrimary` token missing — 35+ `#FFFFFF` violations. |
| **P2-59** | 🟡 P2 | Design System | Delivery brand colors need named constants, not inline hex. |
| **P2-60** | 🟡 P2 | Design System | Busyness indicator colors need palette tokens (`palette.statusFast`, etc.). |
| **P2-61** | 🟡 P2 | Tokens | `spacing[0.5]` used in BiteCard but key doesn't exist in spacing scale. |
| **P2-62** | 🟡 P2 | Security | `DeveloperLauncherScreen` route registered in production stack (deep link risk). |
| **P2-63** | 🟡 P2 | Hardcoded Copy | "Tanjong Pagar · 14 nearby" and "Tanjong Pagar" hardcoded on Home and Discover. |

---

## Phase 3: Production Transition Strategy

---

### 3.1 — Prerequisite: Stabilize Before Transitioning

> [!IMPORTANT]
> No production transition work should begin until:
> 1. All 25 typecheck errors are fixed
> 2. All 20 screens are migrated off direct `mockRepository` imports
> 3. The 8 `useNavigation<any>()` callsites are typed
> 4. Dead-end features (DMs, Comments, info buttons) are either removed or feature-flagged

**Estimated effort:** 2–3 focused engineering days.

---

### 3.2 — Analytics & Telemetry (PostHog Integration)

#### Current State
- Analytics module exists at `src/lib/analytics/` with a mock sink (console.info in `__DEV__`).
- Event taxonomy is defined (33 named events in P1-03).
- Event buffer exists with 500-record cap and swappable sink.

#### Integration Strategy

```
Phase 1: SDK Installation + Init
────────────────────────────────
1. Install: `npx expo install posthog-react-native`
2. Create: `src/lib/analytics/posthogSink.ts`
   - Initialize PostHog client with project API key from env
   - Implement sink that maps AnalyticsEventRecord → PostHog.capture()
3. Wire: In `App.tsx` bootstrap, call `setAnalyticsSink(posthogSink)` 
   to replace the mock console sink. Single line change.
4. Env: Add `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` to `.env`

Phase 2: Identity Linking
────────────────────────
5. On `sign_in_completed` / `sign_up_completed`: call PostHog.identify(userId)
6. On `sign_out`: call PostHog.reset()
7. Set user properties: tasteVector, dietaryPreferences, location (area)

Phase 3: Core Funnel Events (must ship for launch)
──────────────────────────────────────────────────
Priority 1 (activation funnel):
  - app_launched → onboarding_started → taste_quiz_completed → onboarding_completed
Priority 2 (engagement loop):
  - search_submitted → dish_viewed → delivery_link_tapped
  - decide_for_me_triggered → decide_for_me_result_shown
  - dish_favourited
Priority 3 (retention signals):
  - review_started → review_submitted
  - wheel_party_created → wheel_party_resolved
```

**Effort:** 1–2 days. The existing analytics architecture means this is purely a sink swap.

---

### 3.3 — Backend Database Migration Path

#### Current Architecture
```
Screen → mockRepository (direct) → mock/data.ts (static fixtures)
Screen → Store → serviceProvider.repository → mockRepository → mock/data.ts
```

#### Target Architecture
```
Screen → Store → serviceProvider.repository → supabaseRepository → Supabase REST/RPC
```

#### Step-by-Step Migration

```
Step 1: Complete the Service Provider Migration (PREREQUISITE)
─────────────────────────────────────────────────────────────
- Migrate all 20 screens off direct mockRepository imports
- All data access must go through getDataRepository() or stores
- Estimated: 1–2 days

Step 2: Create Supabase Project & Schema
────────────────────────────────────────
- Provision Supabase project (Singapore region: ap-southeast-1)
- Run the DDL from backend-architecture.md (already written)
- Enable PostGIS, pgvector, pg_trgm extensions
- Seed from mock/data.ts → Supabase migration script
- Estimated: 1 day

Step 3: Implement supabaseRepository (DataRepository interface)
──────────────────────────────────────────────────────────────
- Create: src/lib/services/supabase/supabaseRepository.ts
- Implement each DataRepository method against Supabase client
- Map SQL results to existing TypeScript domain types
- Estimated: 3–4 days

Step 4: Implement supabaseService (HungryService interface)
──────────────────────────────────────────────────────────
- Create: src/lib/services/supabase/supabaseService.ts
- Wire auth methods to Supabase Auth
- Wire discovery/reviews/profile/social/content/ai methods
- Estimated: 4–5 days

Step 5: Swap the Provider
─────────────────────────
- In serviceProvider.ts: import supabaseService instead of mockService
- Single-file change if Steps 1–4 are done correctly
- Feature flag: env variable HUNGRY_DATA_SOURCE=mock|supabase

Step 6: Auth Token Security
───────────────────────────
- Install expo-secure-store
- Migrate session token persistence from AsyncStorage to SecureStore
- Supabase Auth tokens (JWT + refresh) stored encrypted on-device

Step 7: Media Pipeline
──────────────────────
- Review photos: upload to Supabase Storage → get CDN URL
- Avatar photos: same pipeline
- Signed upload URLs from server (never direct client upload)
```

**Database Already Designed:** The [backend-architecture.md](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/.claude/worktrees/recursing-moser/tasks/backend-architecture.md) contains a production-grade PostgreSQL schema with 30+ tables, PostGIS indexing, pgvector HNSW indexes for taste matching, full commerce flow, and messaging support. This is ready to deploy.

---

### 3.4 — Launch Readiness Checklist

| Category | Required | Current State |
|----------|----------|---------------|
| **CI/CD Pipeline** | GitHub Actions: typecheck → test → expo-doctor → EAS build | ⛔ Not configured |
| **Crash Reporting** | Sentry SDK (`@sentry/react-native`) | ⛔ Not installed |
| **Error Monitoring** | Sentry or Bugsnag for JS/native errors | ⛔ Not installed |
| **Analytics** | PostHog or Amplitude | ⚠️ Mock sink only |
| **Environment Variables** | `.env.development`, `.env.staging`, `.env.production` | ⚠️ Single `.env` file |
| **Secure Storage** | `expo-secure-store` for auth tokens | ⛔ Not installed |
| **EAS Build Profiles** | `eas.json` with dev/preview/production channels | ✅ Exists |
| **OTA Updates** | `expo-updates` configured with channels | ✅ Installed, needs project linking |
| **App Store Assets** | Screenshots, descriptions, keywords | ⛔ Not prepared |
| **Privacy Policy** | Required for App Store / Play Store | ⛔ Not created |
| **Terms of Service** | Required for App Store / Play Store | ⛔ Not created |
| **Deep Linking** | `hungry://` scheme, `https://hungry.sg` prefix configured | ✅ Configured |
| **Launch Feature Flags** | Remote config for kill switches | ⚠️ Hardcoded in `featureFlags.ts` |
| **Rate Limiting** | API-side throttling for review/auth/order endpoints | ⛔ Backend needed |
| **Input Sanitization** | Search query, review text, caption length guards | ⚠️ Client-side only |
| **Accessibility** | VoiceOver / TalkBack audit | ⚠️ Partial (some a11y labels in place) |
| **Performance** | Render profiling, list virtualization audit | ⛔ Not conducted |
| **Offline Handling** | Graceful degradation with real network | ⚠️ Mock-only tested |

#### CI/CD Pipeline Recommendation

```yaml
# .github/workflows/ci.yml
name: Hungry CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npx expo-doctor --non-interactive
  
  build-preview:
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: expo/expo-github-action@v8
        with: { eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: eas build --platform all --profile preview --non-interactive
```

#### Crash Reporting Setup

```bash
npx expo install @sentry/react-native
```

Initialize in `App.tsx` with DSN from environment variable. Wrap `ErrorBoundary` at root level. Map source maps in EAS build hooks.

---

## Overall Architecture Scorecard

| Dimension | Grade | Notes |
|-----------|-------|-------|
| **Type Safety** | D | 25 errors, 8 `any` navigation casts, no strict enforcement |
| **Design System Compliance** | C | 35+ hex violations, 14+ radius violations, 20+ fontFamily leaks |
| **Service Layer Abstraction** | D | 75% of screens bypass the service provider |
| **Navigation Wiring** | B+ | All routes registered, auth guards work, deep linking configured |
| **State Management** | A- | Zustand stores well-structured, persistence in place, analytics hooks wired |
| **Mock Data Discipline** | B | Central data.ts exists, but DM screen has inline fixtures |
| **Security Posture** | C | No SecureStore, DeveloperLauncher exposed, .env properly gitignored |
| **Test Coverage** | C- | Basic unit tests exist but no screen/integration tests |
| **Documentation** | A | Excellent agent harness, data contracts, screen inventory, backend DDL |
| **Production Readiness** | F | No CI/CD, no crash reporting, no analytics, no legal pages |

---

## Recommended Execution Priority

```
IMMEDIATE (before any new feature work):
  1. Fix 25 typecheck errors                    (2 hours)
  2. Migrate 20 screens to serviceProvider      (1–2 days)
  3. Add palette.textOnPrimary token            (30 min)
  4. Remove/flag DMs, Comments, dead buttons    (2 hours)
  5. Remove hardcoded copy strings              (1 hour)
  6. Type all navigation hooks                  (1 hour)

NEXT SPRINT (production infrastructure):
  7. Install + configure Sentry                 (2 hours)
  8. Install + configure PostHog                (4 hours)
  9. Set up GitHub Actions CI                   (2 hours)
  10. Install expo-secure-store                 (1 hour)
  11. Environment variable management            (1 hour)

BACKEND SPRINT:
  12. Provision Supabase + deploy schema         (1 day)
  13. Implement supabaseRepository               (3–4 days)
  14. Implement supabaseService                  (4–5 days)
  15. Provider swap + integration testing        (2 days)
```

---

> [!WARNING]
> **This report is based on code inspection, grep analysis, and build verification — not runtime testing.** Several items (e.g., Wheel flow completeness, map interaction fidelity, onboarding visual state) require simulator/device verification to fully assess. The typecheck failure alone blocks any runtime testing of the current branch.
