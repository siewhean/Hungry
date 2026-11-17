# Claude Prompt — Full App Integration Architecture Plan

> **Branch:** `frontend-design-overhaul`
> **Purpose:** Ask Claude to audit and plan how every feature in Hungry should be integrated together, with shared identity, database persistence, cross-user visibility, local settings boundaries, and no standalone/unconnected screens.
> **Use this prompt with Claude.**

---

## Prompt for Claude

You are the principal product architect, mobile architect, Supabase architect, data model reviewer, privacy reviewer, and release architect for the Hungry app.

I want you to audit and plan the **entire app integration architecture** for the `frontend-design-overhaul` branch.

The goal is not just to check if screens exist. The goal is to ensure the whole app behaves like one interconnected product:

- one user identity across the app
- one profile photo/avatar across every surface
- posts stored in the database and visible to other users
- follows/following relationships stored in the database
- users can see posts from people they follow
- followers can see a user’s public posts
- comments, likes, saves, shares, activity, and notifications are consistently persisted
- settings that should be local stay local
- settings that should sync across devices are stored in the database
- merchant, review, profile, social, discovery, and gamification features all connect to the same source of truth
- no page or feature should be a standalone mock island unless explicitly marked as prototype/staging-only

Treat all existing docs and task statuses as claims, not truth. Verify against actual code.

---

## Context From Current Inspection

Use these as starting observations to verify, not as final conclusions:

1. `useProfileStore` persists profile data locally through `hungryPersistStorage`. `updateProfile()` appears local-first, while only some profile actions call the backend. Check whether profile photo/display name updates sync everywhere.
2. `usePublishedPostStore` stores published posts locally in persisted Zustand. This is useful for optimistic UI but should not be the cross-user source of truth.
3. `publishComposerPost()` calls `service.social.postBite()`, then upserts the returned post into local state. The canonical post should live in Supabase and be visible to other users.
4. `supabaseService.social.postBite()` appears to insert into `posts`, insert media rows, publish the post, refresh repository cache, and return a `Bite`. This should become the canonical posting path.
5. `useSocialStore` persists follows, likes, saves, comments, and replies locally. Likes/saves sync to backend only for UUID post IDs. Follows appear keyed by display/author name, which is not a stable identity model.
6. `useActivityStore` persists activity updates and shared-post chat snippets locally. Some chat sharing uses the service, but activity updates themselves are not clearly backend-driven.
7. Stories appear to use a local/cache pattern in parts of the service. If stories should be cross-user, they need a database-backed architecture.
8. `mediaUpload.ts` supports signed uploads and validation for post media. This should be reused consistently for profile photos, post media, review photos, story media, and merchant images.
9. `useUIStore` persists `themePreference` locally, which is good for device-local UI settings. Claude should define exactly which settings remain local and which sync to the database.

Verify all of this yourself.

---

## Main Architecture Questions

Answer these directly:

1. Which features are fully database-backed today?
2. Which features are partly database-backed but still rely on local Zustand state?
3. Which features are local-only today?
4. Which features are mock/prototype-only and should be feature-gated?
5. Which features should sync across devices?
6. Which features should remain device-local?
7. Which features should be visible to other users?
8. Which features should be private to the current user?
9. Which data should be denormalized for performance?
10. Which denormalized data needs triggers or refresh logic to avoid stale names/avatar photos?
11. Which screens currently read from mock/local data when they should read from Supabase?
12. Which flows need realtime subscriptions?
13. Which flows need offline queueing and retry?
14. Which data should be indexed for discovery/search/recommendations?
15. Which features should be cut or gated until their backend integration exists?

---

# Audit Areas Claude Must Cover

## 1. User Identity and Profile Architecture

Audit all places that display user identity:

- Profile home
- User profile screen
- Review cards
- Post cards
- Comments
- Replies
- Activity inbox
- Chat messages
- Stories
- Merchant customer inbox
- Passport / gamification
- Followers / Following
- Social grids
- Search result cards if authors appear
- Notification/activity rows

Determine whether each uses:

- `user_profiles`
- `public_profiles`
- local Zustand profile
- denormalized author fields
- mock data
- hardcoded avatar/name

