# Store Submission Checklists (APPLE-02 / PRIV-01 / PLAY-01)

> Canonical checklist surface for store-submission documentation tasks.
> Update this file when submission requirements or evidence links change.

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
