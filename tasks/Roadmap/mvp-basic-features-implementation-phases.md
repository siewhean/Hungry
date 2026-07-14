# Hungry MVP — Basic Features Implementation Phases

> Branch context: `frontend-design-overhaul`
> Purpose: Get the **basic MVP** working end-to-end before continuing advanced features.
> Principle: Every MVP feature must be connected to the same app architecture and source of truth. No standalone mock islands in production.

---

## 1. MVP Definition

The MVP should prove Hungry’s core loop:

```text
Open app → browse food without login → search/discover dishes → view dish/stall details → sign up when value is clear → save/review/post → see profile/history → data persists across sessions and devices.
```

The MVP should not try to launch every feature in the branch. The goal is to create a stable, trustworthy, database-backed food discovery app first.

---

## 2. MVP Product Goals

Hungry MVP must let users:

1. Browse without creating an account.
2. Complete onboarding and set taste/dietary preferences.
3. Search dishes, stalls, and nearby food options.
4. View reliable dish and stall details.
5. Create an account and sign in/out.
6. Save dishes.
7. Submit reviews with optional photos.
8. Create a basic food post with media.
9. See public posts in a feed.
10. View and update their profile.
11. Persist synced data in Supabase and local-only settings on device.
12. Use the app without advanced features breaking the basic flow.

---

## 3. MVP Non-Goals

These should be disabled, hidden, or staging-only until MVP gates pass:

- Direct messages
- Stories
- Full comments/replies if moderation is not ready
- Full merchant centre
- Merchant/admin web console
- QR ordering and payments
- Advanced gamification/passport
- Checklists and portfolios, unless explicitly chosen as MVP
- AI Creator Suite
- Floorplan polygon indoor maps
- Advanced OCR ops workflow
- Public recommendations based on unverified behavioral tracking

---

## 4. MVP Feature Flag Policy

Production-safe defaults should be:

```ts
prototypeRoutesEnabled = false
merchantCentreEnabled = false
directMessagesEnabled = false
storiesEnabled = false
gamificationEnabled = false // until data-backed and QA-complete
collectionsEnabled = false // unless chosen as MVP and tested
commentsEnabled = false // until moderation/backend is ready
floorplansEnabled = false
craveEnabled = true // only if stable and safe
merchantClaimCtaEnabled = false // production off unless launch-approved
```

Staging/dev can enable advanced flags for testing, but production must launch only with MVP features.

---

## 5. MVP Source-of-Truth Rules

| Area | MVP source of truth | Local cache? | Notes |
|---|---|---:|---|
| Auth/session | Supabase Auth + secure local session | Yes | Session tokens must be stored securely. |
| Profile display name | `user_profiles` / `public_profiles` | Yes | Local store is cache only. |
| Profile photo | Supabase Storage + `user_profiles.avatar_url` | Yes | Must propagate to posts/reviews/profile. |
| Taste profile | Supabase user profile/taste table | Yes | Guest taste should migrate on signup. |
| Dietary preferences | Supabase | Yes | Must affect search/recommendations. |
| Theme preference | Local device store | Yes | Should survive sign-out. |
| Saves/favourites | Supabase | Yes | Local state is optimistic cache. |
| Reviews | Supabase `reviews` + `review_photos` | Yes | Must show on detail/profile/feed. |
| Posts | Supabase `posts` + `post_media` | Yes | Local store is optimistic cache only. |
| Public feed | Supabase/RPC | Yes | Must not rely only on local posts. |
| Merchant claim interest | Supabase | Optional | Staging until production decision. |
| App content/data | Supabase or bundled seed fallback | Yes | No fake trust claims. |

---

## 6. MVP Acceptance Gates

The MVP is ready only when all of these pass:

