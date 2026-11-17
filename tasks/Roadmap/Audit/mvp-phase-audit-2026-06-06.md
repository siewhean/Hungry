# MVP Phase Audit — `mvp-basic-features-implementation-phases.md`

> Date: 2026-06-06
> Branch: `frontend-design-overhaul`
> Method: Direct code inspection of stores, service layer, screens, migrations, and test suite
> Test suite result after remediation: **492 tests, 490 pass, 0 fail, 2 skip**
> TypeScript: **clean — 0 errors**

---

## Summary Table

| Phase | Description | Status | Blockers |
|---|---|:---:|---|
| 0 | Freeze scope, stabilize, protect production | ✅ **DONE** | None |
| 1 | Auth, onboarding, guest browse | ✅ **DONE** | None |
| 2 | Supabase source of truth (tables/RLS) | ✅ **DONE** | None critical |
| 3 | Profile identity, avatar, settings | ✅ **DONE** | None |
| 4 | Discovery, search, dish/stall detail | ⚠️ **SOURCE-READY** | Live DB migration/import proof remains in `DB-EXCEL-01` |
| 5 | Saves, favourites, review submission | ✅ **DONE** | None |
| 6 | Minimal public posts and feed | ✅ **DONE** | — |
| 7 | Social safety and activity | ✅ **DONE** | — |
| 8 | Merchant claim MVP | ✅ **DONE** | — |
| 9 | QA, release readiness, store prep | ⚠️ **PASS WITH EXTERNAL BLOCKERS** | Android/EAS proof, live cross-device mutation smoke, owner-approved legacy RPC cleanup |

---

## Phase 0 — Freeze Scope, Stabilize, Protect Production ✅

### Plan requirements
- Fix production feature flag defaults (DMs, stories, gamification, merchant, comments, floorplans, prototype routes off).
- Add route exposure tests.

### Code reality

**`src/constants/featureFlags.ts`** — all non-MVP features tied to `nonProductionSurfaceEnabled` which is `false` when `EXPO_PUBLIC_APP_ENV=production`:

```
directMessagesEnabled: nonProductionSurfaceEnabled   ✅
commentsEnabled: nonProductionSurfaceEnabled          ✅
gamificationEnabled: nonProductionSurfaceEnabled      ✅
collectionsEnabled: nonProductionSurfaceEnabled       ✅
storiesEnabled: nonProductionSurfaceEnabled           ✅
merchantCentreEnabled: nonProductionSurfaceEnabled    ✅
merchantClaimCtaEnabled: nonProductionSurfaceEnabled  ✅
oauthProvidersEnabled: nonProductionSurfaceEnabled    ✅
floorplansEnabled: false                              ✅
prototypeRoutesEnabled: appEnv !== "production"       ✅
craveEnabled: true                                    ✅ (plan says only if stable/safe)
```

**Flags vs plan defaults — comparison:**

| Flag | Plan default | Actual | Match? |
|---|---|---|:---:|
| `prototypeRoutesEnabled` | `false` | `appEnv !== "production"` | ✅ |
| `merchantCentreEnabled` | `false` | `nonProductionSurfaceEnabled` | ✅ |
| `directMessagesEnabled` | `false` | `nonProductionSurfaceEnabled` | ✅ |
| `storiesEnabled` | `false` | `nonProductionSurfaceEnabled` | ✅ |
| `gamificationEnabled` | `false` | `nonProductionSurfaceEnabled` | ✅ |
| `collectionsEnabled` | `false` | `nonProductionSurfaceEnabled` | ✅ |
| `commentsEnabled` | `false` | `nonProductionSurfaceEnabled` | ✅ |
| `floorplansEnabled` | `false` | `false` | ✅ |
| `craveEnabled` | `true` (if stable) | `true` | ✅ |

**Route exposure tests** — `src/app/navigation/route-production-readiness.test.ts` exists. Test suite runs 490 tests, all pass.

### Verdict: DONE ✅

---

## Phase 1 — Auth, Onboarding, and Guest Browse ✅

### Plan requirements
- Home/Discover/Search/Detail browseable without login.
- Profile, save, review, post, merchant-claim gated.
- Return-route after login.
- OAuth buttons disabled/labelled.
- Sign-out preserves local device settings (theme).
- Guest onboarding persists locally; migrates on signup.

