# Hungry Mobile App Production Readiness Audit

Updated: 2026-07-23  
Target: Apple App Store and Google Play public launch  
Verdict: **No-Go**

## 1. Current change lines and evidence boundary

| PR | Scope | Status |
|---|---|---:|
| #44 | Mandatory authentication, session/configuration hardening, catalog error classification, authenticated read-only Excel fallback, catalog performance/exclusions | open; implementation and verification incomplete |
| #45 | Repository/document organization, stale PR closure, generated-output cleanup | draft; verification incomplete |

This audit defines the current target policy. It does not certify that `main` or either branch already satisfies it. The final release audit must be generated from the reconciled commit, registered navigators, feature flags, service boundaries, live Supabase project and native binaries.

## 2. Mandatory product and source policy

```text
Fresh user: Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
Returning user: Splash → secure Supabase session restoration → authenticated app, or Login
```

- No guest mode or unauthenticated MainTabs.
- All mobile app content routes require authentication; public privacy, terms, support and account-deletion pages may exist on the website.
- Supabase is mandatory for authentication and shared writes.
- Missing released-build Supabase configuration blocks app entry.
- Excel is an authenticated, read-only catalog fallback only for classified catalog network/timeout/RPC/release availability failures.
- Signed-out, missing, invalid or revoked sessions, failed auth, missing configuration and legitimate no-results must not invoke Excel fallback.
- Mock providers, developer tools, prototypes and unfinished features are unavailable in released builds.

## 3. Route release classification

The final inventory must be generated from `navigationTypes.ts`, every registered navigator and `linking.ts`. The classifications below are the current release target; feature presence and names must be reconciled against the final code.

| Route/group | Purpose | Release classification | Additional gate |
|---|---|---|---|
| `Splash` | Brand/bootstrap | pre-auth shell | configuration/session handling |
| `OnboardingStack/*` | Local onboarding | pre-auth shell | must end at mandatory account screen |
| `AuthStack/*` | Login/signup/verification/recovery | pre-auth shell | no route into app without real session |
| `MainTabs/Home` | Home feed | authenticated consumer | UGC/data/error/accessibility proof |
| `MainTabs/Discover` | Discovery | authenticated consumer | catalog/location/fallback proof |
| `MainTabs/Review` | Review entry | authenticated write | storage/RLS/moderation proof |
| `MainTabs/Profile` | Profile/settings entry | authenticated private | user-data isolation |
| `SearchHome`, `SearchResults` | Search | authenticated browse | bounded queries and no-results |
| `BrowseDishes`, `BrowseStalls` | Paged catalog | authenticated browse | pagination/deduplication |
| `TasteFilter` | Preference filter | authenticated browse | canonical profile/filter behavior |
| `DishDetail`, `CatalogRawDetail`, `StallDetail` | Detail/menu | authenticated browse | safe missing IDs and source continuity |
| `DiscoverMap`, `MapZoomedIn` | Location/map | authenticated browse | permission/list fallback/token proof |
| `DecideForMeResult`, `QuickBites` | Decision/collection entry | authenticated browse | approved data and no fake confidence |
| `BlogPost` | In-app editorial bridge | authenticated content | safe external links; public website remains separate |
| `Post`, `PostComposerV2` | Post creation | authenticated write | feature flag, uploads, UGC controls |
| `ReviewStack/*` | Review creation | authenticated write | validation, storage, RLS, moderation |
| `ActivityInbox` | Activity updates | authenticated/private | user-data isolation and enabled tabs only |
| `ActivityPostDetail` | Activity target | authenticated/private | target authorization |
| `UserProfile` | Other-user profile | authenticated/visibility-controlled | block/privacy/moderation |
| `EditProfile`, `Favourites`, `ReviewHistory`, `Settings` | Account data | authenticated/private | RLS, deletion, cache cleanup |
| `WheelStack/*` | Decide wheel | authenticated/shared | join-code abuse and feature approval |
| `Crave` | Crave | authenticated browse | feature approval and canonical data |
| `MusicSelection` | Music selection | authenticated flow | composer/rights/feature approval |
| `BuildingDrillDown`, `BuildingDrillDownV2`, `VenueDirectory` | Floor/directory | authenticated + feature-gated | geometry/map/accessibility proof |
| `MerchantClaimExplainer`, `MerchantTabs/*` | Merchant entry/tools | authenticated + merchant role + flag | outlet RLS/RBAC/audit proof |
| `DirectMessages`, `ChatDetail` | Messaging | authenticated + feature-gated | realtime, report/block/moderation proof |
| `StoryViewer`, `AddStory` | Stories | authenticated + feature-gated | media/storage/moderation proof |
| `PassportScreen`, `MissionsScreen` | Gamification | authenticated + feature-gated | backend/unlock integrity |
| `CollectionList`, `CollectionDetail`, `ChecklistDetail` | Collections/checklists | authenticated + feature-gated | ownership/collaboration/privacy |
| `PortfolioDetail`, `PortfolioPublicView`, `AdminPortfolioFlags` | Portfolio/admin | authenticated + visibility/role/flag | RLS/moderation/admin audit |
| `DeveloperLauncher`, `DesignGallery`, `SplashV2`, prototype detail routes | Development/prototype | development only | absent/unregistered in production |
| `Offline` | Recovery shell | context-dependent | signed-out state cannot expose app/fallback |
| `NotFound` | Invalid/missing route | context-dependent | safe params and correct auth boundary |

