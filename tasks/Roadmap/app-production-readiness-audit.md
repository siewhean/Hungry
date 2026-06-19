# Hungry Mobile App Production Readiness Audit

Updated: 2026-06-19
Target: public Apple App Store and Google Play launch
Verdict: **No-Go** until all P0 repo-local gates and external proof gates pass.

## Evidence Snapshot

| Area | Evidence | Status |
|---|---|---|
| Branch | `frontend-design-overhaul...origin/frontend-design-overhaul [ahead 1]` | Dirty, must reconcile before public release |
| Dirty worktree | Many modified/untracked mobile, Supabase, data, website, and task files | Release blocker until reviewed/staged/committed or intentionally excluded |
| App config | `app.json` | iOS/Android identifiers and permissions present |
| EAS config | `eas.json` | Preview and production profiles exist |
| Feature flags | `src/constants/featureFlags.ts` | Production disables experimental/social/merchant/prototype surfaces |
| Deep links | `src/app/navigation/linking.ts` | Public dish/stall links, protected action redirect, unsafe param rejection |
| Release wrapper | `scripts/release_ready_checklist.sh` | Local gates plus external evidence keys |
| Current external blockers | `tasks/release-evidence/full-audit-v1.example.env` and final checklist | Prepared iOS smoke proof is now recorded; EAS, Supabase, store, legal, CI, secret, monitoring, and dirty-worktree proof keys remain `0` |
| 2026-06-19 local gates | typecheck, lint, format, tests, static audits, edge checks, asset audit, npm audit, gitleaks, trufflehog, Expo Doctor, focused native-smoke contract | Repo-local gates pass except linked Advisor/live proof |
| Supabase dry-run | `/opt/homebrew/bin/supabase db push --dry-run` | Would push four pending migrations; production was not mutated |
| Native smoke | `npm run smoke:native:ios:prepared` | Passed on iPhone 17 Pro simulator with LAN Metro after Expo dev-client onboarding handling |
| EAS preview | `npx --yes eas-cli@18.12.3 build --profile preview --platform all --non-interactive` | Prior Android build errored on missing Mapbox Maven config; source fix added. Fresh EAS upload/build requires explicit owner approval; iOS failed due missing internal-distribution credentials |
| Final QA/QC agent | `.github/agents/hungry-qa-qc.agent.md` independent pass | No new repo-local P0 code defect found; public launch remains No-Go |

## Route Inventory

