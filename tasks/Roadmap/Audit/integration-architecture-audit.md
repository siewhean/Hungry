# Hungry — Integration Architecture Audit

> **Branch:** `frontend-design-overhaul`
> **Date:** 2026-05-27
> **Scope:** Full data-flow audit across stores, services, database, and screens
> **Auditor:** Independent principal engineer review

---

## Executive Summary

Hungry's frontend is architecturally rich — 108 screens, 107 components, 26 Zustand stores, a dual mock/Supabase service provider, and 40 database migrations. But the **integration layer between local state and the database is incomplete for most social and user-facing features**. The app currently operates as a well-designed mock-first prototype that partially syncs to Supabase for auth, chat, posts, reviews, and taste feedback, while leaving follows, comments, activity, gamification, settings, and profile identity in local-only Zustand stores.

The core structural issue: **the app has two parallel data models** — one in local Zustand stores (which the UI reads from) and one in Supabase (which exists but is not consistently read/written). Most screens read from local stores and mock repositories, not from the database.

### Severity Summary

| Integration Level | Feature Count | Examples |
|---|:---:|---|
| ✅ Fully database-backed | 5 | Auth, Chat (Realtime), Bites/Posts (write), OCR, Account Deletion |
| ⚠️ Partially synced | 7 | Profile, Likes (UUID only), Saves (UUID only), Reviews, Taste feedback, Stories, Menu Photos |
| ❌ Local-only / mock | 14+ | Follows, Comments, Replies, Activity, Gamification, Passport, Missions, Collections, Settings, Profile photo, Share counts, Blocked users, Notifications, Portfolio |

---

## 1. Answers to the 15 Main Architecture Questions

### Q1. Which features are fully database-backed today?

| Feature | Evidence |
|---|---|
| **Auth** (signup, signin, session, signout) | `supabaseService.auth.*` — calls `supabase.auth.*` methods directly |
| **Chat** (conversations, messages, realtime) | `supabaseService.chat.*` — inserts into `conversations` / `chat_messages` tables, uses Supabase Realtime channels |
| **Bites/Posts** (write path) | `supabaseService.social.postBite()` — inserts into `posts` + `post_media`, uploads media to storage |
| **OCR Menu Photo** | Edge function `ingest-menu-photo` — full pipeline with Vision + LLM extraction |
| **Account deletion** | Edge function `process-account-deletions` — claims, anonymizes, deletes auth |
| **Guest sessions** | Edge function `guest-sessions` — token-based with rate limiting |

### Q2. Which features are partly database-backed but still rely on local Zustand state?

| Feature | Write to DB? | Read from DB? | Local Store | Gap |
|---|:---:|:---:|---|---|
| **Profile** | `setProfileVisibility` calls backend (Supabase mode) | `getProfile()` calls repository | `useProfileStore` (local persist) | `updateProfile()` is **local-only** — displayName, email, avatarUrl changes never reach Supabase |
| **Likes** | UUID post IDs → `reactToBite("craving")` | ❌ | `useSocialStore.interactions` | Only UUID posts sync; non-UUID (mock) likes are local. No read-back from DB |
| **Saves** | UUID post IDs → `reactToBite("save")` | ❌ | `useSocialStore.interactions` | Same as likes |
| **Taste feedback** | `recordExplicitFeedback()` to Supabase | ❌ | `useProfileStore.tasteInteractionEvents` | Writes go to Supabase but taste vector computation stays local |
| **Stories** | `likeStory`, `saveStory`, `shareStory`, `addStory` via service | `getStories()` via service | `useStoryStore` (local persist) | Service calls exist but mock returns fixture data; Supabase impl unclear |
| **Reviews** | `submitReview()` exists in interface | `getReviewsForDish()` exists | `useProfileStore.reviewEntries` (local) | Review entries stored locally; DB integration uncertain |
| **Menu photo submit** | `submitMenuPhoto()` → storage upload + DB row | ❌ | N/A | Write path works; no UI for viewing past submissions |

### Q3. Which features are local-only today?

