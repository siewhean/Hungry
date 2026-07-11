# Hungry App Store + Google Play Pre-Launch QA/QC Checklist

> Scope: Hungry mobile app, Expo/React Native app shell, Supabase-backed features, public web/e2e app surface, Playwright tests, Maestro/native smoke, security, prefetching, privacy, UGC, App Store Review, and Google Play policy readiness.
> Branch context: `frontend-design-overhaul`
> Status rule: **No production release until every P0 gate passes.**
> Use this file as the pre-launch checklist and as the instruction document for Codex.

---

## 1. Why this checklist exists

Hungry is not a simple static app. It includes account creation, location-aware food discovery, dish/stall search, reviews, media upload, public posts, social interactions, profile/avatar data, merchant surfaces, possible UGC moderation requirements, Supabase storage/database access, a web/Playwright testing surface, and native iOS/Android release paths.

This checklist is based on Apple App Review Guidelines, Google Play User Data/Data Safety/UGC policies, Android app quality guidance, OWASP MASVS, Supabase production-readiness expectations, Expo/EAS release behavior, and Hungry repo-specific files and scripts.

---

## 2. Store policy summary

### 2.1 Apple App Store requirements that matter for Hungry

| Apple requirement | Hungry implication |
|---|---|
| App must be tested for crashes and bugs | Test all screens on real iOS device/TestFlight. |
| Metadata must be complete and accurate | App Store screenshots, description, privacy nutrition, support URL, and account deletion URL must match the actual app. |
| App Review needs full access | Provide demo account and live/staging backend during review. |
| Apps with UGC need moderation | Posts/reviews/comments require report, block, content filtering/moderation, and contact path. |
| Account-based apps need account deletion | If Hungry lets users create accounts, account deletion must be available in app. |
| Privacy policy required | Privacy policy must identify collected data, use, third-party sharing, retention/deletion, and consent withdrawal. |
| Location usage must be relevant and consented | Hungry can use location for nearby food, but must explain and work if denied. |
| Third-party/social login may trigger equivalent-login rules | If OAuth/social login is visible, confirm Apple login/equivalent requirements are met or hide non-ready OAuth in production. |

### 2.2 Google Play requirements that matter for Hungry

| Google requirement | Hungry implication |
|---|---|
| Data Safety form must be accurate | Disclose location, media/photos, account info, analytics, crash logs, app interactions, device IDs if collected. |
| Privacy policy must be active and public | No PDF, no private/gated URL; link in Play Console and in app. |
| Account deletion required | Provide in-app and web deletion request path. |
| UGC moderation required | Posts/reviews/comments/profiles require terms acceptance, report/block, moderation action, and objectionable-content policy. |
| Location disclosure/consent required | Explain location use before/with permission request; app must work if denied. |
| App quality/stability | No crashes, ANRs, broken UI, or non-functional core flows; review Play pre-launch report. |
| Permissions must be justified | Request only permissions needed by actual features. |

---

## 3. Hungry repo-specific observations

### 3.1 Existing quality scripts

`package.json` already includes strong gates: typecheck, unit/integration tests, Playwright e2e, merchant catalog e2e, Supabase smoke/audit scripts, database location/search/RLS smoke scripts, asset audit, edge-function checks, npm audit, gitleaks, trufflehog, release readiness, and native iOS Maestro smoke flows.

### 3.2 Existing Playwright setup

The repo has Playwright configured for desktop Chromium, mobile iOS viewport, and mobile Android viewport. It starts Expo web locally with mock data for deterministic e2e. This is useful for UI coverage, but staging/production readiness also needs Supabase-backed smoke tests.

### 3.3 App config and permissions

`app.json` declares iOS location, camera, microphone, photo library, photo library add usage strings, the `hungry` URL scheme, Android fine/coarse location permissions, Sentry Expo plugin, image picker plugin, and EAS project ID. Every declared permission must be matched to a real app feature and disclosed in App Store/Google Play privacy forms.

### 3.4 Feature flags