| Route | Screen | Public/private | Auth required | Feature flag | Production enabled? | Deep link? | Risk | Fix |
|---|---|---|---:|---|---:|---:|---|---|
| `Splash` | Splash | public shell | no | none | yes | no | startup crash | local/native smoke |
| `AuthStack/Login` | Login | public auth | no | none | yes | yes `/login` | auth failure | auth tests/smoke |
| `AuthStack/SignUp` | SignUp | public auth | no | none | yes | yes `/signup` | signup/email proof | auth tests/smoke |
| `AuthStack/EmailVerification` | EmailVerification | public auth | no | none | yes | no | callback drift | auth callback tests |
| `AuthStack/ForgotPassword` | ForgotPassword | public auth | no | none | yes | yes `/forgot-password` | email provider proof | external SMTP proof |
| `AuthStack/ResetPassword` | ResetPassword | public auth | no | none | yes | yes `/auth/callback` | token leak/expired code | invalid callback tests |
| `OnboardingStack/*` | Onboarding screens | public onboarding | no | none | yes | no | incomplete onboarding | screen QC |
| `MainTabs/Home` | HomeFeed | public browse | no | none | yes | no | feed crash/offline | screen QC |
| `MainTabs/Discover` | Discover | public browse | no | none | yes | no | location denied | location smoke |
| `MainTabs/Review` | Review tab | mixed | yes for submit | none | yes | no | protected action bypass | auth redirect tests |
| `MainTabs/Profile` | Profile stack | private for own profile | yes | none | yes | no | private data leak | auth/security tests |
| `StallDetail` | StallDetailScreen | public detail | no | none | yes | yes `/venue/:id` | missing data crash | not-found/skeleton tests |
| `DishDetail` | DishDetailScreenV2 | public detail | no | none | yes | yes `/dish/:id` | missing data crash | not-found/skeleton tests |
| `SearchHome` | SearchHome | public browse | no | none | yes | no | no-result state | search QC |
| `SearchResults` | SearchResults | public browse | no | none | yes | no | filter/query drift | search contracts |
| `BrowseDishes` | BrowseDishes | public browse | no | none | yes | no | stale mock fallback | data source audit |
| `BrowseStalls` | BrowseStalls | public browse | no | none | yes | no | stale mock fallback | data source audit |
| `TasteFilter` | TasteFilter | public browse | no | none | yes | no | filter state drift | screen QC |
| `DiscoverMap` | HomeMap | public map | no | none | yes | no | Mapbox token/runtime | permission/offline smoke |
| `QuickBites` | QuickBites | public browse | no | none | yes | no | missing dish id | detail hydration tests |
| `Post` | Post composer | private action | yes | none | yes | yes `/order` redirects | unauth publish | protected-action tests |
| `ReviewStack` | Review flow | private action | yes | none | yes | no | unauth publish | protected-action tests |
| `ActivityInbox` | Activity updates | private | yes | none | yes | no | social data leak | auth/security tests |
| `ActivityPostDetail` | Activity post detail | private | yes | none | yes | no | social data leak | auth/security tests |
| `EditProfile` | EditProfile | private | yes | none | yes | no | profile mutation leak | auth/RLS smoke |
| `Favourites` | Favourites | private | yes | none | yes | no | other-user data | auth/RLS smoke |
| `ReviewHistory` | ReviewHistory | private | yes | none | yes | no | other-user data | auth/RLS smoke |
| `Settings` | Settings | private | yes | none | yes | no | deletion/logout gaps | auth/deletion smoke |
| `WheelStack/*` | Decide wheel | public/shared | mixed | `hungryWheelEnabled` | yes | yes `/join/:code` | shared code abuse | join-code validation |
| `Crave` | Crave | public browse | no | `craveEnabled` | yes | no | unproven MVP scope | QC or disable if not launch-approved |
| `BlogPost` | Reads | public content | no | `readsEnabled` | yes | no | unsafe external link | safe-link tests |
| `MusicSelection` | MusicSelection | private flow | yes | none | yes | no | unclear launch scope | QC or disable if not launch-approved |
| `MerchantClaimExplainer` | Claim CTA | private/merchant | yes | `merchantClaimCtaEnabled` | no | no | unfinished merchant flow | keep production-disabled |
| `ChatDetail` | Chat | private social | yes | `directMessagesEnabled` | no | no | moderation/realtime risk | keep production-disabled |
| `DirectMessages` | DirectMessages | private social | yes | `directMessagesEnabled` | no | no | moderation/realtime risk | keep production-disabled |
| `BuildingDrillDown` | Floorplan | public map | no | `floorplansEnabled` | no | no | floorplan QA incomplete | keep production-disabled |
| `DishDetailV2` | Prototype detail | public prototype | no | `prototypeRoutesEnabled` | no | no | duplicate route drift | keep production-disabled |
| `StallDetailV2` | Prototype stall | public prototype | no | `prototypeRoutesEnabled` | no | no | duplicate route drift | keep production-disabled |
| `BuildingDrillDownV2` | Prototype floorplan | public prototype | no | `prototypeRoutesEnabled` + `floorplansEnabled` | no | no | geometry QA incomplete | keep disabled |
| `VenueDirectory` | Prototype directory | public prototype | no | `prototypeRoutesEnabled` + `floorplansEnabled` | no | no | geometry QA incomplete | keep disabled |
| `SplashV2` | Prototype splash | public prototype | no | `prototypeRoutesEnabled` | no | no | stale UX | keep disabled |
| `DesignGallery` | Developer gallery | dev only | no | `prototypeRoutesEnabled` | no | no | debug surface | keep disabled |
| `PostComposerV2` | Prototype composer | private prototype | yes | `prototypeRoutesEnabled` | no | no | duplicate publish path | keep disabled |
| `MerchantTabs/*` | Merchant centre | merchant private | yes | `merchantCentreEnabled` | no | yes only when enabled | merchant RBAC risk | keep disabled until merchant QA |
| `StoryViewer` | Stories | social public | mixed | `storiesEnabled` | no | no | moderation/storage risk | keep disabled |
| `AddStory` | Add story | private social | yes | `storiesEnabled` | no | no | moderation/storage risk | keep disabled |
| `PassportScreen` | Passport | private gamification | yes | `gamificationEnabled` | no | no | unfinished data backing | keep disabled |
| `MissionsScreen` | Missions | private gamification | yes | `gamificationEnabled` | no | no | unfinished data backing | keep disabled |
| `CollectionList` | Collections | mixed | yes | `collectionsEnabled` | no | no | launch scope risk | keep disabled |
| `CollectionDetail` | Collection detail | mixed | yes | `collectionsEnabled` | no | no | launch scope risk | keep disabled |
| `PortfolioPublicView` | Public portfolio | public prototype | no | `prototypeRoutesEnabled` | no | yes only when enabled | stale public access | keep disabled |
| `AdminPortfolioFlags` | Admin flags | admin prototype | yes | `prototypeRoutesEnabled` | no | no | admin exposure | keep disabled |
| `Offline` | Offline state | public shell | no | none | yes | no | blank offline UX | screen QC |
| `NotFound` | NotFound | public shell | no | none | yes | no | unsafe missing params | screen QC |

