# Hungry App Screen QC Checklist

Updated: 2026-06-25
Verdict: **Partial**. Source coverage exists for core MVP screens; full public-launch QC still requires iOS and Android runtime proof.

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

- iOS simulator/device smoke (prepared Maestro smoke passes ✅ as of 2026-06-19).
- Android emulator/device or EAS internal proof (in progress, pending artifact).
- Manual VoiceOver and TalkBack smoke.
- Location denied and media denied proof.
- No terminal/simulator console errors during smoke pass.

## Source Coverage Verified

- Auth redirect gates: `isAuthenticated` + `setReturnRoute` in every mixed/private screen ✅
- Error boundaries: `HomeFeedScreen`, `HomeMapScreen`, `DishDetailScreenV2`, `StallDetailScreen`, `ReviewScreen`, `PostComposerScreen` ✅ (PostComposer fixed 2026-06-25)
- Offline handler: `useUIStore.isOffline` drives `OfflineStateScreen` redirect in `RootNavigator` ✅
- Missing route params: `NotFound` screen handles gracefully ✅
- Media permission denial: gallery permission graceful fallback in `PostComposerScreen` ✅
