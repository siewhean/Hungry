# Usage and feedback analytics

What Hungry records so we can see which parts of the app people use, and what they like or dislike. Everything goes to PostHog (US) and only while "Share usage analytics" is on. Nothing is recorded for someone who declined.

## Usage: which parts are used most and least

| Event | Properties | Meaning |
| --- | --- | --- |
| `screen_viewed` | `screen`, `previous_screen`, `previous_duration_ms` | Fired by the navigators (`src/features/feedback/screenTracking.ts`) each time the focused screen changes. Tabs show as `Home`, `Profile`, etc. Route names only, never params. |

Per-feature events already exist (search, map, saved, reviews, decide-for-me, etc.); the full list is `AnalyticsEventName` in `src/lib/analytics/types.ts`. Home and Search impression logging belongs to the recommendations work, not this file.

Reading it in PostHog: Trends on `screen_viewed`, breakdown by `screen`, ordered by unique users. Time on screen is the average of `previous_duration_ms` broken down by `previous_screen`. Least used = the bottom of that list.

## Feedback

| Where | Event | Properties |
| --- | --- | --- |
| Settings > Help & legal > Send feedback | `feedback_opened` (`source`), `feedback_submitted` | `category` (bug, idea, like, other), `message` (up to 1000 characters; emails and phone numbers are redacted) |
| Decide for me result ("Was this a good pick?") | `feedback_prompt_shown`, `feedback_thumb_submitted`, `feedback_thumb_reason`, `feedback_prompt_dismissed` | `prompt_id` = `decide_pick`, `rating` up/down, `reason` |
| Search results footer ("Did you find what you wanted?") | same events | `prompt_id` = `search_results` |

Rules for the thumbs question (`src/store/useFeedbackStore.ts`): at most one question a day anywhere, the same question not again for 30 days after an answer or "close", never while analytics is off, one tap to answer, reason is optional. A thumbs down counts straight away; the reason arrives as a second event. Written feedback is capped at 5 a day per phone.

When analytics is off, Send feedback opens the person's mail app addressed to the support inbox instead; nothing is sent from the app.

To add a thumbs question: add an entry to `FEEDBACK_PROMPTS` in `src/features/feedback/feedback.ts` and put `<FeedbackThumbs promptId="..." />` on the screen.

## Launch numbers: leaving out our own testing (PKG-0.6)

Until launch almost every event is the team's own testing (audit ANA-2: one tester made 96% of events). Every event now says where it came from, so the launch dashboard can leave it out.

| Property | Where it is set | Meaning |
| --- | --- | --- |
| `environment` | PostHog super property, set when the client starts and again after sign-out (`src/lib/analytics/posthogSink.ts`) | `development`, `staging` or `production` (`FEATURE_FLAGS.appEnv`). Same value as the Sentry environment. |
| `is_internal` | Super property and person property | `true` for any build that is not production, a production build made for the team (`EXPO_PUBLIC_INTERNAL_BUILD=1`, for example the TestFlight internal build), a phone switched on in Settings > Version x7 > Developer tools > "Count this phone as team traffic", and accounts on `@internal.hungry.test` (the staging test diners). It is never written as `false` by default, so read it as "is not true". |

PostHog side (set once by the owner, not by the app): Project settings > "Filter out internal and test users" on, with the filter `is_internal` is not `true`; project timezone Asia/Singapore. Every launch insight also filters `environment = production`.

Switch each team phone on once. The mark is saved on the phone and applied on every launch.

### A/B tests are frozen

Below `EXPERIMENTS_MIN_WEEKLY_DINERS` (300) weekly diners no test can reach a result, so every non-rollout test serves its fallback and records no exposure (`src/lib/experiments/experiments.ts`). The two rollouts (`auth_email_code_first_v1`, `achievements_loop_v1`) still follow their PostHog flags. A QA override still works in a dev or preview build. To unfreeze: change `experimentsFrozen` to false once weekly diners pass the number and a test has its metrics attached in PostHog.

### Dashboard "Hungry launch" (tiles and events)

All tiles: `environment = production`, internal users excluded.

| Tile | Insight | Events |
| --- | --- | --- |
| New diners | Trends, unique users, weekly | `sign_up_completed` |
| First dish opened | Funnel, 7 days | `onboarding_completed` then `dish_viewed` |
| First save | Funnel, 7 days | `dish_viewed` then `dish_favourited` or `stall_saved` |
| First review | Funnel, 7 days | `dish_marked_tried` or `stall_marked_tried` then `review_submitted` |
| Return in week one | Retention, first `app_launched`, returning `app_launched`, weekly | `app_launched` |
| Searches with no result | Trends and table by query length and source | `search_zero_results` |
| Pushes | Trends | `notification_opened` (opened only; delivered counts are in the push provider, not in PostHog) |
