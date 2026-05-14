# Frontend Design Overhaul — Codex Review & Fix Brief

> Branch: `frontend-design-overhaul`  
> Base: `main`  
> Purpose: handoff brief for Codex to clean up, split, and fix the frontend overhaul branch.

---

## Executive Summary

The `frontend-design-overhaul` branch contains valuable visual and UX work, but it is **not merge-ready as-is**.

At review time, the branch was **53 commits ahead of `main` and 2 commits behind `main`**. It mixes mobile frontend changes, V2 prototype screens, root navigation changes, merchant mobile tabs, marketing web app files, generated floorplan assets, scripts, native/iOS changes, workflow docs, `.codex/skills`, and large build logs.

**Recommendation:** Do not merge this branch wholesale. Clean it, split it into smaller PRs, gate future/prototype routes, and remove hardcoded trust claims before promoting any V2 screens into production.

---

## Overall Grade

| Area | Grade | Notes |
|---|---:|---|
| Visual ambition | A- | Stronger, more modern food-app direction. |
| Product direction clarity | B- | Good consumer ideas, but merchant/social/marketing scope is mixed in. |
| Frontend implementation | B- | Good service-layer use in places; still has hardcoded trust claims and prototype leakage. |
| Navigation safety | C+ | Root navigator registers many V2/prototype routes. |
| Scope control | D | Too many unrelated workstreams in one branch. |
| Merge readiness | D+ | Needs cleanup, gating, test evidence, and split PRs. |
| Overall | C+ | Strong prototype branch; unsafe as one production merge. |

---

## Major Blockers Codex Should Fix

### 1. Branch scope is too broad

The branch currently mixes:

- Mobile frontend overhaul
- V2 prototype screens
- Merchant mobile tabs and merchant workflow screens
- Marketing web app
- Floorplan/generated assets
- Build logs
- Native iOS project changes
- Scripts and workflow docs
- `.codex/skills` additions

**Action:** Split or isolate unrelated work. Keep each PR focused.

Suggested split:

1. `mobile-ui-shell-navigation-v2`
2. `discover-search-v2`
3. `detail-screens-v2`
4. `activity-social-v2`
5. `merchant-mobile-prototype`
6. `marketing-web`
7. `floorplan-pipeline-assets`
8. `tooling-docs-skills-cleanup`

---

### 2. Remove generated and local artifacts

Remove these from the frontend branch unless intentionally source-controlled in a separate PR:

- `build.log`
- `build2.log`
- `build3.log`
- `scripts/floorplan/__pycache__/`
- `*.pyc`
- temporary floorplan files such as `*.tmp.json`
- duplicated stitch export screenshots / HTML if not needed by the app
- local one-off query scripts such as `query_supabase.ts` and `query_supabase2.ts`, unless formalized under `scripts/` with docs
- generated QA overlays unless part of a floorplan PR

---

### 3. Prototype routes are registered in production navigation

`RootNavigator.tsx` registers many V2/prototype/design routes at root level, including:

- `DiscoverV2`
- `DishDetailV2`
- `StallDetailV2`
- `BuildingDrillDownV2`
- `QuickReviewV2`
- `QuickBites`
- `SplashV2`
- `DesignGallery`
- `MerchantTabs`
- `ReviewFeedV2`
- `PostComposerV2`
- `VenueDirectory`
- `StoryViewer`
- `AddStory`

**Action:**

- Put prototype/design routes behind `__DEV__` or feature flags.
- Add a flag such as `FEATURE_FLAGS.designV2Enabled` if needed.
- Ensure production deep links cannot open unfinished prototype screens.
- Decide which V2 screens actually replace V1 screens.
- Remove duplicate public routes after promotion.

---

### 4. MerchantTabs are future-scope

The branch adds a full mobile merchant experience via `MerchantTabs.tsx`, including dashboard, menu, analytics, verification, OCR drafts, inbox, promotions, AI assistant, and settings.

This is useful as a prototype, but it conflicts with the product sequencing where merchant portal / QR ordering work is future-gated and should be a separate workstream.

**Action:** Choose one:

1. Remove `MerchantTabs` from this frontend branch.
2. Move it to a separate `merchant-mobile-prototype` branch.
3. Keep it registered only under `__DEV__` or staging-only feature flag.

Do **not** expose `MerchantTabs` in production consumer navigation.

---

### 5. Hardcoded trust claims must be removed before shipping

The V2 UI displays hardcoded or simulated trust signals. In a food app, these imply factual accuracy and should not ship unless data-backed.

Examples found:

- `Open until 2:00 pm`
- `4.7`
- `(312)`
- `80m away`
- `NEA`
- grade `A`
- `4.8 · 180 reviews`
- `Taste profile (from 312 reviews)`
- fake review text
- simulated stall-account state using `index % 2 === 0`

**Action:**

- Replace hardcoded values with real repository/service fields.
- If real data does not exist, hide the section or show neutral copy like `Hours unavailable`.
- Do not show NEA/health-grade-like claims unless the source is real, verified, and documented.
- Do not show fake review counts or fake reviews in production.
- Do not simulate verified merchant/stall status using array index logic.

---

### 6. Auth gating may be too aggressive

`AUTH_REQUIRED_ROUTES` appears to include broad discovery routes such as `MainTabs`, search, maps, and details.

Users should be able to browse before signing up.

**Action:** Rework route gating.

Public / browseable without auth:

- `MainTabs`
- Home
- Discover
- Search
- `SearchResults`
- `DishDetail`
- `StallDetail`
- `BlogPost`
- basic map/discovery surfaces if product wants signed-out browsing

Auth required:

- Create post
- Submit review
- Save/favourite action
- Messages/chat
- Private profile screens
- Merchant tools
- Claim stall
- Order/checkout/cart flows

Prefer action-level gates over blocking entire browse screens.

---

## Screen-Specific Notes

### `RootNavigator.tsx`

Good:

- Lazy route loading can reduce initial load.
- Dev-only `DeveloperLauncher` is safer than always registering it.
- Global hosts for toast, quick review, and review success are sensible.

Problems:

- Too many V2/prototype routes are root-registered.
- `AUTH_REQUIRED_ROUTES` is too broad.
- Uses `as any` in navigation reset paths.
- Includes `MerchantTabs` in root navigation.

Fixes:

- Gate V2/prototype routes.
- Tighten auth-required routes.
- Reduce avoidable `as any` casts.
- Move or gate merchant routes.

---

### `SwipeableTabNavigator.tsx`

Good:

- Modern tab shell.
- Center create action is strong.
- Preload-on-press is thoughtful.
- Profile/create actions handle signed-out redirect.

Risks:

- Uses Material Top Tabs as bottom tabs; needs gesture testing.
- Tab swipes may conflict with horizontal carousels.
- Create action points to `PostComposerV2`, which must be feature-gated or production-ready.
- Confirm `spacing[0.5]` exists in the theme scale.

Fixes:

- Run iOS and Android gesture smoke tests.
- Validate create auth redirect and return route.
- Confirm spacing token exists.
- Feature-gate `PostComposerV2` if not ready.

---

### `DiscoverHomeScreenV2.tsx`

Good:

- Stronger Discover hierarchy.
- Dynamic location subtitle direction is good.
- Intent chips are useful.
- Search reveal interaction is engaging.
- Large tap targets for stalls/restaurants and dishes are good.

Problems:

- Map access appears restricted to developer/merchant mode; normal consumers may be blocked from map discovery.
- Simulates stall account state with `index % 2 === 0`.
- Some open/status presentation can imply more data accuracy than exists.
- Width animation uses `useNativeDriver: false`; performance should be tested.
- Clean unused imports.

Fixes:

- Decide whether map should be public. If yes, remove developer/merchant-only gate.
- Remove simulated stall-account logic.
- Use real verification/status fields or hide badges.
- Add empty states for `popularNearby` and nearby stalls.
- Run low-end Android performance smoke.

---

### `StallDetailScreenV2.tsx`

Good:

- Stronger visual layout.
- Hero image, sticky bottom bar, delivery CTAs, dish carousel, save/share actions are good UX.
- Uses repository for venue/dishes.
- Uses safe delivery URL helper.