| Feature | Store | Persist? | Backend Calls | Impact |
|---|---|:---:|:---:|---|
| **Follows** | `useSocialStore.followedAuthors` | ✅ | ❌ | **Critical** — keyed by `authorName` (string), not user ID. Pure local toggle |
| **Comments** | `useSocialStore.commentsByPostId` | ✅ | ❌ | Local-only, not visible to other users |
| **Replies** | `useSocialStore.repliesByCommentId` | ✅ | ❌ | Local-only, not visible to other users |
| **Share counts** | `useSocialStore.interactions.shareCount` | ✅ | ❌ | Local increment only |
| **Activity updates** | `useActivityStore.activityUpdates` | ✅ (partial) | ❌ | Self-generated activity items from local like/comment actions |
| **Published post cache** | `usePublishedPostStore.posts` | ✅ | ❌ | Optimistic cache after `postBite()`, never re-read from DB |
| **Profile updateProfile()** | `useProfileStore.profile` | ✅ | ❌ | displayName/email/avatarUrl changes are **local-only** |
| **Dietary preferences** | `useProfileStore.profile.dietaryPreferences` | ✅ | ❌ | Local set, no backend sync |
| **Favourites** | `useProfileStore.profile.favouriteDishIds` | ✅ | ❌ | Local toggle with taste adjustment; no DB |
| **Review entries** | `useProfileStore.reviewEntries` | ✅ | ❌ | Local record of ratings/text |
| **Left-handed mode** | `useProfileStore.profile.leftHandedMode` | ✅ | ❌ | Device-local (correct) |
| **Theme preference** | `useUIStore.themePreference` | ✅ | ❌ | Device-local (correct) |
| **Discovery cache** | `useDiscoveryStore` | ✅ | ❌ | Local UI state |
| **Search history** | `useSearchStore` | ✅ | ❌ | Local search recents |
| **Stall interactions** | `useStallInteractionStore` | ✅ | ❌ | Saved/tried/reviewed stalls — local |
| **Gamification** | `useGamificationStore` | ✅ | ❌ | FoodCred, badges — local mock-derived |
| **FoodCred** | `useFoodCredStore` | ✅ | ❌ | Points/level — local |
| **Missions** | `useMissionStore` | ✅ | ❌ | Weekly missions — local progress |
| **Passport** | `usePassportStore` | ✅ | ❌ | Stamps/pages — local |
| **Collections** | `useCollectionStore` | ✅ | ❌ | Saved collections — local |
| **Cart** | `useCartStore` | ✅ | ❌ | Future feature placeholder |
| **Order** | `useOrderStore` | ✅ | ❌ | Future feature placeholder |
| **Wheel** | `useWheelStore` | ✅ | ❌ | Party game — local (acceptable) |
| **Checklist** | `useChecklistStore` | ✅ | ❌ | Meal planning — local |
| **Review draft** | `useReviewDraftStore` | ✅ | ❌ | In-progress review — local (correct for drafts) |
| **Merchant** | `useMerchantStore` | ✅ | ❌ | Merchant state — local mock |
| **Portfolio** | `usePortfolioStore` | ✅ | ❌ | User lists — local |

### Q4. Which features are mock/prototype-only and should be feature-gated?

| Feature | Current Gate | Recommendation |
|---|---|---|
| V2 prototype screens (11) | `prototypeRoutesEnabled` = false in prod | ✅ Correct |
| Indoor floorplans | **No gate** | ⚠️ Must add `floorplansEnabled` flag |
| Developer launcher | `__DEV__` | ✅ Correct |
| Portfolio / Foodie Lists | No gate | ⚠️ Should gate until DB-backed |
| Wheel party game | No gate | Acceptable as standalone fun feature |
| Merchant analytics data | `merchantCentreEnabled` | Should label as "preview data" |

### Q5. Which features should sync across devices?

| Feature | Sync Required | Reason |
|---|:---:|---|
| Profile (name, avatar, bio) | ✅ | Core identity |
| Taste vector / taste profile | ✅ | Personalization |
| Dietary preferences | ✅ | Recommendation filtering |
| Follows / following | ✅ | Social graph |
| Saved dishes / stalls | ✅ | User curated content |
| Review history | ✅ | Contributed content |
| Notification preferences | ✅ | User intent |
| Privacy settings | ✅ | User intent |
| Blocked users | ✅ | Safety enforcement |
| Gamification progress | ✅ | Achievement state |
| Collections | ✅ | User curated content |

### Q6. Which features should remain device-local?

| Feature | Reason |
|---|---|
| Theme preference (dark/light/system) | Device-specific display |
| Left-handed mode | Device ergonomics |
| Haptics preference | Device hardware |
| Reduced motion | Device accessibility |
| Onboarding dismissed states | One-time per device |
| Search recents | Device convenience |
| Review drafts | Pre-submission work in progress |
| Post composer drafts | Pre-submission work in progress |
| Tab warmup / preload state | Performance optimization |
| Seen story IDs | Read tracking (can be device-local) |

### Q7. Which features should be visible to other users?

| Feature | Public? | Follower-only? | Private? |
|---|:---:|:---:|:---:|
| Display name + avatar | ✅ | — | — |
| Posts | ✅ (public) or follower-only | ✅ | — |
| Reviews | ✅ | — | — |
| Follower/following counts | ✅ | — | — |
| Collections (shared) | ✅ or follower-only | ✅ | ✅ (private) |
| FoodCred level/badge | ✅ | — | — |
| Passport stamps (public) | ✅ | — | — |
| Stories | ✅ or follower-only | ✅ | — |
| Comments/replies | ✅ | — | — |

### Q8. Which features should be private to the current user?

| Feature | Reason |
|---|---|
| Taste vector details | Personalization internals |
| Dietary preferences | Health/religious data |
| Saved dishes/posts (unless shared) | Personal curation |
| Blocked users list | Safety |
| Notification preferences | Personal settings |
| Review drafts | Work in progress |
| Activity inbox | Personal notifications |
| Chat messages | Private communication |
| Location data | Privacy-sensitive |

### Q9. Which data should be denormalized for performance?

| Data | Denormalize Into | Strategy |
|---|---|---|
| Author display name | `posts.author_display_name` | Snapshot at write time + trigger on profile update |
| Author avatar URL | `posts.author_avatar_url` | Same as above |
| Like count | `posts.like_count` | Counter cache column with trigger |
| Comment count | `posts.comment_count` | Counter cache column with trigger |
| Save count | `posts.save_count` | Counter cache column with trigger |
| Follower count | `user_profiles.follower_count` | Counter cache column |
| Following count | `user_profiles.following_count` | Counter cache column |
| Review count (dish) | `dishes.review_count` | Counter cache column |
| Average rating (dish) | `dishes.average_rating` | Materialized or trigger-maintained |

