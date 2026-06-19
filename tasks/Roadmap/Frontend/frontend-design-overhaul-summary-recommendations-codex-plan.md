# Frontend Design Overhaul — Summary, Recommendations, Batch Plan, and Codex Prompt

> Branch reviewed: `frontend-design-overhaul`
> Latest observed compare: **43 commits ahead / 1 commit behind `main`**
> Purpose: Give Codex a clear, batch-by-batch plan to improve, split, verify, and safely merge the branch.

---

## 1. Executive Summary

The `frontend-design-overhaul` branch is now a strong design/release-candidate branch, but it is no longer a clean frontend-only PR. It contains mobile app UI, auth UI, merchant mode, gamification/passport, marketing website work, Supabase/smoke scripts, CI/security changes, iOS/native changes, and many assets.

The app is better because of this work, but the branch has high integration risk. Treat it as a **release-candidate integration branch** or split it into smaller PRs before merging.

### Latest grading

| Area | Grade | Summary |
|---|---:|---|
| Product direction | A- | Strong dish-first app direction. |
| Visual quality | A | Major improvement in identity and polish. |
| Consumer frontend | B+ | Stronger app UX, but needs QA. |
| Navigation safety | B | Better flags and protected routes; root navigator is large. |
| Feature flag safety | B+ | Prototype, merchant, and DMs are safer. |
| Data trust | B | Improved but every factual claim needs final audit. |
| Merchant readiness | C+ | Good staging prototype, not production merchant portal. |
| Social safety | C+ | DMs gated; comments/posts/reviews need moderation maturity. |
| QA/tooling | B+ | CI and test tooling are much stronger. |
| Scope control | C- | Branch is too broad. |
| Merge readiness | C+ | Mergeable only after split or full RC QA. |
| Production readiness | C+ | Staging candidate, not public-launch ready. |

### Primary recommendation

Do **not** merge the whole branch casually. Either split it into focused PRs or run a full release-candidate QA process.

---

## 2. Immediate Priorities

### P0 — Must address before production merge

1. Rebase or merge latest `main`.
2. Decide whether this branch is a release-candidate branch or a source branch for smaller PRs.
3. Verify production feature flags block prototype routes, merchant centre, DMs, stories, unfinished gamification, and staging-only tools.
4. Run:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
   - `npm run test`
   - `npx expo-doctor --non-interactive`
5. Verify iOS/native changes separately.
6. Run device QA for signed-out browsing, auth, create flow, Discover/Search/Detail, review, offline, and tab swipes.
7. Audit assets and bundle size.
8. Confirm no OCR draft dishes leak to consumers.

### P1 — Should address before beta

1. Split marketing web, native/iOS, security, merchant, gamification, and app UI into separate PRs.
2. Add production route exposure tests.
3. Add social moderation gates.
4. Add merchant readiness documentation.
5. Finish floorplan geometry/tap QA.
6. Run OCR staging smoke.
7. Add asset licensing/attribution notes.
8. Confirm legal/privacy/account deletion pages are accurate.

### P2 — Can wait until after beta

1. Habit learning engine.
2. Messaging expansion.
3. AI Creator Suite production integration.
4. QR ordering/payment rails.
5. Full merchant portal production rollout.
6. Advanced gamification tuning.

---

# Batch 0 — Baseline Verification and Branch Hygiene

## Goal
Confirm the actual current state of `frontend-design-overhaul`.

## What can be improved
The branch has changed repeatedly and is currently far ahead of `main`. Codex must not rely on stale audit notes.