No route in this table is classified as guest/public mobile browsing.

## 4. Deep-link and return-route requirements

- Auth/reset links may open the pre-auth shell.
- Every content/action link checks auth readiness and authentication before mounting the target.
- Fresh users go to onboarding; onboarded signed-out users go to Login.
- Only allowlisted routes with validated params may be retained as return destinations.
- Feature-disabled, merchant/admin-only, malformed and unsafe routes are discarded.
- Authentication success does not override feature or role denial.
- Notification and stale persisted navigation payloads follow the same policy.

## 5. Data-source audit

| Feature/data | Canonical source | Local role | Release risk to verify |
|---|---|---|---|
| Auth/session | Supabase Auth + secure token storage | non-sensitive metadata only | persisted ID must not authenticate |
| Profile/avatar/privacy | Supabase DB/Storage | cache/optimistic state | cross-surface identity and RLS |
| Taste/dietary/location choice | Supabase profile after auth | local onboarding draft/device location | migration and privacy |
| Catalog/search/detail/map | Supabase release/RPCs | bounded memory cache | paging, indexes, provenance, no-results |
| Eligible catalog outage | bundled validated Excel catalog | authenticated read-only fallback | no auth/write/config bypass |
| Favourites | Supabase | optimistic/cache | idempotency and rehydration |
| Reviews/photos | Supabase DB/Storage | draft/optimistic state | ownership, moderation, false success |
| Posts/media/engagement | Supabase DB/RPC/Storage | draft/optimistic cache | visibility, UGC safety, retries |
| Settings | device store or Supabase by setting type | explicit | privacy/account versus device boundary |
| Merchant/admin operations | Supabase with role/RLS/audit | no fixture success | cross-tenant/admin exposure |
| Analytics/crash | configured sinks | local buffer where approved | PII/location/token scrubbing |

## 6. Production feature policy

The final production build must prove that unapproved merchant, DM/chat, comments, stories, gamification, collections, floorplans, prototypes, AI creator tools, OCR/ops and developer surfaces are:

- disabled by production defaults;
- not registered or reachable where appropriate;
- blocked through direct navigation, deep links, return routes, notification payloads and stale state;
- excluded from public store metadata/screenshots;
- not prefetched or queried for unauthorized users.

## 7. P0 launch blockers

- [ ] #44 and #45 reconciled against current `main` with no overwritten policy/runtime work.
- [ ] Typecheck, lint, format, unit/integration, Playwright, Expo Doctor, asset, static Supabase, edge and security gates pass.
- [ ] Mandatory auth, session restoration/invalidation, missing configuration and deep-link gates pass.
- [ ] Supabase Security/Performance Advisor and live RLS/storage/function tests pass or have approved risk.
- [ ] Catalog paging, images, no-results, healthy Supabase and authenticated Excel fallback pass.
- [ ] All shared writes are durable and never falsely succeed offline/fallback.
- [ ] Public UGC has report, block, delete-own-content, moderation and support controls.
- [ ] iOS production-candidate/TestFlight and Android AAB/internal-track/native smoke pass.
- [ ] VoiceOver/TalkBack, large text, contrast, reduced motion and permission-denied flows pass.
- [ ] Sentry release/source-map/privacy proof passes.
- [ ] Store metadata, App Privacy, Data Safety, reviewer/demo account, support/privacy/deletion URLs and image rights are approved.
- [ ] Legal/privacy and rollout/rollback owners sign off.

## 8. Required verification

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

Add credential-backed staging checks, current iOS/Android builds, manual accessibility, store-console and legal evidence. A skipped or blocked check is not a pass.

## 9. Current verdict

The target architecture and route policy are now documented consistently, but the active implementation and cleanup branches do not yet have complete automated, staging, native or external proof. Production remains **No-Go**.
