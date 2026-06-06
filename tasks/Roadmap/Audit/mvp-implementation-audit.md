# MVP Basic Features - Implementation Audit

> Source plan: `tasks/Roadmap/mvp-basic-features-implementation-phases.md`
> Updated: 2026-06-06
> Branch: `frontend-design-overhaul`
> Method: repo-local source/contracts review against current implementation and `tasks/todo.md`

## Summary Verdict

The previous version of this audit was stale. The repo now has the original P0/P1 source gaps closed for favourites, dietary/taste sync, review history, user posts, merchant menu writes, and repo-local Phase 9 verification. This document now tracks the current truth.

| Phase | Description | Current status |
| --- | --- | --- |
| 0 | Freeze scope, stabilize, protect production | Complete |
| 1 | Auth, onboarding, guest browse | Complete |
| 2 | Supabase MVP source of truth | Complete for repo-local source paths; live mutation smoke remains external |
| 3 | Profile identity, avatar, settings | Complete for MVP paths; `user_settings` remains reserved |
| 4 | Discovery, search, detail data trust | Complete for MVP paths |
| 5 | Saves, favourites, review submission | Complete for repo-local source paths; cross-device proof remains external |
| 6 | Minimal public posts and feed | Complete for repo-local source paths |
| 7 | Social safety and activity | Complete for MVP gate after follow/share guardrails |
| 8 | Merchant claim MVP | Complete for gated MVP scope |
| 9 | QA, release readiness | Repo-local pass with external blockers |

## Current Evidence

| Area | Evidence |
| --- | --- |
| MVP production scope | `src/constants/featureFlags.ts`, `src/constants/featureFlags.test.ts`, `src/app/navigation/route-production-readiness.test.ts` |
| Guest browse and protected actions | `src/app/navigation/supabase-auth-guards.test.ts`, `src/store/useSessionStore.auth-persistence.test.ts`, `tests/e2e/guest-browsing.spec.ts` |
| Supabase source of truth | `src/store/mvp-source-of-truth-contracts.test.ts`, `src/lib/services/supabase/post-integration.test.ts`, `src/lib/services/supabase/merchant-linkage.test.ts` |
| Profile, favourites, reviews | `src/store/useProfileStore.ts`, `src/app/screens/profile/ReviewHistoryScreen.tsx`, `src/store/useProfileStore.feedback.test.ts` |
| Public posts/feed/profile history | `src/features/home/feed.ts`, `src/store/usePublishedPostStore.ts`, `src/app/screens/profile/UserProfileContent.tsx`, `src/store/useSocialStore.contracts.test.ts` |
| Social safety/activity | `src/lib/security/communitySafety.ts`, `src/store/useActivityStore.ts`, `src/app/navigation/nav-activity-contracts.test.ts` |
| Local release evidence | `tasks/todo.md` and `tasks/verification.md` latest MVP rows |

Latest focused check from this cleanup:

```bash
node --import tsx --test src/store/useSocialStore.contracts.test.ts src/app/screens/sprint9-screen-contracts.test.ts src/app/navigation/nav-activity-contracts.test.ts src/app/screens/review-feed-bites-contracts.test.ts src/lib/services/supabase/post-integration.test.ts src/store/mvp-source-of-truth-contracts.test.ts src/lib/services/supabase/merchant-linkage.test.ts
```

Result: pass, 56/56.

## Phase Notes

### Phase 0 - Production Scope

Complete. Production flags hide MVP-excluded advanced surfaces: Merchant Centre, direct messages, comments, stories, gamification/passport, collections, floorplans, prototype routes, merchant claim CTA, and OAuth provider buttons unless non-production flags explicitly expose them.

### Phase 1 - Auth, Onboarding, Guest Browse

Complete. Signed-out users can browse public Home, Discover, Search, Search Results, Dish Detail, Stall Detail, Reads/Blog, and stable public discovery routes. Protected actions preserve return intent and route through Login. Manual sign-out resets to Login rather than onboarding and clears account-scoped caches.

### Phase 2 - Supabase Source Of Truth

