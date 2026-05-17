# Frontend Design Overhaul — Batched Implementation Plan for Codex

> **Branch:** `frontend-design-overhaul`  
> **Purpose:** Convert the latest app review into an actionable batch-by-batch implementation plan.  
> **Primary goal:** Preserve the strong design/product work while reducing merge risk, production risk, and release risk.

---

## 1. Short Summary of the Review

The `frontend-design-overhaul` branch is significantly stronger than the earliest version of the overhaul, but it has widened again and should not be merged as one unreviewed block.

Current branch characteristics from the latest review:

- It is a strong staging/design-overhaul branch.
- It improves visual quality, navigation safety, feature-flag safety, CI, app polish, Discover/Search, Dish Detail, reviews, gamification, and merchant prototype surfaces.
- It is now broad again: mobile app code, auth UI, merchant screens, gamification/passport assets, marketing web assets, CI/security changes, iOS native changes, and many tests/assets are mixed together.
- The app direction is strong, but the branch should be treated as a release-candidate integration branch or split into focused PRs.

Overall latest grade:

| Area | Grade |
|---|---:|
| Product direction | A- |
| Visual quality | A |
| Consumer frontend | B+ |
| Navigation safety | B |
| Feature flag safety | B+ |
| Data trust | B |
| Merchant readiness | C+ |
| Social safety | C+ |
| QA/tooling | B+ |
| Scope control | C |
| Merge readiness | C+ |
| Production readiness | C+ |
| Overall branch grade | B- / B |

Main recommendation:

**Do not merge the whole branch as one PR unless it is treated as a formal release-candidate integration branch with full QA. Prefer splitting into focused batches and landing each safely.**

---

## 2. Implementation Strategy

Work in batches. Each batch should be independently reviewable, testable, and reversible.

General rules for Codex:

1. Do not add new features while doing cleanup.
2. Preserve the visual direction unless a change is required for safety, performance, or production readiness.
3. Keep production routes safe by default.
4. Put unfinished surfaces behind feature flags.
5. Record exact verification commands and results in `tasks/todo.md` or a session log.
6. Keep app, web, native, assets, security, and merchant work separated where possible.

---

# Batch 0 — Baseline Verification and Branch Hygiene

## Goal

Establish the real current state before changing anything.

## Why this matters

The branch has moved several times. Before implementing fixes, Codex should confirm whether `frontend-design-overhaul` is still 15 commits ahead / 1 behind and whether `main` already contains some of the work.

## Implementation