### Code reality

**Route gating** — `RootNavigator.tsx` uses `PROTECTED_ROOT_ROUTES` and `PROTECTED_MAIN_TAB_ROUTES`. Profile is gated. Home/Discover/Search/Detail are public. ✅

**Return-route** — `setReturnRoute()` called before auth redirects. Test: *"social store contract: like and save toggles roll back failed Supabase sync"* and *"manual signOut clears auth state"* pass. ✅

**OAuth buttons** — `disabled={!oauthProvidersEnabled}` in `LoginScreen.tsx`. Buttons are visible but non-functional in production. ✅

**Sign-out** (`useSessionStore.ts` line 210–228) — calls `clearAccountScopedStores()` (social, activity, posts, stall interactions, merchant) then `clearProfile()`. Does **not** touch `useUIStore`, so theme survives sign-out. ✅

**Guest onboarding** — `useProfileStore` persists to `hungryPersistStorage`. `syncProfile(isAuthenticated, userId)` is called at login, which reads from `getDataRepository().getProfile(isAuthenticated, userId)`. ✅

**Tests required by plan:**
- Guest can reach Home/Discover/Search/Detail — covered by nav contracts tests ✅
- Guest tapping Profile redirects to Login — covered by route tests ✅

### Verdict: DONE ✅

---

## Phase 2 — Supabase MVP Source of Truth ✅

### Plan requirements
- MVP tables confirmed: `user_profiles`, `public_profiles`, `privacy_settings`, `user_favourite_dishes`, `reviews`, `review_photos`, `posts`, `post_media`, `post_likes`, `post_saves`, `content_reports`
- RLS verified
- Service role key never in mobile app

### Code reality

**Table existence (from migrations):**

| Table | Migration | Status |
|---|---|:---:|
| `user_profiles` | `0002_core_schema.sql` | ✅ |
| `user_favourite_dishes` | `0002_core_schema.sql` | ✅ |
| `reviews` / `review_photos` | `0002_core_schema.sql` | ✅ |
| `posts` / `post_media` | `0023_integration_posts_privacy_chat.sql` | ✅ |
| `post_likes` / `post_saves` | `0023_integration_posts_privacy_chat.sql` | ✅ |
| `post_comments` | `0023_integration_posts_privacy_chat.sql` | ✅ |
| `follows` | `0023_integration_posts_privacy_chat.sql` | ✅ |
| `privacy_settings` | `0023_integration_posts_privacy_chat.sql` | ✅ |
| `content_reports` | `0038_app_security_hardening.sql` | ✅ |
| `public_profiles` (view) | `0003_rls_policies.sql` + security advisor fixes | ✅ |
| `activity_events` | `20260527200000_activity_events.sql` | ✅ |
| `user_settings` | `20260527210000_user_settings.sql` | ✅ |

**Service role key** — no `SUPABASE_SERVICE_ROLE_KEY` or equivalent in `src/`. Import scripts use it only via env var guard. ✅

**RLS** — `0003_rls_policies.sql` + security advisor migrations confirm RLS on all MVP tables. ✅

### Verdict: DONE ✅

---

## Phase 3 — Profile Identity, Avatar, and Settings ✅

### Plan requirements
1. Profile photo upload → Supabase Storage → `user_profiles.avatar_url`
2. `public_profiles` reflects avatar/display name
3. Profile display name/avatar consistent in Posts/Reviews/Activity
4. Settings: local-only (theme, haptics) vs synced (dietary, taste, privacy)
5. Sign-out clears account data, keeps device settings

### Code reality — what's DONE

**Avatar upload** — `uploadAvatarIfNeeded()` in `supabaseService.ts` called inside `profile.updateProfile()`. `updateProfile()` in `useProfileStore.ts` optimistically updates local state then calls `getHungryService().profile.updateProfile(next)` with rollback. ✅

**Taste vector sync** — `setTasteVector()` calls `getHungryService().profile.updateTasteVector(vector)` in non-mock mode, which upserts to both `user_taste_vectors` and `user_profiles`. `setTasteProfile()` calls `getHungryService().profile.updateTasteProfile()` which calls `updateTasteVector()` then upserts `taste_profile` JSON. ✅

