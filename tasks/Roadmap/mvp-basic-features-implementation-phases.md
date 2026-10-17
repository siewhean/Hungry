# Hungry MVP — Basic Features Implementation Phases

> Current integration base: `main`  
> Active auth/catalog implementation: PR #44  
> Goal: ship a trustworthy, Supabase-authenticated Singapore food-discovery MVP before enabling advanced surfaces.

## 1. MVP definition

The core loop is:

```text
Splash
→ local onboarding
→ Create Account / Sign In
→ verification when required
→ authenticated Home / Discover / Search
→ dish or stall detail
→ save, review, or post
→ profile/history
→ synced data persists across sessions and devices
```

Hungry does not support guest mode. The bundled Excel catalog is not an authentication fallback. It may provide read-only catalog continuity only after a valid Supabase-authenticated session has been restored and an eligible catalog outage occurs.

## 2. MVP goals

The MVP must let an authenticated user:

1. Complete onboarding and persist taste/dietary/location choices.
2. Create an account, verify it when required, sign in, restore a session, recover a password, sign out, and request account deletion.
3. Discover and search dishes, stalls, buildings, and areas using canonical data.
4. View reliable dish, stall, menu, location, hours, and approved image context.
5. Save dishes and restore favourites across sessions/devices.
6. Submit reviews with validated optional media.
7. Create a basic food post with validated media and see the post from another permitted account.
8. View/update one consistent profile and avatar across all public/user surfaces.
9. Handle loading, empty, no-results, error, offline, permission-denied, invalid-route, and expired-session states.
10. Keep advanced/unfinished features from affecting the core flow.

## 3. MVP non-goals and production gates

These remain disabled, hidden, role-restricted, or staging-only until their own implementation, moderation, data, security, and QA gates pass:

- direct messages and real-time chat;
- stories;
- comments/replies without complete report/block/moderation controls;
- public merchant centre or unverified merchant claims;
- QR ordering, payment, or checkout;
- advanced Passport/missions/gamification;
- collections, checklists, and portfolios unless separately approved;
- AI creator/business tools;
- indoor floorplan polygons and experimental drill-down routes;
- OCR/ops/admin surfaces for consumer users;
- prototype and developer routes;
- public claims based on unverified or synthetic data.

## 4. Mandatory authentication policy

| State | Expected behavior |
|---|---|
| Fresh install | Splash then onboarding |
| Onboarding complete, no session | Mandatory Create Account / Sign In |
| Authenticated session restored | Enter approved MainTabs |
| Failed login/signup | Remain in auth with clear error/retry |
| Email verification required | Verification screen; no MainTabs |
| Signed out | Clear account-scoped state and return to Login |
| Session invalid/revoked | Clear sensitive state and return to Login |
| Missing production Supabase config | Blocking service/configuration state |
| Protected deep link while signed out | Onboarding/Login, then safe return after successful auth only |

No main route, detail, search, map, review, post, profile, merchant, admin, Passport, or developer surface may bypass this boundary.

## 5. Data-source policy

| Area | Canonical source | Local role |
|---|---|---|
| Authentication/session | Supabase Auth + SecureStore-backed token persistence | Non-sensitive session metadata only |
| Profile/avatar/privacy | Supabase profile tables and Storage | Cache/optimistic state |
| Taste/dietary profile | Supabase authenticated profile | Onboarding draft before account; cache after sync |
| Catalogue | Supabase release-versioned catalog/RPCs | Bounded in-memory cache |
| Catalog outage continuity | Bundled validated Excel catalog after authentication | Read-only fallback only |
| Favourites | Supabase | Optimistic cache and rehydration |
| Reviews/photos | Supabase database + private/controlled Storage | Draft/optimistic state only |
| Posts/media/feed | Supabase database/RPC + Storage | Draft/optimistic cache only |
| Settings | Device store for device-only preferences; Supabase for account/privacy settings | Explicitly documented |
| Merchant/admin operations | Supabase under role/RLS boundaries | No fixture/local success |

Rules:

- Released builds remain Supabase-authenticated applications.
- Mock providers are development/test-only.
- Missing production credentials do not select Excel or mock providers.
- Failed writes never become local or Excel success.
- A successful empty search remains a no-results state.

## 6. Catalog fallback policy

Excel fallback is allowed only when all are true:

- authentication bootstrap completed;
- a valid Supabase session was restored;
- the user has not signed out;
- the session has not been rejected or revoked;
- the online catalog failed for a classified network, timeout, RPC, release, or availability reason.

It may support only:

- Discover;
- Browse Dishes and Browse Stalls;
- dish/stall/area search;
- location, cuisine, dietary, price, and availability filters supported by the catalog;
- dish detail;
- stall detail and venue menu;
- map markers where coordinates exist.

It must preserve:

- cursor paging and deduplication;
- menu-derived dish images;
- stall logo → stall/venue image → representative menu dish;
- stable `excel-fallback-*` release continuity;
- source/freshness indication;
- safe no-image states without Unsplash or generic placeholders.

It must not enable saves, reviews, posts, likes, follows, comments, profile updates, account actions, or merchant mutations.

## 7. Feature-flag policy

Production flags must default to the smallest approved MVP surface. Tests must prove a disabled route cannot open through:

- tab/stack navigation;
- direct route calls;
- deep links;
- stale persisted navigation state;
- auth return routes;
- notification payloads where applicable;
- developer launcher shortcuts.

