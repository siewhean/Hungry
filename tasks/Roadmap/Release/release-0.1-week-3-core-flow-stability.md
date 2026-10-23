# Hungry Release 0.1 — Week 3 Core-Flow Stability

> Status: Prepared, not executed. Week 3 may start only after the Week 1–2 release gates are green or explicitly owner-blocked with all repository-local work complete.
>
> Product contract: no guest mode. Supabase is mandatory for authentication and shared writes. Excel is an authenticated, read-only catalog fallback only for classified catalog outages.

## Outcome

By the end of Week 3, a new tester can complete the Release 0.1 journey without assistance, dead controls, route traps, false success, or data-source ambiguity:

```text
Install
→ Splash
→ Onboarding
→ Create account / Sign in
→ Discover or Search
→ Open dish
→ Open stall/menu
→ Open Settings
→ Sign out
```

The user must also be able to repeat the read-only catalog portion while an authenticated catalog outage activates Excel fallback.

## In scope

- mandatory auth and session restoration;
- Discover, Search, Browse Dishes, Browse Stalls;
- source-bound dish and stall details;
- settings, privacy, support, account deletion, sign-out;
- loading, empty, no-results, offline/fallback, unavailable and retry states;
- route/deep-link safety;
- zero-dead-control cleanup;
- beta issue and catalog-data reporting operations.

## Explicitly out of scope

- social Home feed;
- posts, reviews and comments;
- Activity, stories and direct messages;
- Map, Wheel, Crave and Quick Bites;
- gamification, Passport and missions;
- collections, checklists and portfolios;
- merchant centre, merchant claims and promotions;
- floorplans and prototype/developer surfaces;
- favourites until its complete write/RLS/rehydration gate passes.

## Execution batches

### Batch 3.1 — Route and control inventory

For every released route, enumerate every visible interactive control. Each control must be classified as:

- **Required:** works end to end and has automated plus native evidence;
- **Deferred:** absent from staging/production UI and route registration;
- **Read-only:** safe during Excel fallback;
- **Write:** Supabase-confirmed only, disabled/unavailable during outage.

No control may remain unclassified.

### Batch 3.2 — Primary journey stabilization

Verify all transitions, return routes and back behavior for:

1. fresh install and onboarding;
2. signup, verification and login;
3. session restore after force-quit;
4. Discover → dish → stall/menu;
5. Search/Browse → details;
6. legitimate no-results;
7. sign-out and protected deep-link denial.

### Batch 3.3 — Data-source state matrix

| State | Expected result |
|---|---|
| Healthy Supabase | Supabase source/release shown; catalog pages and details work |
| Authenticated catalog timeout/RPC outage | Excel read-only source shown; current route retained |
| Authenticated full network loss | Excel read-only catalog remains usable; writes unavailable |
| Signed out and offline | Auth flow only; no Excel access |
| Revoked/invalid session | Account state cleared; auth flow only |
| Missing released configuration | Blocking configuration state |
| Successful no-results | Empty result; no Excel substitution |

### Batch 3.4 — System-state quality

Every released screen must have:

- deterministic loading behavior;
- useful empty state;
- retryable error state;
- non-blocking offline/fallback indication;
- missing/invalid route-param handling;
- approved image or neutral image-unavailable state;
- no fake rating, review, opening-hours or success claims.

### Batch 3.5 — Issue reporting operations

Use the repository issue forms introduced with this week:

- beta app defect;
- catalog/data-quality issue.

During internal testing, every report must include build ID, implementation SHA, platform/device, route, source/release ID when available, expected result, actual result and reproduction steps. Never include passwords, tokens or private user content.

## Required automation

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:e2e
npm run test:e2e:merchant-catalog
npx expo-doctor
npm run audit:assets
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
git diff --check
```

With protected staging access:

```bash
HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:database:location
HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:database:search
HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:database:rls
npm run smoke:database:catalog-raw
HUNGRY_SUPABASE_ADVISOR_REQUIRED=1 npm run audit:supabase:advisor-security:non-password
```

## Native QA matrix

Run on final-head iOS and Android internal-alpha artifacts:

- fresh install;
- signup/login/verification;
- force-quit and session restoration;
- all primary journey routes;
- targeted catalog RPC outage with authentication healthy;
- full network outage with restored session;
- signed-out outage;
- invalid session;
- missing configuration;
- dark mode, large text, reduced motion, VoiceOver/TalkBack;
- low-end Android scroll and image-loading smoke.

## Exit criteria

Week 3 passes only when:

- zero visible dead controls;
- zero route dead ends or feature-flag bypasses;
- zero false-success write states;
- all primary journeys pass on iOS and Android;
- authenticated Excel fallback works without route displacement;
- all legitimate no-results remain empty;
- all P0/P1 Week 3 defects are fixed and retested;
- the action matrix is fully completed with evidence.

## Week 3 QA/QC audit

| Area | Preparation status | Execution status |
|---|---:|---:|
| Scope and journey | Complete | Pending |
| Action classification | Template ready | Pending inventory |
| Issue intake | Forms ready | Pending live use |
| Automated commands | Defined | Pending final SHA |
| Native matrix | Defined | Blocked until artifacts |
| Production readiness | Not claimable | No-Go until exit criteria pass |

## Blockers inherited from Week 1–2

- GitHub Actions billing/required checks;
- Supabase HTTP 402 capacity, migration reconciliation and Advisor findings;
- secure staging credentials/base URL;
- final-head iOS and Android artifacts;
- five internal testers.
