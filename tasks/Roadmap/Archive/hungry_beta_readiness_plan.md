# Hungry Beta Readiness Plan

> Project: Hungry  
> Purpose: Prepare Hungry for a controlled beta release with real users, real data, and reliable feedback loops.  
> Recommended scope: Private/TestFlight beta first, then limited public beta.

---

## 1. Beta Readiness Goal

The goal of beta is not to prove that every future feature is complete.

The goal is to prove that Hungry's core consumer loop works reliably:

```text
Open Hungry
→ discover food nearby
→ view dish/stall details
→ save, comment, review, or post
→ app learns preferences
→ recommendations improve
```

Hungry should enter beta only when users can complete this loop without hitting broken screens, confusing navigation, missing states, or unstable data.

---

## 2. Recommended Beta Definition

### Beta should include

- Home social feed
- Review feed
- Rate / quick review flow
- Dish detail page
- Stall detail page
- Discover page
- Map discovery entry point
- Basic store/building drill-down where data exists
- User profile viewing
- Comments and replies
- Save / favourite interactions
- Auth and onboarding
- Supabase-backed data access
- Media upload where already supported
- Analytics and crash monitoring

### Beta should not require

- Full V2 Post Composer
- Full indoor mall polygon directory for every mall
- QR ordering
- Merchant portal
- Real-time chat
- Instagram cross-posting
- Licensed commercial music library
- AI-powered photo editing production stack

These can be planned as V2 or post-beta features.

---

## 3. Beta Release Strategy

### Stage 1 — Internal Alpha

Audience:
- You
- developers
- close collaborators

Goal:
- catch crashes, broken navigation, and obvious UX issues.

Required before moving on:
- app builds successfully
- no red screens on core flows
- login/signup works
- onboarding works
- Home, Discover, Review, Rate, Profile all open
- core detail pages open
- comments/replies work locally or through the selected backend path

---

### Stage 2 — Private Beta

Audience:
- 10–30 trusted users
- preferably food-focused users in Singapore

Goal:
- understand whether users understand the app and want to use it again.

Required before moving on:
- analytics installed and verified
- crash reporting installed and verified
- feedback collection channel ready
- privacy policy and terms drafted
- onboarding can be completed by non-technical users
- no major dead buttons or placeholder screens in primary flows

---

### Stage 3 — Limited Public Beta

Audience:
- 100–500 users
- one or more selected Singapore areas

Goal:
- validate retention, discovery quality, review creation, and map usefulness.

Required before moving on:
- production environment configured
- staging environment remains separate
- real database seed quality improved
- crash-free session rate acceptable
- key funnels measurable
- basic moderation process defined
- support/contact channel ready

---

## 4. Beta Scope Lock

Before beta, freeze the feature scope.

### Must-have beta features

#### 4.1 Auth and onboarding

- Sign up
- Login
- Logout
- Guest-safe browsing where appropriate
- Taste onboarding
- Location permission flow
- Error states for auth failures
- Loading states for auth actions

#### 4.2 Home

- Social food feed
- Stories/Bites rail if kept in the product
- Post cards with like/save/comment/message/share affordances
- User profile tap behavior
- Comment and reply behavior
- Empty/loading/error states

#### 4.3 Review

- Review-focused feed
- Review cards open correct detail pages
- Review cards have correct spacing and visual hierarchy
- Like/save/comment/profile/stall interactions do not conflict with card press behavior

#### 4.4 Rate

- Fast review creation
- Dish/stall selection
- Rating submission
- Tags/taste tags if supported
- Success confirmation
- Draft or safe exit behavior if the user leaves mid-flow

#### 4.5 Discover

- Search
- Taste filters
- Situation-based discovery if already implemented
- Decide For Me
- Category chips
- Dish/stall cards
- Empty/loading/error states

#### 4.6 Map

- Discover map entry point
- Marker display
- Building/stall cards
- Building drill-down for available data
- Clear fallback state when floor plan or venue data is unavailable

#### 4.7 Detail pages

- Dish detail
- Stall detail
- Save/favourite
- Share
- Reviews/comments/replies
- Opening hours
- Tags
- Media carousel if supported

#### 4.8 Profile

- Own profile
- Other user profile
- Saved items
- Review history
- Settings
- Appearance setting
- Logout

---

## 5. Features to Feature-Flag or Hide Before Beta

Hide or feature-flag anything that is not ready.

Recommended flags:

```text
directMessagesEnabled
commentsEnabled
craveEnabled
merchantClaimCtaEnabled
postComposerV2Enabled
mapIndoorDirectoryEnabled
musicPickerEnabled
instagramCrossPostEnabled
aiComposerToolsEnabled
qrOrderingEnabled
merchantPortalEnabled
```

Before beta, every visible button should either:

1. work fully,
2. be clearly labelled as beta/coming soon,
3. or be hidden.

Do not show dead buttons.

---

## 6. Core Beta User Flows

Each flow should be tested on a real device.

### Flow A — New user onboarding

```text
Install app
→ open app
→ sign up
→ verify or complete mocked verification path
→ complete taste onboarding
→ grant or deny location permission
→ reach Home
```

Pass criteria:
- no crash
- no confusing dead end
- user lands in the correct post-onboarding screen
- profile state is not stuck as guest after login

---

### Flow B — Discover food

```text
Open Discover
→ search for a food/dish/stall
→ apply a filter
→ open Dish Detail
→ save/favourite
→ share or view stall
```

Pass criteria:
- search returns useful results
- no broken images
- detail navigation is correct
- save state persists correctly

---

### Flow C — Review something

```text
Open Rate
→ choose dish/stall
→ add rating
→ add tags/comment/media if supported
→ submit
→ see success confirmation
→ review appears in relevant surface if supported
```

Pass criteria:
- submission does not feel fake
- loading and success state are clear
- failure state is recoverable

---

### Flow D — Use Home social feed

```text
Open Home
→ tap story/user avatar
→ open user profile
→ return
→ tap post card
→ comment
→ reply to comment
→ like/save
```

Pass criteria:
- nested press behavior works correctly
- comment count updates correctly
- user profile route works
- no accidental navigation from inner buttons

---

### Flow E — Use Review feed

```text
Open Review
→ tap review card
→ open Dish or Stall detail
→ return
→ comment/reply/save
```

Pass criteria:
- review card opens the expected detail page
- spacing and layout are consistent
- interactions do not conflict

---

### Flow F — Use Map discovery

```text
Open Discover
→ open Map
→ tap marker
→ view bottom sheet/card
→ open venue or stall details
→ return
```

Pass criteria:
- map loads
- markers are tappable
- bottom sheet is readable
- unavailable floor plans show a useful fallback state

---

## 7. Technical Readiness Checklist

### Build and tests

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes or documented blocker has an accepted workaround
- [ ] `npx expo-doctor` passes
- [ ] iOS build succeeds
- [ ] Android build succeeds, if Android beta is included
- [ ] no known red-screen crash in primary flows

### Repository discipline

- [ ] no production screens import mock repositories directly
- [ ] no `useNavigation<any>()` in active product code
- [ ] no dead Pressables in primary flows
- [ ] no placeholder route visible to beta users
- [ ] no hardcoded secrets committed
- [ ] no stale public URLs that produce errors

### Environment management

- [ ] `.env.development` configured
- [ ] `.env.staging` configured
- [ ] `.env.production` configured
- [ ] staging points to staging Supabase/project values
- [ ] production points to production Supabase/project values
- [ ] feature flags differ correctly across environments

### Backend and data

- [ ] Supabase migrations applied
- [ ] seed data loaded
- [ ] RLS verified
- [ ] media upload verified
- [ ] auth flow verified
- [ ] review/comment write paths verified
- [ ] map/stall/dish read paths verified

### Observability

- [ ] Sentry installed
- [ ] Sentry environment tagging works
- [ ] a test crash is captured in staging
- [ ] PostHog or analytics sink installed
- [ ] key events are captured
- [ ] user identity reset works on logout

---

## 8. Analytics Events Required for Beta

Track only what helps you answer product questions.

### Activation

```text
app_launched
sign_up_started
sign_up_completed
login_completed
onboarding_started
taste_quiz_completed
onboarding_completed
location_permission_granted
location_permission_denied
```

### Discovery

```text
home_feed_viewed
discover_viewed
search_submitted
filter_applied
dish_viewed
stall_viewed
map_opened
map_marker_tapped
building_directory_opened
```

### Engagement

```text
post_liked
post_saved
comment_submitted
reply_submitted
user_profile_viewed
dish_favourited
share_tapped
```

### Reviews

```text
review_started
review_rating_selected
review_tags_selected
review_submitted
review_submit_failed
```

### Supply priming

```text
claim_this_stall_tapped
merchant_claim_interest_submitted
menu_photo_uploaded
menu_photo_ocr_succeeded
menu_photo_ocr_failed
```

---

## 9. Beta Success Metrics

### Reliability

