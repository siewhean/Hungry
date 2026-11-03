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
