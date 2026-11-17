# Store Submission Checklists (APPLE-02 / PRIV-01 / PLAY-01)

> Canonical checklist surface for store-submission documentation tasks.
> Update this file when submission requirements or evidence links change.

## Policy Source Spot-Check — 2026-05-23

Official sources checked for the current No-Go store-submission gate:

- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play user-generated content policy: https://support.google.com/googleplay/android-developer/answer/9876937
- Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Data Safety overview: https://support.google.com/googleplay/answer/11416267

Current evidence status: repo-side privacy/account-deletion/UGC surfaces exist, but store submission remains blocked until final public URL reachability, App Store Connect privacy metadata, Google Play Data Safety/account-deletion answers, and reviewer access/test steps are verified from the external store consoles.

## APPLE-02 — App Store Metadata + Review Notes Checklist

Owner: User  
Status: Open (external App Store Connect actions required)

- [ ] App name, subtitle, keywords, and description match shipped app behavior and wording.
- [ ] Promotional text and "What's New" avoid mock/demo-only claims.
- [ ] Category, age rating, and content rights are accurate.
- [ ] Support URL is valid and publicly reachable.
- [ ] Marketing URL is valid (if provided).
- [ ] Privacy Policy URL is set and reachable.
- [ ] Screenshots are current for required device classes and match current UI.
- [ ] App Preview video (if used) reflects current in-app flows.
- [ ] App Review Notes include:
  - [ ] Test account credentials or OTP/test steps (if auth-gated).
  - [ ] Any feature flags or staged features reviewer must know.
  - [ ] Clear steps to reach key flows (auth, onboarding, core discovery, account deletion if present).
  - [ ] Clarification for any non-obvious permissions prompts.
- [ ] Contact info for review questions is valid.

Evidence target:
- App Store Connect submission payload and screenshots reviewed against current app build.

## PRIV-01 — Privacy Policy Linkage Requirements (Apple + Google)

Owner: User  
Status: Open (external store listing and public URL actions required)

- [ ] A public privacy policy URL exists, is reachable without auth, and is stable.
- [ ] Policy clearly describes collected data categories, purposes, sharing, retention, and deletion process.
- [ ] App Store Connect Privacy Policy URL points to the published policy.
- [ ] Google Play listing Privacy Policy URL points to the same published policy (or platform-specific equivalent).
- [ ] In-app settings/help surface links to the same privacy policy URL.
- [ ] Policy reflects actual SDKs/services and app behavior (no placeholder statements).

Evidence target:
- Store listing URL fields + in-app settings link all point to the final public policy URL.

Repo evidence:
- Policy URL target: `https://hungry.sg/privacy`
- Account deletion URL target: `https://hungry.sg/account/delete`
- App linkage: `src/app/screens/profile/SettingsScreen.tsx`, `src/app/screens/auth/SignUpScreen.tsx`
- Public pages: `marketing/web/app/privacy/page.tsx`, `marketing/web/app/account/delete/page.tsx`, `marketing/website/web-v2/src/app/privacy/page.tsx`, `marketing/website/web-v2/src/app/account/delete/page.tsx`

Disclosure matrix to mirror in Apple App Privacy and Google Play Data Safety:

| Data category | Hungry usage | Shared/processed by | Store disclosure note |
|---|---|---|---|
| Name, email, auth identifiers | Account creation, sign-in, support, deletion requests | Supabase Auth/database | User-linked account data |
| Location | Nearby discovery, maps, area selection | Mapbox/Google where enabled, Supabase if persisted | Declare location use when permission is requested |
| Photos/videos/menu images | Posts, reviews, profile/merchant media, OCR/menu ingestion | Supabase Storage, Google Vision/Gemini where enabled | User content/media uploads |
| Reviews/posts/comments/messages | Community, social feed, reporting, moderation | Supabase database/realtime | User-generated content; moderation controls required |
| Taste and interaction signals | Recommendations, personalization, analytics | Supabase, PostHog where configured | Product personalization/activity data |
| Merchant claim/menu/team data | Merchant tools, verification, notifications | Supabase, OCR/AI processors where enabled | Business/contact content where submitted |
| Crash/diagnostic/analytics events | Reliability, abuse prevention, product analytics | Sentry, PostHog, Expo/EAS where configured | Diagnostics and app activity |

## PLAY-01 — Play Data Safety + Account Deletion URL Checklist

Owner: User  
Status: Open (external Play Console actions required)

- [ ] Play Console Data Safety form matches actual app data collection/use/sharing.
- [ ] Data collection declarations align with runtime permissions and implemented flows.
- [ ] Data sharing declarations match third-party SDK/service behavior.
- [ ] Retention and deletion statements align with published policy and implemented deletion flow.
- [ ] Account creation support is declared accurately.
- [ ] Account deletion support is declared accurately.
- [ ] Account deletion URL is provided in Play Console and is publicly reachable.
- [ ] Deletion URL contains clear instructions and expected deletion timeline.

Evidence target:
- Final Play Console Data Safety questionnaire + Account Deletion URL field values.

Repo evidence:
- Account deletion is discoverable in app Settings and public URL documentation once `ACCDEL-01` implementation is verified.
- Data Safety answers must match the disclosure matrix above and the final shipped feature flags.

## Build Credentials — R01-IOS-01 / R01-AND-01 / R01-TEST-01

Owner: User (Apple/Google/Expo account steps). Repo side: `eas.json` `submit.production` targets Apple team `94R58J6LA2` and the Play `internal` track as a draft; `.easignore` trims the upload context.

- [ ] Apple Developer Program membership is active for team `94R58J6LA2` (paid, not a free Apple ID).
- [ ] iOS internal build: `eas device:create` for each tester iPhone, then `eas build -p ios --profile preview` and let EAS create the ad hoc certificate/profile. (Alternative with no device registration: `--profile production` + TestFlight internal testing.)
- [ ] App Store Connect: create the app record for `app.hungry.mobile`; add an ASC API key with `eas credentials -p ios`. Add its numeric `ascAppId` to `submit.production.ios` once known so non-interactive submits work.
- [ ] Google Play Console: create the app for `app.hungry.mobile`, upload the first AAB by hand (Play rejects API uploads before that), then upload a service-account JSON with `eas credentials -p android` for `eas submit`.
- [ ] Android device proof: install the final-head `preview` APK on a real phone; record build ID, screenshots and scenario results in `tasks/verification.md`.
- [ ] Local `eas build` clones the repo into the OS temp folder before applying `.easignore`; run it with `TMPDIR` pointing at a volume with ≥4 GiB free.
- [ ] R01-TEST-01: five internal testers named (emails only, no passwords in repo), added to TestFlight / Play internal testing.

Dependency: scenario passes need a live backend (Supabase is currently down), so device proof can install and launch now but full journeys wait on the backend rebuild.