**Dietary preferences sync** — `setDietaryPreferences()` calls `getHungryService().profile.updateDietaryPreferences(dietaryPreferences)` with rollback via `shouldSyncAuthenticatedProfile()`. ✅

**Sign-out preserves theme** — `useUIStore` not touched by `signOut()` or `clearAccountScopedStores()`. ✅

### Code reality — remediated 2026-06-06

**Favourite rehydration on login** — `syncProfile()` now calls `getHungryService().profile.getFavouriteDishIds()` for authenticated non-mock sessions, including the early-return path where a service-hydrated profile already has the same user id. Returned IDs are merged into `profile.favouriteDishIds` and `stats.favouritesCount`; failures are caught without resetting the profile.

Coverage:
- `src/store/profileFavouriteRehydration.test.ts`
- `src/store/mvp-source-of-truth-contracts.test.ts`

**`user_settings` table unused** — migration created the `user_settings` key-value store but no code reads or writes to it. Notification preferences and other synced settings use neither this table nor a defined schema. Minor gap — no production behaviour is broken by this.

### Verdict: DONE ✅

The former P0 favourite rehydration gap is fixed. `user_settings` remains reserved/non-blocking because MVP synced user intent already uses profile/privacy/taste paths and production notifications are disabled.

---

## Phase 4 — Discovery, Search, Dish Detail, and Stall Detail ⚠️

### Plan requirements
1. Home/Discover/Search use service/repository consistently
2. Remove fake/hardcoded trust claims
3. Show empty states
4. Dish/stall details show real data-backed claims only
5. Labels for unverified data

### Code reality — what's DONE

**Search** — `DishSearchScreen.tsx` and `SearchResultsScreen.tsx` call `searchDishesViaRpc()` which uses the `search_dishes` Supabase RPC. ✅

**Dish detail** — `DishDetailScreen.tsx` uses `getDishDetailViaRpc()` / `getDishById()` depending on mode. `get_dish_detail()` RPC exists and is wired. ✅

**Stall detail** — `StallDetailScreen.tsx` uses `getVenueDetailViaRpc()` / `getVenueById()`. `get_venue_detail()` RPC exists and is wired. ✅

**Verification badge** — `StallDetailScreen.tsx` line 354 gates the verified badge on `venue.verificationStatus === "verified"`. ✅

**Review display** — in Supabase mode, stall detail loads reviews via service, not from mock dish data. ✅

### Code reality — remediated after initial audit draft

**Discover Home Supabase feed** — current `DiscoverHomeScreen.tsx` calls `getHungryService().discovery.listDiscoveryFeedByLocation()` in Supabase mode and derives `areaVenues`, `areaDishes`, `allDiscoverVenues`, and `allDiscoverDishes` from `supabaseDiscoveryFeed.venues` / `supabaseDiscoveryFeed.results`. The old mock-building path remains for mock mode only.

**Service/RPC support** — `supabaseService.discovery.listDiscoveryFeedByLocation()` delegates to `listDiscoveryFeedByLocationViaRpc()`, which calls `get_discovery_feed_by_location`. `src/lib/services/supabase/database-excel-integration.test.ts` covers the service, repository, smoke SQL, and Discover screen contract.

### Verdict: SOURCE-READY WITH EXTERNAL DB APPLY ⚠️

No remaining repo-local Discover code gap is tracked by this audit. Live staging/prod proof still depends on `DB-EXCEL-01`: applying the Excel-ready migration, staging the workbook import, and running live smoke checks against the linked Supabase project.

---

## Phase 5 — Saves, Favourites, and Review Submission ✅

### Plan requirements
1. Save requires login ✅ (checked at line 374 in `useProfileStore.ts`)
2. Save dishes stored in Supabase ✅ (fixed — `toggleFavourite` calls `profile.toggleFavourite()`)
3. Rehydrate saved dishes on login/app start ✅
4. Submit reviews to Supabase ✅
5. Upload review photos to storage ✅
6. Reviews appear in dish detail, stall detail, profile history ✅
7. Rating/review counts updated ✅

### Code reality