- Crash-free sessions: target 95%+ for private beta, 98%+ before public beta
- Core flow completion: 80%+ of testers complete onboarding
- No P0 navigation dead ends

### Activation

- 70%+ of new testers complete taste onboarding
- 50%+ view at least one dish/stall detail
- 30%+ save/favourite at least one item

### Engagement

- 25%+ submit a review or rating
- 20%+ comment/reply/like/save on Home or Review
- 30%+ return within 7 days for private beta

### Discovery quality

- Users can find relevant food within 60 seconds
- Search result satisfaction is positive in feedback
- Map markers/cards are understandable without explanation

### Supply growth

- At least 20 merchant claim interest submissions before merchant portal work
- At least 50 useful menu/stall data improvement signals before scaling merchant features

---

## 10. Feedback Collection Plan

### In-app feedback

Add a lightweight feedback entry point in Settings or Profile:

```text
Send feedback
Report a bug
Suggest a stall
Suggest missing information
```

### External feedback

For private beta, use:

- Google Form
- Typeform
- Notion form
- direct WhatsApp/Telegram group

### Feedback categories

Tag feedback into:

```text
Bug
Crash
Confusing UX
Missing food/stall
Wrong opening hours
Wrong map/location
Bad recommendation
Slow performance
Feature request
Design polish
```

---

## 11. Legal and Trust Requirements

Before public beta:

- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] Support/contact page
- [ ] Data deletion request process
- [ ] User-generated content policy
- [ ] Basic moderation policy
- [ ] Music/copyright policy if music features are visible
- [ ] Location usage explanation
- [ ] AI feature disclosure where applicable

For private beta, these can be simple but should exist.

---

## 12. App Store / TestFlight Readiness

### Required assets

- App icon
- App name and subtitle
- App description
- Keywords
- Support URL
- Privacy Policy URL
- Screenshots
- Test account, if needed for Apple review
- Demo instructions for reviewer

### Suggested screenshot set

1. Home social feed
2. Discover recommendations
3. Dish detail
4. Review/rating flow
5. Map discovery
6. Profile/taste identity

---

## 13. Manual Smoke Test Script

Run this before every beta build.

```text
1. Fresh install app
2. Launch app
3. Sign up or login
4. Complete onboarding
5. Open Home
6. Like/save/comment on a post
7. Open another user's profile
8. Open Discover
9. Search for a dish
10. Open Dish Detail
11. Favourite dish
12. Open Stall Detail
13. Open Map from Discover
14. Tap marker and open card/detail
15. Open Review feed
16. Tap review card
17. Open Rate tab
18. Submit a review
19. Open Profile
20. Change appearance setting
21. Logout
22. Login again
23. Confirm state is correct
```

Pass criteria:
- no crash
- no broken route
- no unresponsive button in primary flows
- no obvious theme mismatch
- no stuck loading state

---

## 14. Recommended Pre-Beta Implementation Order

### Step 1 — Close current active sprint

- Complete remaining staging smoke tests.
- Confirm merchant claim CTA telemetry.
- Verify feature flags.
- Finish CLM-04 merchant claim copy.
- Resolve or document the test runner issue.

### Step 2 — Freeze beta scope

- Decide which features are beta-visible.
- Hide or flag unfinished features.
- Remove dead buttons from beta flows.

### Step 3 — Stabilize core flows

- Auth/onboarding
- Home
- Review
- Rate
- Discover
- Map
- Dish/Stall Detail
- Profile

### Step 4 — Add observability

- Verify Sentry.
- Verify analytics.
- Add beta dashboard for key events.

### Step 5 — Prepare legal/support

- Privacy policy
- Terms
- Support link
- Feedback form

### Step 6 — Run internal alpha

- 5–10 internal testers.
- Fix P0/P1 issues only.

### Step 7 — Launch private beta

- 10–30 trusted testers.
- Collect structured feedback.
- Track retention and core flow completion.

---

## 15. What Not to Do Before Beta

Avoid these until the beta loop is stable:

- Do not build full QR ordering yet.
- Do not build full merchant portal yet.
- Do not implement Instagram cross-posting yet.
- Do not build full music licensing/music marketplace yet.
- Do not build advanced AI photo editor yet.
- Do not attempt full indoor maps for many malls yet.
- Do not add more tabs unless the existing tabs are fully clarified.

---

## 16. Final Beta Readiness Definition

Hungry is beta-ready when:

```text
A new user can install the app, complete onboarding, discover food, open a dish/stall, interact socially, submit a review, and return later without crashes or major confusion.
```

Everything else is V2 growth.