Production-safe feature flags are mostly in place: prototype routes, merchant centre, direct messages, comments, OAuth providers, gamification, collections, and stories are non-production only; floorplans are disabled. Still, route/deep-link tests must prove production users cannot open disabled features.

### 3.5 Navigation and deep links

Root navigation protects key authenticated routes, and linking exposes public routes plus feature-flagged merchant/portfolio routes. QA must verify guest browsing stays open, protected routes redirect to auth, disabled routes do not exist in production, and deep links cannot bypass auth or flags.

### 3.6 Prefetching

Hungry has a dedicated prefetch module for images, dish/stall details, post details, route preloading, search result prefetching, and merchant tab prefetching. QA must prove prefetching never blocks navigation, never crashes, deduplicates repeated work, respects auth/merchant permissions, and does not fetch disabled or unauthorized data.

### 3.7 CI

CI already runs typecheck, lint, format, asset audit, tests, Playwright merchant catalog smoke, Supabase static audit, Supabase Security Advisor guard, edge-function static check, migration dry run when credentials exist, and Expo Doctor. External credential-backed checks must still be proven before launch.

---

## 4. Production Go/No-Go policy

### 4.1 P0 — No-Go if any fail

| Gate | Required proof |
|---|---|
| Typecheck | `npm run typecheck` passes |
| Lint | `npm run lint` passes |
| Format | `npm run format:check` passes |
| Unit/integration tests | `npm run test` passes |
| Expo Doctor | `npx expo-doctor --non-interactive` passes or accepted exceptions documented |
| Playwright app web e2e | `npm run test:e2e` passes |
| Merchant catalog Playwright | `npm run test:e2e:merchant-catalog` passes |
| Native smoke | Maestro iOS and Android smoke pass where available |
| iOS build | EAS preview/production iOS build succeeds |
| Android build | EAS preview/production Android build succeeds |
| App boots | Fresh install starts without crash |
| App Store metadata | Complete and accurate |
| Google Play Data Safety | Complete and accurate |
| Privacy policy | Public, active, accurate |
| Account deletion | In-app and web path verified |
| UGC moderation | Report/block/filter/contact if UGC enabled |
| Location denial | App still works when location permission denied |
| Media upload | MIME/size/ownership validation works |
| Supabase RLS | RLS smoke passes |
| Service role | Not exposed to app bundle |
| Secrets | Gitleaks/trufflehog pass |
| Sentry | Staging crash captured |
| Feature flags | Disabled production routes cannot open |
| Legal/privacy | Owner/legal sign-off completed |

### 4.2 P1 — Should pass before open beta

| Gate | Requirement |
|---|---|
| Accessibility | VoiceOver/TalkBack manual smoke passes |
| Performance | Search/detail/feed p95 targets pass in staging |
| Supabase advisors | Security/Performance Advisor issues resolved or accepted |
| Play pre-launch report | No critical crashes/ANRs/security issues |
| App Store review notes | Demo account and explanation of non-obvious features ready |
| Store screenshots | Accurate and not showing fake data |
| Offline behavior | Core screens do not crash offline |
| Rollback | OTA/binary rollback plan documented |

---

## 5. Full file-by-file cleanup strategy

Codex should not randomly edit the whole repo. It should clean systematically.

### 5.1 File inventory

Create a file inventory report:

`tasks/Roadmap/app-file-cleanup-inventory.md`

| Path | Category | Production relevance | Risk | Action |
|---|---|---|---|---|

Categories:

- app shell
- navigation
- auth
- onboarding
- home/discover/search
- detail screens
- reviews
- post/media
- profile/settings
- merchant
- admin/dev/prototype
- social/UGC
- Supabase service
- storage/media
- stores
- tests
- scripts
- native/iOS/Android
- assets
- docs
- marketing/web
- obsolete/debug/generated/temp

### 5.2 Cleanup rules

| Cleanup target | Rule |
|---|---|
| tmp/generated assets | Delete if not referenced and not needed for build |
| floorplan temp output | Keep only canonical reviewed data |
| debug/dev screenshots | Remove from production bundle |
| prototype assets | Gate behind non-production or remove |
| duplicate docs | Consolidate if outdated |
| dead code | Remove only if tests pass and no imports exist |
| commented-out code | Remove if no clear reason to keep |
| unused routes | Remove or gate with flags |
| unused permissions | Remove from app config |
| unused dependencies | Remove only after build/test passes |