Required outcome:

- A single source of truth for current user profile.
- A public profile source for other users.
- Profile photo updates propagate everywhere.
- Display name updates propagate everywhere.
- Old posts should not show permanently stale avatars unless intentionally snapshot-based.

Decide whether posts/comments should:

- join live `public_profiles`, or
- store denormalized author snapshots plus use triggers to update them, or
- store snapshots intentionally and explain why.

---

## 2. Profile Photo and Media Architecture

Plan how profile photo upload should work.

Cover:

- storage bucket name
- path convention, e.g. `avatars/<userId>/<uuid>.jpg`
- MIME validation
- size limit
- image resizing/compression
- signed upload vs direct upload
- public URL vs signed read URL
- cache busting
- old avatar cleanup
- fallback avatar behavior
- updating `user_profiles.avatar_url`
- updating `public_profiles`
- propagation to posts/comments/chat/activity
- moderation/scanning for user-uploaded avatar images
- whether profile photo is allowed before signup or only after account creation

---

## 3. Posts and Feed Architecture

Audit the current post composer and posting flow.

Plan canonical architecture for:

- creating a post
- uploading media
- creating `posts` row
- creating `post_media` rows
- publishing vs draft
- scheduled posts
- post visibility
- deleting posts
- editing posts
- hiding/reporting posts
- feed loading
- author profile hydration
- current user seeing own post immediately
- other users seeing the post
- followers seeing the post in their following feed
- profile social grid showing the user’s posts
- saved/liked post surfaces
- merchant customer inbox if posts mention merchant venues

Required database-level concepts:

- `posts`
- `post_media`
- `post_likes`
- `post_saves`
- `post_comments`
- `post_comment_replies` or nested comments
- `user_follows`
- `activity_events` or `notifications`
- `content_reports`
- `hidden_posts` or moderation state

---

## 4. Follows and Social Graph Architecture

Audit current follow implementation.

If follows are local-only or keyed by author name, propose a proper model.

Plan:

- `user_follows` table
- follower ID
- following ID
- status: active / blocked / muted / pending if private profiles exist
- created_at
- unique constraints
- RLS policies
- follower count / following count maintenance
- follow/unfollow service methods
- profile UI integration
- feed filtering by following
- activity notification when followed
- blocking interaction with follows

Required behavior:

- If A follows B, A sees B’s public/follower-visible posts in following feed.
- B can see A in followers list unless privacy rules hide it.
- Unfollow updates feed and counts.
- Blocking removes or suppresses follow relationships.

---

## 5. Comments, Replies, Likes, Saves, Shares

Audit current social interaction state.

Plan which interactions must be server-backed:

- post likes
- post saves
- review likes
- comments
- replies
- story likes/saves
- share count
- report count

Define:

- tables
- service methods
- optimistic UI behavior
- rollback on failure
- RLS policies
- moderation rules
- activity notifications
- count maintenance

Decide how counts should be produced:

- live aggregate query
- counter cache columns
- materialized view
- RPC
- Edge Function

Avoid fake counts or local-only counts for public social surfaces.

---

## 6. Activity, Notifications, and Push Architecture

Audit Activity Inbox.

Plan database-backed activity:

- likes on user’s post
- comments on user’s post
- replies to user’s comment
- new follower
- merchant reply
- post shared to chat
- review milestone
- mission/badge earned
- merchant claim/verification status changes
- order status later if ordering launches

Define:

- `activity_events` table or notification table
- recipient user ID
- actor user ID
- target type
- target ID
- read state
- created_at
- deep link route
- RLS policies
- push notification mapping
- user notification preferences
- badge count behavior

Clarify what should remain local:

- transient toasts
- temporary read animation state
- local notification permission state

---

## 7. Stories Architecture

Audit current stories implementation.

If stories are local-only, plan whether they should remain prototype-only or become database-backed.

If production-ready stories are desired, plan:

- `stories`
- `story_media`
- `story_views`
- `story_likes`
- `story_saves`
- expiry logic
- media upload rules
- visibility rules
- following feed integration
- profile integration
- moderation/reporting

If stories are not near-term launch scope, recommend feature-gating them.

