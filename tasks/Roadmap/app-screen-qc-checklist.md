# Hungry App Screen QC Checklist

Updated: 2026-06-19
Verdict: **Partial**. Source coverage exists for core MVP screens; full public-launch QC still requires iOS and Android runtime proof.

| Screen | iOS | Android | Loading | Empty | Error | Offline | Permission denied | Auth state | Accessibility | Security | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Splash | pending runtime | pending runtime | n/a | n/a | pending | pending | n/a | pending | pending | pass source | pending |
| Onboarding | pending runtime | pending runtime | pass source | n/a | pending | pending | location handled | guest | pending | pass source | pending |
| Login | pending runtime | pending runtime | pass source | n/a | pass source | pending | n/a | guest | pending | pass source | pending |
| SignUp | pending runtime | pending runtime | pass source | n/a | pass source | pending | n/a | guest | pending | pass source | pending |
| EmailVerification | pending runtime | pending runtime | pass source | n/a | pending | pending | n/a | mixed | pending | pending external email | pending |
| ForgotPassword | pending runtime | pending runtime | pass source | n/a | pending | pending | n/a | guest | pending | pending external email | pending |
| ResetPassword | pending runtime | pending runtime | pass source | n/a | invalid callback source covered | pending | n/a | callback | pending | pass source | pending |
| Home | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| Discover | pending runtime | pending runtime | pass source | pass source | pass source | pending | location denied source | guest/auth | pending | pass source | pending |
| SearchHome | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| SearchResults | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| BrowseDishes | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| BrowseStalls | pending runtime | pending runtime | pass source | pass source | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| TasteFilter | pending runtime | pending runtime | pass source | n/a | pending | pending | n/a | guest/auth | pending | pass source | pending |
| DishDetail | pending runtime | pending runtime | pass source | missing data source covered | pass source | pending | n/a | guest/auth | pending | pass source | pending |
| StallDetail | pending runtime | pending runtime | pass source | missing data source covered | pass source | pending | maps permission pending | guest/auth | pending | pass source | pending |
| DiscoverMap | pending runtime | pending runtime | pass source | pass source | pending | pending | pending runtime | guest/auth | pending | token runtime pending | pending |
| DecideForMe/Wheel | pending runtime | pending runtime | pass source | pending | pending | pending | n/a | mixed | pending | join-code validation source | pending |
| Review flow | pending runtime | pending runtime | pass source | pending | pass source | pending | media permission pending | auth required | pending | service-backed source | pending |
| Post composer | pending runtime | pending runtime | pass source | pending | pass source | pending | media denied source covered | auth required | pending | service-backed source | pending |
| Activity inbox | pending runtime | pending runtime | pass source | pending | pass source | pending | n/a | auth required | pending | auth/protected route source | pending |
| Profile | pending runtime | pending runtime | pass source | pending | pending | pending | n/a | auth required | pending | source-backed profile | pending |
| EditProfile | pending runtime | pending runtime | pass source | n/a | pending | pending | media pending | auth required | pending | source-backed profile | pending |
| Settings | pending runtime | pending runtime | pass source | n/a | account deletion error source | pending | n/a | auth required | pending | deletion request source | pending |
| Favourites | pending runtime | pending runtime | pass source | pass source | pending | pending | n/a | auth required | pending | Supabase sync source | pending |
| ReviewHistory | pending runtime | pending runtime | pass source | pass source | pending | pending | n/a | auth required | pending | Supabase sync source | pending |
| Offline | pending runtime | pending runtime | n/a | n/a | n/a | pending runtime | n/a | guest/auth | pending | pass source | pending |
| NotFound | pending runtime | pending runtime | n/a | n/a | pass source | pending | n/a | guest/auth | pending | safe missing route | pending |
| MerchantTabs | disabled in prod | disabled in prod | pending | pending | pending | pending | media pending | merchant only | pending | production disabled | disabled |
| DeveloperLauncher | dev only | dev only | n/a | n/a | n/a | n/a | n/a | dev only | n/a | dev only | disabled in prod |

Runtime acceptance requires:
- iOS simulator/device smoke.
- Android emulator/device or EAS internal proof.
- Manual VoiceOver and TalkBack smoke.
- Location denied and media denied proof.
- No terminal/simulator console errors during the smoke pass.