---

## 6. App Store and Google Play checklist by feature

### 6.1 Auth and account lifecycle

| Check | Apple | Google Play | Hungry test |
|---|---:|---:|---|
| Signup works | ☐ | ☐ | Create staging account |
| Login works | ☐ | ☐ | Login with staging user |
| Logout clears account data | ☐ | ☐ | Logout and inspect state |
| Password reset works | ☐ | ☐ | Request/reset password |
| Email verification works | ☐ | ☐ | Verify callback |
| Guest browsing works | ☐ | ☐ | Browse without login |
| Account deletion in app | ☐ | ☐ | Settings → delete account |
| Account deletion web URL | ☐ | ☐ | Public active URL |
| Demo account ready | ☐ | n/a | App Review notes |
| Auth backend live | ☐ | ☐ | Review-ready backend |

### 6.2 Location discovery

| Check | Requirement | Hungry test |
|---|---|---|
| Permission text explains purpose | Nearby food ranking/map results | Validate iOS/Android strings |
| Denying location works | App remains usable | Deny permission and browse/search |
| Jurong East selected | Shows Jurong East food/stalls first | Run location smoke |
| Location not collected unnecessarily | Data minimization | Inspect analytics/events |
| Background location absent unless needed | Avoid if not core | Verify no background permission |
| Data Safety/App Privacy match | Declare approximate/precise location if collected | Store metadata checklist |

### 6.3 Search/discovery/detail

| Check | Requirement | Hungry test |
|---|---|---|
| Search by dish | Works quickly | Playwright/unit/Supabase search smoke |
| Search by stall | Works quickly | E2E |
| Search by area | Works quickly | Supabase location smoke |
| Missing dish | Safe NotFound/empty state | Route param test |
| Missing stall | Safe NotFound/empty state | Route param test |
| Fake ratings/hours removed | Metadata accuracy | Static/content audit |
| Detail screen accessible | VoiceOver/TalkBack | Manual |

### 6.4 Reviews and UGC

| Check | Store policy impact | Hungry test |
|---|---|---|
| Review creation requires auth | Account safety | E2E |
| Review persists | Data correctness | Supabase smoke |
| Review appears in detail/profile | UX correctness | E2E |
| Report review exists if public | UGC moderation | E2E |
| Block user exists if social is enabled | UGC moderation | E2E |
| Terms accepted or available | UGC policy | Legal/UX audit |
| Moderation status exists | UGC safety | DB audit |
| Offensive content can be handled | Store compliance | Admin/moderation flow |

### 6.5 Posts and media

| Check | Requirement | Hungry test |
|---|---|---|
| Post requires auth | Account safety | E2E |
| Media picker permission clear | Privacy | Device smoke |
| Image/video MIME validation | Security | Unit/integration |
| Upload size limits | Security/performance | Upload tests |
| Media path ownership | Storage RLS | Supabase storage smoke |
| Failed upload retry | UX | Device smoke |
| User B sees public post | Cross-user proof | Supabase/E2E |
| Report/block public post | UGC policy | E2E |
| NSFW/objectionable UGC policy | UGC policy | Moderation plan |

### 6.6 Merchant surfaces

| Check | Requirement | Hungry test |
|---|---|---|
| Merchant centre hidden in production unless approved | Store safety | Feature flag test |
| Merchant login works in staging | Business flow | E2E |
| Merchant cannot edit other outlet | Security/RLS | E2E/RLS |
| Merchant menu update persists | Data correctness | E2E |
| Audit log for merchant edit | Accountability | Integration |
| OCR drafts not public | Security | Route/RLS test |
| Merchant analytics real or labelled preview | Metadata truth | QC |

### 6.7 Social/advanced features

