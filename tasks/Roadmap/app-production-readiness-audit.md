# Hungry Mobile App Production Readiness Audit

Updated: 2026-06-25
Branch: `codex/release-blockers-unblocked` (frontend-design-overhaul tip)
Verdict: **No-Go — Go Candidate on repo-local gates** until external build/store/legal proof is complete.

## Local Gate Snapshot (2026-06-25)

| Gate | Command | Status |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ pass (0 errors) |
| Lint | `npm run lint` | ✅ pass (0 warnings) |
| Tests | `npm run test` | ✅ 541 pass / 2 skipped / 0 fail |
| Assets | `npm run audit:assets` | ✅ pass |
| Supabase static | `npm run audit:supabase:static` | ✅ pass |
| Edge functions | `npm run check:edge-functions` | ✅ pass |
| Security audit | `npm run security:audit` | ✅ 0 vulnerabilities |
| Expo Doctor | `npx expo-doctor` | ✅ 18/18 checks pass |
| Release rehearsal | `npm run release:ready:local` | ✅ all local gates pass |
| Playwright page-agent | five page-agent specs plus feature-flag/prefetch specs | ✅ 13/13 pass |
| iOS native prepared smoke | `npm run smoke:native:ios:prepared` | ✅ pass on iPhone 17 Pro simulator |
| Website production runtime | `https://usehungry.com` | ✅ public routes 200; console Basic Auth enforced |
| Sentry unresolved queue | `npm run monitoring:sentry:unresolved` | ✅ pass: no unresolved issues after cleanup |

## Fixes Applied (2026-06-25)

| Fix | File | Risk removed |
|---|---|---|
| `PostComposerScreen` wrapped in `FeedErrorBoundary` | `src/app/screens/post/PostComposerScreen.tsx` | Render errors during composition crash the navigator; now shows recoverable error UI |
| Android camera/photo permissions added | `app.json` | Play Store review rejection for missing manifest permissions (`CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE`) |

## Route Inventory

