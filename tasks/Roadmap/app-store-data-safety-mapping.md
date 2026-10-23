# App Store Data Safety Mapping

Updated: 2026-07-24
Verdict: **No-Go until owner/legal verifies store-console answers against this matrix.**

| Data type               |                             Collected? | Shared/processed by                                               | Purpose                                                   | Required/optional      | User control                   | Store disclosure                                                  |
| ----------------------- | -------------------------------------: | ----------------------------------------------------------------- | --------------------------------------------------------- | ---------------------- | ------------------------------ | ----------------------------------------------------------------- |
| Email                   |                                    yes | Supabase Auth/database                                            | authentication, support, deletion                         | required for accounts  | delete account/support request | contact info, user-linked                                         |
| Display name            |                                    yes | Supabase profile tables                                           | public/profile identity                                   | optional after signup  | edit/delete profile            | user content/profile, user-linked                                 |
| Avatar/photo            | yes when a user saves a profile avatar | Supabase Storage                                                  | profile identity                                          | optional               | remove/replace/delete          | photos, user-linked                                               |
| Precise/coarse location |            yes when permission granted | device APIs, Supabase where persisted, map provider where enabled | nearby discovery/map ranking                              | optional               | deny permission/manual area    | location, user-linked                                             |
| Search queries          |         yes in app state/service usage | Supabase/PostHog only if configured                               | discovery, personalization, analytics                     | optional               | privacy settings/data deletion | app activity/search if logged                                     |
| Reviews                 |      no in Release 0.1 released builds | n/a                                                               | review creation is deferred                               | n/a                    | n/a                            | do not declare public review UGC for the Release 0.1 binary       |
| Posts/media             |      no in Release 0.1 released builds | n/a                                                               | feed, post, media, audio, and video controls are deferred | n/a                    | n/a                            | do not declare UGC/photos/videos/audio for the Release 0.1 binary |
| Device ID               |     yes if analytics/crash SDK enabled | Sentry/PostHog/Expo/EAS                                           | diagnostics and analytics                                 | optional/SDK-dependent | privacy policy/deletion        | device identifiers if enabled                                     |
| Crash logs              |                  yes if Sentry enabled | Sentry                                                            | reliability                                               | optional               | privacy policy/deletion        | diagnostics                                                       |
| App interactions        |               yes if analytics enabled | PostHog/Supabase                                                  | product analytics, recommendations                        | optional               | privacy controls/deletion      | app activity                                                      |
| Merchant business data  |                yes if merchant enabled | Supabase, email provider if invites, OCR/AI if used               | merchant profile/menu/verification                        | optional by merchant   | edit/delete/support            | business/contact/user content                                     |
| Payment/order data      |        no for MVP unless enabled later | n/a                                                               | out of production scope                                   | n/a                    | n/a                            | do not disclose as collected unless enabled                       |

## Repo-Side Evidence To Attach Before Store Forms

| Evidence                     | Repo/source anchor                                                                                         | External owner action                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App privacy nutrition labels | This matrix plus `app.json`, analytics config, Supabase schema/storage, and submitted binary feature flags | Complete App Store Connect labels and legal review                                                                                                                                              |
| Google Data Safety answers   | This matrix plus final SDK enablement for Sentry/PostHog/Expo/EAS and Supabase use                         | Complete Play Console Data Safety and Data deletion forms                                                                                                                                       |
| Account deletion path        | In-app Settings deletion path plus public deletion URL proof                                               | Confirm URL is live, public, relevant, and references Hungry/developer name                                                                                                                     |
| Privacy policy               | Public privacy URL plus in-app link                                                                        | Confirm active, non-PDF, non-gated, non-geofenced, and names data retention/deletion                                                                                                            |
| UGC controls                 | Report/block/moderation evidence when reviews/posts/comments/profiles are public                           | Confirm terms/community standards and support escalation owner                                                                                                                                  |
| Permission disclosures       | Final profile-aware EAS native build config and installed binary                                           | Release 0.1 keeps foreground location and gallery access for avatars; camera, microphone, video, legacy storage, Mapbox, audio, and dev-client capabilities are excluded from released profiles |
| Screenshot privacy           | Final store screenshots                                                                                    | Confirm no real personal data, non-consenting faces/contact details, or unlicensed imagery                                                                                                      |

## Store Form Defaults

- Tracking: default **No** unless third-party SDK configuration changes to cross-app tracking.
- Ads: default **No ads**.
- Data deletion: must point to public account deletion URL and in-app settings path.
- Location: disclose because foreground location and nearby discovery remain visible.
- Profile photos: declare optional, user-linked photo collection for avatar upload. Do not declare review/post video or audio for Release 0.1 unless a later binary re-enables and verifies those surfaces.
- Account data: disclose email/profile data because account creation and profile features exist.
- Diagnostics/analytics: disclose only after final Sentry/PostHog/Expo/EAS production enablement is confirmed.
- Microphone: do not declare for Release 0.1; the released profile removes the permission and recording path.

## Blockers

- Owner/legal must confirm App Store privacy nutrition labels and Play Data Safety answers.
- Public privacy/account deletion URLs must be reachable at submission time.
- Sentry/PostHog production enablement must be confirmed before final store forms are locked.
- Final submitted feature flags must be frozen before store answers are copied into App Store Connect or Play Console.