| Feature | Production rule |
|---|---|
| Direct messages | Off unless moderation/report/block/realtime tested |
| Stories | Off unless DB-backed and moderated |
| Comments | Off unless moderation/report/block tested |
| Passport/gamification | Off unless data-backed and not misleading |
| Collections/portfolios/checklists | Off unless selected for MVP and tested |
| Floorplans | Off unless geometry/tap QA complete |
| AI creator tools | Off unless safety/cost/disclosure complete |

---

## 7. Playwright QA plan

Playwright should cover Expo web/app web surface and merchant/website surfaces. Native app interaction still needs Maestro/manual device QA.

### 7.1 Existing projects

Use the current Playwright projects:

- desktop Chromium
- mobile iOS-like project
- mobile Android-like project

### 7.2 Required Playwright suites

Create or update:

```text
tests/e2e/app-public-browse.spec.ts
tests/e2e/app-auth-gates.spec.ts
tests/e2e/app-search-discovery.spec.ts
tests/e2e/app-detail-pages.spec.ts
tests/e2e/app-review-flow.spec.ts
tests/e2e/app-post-composer.spec.ts
tests/e2e/app-feature-flags-production.spec.ts
tests/e2e/app-prefetch-contracts.spec.ts
tests/e2e/app-security-routes.spec.ts
tests/e2e/app-accessibility-smoke.spec.ts
tests/e2e/merchant-auth-rbac.spec.ts
tests/e2e/merchant-catalog.spec.ts
tests/e2e/admin-route-security.spec.ts
```

### 7.3 Playwright scenarios

#### Public browse

- Start as guest.
- Confirm Home loads.
- Navigate to Discover.
- Search dish.
- Open Dish Detail.
- Open Stall Detail.
- Deny/disable mock location and verify fallback.

#### Auth gates

- Guest taps Profile.
- Guest taps Save.
- Guest taps Review.
- Guest taps Post.
- Verify redirect to Login.
- Verify return route after login.

#### Feature flags

Set production env:

```bash
EXPO_PUBLIC_APP_ENV=production
```

Verify no DeveloperLauncher, DesignGallery, MerchantTabs, DMs, Stories, PostComposerV2 if prototype-only, AdminPortfolioFlags, floorplans, collections/gamification unless explicitly approved.

#### Prefetching

Verify repeated search does not spam network, invalid image URI does not crash, prefetch failure does not alter navigation, disabled merchant route does not prefetch merchant data in production, and unauthorized merchant prefetch fails silently and safely.

#### Security route tests

- deep link disabled route → NotFound/Login
- deep link protected route while guest → Login
- direct merchant URL while normal user → Forbidden/Login
- admin route while non-admin → Forbidden
- auth callback with invalid code → safe error

---

## 8. Native / Maestro / manual QA plan

Playwright is not enough for store readiness. Native QA must cover real devices.

### 8.1 Device matrix

| Device | OS | Required |
|---|---|---:|
| iPhone recent | latest iOS | yes |
| iPhone older supported | oldest supported iOS | yes |
| Android Pixel/modern | latest Android | yes |
| Android lower-end | older supported Android | yes |
| Tablet/iPad if supported | iPadOS | if supported |
| Small screen Android | Android | recommended |

### 8.2 Native flows

- app boot
- onboarding
- login/signup
- email verification callback
- location permission allow/deny
- camera permission allow/deny
- photo picker permission allow/deny
- review media upload
- post media upload
- profile image update
- push/deep link if supported
- offline/airplane mode
- background/foreground
- killed/reopened
- logout and reinstall

### 8.3 Required Maestro flows

Create/update:

```text
.maestro/ios-app-launch-smoke.yaml
.maestro/ios-auth-smoke.yaml
.maestro/ios-guest-browse-smoke.yaml
.maestro/ios-media-picker-permission.yaml
.maestro/ios-location-denied-smoke.yaml
.maestro/ios-review-post-smoke.yaml
.maestro/ios-feature-flag-production-smoke.yaml
.maestro/android-app-launch-smoke.yaml
.maestro/android-guest-browse-smoke.yaml
.maestro/android-media-permission-smoke.yaml
```

---

## 9. Security QA plan

