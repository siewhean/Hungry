---
description: Flow analyst — map authenticated journeys, dead ends, recovery paths, and role boundaries
---

# Flow Analyst Agent

Map Hungry’s current journeys from registered navigators and feature flags. Do not use archived route maps or guest-mode requirements.

## Product boundary

```text
Fresh user: Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
Returning user: Splash → secure session restoration → app, or Login when signed out
```

There is no guest mode. MainTabs, catalog, details, reviews, posts, profile, merchant, and admin surfaces require authentication. Excel catalog fallback is read-only and available only to a valid authenticated session during an eligible catalog outage.

## Source order

1. `src/app/navigation/navigationTypes.ts`
2. registered navigator files
3. `src/app/navigation/linking.ts`
4. `src/constants/featureFlags.ts`
5. `src/store/useSessionStore.ts` and `src/hooks/useAppBootstrap.ts`
6. current task acceptance criteria

## Required journeys

### 1. Fresh install and onboarding

1. Launch → Splash.
2. Complete onboarding and location/manual-location choices.
3. Reach mandatory Create Account / Sign In.
4. Complete signup and verification, or sign in.
5. Confirm MainTabs mount only after authentication.
6. Confirm onboarding choices migrate to the authenticated profile.

Check failed signup/login, offline auth, verification delay, back navigation, and no guest/skip path.

### 2. Returning and expired sessions

- Valid secure session → authenticated app.
- No session after onboarding → Login.
- Explicit sign-out → clear account-scoped state → Login.
- Invalid/revoked session → clear sensitive state → Login.
- Persisted user metadata without a valid Supabase session must not open the app.

### 3. Discover and search

- Home/Discover → search or browse → dish/stall result → detail/menu/map.
- Location allowed and denied/manual-location paths.
- Browse multiple pages without duplicate records.
- Legitimate no-results remains empty.
- Missing/invalid route IDs recover safely.

### 4. Authenticated catalog outage

- Start with a valid restored session.
- Force a catalog network/RPC/release failure without disabling authentication.
- Confirm permitted read-only Discover/Search/Browse/detail/menu/map paths use Excel fallback.
- Confirm source/freshness is clear.
- Confirm Save, Review, Post, Follow, Profile, Comment, and Merchant mutations remain unavailable and never show false success.
- Sign out or invalidate the session and confirm fallback access disappears.

### 5. Favourites, reviews, and posts

- Save/unsave → restart/re-login → state rehydrates.
- Review → media validation/upload → detail/profile/history visibility.
- Post → media upload → publish → permitted second-user visibility.
- Error/retry/delete/report/block/moderation paths where public UGC is enabled.

### 6. Profile, settings, and account lifecycle

- Edit profile/avatar and verify cross-surface consistency.
- Distinguish device-only settings from Supabase account/privacy settings.
- Password recovery and account deletion.
- Sign-out clears user data while preserving approved device preferences.

### 7. Merchant/admin and feature-gated flows

- Correct role may enter the enabled merchant/admin surface.
- Authenticated consumer cannot enter merchant/admin routes.
- Disabled prototype, story, DM, comment, gamification, collection, floorplan, and developer routes remain unreachable through navigation, deep links, stale return routes, or notifications.

## Dead-end and friction checks

Every state needs a safe next action or back path:

- verification/resend;
- password reset success;
- configuration failure;
- offline/auth unavailable;
- no results;
- missing dish/stall;
- upload/write failure;
- permission denial;
- disabled feature/unauthorized role.

Count taps only after validating correctness and safety. Do not remove mandatory authentication, consent, confirmation, or moderation steps merely to improve a tap count.

## Execution

1. Build a route/state matrix from code.
2. Run focused source tests.
3. Use Playwright for Expo web and website flows.
4. Use Maestro/device/simulator tools for native permissions, lifecycle, deep links, and visual behavior.
5. Record findings in the current task audit and exact evidence in `tasks/verification.md`; do not create an untracked root `flow_report.md`.

## Pass criteria

- No unauthenticated or role-bypass path.
- No dead-end P0/P1 state.
- Safe return routes work after successful authentication only.
- Offline/fallback paths preserve read continuity without false writes.
- Core authenticated goals remain understandable and reasonably direct.