## Implementation tasks
1. Rebase or merge latest `main`.
2. Resolve conflicts.
3. Run baseline checks:
   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   npm run test
   npx expo-doctor --non-interactive
   ```
4. Record exact results in `tasks/todo.md`.
5. Add a session log entry with date, actor, commands, pass/fail, blockers, and next step.

## Done criteria
- Branch is no longer behind `main`.
- All baseline commands are run or failures are documented.
- The team knows whether this branch is being split or treated as a release candidate.

---

# Batch 1 — Scope Split and Merge Hygiene

## Goal
Reduce risk by splitting unrelated workstreams.

## What can be improved
The branch mixes app UI, marketing web, native/iOS, security docs, Supabase scripts, assets, merchant mode, gamification, and frontend UX. This makes review and rollback difficult.

## Recommended PR split
1. **App shell and navigation**
   - `RootNavigator.tsx`
   - `SwipeableTabNavigator.tsx`
   - `navigationTypes.ts`
   - `linking.ts`
   - route tests
   - feature flag tests

2. **Core consumer UX**
   - Home
   - Discover
   - Search
   - Dish Detail
   - Stall Detail
   - Review Feed
   - Quick Bites
   - Collections

3. **Merchant mode prototype**
   - `MerchantTabs.tsx`
   - merchant screens
   - merchant readiness
   - merchant tests

4. **Gamification / Passport**
   - Passport
   - Missions
   - FoodCred
   - passport assets
   - gamification tests

5. **Marketing web**
   - `marketing/web/**`
   - `marketing/website/web-v2/**`
   - SEO/AI-discovery pages
   - web-only assets

6. **Native/iOS/build**
   - `ios/**`
   - `app.json`
   - Podfile / Podfile.lock
   - Metro/Babel/native scripts

7. **Security / CI / release tooling**
   - `.github/workflows/**`
   - `SECURITY.md`
   - `security_report.md`
   - security scripts
   - Supabase audit scripts

8. **Assets and data**
   - food images
   - logo images
   - passport images
   - floorplan cleanup
   - asset manifest / attribution

## Done criteria
- Each PR can be reviewed independently.
- Rollback of one workstream does not affect unrelated work.
- Mobile app PR does not include marketing/native/security changes unless required.

---

# Batch 2 — Navigation, Feature Flags, and Route Safety

## Goal
Make route exposure safe in production and predictable in staging/dev.

## What can be improved
The route system is safer than before, but the root navigator is large. Passport/Missions/Collections/Stories may still need explicit production gating.

## Implementation tasks
1. Verify or add flags:
   ```ts
   prototypeRoutesEnabled
   merchantCentreEnabled
   directMessagesEnabled
   commentsEnabled
   gamificationEnabled
   collectionsEnabled
   storiesEnabled
   ```
2. Gate unfinished routes:
   - V2 prototype screens
   - Design Gallery
   - MerchantTabs
   - DirectMessages / ChatDetail
   - Passport / Missions if not launch-ready
   - StoryViewer / AddStory if not launch-ready
3. Add tests:
   - production cannot open prototype routes
   - production cannot open merchant centre
   - production cannot open DMs
   - staging/dev can open intended routes
   - protected routes redirect to Login with return route
4. Add deep-link tests for disabled routes.

## Files likely touched
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/linking.ts`
- `src/app/navigation/nav-route-contracts.test.ts`
- `src/app/navigation/route-production-readiness.test.ts`
- `src/app/production-readiness-contracts.test.ts`

## Done criteria
- Public production route surface is intentional.
- Risky routes are impossible to open in production.
- Tests prove route behavior.

---

# Batch 3 — App Shell and Tab Navigation QA

## Goal
Keep the new tab shell and prove it is stable.

## What can be improved
The tab shell is good but complex: bottom-positioned material top tabs, deferred screen loading, preloading, skeletons, horizontal rails, and auth redirect logic.

## Implementation tasks
1. Verify Home, Discover, Review, Profile, and center Create.
2. Add tests:
   - signed-out Create redirects to Login
   - signed-in Create opens Post or PostComposerV2 based on flags
   - signed-out Profile redirects to Login
   - signed-out Home/Discover/Review remain browseable
3. Manual QA:
   - iOS tab taps/swipes
   - Android tab taps/swipes
   - horizontal carousel conflict checks
   - Back behavior after login/composer
4. Performance:
   - check deferred load flicker
   - check first switch to Discover
   - check skeleton placeholder duration

## Done criteria
- Tab shell works on iOS and Android.
- No obvious swipe conflict.
- Auth redirects preserve return routes.
- No visible lazy-load breakage.

---

# Batch 4 — Home, Discover, Search, and Browse Loop

## Goal
Make the main consumer discovery loop launch-ready.

## What can be improved
The app is visually stronger, but Discover/Search are complex and image-heavy. Empty states, performance, analytics, and asset size need attention.

## Implementation tasks
1. Add empty/no-result states:
   - no nearby stalls
   - no popular dishes
   - no search results
   - no collections
   - no quick bites
2. Search recovery:
   - recent searches
   - popular categories
   - nearby stalls
   - clear filters
3. Analytics:
   - `discover_opened`
   - `discover_chip_tapped`
   - `search_launched`
   - `search_result_tapped`
   - `quick_bite_tapped`
   - `collection_opened`
4. Prefetch:
   - dish detail
   - stall detail
   - collection detail
5. Performance:
   - image cache policy
   - scroll smoothness
   - reduce unnecessary re-renders
   - audit large local images

## Done criteria
- Signed-out user can browse Home → Discover → Search → Detail.
- No-result states are useful.
- Performance is acceptable on a low-end Android device or emulator.
- Asset usage is justified.

---

# Batch 5 — Dish/Stall Detail and Data Trust

## Goal
Ensure detail screens only show accurate, data-backed information.

## What can be improved
Dish Detail V2 is stronger and Stall Detail improved, but every factual claim should be audited.

## Implementation tasks
1. Audit hardcoded claims:
   - ratings
   - review counts
   - opening hours
   - distance
   - verification
   - wait time
   - delivery availability
   - regulatory-looking labels
   - popularity/traffic claims
2. Replace each claim with real data, “unavailable,” or hide it.
3. Missing entity handling:
   - no `return null`
   - show `EmptyState` or `NotFound`
4. Save semantics:
   - if saving a stall, implement saved stall IDs
   - if saving a dish, label action as Save Dish
5. Tests:
   - missing dish
   - missing venue
   - no reviews
   - no delivery links
   - closed venue
   - unverified venue

## Done criteria
- No fake trust claims remain.
- Detail screens are honest with missing data.
- Save/share/review actions behave as labelled.

---

# Batch 6 — Reviews, Comments, Posts, and Social Safety

## Goal
Make social/community features safe enough for beta.

## What can be improved
The app has review feeds, comments, shares, posts, stories, and DMs code. DMs are disabled by default, but comments and social interactions still need moderation maturity.

## Implementation tasks
1. Keep production DMs disabled.
2. Decide whether comments should be disabled in production until moderation is backend-backed.
3. Ensure report/block actions:
   - write to backend or queue
   - show user feedback
   - hide blocked users locally
   - are not just alerts
4. Count integrity:
   - avoid using ratings as like counts
   - avoid fake comment/share/save counts
   - show neutral defaults when counts unavailable
5. Post Composer V2:
   - keep prototype-gated unless upload/publish/drafts are real
   - label mock AI actions if still mocked
   - ensure unsaved drafts do not get lost unexpectedly
6. Story/AddStory:
   - gate if not production-ready
   - add moderation and upload safety before enabling

## Done criteria
- Unsafe social features are gated.
- Report/block actions have meaningful behavior.
- No public unmoderated DMs.
- Counts are not misleading.

---

# Batch 7 — Merchant Mode and Merchant Readiness

## Goal
Keep merchant mode useful in staging without accidentally shipping a public merchant portal.

## What can be improved
Merchant mode is substantial and should be treated as a separate product surface.

## Implementation tasks
1. Keep production merchant centre disabled.
2. Add tests:
   - production cannot access merchant tabs
   - staging/dev can access merchant tabs
   - non-merchant sees access gate
   - unverified merchant is restricted
   - verified merchant can access core screens
3. Add readiness matrix:
   - Dashboard: real vs mock values
   - Menu: persistence, validation, image upload
   - Analytics: real vs mock metrics
   - Profile: editable fields
   - Customer inbox: moderation/safety
   - OCR drafts: ops access
   - Promotions: validation and expiry
   - AI assistant: mock vs real
4. Add staging labels like “Merchant Centre Beta” where useful.

## Done criteria
- Merchant mode is staging/dev safe.
- Production users cannot reach it.
- Every merchant screen is classified as real, mock, or placeholder.

---

# Batch 8 — Gamification and Passport

## Goal
Make Passport/Missions a real retention layer, not visual noise.

## What can be improved
Passport assets and UI are promising, but route exposure, data truth, and asset size need review.

## Implementation tasks
1. Add `gamificationEnabled` if not already present.
2. Gate Passport, Missions, and FoodCred surfaces if needed.
3. Verify achievements:
   - no fake progress
   - missions tied to real events
   - reward logic testable
4. Accessibility:
   - badge labels
   - stamp labels
   - mission progress labels
5. Assets:
   - compress passport images
   - remove unused passport assets
   - document generated assets
6. Tests:
   - route exposure
   - badge mapping
   - mission calculation
   - production readiness

## Done criteria
- Gamification exposure is intentional.
- Rewards are data-backed.
- Assets are optimized and accessible.

---

# Batch 9 — Maps and Floorplan Pipeline

## Goal
Make indoor maps safe and trustworthy.

## What can be improved
The floorplan pipeline is technically promising, but QA gates remain critical.

## Implementation tasks
1. Geometry validation:
   - no self-intersections
   - no degenerate polygons
   - all polygons inside outline
   - tenant overlap below threshold
2. Overlay QA:
   - generate visual overlay
   - review alignment
   - commit only final QA artifacts if necessary
3. Tap accuracy:
   - sample stall polygons
   - target >=95% correct stall opens
4. Fallback:
   - invalid floorplan falls back to generic layout
   - no fatal redbox on bad geometry
5. Data hygiene:
   - remove temporary extraction artifacts
   - document canonical sources

## Done criteria
- Floorplan geometry passes validation.
- Overlay QA is documented.
- Tap accuracy is documented.
- Invalid geometry cannot crash the app.

---

# Batch 10 — Supabase, OCR, Claim Flow, and Supply Priming

## Goal
Close backend/supply gates that affect frontend confidence.

## What can be improved
Claim flow is stronger, but OCR e2e smoke and ops security need ongoing verification.

## Implementation tasks
1. Run OCR staging smoke:
   - upload photo
   - process OCR
   - extract dishes
   - insert `dishes_draft`
   - verify ops queue
   - measure latency under 30s
2. Add UI states:
   - upload failed
   - OCR pending
   - OCR failed
   - low confidence
3. Verify:
   - draft dishes never appear in consumer menu
   - ops queue is admin-only
   - storage path ownership works
   - service-role keys are never client-side
4. Add or run scripts:
   - OCR smoke
   - Supabase neutral audit
   - edge function checks
   - social/gamification smoke if relevant

## Done criteria
- OCR smoke passes in staging.
- Draft data does not leak to consumers.
- Ops access is secure.

---

# Batch 11 — Auth and Onboarding Polish

## Goal
Ensure auth changes improve conversion without breaking session/return-route behavior.

## What can be improved
Auth UI changed significantly. Provider buttons and return routes need special review.

## Implementation tasks
1. Manual QA:
   - login success
   - wrong password
   - sign up
   - email verification
   - forgot password
   - reset password
   - protected return route
2. Provider buttons:
   - disable if not functional
   - label staging/mock clearly
   - no dead buttons
3. Session security:
   - SecureStore for tokens
   - private stores clear on sign-out
   - onboarding completion route stable
4. Copy:
   - centralized auth copy should match actual behavior

## Done criteria
- Auth flows pass on device.
- No dead auth buttons.
- Return routes work.

---

# Batch 12 — Native/iOS and Build Configuration

## Goal
Ensure native changes are intentional and build-safe.

## What can be improved
Native/iOS changes should be reviewed separately from frontend UI.

## Implementation tasks
1. Split native changes if possible.
2. Run:
   ```bash
   npm run ios
   npx expo-doctor --non-interactive
   ```
3. Verify:
   - pods install
   - app builds
   - Sentry config works
   - app icons resolve
   - Expo config fields are intentional
   - no local-machine paths
   - no secrets
4. Run/trigger EAS preview build if available.

## Done criteria
- Native build passes.
- Native changes are documented.
- No local paths or secrets.

---

# Batch 13 — Assets, Bundle Size, and Licensing

## Goal
Keep visual quality without bloating mobile bundle or introducing licensing risk.

## What can be improved
Large numbers of food, logo, web, and passport assets were added.

## Implementation tasks
1. Inventory:
   - mobile assets
   - web assets
   - generated assets
   - unused assets
2. Separate:
   - web-only assets stay in web
   - mobile assets stay in mobile
   - source assets documented
3. Optimize:
   - compress PNG/JPG
   - remove unused assets
   - consider CDN for large sets
4. Licensing:
   - attribution file
   - generated asset notes
   - source URLs or license records
5. Bundle impact:
   - measure before/after
   - document impact

## Done criteria
- No unused large assets in mobile.
- Licensing/source is documented.
- Bundle size impact is acceptable.

---

# Batch 14 — CI, Security, and Release Gates

## Goal
Make quality and security gates enforce release readiness.

## What can be improved
CI is stronger, but security scans, EAS skips, and release gates should be explicit.

## Implementation tasks
1. CI must run:
   - typecheck
   - lint
   - format check
   - tests
   - Expo Doctor
2. Add or verify security gates:
   ```bash
   npm run security:audit
   npm run security:gitleaks
   npm run security:trufflehog
   ```
3. Document:
   - required secrets
   - why EAS can skip when `EXPO_TOKEN` is missing
   - branch protection recommendations
4. Add release checklist script:
   - verify flags
   - verify native smoke
   - verify Supabase smoke
   - verify asset audit

## Done criteria
- CI is clear and enforceable.
- Security checks are documented.
- Release cannot proceed without minimum gates.

---

# Batch 15 — Production Release Candidate Checklist

## Goal
Decide whether this branch becomes a release candidate or a set of smaller PRs.

## Implementation tasks
Before public launch, verify:

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
- [ ] App Store / Play Store legal requirements accounted for.

## Done criteria
Either:
1. Branch is split into smaller PRs, or
2. Branch is accepted as release candidate with complete QA evidence.

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

Your task is to implement the recommendations from the latest frontend-design-overhaul review. Treat this as a release-candidate cleanup and hardening pass, not a feature expansion pass.

Start by reading:
- `tasks/Roadmap/Frontend/frontend-design-overhaul-summary-recommendations-codex-plan.md`
- `tasks/Roadmap/Frontend/frontend-design-overhaul-batched-implementation-plan.md`
- `tasks/todo.md`
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/SwipeableTabNavigator.tsx`
- `.github/workflows/ci.yml`
- `package.json`

Primary goal:
Make the branch mergeable and production-safe by reducing scope risk, tightening route and feature flag safety, verifying the app shell, and documenting remaining release blockers.

Implementation rules:
1. Do not add new product features.
2. Do not merge the branch wholesale without QA evidence.
3. Preserve the current visual direction unless a change is required for correctness, safety, performance, or production readiness.
4. Keep production route exposure minimal.
5. Gate unfinished surfaces behind feature flags.
6. Split unrelated work into separate PRs or clearly separated commits.
7. Record exact verification results in `tasks/todo.md`.
8. Do not delete assets or generated files unless you confirm they are unused or belong in another PR.

Execute the batches in this order:

Batch 0 — Baseline Verification
- Rebase or merge latest `main`.
- Run:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm run test`
  - `npx expo-doctor --non-interactive`
- Record results.

Batch 1 — Scope Hygiene
- Identify work that should be split out: marketing web, native/iOS, generated assets, security docs, merchant prototype, gamification assets.
- Create a PR/file ownership map.
- Remove or move unrelated artifacts from the mobile app PR scope where safe.

Batch 2 — Route and Feature Flag Safety
- Verify production cannot access prototype routes, merchant centre, DMs, stories, or unfinished gamification.
- Add `gamificationEnabled`, `collectionsEnabled`, and `storiesEnabled` if needed.
- Add/update tests for route exposure in production/staging/dev.
- Add deep-link tests for disabled routes.

Batch 3 — App Shell QA
- Verify tab navigation, center create action, Profile auth gate, signed-out browsing, deferred tab loading, and horizontal carousel gesture behavior.
- Add tests where possible and document manual QA where automation is not practical.

Batch 4 — Core Consumer UX
- Improve empty states and no-result recovery for Home/Discover/Search/Quick Bites/Collections.
- Verify prefetching and analytics.
- Audit image usage and performance.

Batch 5 — Detail/Data Trust
- Remove or fix remaining hardcoded factual claims.
- Ensure missing dish/stall IDs show proper empty states.
- Ensure save action labels match actual behavior.

Batch 6 — Social Safety
- Keep DMs disabled in production.
- Consider disabling comments in production if moderation is not backend-ready.
- Ensure report/block actions are meaningful.
- Ensure public counts are not fake or misleading.

Batch 7 — Merchant Mode
- Keep merchant centre staging/dev gated.
- Add tests for merchant access by role and verification state.
- Document merchant launch gaps and real-vs-mock areas.

Batch 8 — Gamification
- Gate Passport/Missions if not production-ready.
- Add tests for asset mapping, route exposure, and mission progress.
- Audit accessibility labels and bundle size.

Batch 9 — Maps/Floorplan
- Close or document geometry validation, overlay QA, and tap accuracy.
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
- Measure bundle impact.

Batch 14 — CI/Security
- Ensure CI checks typecheck, lint, format, tests, Expo Doctor.
- Add or verify security scans.
- Document EAS build gate behavior and required secrets.

Batch 15 — Release Candidate Decision
- Either split the branch into focused PRs or produce a release-candidate QA report.

After changes, run:
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npx expo-doctor --non-interactive`

If available, also run:
- `npm run smoke:native:ios:prepared`
- `npm run smoke:supabase-chat`
- asset audit scripts
- floorplan validation scripts
- OCR staging smoke scripts

Final response should include:
1. Files changed
2. Batches completed
3. Batches left open
4. Verification commands and results
5. Remaining production blockers
6. Recommended PR split
7. Any manual QA still required
```

---

# Final Recommendation

Treat `frontend-design-overhaul` as a **release-candidate integration branch**, not a simple frontend feature branch.

The safest path is:

1. Land navigation/feature flag safety first.
2. Land core consumer UX next.
3. Keep merchant, gamification, floorplan, OCR, stories, DMs, and social expansion behind flags.
4. Split marketing/native/assets/security work into separate PRs.
5. Only call the branch production-ready after full automated and device QA.