### 9.1 Static checks

Run:

```bash
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
```

Add or verify:

- client bundle secret scan
- `app.json` permission audit
- `eas.json` env audit
- `.env.example` placeholder audit
- Supabase anon/service-role leak audit
- log statement audit
- deep link scheme audit
- AsyncStorage/SecureStore audit

### 9.2 Storage checks

- tokens only in SecureStore/encrypted storage
- AsyncStorage only contains non-sensitive cache/settings
- sign-out clears account-scoped stores
- media uploads use signed/owned paths
- no service-role key client-side

### 9.3 Supabase checks

Run:

```bash
npm run audit:supabase:static
npm run smoke:database:rls
npm run smoke:supabase-full-audit-v1
npm run audit:supabase:advisor-security:non-password
```

### 9.4 Abuse checks

- rate limit public write endpoints
- report/block public UGC
- no fake interaction counts
- no anonymous harassment paths
- moderation queue exists for reports
- contact/support path exists

---

## 10. Prefetch QA plan

Prefetching must improve UX but never affect correctness or security.

### 10.1 Prefetch correctness

| Check | Pass criteria |
|---|---|
| Dish prefetch | Caches images/details without blocking |
| Stall prefetch | Caches images/details without blocking |
| Post prefetch | Caches author/media/dish/stall refs safely |
| Search prefetch | Does not trigger visible navigation |
| Route preload | Does not throw if route unavailable |
| Merchant prefetch | Only runs for authorized merchant context |
| Duplicate prefetch | Deduplicated |
| Failed prefetch | Silent failure, no crash |
| Production disabled routes | Not prefetched |

### 10.2 Prefetch performance

Measure image prefetch count, network calls per search keystroke, memory increase after scrolling, repeated navigation memory behavior, prefetch impact on low-end Android, and cache eviction behavior.

### 10.3 Tests to add

```text
src/app/performance-prefetch-contracts.test.ts
tests/e2e/app-prefetch-contracts.spec.ts
```

Test cases:

- invalid image URI does not throw
- duplicate image not prefetched twice
- invalid dish ID does not throw
- invalid venue ID does not throw
- prefetchBrowseResults ignores blank query
- merchant prefetch does not run for unauthorized user
- production flags prevent disabled route preloads

---

## 11. App Store metadata and submission checklist

### 11.1 Apple

| Item | Status |
|---|---:|
| App name accurate and <= platform limit | ☐ |
| Subtitle accurate and within field limit | ☐ |
| Description accurate, no unsupported features | ☐ |
| Keywords relevant, not spammy, no competitor misuse | ☐ |
| Promotional text accurate | ☐ |
| Screenshots accurate | ☐ |
| App preview accurate | ☐ |
| Support URL works | ☐ |
| Privacy URL works | ☐ |
| Account deletion in app | ☐ |
| Demo account provided | ☐ |
| Backend live for review | ☐ |
| Review notes explain merchant/social/location features | ☐ |
| UGC moderation note included | ☐ |
| Age rating answers accurate | ☐ |
| App privacy nutrition accurate | ☐ |
| Screenshot/image rights checked | ☐ |
| No real personal data in screenshots | ☐ |
| No placeholder content | ☐ |
| No fake claims | ☐ |

### 11.2 Google Play

| Item | Status |
|---|---:|
| Store title accurate and <= 30 characters | ☐ |
| Short description accurate and <= 80 characters | ☐ |
| Full description accurate, natural, and not keyword-stuffed | ☐ |
| Screenshots accurate | ☐ |
| Feature graphic/icon/video accurate and rights-cleared | ☐ |
| Privacy policy public active URL | ☐ |
| Data Safety complete and accurate | ☐ |
| Account deletion URL provided | ☐ |
| In-app account deletion path | ☐ |
| Content rating questionnaire accurate | ☐ |
| App access instructions provided | ☐ |
| Target audience selected correctly | ☐ |
| Ads declaration accurate | ☐ |
| Permissions declaration accurate | ☐ |
| Location declaration accurate if required | ☐ |
| UGC declaration and moderation evidence complete | ☐ |
| App Bundle build uploaded | ☐ |
| Internal/closed test track verified | ☐ |
| Pre-launch report reviewed | ☐ |
| Android Vitals reviewed | ☐ |