## Data Source Audit

| Feature | Current data source | Canonical source | Local cache? | Risk | Fix |
|---|---|---|---:|---|---|
| Profile | `useProfileStore` + service | Supabase `user_profiles` | yes | stale profile | keep Supabase sync as canonical |
| Avatar | profile/media service | Supabase Storage + profile row | yes | private URL leak | signed/private media checks |
| Taste profile | profile/service | Supabase user taste/profile tables | yes | guest overwrites | merge only meaningful guest values |
| Dietary preferences | profile/service | Supabase profile | yes | stale filters | service-backed sync |
| Favourites | profile/service | Supabase `user_favourite_dishes` | optimistic | rehydration drift | keep login/app restore tests |
| Reviews | review service | Supabase `reviews` | optimistic | local-only review | reject mock fallback in production |
| Review photos | media upload service | Supabase Storage | yes | MIME/path abuse | signed upload and ownership tests |
| Posts | post service | Supabase `posts` | optimistic | local-only post | production publish through service only |
| Post media | media upload service | Supabase Storage + `post_media` | yes | MIME/path abuse | signed upload and ownership tests |
| Likes/saves | social service | Supabase post engagement tables | optimistic | fake counts | UUID-backed writes only |
| Comments | social service if enabled | Supabase comments | optimistic | moderation gap | production disabled unless safety proof |
| Activity | activity service | Supabase activity if enabled | cache | missing table/safe fallback | keep honest error/empty state |
| Merchant claims | merchant service | Supabase merchant claim tables | no | unfinished flow | production disabled |
| Discovery/search/detail | repository/service | Supabase RPCs/tables | read cache | mock fallback claims | production source audits |

## P0 Blockers

- Dirty worktree not reconciled.
- Linked Supabase project is behind local migrations:
  - `20260610120000_catalog_display_provenance_guardrails.sql`
  - `20260611000000_add_staging_planning_area.sql`
  - `20260611113000_discovery_feed_rating_sync.sql`
  - `20260619110000_release_advisor_security_cleanup.sql`
- Linked Supabase Advisor still reports app-owned function hardening findings until the pending migrations are applied and rechecked.
- Android/EAS proof is incomplete: Android preview build `6cb95ee3-b795-489b-98d5-1b8f26b175c1` errored on missing Mapbox Maven config; source fix added, but fresh EAS upload/build needs explicit owner approval before artifact proof can be collected.
- iOS EAS preview is blocked by missing internal-distribution credentials in non-interactive mode.
- Full iOS release build proof is still pending, but prepared iOS native smoke now passes on a booted iPhone 17 Pro simulator with LAN Metro.
- Heavy build/cache gates are fragile on this machine; generated cache cleanup restored free disk from about 263 MiB, but current free space after reruns is about 4.8 GiB and more headroom is still recommended for EAS/native work.
- Production/staging secret proof missing.
- Store-console metadata/Data Safety/privacy labels/demo account proof missing.
- Live multi-user RLS/storage/Edge Function smoke missing.
- Sentry staging crash/source-map/release proof missing.
- Legal/privacy sign-off missing.

## Policy References

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play Developer Program Policies: https://support.google.com/googleplay/android-developer/answer/16070163
- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Data safety: https://support.google.com/googleplay/answer/11416267
- Expo EAS Build: https://docs.expo.dev/build/introduction/
- Supabase production checklist: https://supabase.com/docs/guides/platform/going-into-prod
