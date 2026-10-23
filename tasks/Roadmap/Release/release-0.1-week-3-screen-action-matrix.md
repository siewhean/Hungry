# Hungry Release 0.1 — Week 3 Screen and Action Matrix

> Fill this matrix against the final implementation SHA and installed iOS/Android internal-alpha artifacts. A blank result is a blocker, not a pass.

## Classification

- **R:** required for Release 0.1;
- **D:** deferred and absent in staging/production;
- **RO:** read-only and permitted during authenticated Excel fallback;
- **W:** Supabase-confirmed write; unavailable during catalog/network outage unless an explicit safe queue exists.

## Core routes

| Screen | Control/action | Class | Expected result | Supabase healthy | Excel fallback | iOS | Android | Evidence |
|---|---|---:|---|---:|---:|---:|---:|---|
| Splash | Continue/bootstrap | R | Restores valid session or routes fresh user to onboarding | ☐ | ☐ | ☐ | ☐ | |
| Onboarding | Complete onboarding | R | Stores provisional choices and opens mandatory account step | ☐ | n/a | ☐ | ☐ | |
| Login | Sign in | W | Opens authenticated shell only after valid session | ☐ | unavailable | ☐ | ☐ | |
| Signup | Create account | W | Creates account; verification state is truthful | ☐ | unavailable | ☐ | ☐ | |
| Verification | Confirm verified email | W | Refreshes valid session; no manual bypass | ☐ | unavailable | ☐ | ☐ | |
| Discover | Search field | R | Opens Search with retained location/filter context | ☐ | ☐ | ☐ | ☐ | |
| Discover | Browse Dishes | R | Opens paged dish directory | ☐ | ☐ | ☐ | ☐ | |
| Discover | Browse Stalls | R | Opens paged stall directory | ☐ | ☐ | ☐ | ☐ | |
| Discover | Dish card | RO | Opens source/release-bound dish detail | ☐ | ☐ | ☐ | ☐ | |
| Discover | Stall card | RO | Opens source/release-bound stall detail | ☐ | ☐ | ☐ | ☐ | |
| Search | Submit query | RO | Returns matching data or legitimate no-results | ☐ | ☐ | ☐ | ☐ | |
| Search | Clear/reset | R | Clears query, cursor and stale source safely | ☐ | ☐ | ☐ | ☐ | |
| Browse Dishes | Load next page | RO | Distinct stable IDs; source/release retained | ☐ | ☐ | ☐ | ☐ | |
| Browse Stalls | Load next page | RO | Distinct stable IDs; source/release retained | ☐ | ☐ | ☐ | ☐ | |
| Dish Detail | Open stall | RO | Opens matching stall under same source/release | ☐ | ☐ | ☐ | ☐ | |
| Dish Detail | Save/favourite | D | Not visible while favourites are disabled | ☐ | ☐ | ☐ | ☐ | |
| Dish Detail | Review/mark tried/social | D | Not visible in staging/production | ☐ | ☐ | ☐ | ☐ | |
| Stall Detail | Open dish/menu item | RO | Opens matching dish under same source/release | ☐ | ☐ | ☐ | ☐ | |
| Stall Detail | Directions | R | Opens trusted external map URL when data is valid | ☐ | ☐ | ☐ | ☐ | |
| Stall Detail | Claim/review/reply/promotion/social | D | Not visible in staging/production | ☐ | ☐ | ☐ | ☐ | |
| Profile | Edit profile | W | Persists confirmed profile changes; truthful errors | ☐ | unavailable | ☐ | ☐ | |
| Profile | Saved dishes | D | Not visible while favourites are disabled | ☐ | ☐ | ☐ | ☐ | |
| Settings | Privacy/support/account deletion | R/W | Public legal/support pages work; deletion is real | ☐ | unavailable where needed | ☐ | ☐ | |
| Profile | Sign out | W | Clears account state and fallback access; returns to auth | ☐ | ☐ | ☐ | ☐ | |

## State and route checks

| Scenario | Expected | Web/E2E | iOS | Android | Evidence |
|---|---|---:|---:|---:|---|
| Protected deep link while signed out | Auth flow; safe return only after login | ☐ | ☐ | ☐ | |
| Disabled feature deep link | NotFound/unavailable; no hidden mount | ☐ | ☐ | ☐ | |
| Missing/invalid detail ID | Safe not-found state | ☐ | ☐ | ☐ | |
| Healthy query with zero results | Empty state, no fallback substitution | ☐ | ☐ | ☐ | |
| Catalog RPC timeout with valid session | Excel fallback, current route retained | ☐ | ☐ | ☐ | |
| Full disconnect with valid restored session | Excel read-only catalog; writes unavailable | ☐ | ☐ | ☐ | |
| Sign out while offline | Auth only; no Excel access | ☐ | ☐ | ☐ | |
| Revoked session | State cleared; auth only | ☐ | ☐ | ☐ | |
| Missing released config | Blocking configuration screen | ☐ | ☐ | ☐ | |
| Reconnect | Current route retained and next online read uses Supabase | ☐ | ☐ | ☐ | |

## Final totals

| Measure | Required | Actual |
|---|---:|---:|
| Visible dead controls | 0 | |
| Route dead ends | 0 | |
| Feature-flag bypasses | 0 | |
| False-success writes | 0 | |
| Unclassified visible actions | 0 | |
| P0 defects | 0 | |
| P1 defects | 0 before Week 4 | |