| Route | Screen | Public/private | Auth required | Feature flag | Production enabled? | Deep link? | Risk | Fix |
|---|---|---|---:|---|---:|---:|---|---|
| `Splash` | SplashScreen | public shell | no | none | yes | no | startup crash | local/native smoke |
| `AuthStack/Login` | Login | public auth | no | none | yes | yes | auth failure | auth tests/smoke |
| `AuthStack/SignUp` | SignUp | public auth | no | none | yes | yes | signup proof | auth tests/smoke |
| `AuthStack/EmailVerification` | EmailVerification | public auth | no | none | yes | no | callback drift | auth callback tests |
| `AuthStack/ForgotPassword` | ForgotPassword | public auth | no | none | yes | yes | email provider | external SMTP proof |
| `AuthStack/ResetPassword` | ResetPassword | public auth | no | none | yes | yes `/auth/callback` | token leak/expired | invalid callback tests |
| `OnboardingStack/*` | Onboarding | public | no | none | yes | no | incomplete flow | screen QC |
| `MainTabs/Home` | HomeFeed | public browse | no | none | yes | no | feed crash/offline | screen QC |
| `MainTabs/Discover` | DiscoverHome | public browse | no | none | yes | no | location denied | location smoke |
| `MainTabs/Review` | Review tab | mixed | yes for submit | none | yes | no | protected action bypass | auth redirect tests |
| `MainTabs/Profile` | Profile stack | private | yes | none | yes | no | private data leak | auth/security tests |
| `StallDetail` | StallDetailScreen | public detail | no | none | yes | yes `/venue/:id` | missing data crash | skeleton/not-found tests |
| `DishDetail` | DishDetailScreenV2 | public detail | no | none | yes | yes `/dish/:id` | missing data crash | skeleton/not-found tests |
| `SearchHome` | SearchHome | public browse | no | none | yes | no | no-result state | search QC |
| `SearchResults` | SearchResults | public browse | no | none | yes | no | filter drift | search contracts |
| `BrowseDishes` | BrowseDishes | public browse | no | none | yes | no | stale mock fallback | data source audit |
| `BrowseStalls` | BrowseStalls | public browse | no | none | yes | no | stale mock fallback | data source audit |
| `TasteFilter` | TasteFilter | public browse | no | none | yes | no | filter state drift | screen QC |
| `DiscoverMap` | HomeMap | public map | no | none | yes | no | Mapbox token | permission/offline smoke |
| `QuickBites` | QuickBites | public browse | no | none | yes | no | missing dish id | hydration tests |
| `Post` | PostComposerScreen | private | yes | none | yes | no | unauth publish; crash isolation | ✅ FeedErrorBoundary fixed |
| `ReviewStack` | Review flow | private | yes | none | yes | no | unauth publish | protected-action tests |
| `ActivityInbox` | Activity | private | yes | none | yes | no | data leak | auth/security tests |
| `ActivityPostDetail` | Activity post detail | private | yes | none | yes | no | data leak | auth/security tests |
| `EditProfile` | EditProfile | private | yes | none | yes | no | mutation leak | auth/RLS smoke |
| `Favourites` | Favourites | private | yes | none | yes | no | other-user data | auth/RLS smoke |
| `ReviewHistory` | ReviewHistory | private | yes | none | yes | no | other-user data | auth/RLS smoke |
| `Settings` | Settings | private | yes | none | yes | no | deletion/logout gaps | auth/deletion smoke |
| `WheelStack/*` | Decide wheel | mixed | mixed | `hungryWheelEnabled` | yes | yes `/join/:code` | code abuse | join-code validation |
| `Crave` | Crave | public | no | `craveEnabled` | yes | no | MVP scope | QC |
| `BlogPost` | Reads | public | no | `readsEnabled` | yes | no | external link | safe-link tests |
| `MusicSelection` | MusicSelection | private | yes | none | yes | no | launch scope | QC or disable |
| `MerchantClaimExplainer` | Claim CTA | private | yes | `merchantClaimCtaEnabled` | **no** | no | unfinished flow | disabled ✅ |
| `ChatDetail` | Chat | private | yes | `directMessagesEnabled` | **no** | no | moderation risk | disabled ✅ |
| `DirectMessages` | DMs | private | yes | `directMessagesEnabled` | **no** | no | moderation risk | disabled ✅ |
| `BuildingDrillDown` | Floorplan | public | no | `floorplansEnabled` | **no** | no | incomplete QA | disabled ✅ |
| `DishDetailV2` | Prototype | public | no | `prototypeRoutesEnabled` | **no** | no | duplicate route | disabled ✅ |
| `StallDetailV2` | Prototype stall | public | no | `prototypeRoutesEnabled` | **no** | no | duplicate route | disabled ✅ |
| `BuildingDrillDownV2` | Prototype floorplan | public | no | `prototypeRoutesEnabled`+`floorplansEnabled` | **no** | no | incomplete | disabled ✅ |
| `VenueDirectory` | Prototype dir | public | no | `prototypeRoutesEnabled`+`floorplansEnabled` | **no** | no | incomplete | disabled ✅ |
| `SplashV2` | Prototype splash | public | no | `prototypeRoutesEnabled` | **no** | no | stale UX | disabled ✅ |
| `DesignGallery` | Dev gallery | dev | no | `prototypeRoutesEnabled` | **no** | no | debug surface | disabled ✅ |
| `PostComposerV2` | Prototype composer | private | yes | `prototypeRoutesEnabled` | **no** | no | duplicate publish | disabled ✅ |
| `MerchantTabs/*` | Merchant centre | merchant | yes | `merchantCentreEnabled` | **no** | no | RBAC risk | disabled ✅ |
| `StoryViewer` | Stories | mixed | mixed | `storiesEnabled` | **no** | no | moderation risk | disabled ✅ |
| `AddStory` | Add story | private | yes | `storiesEnabled` | **no** | no | moderation risk | disabled ✅ |
| `PassportScreen` | Passport | private | yes | `gamificationEnabled` | **no** | no | data backing | disabled ✅ |
| `MissionsScreen` | Missions | private | yes | `gamificationEnabled` | **no** | no | data backing | disabled ✅ |
| `CollectionList` | Collections | mixed | yes | `collectionsEnabled` | **no** | no | launch scope | disabled ✅ |
| `CollectionDetail` | Collection detail | mixed | yes | `collectionsEnabled` | **no** | no | launch scope | disabled ✅ |
| `PortfolioPublicView` | Public portfolio | public | no | `prototypeRoutesEnabled` | **no** | no | stale access | disabled ✅ |
| `AdminPortfolioFlags` | Admin flags | admin | yes | `prototypeRoutesEnabled` | **no** | no | admin exposure | disabled ✅ |
| `Offline` | Offline | public shell | no | none | yes | no | blank UX | screen QC |
| `NotFound` | NotFound | public shell | no | none | yes | no | safe missing route | screen QC |