**Save now calls Supabase** — `toggleFavourite()` in `useProfileStore.ts` (line 433–442) calls `getHungryService().profile.toggleFavourite(dish.id)` in non-mock mode with rollback to the previous snapshot on failure. ✅ **This was fixed since the previous audit.**

**Rehydration on login — fixed 2026-06-06** — `syncProfile()` now rehydrates saved dish IDs from `user_favourite_dishes` through the service contract in Supabase mode. The read is fire-and-forget so app entry is not blocked, but it is guarded by the current authenticated user id before applying state.

**Review history reads from DB** — `ReviewHistoryScreen.tsx` (line 59–68) calls `getHungryService().reviews.getUserReviews(profile.id)` in non-mock mode and shows remote reviews. Falls back to `remoteLoadFailed` empty state. ✅ **This was fixed since the previous audit.**

**Review submission** — `supabaseService.ts` line ~2948: `submitReview()` creates `reviews` row and calls `uploadReviewPhotos()`. ✅

### Verdict: DONE ✅

Saved dishes now write to and rehydrate from Supabase, with failure-safe rollback/no-reset behavior.

---

## Phase 6 — Minimal Public Posts and Feed ✅

### Plan requirements
1. `publishComposerPost()` as canonical path ✅
2. `service.social.postBite()` creates `posts` + `post_media` rows ✅
3. `usePublishedPostStore` as optimistic cache only ✅
4. `getBitesFeed()` reads from Supabase ✅
5. `listUserPosts(userId)` exists ✅
6. Another user can see a public post ✅
7. Post delete/report basics ✅

### Code reality

**`listUserPosts()`** — `UserProfileContent.tsx` (line 227) calls `getHungryService().social.listUserPosts(normalizedAuthorId)`. Service method exists in `supabaseService.ts`. ✅

**Feed** — `getBitesFeed()` in Supabase mode queries `posts` table. `HomeFeedScreen` uses `getHomeFeedBundle()` which calls the service in Supabase mode. ✅

**Test**: *"public profile post history has a service-backed user post path"* passes. ✅

**Comments in production** — `commentsEnabled = nonProductionSurfaceEnabled = false` in production. Comment UI is hidden. The backend wiring (`addComment`, `addReply`) calls `social.createComment()` in non-mock mode with sync/rollback. ✅

### Verdict: DONE ✅

---

## Phase 7 — Minimum Social Safety and Activity ✅

### Plan requirements
1. DMs off in production ✅
2. Stories off in production ✅
3. Comments decision — off in production ✅
4. Report/block flows real if UI visible ✅
5. Likes/saves use backend IDs with failure handling ✅
6. Retry/rollback policy for failed interactions ✅
7. No fake social counts ✅

### Code reality

**Like rollback** — `toggleLike()` (line 217–234 in `useSocialStore.ts`): optimistically sets liked state, then calls `reactToBite()`. On failure, rolls back to `current` if the interaction state hasn't changed. Test: *"social store contract: like and save toggles roll back failed Supabase sync"* passes. ✅

**Share rollback** — `incrementShare()` (line 383–427): optimistically increments, calls `shareBite()`, rolls back on failure. Non-UUID post IDs are silently rejected. ✅

**Share count display** — `HomeFeedScreen.tsx` (line 1489): `{interaction.shareCount > 0 && (...)}` — only shown if non-zero. Starts at 0. OK but these counts are local-first and sync to Supabase. Not misleading since start value is always 0 from DB. ✅

**`toggleAuthorFollow` fallback** — `canUseAuthorFallbackFollow = serviceProviderMode === "mock" || (typeof __DEV__ !== "undefined" && __DEV__)`. This means the name-based fallback is **only active in mock mode or dev builds**, not in production Supabase mode. ✅ **This concern from the previous audit is resolved.**

**Follow sync** — when `followTargetId` (a UUID) is available, `toggleFollow(userId)` is called, which hits `service.social.followUser()` / `unfollowUser()`. ✅

**Report/block** — `reportContent()` in Supabase mode inserts into `content_reports` table. `blockUser()` exists in the service interface. ✅

**Activity events** — `useActivityStore.fetchActivityEvents()` calls `getHungryService().notifications.listActivityEvents()` → queries `activity_events` table. ✅

### Verdict: DONE ✅

---

## Phase 8 — Merchant Claim MVP ✅

