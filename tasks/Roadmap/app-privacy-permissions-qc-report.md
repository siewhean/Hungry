# App Privacy Permissions QC Report

Updated: 2026-06-21  
Status: **Partial / No-Go for store submission.**

## Permission Review

| Permission / plist key | Production decision |
|---|---|
| location when in use | keep; needed for nearby discovery |
| precise/coarse Android location | keep; disclose in Data Safety |
| camera/photo library | keep if review/post/profile uploads are submitted |
| microphone | remove from production config unless recording is launch-enabled |
| local network / Bonjour | dev-only; stripped by release config |
| always location | remove from production config |
| Face ID | remove from production config unless biometric auth ships |
| background audio | remove from production config unless audio playback ships |

## Evidence

- `app.config.js` strips dev-only/unjustified plist entries for production.
- `ios/Hungry/PrivacyInfo.xcprivacy` still needs final binary review after production prebuild/build.

## Blockers

- Store forms must match final binary permissions.
- Legal approval for privacy policy and account deletion is external.

