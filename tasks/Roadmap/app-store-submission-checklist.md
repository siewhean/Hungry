# Hungry App Store and Play Store Submission Checklist

Updated: 2026-06-25
Verdict: **No-Go** until owner-provided store-console and legal evidence exists.

## Submission Readiness

| Check | Status | Evidence / required action |
|---|---:|---|
| ASO metadata drafts | repo-drafted | `tasks/Roadmap/app-store-submission-qc-report.md`; `tasks/Roadmap/google-play-submission-qc-report.md`; owner approval required |
| Reviewer notes template | repo-drafted | `tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md`; final account/backend details required |
| App Store metadata complete | pending | App Store Connect proof required |
| Play Store metadata complete | pending | Play Console proof required |
| Screenshots accurate | pending | current app screenshots for production-enabled feature set required |
| App description accurate | pending | must match production-enabled feature flags (no DMs, no stories, no merchant, no gamification) |
| Screenshot/image rights checked | pending | no real personal data, no unlicensed imagery |
| Support URL works | pending | public URL proof required (`support.hungry.sg` or equivalent) |
| Privacy URL works | pending | public URL proof required (`hungry.sg/privacy` or equivalent) |
| Account deletion URL works | pending | public URL proof required (Apple + Google both require this) |
| Demo account ready | pending | reviewer credentials or approved demo mode required |
| Backend live for review | partial pass | linked Supabase live smokes pass ✅; reviewer/staging account proof pending |
| Android preview build | ✅ preview artifact pass | EAS build `b04ac43f-9a06-43f9-9f38-709cbc17e418` finished; APK artifact available per `tasks/Roadmap/app-final-go-no-go-checklist.md`; Android install smoke, Play internal track, and Android production proof remain pending |
| Android install smoke | pending | attach Android emulator/device and install the finished preview APK |
| Android internal track / production proof | pending | Play internal track smoke and Android production build proof required |
| Android permissions updated | ✅ fixed 2026-06-25 | CAMERA, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_EXTERNAL_STORAGE added to `app.json`; proof key `ANDROID_PERMISSIONS_COMPLETE=1` in `tasks/Roadmap/app-final-go-no-go-checklist.md` |
| iOS preview build | blocked | configure internal-distribution credentials for non-interactive EAS preview |
| Post composer crash isolation | ✅ fixed 2026-06-25 | `PostComposerScreen` wrapped in `FeedErrorBoundary`; proof key `POST_COMPOSER_ERROR_BOUNDARY=1` in `tasks/Roadmap/app-final-go-no-go-checklist.md` |
| UGC moderation notes | pending | required if posts/reviews/profiles are public in submitted build |
| Review notes — non-obvious features | pending | explain: Hungry Wheel (shared dice-roll for food decisions), Crave (personalised roulette), taste profile, hawker/food-court specific search |
| Apple privacy nutrition labels | pending | owner/legal review required; must match `PrivacyInfo.xcprivacy` and actual app behavior |
| Google Data Safety | pending | must match actual app behavior and privacy policy |
| Account deletion policy completed | pending | Apple + Google both require in-app and web account deletion |
| Age rating/category correct | pending | owner confirmation (likely 4+ / Everyone with Food & Drink category) |
| UGC terms/report/block/moderation evidence | pending | required if posts/reviews/comments/profiles public in submitted build |
| Location/photo/camera/microphone copy accurate | source present ✅ | iOS `infoPlist` strings verified; store form still pending |
| `eas.json submit.production` populated | pending | App Store Connect API key/issuer/key path + Google Play service-account env vars |
| Sentry source maps for production build | pending | `SENTRY_AUTH_TOKEN` required in EAS production build |

## Readiness / QC File Index

| File | Use |
|---|---|
| `tasks/Roadmap/app-final-go-no-go-checklist.md` | Current No-Go status, release evidence keys, finished Android preview artifact, remaining proof blockers |
| `tasks/Roadmap/app-production-readiness-audit.md` | Repo-local gate snapshot, Android install/internal-track/production blockers, store-console/legal/demo blockers |
| `tasks/Roadmap/app-store-submission-qc-report.md` | App Store listing draft, reviewer notes, App Store blocker list |
| `tasks/Roadmap/google-play-submission-qc-report.md` | Google Play listing draft, Data Safety/internal-track/pre-launch blocker list |
| `tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md` | Cross-store prelaunch QA/QC scope and evidence bundle |
| `tasks/Roadmap/app-privacy-permissions-qc-report.md` | Permission/Data Safety disclosure notes and store-form blockers |
| `tasks/Roadmap/app-store-data-safety-mapping.md` | Draft Data Safety/App Privacy disclosure mapping for owner/legal review |

## Release Evidence Keys Cited

```text
POST_COMPOSER_ERROR_BOUNDARY=1
ANDROID_PERMISSIONS_COMPLETE=1
ANDROID_EAS_PROOF=1
STORE_CONSOLE_PROOF=0
IOS_EAS_PROOF=0
IOS_RELEASE_BUILD_PROOF=0
TESTFLIGHT_SMOKE_PROOF=0
```

## Apple App Store Review Notes Template

```
App name: Hungry
Category: Food & Drink
Age rating: 4+
Description: Hungry is a dish-first food discovery app for Singapore hawker centres and food courts. Users find dishes they want to eat, ranked by their personal taste profile and nearby location.

Key features in this build:
- Browse dishes and stalls near your location
- Search by dish name, stall name, or area (e.g. Jurong East, Tampines)
- Taste profile personalisation (6-axis: sweet, spicy, sour, salty, rich, aromatic)
- Save favourite dishes
- Write and submit reviews with optional photos
- Hungry Wheel: shared dice-roll for group food decisions (requires no account)
- Reads: food editorial content

Features intentionally not in this build (production feature flags disabled):
- Direct Messages (requires further moderation infrastructure)
- Stories (requires further content moderation)
- Merchant Centre (requires further merchant verification)
- Collections, Passport, Missions (gamification, future sprint)

Demo account: [provide reviewer email + password]
Backend: Live Supabase (Singapore region)
```

## Policy References

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play Developer Program Policies: https://support.google.com/googleplay/android-developer/answer/16070163
- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Data safety: https://support.google.com/googleplay/answer/11416267
