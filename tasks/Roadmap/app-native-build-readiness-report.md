# Hungry Native Build Readiness Report

Updated: 2026-06-19
Verdict: **Partial / No-Go for public launch** until iOS and Android external build proof exists.

## Config Inventory

| Area | Evidence | Status |
|---|---|---|
| Expo config | `app.json` | present |
| iOS bundle id | `app.hungry.mobile` | present |
| Android package | `app.hungry.mobile` | present |
| Runtime version | `0.1.0` | present |
| EAS project id | `6d724772-04c3-4823-91bc-a1f7604c9f15` | present |
| EAS preview profile | `eas.json` | present, `HUNGRY_DATA_SOURCE=supabase` |
| EAS production profile | `eas.json` | present, `EXPO_PUBLIC_APP_ENV=production` |
| iOS native workspace | `ios/Hungry.xcworkspace` | present |
| Android native project | not present locally | EAS/generation proof required |
| iOS privacy manifest | `ios/Hungry/PrivacyInfo.xcprivacy` | present |
| iOS permissions | location, camera, microphone, photos | present |
| Android permissions | coarse/fine location | present |
| Mapbox native config | `app.json` plugin `@rnmapbox/maps` with `RNMapboxMapsVersion=11.18.2` | present |

## Required Proof

| Gate | Command/proof | Status |
|---|---|---|
| iOS local simulator build/run | XcodeBuildMCP or `npm run ios` | partial: prepared dev-client smoke passes; full Xcode release build proof still pending |
| iOS prepared smoke | `npm run smoke:native:ios:prepared` | pass: chat/activity and media permission flows passed on iPhone 17 Pro simulator with LAN Metro |
| iOS media smoke | included in prepared smoke | pass |
| iOS activity/chat smoke | included in prepared smoke | pass |
| EAS preview all-platform build | `eas build --profile preview --platform all` | blocked: Android source fix is ready but fresh EAS upload/build requires explicit owner approval; iOS still blocked by missing internal-distribution credentials |
| EAS production all-platform build | `eas build --profile production --platform all` | pending after preview |
| TestFlight smoke | App Store Connect/TestFlight evidence | pending owner |
| Play internal track smoke | Play Console evidence | pending owner |
| Release build not debuggable | native/EAS artifact inspection | pending |
| App size | EAS artifact size | pending |

## Notes

- XcodeBuildMCP defaults are not configured at baseline. Set workspace `ios/Hungry.xcworkspace`, scheme `Hungry`, and a booted simulator before build/run.
- Android proof must come from EAS or a generated Android project because no local Android native project is currently present.
- 2026-06-19: EAS CLI authenticated as `siewhean`; Android preview build `6cb95ee3-b795-489b-98d5-1b8f26b175c1` errored because Gradle could not resolve Mapbox native artifacts without the Mapbox Maven repository.
- 2026-06-19: added the `@rnmapbox/maps` Expo config plugin in `app.json` so EAS prebuild can inject the Mapbox Maven repository and Mapbox SDK version. Focused native-smoke contract passed.
- 2026-06-19: fresh Android EAS build could not be started in this environment because uploading the workspace to Expo requires explicit owner approval after external-disclosure review.
- 2026-06-19: prepared Maestro smoke now passes on a booted iPhone 17 Pro simulator using LAN Metro and the Expo dev-client onboarding `Continue` step.
- 2026-06-19: generated cache cleanup restored local disk from about 263 MiB free; current free space after reruns is about 4.8 GiB, so more headroom is still recommended for EAS/native work.