### Q10. Which denormalized data needs triggers or refresh logic?

| Denormalized Field | Trigger Event | Staleness Risk |
|---|---|---|
| `posts.author_display_name` | `UPDATE user_profiles SET display_name` | **High** — current posts show old name forever |
| `posts.author_avatar_url` | `UPDATE user_profiles SET avatar_url` | **High** — old avatars persist |
| `posts.like_count` | `INSERT/DELETE post_likes` | Medium — optimistic UI covers short-term |
| `posts.comment_count` | `INSERT/DELETE post_comments` | Medium |
| `dishes.average_rating` | `INSERT/UPDATE/DELETE reviews` | Low — reviews are infrequent per dish |

### Q11. Which screens currently read from mock/local data when they should read from Supabase?

| Screen | Current Data Source | Should Be |
|---|---|---|
| HomeFeedScreen | Mock `listStallPosts()` + local `usePublishedPostStore` | DB feed query |
| ProfileHomeScreen | `useProfileStore.profile` (local) | DB profile + public profile view |
| UserProfileContent | Mock profile data | DB `public_profiles` view |
| ProfileConnectionsScreen | `useSocialStore.followedAuthors` (local, name-keyed) | DB `user_follows` |
| SocialGridScreen | Local post cache | DB user posts query |
| FavouritesScreen | `useProfileStore.profile.favouriteDishIds` (local) | DB `user_favourite_dishes` |
| ReviewHistoryScreen | `useProfileStore.reviewEntries` (local) | DB `reviews` |
| DiscoverHomeScreen | Mock `listPopularNearby()` | DB discovery query |
| ActivityInboxScreen | `useActivityStore.activityUpdates` (local) | DB `activity_events` |
| PassportScreen | `usePassportStore` (local) | DB `passport_stamps` |
| MissionsScreen | `useMissionStore` (local) | DB `user_mission_progress` |
| CollectionListScreen | `useCollectionStore` (local) | DB `user_collections` |
| SettingsScreen | Local profile state | DB `user_settings` |

### Q12. Which flows need realtime subscriptions?

| Flow | Channel | Priority |
|---|---|:---:|
| Chat messages | `chat_messages:conversation_id=eq.{id}` | ✅ Already implemented |
| Post likes/comments on open detail | `post_likes`, `post_comments` on active post | P1 |
| Activity inbox | `activity_events:recipient_id=eq.{userId}` | P1 |
| Follower count | Profile view refresh | P2 (polling OK) |
| Merchant order inbox | Future | P3 |

### Q13. Which flows need offline queueing and retry?

| Flow | Current Behavior | Required |
|---|---|---|
| Post like/save | Fire-and-forget async, console.warn on failure | Retry queue |
| Post publish | Direct insert, no retry | Retry queue + draft preservation |
| Comment/reply | Local-only (no backend) | Backend call + retry |
| Profile update | Local-only | Backend call + retry |
| Review submit | Interface exists | Retry queue |
| Follow/unfollow | Local-only | Backend call + retry |

### Q14. Which data should be indexed for discovery/search/recommendations?

| Data | Index Type | Purpose |
|---|---|---|
| `dishes.name` | GIN trigram | Full-text search |
| `dishes.cuisine_tags` | GIN array | Category filtering |
| `dishes.taste_vector` | pgvector (if using) | Similarity search |
| `venues.name` | GIN trigram | Stall search |
| `buildings.name` | GIN trigram | Location search |
| `posts.created_at` | B-tree | Feed ordering |
| `reviews.dish_id, venue_id` | B-tree | Review aggregation |
| `user_follows.follower_id, following_id` | B-tree composite | Feed filtering |

### Q15. Which features should be cut or gated until their backend integration exists?

| Feature | Recommendation | Reason |
|---|---|---|
| Indoor floorplans | **Gate behind flag** | User-requested hide |
| Portfolio / Foodie Lists | **Gate or label "preview"** | No DB backend |
| Gamification (Passport, Missions, FoodCred) | **Label "preview" or disable** | Mock-derived progress, no real event tracking |
| Collections (user-created) | **Gate until DB** | Local-only state |
| Following feed filter | **Disable** | Follows are local, name-keyed |
| Share counts | **Hide or label** | Local-only increment |
| Comment counts | **Use DB counts when available** | Local counts mislead |

---

## 2. Source-of-Truth Matrix