- [ ] Production flags hide advanced features.
- [ ] Fresh install works.
- [ ] Guest browsing works.
- [ ] Onboarding works.
- [ ] Login/signup/email verification works.
- [ ] Search works.
- [ ] Dish and stall details show data-backed claims only.
- [ ] Saves persist across app restart and device/account.
- [ ] Reviews persist and appear in all intended places.
- [ ] Posts persist and appear to other users.
- [ ] Profile update persists and propagates.
- [ ] Settings local-vs-synced behavior is clear.
- [ ] iOS and Android smoke tests pass.
- [ ] Supabase RLS smoke tests pass.
- [ ] No production route can open merchant/admin/prototype screens.

---

# Phase 0 — Freeze Scope, Stabilize Branch, and Protect Production

## Goal

Stop advanced scope from blocking the MVP and make the branch safe to continue.

## Implementation Tasks

1. Rebase or merge latest `main` into `frontend-design-overhaul`.
2. Freeze new feature additions until MVP gates pass.
3. Split advanced work into separate branches or hide behind feature flags.
4. Fix production feature flag defaults.
5. Add route exposure tests for production mode.
6. Record all baseline command results.

## Files Likely Touched

- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/route-production-readiness.test.ts`
- `src/app/production-readiness-contracts.test.ts`
- `tasks/todo.md`
- `references/release-gates.md`

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npx expo-doctor --non-interactive
```

## Done Criteria

- Production does not expose DMs, stories, merchant centre, admin screens, prototype routes, floorplans, or unfinished gamification.
- `frontend-design-overhaul` is no longer behind `main`.
- All verification results are recorded.

---

# Phase 1 — App Boot, Auth, Onboarding, and Guest Browse

## Goal

Users should be able to open Hungry, understand the product, complete onboarding, browse as a guest, and sign in only when useful.

## Basic Flow

```text
Splash → Welcome/onboarding → optional login prompt → Continue as guest → Main app
```

Login should be required only for personal actions:

- Profile
- Save/favourite
- Review
- Post
- Merchant claim
- Settings/account actions

## Implementation Tasks

1. Keep Home, Discover, Search, Dish Detail, Stall Detail, Reads, and Map browseable without login.
2. Gate Profile and account actions.
3. Ensure onboarding choices persist locally for guests.
4. On signup/login, migrate guest onboarding data into user profile.
5. Verify return-route behavior after login.
6. Disable or clearly label non-functional OAuth provider buttons.
7. Ensure sign-out clears account-scoped state but keeps local device settings.

## Files Likely Touched

- `src/app/navigation/RootNavigator.tsx`
- `src/app/screens/auth/**`
- `src/app/screens/onboarding/**`
- `src/store/useSessionStore.ts`
- `src/store/useProfileStore.ts`
- `src/store/useUIStore.ts`
- `src/lib/services/supabase/supabaseService.ts`

## Tests to Add

- Guest can reach Home/Discover/Search/Detail.
- Guest tapping Profile redirects to Login.
- Guest tapping Save redirects to Login and returns to Save action.
- Onboarding preferences persist before signup.
- Signup migrates guest taste/dietary preferences.

## Done Criteria

- User can browse before login.
- Protected actions redirect and return correctly.
- Onboarding data is not lost.

---

# Phase 2 — Supabase MVP Source of Truth

## Goal

Make Supabase the source of truth for all MVP data while local stores act only as cache/optimistic state.

## Implementation Tasks

1. Audit MVP tables and RLS:
   - `user_profiles`
   - `public_profiles`
   - `privacy_settings`
   - `user_favourite_dishes`
   - `reviews`
   - `review_photos`
   - `posts`
   - `post_media`
   - `post_likes`
   - `post_saves`
   - `content_reports`
2. Add missing migrations if needed.
3. Verify service methods do not bypass RLS.
4. Confirm service role keys are never used in the mobile app.
5. Define fallback behavior when Supabase is unavailable.
6. Add seed data for two or more users so cross-user behavior can be tested.

## Files Likely Touched

