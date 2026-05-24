# Frontend Design Overhaul — Batched Implementation Plan for Codex

> Branch: `frontend-design-overhaul`  
> Purpose: Summary of the latest review plus batch-by-batch recommendations, implementation steps, and a Codex prompt.

---

## Executive Summary

The `frontend-design-overhaul` branch is much stronger than the earliest version of the overhaul, but it has widened again and should not be merged as one unreviewed block.

The branch now mixes mobile app UI, auth UI, merchant screens, gamification/passport assets, marketing web assets, CI/security changes, iOS native changes, tests, scripts, and many image assets.

Latest grade:

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
| Overall | B- / B |

Main recommendation: treat this branch as a release-candidate integration branch, not a simple feature branch. Split it into focused batches or enforce full release-candidate QA before merging.

---

## Batch 0 — Baseline Verification and Branch Hygiene

**Goal:** Confirm the real branch state before modifying anything.

**Recommendations:** Rebase or merge latest `main`, resolve drift, run all quality gates, and record results.

**Implementation:**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npx expo-doctor --non-interactive
```

**Improve:** Record every result with date, actor, failing command, cause, and next step in `tasks/todo.md`.

**Done:** Branch is current with `main`, baseline results are logged, and failures are explained.

---

## Batch 1 — Split Scope and Remove Merge Noise

**Goal:** Reduce merge risk by separating unrelated workstreams.

**Recommendations:** Split into focused PRs:

1. App shell/navigation
2. Consumer UX
3. Merchant prototype
4. Gamification/passport
5. Marketing web
6. Native/iOS
7. CI/security

**Implementation:** Move unrelated web, native, generated assets, security docs, and merchant prototype work out of the mobile app PR unless intentionally part of a release-candidate branch.

**Improve:** Add a PR map that lists exactly which files belong to which PR.

**Done:** Each PR has one purpose and is independently reviewable.

---

## Batch 2 — Navigation, Feature Flags, and Route Safety

**Goal:** Make production route exposure minimal and intentional.

**Recommendations:** Add or verify these flags:

```ts
gamificationEnabled
collectionsEnabled
prototypeRoutesEnabled
merchantCentreEnabled
directMessagesEnabled
commentsEnabled
```

**Implementation:** Gate unfinished or non-launch-ready routes such as Passport, Missions, Collections, StoryViewer, AddStory, V2 prototypes, MerchantTabs, and DirectMessages.

**Tests to add:**

- production cannot access prototype routes
- production cannot access merchant centre
- production cannot access DMs
- protected routes redirect to Login and preserve return route

**Improve:** Add production, staging, and development feature-flag tests plus deep-link tests.

**Done:** Route exposure is intentional and tested.

---

## Batch 3 — App Shell and Tab Navigation QA

**Goal:** Keep the new tab shell while proving stability.

**Recommendations:** Verify the bottom-positioned Material Top Tab setup, center create action, Profile auth gate, and swipe interactions.

**Implementation:** Add tests for signed-out create, signed-in create, signed-out Profile, and signed-out browsing of Home/Discover/Review.

**Manual QA:** iOS/Android tab taps, swipes, horizontal carousels, and back behavior after Login/composer redirects.

**Improve:** Add Maestro smoke tests and measure first tab switch performance.

**Done:** No swipe conflicts, auth redirects work, and no startup regression appears.

---

## Batch 4 — Core Consumer UX: Home, Discover, Search

**Goal:** Make the core browse loop launch-ready.

**Recommendations:** Improve empty states, search recovery, prefetching, analytics, and asset performance.

**Implementation:** Add no-data states for nearby stalls, popular dishes, collections, and search results. Add analytics for discover opened, chip tapped, search launched, quick bite tapped, and collection opened.

**Improve:** Compress unused/large `src/assets/discover/*.png` images and validate scroll performance.

**Done:** Signed-out user can browse Home → Discover → Search → Detail, empty states are graceful, and asset usage is justified.

---

## Batch 5 — Detail Screens and Data Trust

**Goal:** Ensure detail screens only show data-backed claims.

**Recommendations:** Audit Dish Detail and Stall Detail for hardcoded ratings, review counts, hours, distance, verification, wait time, regulatory labels, and delivery availability.

**Implementation:** Bind claims to real data, hide missing data, or show neutral unavailable states. Fix save semantics so labels match behavior.

**Tests:** Missing dish, missing stall, no reviews, no delivery links, closed venue.

**Improve:** Add source/freshness labels for menu and review data.

**Done:** No fake trust claims remain and missing data is handled honestly.

---

## Batch 6 — Reviews, Comments, Posts, and Social Safety

**Goal:** Make social features safe enough for staged beta.

**Recommendations:** Keep DMs disabled in production. Consider disabling comments in production until moderation is backend-ready.

**Implementation:** Implement or document report review, report comment, block user, hide content threshold, and admin review queue.

**Improve:** Remove seeded/social counts if they appear real. Use backend-backed counts or neutral defaults.

**Done:** Unsafe social features are gated, report/block are not just decorative, and unmoderated DMs are not public.

---

## Batch 7 — Merchant Mode and Merchant Readiness

**Goal:** Keep merchant mode useful for staging without shipping it publicly too early.

**Recommendations:** Keep `merchantCentreEnabled` false in production.

**Implementation:** Add tests for production access blocked, staging/dev access allowed, non-merchant gate, unverified merchant limits, and verified merchant access.

**Improve:** Add a merchant readiness checklist covering editable fields, persistence, RLS, image upload, menu editor, OCR drafts, and customer inbox moderation.

**Done:** Merchant mode is staging/dev safe and production users cannot reach it.

---

## Batch 8 — Gamification and Passport

**Goal:** Make Passport/Missions a polished retention layer without distracting from discovery.

**Recommendations:** Add `gamificationEnabled` if Passport/Missions are not production-ready.

**Implementation:** Gate Passport/Missions if needed, add accessibility labels, audit passport asset sizes, and make achievements data-backed.

**Tests:** Passport route gating, badge asset mapping, mission progress calculation.

**Improve:** Avoid fake progress and tie missions to real app events.

**Done:** Gamification exposure is intentional and not misleading.

---

## Batch 9 — Maps and Floorplan Pipeline

**Goal:** Finish floorplan QA before treating indoor maps as production-ready.

**Recommendations:** Close geometry validation, visual overlay QA, and map tap accuracy QA.

**Implementation:** Validate no self-intersections, no degenerate polygons, polygons inside outline, and tenant overlap <= 5%. Generate QA overlay and sample at least 20 stall polygons.

**Improve:** Add fallback to generic layout if floorplan data is invalid.

**Done:** Geometry passes, overlay exists, tap accuracy is documented, and invalid floorplans cannot crash the app.

---

## Batch 10 — Supabase, OCR, Claim Flow, and Supply Priming

**Goal:** Close backend/supply gates that affect frontend release confidence.

**Recommendations:** Run OCR staging smoke and verify draft dishes never leak to consumer screens.

**Implementation:** Upload menu photo, trigger OCR, extract dishes, verify `dishes_draft`, verify ops queue access, and measure latency under 30 seconds.

**Improve:** Add UI states for upload failed, OCR pending, OCR failed, and low confidence extraction.

**Done:** OCR smoke passes, draft dishes remain private, and ops access is admin-gated.

---

## Batch 11 — Auth and Onboarding Polish

**Goal:** Ensure auth changes improve conversion without breaking session flow.

**Recommendations:** Manually QA login, signup, email verification, forgot/reset password, wrong password, and return route after protected actions.

**Implementation:** Disable or label provider buttons if provider login is not real. Verify SecureStore token storage and sign-out state clearing.

**Improve:** Add auth flow tests and clearer error copy.

**Done:** Auth flows pass on device, no dead provider buttons exist, and return route behavior works.

---

## Batch 12 — Native/iOS and Build Configuration

**Goal:** Ensure native changes are intentional and build-safe.

**Recommendations:** Split native/iOS changes into a dedicated PR if possible.

**Implementation:** Run:

```bash
npm run ios
npx expo-doctor --non-interactive
```

Verify pods, app build, Sentry config, Expo config, icon, and splash assets.

**Improve:** Document why Podfile, Podfile.lock, and Xcode files changed.

**Done:** iOS build passes and native changes are documented.

---

## Batch 13 — Assets, Bundle Size, and Licensing

**Goal:** Keep visual quality without bloating the app or introducing licensing risk.

**Recommendations:** Inventory app assets, marketing web assets, generated passport assets, and unused assets.

**Implementation:** Separate web-only assets from mobile, compress images, document licensing/source, measure bundle impact, and remove unused files.

**Improve:** Add an asset manifest and mark generated vs hand-authored assets.

**Done:** No unused large assets are in the mobile app and bundle impact is acceptable.

---

## Batch 14 — CI, Security, and Release Gates

**Goal:** Make CI and release checks enforce quality.

**Recommendations:** Ensure CI checks typecheck, lint, format, tests, Expo Doctor, and security scans where appropriate.

**Implementation:** Add or verify:

```bash
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
```

**Improve:** Document branch protection, required secrets, and EAS skip behavior when `EXPO_TOKEN` is missing.

**Done:** CI gates are clear and release cannot proceed without minimum checks.

---

## Batch 15 — Production Release Candidate Checklist

**Goal:** Decide whether the branch is a release candidate or a set of feature PRs.

**Required checks before public launch:**

- iOS build passes
- Android build passes
- Fresh install QA passes
- Signed-out browse QA passes
- Auth flows pass
- Create post protected action works
- Review flow works
- Discover/Search/Detail works
- Offline route works
- Feature flags verified in production mode
- Merchant centre inaccessible in production
- Prototype routes inaccessible in production
- DMs inaccessible in production
- OCR staging smoke complete or feature hidden
- Floorplan QA complete or feature hidden
- Asset bundle size acceptable
- Privacy/security open actions documented

**Done:** Branch is either split into smaller PRs or accepted as a release candidate with full QA evidence.

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

Treat `frontend-design-overhaul` as a release-candidate integration branch, not a simple feature branch.

Safest path:

1. Land navigation/feature flag safety first.
2. Land core consumer UX next.
3. Keep merchant, gamification, floorplan, OCR, and social expansion behind flags.
4. Split marketing/native/assets/security work into separate PRs.
5. Only call the whole branch production-ready after full device QA and release-candidate verification.
