# Hungry App Screen QC Checklist

Updated: 2026-06-25
Verdict: **Partial / No-Go**. Source coverage exists for core MVP screens; repo-local iOS runtime smoke and Android EAS artifact proof now exist, but public-launch QC still requires Android install/device smoke, iOS external build proof, manual accessibility proof, and owner/store-console evidence.

## QC Table

| Screen | iOS | Android | Loading | Empty | Error | Offline | Permission denied | Auth state | Accessibility | Security | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Splash | pending runtime | pending runtime | n/a | n/a | pending | pending | n/a | pending | pending | pass source | pending |
| Onboarding | pending runtime | pending runtime | pass source | n/a | pending | pending | location handled ✅ | guest | pending | pass source | pending |
| Login | pending runtime | pending runtime | pass source | n/a | pass source | pending | n/a | guest | pending | pass source | pending |
| SignUp | pending runtime | pending runtime | pass source | n/a | pass source | pending | n/a | guest | pending | pass source | pending |
| EmailVerification | pending runtime | pending runtime | pass source | n/a | pending | pending | n/a | mixed | pending | pending external email | pending |
| ForgotPassword | pending runtime | pending runtime | pass source | n/a | pending | pending | n/a | guest | pending | pending external email | pending |
| ResetPassword | pending runtime | pending runtime | pass source | n/a | invalid callback source ✅ | pending | n/a | callback | pending | pass source | pending |
| Home | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| Discover | pending runtime | pending runtime | pass source | pass source | pass source | pending | location denied source ✅ | guest/auth | pending | pass source | pending |
| SearchHome | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| SearchResults | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| BrowseDishes | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| BrowseStalls | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| TasteFilter | pending runtime | pending runtime | pass source | n/a | pending | pending | n/a | guest/auth | pending | pass source | pending |
| DishDetail | pending runtime | pending runtime | pass source | missing data source ✅ | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| StallDetail | pending runtime | pending runtime | pass source | missing data source ✅ | pass source | pending | maps pending | guest/auth | pending | pass source | pending |
| DiscoverMap | pending runtime | pending runtime | pass source | pass source | pending | pending | pending runtime | guest/auth | pending | token runtime pending | pending |
| DecideForMe/Wheel | pending runtime | pending runtime | pass source | pending | pending | pending | n/a | mixed | pending | join-code validation source ✅ | pending |
| Review flow | pending runtime | pending runtime | pass source | pending | pass source | pending | media permission pending | auth required ✅ | pending | service-backed source ✅ | pending |
| Post composer | pending runtime | pending runtime | pass source | pending | **FeedErrorBoundary fixed** ✅ | pending | media denied source ✅ | auth required ✅ | pending | service-backed source ✅ | pending |
| Activity inbox | pending runtime | pending runtime | pass source | pending | pass source | pending | n/a | auth required ✅ | pending | auth/protected route source ✅ | pending |
| Profile | pending runtime | pending runtime | pass source | pending | pending | pending | n/a | auth required ✅ | pending | source-backed ✅ | pending |
| EditProfile | pending runtime | pending runtime | pass source | n/a | pending | pending | media pending | auth required ✅ | pending | source-backed ✅ | pending |
| Settings | pending runtime | pending runtime | pass source | n/a | deletion error source ✅ | pending | n/a | auth required ✅ | pending | deletion request source ✅ | pending |
| Favourites | pending runtime | pending runtime | pass source | pass source | pending | pending | n/a | auth required ✅ | pending | Supabase sync source ✅ | pending |
| ReviewHistory | pending runtime | pending runtime | pass source | pass source | pending | pending | n/a | auth required ✅ | pending | Supabase sync source ✅ | pending |
| Offline | pending runtime | pending runtime | n/a | n/a | n/a | pending runtime | n/a | guest/auth | pending | pass source ✅ | pending |
| NotFound | pending runtime | pending runtime | n/a | n/a | pass source ✅ | pending | n/a | guest/auth | pending | safe missing route ✅ | pending |
| MerchantTabs | disabled in prod ✅ | disabled in prod ✅ | pending | pending | pending | pending | media pending | merchant only | pending | production disabled ✅ | disabled |
| DeveloperLauncher | dev only ✅ | dev only ✅ | n/a | n/a | n/a | n/a | n/a | dev only | n/a | dev only ✅ | disabled in prod |
| Crave | pending runtime | pending runtime | pass source | pending | pending | pending | n/a | mixed | pending | pending | pending |
| BlogPost/Reads | pending runtime | pending runtime | pass source | pass source | pending | pending | n/a | public | pending | safe-link tests | pending |
| WheelHome/Lobby/Spin | pending runtime | pending runtime | pass source | pending | pending | pending | n/a | mixed | pending | join-code validation ✅ | pending |

