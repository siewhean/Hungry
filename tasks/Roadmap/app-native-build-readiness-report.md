# Hungry Native Build Readiness Report

Updated: 2026-06-25
Verdict: **Partial / No-Go for public launch** until iOS and Android external build proof exists.

## Config Inventory

| Area | Evidence | Status |
|---|---|---|
| Expo config | `app.config.js` + `app.config.base.json` | present |
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
| Android permissions | coarse/fine location, camera, read media images/video, legacy external storage | present |
| Mapbox native config | `app.config.base.json` plugin `@rnmapbox/maps` with `RNMapboxMapsVersion=11.18.2` | present |

## Required Proof

| Gate | Command/proof | Status |
|---|---|---|
| iOS local simulator build/run | XcodeBuildMCP or `npm run ios` | partial: app reaches simulator through dev client; full Xcode release build proof still pending |
| iOS prepared smoke | `npm run smoke:native:ios:prepared` | blocked in current local run by Expo dev-client/Maestro runtime connection/onboarding behavior |
| iOS media smoke | included in prepared smoke | blocked with prepared smoke |
| iOS activity/chat smoke | included in prepared smoke | blocked with prepared smoke |
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
- 2026-06-19: added the `@rnmapbox/maps` Expo config plugin in the Expo base config so EAS prebuild can inject the Mapbox Maven repository and Mapbox SDK version. Focused native-smoke contract passed.
- 2026-06-25: Expo static config moved from `app.json` to `app.config.base.json` so `app.config.js` can own dynamic config without Expo Doctor reporting app-config coexistence warnings.
- 2026-06-25: prepared iOS smoke runner now reads `app.config.base.json` and stale Developer Launcher flow selectors were updated. Static native smoke contracts pass, but the live prepared iOS smoke remains blocked in this local run by Expo dev-client/Maestro runtime connection/onboarding behavior after reaching the simulator.
- 2026-06-19: fresh Android EAS build could not be started in this environment because uploading the workspace to Expo requires explicit owner approval after external-disclosure review.
- 2026-06-19: prepared Maestro smoke previously passed on a booted iPhone 17 Pro simulator using LAN Metro and the Expo dev-client onboarding `Continue` step. This is superseded by the 2026-06-25 local rerun blocker above until a clean simulator/Metro rerun passes again.
- 2026-06-19: generated cache cleanup restored local disk from about 263 MiB free; current free space after reruns is about 4.8 GiB, so more headroom is still recommended for EAS/native work.