- `supabase/migrations/**`
- `supabase/smoke/**`
- `src/lib/services/types.ts`
- `src/lib/services/supabase/supabaseService.ts`
- `src/lib/services/supabase/supabaseRepository.ts`
- `src/lib/services/mock/mockService.ts`

## Verification Commands

```bash
npm run audit:supabase:static
npm run audit:supabase:advisor-security:non-password
npm run check:edge-functions
npm run smoke:supabase-full-audit-v1
```

## Done Criteria

- MVP data has clear Supabase ownership.
- RLS tests pass.
- Mock mode remains useful but is not production source of truth.

---

# Phase 3 — Profile Identity, Avatar, and Settings

## Goal

A user’s profile identity should be consistent across the entire app.

## Implementation Tasks

1. Implement profile photo upload using the same media pipeline pattern.
2. Store avatar in Supabase Storage.
3. Update `user_profiles.avatar_url`.
4. Ensure `public_profiles` reflects avatar/display name.
5. Make profile display name/avatar visible consistently in:
   - Profile
   - UserProfile
   - Posts
   - Reviews
   - Comments
   - Activity
   - Chat, if enabled later
6. Classify settings:
   - local-only: theme, haptics, reduced motion, local cache
   - synced: privacy, notification preferences, dietary, taste profile
7. Ensure sign-out clears account-specific data but keeps device settings.

## Files Likely Touched

- `src/store/useProfileStore.ts`
- `src/store/useUIStore.ts`
- `src/app/screens/profile/**`
- `src/lib/services/supabase/mediaUpload.ts`
- `src/lib/services/supabase/supabaseService.ts`
- `supabase/migrations/**`

## Tests to Add

- Updating display name persists to Supabase.
- Updating avatar persists to Supabase Storage and profile row.
- Public profile shows updated avatar/name.
- Theme stays local across sign-out.
- Privacy setting syncs across sessions.

## Done Criteria

- One user identity is consistent across MVP surfaces.
- Settings behavior is documented and tested.

---

# Phase 4 — Discovery, Search, Dish Detail, and Stall Detail

## Goal

Users should reliably find and inspect food without login.

## Implementation Tasks

1. Ensure Home/Discover/Search use service/repository consistently.
2. Remove fake or hardcoded trust claims.
3. Show empty states for no results.
4. Add search recovery suggestions.
5. Ensure dish details display real:
   - name
   - price
   - venue
   - photos
   - dietary tags
   - rating/count only if data-backed
6. Ensure stall details display real:
   - name
   - location
   - opening hours if available
   - dishes
   - verification state if real
7. Add clear labels for unverified data.
8. Ensure merchant menu updates later can flow into search/detail.

## Files Likely Touched

- `src/app/screens/home/HomeFeedScreen.tsx`
- `src/app/screens/discover/**`
- `src/app/screens/search/**`
- `src/app/screens/detail/**`
- `src/features/navigation/prefetch.ts`
- `src/lib/services/supabase/supabaseRepository.ts`

## Tests to Add

- Search no-results state.
- Missing dish shows NotFound/EmptyState.
- Missing stall shows NotFound/EmptyState.
- Dish detail does not show fake rating/count.
- Stall detail does not show fake hours/verification.

## Done Criteria

- Guest can browse and find food.
- Detail screens are honest and data-backed.

---

# Phase 5 — Saves, Favourites, and Review Submission

## Goal

Users should be able to save food and submit reviews with data persisted in Supabase.

## Implementation Tasks

1. Ensure save/favourite requires login.
2. Store saved dishes in Supabase.
3. Rehydrate saved dishes on login/app start.
4. Submit reviews to Supabase.
5. Upload review photos to storage.
6. Show reviews in:
   - Dish detail
   - Stall detail
   - Profile review history
   - Review feed if enabled
7. Update rating/review counts through SQL view, RPC, or safe aggregate.
8. Add moderation status to reviews if public.

## Files Likely Touched