`src/constants/featureFlags.ts` and registered navigator screens are the implementation source of truth. Do not copy static flag values into planning documents as if they cannot change.

## 8. Implementation phases

### Phase 0 — Repository and environment integrity

- [ ] Active branches are updated against `main`.
- [ ] Superseded PRs are closed and stale refs scheduled for deletion.
- [ ] Required staging/production environment names are documented without secret values.
- [ ] Typecheck, lint, formatting, tests, Expo Doctor, asset, security, and static Supabase gates run in CI.

Exit: clean, reproducible branch with no configuration ambiguity.

### Phase 1 — Mandatory onboarding and authentication

- [ ] Pre-auth navigator mounts only Splash, Onboarding, and Auth.
- [ ] No guest/skip control or unauthenticated MainTabs path exists.
- [ ] Signup, login, verification, recovery, sign-out, and session restoration work.
- [ ] Onboarding choices migrate to the authenticated profile.
- [ ] Invalid/revoked sessions fail closed.
- [ ] Missing release configuration blocks app access.

Exit: every main route is inaccessible until authentication succeeds.

### Phase 2 — Catalog and discovery

- [ ] Supabase catalog paging/search/detail/menu/map is bounded and authenticated.
- [ ] Location and manual-area flows work when permission is allowed or denied.
- [ ] Real approved menu/stall imagery appears.
- [ ] All valid catalog records are reachable through paging/search/details, not mounted at once.
- [ ] Legitimate no-results is preserved.
- [ ] Authenticated Excel fallback works only for eligible catalog outages.

Exit: reliable discovery with healthy Supabase and controlled read-only outage continuity.

### Phase 3 — Profile and settings

- [ ] Profile and avatar have one canonical Supabase identity.
- [ ] Edits propagate to posts/reviews/public profile views.
- [ ] Device-only and account-synced settings are separated.
- [ ] Privacy/support/account deletion flows are real and documented.
- [ ] Sign-out clears account-scoped caches but keeps approved device preferences.

Exit: no conflicting local profile/settings islands.

### Phase 4 — Favourites and reviews

- [ ] Save/unsave persists and rehydrates.
- [ ] Reviews validate identity, target, rating, text, tags, and media.
- [ ] Storage paths enforce ownership.
- [ ] Reviews appear on intended detail/profile/history surfaces.
- [ ] Public review UGC has report/hide/block/moderation support where exposed.

Exit: cross-session and cross-user proof passes without false optimistic success.

### Phase 5 — Posts and feed

- [ ] Composer requires authentication and valid dish/stall context where required.
- [ ] Media MIME, size, duration, ownership, and upload failure are handled.
- [ ] Published posts are Supabase-backed and visible to permitted other users.
- [ ] Delete/report/block/hide/moderation behavior works for public UGC.
- [ ] Offline/backend failure does not leave a false published state.

Exit: basic social publishing is trustworthy and moderated.

### Phase 6 — Security, accessibility, and performance

- [ ] RLS/storage/role smoke tests pass.
- [ ] No service-role/private secret exists in client source or bundle.
- [ ] Sensitive session data stays in secure storage.
- [ ] Deep links and external links are allowlisted/sanitized.
- [ ] VoiceOver and TalkBack complete core flows.
- [ ] Large text, dark mode, reduced motion, contrast, and touch targets pass.
- [ ] Cold start, search/detail latency, scrolling, memory, prefetch, and upload targets pass on representative devices.

Exit: no open P0 security, privacy, accessibility, or stability finding.

### Phase 7 — Native and store release evidence

- [ ] iOS preview/production build and TestFlight smoke pass.
- [ ] Android preview/production build, install, internal track, and Play pre-launch report pass.
- [ ] Sentry controlled error and source-map proof pass.
- [ ] App Store privacy, Google Data Safety, permissions, metadata, screenshots, demo account, support/privacy/deletion URLs, and reviewer notes are complete.
- [ ] Legal/privacy owner sign-off and rollback plan are recorded.

Exit: Go candidate may be considered; production remains No-Go while any external proof is missing.

## 9. MVP acceptance gates

- [ ] Mandatory authentication works on fresh and returning installs.
- [ ] No unauthenticated route or Excel fallback bypass exists.
- [ ] Supabase remains canonical for authentication and all writes.
- [ ] Catalog/search/detail/media data is visible, paged, and source-safe.
- [ ] Favourites, reviews, posts, profile, and settings persist correctly.
- [ ] Cross-user visibility and RLS isolation both pass.
- [ ] Location denial and offline/outage states are usable.
- [ ] Advanced/disabled features are unreachable in production.
- [ ] Automated source/E2E/security/data gates pass.
- [ ] iOS and Android native QA pass.
- [ ] Store-console, monitoring, legal, privacy, and rollback proof pass.

## 10. Required verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:e2e
npm run test:e2e:merchant-catalog
npx expo-doctor --non-interactive
npm run audit:assets
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
npm run release:ready:local
npm run smoke:database:location
npm run smoke:database:search
npm run smoke:database:rls
```

Credential-backed and native commands must be recorded separately. Skipped checks are not passes.

## 11. Current status source

Do not maintain volatile completion percentages here. Use:

```text
tasks/backlog.md
tasks/verification.md
tasks/session-log.md
PR #44 and its audit evidence
```

This document defines the current MVP sequence and acceptance boundaries; it is not a release certificate.