1. Rebase or merge latest `main` into `frontend-design-overhaul`.
2. Resolve the 1-commit drift.
3. Run the baseline commands before making code changes:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npx expo-doctor --non-interactive
```

4. Record results in `tasks/todo.md` session log.
5. Identify whether the branch is intended as:
   - focused PR branch, or
   - release-candidate integration branch.

## Files likely touched

- `tasks/todo.md`
- possibly conflict files from rebase/merge

## Done criteria

- Branch is up to date with `main`.
- Baseline verification is recorded.
- Any failing command is documented with cause and next fix.

---

# Batch 1 — Split Scope and Remove Merge Noise

## Goal

Reduce branch risk by separating unrelated workstreams.

## Current issue

The branch includes app code, auth UI, CI, iOS changes, security docs, marketing web assets, food/passport assets, merchant screens, search/profile/reviews, tests, and generated images.

## Implementation

Split into separate PRs or commits:

1. **App shell/navigation PR**
   - `RootNavigator.tsx`
   - `SwipeableTabNavigator.tsx`
   - feature flags
   - navigation tests

2. **Consumer UX PR**
   - Home
   - Discover
   - Search
   - Dish detail
   - Stall detail
   - Review feed

3. **Merchant prototype PR**
   - `MerchantTabs.tsx`
   - merchant screens
   - merchant readiness
   - merchant tests

4. **Gamification/passport PR**
   - Passport/Missions
   - passport assets
   - gamification tests

5. **Marketing web PR**
   - `marketing/website/**`
   - web food images
   - web deploy/build changes

6. **Native/iOS/build PR**
   - `ios/**`
   - `app.json`
   - Podfile / Podfile.lock
   - native build scripts

7. **Security/CI PR**
   - `.github/workflows/ci.yml`
   - `SECURITY.md`
   - security reports
   - security tests

## Cleanup checklist

Remove or move out of the mobile app PR:

- unrelated marketing website images
- unnecessary generated artifacts
- local-only logs
- one-off scripts not used by CI or app
- native project changes unless required for the mobile app PR

## Done criteria

- Each PR has one clear purpose.
- Mobile app PR no longer carries unrelated web/native/generated changes.
- Review burden is reduced.

---

# Batch 2 — Navigation, Feature Flags, and Route Safety

## Goal

Make route exposure safe in production and predictable in staging/dev.

## Current strengths

- `prototypeRoutesEnabled` exists.
- `merchantCentreEnabled` exists.
- `directMessagesEnabled` is false by default.
- `RootNavigator` protects Profile and action-heavy routes.

## Current concerns

- Root navigator is very large.
- Passport/Missions/Collections are registered outside the prototype route block.
- It is unclear whether gamification is production-ready.
- Need production deep-link tests.

## Implementation

1. Add or verify these flags in `src/constants/featureFlags.ts`:

```ts
gamificationEnabled
collectionsEnabled
prototypeRoutesEnabled
merchantCentreEnabled
directMessagesEnabled
commentsEnabled
```

2. Gate these routes if not production-ready:

- `PassportScreen`
- `MissionsScreen`
- `CollectionList`
- `CollectionDetail`
- `StoryViewer`
- `AddStory` if stories are not launch-ready

3. Add production flag tests:

- production must not register prototype routes
- production must not register merchant routes
- production must not register DMs
- production must not register gamification if `gamificationEnabled === false`

4. Add deep-link contract tests:

- prototype route deep links should not resolve in production
- merchant route deep links should not resolve in production
- protected routes should redirect to Login and preserve return route

## Files likely touched

- `src/constants/featureFlags.ts`
- `src/constants/featureFlags.test.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/nav-route-contracts.test.ts`
- `src/app/production-readiness-contracts.test.ts`

## Done criteria

- Production route surface is minimal and intentional.
- All non-launch-ready features are gated.
- Tests prove route safety.

---

# Batch 3 — App Shell and Tab Navigation QA

## Goal

Keep the new tab shell while proving it is stable across devices.

## Current strengths

- Center create button is strong UX.
- Deferred tab loading and skeleton placeholders improve performance.
- Preload warmup is thoughtful.

## Current concerns

- Material Top Tabs are used as bottom tabs.
- Swipe gestures may conflict with horizontal carousels.
- The app uses many horizontal rails.

## Implementation

1. Keep deferred tab loading but audit for flicker.
2. Confirm `spacing[0.5]` exists in the theme scale.
3. Add tests for:
   - signed-out create button redirects to Login
   - signed-in create opens correct composer based on feature flag
   - Profile tab redirects signed-out users to Login
   - Home/Discover/Review remain browseable signed-out

4. Manual QA matrix:
   - iOS tab taps
   - iOS tab swipes
   - Android tab taps
   - Android tab swipes
   - horizontal carousels inside Home/Discover/Review
   - back button behavior after composer/login redirects

## Files likely touched

- `src/app/navigation/SwipeableTabNavigator.tsx`
- `src/app/navigation/nav-route-contracts.test.ts`
- `src/app/native-smoke-contracts.test.ts`
- `src/theme/tokens.ts`

## Done criteria

- No swipe conflict on main screens.
- Create/Profile auth redirects work.
- No startup regression from deferred loading.

---

# Batch 4 — Core Consumer UX: Home, Discover, Search

## Goal

Make the core browse loop launch-ready.

## Sections covered

- Home feed
- Discover
- Search
- Browse dishes/stalls
- Quick Bites
- Collections

## Current strengths

- Discover is richer and more personalized.
- Search history and moving placeholders improve UX.
- Prefetching and image assets make browsing feel more premium.

## Current concerns

- Discover is now complex and performance-sensitive.
- Many new local image assets may increase bundle size.
- Search relevance still needs real-world validation.
- Empty states and no-result flows need polish.

## Implementation

1. Add no-data states for:
   - no nearby stalls
   - no popular dishes
   - no collections
   - no search results

2. Add performance checks for Discover:
   - render cost
   - image loading
   - scroll smoothness
   - first tab switch to Discover

3. Add analytics events:
   - discover opened
   - intent chip tapped
   - search launched from Discover
   - quick bite tapped
   - collection opened

4. Add prefetch validation:
   - pressing popular dish warms Dish Detail
   - pressing stall warms Stall Detail

5. Bundle-size audit:
   - review all `src/assets/discover/*.png`
   - keep only assets used by app
   - compress large images
   - consider remote/CDN assets if bundle grows too much

## Files likely touched

- `src/app/screens/home/HomeFeedScreen.tsx`
- `src/app/screens/discover/DiscoverHomeScreen.tsx`
- `src/app/screens/discover/DiscoverHomeScreenV2.tsx`
- `src/app/screens/discover/QuickBitesScreen.tsx`
- `src/app/screens/search/DishSearchScreen.tsx`
- `src/app/screens/search/SearchResultsScreen.tsx`
- `src/features/navigation/prefetch.ts`
- `src/assets/discover/**`

## Done criteria

- Signed-out user can browse from Home → Discover → Search → Detail.
- Empty states are graceful.
- No obvious scroll/performance issues.
- Asset usage is justified.

---

# Batch 5 — Detail Screens and Data Trust

## Goal

Ensure dish/stall detail screens only show data-backed claims.

## Current strengths

- Dish Detail V2 is now default for `DishDetail`.
- Stall Detail V2 is prototype-gated.
- Hardcoded trust claims were reduced.

## Current concerns

- Need final trust audit across both V1 and V2 detail screens.
- Save semantics need clarity: saving stall vs saving top dish.
- Review counts and ratings must come from real data.

## Implementation

1. Audit all detail screens for hardcoded factual claims:
   - ratings
   - review counts
   - operating hours
   - distance
   - verification status
   - wait time
   - NEA/regulatory labels
   - delivery availability

2. For each claim:
   - bind to real data, or
   - hide the claim, or
   - label as unavailable.

3. Fix save semantics:
   - if the UI says “Save stall”, implement saved stalls;
   - if saving a dish, label as “Save dish” or “Save top dish”.

4. Missing entity handling:
   - no `return null`
   - always render `EmptyState`, `NotFound`, or safe fallback

5. Add tests:
   - missing dish ID
   - missing stall ID
   - no reviews
   - no delivery links
   - closed venue

## Files likely touched

- `src/app/screens/detail/DishDetailScreen.tsx`
- `src/app/screens/detail/DishDetailScreenV2.tsx`
- `src/app/screens/detail/StallDetailScreen.tsx`
- `src/app/screens/detail/StallDetailScreenV2.tsx`
- `src/store/useProfileStore.ts`
- `src/types/domain.ts`

## Done criteria

- No fake trust claims remain.
- Missing data is handled honestly.
- Save actions match their labels.

---

# Batch 6 — Reviews, Comments, Posts, and Social Safety

## Goal

Make social features safe enough for staged beta.

## Current strengths

- Review Feed V2 is complete per task contract.
- Report/block actions exist.
- Comments and sharing are integrated.

## Current concerns

- Comments are enabled.
- Social interactions may still be local/mock-backed.
- Moderation workflow is incomplete.
- DMs are disabled but code exists.

## Implementation

1. Keep `directMessagesEnabled = false` in production.
2. Consider setting `commentsEnabled = false` in production until backend moderation is ready.
3. Implement or document moderation flows:
   - report review
   - report comment
   - block user
   - hide content after threshold
   - admin review queue

4. Review Feed count integrity:
   - do not seed interaction counts from ratings if shown as real counts
   - use backend counts or neutral defaults

5. Post Composer V2:
   - keep prototype-gated unless media upload, draft persistence, moderation, and publishing are real
   - clearly mark AI Creator Suite as mock/staging if not real

## Files likely touched

- `src/app/screens/review/ReviewFeedScreen.tsx`
- `src/app/screens/review/ReviewFeedScreenV2.tsx`
- `src/components/social/ReviewCommentsSheet.tsx`
- `src/app/screens/post/PostComposerScreenV2.tsx`
- `src/features/post/useComposerStore.ts`
- `src/constants/featureFlags.ts`
- `src/lib/security/communitySafety.ts`

## Done criteria

- Unsafe social features are gated.
- Report/block flows are not just UI decoration.
- Public launch does not expose unmoderated DMs.

---

# Batch 7 — Merchant Mode and Merchant Readiness

## Goal

Keep merchant mode useful for staging without accidentally shipping it as a full public merchant portal.

## Current strengths

- Merchant centre is gated by feature flag.
- Merchant screens are more complete.
- Merchant access gate exists.

## Current concerns

- Merchant Mode is a large product surface.
- Merchant Portal was originally future-gated.
- It overlaps with a possible standalone web merchant portal.

## Implementation

1. Keep `merchantCentreEnabled` false in production.
2. Add merchant route tests:
   - production cannot access MerchantTabs
   - staging/dev can access MerchantTabs
   - non-merchant users see access gate
   - unverified merchants only see allowed screens
   - verified merchants can access dashboard/menu/analytics/profile

3. Add merchant readiness checklist:
   - editable fields
   - data persistence
   - RLS/authorization
   - image upload pipeline
   - menu editor safety
   - OCR draft promotion rules
   - customer inbox moderation

4. Add copy labels that indicate staging/beta if needed.

## Files likely touched

- `src/app/navigation/MerchantTabs.tsx`
- `src/app/screens/merchant/**`
- `src/features/merchant/merchantReadiness.ts`
- `src/app/merchant-coverage-contracts.test.ts`
- `src/app/screens/merchant-screen-contracts.test.ts`
- `src/constants/featureFlags.ts`

## Done criteria

- Merchant mode is safe in staging/dev.
- Production users cannot accidentally reach it.
- Merchant launch gaps are documented.

---

# Batch 8 — Gamification and Passport

## Goal

Make Passport/Missions a polished retention layer without distracting from core discovery.

## Current strengths

- Passport assets and components look like a strong brand differentiator.
- Food passport concept matches Hungry well.

## Current concerns

- Passport/Missions routes appear production-registered outside prototype flag.
- Need clarity on whether gamification is launch-ready.
- Asset size and accessibility need review.

## Implementation

1. Add `gamificationEnabled` flag if Passport/Missions are not production-ready.
2. Gate routes if needed:
   - `PassportScreen`
   - `MissionsScreen`
3. Add accessibility labels for stamps/badges.
4. Audit asset sizes in:
   - `src/assets/gamification/passport/**`
5. Ensure achievements are data-backed:
   - no fake progress unless clearly demo-only
   - missions should reflect actual app events
6. Add tests for:
   - passport route gating
   - badge asset mapping
   - mission progress calculation

## Files likely touched

- `src/app/navigation/RootNavigator.tsx`
- `src/constants/featureFlags.ts`
- `src/app/screens/profile/PassportScreen.tsx`
- `src/app/screens/profile/MissionsScreen.tsx`
- `src/components/gamification/**`
- `src/constants/passportConfig.ts`
- `src/components/gamification/passport-production-contracts.test.ts`

## Done criteria

- Gamification route exposure is intentional.
- Passport assets are optimized.
- Achievements are not misleading.

---

# Batch 9 — Maps and Floorplan Pipeline

## Goal

Finish floorplan QA before treating realistic indoor maps as production-ready.

## Current strengths

- Canonical floorplan contract exists.
- Polygon extraction pipeline is implemented for `hc-maxwell:L1`.
- Tests and schema validation are present.

## Current open items

- Geometry validation still open.
- Visual overlay QA still open.
- Map tap accuracy QA still open.

## Implementation

1. Run geometry validation:
   - no self-intersections
   - no degenerate polygons
   - all polygons inside outline
   - tenant overlap <= 5%

2. Generate visual overlay artifact:

```bash
python3 scripts/floorplan/render_qa_overlay.py ...
```

3. Manual QA:
   - sample at least 20 stall polygons
   - ensure tap opens correct stall >= 95%
   - check zoom/pan performance

4. Add app fallback:
   - if floorplan source invalid, fall back to safe generic layout
   - never crash on bad geometry

## Files likely touched

- `scripts/floorplan/**`
- `data/floorplans/hc-maxwell/**`
- `src/components/map/FloorPlanViewer.tsx`
- `src/components/map/SkiaFloorplanViewer.tsx`
- `src/lib/geo/**`
- `output/qa/floorplans/**`

## Done criteria

- Geometry validation passes.
- Overlay QA artifact exists.
- Tap accuracy is documented.
- App has safe fallback for invalid floorplans.

---

# Batch 10 — Supabase, OCR, Claim Flow, and Supply Priming

## Goal

Close the remaining backend/supply done gates that affect frontend release confidence.

## Current strengths

- Supabase provisioning is documented as complete.
- Claim CTA telemetry and insert were verified.
- Single-claim enforcement exists.
- OCR pipeline components exist.

## Current open item

- OCR e2e staging smoke within 30 seconds is still open.

## Implementation

1. Run OCR staging smoke:
   - upload menu photo
   - trigger OCR
   - extract dishes
   - verify `dishes_draft` rows
   - verify ops queue access
   - measure latency under 30s

2. Add error state handling in UI:
   - upload failed
   - OCR pending
   - OCR failed
   - extraction confidence low

3. Verify ops access security:
   - JWT/admin gate works
   - non-admin cannot read queue

4. Confirm consumer screens never show `dishes_draft` rows.

## Files likely touched

- `supabase/functions/**`
- `supabase/migrations/**`
- `supabase/smoke/**`
- `src/lib/services/supabase/**`
- `src/app/screens/review/QuickReviewSheet.tsx`
- `src/app/screens/merchant/OCRDraftScreen.tsx`

## Done criteria

- OCR smoke passes in staging.
- No draft dishes leak to consumers.
- Ops queue access is secure.

---

# Batch 11 — Auth and Onboarding Polish

## Goal

Ensure auth changes improve conversion without breaking session flow.

## Current change area

The branch modifies auth shell, login, signup, forgot/reset password, verification, and provider buttons.

## Implementation

1. Manual QA:
   - login success
   - login wrong password
   - sign up
   - email verification
   - forgot password
   - reset password
   - auth return route after protected action

2. Verify OAuth/provider buttons:
   - if real provider login is not implemented, buttons must be disabled or clearly labelled
   - do not show non-functional provider buttons

3. Confirm session security:
   - SecureStore usage for tokens
   - sign out clears private persisted state

4. Add copy tests if auth copy is centralized.

## Files likely touched

- `src/app/screens/auth/**`
- `src/app/screens/auth/authCopy.ts`
- `src/app/screens/auth/AuthProviderButton.tsx`
- `src/store/useSessionStore.ts`

## Done criteria

- Auth flows pass on device.
- No dead provider buttons.
- Return route behavior works.

---

# Batch 12 — Native/iOS and Build Configuration

## Goal

Ensure native changes are intentional and build-safe.

## Current issue

The branch modifies iOS project files, Podfile, Podfile.lock, and app config.

## Implementation

1. Split native changes into a dedicated PR if possible.
2. Run:

```bash
npm run ios
npx expo-doctor --non-interactive
```

3. Verify:
   - iOS pods install
   - app builds
   - Sentry config does not break local builds
   - Expo config fields are intentional
   - icon/splash assets resolve

4. Document why each native change is needed.

## Files likely touched

- `ios/**`
- `app.json`
- `App.tsx`
- `package.json`
- `scripts/run-expo.cjs`

## Done criteria

- iOS build passes.
- Native changes are documented.
- No accidental local-machine paths or secrets.

---

# Batch 13 — Assets, Bundle Size, and Licensing

## Goal

Keep visual quality without bloating the mobile app or introducing licensing risk.

## Current issue

The branch adds many food images, logo assets, passport assets, and marketing images.

## Implementation

1. Inventory all added assets:
   - app assets
   - marketing web assets
   - generated passport assets
   - unused assets

2. Separate web assets from mobile assets.
3. Compress mobile images.
4. Confirm asset licensing/source.
5. Measure app bundle impact.
6. Remove unused files.

## Files likely touched

- `src/assets/discover/**`
- `src/assets/gamification/passport/**`
- `assets/images/**`
- `marketing/website/web-v2/public/images/**`
- `scripts/generate-passport-assets.mjs`

## Done criteria

- No unused large assets in mobile app.
- Asset source/licensing is documented.
- Bundle size impact is acceptable.

---

# Batch 14 — CI, Security, and Release Gates

## Goal

Make CI and release checks enforce quality without blocking valid work unnecessarily.

## Current strengths

CI now runs:

- typecheck
- lint
- format check
- tests
- Expo Doctor
- optional EAS build gate

Package scripts include:

- e2e
- native smoke
- Supabase chat smoke
- npm audit
- gitleaks
- trufflehog

## Implementation

1. Add security job to CI or separate workflow:

```bash
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
```

2. Add branch protection recommendations:
   - typecheck required
   - lint required
   - test required
   - expo-doctor required
   - security scan required before production release

3. Ensure CI does not silently skip critical gates.
4. Document EAS build skip behavior when `EXPO_TOKEN` is missing.

## Files likely touched

- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`
- `package.json`
- `SECURITY.md`
- `security_report.md`

## Done criteria

- CI gates are clear.
- Security checks are documented.
- Release cannot proceed without minimum quality gates.

---

# Batch 15 — Production Release Candidate Checklist

## Goal

Decide whether this branch is a release candidate or a set of feature PRs.

## Required release-candidate checks

Before public launch:

- [ ] iOS build passes.
- [ ] Android build passes.
- [ ] Fresh install QA passes.
- [ ] Signed-out browse QA passes.
- [ ] Auth flows pass.
- [ ] Create post protected action works.
- [ ] Review flow works.
- [ ] Discover/Search/Detail works.
- [ ] Offline route works.
- [ ] Feature flags verified in production mode.
- [ ] Merchant centre inaccessible in production.
- [ ] Prototype routes inaccessible in production.
- [ ] DMs inaccessible in production.
- [ ] OCR staging smoke complete or feature hidden.
- [ ] Floorplan QA complete or feature hidden.
- [ ] Asset bundle size acceptable.
- [ ] Privacy/security open actions documented.

## Done criteria

Either:

1. Branch is split into smaller PRs, or
2. Branch is accepted as a release candidate with full QA evidence.

---

# Recommended Implementation Order

## Phase 1 — Safety first

1. Batch 0 — Baseline Verification
2. Batch 1 — Split Scope
3. Batch 2 — Navigation/Feature Flag Safety
4. Batch 14 — CI/Security Gates

## Phase 2 — Core app polish

5. Batch 3 — App Shell QA
6. Batch 4 — Home/Discover/Search
7. Batch 5 — Detail/Data Trust
8. Batch 11 — Auth/Onboarding

## Phase 3 — Risky surfaces

9. Batch 6 — Social Safety
10. Batch 7 — Merchant Mode
11. Batch 8 — Gamification
12. Batch 9 — Maps/Floorplan
13. Batch 10 — Supabase/OCR

## Phase 4 — Release readiness

14. Batch 12 — Native/iOS
15. Batch 13 — Assets/Bundle/Licensing
16. Batch 15 — Release Candidate QA

---

# Codex Prompt

Use this prompt to implement the plan:

```text
You are working on the `frontend-design-overhaul` branch of the Hungry repository.

Your job is to turn the latest review into a safe, batch-by-batch implementation plan and execute the recommendations without adding unrelated new features.

Start by reading:
- `tasks/Roadmap/frontend-design-overhaul-batched-implementation-plan.md`
- `tasks/todo.md`
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/SwipeableTabNavigator.tsx`

Primary goal:
Make the branch mergeable and production-safe by reducing scope risk, tightening route/feature flag safety, verifying the app shell, and documenting remaining release blockers.

Implementation rules:
1. Do not merge the whole branch blindly.
2. Do not add new features during this cleanup pass.
3. Preserve the current visual direction unless a change is needed for safety, performance, or correctness.
4. Keep production route exposure minimal.
5. Gate unfinished surfaces behind feature flags.
6. Split unrelated work into separate PRs or clearly separated commits.
7. Record exact verification results in `tasks/todo.md`.

Work through these batches in order:

Batch 0 — Baseline Verification
- Rebase or merge latest `main` into `frontend-design-overhaul`.
- Run baseline checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npx expo-doctor --non-interactive`.
- Record results.

Batch 1 — Scope Hygiene
- Identify files that should be split out: marketing web, native/iOS, generated assets, security docs, merchant prototype, gamification assets.
- Remove or move unrelated artifacts from the mobile app PR scope.
- Do not delete required assets without checking references.

Batch 2 — Route and Feature Flag Safety
- Verify production cannot access prototype routes, merchant centre, DMs, or unfinished gamification.
- Add `gamificationEnabled` and/or `collectionsEnabled` if needed.
- Add or update tests for route exposure in production/staging/dev.

Batch 3 — App Shell QA
- Verify tab navigation, center create action, Profile auth gate, and signed-out browsing.
- Add tests where possible.
- Confirm no gesture conflicts or document manual QA needed.

Batch 4 — Core Consumer UX
- Improve Home/Discover/Search empty states and no-result states.
- Verify prefetching and analytics events.
- Audit image asset usage and performance.

Batch 5 — Detail/Data Trust
- Remove or fix any remaining hardcoded factual claims.
- Ensure missing dish/stall IDs show proper empty states.
- Ensure save action labels match actual behavior.

Batch 6 — Social Safety
- Keep DMs disabled in production.
- Consider disabling comments in production if moderation is not backend-ready.
- Ensure report/block actions are not just decorative.

Batch 7 — Merchant Mode
- Keep merchant centre staging/dev gated.
- Add tests for merchant access by role/verification state.
- Document remaining merchant launch gaps.

Batch 8 — Gamification
- Gate Passport/Missions if not production-ready.
- Add tests for asset mapping and route exposure.
- Audit bundle size and accessibility labels.

Batch 9 — Maps/Floorplan
- Close or document open geometry validation, overlay QA, and tap-accuracy QA.
- Add safe fallback for invalid floorplan data.

Batch 10 — Supabase/OCR
- Run or document OCR staging smoke.
- Verify draft dishes never leak to consumer screens.
- Verify ops access is admin-gated.

Batch 11 — Auth/Onboarding
- Verify login, signup, email verification, forgot/reset password, and protected return route behavior.
- Disable or clearly label non-functional provider buttons.

Batch 12 — Native/iOS
- Split native changes if possible.
- Verify iOS build and document why each native change is required.

Batch 13 — Assets/Bundle/Licensing
- Inventory and compress assets.
- Separate web-only assets from mobile assets.
- Document licensing/source.

Batch 14 — CI/Security
- Ensure CI checks typecheck, lint, format, tests, Expo Doctor.
- Add security scans if appropriate.
- Document EAS build gate behavior.

Batch 15 — Release Candidate Decision
- Either split the branch into focused PRs or produce a full release-candidate QA report.

After changes, run:
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npx expo-doctor --non-interactive`

If possible, also run relevant smoke scripts:
- `npm run smoke:native:ios:prepared`
- `npm run smoke:supabase-chat`
- any floorplan validation scripts
- any OCR staging smoke scripts

Final response should include:
1. Files changed
2. Batches completed
3. Batches left open
4. Verification commands and results
5. Remaining production blockers
6. Recommended PR split
```

---

# Final Recommendation

Treat `frontend-design-overhaul` as a **release-candidate integration branch**, not a simple feature branch.

The app is better because of this work, but the safest path is:

1. Land navigation/feature flag safety first.
2. Land core consumer UX next.
3. Keep merchant, gamification, floorplan, OCR, and social expansion behind flags.
4. Split marketing/native/assets/security work into separate PRs.
5. Only call the whole branch production-ready after full device QA and release-candidate verification.