- `src/store/useProfileStore.ts`
- `src/app/screens/review/**`
- `src/app/screens/detail/**`
- `src/app/screens/profile/ReviewHistoryScreen.tsx`
- `src/lib/services/supabase/supabaseService.ts`
- `supabase/migrations/**`

## Tests to Add

- Save persists across restart.
- Save syncs across device/account.
- Review insert creates row.
- Review photo upload creates media row.
- Review appears on dish/stall/profile.

## Done Criteria

- Save and review flows are truly database-backed.
- No review appears publicly without valid user and target IDs.

---

# Phase 6 — Minimal Public Posts and Feed

## Goal

Allow authenticated users to create a basic public food post and allow other users to see it.

## MVP Scope

Include:

- Create post with caption and media
- Store post in Supabase
- Store post media in Supabase Storage / `post_media`
- Public feed reads from Supabase
- User profile shows own posts
- Other users can see public posts

Exclude for MVP:

- Stories
- DMs
- Advanced comments
- AI Creator Suite
- Scheduled posts, unless already stable
- Complex following feed, unless P0 product requirement

## Implementation Tasks

1. Keep `publishComposerPost()` as the canonical post path.
2. Ensure `service.social.postBite()` creates `posts` and `post_media` rows.
3. Treat `usePublishedPostStore` as optimistic cache only.
4. Add `getPublicFeed()` or strengthen `getBitesFeed()`.
5. Add `listUserPosts(userId)`.
6. Ensure another user can see a public post after refresh.
7. Add post delete/report basics or hide editing UI until implemented.

## Files Likely Touched

- `src/features/post/publishing.ts`
- `src/store/usePublishedPostStore.ts`
- `src/app/screens/post/**`
- `src/app/screens/home/HomeFeedScreen.tsx`
- `src/app/screens/profile/**`
- `src/lib/services/types.ts`
- `src/lib/services/supabase/supabaseService.ts`
- `supabase/migrations/**`

## Tests to Add

- User A posts.
- User A sees post immediately.
- User B sees User A’s public post.
- Post media resolves to public/signed URL.
- Local optimistic cache does not become canonical source of truth.

## Done Criteria

- Public posts work cross-user.
- Post feed does not rely only on local state.

---

# Phase 7 — Minimum Social Safety and Activity

## Goal

Support safe MVP social interactions without launching a full social network prematurely.

## MVP Scope

Include:

- Like/save post if backend-backed
- Report content
- Basic activity event for own post interactions, if backend-backed

Defer:

- Direct messages
- Stories
- Full comment threads
- Follower feed unless proven
- Push notifications

## Implementation Tasks

1. Keep DMs off in production.
2. Keep stories off in production.
3. Decide if comments are on or off for MVP.
4. Ensure report/block flows are real if UI is visible.
5. Ensure likes/saves use backend IDs and handle failure.
6. Add retry/rollback policy for failed interactions.
7. Do not display fake social counts.

## Files Likely Touched

- `src/store/useSocialStore.ts`
- `src/store/useActivityStore.ts`
- `src/components/social/**`
- `src/lib/services/supabase/supabaseService.ts`
- `src/constants/featureFlags.ts`
- `supabase/migrations/**`

## Tests to Add

- Like persists across refresh.
- Save persists across refresh.
- Report inserts report row.
- Disabled comments/DMs/stories are inaccessible in production.

## Done Criteria

- Public social surfaces are not misleading.
- No unmoderated DMs or stories in MVP.

---

# Phase 8 — Merchant Claim MVP, Not Full Merchant Portal

## Goal

Capture merchant interest without shipping a full merchant portal prematurely.

## MVP Scope

Include:

- Merchant claim CTA if approved for staging/production
- Claim form
- Claim interest stored in Supabase
- Duplicate claim prevention
- Admin/ops visibility for claim queue

Exclude:

- Full merchant menu editor
- Merchant analytics dashboard
- Merchant inbox
- Promotions
- AI assistant
- Orders