---

## 8. Reviews Architecture

Audit reviews across:

- Quick Review
- Review Feed
- Dish Detail
- Stall Detail
- Profile review history
- Merchant customer inbox
- Activity
- Gamification
- FoodCred / Passport

Plan a single review source of truth:

- `reviews` table
- review photos / media
- review tags
- dish_id
- venue_id
- author_id
- rating
- text
- status / moderation state
- created_at / updated_at

Required behavior:

- A review appears on dish detail.
- A review appears on stall detail.
- A review appears on user profile.
- A review appears in review feed if public.
- Merchant can see reviews for their venue.
- Review contributes to dish rating and count.
- Review contributes to missions / FoodCred / profile stats.

---

## 9. Settings Architecture

Classify every setting as local-only or synced.

Examples of local-only settings:

- theme preference
- haptics preference
- left-handed mode, if device preference
- reduced motion
- local cache settings
- onboarding tooltip dismissed states

Examples of synced settings:

- profile visibility
- notification preferences
- dietary preferences
- taste profile
- privacy/account settings
- blocked users
- merchant notification preferences
- personalization consent

Plan:

- local settings store
- database settings table
- sync lifecycle
- conflict handling
- sign-out behavior
- account deletion behavior

Ensure local settings survive sign-out only when appropriate.

---

## 10. Merchant Integration Architecture

Audit merchant mode to ensure it connects to the same data sources:

- merchant profile edits update venue/profile data used by consumer screens
- merchant menu edits update dishes used by search/details
- merchant dish images use the same media pipeline
- merchant opening hours update stall detail and search filters
- merchant availability/sold-out updates affect discovery/detail screens
- merchant replies appear on reviews/comments if supported
- merchant analytics are real or labelled as preview
- OCR drafts promote into real dishes only after review
- promotion data appears on consumer surfaces only when approved/published

Define what is production-ready vs staging-only.

---

## 11. Gamification / Passport Architecture

Audit whether gamification is connected to real app events.

Plan event sources:

- review submitted
- dish saved
- stall visited/tried
- post published
- collection completed
- new cuisine explored
- mission completed
- user follows someone
- user receives interaction on post

Define:

- `food_cred_events`
- `user_mission_progress`
- `user_badges`
- `passport_stamps`
- idempotency rules
- anti-gaming rules
- public/private visibility

Ensure achievements are not fake.

---

## 12. Offline, Optimistic Sync, and Retry Architecture

Plan how local-first state syncs with Supabase.

Cover:

- guest user data
- post drafts
- failed post publish
- failed media upload
- failed likes/saves/comments
- failed profile update
- failed follow/unfollow
- retry queue
- conflict handling
- sync status UI
- app restart recovery

Decide whether to implement a general `syncQueue` local store and/or database table.

---

## 13. Discovery, Search, and Indexing Architecture

Audit how Home, Discover, Search, Quick Bites, Collections, Map, and Detail screens share data.

Plan:

- canonical data source for dishes, venues, buildings, posts, reviews, collections
- search indexes for dish names, stall names, cuisine tags, dietary flags, taste vectors
- Postgres indexes / RPCs / materialized views
- whether social posts influence discovery ranking
- whether reviews influence ranking
- whether merchant updates update search immediately
- cache invalidation rules after merchant menu edits, post publishes, review submits, and profile/taste updates

Required behavior:

- If a merchant edits a dish, search/detail/discover should reflect it.
- If a user reviews a dish, ratings and review counts update.
- If a dish is unavailable, discovery/search should respect that.
- If user taste changes, recommendations update consistently.

---

## 14. Recommendation and Personalization Architecture

Audit taste profile, dietary preferences, habit learning, recommendations, Decide For Me, and Discover ranking.

Plan:

- where taste profile is stored
- how guest taste profile migrates into account
- explicit feedback persistence
- implicit behavior event persistence
- recommendation generation source
- local cache vs server-generated slate
- privacy toggle for behavior personalization
- clear-history behavior
- ranking explainability
- cross-device consistency

Avoid hidden behavioral tracking without explicit settings and privacy controls.

---

## 15. Collections and Saved Items Architecture

