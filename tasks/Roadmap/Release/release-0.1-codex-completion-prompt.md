# Codex Prompt — Complete Hungry Release 0.1 Week 1 and Week 2

Use this prompt in Codex with the Hungry repository and Build iOS Apps tools available.

```text
You are working on:

Repository: siewhean/Hungry
Branch: codex/catalog-excel-fallback-audit
Pull request: #44

Your task is to finish Hungry Release 0.1 Week 1 and Week 2 completely. This is an implementation, debugging, automated-test, staging, native-build, and evidence task—not a planning-only task.

Read first:

- the attached mandatory-authenticated-Excel-fallback specification;
- `tasks/Roadmap/Release/release-0.1-week-1-2-plan.md`;
- `tasks/Roadmap/Release/release-0.1-board.md`;
- `tasks/Roadmap/Release/release-0.1-environment-matrix.md`;
- `tasks/Roadmap/Release/release-0.1-pilot-catalog.md`;
- `tasks/Roadmap/Release/release-0.1-internal-alpha-checklist.md`;
- `tasks/Roadmap/Release/release-0.1-week-1-2-completion-report.md`;
- `tasks/Roadmap/Audit/catalog-display-and-excel-fallback-audit-2026-07-21.md`;
- `src/constants/featureFlags.ts`;
- `src/constants/release01.ts`;
- `src/lib/services/catalog/**`;
- `src/lib/services/serviceProvider.ts`;
- `src/lib/services/supabase/client.ts`;
- `src/store/useSessionStore.ts`;
- app bootstrap/auth/onboarding/navigation/deep-link files;
- Discover, Browse/Search, catalog detail, Profile and Settings screens;
- `.github/workflows/ci.yml`;
- `eas.json`;
- `package.json`.

## Governing product policy

Hungry has no guest mode.

Required flow:

Splash
→ Onboarding
→ Create Account / Sign In
→ verification when required
→ authenticated app

Main application routes must never be available before authentication.

Supabase is mandatory for authentication and every shared write. Supabase is the primary catalog source. Excel is an authenticated, read-only catalog fallback only for classified catalog network, timeout, RPC, release, or availability failures.

Do not use Excel for:

- missing or failed authentication;
- signed-out state;
- missing, invalid, expired, or revoked session;
- missing staging/production Supabase configuration;
- failed signup/login;
- deep-link bypass;
- legitimate successful no-results.

Do not convert failed Supabase writes into local or Excel success.

## Release 0.1 scope

Keep only the reliable core food-decision loop in staging and production:

- onboarding and mandatory auth;
- Discover;
- dish/stall search;
- paged Browse Dishes and Browse Stalls;
- dish detail;
- stall detail and venue menu;
- favourites only if write and rehydration proof passes;
- essential Profile/Settings, sign-out, privacy/support/account deletion;
- authenticated Excel catalog fallback.

Keep disabled in staging and production unless explicitly needed for a single isolated QA test:

- social Home feed;
- posts;
- reviews;
- Activity;
- Reads;
- Map;
- Wheel;
- Crave;
- DMs/comments/stories;
- Passport/missions/gamification;
- collections/checklists/portfolios;
- merchant centre/claims;
- floorplans;
- OAuth providers;
- prototype/admin/developer routes.

Do not leave a visible dead button, placeholder route, fake count, fake success, or “coming soon” control in the internal-alpha build.

# Phase 0 — Establish the true baseline

1. Fetch latest `main`.
2. Rebase or merge `main` into `codex/catalog-excel-fallback-audit` using the repository’s preferred workflow.
3. Preserve the PR #43 raw catalog query optimisation, non-consumer exclusions, map exclusions, and smoke SQL already reconciled into #44.
4. Resolve overlaps with repository-hygiene/documentation work deliberately.
5. Confirm the working tree is clean before running gates.
6. Record the starting and final commit SHAs.

Run immediately:

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

The current GitHub CI and Security workflows have failed on the branch. Determine the real failing step locally or from Actions, fix it, push, and repeat until both workflows are green. Do not call an unavailable log or skipped check a pass.

# Phase 1 — Finish Release 0.1 scope gating

Audit `featureFlags`, `SwipeableTabNavigator`, `RootNavigator`, Profile stack, deep links, saved return routes, notifications if present, and stale persisted navigation.

Required behavior in staging/production:

- only approved Release 0.1 tabs/entry points are visible;
- deferred root screens are not registered or are rejected by an explicit safe unavailable/not-found path;
- deferred deep links are absent/rejected;
- stale state cannot reopen disabled routes;
- no internal/prototype/developer/admin/merchant route is reachable;
- no create/review/social control remains visible when the feature is off.

Pay special attention to root routes that may still be registered unconditionally, including Post, ReviewStack, WheelStack, Activity, Reads/BlogPost, Music Selection, Decide For Me, Quick Bites, Crave, and Map. Gate them using the corresponding Release 0.1 feature flags and add source/E2E/native regression tests.

Add or update tests proving every deferred route fails closed in production and internal-alpha configurations.

# Phase 2 — Complete data-source and session safety

Verify and fix:

- released builds always choose Supabase as the app/auth/write provider;
- missing released-build Supabase configuration produces a blocking configuration screen;
- session restoration trusts only the SecureStore-backed Supabase session, not persisted metadata alone;
- sign-out and invalid-session paths clear account-scoped state and Excel access;
- only typed network/RPC/catalog-unavailable errors invoke fallback;
- legitimate empty results remain empty;
- fallback reads retain stable `excel-fallback-*` release IDs;
- fallback exposes no write methods and no write UI reports false success.

Add focused tests for each state in the attached specification.

# Phase 3 — Centralize catalog image trust

The current code has screen-level filtering. Move the release image policy into a shared catalog mapping/sanitization boundary used by both Supabase and Excel outputs.

Required behavior:

Dish:
1. approved menu/gallery image;
2. approved primary dish image;
3. neutral unavailable state.

Venue:
1. stall logo;
2. stall/venue image;
3. representative menu dish image;
4. neutral unavailable state.

Reject generic sources such as Unsplash, Picsum, placeholder domains, generic social-hero assets, malformed/non-HTTP URLs, and unapproved media where the rights contract requires approval.

Ensure Discover, Browse Dishes, Browse Stalls, search, dish detail, stall detail, and venue menu all receive the same sanitized contract. Add tests for blocked hosts, malformed URLs, expired-image UI fallback, and source priority.

# Phase 4 — Complete catalog diagnostics

Existing diagnostics cover primary Discover reads. Extend the privacy-safe diagnostics to:

- Browse Dishes;
- Browse Stalls;
- search;
- dish detail;
- stall detail;
- venue menu;
- map only if it is enabled later.

Record only:

- operation;
- source;
- release ID;
- result count;
- duration;
- typed error category;
- fallback attempted/used;
- query-present boolean;
- cursor-present boolean;
- radius and filter counts.

Never record raw query text, exact user coordinates, email, user ID, access/refresh tokens, or credentials.

Add source tests and render the diagnostics UI only in development/internal-alpha/staging—not production.

# Phase 5 — Finish the Jurong East golden catalog

Run:

```bash
node scripts/audit-release-01-catalog.mjs
```

Fix the catalog, exporter, thresholds, or test logic based on actual evidence. Do not weaken thresholds merely to make the test green without documenting the reason.

Complete `tasks/Roadmap/Release/release-0.1-pilot-catalog.md` with:

- 10 exact Jurong East dish IDs;
- 10 exact Jurong East venue IDs;
- expected names and relationships;
- expected source/release IDs;
- expected image/rights state;
- expected coordinates where applicable;
- exact search terms;
- detail/menu expectations;
- one legitimate no-results query;
- one authenticated Excel fallback case.

Update the automated test so exact stable pilot cases are validated, not only broad catalog-wide search terms.

Run equivalent staging Supabase queries and compare the exact pilot rows. Quarantine rather than silently display invalid, non-consumer, duplicate, unapproved, or broken records.

# Phase 6 — Paging and source continuity

Using tests and rendered app behavior, verify:

- at least three Supabase dish pages;
- at least three Supabase stall pages;
- at least three Excel dish pages;
- at least three Excel stall pages;
- no accidental repeated stable IDs;
- detail and venue-menu navigation remain on the page source/release;
- filtered no-results stay empty;
- changing filters/query resets cursor/release safely.

Add assertions and attach ID/source lists to the completion report.

# Phase 7 — Staging Supabase proof

With owner-approved staging credentials, run and fix:

```bash
HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:database:location
HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:database:search
HUNGRY_SUPABASE_SMOKE_REQUIRED=1 npm run smoke:database:rls
npm run smoke:database:catalog-raw
npm run audit:supabase:advisor-security:non-password
npm run smoke:supabase-canonical-food-business-staging
npm run smoke:supabase-full-audit-v1
```

A skipped check is blocked, not passed. Record the active catalog release ID, totals, RLS result, and advisor result.

# Phase 8 — Build iOS Apps/XcodeBuildMCP verification

Use the `ios-debugger-agent` workflow exactly:

1. call `list_sims`;
2. select a booted simulator; if none is booted, ask the owner to boot one;
3. set session defaults with Hungry workspace/project, scheme, and simulator ID;
4. build and run;
5. fix build failures before UI interaction;
6. call `describe_ui` and capture a screenshot;
7. start simulator log capture with console output;
8. inspect the rendered UI before changing layout;
9. rerun after each fix.

Test:

A. Fresh install
- Splash;
- onboarding;
- mandatory account screen;
- no guest/skip controls;
- protected deep-link denial.

B. Valid auth
- account creation/sign-in;
- verification if required;
- MainTabs only after success;
- kill/relaunch session restore;
- sign-out returns to auth.

C. Healthy Supabase
- Discover;
- real menu/stall images;
- Browse Dishes/Stalls three pages;
- search/filter;
- dish detail;
- stall detail/menu;
- legitimate no-results.

D. Targeted catalog outage with auth healthy
- intercept/fail catalog RPCs without disabling auth;
- Excel source appears;
- read-only paging/search/details work;
- no enabled write falsely succeeds.

E. Signed-out outage
- sign out;
- disable network/catalog;
- app remains in auth;
- no Excel access.

F. Invalid/revoked session
- revoke session;
- clear account state;
- auth only;
- no Excel access.

G. Missing configuration
- production-like build without public Supabase configuration;
- blocking configuration state;
- no MainTabs.

Also inspect safe areas, tab overlap, image aspect ratio, loading/empty/error/offline states, dark mode, large text, reduced motion, keyboard behavior, touch targets, and VoiceOver labels.

Capture screenshots, UI hierarchy, logs, build profile, commit SHA, simulator model, and iOS version.

# Phase 9 — Android internal alpha

Build and install:

```bash
eas build --profile internal-alpha --platform android
```

Repeat the core scenarios on a recent and lower-end representative Android device/emulator. Run TalkBack/large-text smoke and record build ID, device, OS, screenshots, and logs.

# Phase 10 — Internal alpha distribution

Build iOS and Android internal-alpha artifacts:

```bash
eas build --profile internal-alpha --platform ios
eas build --profile internal-alpha --platform android
```

Give access to at least five internal testers. Do not commit passwords.

Each tester must:

1. sign up/sign in;
2. select or deny location and use Jurong East as needed;
3. find a named dish;
4. open its dish and stall details;
5. save it if favourites passed release proof;
6. report one bad-data or broken-control issue.

Fix all P0/P1 beta findings and cut a new alpha build before declaring Week 1–2 complete.

# Phase 11 — Documentation and evidence

Update:

- `tasks/Roadmap/Release/release-0.1-board.md`;
- `tasks/Roadmap/Release/release-0.1-pilot-catalog.md`;
- `tasks/Roadmap/Release/release-0.1-internal-alpha-checklist.md`;
- `tasks/Roadmap/Release/release-0.1-week-1-2-completion-report.md`;
- `tasks/Roadmap/Audit/catalog-display-and-excel-fallback-audit-2026-07-21.md`;
- `tasks/verification.md`;
- PR #44 description.

Record exact pass/fail/blocked status. Historical evidence from older commits does not prove the final commit.

# Definition of done

Do not stop the repo-local loop until:

- typecheck, lint, format, assets, pilot audit, tests, Playwright, Expo Doctor, Supabase static, Edge, security, release gate, and diff check pass;
- GitHub CI and Security are green on the final SHA;
- PR #44 is current with `main` and mergeable;
- every deferred route/control is absent or safely gated;
- exact Jurong East golden cases pass;
- centralized image policy passes;
- diagnostics cover all Release 0.1 catalog reads;
- three-page Supabase and Excel paging passes;
- staging Supabase/advisor/RLS/catalog checks pass without skips;
- iOS internal alpha installs and passes all scenarios;
- Android internal alpha installs and passes all scenarios;
- five internal testers complete the primary journey;
- completion report contains evidence.

If an external credential or owner action is unavailable, complete every other item, mark only that item blocked, list the exact secret name/account/device/action required without exposing values, and do not call Week 1–2 complete. Resume and finish once access is provided.

Final response format:

1. final commit SHA;
2. files changed;
3. CI/Security failure root causes and fixes;
4. automated command results;
5. staging Supabase results;
6. Jurong East manifest and audit results;
7. image/source/paging results;
8. iOS build and screenshots/logs;
9. Android build and screenshots/logs;
10. internal tester results;
11. remaining external blockers, if any;
12. final verdict: Week 1–2 Complete / Go Candidate / No-Go.
```
