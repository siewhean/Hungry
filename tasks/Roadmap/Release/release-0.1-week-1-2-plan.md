# Hungry Release 0.1 — Week 1 and Week 2 Completion Plan

Updated: 2026-07-24  
Branch: `codex/catalog-excel-fallback-audit`  
PR: #44  
Verdict: **No-Go until every completion gate below has current evidence.**

## Governing product policy

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

- Hungry has no guest mode.
- Main app routes are unavailable before authentication.
- Supabase is mandatory for authentication and every shared write.
- Supabase is the primary catalog source.
- Excel is an authenticated, read-only catalog fallback only for classified catalog network, timeout, RPC, release, or availability failures.
- Missing configuration, failed authentication, signed-out state, missing/invalid/revoked sessions, and legitimate no-results must never receive Excel fallback data.
- A failed write must never be presented as successful.

## Release 0.1 product promise

> An authenticated user can reliably find a real dish or stall in the Jurong East pilot area, open accurate details, and save a dish, with clear source, loading, empty, offline, and error behavior.

The Week 1–2 release surface is deliberately narrow:

- onboarding and mandatory authentication;
- Discover;
- dish and stall search;
- paged Browse Dishes and Browse Stalls;
- dish detail;
- stall detail and venue menu;
- favourites only after end-to-end write/rehydration proof;
- essential profile/settings, sign-out, support, privacy, and account deletion;
- authenticated read-only Excel catalog fallback.

Social feed, posts, reviews, Activity, Reads, map, Wheel, Crave, DMs, stories, comments, collections, gamification, merchant centre, floorplans, OAuth providers, prototypes, and admin/developer surfaces remain disabled in staging and production unless a separate release gate explicitly enables them.

# Week 1 — Release foundation

## 1. Scope freeze

Status: **implemented in branch; verification pending**

Evidence expected:

- `src/constants/featureFlags.ts` defaults staging and production to Release 0.1 core only;
- `eas.json` internal-alpha, preview, and production profiles explicitly disable deferred surfaces;
- released tab bar exposes only approved routes;
- deferred root routes and deep links cannot be opened through stale state or direct navigation.

Completion gate:

- source contracts, Playwright, and native route tests pass for every deferred route;
- no visible dead control exists in the installed alpha.

## 2. Active integration line

Status: **PR #44 is the runtime integration line**

Required:

- reconcile latest `main`;
- preserve PR #43 raw catalog performance and non-consumer exclusions;
- resolve overlaps with repository-hygiene documentation deliberately;
- no additional broad feature branch may be merged into Release 0.1.

## 3. Pilot geography

Status: **Jurong East selected; quantitative proof pending**

Current source:

- `src/constants/release01.ts`
- `scripts/audit-release-01-catalog.mjs`
- `src/lib/services/catalog/release01Pilot.test.ts`

Completion gate:

- pilot thresholds pass against the exact final bundled catalog;
- the same pilot records pass against staging Supabase;
- every promoted pilot record opens a valid same-source detail page;
- pilot-specific screenshots and audit output are attached.

## 4. Environment separation

Status: **configuration exists; owner-controlled proof pending**

Required environments:

- development;
- internal-alpha/staging;
- production.

Completion gate:

- Supabase, EAS, Sentry, and analytics environment names are documented;
- secret names are configured without exposing values;
- preview/internal-alpha points to staging Supabase;
- production points to production Supabase;
- a production-like build with missing public Supabase configuration blocks app entry.

## 5. Internal-alpha build

Status: **EAS profile exists; binary not yet proven**

Required:

```bash
eas build --profile internal-alpha --platform ios
eas build --profile internal-alpha --platform android
```

Completion gate:

- iOS artifact installs and launches;
- Android artifact installs and launches;
- commit SHA, build IDs, device/OS, screenshots, and smoke results are recorded;
- at least five internal testers can access the build.

# Week 2 — Data rescue and catalog trust

## 1. Catalog error classification

Status: **implemented; automated and runtime proof pending**

Required categories:

- authentication required;
- session invalid/revoked;
- configuration missing;
- network failure;
- RPC failure;
- catalog unavailable;
- successful no-results.

Completion gate:

- only network/RPC/catalog availability errors are fallback-eligible;
- invalid sessions clear account state and return to auth;
- successful zero-result queries remain empty.

