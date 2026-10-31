# App Store reviewer access (guideline 2.1)

Why: sign-in is an emailed 8 digit code, which an Apple reviewer cannot receive. The login screen keeps a "Use a password instead" link, so a reviewer account with a password works with no code change. Apple needs working credentials in App Review Notes and a live backend for the whole review window.

## Create the reviewer account (sh, once, on prod)

Prod project: Singapore `frluxwpqqyomiqmjzavd`. Do this in the Supabase Dashboard, not through SQL or a migration.

1. Authentication > Users > Add user > Create new user.
2. Email: a mailbox you control, for example `appreview@usehungry.com`. Password: a long random one (store it in the password manager and paste it into App Store Connect only; never commit it).
3. Tick "Auto Confirm User".
4. On a phone build, tap "Use a password instead" on the login screen and sign in. Finish onboarding with display name `App Review` and a Singapore area.
5. Seed what a reviewer should see: save 3 to 5 dishes into a list, follow one stall, and write one real review with a photo of a real dish (never synthetic data).
6. Confirm it is rate-limit safe: password sign-in is not behind the email cap (200 per hour), so nothing to change.
7. Keep the account out of analytics goals: filter the user id out in PostHog (an internal-user filter) so it does not skew retention.

Check from a second phone before every submission: sign out, "Use a password instead", sign in, open Search, a dish, a stall, Settings > Delete account (stop at the confirm dialog).

## App Review Notes (paste into App Store Connect, fill the brackets)

Sign-in: Hungry normally signs in with an emailed code. For review, please use the password option.
- On the sign-in screen tap "Use a password instead" under the email field.
- Email: [appreview address]
- Password: [password]

What the app does: Hungry helps people in Singapore find dishes at hawker stalls and restaurants, see prices, read photo reviews and save places. No payments, no ordering and no purchases happen in the app. "Order" links open Grab, Foodpanda or Deliveroo.

Core path: sign in > Home > Search (try "laksa") > open a dish > open the stall > save a dish > Profile > Settings > Delete account (stop at the confirm dialog).

Location: asked only when using nearby ranking and the map. Declining is fine: the app lets you pick an area by name instead.

User-generated content: reviews and photos. Each review has a "..." menu with Report and Block (Report offers four reasons). Blocked people and hidden reviews disappear from your feeds. Reviews are checked for banned terms and spam, and review photos are checked for explicit or violent content, before they show. Reports are looked at within 24 hours (Terms section 3). Contact: usehungrysingapore@gmail.com.

Account deletion: Profile > Settings > Delete account (email code confirmation; the account is hidden at once and removed after 30 days unless you sign in and choose Keep my account). Public page: https://usehungry.com/account/delete.

Third-party AI: one prompt ("Allow AI features?") asks permission before typed search words go to Anthropic and before a menu photo goes to Google. It can be turned off in Settings > Privacy & data > AI features. Privacy policy: https://usehungry.com/privacy.

Sign in with Apple: not offered. The iPhone app signs in by emailed code or password only and has no Google, Facebook or other third-party login, so guideline 4.8 does not apply.

Not in this build: merchant tools, stories, comments, social feed, messages. Merchant listing is free and not part of this release.

Demo content note: [say how many stalls have full menus and photos in the launch neighbourhoods; list 3 to 5 complete stall names for the reviewer to open].

## Before pressing Submit

- [ ] Reviewer account works on a fresh install.
- [ ] Privacy policy and Terms pages show "Last updated: October 31, 2026" or later and name Anthropic, Google, Resend and Mapbox.
- [ ] App Privacy answers match `ios/Hungry/PrivacyInfo.xcprivacy` (see `tasks/app-store-privacy-answers.md`).
- [ ] Built `.ipa` entitlements include `aps-environment` and `applinks:usehungry.com` (EAS pre-install hook writes them for staging and production only).
- [ ] Built `.ipa` Info.plist has no `NSLocalNetworkUsageDescription`, `NSBonjourServices` or `NSFaceIDUsageDescription`.
- [ ] Age rating questionnaire: user-generated content yes; moderation exists; no unrestricted web access.

## Server settings that must be live before submitting (sh)

- `GOOGLE_CLOUD_VISION_API_KEY` set on the Singapore project. Without it the review photo check answers "unchecked" and lets every photo through (it reports the missing key to Sentry each time). Deploy `check-photo-safety`, `report-digest` and the updated `ingest-menu-photo`.
- Report digest: set the function secrets `REPORT_DIGEST_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM` (and optionally `REPORT_DIGEST_TO`), then run once in the SQL editor:
  `select vault.create_secret('https://frluxwpqqyomiqmjzavd.supabase.co/functions/v1/report-digest', 'report_digest_url');`
  `select vault.create_secret('<the same REPORT_DIGEST_TOKEN>', 'report_digest_token');`
  Until both exist the 15 minute job does nothing. Send yourself a test report and check the inbox.
- Migration `20261031090000_content_report_digest` goes through `rehearse.sh` on staging and `ship.sh` to prod (project rule 9).