### 11.3 Reviewer Notes Template

Use this as a store-console draft only. It is not proof until the submitted binary, backend, URLs, and reviewer account are live.

| Note | Required content |
|---|---|
| Reviewer account | Email, password, 2FA state, seeded profile, and any reset/expiry constraints. |
| Test path | Sign in, set/deny location, browse Discover, open Dish Detail, open Stall Detail, save/favourite, submit review/post if UGC is enabled, open account deletion path. |
| Backend state | Supabase project/environment is live, storage and Edge Functions are reachable, and email/auth callbacks are enabled for review. |
| Disabled surfaces | Name disabled production features so reviewers do not search for unfinished OAuth, floorplan, prototype, social, merchant, or gamification paths if they are excluded. |
| UGC moderation | If UGC is enabled, name where users accept terms, report content/users, block users, and how moderation is handled. |
| Permissions | Explain nearby food use for location and media upload use for camera/photos; do not include microphone unless audio/video capture is actually enabled. |
| Account deletion | Provide in-app path and public deletion URL. |
| Support contact | Provide reachable support/privacy contact. |

---

## 12. Data Safety / App Privacy mapping for Hungry

Create:

`tasks/Roadmap/app-store-data-safety-mapping.md`

| Data type | Collected? | Shared? | Purpose | Required/optional | User control | Store disclosure |
|---|---:|---:|---|---|---|---|
| Email |  |  | Account/auth |  | Delete account |  |
| Display name |  |  | Profile |  | Edit/delete |  |
| Avatar/photo |  |  | Profile/post/review |  | Edit/delete |  |
| Location |  |  | Nearby discovery |  | Deny permission |  |
| Search queries |  |  | Discovery/personalization |  | Privacy setting |  |
| Reviews |  |  | Public content |  | Delete/report |  |
| Posts/media |  |  | Public content |  | Delete/report |  |
| Device ID |  |  | Analytics/crash |  | Privacy controls |  |
| Crash logs |  |  | App stability |  | Privacy policy |  |
| App interactions |  |  | Analytics |  | Privacy controls |  |
| Merchant business data |  |  | Merchant portal |  | Account controls |  |

---

## 13. Clean-up checklist before launch

### 13.1 Remove or gate

- dev launcher
- design gallery
- prototype routes
- merchant centre if unapproved
- admin screens
- DMs
- stories
- unfinished gamification
- floorplans
- stale mock screenshots
- debug logs
- fake counts/ratings/hours
- unused temp data
- unreviewed OCR drafts
- local-only public feeds

### 13.2 Confirm assets

- app icon final
- splash screen final
- image sizes acceptable
- no copyrighted/unlicensed assets
- all marketing screenshots use fictional accounts
- no real user data in screenshots
- all food images have source/rights if public

### 13.3 Confirm docs

- privacy policy final
- terms final
- support/contact final
- account deletion final
- UGC policy/community standards final
- App Store/Play Store review notes final

---

## 14. Required commands

Run all:

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

If credentials exist:

```bash
npm run audit:supabase:advisor-security:non-password
npm run smoke:supabase-full-audit-v1
npm run smoke:supabase-social-gamification
npm run smoke:ocr-staging
```

Native:

```bash
npm run smoke:native:ios:prepared
npm run smoke:native:ios:media:prepared
npm run smoke:native:ios:chat:prepared
eas build --profile preview --platform all
eas build --profile production --platform all
```

---

## 15. Reports to create

Codex should create/update:

```text
tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md
tasks/Roadmap/app-file-cleanup-inventory.md
tasks/Roadmap/app-store-data-safety-mapping.md
tasks/Roadmap/app-store-submission-qc-report.md
tasks/Roadmap/google-play-submission-qc-report.md
tasks/Roadmap/app-route-feature-flag-qc-report.md
tasks/Roadmap/app-playwright-prelaunch-report.md
tasks/Roadmap/app-maestro-native-smoke-report.md
tasks/Roadmap/app-prefetch-qc-report.md
tasks/Roadmap/app-security-qc-report.md
tasks/Roadmap/app-privacy-permissions-qc-report.md
tasks/Roadmap/app-ugc-moderation-qc-report.md
tasks/Roadmap/app-final-prelaunch-go-nogo.md
```