| Feature | Current Source of Truth | Desired Source of Truth | Local Cache? | Visible to Others? | Integration Gap | Priority |
|---|---|---|:---:|:---:|---|:---:|
| Profile display name | Zustand `useProfileStore` | `user_profiles` DB | Yes | Yes | `updateProfile()` is local-only | **P0** |
| Profile photo | Zustand `useProfileStore.profile.avatarUrl` | `user_profiles.avatar_url` + Storage | Yes | Yes | No upload pipeline; local-only | **P0** |
| Taste vector | Zustand `useProfileStore` | `user_taste_vectors` DB | Yes | No | Writes go to feedback endpoint; reads are local | P1 |
| Dietary preferences | Zustand `useProfileStore` | `user_profiles` or `user_settings` | Yes | No | Local-only, no sync | P1 |
| Theme preference | Zustand `useUIStore` | Local only (correct) | Yes | No | None | ✅ |
| Notification prefs | Not implemented | `notification_preferences` DB | No | No | Table doesn't exist yet | P2 |
| Posts | Local `usePublishedPostStore` + mock repo | `posts` DB | Yes | Yes | Write works; read is from mock/local | **P0** |
| Post media | Supabase Storage (write) | `post_media` DB | No | Yes | Write works via `postBite()` | ⚠️ P1 |
| Post likes | `useSocialStore.interactions[id].liked` | `post_likes` DB | Yes (optimistic) | Yes | UUID posts sync; mock IDs don't. No read-back | **P0** |
| Post saves | `useSocialStore.interactions[id].saved` | `post_saves` DB | Yes (optimistic) | No | Same as likes | P1 |
| Comments | `useSocialStore.commentsByPostId` | `post_comments` DB | Yes | Yes | **Entirely local** — other users cannot see | **P0** |
| Replies | `useSocialStore.repliesByCommentId` | `post_comment_replies` DB | Yes | Yes | **Entirely local** | **P0** |
| Shares | `useSocialStore.interactions[id].shareCount` | `posts.share_count` or logs | Yes | Yes | Local increment only | P2 |
| Follows | `useSocialStore.followedAuthors` (name-keyed) | `user_follows` DB (UUID-keyed) | Yes | Yes | **Critical** — keyed by display name, not user ID; entirely local | **P0** |
| Followers | Not implemented | `user_follows` DB (reverse lookup) | No | Yes | Not implemented | **P0** |
| Stories | `useStoryStore` + service calls | `stories` / `story_media` DB | Yes | Yes | Service calls exist; backend may be mock | P1 |
| Reviews | `useProfileStore.reviewEntries` (local) | `reviews` DB | Yes | Yes | Local record; `submitReview()` interface exists but integration unclear | **P0** |
| Review photos | Not clear | `review_media` or Storage | No | Yes | No upload pipeline visible | P1 |
| Activity feed | `useActivityStore.activityUpdates` (local, self-generated) | `activity_events` DB | Yes | No | **Entirely local** — no DB table | **P0** |
| Chat messages | Supabase Realtime + DB | `chat_messages` DB | Local buffer | No (1:1) | ✅ Implemented | ✅ |
| Merchant menu edits | Mock `useMerchantStore` | `dishes` DB via merchant service | Yes | Yes (consumer sees) | Mock-only; no live persistence | P1 |
| Merchant hours | Mock | `venues.operating_hours` | No | Yes | Mock-only | P1 |
| Merchant profile | Mock | `merchant_profiles` / `venues` | No | Yes | Mock-only | P1 |
| OCR draft dishes | DB (`dishes_draft`) | `dishes_draft` → `dishes` promotion | No | No (ops queue) | ✅ Implemented | ✅ |
| FoodCred | `useFoodCredStore` (local) | `food_cred_events` DB | Yes | Yes (badge) | **Entirely local/mock** | P2 |
| Missions | `useMissionStore` (local) | `user_mission_progress` DB | Yes | No | **Entirely local/mock** | P2 |
| Passport stamps | `usePassportStore` (local) | `passport_stamps` DB | Yes | Yes | **Entirely local/mock** | P2 |
| Collections | `useCollectionStore` (local) | `user_collections` DB | Yes | Depends | **Entirely local** | P2 |
| Saved dishes | `useProfileStore.profile.favouriteDishIds` | `user_favourite_dishes` DB | Yes | No | **Entirely local** | P1 |
| Saved posts | `useSocialStore.interactions[id].saved` | `post_saves` DB | Yes | No | UUID posts sync; others don't | P1 |
| Blocked users | Not implemented (UI exists) | `blocked_users` DB | No | No | **Not implemented** — critical for social launch | **P0** |
| Account deletion | ✅ DB + Edge Function | `account_deletion_requests` DB | No | No | ✅ Implemented | ✅ |
| Analytics consent | Not implemented | `user_settings` DB | No | No | Not implemented | P2 |
| Personalization consent | Not implemented | `user_settings` DB | No | No | Not implemented | P2 |
| Offline queue | Not implemented | Local `syncQueue` store | Yes | No | No retry mechanism | P1 |

---

## 3. Critical Integration Gaps (P0)

### Gap 1: Profile Identity Is Not Shared