## 2. Golden catalog

Status: **intent probes added; pilot-specific record manifest still required**

Current intent probes include chicken rice, laksa, nasi lemak, char kway teow, roti prata, fish soup, wanton mee, yong tau foo, bak kut teh, and curry puff.

Before completion, create a stable pilot manifest with at least:

- 10 exact Jurong East dish IDs;
- 10 exact Jurong East venue IDs;
- expected names and relationships;
- expected source/release ID;
- expected image and rights state;
- expected coordinates where applicable;
- exact search terms;
- expected detail/menu route behavior;
- one legitimate no-results query;
- one authenticated Excel fallback record.

Completion gate:

- every manifest case passes against staging Supabase and bundled Excel where applicable.

## 3. Catalog diagnostics

Status: **Discover diagnostics implemented; complete catalog coverage pending**

Diagnostics must cover:

- Discover dish page;
- Discover venue page;
- Browse Dishes;
- Browse Stalls;
- search;
- dish detail;
- stall detail;
- venue menu;
- map if enabled later.

Record only privacy-safe fields:

- operation;
- source;
- release ID;
- result count;
- duration;
- error category;
- fallback attempted/used;
- query-present boolean;
- cursor-present boolean;
- filter counts.

Do not record raw search terms, access tokens, email, user IDs, or precise location.

## 4. Image trust

Status: **screen-level filtering exists; shared-source sanitization and runtime proof pending**

Required priority:

- dish: approved menu/gallery image → primary dish image → neutral unavailable state;
- venue: stall logo → stall image → representative menu dish image → neutral unavailable state.

Blocked sources include Unsplash, generic placeholder services, and generic social-hero assets.

Completion gate:

- sanitization happens in the shared catalog mapping boundary, not only in individual screens;
- Discover, Browse, Search, details, and venue menus receive the same sanitized image contract;
- failed remote hosts fall back without layout failure;
- pilot image coverage meets the threshold.

## 5. Source continuity and paging

Status: **implemented; current runtime proof pending**

Completion gate:

- at least three Supabase pages load with no accidental duplicates;
- at least three Excel fallback pages load with no accidental duplicates;
- detail and menu navigation retain the source/release ID;
- no fallback page is available after sign-out or session invalidation.

## 6. Staging Supabase proof

Status: **pending credentials and execution**

Run:

```bash
npm run audit:supabase:advisor-security:non-password
npm run smoke:supabase-canonical-food-business-staging
npm run smoke:supabase-full-audit-v1
npm run smoke:database:location
npm run smoke:database:search
npm run smoke:database:rls
npm run smoke:database:catalog-raw
```

A skipped credential-gated check is not a pass.

# Automated completion gate

Run from a clean checkout of the final PR commit:

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run audit:assets
node scripts/audit-release-01-catalog.mjs
npm run test
npm run test:e2e
npm run test:e2e:merchant-catalog
npx expo-doctor --non-interactive
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
npm run release:ready:local
git diff --check
```

Every failure must be fixed. Record exact commands, timestamps, commit SHA, and outputs in `tasks/verification.md` and the Week 1–2 completion report.

# Native completion gate

Use Build iOS Apps/XcodeBuildMCP and an Android device/emulator to prove:

1. fresh install → onboarding → mandatory auth;
2. no guest/skip path;
3. valid session restore;
4. sign-out denial of catalog access;
5. healthy Supabase Discover/Search/Browse/details;
6. real menu/stall images;
7. targeted catalog outage while auth remains healthy;
8. authenticated Excel fallback;
9. signed-out outage denial;
10. invalid/revoked session denial;
11. missing configuration block;
12. legitimate no-results;
13. three pages of dishes and stalls without duplicates;
14. no false write success.

# Week 1–2 definition of done

Week 1 and Week 2 are complete only when:

- all repo-local checks are green on the final commit;
- PR #44 is updated against current `main`;
- staging Supabase checks pass;
- iOS internal-alpha build installs and passes native scenarios;
- Android internal-alpha build installs and passes native scenarios;
- the pilot catalog manifest passes;
- source/image/paging evidence is attached;
- five or more internal testers can complete the primary journey;
- all remaining blockers are external owner decisions rather than code defects.

Until then, the production verdict remains **No-Go**.