## Data Source Audit

| Feature | Current data source | Canonical source | Local cache? | Risk | Fix |
|---|---|---|---:|---|---|
| Profile | `useProfileStore` + service | Supabase `user_profiles` | yes | stale profile | keep Supabase canonical |
| Avatar | profile/media service | Supabase Storage + profile row | yes | private URL leak | signed/private media checks |
| Taste profile | profile/service | Supabase user taste tables | yes | guest overwrites | merge only meaningful guest values |
| Dietary preferences | profile/service | Supabase profile | yes | stale filters | service-backed sync |
| Favourites | profile/service | Supabase `user_favourite_dishes` | optimistic | rehydration drift | login/app restore tests |
| Reviews | review service | Supabase `reviews` | optimistic | local-only review | reject mock fallback in production |
| Review photos | media upload service | Supabase Storage | yes | MIME/path abuse | signed upload + ownership tests ✅ |
| Posts | post service | Supabase `posts` | optimistic | local-only post | service-backed publish |
| Post media | media upload service | Supabase Storage + `post_media` | yes | MIME/path abuse | signed upload + ownership tests ✅ |
| Likes/saves | social service | Supabase post engagement tables | optimistic | fake counts | UUID-backed writes only |
| Comments | social service if enabled | Supabase comments | optimistic | moderation gap | **production disabled** ✅ |
| Activity | activity service | Supabase activity | cache | safe fallback | honest error/empty state |
| Merchant claims | merchant service | Supabase merchant tables | no | unfinished flow | **production disabled** ✅ |
| Discovery/search/detail | repository/service | Supabase RPCs/tables | read cache | mock fallback | production source audits |

## P0 Blockers — Remaining

| Blocker | Owner | Required |
|---|---|---|
| Dirty worktree not reconciled | Engineering | `git commit` or intentional stash before release tag |
| Android install smoke | Engineering/Owner | Android EAS preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` is finished, but no Android emulator/device is attached for install smoke |
| iOS EAS preview blocked — missing internal-distribution credentials | Owner | configure ASC credentials for non-interactive EAS |
| iOS production build proof | Owner | TestFlight smoke |
| Android production build proof | Owner | Play internal track smoke |
| Production secret proof (`PRODUCTION_SECRET_PROOF=0`) | Owner | verify all env vars in EAS secret scope |
| Store-console metadata / Data Safety / privacy labels | Owner | App Store Connect + Play Console setup |
| Supabase Auth leaked-password protection | Owner | upgrade to Supabase Pro or higher, then enable leaked-password protection; Management API returned 402 on current plan |
| Sentry source map proof for production build | Engineering | EAS production build with `SENTRY_AUTH_TOKEN`; unresolved issue queue is currently clean |
| Legal/privacy sign-off | Owner/Legal | privacy policy + ToS + account deletion URL live |
| VoiceOver/TalkBack manual smoke | QA | iOS VoiceOver + Android TalkBack sessions |
| Demo account for store review | Owner | reviewer credentials or approved demo mode |

## Policy References

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play Developer Program Policies: https://support.google.com/googleplay/android-developer/answer/16070163
- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Data safety: https://support.google.com/googleplay/answer/11416267
- Expo EAS Build: https://docs.expo.dev/build/introduction/
- Supabase production checklist: https://supabase.com/docs/guides/platform/going-into-prod