---

# 16. Codex Prompt

```text
You are working on the Hungry repository, especially the `frontend-design-overhaul` branch.

Your task is to perform a complete pre-launch QA/QC audit for Hungry against Apple App Store and Google Play requirements, then clean up the repo safely.

Read first:
- `tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md`
- `package.json`
- `app.json`
- `eas.json`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/linking.ts`
- `src/features/navigation/prefetch.ts`
- `src/store/**`
- `src/lib/services/**`
- `src/app/screens/**`
- `supabase/migrations/**`
- `scripts/**`
- `.maestro/**`
- `marketing/**`
- `SECURITY.md`
- `README.md`

Do not trust existing docs. Verify against code.

## Goal

Make Hungry ready for App Store and Google Play pre-launch review.

The app must be safe, secure, stable, privacy-compliant, store-policy-compliant, accessible, tested, and cleaned of unfinished production risks.

## Non-negotiable rules

1. Do not add unrelated product features.
2. Do not enable unfinished features in production.
3. Do not delete files unless unused and verified.
4. Do not commit secrets.
5. Do not claim production readiness unless every P0 gate passes.
6. Keep Supabase service-role keys server-only.
7. Treat Zustand as cache/optimistic state, not canonical source for shared data.
8. Production must not expose dev/prototype/admin/merchant/social features unless approved and tested.
9. Any UGC visible to users must have report/block/moderation/contact path.
10. Store privacy disclosures must match actual app behavior.

## Phase 1 — Full file inventory and cleanup plan

Create:
`tasks/Roadmap/app-file-cleanup-inventory.md`

Inventory every file and classify it:
- app shell
- navigation
- auth
- onboarding
- home/discover/search
- detail
- reviews
- post/media
- profile/settings
- merchant
- admin/dev/prototype
- social/UGC
- Supabase service
- storage/media
- stores
- tests
- scripts
- native/iOS/Android
- assets
- docs
- marketing/web
- obsolete/debug/generated/temp

For each file, decide:
- keep
- clean
- gate
- move
- delete
- needs human review

Do not delete yet unless safe. Record rationale.

## Phase 2 — App Store and Google Play policy mapping

Create:
- `tasks/Roadmap/app-store-submission-qc-report.md`
- `tasks/Roadmap/google-play-submission-qc-report.md`
- `tasks/Roadmap/app-store-data-safety-mapping.md`

Map Hungry features to Apple and Google Play requirements.
Do not invent answers. Mark unknown as blocker.

## Phase 3 — Feature flags and route exposure

Audit:
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `src/app/navigation/linking.ts`
- all route tests

Create:
`tasks/Roadmap/app-route-feature-flag-qc-report.md`

Add tests proving production cannot open:
- DeveloperLauncher
- DesignGallery
- prototype routes
- MerchantTabs unless approved
- DirectMessages
- ChatDetail
- StoryViewer
- AddStory
- floorplan routes
- Passport/Missions if gamification off
- Collection routes if collections off
- AdminPortfolioFlags
- any dev/admin route

Test bypass paths:
- direct navigation
- deep links
- auth return route
- stale persisted state
- notification payload if present

## Phase 4 — Playwright pre-launch verification

Create:
`tasks/Roadmap/app-playwright-prelaunch-report.md`

Add/update Playwright tests:
- public guest browse
- auth gates
- search/discovery
- detail screens
- review flow
- post composer
- production feature flags
- prefetch contracts
- route security
- web accessibility smoke
- merchant RBAC
- admin route security

Use existing Playwright projects:
- desktop Chromium
- mobile iOS
- mobile Android

Remember: Playwright validates Expo web behavior. Native app behavior still needs Maestro/manual checks.

