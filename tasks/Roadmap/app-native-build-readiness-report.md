# Hungry Native Build Readiness Report

Updated: 2026-07-24
Verdict: **Partial / No-Go for public launch** until iOS EAS/TestFlight, Android install smoke, and production EAS proof exists.

## Config Inventory

| Area                                  | Evidence                                                                              | Status                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Expo config                           | `app.json`                                                                            | present ✅                                                                                                                |
| iOS bundle id                         | `app.hungry.mobile`                                                                   | present ✅                                                                                                                |
| Android package                       | `app.hungry.mobile`                                                                   | present ✅                                                                                                                |
| Runtime version                       | `0.1.0` (matches `package.json`, `eas.json`)                                          | aligned ✅                                                                                                                |
| EAS project id                        | `6d724772-04c3-4823-91bc-a1f7604c9f15`                                                | present ✅                                                                                                                |
| EAS internal-alpha / preview profiles | `eas.json`                                                                            | `internal-alpha` / `preview` channels, EAS `preview` environment, staging Supabase source ✅                              |
| EAS production profile                | `eas.json`                                                                            | present, `EXPO_PUBLIC_APP_ENV=production` ✅                                                                              |
| iOS native workspace                  | `ios/Hungry.xcworkspace`                                                              | present ✅                                                                                                                |
| Android native project                | not present locally                                                                   | EAS/generation proof required                                                                                             |
| iOS privacy manifest                  | `ios/Hungry/PrivacyInfo.xcprivacy`                                                    | present ✅                                                                                                                |
| iOS permissions                       | foreground location and gallery photo access in released profiles                     | camera, microphone, dev-network, Face ID, and background audio stripped in EAS release worktree ✅                        |
| Android permissions                   | coarse/fine location, gallery image access, Internet, haptics in released profiles    | camera, video/legacy storage, record audio, foreground audio, and overlay permissions stripped in EAS release worktree ✅ |
| Custom splash                         | `SplashScreen.storyboard` (native) + custom `SplashScreen` React component            | present ✅                                                                                                                |
| App icon                              | `assets/images/Logo/hungry_logo_icon_transparent.png`                                 | present ✅                                                                                                                |
| Deferred native modules               | `scripts/configure-eas-native-profile.mjs`                                            | Mapbox, audio, video, image picker, and dev client excluded from released-profile autolinking ✅                          |
| Sentry native config                  | `@sentry/react-native/expo` plugin, DSN validation hardened                           | present ✅                                                                                                                |
| Sentry DSN validation                 | `App.tsx` `isUsableSentryDsn()` rejects placeholder/invalid DSN                       | hardened ✅                                                                                                               |
| `expo-dev-client` release-excluded    | `app.config.js` and EAS pre-install hook remove it from staging and production builds | confirmed ✅                                                                                                              |
| ATS (iOS)                             | `NSAllowsArbitraryLoads=false`, local network info removed in production              | confirmed ✅                                                                                                              |
| EAS Submit config                     | `eas.json submit.production` is empty `{}`                                            | **pending** — populate before first store submission                                                                      |
| OTA updates                           | `app.json: "enabled": false`                                                          | disabled; enable after stable v1 release with `ON_ERROR_RECOVERY`                                                         |

## Required Proof