Complete for repo-local source paths. MVP tables and service paths exist for profiles, privacy, favourites, reviews/photos, posts/media, post likes/saves/shares, content reports, public profiles, follows, and activity events. Stores are cache/optimistic mirrors and clear account-scoped data on sign-out/user switch.

Remaining proof is external: live mutation/cross-device Supabase smoke needs approved test accounts/devices.

### Phase 3 - Profile Identity, Avatar, Settings

Complete for MVP paths. Display name, avatar, dietary preferences, taste/onboarding data, privacy settings, and public profile fields flow through canonical profile/service paths. Device-only UI preferences remain in `useUIStore`.

`user_settings` is reserved. It is not an MVP blocker because notifications are production-disabled and currently no MVP setting requires cross-device storage outside the existing privacy/dietary/taste/profile paths.

### Phase 4 - Discovery, Search, Detail Trust

Complete for MVP paths. Search/detail/review surfaces use service/repository reads in Supabase mode and avoid fake ratings, hardcoded verification claims, or fixture review fallbacks on production-facing paths.

Merchant menu writes are no longer a current source-path blocker. `src/lib/services/supabase/merchant-linkage.test.ts` covers linked merchant dish writes into user-visible catalog/menu data.

### Phase 5 - Saves, Favourites, Reviews

Complete for repo-local source paths. Favourites write through Supabase with rollback and hydrate from `user_favourite_dishes`. Review submission and review-photo/public-profile hydration are service-backed. Review history no longer relies on local-only `reviewEntries` in Supabase mode.

Remaining proof is external: save/review cross-device evidence needs approved accounts/devices.

### Phase 6 - Public Posts And Feed

Complete for repo-local source paths. Composer publish uses the canonical service path to write `posts` and `post_media`. Home feed and public-profile history read through Supabase service/repository paths rather than persisted local-only published posts.

### Phase 7 - Social Safety And Activity

Complete for MVP gate after this cleanup.

- Production post follow buttons use UUID-backed `toggleFollow(userId)`.
- Author-name `toggleAuthorFollow(authorName)` is retained only as mock/dev fallback and no-ops in Supabase mode.
- Share counts use `social.shareBite()` for real post UUIDs and insert into `post_shares`.
- Unsupported review/dish/stall share surfaces no longer send review, dish, or venue IDs into post share counts.
- Review-feed share counts are zeroed outside mock reactions so stale local review share counts are not displayed in Supabase mode.
- DMs/stories/comments/gamification/collections remain production-disabled unless separately launch-approved.

### Phase 8 - Merchant Claim MVP

Complete for current MVP gating. Merchant Centre and claim CTAs are production-disabled. Claim interest paths and duplicate handling exist for non-production/approved scope.

### Phase 9 - QA And Release Readiness

Repo-local pass with external blockers. `tasks/todo.md` and `tasks/verification.md` record the latest full local MVP gate evidence: typecheck, lint, format, tests, E2E, static Supabase/Edge/security/release checks, Expo Doctor, and iOS prepared smoke evidence.

## Remaining Blockers

| Blocker | Owner/action |
| --- | --- |
| Linked Supabase legacy payment/order SECURITY DEFINER RPC cleanup | Requires explicit owner approval before applying `supabase/manual/legacy_payment_order_rpc_advisor_cleanup.sql` |
| Android/EAS proof | Requires available Android/EAS environment |
| Live mutation/cross-device Supabase smoke | Requires approved test accounts/devices |

## Non-Blockers

| Item | Reason |
| --- | --- |
| `user_settings` unused | Notifications and cross-device notification settings are outside MVP production scope |
| `toggleAuthorFollow(authorName)` still exists | It is mock/dev fallback only and guarded in production Supabase mode |
| Comments implementation exists while production flag is off | Correct MVP behavior; comment UI/write surfaces remain disabled in production |

## Conclusion

There are no remaining repo-local P0/P1 MVP source gaps from the stale audit. The remaining release blockers are external proof/owner-action items, not app-code implementation gaps.