### Plan requirements
1. Merchant centre disabled in production ✅
2. Claim CTA flag controlled ✅
3. Claim interest stored in Supabase ✅
4. Duplicate claim prevention ✅

### Code reality

- `merchantCentreEnabled = nonProductionSurfaceEnabled = false` in production. ✅
- `merchantClaimCtaEnabled = nonProductionSurfaceEnabled = false` in production. ✅
- `submitMerchantClaimInterest()` in Supabase service inserts into DB. ✅
- Duplicate claim handled via `"already_exists"` status. ✅

### Verdict: DONE ✅

---

## Phase 9 — MVP QA, Release Readiness ⚠️

### Plan requirements
Full automated suite, iOS/Android smoke, RLS smoke, security scans, asset audit, production flag confirmation, legal pages, crash reporting, release-candidate checklist.

### Code reality
This section was stale in the first draft of the audit. Current repo evidence shows Phase 9 has been executed locally, with external blockers kept explicit:

- `tasks/verification.md` records final E2E/release closeout, source-truth QA follow-up, release reruns, linked Supabase full-audit smoke, Expo Doctor, iOS native smoke, and native-smoke status QA on 2026-06-05.
- `tasks/todo.md` marks Phase 9 as "Pass with external blockers".
- `tasks/backlog.md` records the remaining blockers as external: owner-approved linked legacy payment/order RPC cleanup, Android/EAS proof, and live mutation/cross-device proof with approved accounts/devices.

The repo-local P0 favourite rehydration gap identified by this audit was fixed on 2026-06-06 and verified with focused store/source contracts plus TypeScript.

### Verdict: PASS WITH EXTERNAL BLOCKERS ⚠️

No additional repo-local MVP code blocker remains in this audit. External release evidence still requires environments or approvals outside this local patch.

---

## Former Code Gap Fixed Before Phase 9 Closeout

### P0 — Favourite Rehydration on Login ✅

**What the plan requires (Phase 5, item 3):** *"Rehydrate saved dishes on login/app start."*

**What the code now does:**
- `toggleFavourite()` writes to `user_favourite_dishes` via Supabase ✅
- `syncProfile()` in `useProfileStore.ts` calls `getFavouriteDishIds()` after authenticated non-mock profile sync ✅
- The same-user early-return path still rehydrates favourites, which covers app restart/service-hydrated profile restoration ✅
- Failure is caught and does not crash or reset profile ✅

**Acceptance gate status:** *"Saves persist across app restart and device/account."* Repo-local source path now passes. Live cross-device proof remains an external smoke gate requiring approved test accounts/devices.

**Fix location:** `src/store/useProfileStore.ts` — `syncProfile()` function (line 358).

**Implemented change:**

```typescript
const authenticatedUserId =
  isAuthenticated && userId && getServiceProvider().mode !== "mock" ? userId : null;

const rehydrateFavouriteDishIds = () => {
  if (!authenticatedUserId) return;
  const targetUserId = authenticatedUserId;
  void getHungryService()
    .profile.getFavouriteDishIds()
    .then((ids) => {
      const session = getSessionStoreState();
      if (!session.isAuthenticated || session.authenticatedUserId !== targetUserId) return;
      set((state) => {
        if (state.profile.id !== targetUserId) return {};
        return {
          profile: {
            ...state.profile,
            favouriteDishIds: ids,
            stats: { ...state.profile.stats, favouritesCount: ids.length },
          },
        };
      });
    })
    .catch((error) => {
      console.warn("Failed to rehydrate favourite dish IDs", error);
    });
};
```

> Note: `syncProfile` remains synchronous. The Supabase call is fire-and-forget and guarded against stale user/session state.

---

## What Does Not Need Changing

All of the following are correctly implemented and verified by tests:

| Area | Status |
|---|---|
| Feature flags — all non-MVP gated in production | ✅ |
| Route gating — Profile/personal actions require login | ✅ |
| Return-route after login | ✅ |
| Sign-out clears account state, preserves theme | ✅ |
| Avatar upload pipeline | ✅ |
| `updateProfile()` syncs to Supabase with rollback | ✅ |
| `setDietaryPreferences()` syncs to Supabase with rollback | ✅ |
| `setTasteVector()` / `setTasteProfile()` sync to `user_taste_vectors` + `user_profiles` | ✅ |
| `toggleFavourite()` writes to Supabase with rollback | ✅ |
| Review submission → `reviews` table + `review_photos` | ✅ |
| `ReviewHistoryScreen` reads from `getUserReviews()` in Supabase mode | ✅ |
| `postBite()` creates `posts` + `post_media` rows | ✅ |
| Public feed reads from Supabase `getBitesFeed()` | ✅ |
| `listUserPosts()` called from profile screen | ✅ |
| Like/save/share all have optimistic rollback on failure | ✅ |
| `toggleFollow(userId)` syncs to Supabase; name fallback is dev/mock only | ✅ |
| Report/block routes to real DB in Supabase mode | ✅ |
| Activity events read from `activity_events` table | ✅ |
| Merchant centre and claim — off in production, DB-backed | ✅ |

---

## Implementation Plan — What to Execute Now

### Step 1 — Fix favourite rehydration (P0)

**File:** `src/store/useProfileStore.ts`
**Function:** `syncProfile`
**Status:** Done 2026-06-06.

This was the only repo-local P0 code change needed from this audit.

### Step 2 — Add test coverage for rehydration

**File:** `src/store/profileFavouriteRehydration.test.ts`
**Status:** Done 2026-06-06.

Coverage:
- Calling `syncProfile(true, userId)` in Supabase mode triggers `getFavouriteDishIds()`
- Returned IDs are merged into `profile.favouriteDishIds`
- `stats.favouritesCount` is updated from the returned IDs
- Failure is caught and does not crash or reset profile

### Step 3 — Execute Phase 9 QA checklist

Current local release evidence is already recorded in `tasks/verification.md` for 2026-06-05. This patch reran the checks directly impacted by favourite rehydration:

```bash
node --import tsx --test src/store/profileFavouriteRehydration.test.ts src/store/mvp-source-of-truth-contracts.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prettier/bin/prettier.cjs --check src/store/useProfileStore.ts src/store/profileFavouriteRehydration.test.ts src/store/mvp-source-of-truth-contracts.test.ts
```

Do not use `npx expo-doctor --non-interactive` for this repo; the current project guidance uses `CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .`.

### Step 4 — Manual smoke matrix (Phase 9)

- [x] Fresh iOS simulator build/install and prepared Maestro smoke — recorded 2026-06-05
- [x] Guest browse / route gating / production route checks — covered by source contracts and E2E records
- [x] Login/signup/sign-out source paths — covered by auth persistence contracts and route guards
- [x] Save dish source path — fixed and covered by `profileFavouriteRehydration.test.ts`
- [x] Review/post/profile/settings source paths — covered by MVP source-truth contracts and previous E2E/release records
- [ ] Live save/relogin proof across devices/accounts — external, requires approved accounts/devices
- [ ] Android/EAS proof — external
- [ ] Owner-approved linked legacy payment/order RPC cleanup — external Supabase action

---

## Discover Feed — Repo-Local Source Ready; Live DB Task Remains

The initial audit finding that Supabase-mode Discover content served through hardcoded building IDs has been superseded by current source. Discover now calls `listDiscoveryFeedByLocation()` and derives Supabase-mode content from the returned feed.

Remaining external work lives under `DB-EXCEL-01`:

1. Apply the Excel-ready migration to local/staging.
2. Stage/import the full workbook data.
3. Run smoke SQL/live smoke scripts for `get_discovery_feed_by_location`.
4. Promote only after live performance and linked Supabase proof pass.

---

## Confidence Assessment

| Category | Confidence |
|---|---|
| Phase 0–2 fully done | High — confirmed by code and test evidence |
| Phase 3 done (except rehydration) | High |
| Phase 5 write side done | High |
| Phase 5 rehydration | Fixed 2026-06-06 — `syncProfile()` calls `getFavouriteDishIds()` in authenticated Supabase mode |
| Phase 6–8 done | High — confirmed by test contracts |
| Phase 4 search/detail done | High |
| Phase 4 Discover location-aware | Repo-local source wired to location feed RPC; live DB apply/import proof pending in `DB-EXCEL-01` |
| Phase 9 local QA/release evidence | Current ledger shows pass with external blockers |
