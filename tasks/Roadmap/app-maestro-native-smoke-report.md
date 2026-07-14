# App Maestro Native Smoke Report

Updated: 2026-06-21
Status: **Scaffolded; device/simulator execution pending.**

## Flow Coverage

| Flow | File | Platform |
|---|---|---|
| app launch | `.maestro/ios-app-launch-smoke.yaml`, `.maestro/android-app-launch-smoke.yaml` | iOS/Android |
| guest browse | `.maestro/ios-guest-browse-smoke.yaml`, `.maestro/android-guest-browse-smoke.yaml` | iOS/Android |
| auth gate/login entry | `.maestro/ios-auth-smoke.yaml` | iOS |
| location denied | `.maestro/ios-location-denied-smoke.yaml`, Android guest flow | iOS/Android |
| media permission | `.maestro/ios-media-picker-permission.yaml`, `.maestro/android-media-permission-smoke.yaml` | iOS/Android |
| review/post entry | `.maestro/ios-review-post-smoke.yaml` | iOS |
| activity/chat tab smoke | `.maestro/ios-chat-smoke.yaml` | iOS |

## Commands

- `npm run smoke:native:ios:prepared`
- `npm run smoke:native:android`
- `npm run smoke:native:all`

## Current Blocker

`xcodebuildmcp` session defaults are unset. Before executing simulator build/run, configure workspace `ios/Hungry.xcworkspace`, scheme `Hungry`, and a target simulator, or run the skip-safe Maestro scripts against an already installed development build.

No native Maestro flow was executed in this prepare-only pass. The repo now contains iOS and Android smoke-flow scaffolding plus package-script entry points; store Go still requires real iOS simulator/device and Android emulator/device evidence.
