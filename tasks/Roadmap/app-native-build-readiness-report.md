# Hungry Native Build Readiness Report

Updated: 2026-06-25
Verdict: **Partial / No-Go for public launch** until iOS and Android external build proof exists.

## Config Inventory

| Area | Evidence | Status |
|---|---|---|
| Expo config | `app.json` | present ✅ |
| iOS bundle id | `app.hungry.mobile` | present ✅ |
| Android package | `app.hungry.mobile` | present ✅ |
| Runtime version | `0.1.0` (matches `package.json`, `eas.json`) | aligned ✅ |
| EAS project id | `6d724772-04c3-4823-91bc-a1f7604c9f15` | present ✅ |
| EAS preview profile | `eas.json` | present, `HUNGRY_DATA_SOURCE=supabase` ✅ |
| EAS production profile | `eas.json` | present, `EXPO_PUBLIC_APP_ENV=production` ✅ |
| EAS secret scope | `eas env:list preview/production` | required Supabase, Sentry, PostHog, Mapbox, auth redirect, and data-source variables configured; sensitive/secret values hidden ✅ |
| iOS native workspace | `ios/Hungry.xcworkspace` | present ✅ |
| Android native project | not present locally | EAS/generation proof required |
| iOS privacy manifest | `ios/Hungry/PrivacyInfo.xcprivacy` | present ✅ |
| iOS permissions | location, camera, microphone, photos | all present with correct copy ✅ |
| Android permissions | coarse/fine location, camera, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_EXTERNAL_STORAGE | **updated 2026-06-25** ✅ |
| Custom splash | `SplashScreen.storyboard` (native) + custom `SplashScreen` React component | present ✅ |
| App icon | `assets/images/Logo/hungry_logo_icon_transparent.png` | present ✅ |
| Mapbox native config | `app.json` plugin `@rnmapbox/maps` with `RNMapboxMapsVersion=11.18.2` | present ✅ |
| Sentry native config | `@sentry/react-native/expo` plugin, DSN validation hardened | present ✅ |
| Sentry DSN validation | `App.tsx` `isUsableSentryDsn()` rejects placeholder/invalid DSN | hardened ✅ |
| `expo-dev-client` production-excluded | `app.config.js` removes `expo-dev-client` in production builds | confirmed ✅ |
| ATS (iOS) | `NSAllowsArbitraryLoads=false`, local network info removed in production | confirmed ✅ |
| EAS Submit config | `eas.json submit.production` is empty `{}` | **pending** — populate before first store submission |
| OTA updates | `app.json: "enabled": false` | disabled; enable after stable v1 release with `ON_ERROR_RECOVERY` |

## Required Proof

| Gate | Command/proof | Status |
|---|---|---|
| iOS local simulator build/run | `npm run ios` or XcodeBuildMCP | partial: prepared dev-client smoke passes ✅; Xcode release build pending |
| iOS prepared smoke | `npm run smoke:native:ios:prepared` | ✅ pass: chat/activity/media flows passed on iPhone 17 Pro simulator with LAN Metro |
| iOS media smoke | included in prepared smoke | ✅ pass |
| iOS activity/chat smoke | included in prepared smoke | ✅ pass |
| EAS preview all-platform build | `eas build --profile preview --platform all` | partial pass: Android preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` finished with APK artifact; iOS blocked by missing internal-distribution credentials |
| EAS production all-platform build | `eas build --profile production --platform all` | pending artifacts; secret scope is configured |
| TestFlight smoke | App Store Connect/TestFlight evidence | pending owner |
| Play internal track smoke | Play Console evidence | pending owner |
| Release build not debuggable | native/EAS artifact inspection | pending |
| App size | EAS artifact size | pending APK size inspection/install smoke |
| `eas.json submit.production` populated | App Store Connect API key, primary language, category | **pending** |

## Notes

- Android camera/photo permissions fixed 2026-06-25: `CAMERA`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE` added to `app.json` Android permissions array. `expo-image-picker` plugin may inject some of these, but explicit declaration is required for Play Store review compliance.
- XcodeBuildMCP: workspace `ios/Hungry.xcworkspace`, scheme `Hungry`, booted simulator required.
- Android proof must come from EAS or a generated Android project (no local Android project present).
- 2026-06-25: EAS preview and production environment lists confirm release secrets/config are configured for Supabase, Sentry, PostHog, Mapbox, auth redirect, and data source. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` already existed as secret variables from 2026-04-19; EAS rejected visibility downgrade, which is expected.
- 2026-06-25: Android preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` is `FINISHED`, profile `preview`, distribution `INTERNAL`, app version `0.1.0`, build version `1`, commit `7548fff5c8ffde70da1ed96bc0c3981871d26df4`, artifact `https://expo.dev/artifacts/eas/M18CC0geG-qnXty9SelRSuzcmXr-x2NcKx6ZOjk-7Is.apk`.
- 2026-06-19: added `@rnmapbox/maps` Expo config plugin to resolve Mapbox Maven repository in EAS prebuild.
- 2026-06-25: prepared Maestro smoke passes on iPhone 17 Pro simulator using Expo dev-client onboarding/manual URL handling.
- 2026-06-25: Android local Maestro smoke cannot run in this environment because no Android emulator/device is attached (`adb devices` empty).
- Generated cache cleanup: current free disk ~4.8 GiB; more headroom recommended for EAS/native work.
