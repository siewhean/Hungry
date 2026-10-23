# App Privacy Permissions QC Report

Updated: 2026-07-24
Status: **Partial / No-Go for store submission.**

## Permission Review

| Permission / plist key                         | Production decision                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| location when in use                           | keep; needed for nearby discovery                                        |
| precise/coarse Android location                | keep; disclose in Data Safety                                            |
| camera                                         | removed from internal-alpha, preview, and production                     |
| photo library                                  | keep; the released avatar update flow uses gallery selection and upload  |
| microphone                                     | removed from internal-alpha, preview, and production                     |
| video media and legacy external storage        | removed from internal-alpha, preview, and production                     |
| Mapbox, `expo-audio`, `expo-video`, dev client | excluded from released native autolinking; retained only for development |
| local network / Bonjour                        | dev-only; stripped by release config                                     |
| always location                                | remove from production config                                            |
| Face ID                                        | remove from production config unless biometric auth ships                |
| background audio                               | remove from production config unless audio playback ships                |

## Evidence

- `app.config.js` emits the reduced native config for staging and production.
- `scripts/configure-eas-native-profile.mjs` applies the same reduction to the isolated EAS build worktree before dependency installation, including checked-in iOS/Android native projects.
- `ios/Hungry/PrivacyInfo.xcprivacy` still needs final binary review after internal-alpha and production builds.

## Blockers

- Store forms must match final binary permissions.
- Legal approval for privacy policy and account deletion is external.