## Implementation Tasks

1. Keep merchant centre disabled in production.
2. Verify merchant claim CTA flag behavior.
3. Store claim interest in Supabase.
4. Add duplicate prevention.
5. Add ops documentation for claim follow-up.
6. Ensure claim form validates contact fields.

## Files Likely Touched

- `src/app/screens/detail/MerchantClaimExplainerScreen.tsx`
- `src/constants/featureFlags.ts`
- `src/lib/services/supabase/supabaseService.ts`
- `supabase/migrations/**`
- `ops/**`

## Tests to Add

- Production claim CTA off unless explicitly enabled.
- Claim insert works.
- Duplicate claim returns already-exists behavior.
- Non-auth/user validation is clear.

## Done Criteria

- Merchant demand can be captured safely.
- Full merchant centre remains advanced.

---

# Phase 9 — MVP QA, Release Readiness, and Store Submission Prep

## Goal

Verify the MVP end-to-end on real devices and avoid accidental advanced-feature exposure.

## Implementation Tasks

1. Run full automated suite.
2. Run iOS and Android manual smoke tests.
3. Run Supabase RLS smoke tests.
4. Run security scans.
5. Run asset audit.
6. Confirm production feature flags.
7. Confirm legal/privacy/account deletion pages.
8. Confirm crash reporting and analytics configuration.
9. Create a release-candidate checklist result.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npx expo-doctor --non-interactive
npm run audit:assets
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run release:ready:local
```

If credentials are available:

```bash
npm run audit:supabase:advisor-security:non-password
npm run smoke:supabase-full-audit-v1
npm run smoke:ocr-staging
npm run smoke:native:ios:prepared
```

## Manual Smoke Matrix

- [ ] Fresh install
- [ ] Guest onboarding
- [ ] Guest browse Home/Discover/Search/Detail
- [ ] Login/signup/sign-out
- [ ] Save dish
- [ ] Submit review
- [ ] Publish post
- [ ] View post from another user
- [ ] Update profile photo/name
- [ ] Settings persistence
- [ ] Offline state
- [ ] Production routes block advanced screens

## Done Criteria

- MVP is stable on iOS and Android.
- Production route surface is clean.
- No core flow depends on mock-only data.

---

# Recommended MVP PR Split

1. **MVP Safety and Feature Flags**
2. **Auth, Onboarding, and Guest Browse**
3. **Profile and Settings Source of Truth**
4. **Discovery/Search/Detail Data Trust**
5. **Saves and Reviews**
6. **Basic Public Posts and Feed**
7. **Merchant Claim Only**
8. **MVP QA and Release Gates**

---

# Codex Prompt — MVP Only

```text
You are working on the Hungry `frontend-design-overhaul` branch.

Your task is to make the MVP work before any advanced features continue.

Read:
- `tasks/Roadmap/mvp-basic-features-implementation-phases.md`
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/store/useSessionStore.ts`
- `src/store/useProfileStore.ts`
- `src/store/useSocialStore.ts`
- `src/store/usePublishedPostStore.ts`
- `src/lib/services/types.ts`
- `src/lib/services/supabase/supabaseService.ts`

Rules:
1. Do not add advanced features.
2. Make production flags safe.
3. Keep guest browsing open.
4. Gate personal actions behind login.
5. Supabase must be canonical for profile, saves, reviews, and posts.
6. Local stores may be optimistic cache only.
7. Advanced features must be disabled or hidden until MVP gates pass.

Implement phases 0–9 in order.

After each phase, run the relevant tests and record results in `tasks/todo.md`.

At the end, run:
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npx expo-doctor --non-interactive`
- `npm run audit:assets`
- `npm run audit:supabase:static`
- `npm run check:edge-functions`
- `npm run release:ready:local`

Final response should include:
1. MVP phases completed
2. Files changed
3. Tests run and results
4. Remaining blockers
5. Advanced features still gated
```