## Phase 5 — Native Maestro and device QA

Create:
`tasks/Roadmap/app-maestro-native-smoke-report.md`

Add/update Maestro flows for:
- app launch
- onboarding
- guest browsing
- login/signup
- location permission denied
- media picker permission
- review submit
- post/media upload
- production feature flag exposure
- offline state
- logout

Add Android equivalents if missing.

## Phase 6 — Security and privacy cleanup

Create:
- `tasks/Roadmap/app-security-qc-report.md`
- `tasks/Roadmap/app-privacy-permissions-qc-report.md`

Audit:
- app config permissions
- env usage
- AsyncStorage/SecureStore usage
- logs
- app bundle secret exposure
- service-role leaks
- deep links
- OAuth callback handling
- media upload validation
- storage policies
- location disclosure
- camera/photo/microphone disclosure
- crash/analytics PII

Run:
- `npm run security:audit`
- `npm run security:gitleaks`
- `npm run security:trufflehog`

## Phase 7 — Supabase/RLS/data source verification

Audit every data source:
- profile
- avatar
- taste profile
- dietary preferences
- favourites
- reviews
- review photos
- posts
- post media
- likes/saves
- comments if enabled
- activity
- merchant claims
- discovery/search/detail

Run:
- `npm run audit:supabase:static`
- `npm run smoke:database:location`
- `npm run smoke:database:search`
- `npm run smoke:database:rls`

If credentials exist, run:
- `npm run audit:supabase:advisor-security:non-password`
- `npm run smoke:supabase-full-audit-v1`

## Phase 8 — Prefetch QA

Create:
`tasks/Roadmap/app-prefetch-qc-report.md`

Verify:
- prefetch never blocks navigation
- failed prefetch never crashes
- image prefetch deduplicates
- route preload deduplicates
- blank query does not prefetch
- unauthorized merchant prefetch does not expose data
- production disabled routes are not prefetched
- no excessive network calls

Add tests in:
- `src/app/performance-prefetch-contracts.test.ts`
- `tests/e2e/app-prefetch-contracts.spec.ts`

## Phase 9 — UGC moderation

Create:
`tasks/Roadmap/app-ugc-moderation-qc-report.md`

If reviews/posts/comments/stories/profiles are public, verify:
- terms/user policy accepted or accessible
- objectionable content defined
- report content exists
- report user exists
- block user exists where interactions exist
- moderation status exists
- hidden/reported content does not show publicly
- contact/support path exists
- admin/moderation queue exists
- fake counts are not shown

Disable any UGC feature that lacks these safeguards.

## Phase 10 — Store metadata and final Go/No-Go

Create:
`tasks/Roadmap/app-final-prelaunch-go-nogo.md`

Verify:
- App Store metadata complete
- Google Play listing complete
- screenshots use fictional accounts
- support URL works
- privacy URL works
- account deletion URL works
- demo account ready
- backend live for review
- Data Safety accurate
- App Privacy nutrition accurate
- content rating accurate
- no placeholder/prototype content
- EAS preview/production builds pass
- Play pre-launch report reviewed
- Sentry crash verified
- rollback plan documented

## Required commands

Run all required commands from the checklist.

## Final response format

Return:
1. Files inventoried
2. Files cleaned/gated/deleted
3. Policy gaps found
4. App Store blockers
5. Google Play blockers
6. Security blockers
7. Feature flag blockers
8. Playwright tests added
9. Maestro tests added
10. Prefetch tests added
11. Supabase/RLS findings
12. Commands run and results
13. Manual QA still needed
14. Final status: Go / Go Candidate / No-Go

Do not mark Go unless every P0 gate passes.
```

---

## 17. Source notes

Policy sources for this checklist:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play UGC policy: https://support.google.com/googleplay/android-developer/answer/9876937
- Android Core App Quality: https://developer.android.com/docs/quality-guidelines/core-app-quality
- Expo EAS Build: https://docs.expo.dev/build/introduction/
- Expo EAS Update: https://docs.expo.dev/eas-update/introduction/
- OWASP MASVS: https://mas.owasp.org/MASVS/