Problems:

- Returns `null` when venue is missing; should show NotFound/empty state.
- Hardcoded factual claims: hours, distance, rating, review count, NEA grade, taste percentages, review content.
- Save stall action actually toggles favourite on the lead dish.
- `See menu` / `See all 312` appear text-only and may not navigate.
- Uses hardcoded safe-area bottom padding `34`.

Fixes:

- Replace `return null` with proper NotFound handling.
- Remove or data-bind all trust claims.
- Implement real stall favourite if the label says Save stall; otherwise rename to Save top dish.
- Make `See menu` and `See all` actionable or remove them.
- Use `insets.bottom` for sticky bottom bar padding.

---

### `ActivityInboxScreen.tsx`

Good:

- Consolidates Messages and Updates well.
- Uses service layer for conversations.
- Handles loading, error, and empty states.
- Has accessibility roles and test IDs.

Problems:

- Still relies partly on static `ACTIVITY_UPDATES`.
- Hardcoded `#FFFFFF` in `unreadCountText` reintroduces design-token leakage.
- Calls `repository.listStallPosts()` while rendering updates; can be optimized.
- Messaging/social features need moderation and notification strategy before public launch.

Fixes:

- Replace hardcoded color with `palette.white` or `palette.textOnPrimary`.
- Memoize post lookup map instead of scanning repository per update row.
- Feature-gate messages if chat backend/moderation is not launch-ready.
- Add tests for unread/read state and chat navigation.

---

### `MerchantTabs.tsx`

Good as prototype:

- Thoughtful merchant information architecture.
- Merchant access gate exists.
- Mock merchant login is useful for local development.
- Verification-only screen gating is a good concept.

Problems for production branch:

- Future-scope relative to the consumer MVP.
- Uses `(navigation as any)` for auth navigation.
- Adds many merchant routes into mobile app shell.
- Needs full product/security/access-control review before production exposure.

Fixes:

- Move to separate PR or gate under `__DEV__` / staging-only flag.
- Do not expose merchant tabs to normal production consumers.
- Add product decision note: mobile merchant app vs standalone merchant web portal.

---

## Cleanup Checklist

Required before any merge:

- [ ] Rebase or merge latest `main`; resolve 2-commit drift.
- [ ] Remove build logs and generated local artifacts.
- [ ] Remove `__pycache__` and `.pyc` files.
- [ ] Split unrelated marketing web, floorplan, skills, docs, and native changes into separate branches/PRs.
- [ ] Gate all V2/prototype/design routes behind flags or `__DEV__`.
- [ ] Gate or remove `MerchantTabs` from production root navigation.
- [ ] Fix auth gating so public discovery remains browseable.
- [ ] Remove hardcoded trust claims from V2 screens.
- [ ] Replace hardcoded color literals with theme tokens.
- [ ] Replace missing-entity `return null` behavior with proper NotFound/empty states.
- [ ] Run typecheck, lint, tests, and Expo doctor.
- [ ] Add exact verification results to the session log.

---

## Suggested PR Breakdown

### PR 1 — Mobile shell and navigation V2

Include:

- `SwipeableTabNavigator.tsx`
- navigation type updates required for the shell
- create-button auth redirect logic
- route gating cleanup

Exclude:

- merchant tabs
- marketing web
- floorplans
- V2 detail screen promotion
- generated files

### PR 2 — Discover/Search V2

Include:

- `DiscoverHomeScreenV2.tsx`
- `DishSearchScreenV2.tsx`
- `QuickBitesScreen.tsx`
- `VenueDirectoryScreen.tsx`
- related tests

Required fixes:

- remove simulated stall account state
- add empty states
- decide whether map is public
- feature-flag until QA passes

### PR 3 — Detail V2

Include:

- `DishDetailScreenV2.tsx`
- `StallDetailScreenV2.tsx`
- merchant claim explainer only if needed

Required fixes:

- remove hardcoded ratings/reviews/hours/NEA/distance
- correct save semantics
- NotFound handling
- safe-area fixes

### PR 4 — Activity / social surface

Include:

- `ActivityInboxScreen.tsx`
- `ActivityPostDetailScreen.tsx`
- chat updates
- story/add-story only if feature-gated

Required fixes:

- remove hardcoded color
- optimize post lookup
- feature-gate social/chat if backend/moderation is not ready

### PR 5 — Merchant prototype

Include:

- `MerchantTabs.tsx`
- merchant screens
- merchant guards/store changes

Required constraints:

- dev-only or staging-only
- not production root navigation
- separate product decision on mobile merchant vs standalone web portal

### PR 6 — Marketing web

Include only:

- `marketing/web/**`
- related package files
- README/docs for running the site

### PR 7 — Floorplan pipeline

Include only:

- floorplan scripts
- source floorplan data
- final validated output files that are intentionally source-controlled
- QA overlay documentation

---

## Verification Commands

Run from repo root after cleanup:

```bash
npm run typecheck
npm run lint
npm run test
npx expo-doctor --non-interactive
```

If tests still fail because of the known Node / React Native transform issue, document the failure clearly and run targeted contract tests that are expected to pass.

Suggested targeted checks:

```bash
npx tsx --test src/app/navigation/nav-route-contracts.test.ts
npx tsx --test src/app/navigation/nav-activity-contracts.test.ts
npx tsx --test src/app/performance-prefetch-contracts.test.ts
```

Also run mobile smoke tests on at least iOS simulator and one Android target.

---

## Manual Smoke Matrix

Minimum QA before promoting any V2 screen:

- [ ] Fresh install opens correct first route.
- [ ] Signed-out user can browse Home, Discover, Search, Dish Detail, Stall Detail.
- [ ] Signed-out user tapping Create is sent to Login and returned correctly after auth.
- [ ] Signed-in user can switch and swipe all tabs.
- [ ] Horizontal carousels do not fight with tab swipes.
- [ ] Discover V2 search submit works.
- [ ] Discover V2 intent chips navigate correctly.
- [ ] Stall Detail V2 with valid `venueId` works.
- [ ] Stall Detail V2 with invalid `venueId` shows NotFound/empty state.
- [ ] Dish Detail V2 with valid and invalid IDs works.
- [ ] Offline route still works.
- [ ] Activity Inbox messages tab loads, error state works, empty state works.
- [ ] Activity Inbox updates can be marked read.
- [ ] MerchantTabs are inaccessible in production for normal users.
- [ ] DesignGallery and prototypes are not reachable in production.
- [ ] Deep links cannot open unfinished prototype routes in production.

---

## Codex Prompt

```text
You are reviewing the `frontend-design-overhaul` branch of the Hungry repo.

Goal: make the useful mobile frontend redesign work mergeable without shipping prototypes, future merchant scope, generated artifacts, or hardcoded trust claims.

First, clean the branch:
- remove build logs, pycache, temporary generated files, and unrelated local artifacts;
- separate marketing web, floorplan pipeline, merchant prototype, and docs/skills changes from the mobile frontend PR scope;
- rebase or merge latest main and resolve drift.

Then fix the mobile frontend blockers:
- gate V2/prototype/design routes behind `__DEV__` or feature flags;
- do not expose MerchantTabs in production consumer navigation;
- loosen auth gating so signed-out users can browse core discovery/detail surfaces;
- remove hardcoded factual trust claims from V2 screens;
- replace hardcoded colors with theme tokens;
- replace missing-entity `return null` behavior with proper NotFound/empty states;
- verify navigation type safety and remove avoidable `as any` casts.

After fixes, run:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npx expo-doctor --non-interactive`

Record exact verification results in the session log. Do not add new product features during this cleanup pass.
```

---

## Merge Recommendation

**Do not merge `frontend-design-overhaul` directly.**

Keep the design direction, but convert this branch into smaller, gated, testable PRs.

Suggested first merge candidate after cleanup:

1. `SwipeableTabNavigator` + safe auth-gated create action.
2. `DiscoverHomeScreenV2`, if hardcoded/simulated trust elements are removed.
3. `StallDetailScreenV2` / `DishDetailScreenV2`, only after trust claims are data-backed or hidden.

MerchantTabs, marketing web, and floorplan pipeline should be separate workstreams.