| Gate                                   | Command/proof                                         | Status                                                                                                                                                                                                      |
| -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS local simulator build/run          | `npm run ios` or XcodeBuildMCP                        | partial: prepared dev-client smoke passes ✅; Xcode release build pending                                                                                                                                   |
| iOS prepared smoke                     | `npm run smoke:native:ios:prepared`                   | ✅ pass: chat/activity/media flows passed on iPhone 17 Pro simulator with LAN Metro                                                                                                                         |
| iOS media smoke                        | included in prepared smoke                            | ✅ pass                                                                                                                                                                                                     |
| iOS activity/chat smoke                | included in prepared smoke                            | ✅ pass                                                                                                                                                                                                     |
| EAS preview all-platform build         | `eas build --profile preview --platform all`          | partial pass: Android preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` finished with APK artifact; Android install/device smoke still pending; iOS blocked by missing internal-distribution credentials |
| EAS production all-platform build      | `eas build --profile production --platform all`       | **incomplete**: no production iOS/Android artifacts attached                                                                                                                                                |
| TestFlight smoke                       | App Store Connect/TestFlight evidence                 | blocked until iOS EAS credentials/build artifact exist                                                                                                                                                      |
| Play internal track smoke              | Play Console evidence                                 | pending owner; Android preview APK exists, but device install/internal-track smoke is not attached                                                                                                          |
| Release build not debuggable           | native/EAS artifact inspection                        | pending                                                                                                                                                                                                     |
| App size                               | EAS artifact size                                     | pending APK size inspection/install smoke                                                                                                                                                                   |
| `eas.json submit.production` populated | App Store Connect API key, primary language, category | **pending**                                                                                                                                                                                                 |

## Readiness Dependency Matrix

| Dependency                      | Proof/evidence                                                                                                       | Current state    | Release impact                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| Post Composer crash boundary    | `tasks/Roadmap/app-final-go-no-go-checklist.md` key `POST_COMPOSER_ERROR_BOUNDARY=1`                                 | ready            | not a native-build blocker                                                  |
| Android permission declarations | `tasks/Roadmap/app-final-go-no-go-checklist.md` key `ANDROID_PERMISSIONS_COMPLETE=1`; `app.json` Android permissions | ready            | removes permission-declaration blocker; install/device smoke still required |
| Android preview APK             | EAS build `b04ac43f-9a06-43f9-9f38-709cbc17e418`                                                                     | artifact exists  | enough for artifact existence only; not enough for release                  |
| Android install/device smoke    | `adb devices` / emulator or physical device install proof                                                            | pending          | keeps Android readiness Partial / No-Go                                     |
| iOS EAS/TestFlight              | EAS internal-distribution credentials, App Store Connect/TestFlight proof                                            | blocked          | keeps iOS readiness No-Go                                                   |
| Production EAS artifacts        | `eas build --profile production --platform all`                                                                      | incomplete       | required before public launch/store submission                              |
| Submit metadata                 | `eas.json submit.production`                                                                                         | incomplete: `{}` | required before first App Store submission                                  |

## Notes

- Development keeps camera/photo/media capabilities for isolated feature work. Release 0.1 retains gallery access only for the profile-avatar flow, and removes camera/video/audio controls before native dependency installation. The EAS hook operates only on the uploaded build worktree; checked-in native files remain the development baseline.
- XcodeBuildMCP: workspace `ios/Hungry.xcworkspace`, scheme `Hungry`, booted simulator required.
- Android install/device proof must come from an EAS APK/AAB installed on an emulator or physical device, or a generated Android project (no local Android project present).
- 2026-06-25: Android preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` is `FINISHED`, profile `preview`, distribution `INTERNAL`, app version `0.1.0`, build version `1`, commit `7548fff5c8ffde70da1ed96bc0c3981871d26df4`, artifact `https://expo.dev/artifacts/eas/M18CC0geG-qnXty9SelRSuzcmXr-x2NcKx6ZOjk-7Is.apk`.
- 2026-06-24: earlier Android EAS preview `a3b557d8-1922-4369-9546-ad6f96b09396` was recorded as in progress; 2026-06-25 proof is the finished `b04ac43f-9a06-43f9-9f38-709cbc17e418` APK.
- 2026-06-19: added `@rnmapbox/maps` Expo config plugin to resolve Mapbox Maven repository in EAS prebuild.
- 2026-06-25: prepared Maestro smoke passes on iPhone 17 Pro simulator using Expo dev-client onboarding/manual URL handling.
- 2026-06-25: Android local Maestro smoke cannot run in this environment because no Android emulator/device is attached (`adb devices` empty).
- Generated cache cleanup: current free disk ~4.8 GiB; more headroom recommended for EAS/native work.