**Problem:** `useProfileStore.updateProfile()` at [useProfileStore.ts:345-351](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/store/useProfileStore.ts#L345-L351) does a pure local `set()` — no backend call.

```typescript
// Current: local-only
updateProfile: (next) =>
  set((state) => ({
    profile: { ...state.profile, ...next },
  })),
```

**Impact:** Display name and avatar changes never propagate. Other users see the old values. Posts created after a name change still show the old name.

**Fix:**
1. `updateProfile()` must call `getHungryService().profile.updateProfile(next)` in Supabase mode
2. Supabase `updateProfile` must update `user_profiles` row
3. A `public_profiles` view or policy must expose display_name + avatar_url for cross-user reads
4. A trigger on `user_profiles` update should cascade author_display_name/avatar_url on existing `posts` rows (or use a join-based approach)

---

### Gap 2: Follows Are Keyed by Display Name

**Problem:** `useSocialStore.toggleAuthorFollow()` at [useSocialStore.ts:222-229](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/store/useSocialStore.ts#L222-L229) uses `authorName` (a string) as the follow key:

```typescript
toggleAuthorFollow: (authorName) => {
  set((prev) => ({
    followedAuthors: {
      ...prev.followedAuthors,
      [authorName]: !prev.followedAuthors[authorName],
    },
  }));
},
```

**Impact:**
- Display names are not unique identifiers — two users named "Sarah" would share a follow state
- Follows are entirely local — no one else can see your followers
- If a user changes their display name, their follow state breaks
- No follower feed is possible
- No follower/following counts are real

**Fix:**
1. Replace `followedAuthors: Record<string, boolean>` with `follows: Record<userId, boolean>`
2. Add `user_follows` table (follower_id, following_id, created_at) with RLS
3. Add service methods `followUser(userId)`, `unfollowUser(userId)`, `listFollowers()`, `listFollowing()`
4. Migrate from name-keyed to UUID-keyed in store

---

### Gap 3: Comments and Replies Are Invisible

**Problem:** `useSocialStore.addComment()` and `addReply()` at [useSocialStore.ts:253-323](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/store/useSocialStore.ts#L253-L323) write only to local Zustand state. No service call, no database insert.

**Impact:** Comments exist only on the device that wrote them. No other user can see any comment.

**Fix:**
1. Add `post_comments` and `post_comment_replies` tables
2. Add service methods `createComment()`, `createReply()`, `listCommentsForPost()`
3. `addComment()` must call the service, then update local state optimistically
4. `addReply()` same pattern

---

### Gap 4: Activity Is Self-Generated

**Problem:** `useActivityStore.addActivityUpdate()` at [useActivityStore.ts:44-54](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/store/useActivityStore.ts#L44-L54) generates synthetic activity items when the current user likes their own post:

```typescript
addActivityUpdate: (update) => {
  set((state) => ({
    activityUpdates: [
      ...state.activityUpdates,
      { id: `${update.kind}-${Date.now()}-...`, ...update, unread: true },
    ],
  }));
},
```

**Impact:** Activity inbox shows only self-generated events. No external likes, comments, follows, or mentions appear.

**Fix:**
1. Add `activity_events` table (recipient_id, actor_id, event_type, target_type, target_id, read, created_at)
2. Triggers on `post_likes`, `post_comments`, `user_follows` to generate activity events
3. Service method `listActivityEvents()` to read from DB
4. Supabase Realtime subscription on activity_events for live updates

---

### Gap 5: No Content Moderation Backend

**Problem:** `HungryService.communitySafety` interface exists at [types.ts:756-761](file:///Users/Siew%20Hean/Documents/GitHub/Hungry/src/lib/services/types.ts#L756-L761) with `reportContent()`, `blockUser()`, `hidePost()`, `unhidePost()`. But:
- `content_reports` table: needs verification whether it exists in migrations
- `blocked_users` table: needs verification
- Block enforcement: not wired — a blocked user can still appear in feeds, comments, and chat

**Fix:**
1. Add `content_reports` table if missing
2. Add `blocked_users` table if missing
3. Wire `blockUser()` to insert into DB
4. Add RLS policies that filter blocked users from feed/comment/chat queries
5. Add report queue for ops/admin review

---

## 4. Database Schema: Existing vs Required

### Tables That Exist (from migrations 0001–0040)

| Table | Migration | Purpose |
|---|:---:|---|
| `user_profiles` | 0001+ | Core user identity |
| `buildings` | 0001 | Hawker centres, food courts |
| `building_floors` | 0001 | Floor directory |
| `venues` | 0001 | Individual stalls/restaurants |
| `dishes` | 0001 | Menu items |
| `dish_images` | 0001 | Dish photos |
| `dish_taste_vectors` | 0001 | Taste profile per dish |
| `reviews` | 0001 | User reviews |
| `review_photos` | 0001 | Review media |
| `user_taste_vectors` | 0001 | User taste preferences |
| `user_favourite_dishes` | 0001 | Saved dishes |
| `posts` (via `stall_posts` / `bites`) | 0001+, 0032 | Social posts |
| `bite_reactions` | 0001+ | Post reactions |
| `blog_posts` | 0001 | Editorial content |
| `guest_sessions` | 0007+ | Anonymous sessions |
| `conversations` | 0013+ | Chat conversations |
| `chat_messages` | 0013+ | Chat messages |
| `menu_photo_submissions` | 0015+ | OCR pipeline |
| `dishes_draft` | 0015+ | OCR extracted dishes |
| `merchant_accounts` | 0035+ | Merchant identity |
| `merchant_organizations` | 0035+ | Merchant orgs |
| `merchant_outlets` | 0035+ | Merchant venues |
| `account_deletion_requests` | 0040 | GDPR compliance |
| `app_ops_admins` | 0038 | Admin controls |
| `app_ops_audit_events` | 0038 | Audit logging |
| `app_ops_rate_limits` | 0038 | Rate limiting |
| `app_user_rate_limits` | 0038 | User rate limiting |
| `content_reports` | 0032+ | Report queue |
| `post_engagements` | 0032+ | Social engagement tracking |

### Tables That Need to Be Created

| Table | Purpose | P-level |
|---|---|:---:|
| `public_profiles` (view) | Cross-user profile reads (display_name, avatar_url, bio) | **P0** |
| `user_follows` | Social graph (follower_id, following_id, status, created_at) | **P0** |
| `post_comments` | Comments on posts (post_id, author_id, text, created_at) | **P0** |
| `post_comment_replies` | Nested replies (comment_id, author_id, text, created_at) | **P0** |
| `activity_events` | Notifications (recipient_id, actor_id, event_type, target_type, target_id, read, created_at) | **P0** |
| `blocked_users` | Block enforcement (blocker_id, blocked_id, created_at) | **P0** |
| `user_settings` | Synced preferences (user_id, key, value) | P1 |
| `notification_preferences` | Push/email prefs (user_id, channel, enabled) | P2 |
| `stories` | Story content (if not already existing) | P1 |
| `story_media` | Story media links | P1 |
| `food_cred_events` | Gamification events (user_id, action, points, entity_id) | P2 |
| `user_mission_progress` | Mission tracking (user_id, mission_id, progress, completed_at) | P2 |
| `passport_stamps` | Badge/stamp tracking (user_id, stamp_id, earned_at) | P2 |
| `user_collections` | User-created lists | P2 |
| `collection_items` | Items in collections | P2 |

---

## 5. Service Layer Gap Analysis

### HungryService Interface vs Implementation

| Service Group | Interface Methods | Mock Impl | Supabase Impl | Gap |
|---|:---:|:---:|:---:|---|
| `auth` | 11 | ✅ | ✅ | None |
| `discovery` | 12 | ✅ | ✅ (most) | `recordMerchantActionEvent` may be partial |
| `reviews` | 3 | ✅ | ⚠️ Partial | `submitReview` integration unclear |
| `profile` | 7 | ✅ | ⚠️ Partial | `updateProfile` exists but store doesn't call it for name/avatar |
| `social` | 11 | ✅ | ⚠️ Partial | `postBite` works; no `followUser/unfollowUser` methods |
| `chat` | 6 | ✅ | ✅ | Realtime working |
| `communitySafety` | 4 | ✅ | ⚠️ | Need to verify DB writes |
| `contributions` | 2 | ✅ | ⚠️ | Stall submission exists |
| `content` | 4 | ✅ | ⚠️ | Read-heavy, may be mock |
| `recommendations` | 2 | ✅ | ✅ | Feedback writes to DB |
| `ai` | 10 | ✅ | ✅ (local compute) | No server-side AI calls |
| `merchant` | 28 | ✅ | ⚠️ | Mostly mock |
| `supply` | 4 | ✅ | ✅ | OCR pipeline works |
| `checklist` | 7 | ✅ | ⚠️ | Interface exists, unclear impl |
| `portfolio` | 17 | ✅ | ⚠️ | Interface exists, unclear impl |
| `passport` | 3 | ✅ | ⚠️ | Interface exists, unclear impl |

### Missing Service Methods (need to be added)

| Method | Service Group | P-level |
|---|---|:---:|
| `followUser(userId)` | `social` | **P0** |
| `unfollowUser(userId)` | `social` | **P0** |
| `listFollowers(userId)` | `social` | **P0** |
| `listFollowing(userId)` | `social` | **P0** |
| `createComment(postId, text)` | `social` | **P0** |
| `deleteComment(commentId)` | `social` | **P0** |
| `createReply(commentId, text)` | `social` | **P0** |
| `listCommentsForPost(postId)` | `social` | **P0** |
| `listActivityEvents()` | `notifications` (new) | **P0** |
| `markActivityRead(eventId)` | `notifications` (new) | **P0** |
| `uploadProfilePhoto(uri)` | `profile` | **P0** |
| `updateProfileFields(fields)` | `profile` (fix store call) | **P0** |
| `getPublicProfile(userId)` | `profile` | **P0** |
| `updateSyncedSettings(key, value)` | `settings` (new) | P1 |
| `getBlockedUsers()` | `communitySafety` | **P0** |

---

## 6. P0/P1/P2 Implementation Plan

### P0 — Must Fix for Social Launch

| # | Task | Files | Effort |
|---|---|---|:---:|
| P0-1 | Wire `updateProfile()` to call backend in Supabase mode | `useProfileStore.ts`, `supabaseService.ts` | Small |
| P0-2 | Add `public_profiles` view or widen `user_profiles` SELECT RLS | New migration | Small |
| P0-3 | Create `user_follows` table + RLS + indexes | New migration | Medium |
| P0-4 | Refactor `toggleAuthorFollow` to use userId instead of authorName | `useSocialStore.ts`, screens | Medium |
| P0-5 | Add follow/unfollow service methods | `types.ts`, `supabaseService.ts`, `mockService.ts` | Medium |
| P0-6 | Create `post_comments` + `post_comment_replies` tables | New migration | Medium |
| P0-7 | Wire `addComment()` / `addReply()` to backend | `useSocialStore.ts`, service layer | Medium |
| P0-8 | Create `activity_events` table + triggers | New migration | Large |
| P0-9 | Wire activity inbox to read from DB | `useActivityStore.ts`, `ActivityInboxScreen.tsx` | Medium |
| P0-10 | Add profile photo upload pipeline | `mediaUpload.ts`, `supabaseService.ts`, `useProfileStore.ts` | Medium |
| P0-11 | Add `blocked_users` table + enforcement in queries | New migration + RLS | Medium |
| P0-12 | Add `floorplansEnabled` feature flag | `featureFlags.ts`, `RootNavigator.tsx` | Small |

### P1 — Should Fix for Beta

| # | Task | Effort |
|---|---|:---:|
| P1-1 | Sync taste vector writes back to `user_taste_vectors` | Small |
| P1-2 | Sync dietary preferences to `user_profiles` | Small |
| P1-3 | Sync favourites to `user_favourite_dishes` (two-way) | Medium |
| P1-4 | Wire review submit to create `reviews` row + `review_photos` | Medium |
| P1-5 | Add offline retry queue (`syncQueue` store) | Large |
| P1-6 | Read feed posts from DB instead of mock repository | Medium |
| P1-7 | Add post_likes / post_saves tables (if not existing) | Medium |
| P1-8 | Wire story actions to real DB tables | Medium |
| P1-9 | Add `user_settings` table for synced preferences | Small |
| P1-10 | Connect merchant menu edits to `dishes` table | Large |

### P2 — Post-Beta

| # | Task | Effort |
|---|---|:---:|
| P2-1 | Connect gamification to real app events | Large |
| P2-2 | Add `food_cred_events` / `user_mission_progress` / `passport_stamps` tables | Large |
| P2-3 | Add `user_collections` / `collection_items` tables | Medium |
| P2-4 | Add notification preferences + push notification infra | Large |
| P2-5 | Add portfolio DB backend | Large |
| P2-6 | Add realtime subscriptions for activity and post engagement | Medium |

---

## 7. Data Flow Diagrams

### Current Post Lifecycle (partial sync)

```
User taps "Post"
  → PostComposerScreen
  → publishComposerPost()
    → getHungryService().social.postBite(draft)
      → [Supabase mode] INSERT INTO posts + post_media + upload to storage
      → Returns Bite
    → usePublishedPostStore.upsertPost(returnedBite)  [LOCAL CACHE]
    → HomeFeedScreen reads from:
      - mock listStallPosts() [MOCK DATA]
      - usePublishedPostStore.posts [LOCAL CACHE]
      → ❌ Does NOT read from DB `posts` table
  → Other users:
    → ❌ Cannot see the post (no DB feed query)
```

### Desired Post Lifecycle (full sync)

```
User taps "Post"
  → PostComposerScreen
  → publishComposerPost()
    → getHungryService().social.postBite(draft)
      → INSERT INTO posts + post_media + upload to storage
      → Returns Bite
    → usePublishedPostStore.upsertPost(returnedBite)  [OPTIMISTIC CACHE]
    → HomeFeedScreen reads from:
      - getHungryService().social.getBitesFeed() → DB query with join
      - usePublishedPostStore.posts for instant optimistic display
  → Other users:
    → DB feed query returns the post ✅
    → Author name + avatar from posts.author_* or join on public_profiles
```

### Current Follow Lifecycle (local-only)

```
User taps "Follow" on UserProfileContent
  → useSocialStore.toggleAuthorFollow("Sarah Tan")
    → Sets followedAuthors["Sarah Tan"] = true  [LOCAL]
  → ❌ No DB write
  → ❌ No follower count update
  → ❌ No activity notification to "Sarah Tan"
  → ❌ No feed filtering by following
```

### Desired Follow Lifecycle

```
User taps "Follow" on UserProfileContent(userId: "abc-123")
  → useSocialStore.followUser("abc-123")
    → Optimistic: set follows["abc-123"] = true [LOCAL]
    → getHungryService().social.followUser("abc-123")
      → INSERT INTO user_follows (follower_id, following_id)
      → Trigger: UPDATE user_profiles SET follower_count = follower_count + 1
      → Trigger: INSERT INTO activity_events (recipient_id: "abc-123", type: "new_follower")
    → On failure: rollback optimistic state
  → Feed: HomeFeedScreen queries posts WHERE author_id IN (SELECT following_id FROM user_follows)
  → Profile: follower/following counts from DB
```

---

## 8. Migration Plan (suggested order)

| Order | Migration | Tables/Changes | Dependencies |
|:---:|---|---|---|
| 1 | `0041_public_profiles_view.sql` | Create `public_profiles` view on `user_profiles` | None |
| 2 | `0042_user_follows.sql` | Create `user_follows` + RLS + indexes + counter triggers | public_profiles |
| 3 | `0043_post_comments.sql` | Create `post_comments` + `post_comment_replies` + RLS | None |
| 4 | `0044_activity_events.sql` | Create `activity_events` + RLS + triggers on likes/comments/follows | 0042, 0043 |
| 5 | `0045_blocked_users.sql` | Create `blocked_users` + RLS + feed/comment/chat filter functions | None |
| 6 | `0046_profile_photo_storage.sql` | Storage bucket policies for avatars | None |
| 7 | `0047_user_settings.sql` | Create `user_settings` for synced preferences | None |
| 8 | `0048_gamification_tables.sql` | Create `food_cred_events`, `user_mission_progress`, `passport_stamps` | None |
| 9 | `0049_user_collections.sql` | Create `user_collections`, `collection_items` | None |

---

## 9. Suggested Tests

### Integration Contract Tests

| Test | Validates |
|---|---|
| Profile update propagates to `user_profiles` in Supabase mode | P0-1 |
| Public profile view returns display_name + avatar for any user | P0-2 |
| Follow/unfollow creates/removes `user_follows` row | P0-3, P0-5 |
| Follow keyed by userId, not authorName | P0-4 |
| Comment creates `post_comments` row visible to other users | P0-6, P0-7 |
| Activity event created on like, comment, follow | P0-8 |
| Activity inbox reads from DB, not local state | P0-9 |
| Profile photo upload stores in `avatars/` bucket | P0-10 |
| Blocked user excluded from feed and chat queries | P0-11 |
| `floorplansEnabled=false` hides BuildingDrillDown route | P0-12 |
| Offline failed post retries on reconnect | P1-5 |
| Review submit creates `reviews` + `review_photos` rows | P1-4 |

---

## 10. Rollout Plan

| Phase | Scope | Gate |
|---|---|---|
| **Phase 1: Identity** | P0-1, P0-2, P0-10 (profile sync + photo + public profiles) | Typecheck + contract tests |
| **Phase 2: Social Graph** | P0-3, P0-4, P0-5 (follows refactor) | Typecheck + follow contract tests |
| **Phase 3: Engagement** | P0-6, P0-7, P0-8, P0-9 (comments + activity) | Typecheck + engagement contract tests |
| **Phase 4: Safety** | P0-11, P0-12 (blocked users + floorplan gate) | Typecheck + safety contract tests |
| **Phase 5: Feed** | P1-6 (read feed from DB) | Smoke test on staging |
| **Phase 6: Preferences** | P1-1, P1-2, P1-3, P1-9 (taste, dietary, favourites, settings sync) | Contract tests |
| **Phase 7: Content** | P1-4, P1-7, P1-8 (reviews, likes/saves, stories) | Contract tests |
| **Phase 8: Resilience** | P1-5, P1-10 (offline queue, merchant) | Integration test |
| **Phase 9: Gamification** | P2-1 through P2-6 | Contract tests |

---

## 11. Codex Implementation Prompt (P0 Only)

```text
You are implementing P0 integration architecture fixes for Hungry.

Reference: tasks/Roadmap/Audit/integration-architecture-audit.md

## Phase 1: Profile Identity (P0-1, P0-2, P0-10)

### P0-1: Wire updateProfile() to backend
File: src/store/useProfileStore.ts
Change: In `updateProfile()`, after the local `set()`, add a Supabase mode check
and call `getHungryService().profile.updateProfile(next)` (fire-and-forget with
error logging, like `setProfileVisibility` does).

### P0-2: Add public_profiles view
File: supabase/migrations/0041_public_profiles_view.sql
Create: A view `public_profiles` that exposes `id, display_name, avatar_url, bio,
food_cred_level, follower_count, following_count` from `user_profiles`.
RLS: public SELECT for authenticated users.

### P0-10: Profile photo upload
File: src/lib/services/supabase/supabaseService.ts
Add method: profile.uploadProfilePhoto(uri: string) that:
1. Validates MIME type (jpeg, png, webp) and size (<5MB)
2. Uploads to `avatars/{userId}/{uuid}.{ext}` bucket
3. Gets public URL
4. Updates `user_profiles.avatar_url`
5. Returns the new URL

## Phase 2: Social Graph (P0-3, P0-4, P0-5)

### P0-3: Create user_follows table
File: supabase/migrations/0042_user_follows.sql
Table: user_follows (id uuid PK, follower_id uuid FK, following_id uuid FK,
created_at timestamptz, UNIQUE(follower_id, following_id))
RLS: authenticated can INSERT/DELETE own rows; public SELECT.
Triggers: Increment/decrement follower_count and following_count on user_profiles.

### P0-4: Refactor toggleAuthorFollow
File: src/store/useSocialStore.ts
Change: Replace `followedAuthors: Record<string, boolean>` with
`follows: Record<string, boolean>` (keyed by userId).
Replace `toggleAuthorFollow(authorName)` with `toggleFollow(userId)`.
Update all screen consumers.

### P0-5: Add follow service methods
File: src/lib/services/types.ts — add to social:
  followUser(userId: string): Promise<void>
  unfollowUser(userId: string): Promise<void>
  listFollowers(userId: string): Promise<{userId, displayName, avatarUrl}[]>
  listFollowing(userId: string): Promise<{userId, displayName, avatarUrl}[]>

Implement in supabaseService.ts with INSERT/DELETE on user_follows.
Implement in mockService.ts with local mock data.

## Verification
npm run typecheck
npm run test
npm run audit:supabase:static

## Rules
- Do not add new features
- Do not change screen layouts
- Do not modify navigation structure
- Preserve all existing tests
- One migration per file
- Record in tasks/verification.md
```