## Runtime Acceptance Requirements

- iOS simulator smoke: prepared Maestro smoke passes ✅ as of 2026-06-25 (`tasks/verification.md`; `tasks/Roadmap/app-native-build-readiness-report.md`).
- Android EAS artifact proof: preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` finished with APK artifact ✅ (`tasks/verification.md`; `tasks/Roadmap/app-native-build-readiness-report.md`).
- Android emulator/device install smoke: **pending** — no Android device/emulator attached in local evidence.
- Manual VoiceOver and TalkBack smoke.
- Location denied and media denied proof.
- No terminal/simulator console errors during smoke pass.

## Runtime Evidence Refresh

| Platform / gate | Current evidence | Status |
|---|---|---:|
| iOS prepared simulator smoke | `npm run smoke:native:ios:prepared` passed chat/activity/media flows on iPhone 17 Pro simulator with LAN Metro; release evidence key `NATIVE_MAESTRO_IOS_PROOF=1`. | pass |
| iOS external build/TestFlight | iOS EAS preview remains blocked by missing internal-distribution credentials; release evidence key `IOS_EAS_PROOF=0`. | blocked |
| Android EAS preview artifact | Build `b04ac43f-9a06-43f9-9f38-709cbc17e418` finished; APK artifact URL is recorded in `tasks/Roadmap/app-native-build-readiness-report.md`. | pass |
| Android install/device smoke | Local evidence says no Android emulator/device is attached, so APK install and device smoke remain pending. | pending |
| Android permissions | `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, and `READ_EXTERNAL_STORAGE` are recorded as added in `tasks/Roadmap/app-native-build-readiness-report.md`; release evidence key `ANDROID_PERMISSIONS_COMPLETE=1`. | pass |
| Post composer error boundary | `PostComposerScreen` has `FeedErrorBoundary` coverage recorded in `tasks/Roadmap/app-final-go-no-go-checklist.md`; release evidence key `POST_COMPOSER_ERROR_BOUNDARY=1`. | pass |

## Readiness Dependency Matrix

| Dependency | Proof key / evidence | Current state | Blocks |
|---|---|---|---|
| Repo-local source/runtime gates | `tasks/verification.md` 2026-06-25 release blockers full proof refresh | Go Candidate locally | Does not clear public launch without external proofs |
| iOS native simulator smoke | `NATIVE_MAESTRO_IOS_PROOF=1` | pass | none for repo-local QC |
| iOS external build proof | `IOS_EAS_PROOF=0` | blocked by internal-distribution credentials | App Store/TestFlight readiness |
| Android EAS artifact | `ANDROID_EAS_PROOF=1`; build `b04ac43f-9a06-43f9-9f38-709cbc17e418` | artifact exists | APK install/device smoke still required |
| Android install/device smoke | local Android device/emulator proof | pending | Google Play/internal-device readiness |
| Android permission manifest completeness | `ANDROID_PERMISSIONS_COMPLETE=1` | pass | store declaration still must match final binary |
| Post composer crash containment | `POST_COMPOSER_ERROR_BOUNDARY=1` | pass | none for this checklist |
| Manual accessibility | VoiceOver/TalkBack owner QA | pending | public-launch QC sign-off |
| Store/legal/owner evidence | store console, legal/privacy, demo account, pushed CI | pending/blocked | final Go |

## Source Coverage Verified

- Auth redirect gates: `isAuthenticated` + `setReturnRoute` in every mixed/private screen ✅
- Error boundaries: `HomeFeedScreen`, `HomeMapScreen`, `DishDetailScreenV2`, `StallDetailScreen`, `ReviewScreen`, `PostComposerScreen` ✅ (PostComposer fixed 2026-06-25)
- Offline handler: `useUIStore.isOffline` drives `OfflineStateScreen` redirect in `RootNavigator` ✅
- Missing route params: `NotFound` screen handles gracefully ✅
- Media permission denial: gallery permission graceful fallback in `PostComposerScreen` ✅