Audit collections, favourites, saved dishes, saved posts, saved stories, tried stalls, and visited stalls.

Plan:

- `user_saved_dishes`
- `user_saved_posts`
- `user_saved_stories`
- `user_collections`
- `collection_items`
- `stall_interactions`
- local optimistic cache
- sync across devices
- profile visibility rules
- collection sharing rules

Clarify whether collections are editorial, user-created, or algorithmic.

---

## 16. Media Pipeline Architecture Across the Whole App

Unify media handling for:

- profile photos
- post media
- review photos
- story media
- merchant dish photos
- merchant verification videos
- OCR menu photos
- marketing/static assets

Plan:

- bucket names
- path conventions
- signed upload APIs
- public vs private buckets
- metadata tables
- moderation/scanning
- resize/transcode policy
- cleanup/orphan policy
- file ownership RLS

---

## 17. Realtime and Cache Invalidation Architecture

Identify where realtime is needed:

- chat messages
- post likes/comments on open post detail
- activity inbox
- merchant order inbox later
- merchant menu edits maybe via refresh
- profile avatar/name updates maybe via refetch

Plan:

- Supabase Realtime channels
- subscription lifecycles
- cache invalidation events
- fallback polling
- app foreground refetch policy
- stale data indicators

---

## 18. Privacy, Consent, Account Deletion, and Data Retention

Audit privacy-critical flows:

- account deletion
- data export
- profile visibility
- blocked users
- personalization consent
- analytics consent
- review/post deletion
- media deletion
- merchant claim data retention
- OCR menu photo retention
- chat retention

Plan database and service support for:

- soft delete vs hard delete
- anonymization
- retention windows
- privacy settings RLS
- account deletion queue
- user-facing privacy controls

---

## 19. Analytics, Observability, and Event Taxonomy

Audit analytics and observability across app events.

Plan:

- canonical analytics event names
- user identity handling
- privacy-safe properties
- funnels for onboarding, search, post, review, merchant claim
- PostHog vs Supabase event tables
- Sentry breadcrumbs
- error logging without PII
- operational dashboards

Ensure analytics events align with product data events without duplicating sensitive data.

---

## 20. Testing and Integration Contracts

Plan tests that prove features are interconnected.

Required tests:

- profile update propagates to public profile
- profile photo upload updates all surfaces
- post publish creates DB post/media rows
- another user can see public post
- follower feed includes followed user posts
- unfollow removes posts from following feed
- comment persists and appears to other users
- like/save persists and counts update
- settings local vs synced behavior
- review appears in dish detail, stall detail, profile, merchant inbox
- merchant menu edit affects consumer screens
- story gated or DB-backed
- gamification events are idempotent
- offline failed post queues and retries

Include contract tests, Supabase smoke tests, and manual QA.

---

## 21. Migration, Seed, and Environment Architecture

Audit migrations and seed data consistency.

Plan:

- migration order
- rollback strategy
- seed data for multi-user social graph
- seed data for posts/comments/follows
- local/staging/prod parity
- RLS smoke tests
- production data backfill strategy
- feature-flag controlled rollout

---

## Required Deliverables

Create a detailed Markdown architecture plan at:

`tasks/Roadmap/claude-integrated-app-architecture-plan.md`

The document must include:

1. Executive summary
2. Current integration gaps
3. Current source-of-truth map
4. Desired source-of-truth map
5. Feature-by-feature integration matrix
6. Database schema recommendations
7. Supabase RLS recommendations
8. Storage bucket recommendations
9. Service interface changes
10. Store/state management changes
11. Screen integration changes
12. Data flow diagrams in text form
13. P0/P1/P2 implementation plan
14. Suggested migration list
15. Suggested service method list
16. Suggested tests
17. Suggested rollout plan
18. Final Codex implementation prompt

---

## Source-of-Truth Matrix Format

Include this table:

| Feature | Current source of truth | Desired source of truth | Local cache? | Visible to other users? | Integration gap | Priority |
|---|---|---|---:|---:|---|---:|

Must include:

- profile display name
- profile photo
- taste profile
- dietary preferences
- theme preference
- notification preferences
- posts
- post media
- post likes
- post saves
- comments
- replies
- shares
- follows
- followers
- stories
- reviews
- review photos
- activity feed
- chat messages
- merchant menu edits
- merchant opening hours
- merchant profile edits
- OCR draft dishes
- FoodCred
- missions
- passport stamps
- collections
- saved dishes
- saved posts
- saved stories
- blocked users
- account deletion
- analytics consent
- personalization consent
- offline queue

---

## Database Planning Requirements

Recommend tables or updates for:

- `user_profiles`
- `public_profiles`
- `user_settings`
- `privacy_settings`
- `notification_preferences`
- `user_follows`
- `posts`
- `post_media`
- `post_likes`
- `post_saves`
- `post_comments`
- `post_comment_replies`
- `content_reports`
- `activity_events`
- `stories`
- `story_media`
- `story_likes`
- `reviews`
- `review_media`
- `review_tags`
- `food_cred_events`
- `user_mission_progress`
- `passport_stamps`
- `user_collections`
- `collection_items`
- `user_saved_dishes`
- `stall_interactions`
- `blocked_users`
- `sync_queue` if needed
- `merchant_profile_audit_log`

For each table, include:

- purpose
- key columns
- owner column
- indexes
- RLS policies
- retention/moderation needs

---

## Service Layer Planning Requirements

Recommend changes to:

- `HungryService.profile`
- `HungryService.social`
- `HungryService.reviews`
- `HungryService.content`
- `HungryService.chat`
- `HungryService.merchant`
- `HungryService.gamification` if needed
- `HungryService.settings` if needed
- `HungryService.notifications` if needed
- `DataRepository`

Include methods for:

- upload/update profile photo
- follow/unfollow user
- list followers/following
- list following feed
- list public user posts
- create/update/delete post
- create/delete comment
- create/delete reply
- like/save/share post
- list activity events
- mark activity read
- sync local guest profile into account
- update synced settings
- update local-only settings
- upload review media
- upload story media
- upload merchant dish media
- queue/retry offline mutations

---

## Acceptance Criteria

The final architecture should make these flows possible:

### Profile photo consistency

1. User updates profile photo.
2. New photo uploads to storage.
3. `user_profiles.avatar_url` updates.
4. Public profile updates.
5. Own profile updates immediately.
6. Other users see new avatar on posts/comments/profile after refresh or realtime update.

### Post visibility

1. User A creates a post.
2. Media uploads to storage.
3. Post inserts into database.
4. User A sees it immediately.
5. User B sees it if public or if following rules allow.
6. User A’s followers see it in following feed.
7. Likes/comments/saves persist and are visible cross-device.

### Following feed

1. User A follows User B.
2. Relationship is stored in database.
3. User A sees B’s posts in following feed.
4. User B’s follower count updates.
5. Unfollow removes B’s posts from following feed.

### Local settings

1. User sets dark mode on device.
2. Setting persists locally.
3. Signing out does not reset local device theme unless intentionally designed.
4. Logging in on another device does not force this local setting unless explicitly synced.

### Synced settings

1. User updates privacy or notification settings.
2. Setting persists to database.
3. Setting applies across devices.
4. RLS prevents other users from reading private settings.

### Merchant-to-consumer integration

1. Merchant updates dish availability or price.
2. Search, Discover, Stall Detail, and Dish Detail reflect the change.
3. Old cached data is invalidated or marked stale.

### Review integration

1. User submits review.
2. Review appears on dish, stall, profile, review feed, and merchant inbox.
3. Rating/count aggregates update.
4. FoodCred/mission progress updates once only.

---

## Final Codex Prompt Requirement

At the end of your document, write a Codex prompt that asks Codex to implement only the P0 architecture fixes first.

The Codex prompt should include:

- exact files to edit
- migrations to create
- service methods to add
- stores to refactor
- tests to add
- verification commands
- explicit instruction not to add extra features

---

## Tone

Be direct. Do not be polite at the expense of clarity.

If something is currently local-only, call it local-only.
If something is mock-only, call it mock-only.
If something is not integrated into Supabase, say so.
If something could mislead users, flag it.
If something needs a new table, migration, RLS policy, service method, or test, specify it.
