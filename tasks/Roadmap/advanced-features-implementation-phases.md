# Hungry Advanced Features — Implementation Phases After MVP

> Branch context: `frontend-design-overhaul`  
> Purpose: Sequence advanced features **only after the MVP works end-to-end**.  
> Rule: No advanced feature should be production-enabled until it is database-backed, tested, moderated where needed, and integrated into the core app architecture.

---

## 1. Advanced Feature Philosophy

Advanced features should deepen Hungry after the core product is stable.

The MVP must first prove:

```text
Users can browse → search → view dish/stall details → sign up → save → review → post → see persisted data across users/devices.
```

Only after that should Hungry expand into:

- following feed
- comments and replies
- stories
- direct messages
- full merchant centre
- merchant/admin web console
- checklists and portfolios
- passport/missions
- advanced recommendations
- OCR operations
- floorplans
- AI creator tools
- QR ordering and payments

---

## 2. Global Advanced Feature Rules

Every advanced feature must meet these gates before production:

- [ ] Feature flag exists.
- [ ] Production default is off until launch-approved.
- [ ] Supabase schema exists if data is shared or synced.
- [ ] RLS is tested.
- [ ] Service methods are typed and implemented in mock and Supabase modes.
- [ ] Local store is cache/optimistic state only, not source of truth.
- [ ] Empty/loading/error states exist.
- [ ] Analytics events exist.
- [ ] Moderation/reporting exists for user-generated content.
- [ ] Device QA passes.
- [ ] Feature can be rolled back without corrupting data.

---

## 3. Recommended Advanced Feature Flag Defaults

```ts
// Production until feature is ready
storiesEnabled = false
directMessagesEnabled = false
commentsEnabled = false // unless backend moderation is ready
gamificationEnabled = false
collectionsEnabled = false
merchantCentreEnabled = false
floorplansEnabled = false
aiCreatorEnabled = false
orderingEnabled = false
advancedRecommendationsEnabled = false
```

Staging can enable each feature independently.

---

# Advanced Phase 1 — Social Graph and Following Feed

## Goal

Allow users to follow others and see posts from followed users.

## Prerequisites

- MVP public posts work cross-user.
- User public profiles exist.
- Post privacy/visibility exists.
- Feature flags are production-safe.

## Implementation Tasks

1. Add or verify `user_follows` table:
   - `id`
   - `follower_id`
   - `following_id`
   - `status`
   - `created_at`
   - `updated_at`
2. Add unique constraint on `(follower_id, following_id)`.
3. Add RLS:
   - users can create/delete their own follow rows
   - users can read public follow counts where allowed
   - private accounts require pending/approved logic if supported
4. Add service methods:
   - `followUser(userId)`
   - `unfollowUser(userId)`
   - `listFollowers(userId)`
   - `listFollowing(userId)`
   - `listFollowingFeed()`
5. Replace author-name-based follow state with user-id-based follows.
6. Add following feed tab or filter.
7. Update profile follower/following counts.
8. Add activity event for new follower.

## Files Likely Touched

- `supabase/migrations/**`
- `src/lib/services/types.ts`
- `src/lib/services/supabase/supabaseService.ts`
- `src/store/useSocialStore.ts`
- `src/app/screens/home/HomeFeedScreen.tsx`
- `src/app/screens/profile/UserProfileScreen.tsx`
- `src/app/screens/profile/ProfileConnectionsScreen.tsx`

## Tests

- User A follows User B.
- User A sees B’s posts in following feed.
- User A unfollows User B.
- B’s posts disappear from following feed.
- Follower/following counts update.
- Blocking suppresses follow relationship.

## Done Criteria

- Following is database-backed.
- Following feed works cross-user.
- Author-name follow state is not used as canonical state.

---

# Advanced Phase 2 — Comments, Replies, and Moderated Social Interactions

## Goal

Support public comments and replies safely.

## Prerequisites

- Posts are database-backed.
- Content reporting exists.
- Basic moderation rules exist.

## Implementation Tasks

1. Add/verify tables:
   - `post_comments`
   - `post_comment_replies` or parent-child comments
   - `comment_likes` if needed
   - `content_reports`
2. Add moderation columns:
   - `status`
   - `hidden_at`
   - `deleted_at`
   - `reported_count`
3. Add RLS:
   - users can create comments as themselves
   - users can edit/delete their own comments
   - public users can read visible comments
   - hidden/deleted comments are not public
4. Add service methods:
   - `listCommentsForPost(postId)`
   - `createComment(postId, body, parentCommentId?)`
   - `deleteComment(commentId)`
   - `reportContent()`
5. Ensure optimistic UI rolls back or queues on failure.
6. Add activity events for comments/replies.
7. Add block-user filtering.

## Files Likely Touched

- `supabase/migrations/**`
- `src/store/useSocialStore.ts`
- `src/components/social/ReviewCommentsSheet.tsx`
- `src/lib/services/supabase/supabaseService.ts`
- `src/lib/security/communitySafety.ts`

## Tests

- Comment persists and another user sees it.
- Reply persists and appears under parent comment.
- Deleting comment hides it publicly.
- Reporting comment creates report row.
- Blocked user’s comments are hidden.

## Done Criteria

- Comments are safe enough for beta.
- No public comment UI is local-only.

---

# Advanced Phase 3 — Activity Inbox, Notifications, and Realtime

## Goal

Make activity and notifications reliable across devices.

## Prerequisites

- Social graph exists.
- Posts/comments/likes are database-backed.
- Activity event schema exists.

## Implementation Tasks

1. Add/verify `activity_events` table:
   - `recipient_user_id`
   - `actor_user_id`
   - `event_type`
   - `target_type`
   - `target_id`
   - `read_at`
   - `created_at`
   - `metadata`
2. Add service methods:
   - `listActivityEvents()`
   - `markActivityRead(id)`
   - `markAllActivityRead()`
3. Generate events for:
   - likes
   - saves if desired
   - comments
   - replies
   - follows
   - merchant replies
   - mission/badge earned
4. Add realtime subscriptions or foreground refresh.
5. Add notification preferences.
6. Add push-notification plan but keep push off until tested.

## Files Likely Touched

- `src/store/useActivityStore.ts`
- `src/app/screens/home/ActivityInboxScreen.tsx`
- `src/lib/services/types.ts`
- `src/lib/services/supabase/supabaseService.ts`
- `supabase/migrations/**`

## Tests

- Like creates activity event for post owner.
- Comment creates activity event.
- Mark read persists across devices.
- Activity unread count is correct.

## Done Criteria

- Activity inbox is database-backed.
- Local activity updates are cache only.

---

# Advanced Phase 4 — Stories

## Goal

Launch stories only if they become database-backed and moderated.

## Prerequisites

- Media pipeline is stable.
- Content moderation/reporting exists.
- Follow graph exists if stories are follower-scoped.

## Implementation Tasks

1. Add tables:
   - `stories`
   - `story_media`
   - `story_views`
   - `story_likes`
   - `story_saves`
2. Add expiry logic:
   - default 24h
   - scheduled cleanup
   - expired stories hidden from feed
3. Add storage path convention for story media.
4. Add service methods:
   - `getStories()`
   - `addStory(content)`
   - `likeStory(storyId)`
   - `saveStory(storyId)`
   - `deleteStory(storyId)`
   - `reportStory(storyId)`
5. Add visibility rules:
   - public
   - followers only
   - own story
6. Add moderation/reporting.
7. Keep stories off in production until complete.

## Files Likely Touched

- `src/app/screens/home/StoryViewerScreen.tsx`
- `src/app/screens/home/AddStoryScreen.tsx`
- `src/lib/services/supabase/supabaseService.ts`
- `src/constants/featureFlags.ts`
- `supabase/migrations/**`

## Tests

- Story upload persists.
- Other user can see story if allowed.
- Expired story disappears.
- Report story works.
- Production flag blocks stories until enabled.

## Done Criteria

- Stories are no longer local cache/prototype-only.

---

# Advanced Phase 5 — Checklists and Portfolios

## Goal

Make checklists and portfolios a stable planning/identity layer.

## Prerequisites

- MVP saves/reviews/posts are stable.
- Profile identity is consistent.
- Supabase RLS is tested.

## Implementation Tasks

1. Verify checklist tables and RLS:
   - `checklists`
   - `checklist_items`
2. Verify portfolio tables and RLS:
   - `portfolios`
   - `portfolio_items`
   - `portfolio_collaborators`
   - `portfolio_follows`
   - `portfolio_flags`
3. Ensure stores are cache only in Supabase mode.
4. Add conflict handling for stale edits.
5. Add sharing and public-view tests.
6. Add moderation for public portfolios.
7. Add profile entry points.
8. Add search indexing and pagination.

## Files Likely Touched

- `src/store/useChecklistStore.ts`
- `src/store/usePortfolioStore.ts`
- `src/app/screens/checklist/**`
- `src/app/screens/portfolio/**`
- `src/components/checklist/**`
- `src/components/portfolio/**`
- `supabase/migrations/**`

## Tests

- Create checklist.
- Add dish/stall/custom item.
- Create portfolio.
- Publish portfolio.
- Other user can view public portfolio.
- Private portfolio stays private.
- Portfolio flag enters moderation queue.

## Done Criteria

- Checklists and portfolios are not standalone local tools.
- Public portfolio behavior is safe and RLS-tested.

---

# Advanced Phase 6 — Passport, Missions, and FoodCred

## Goal

Make gamification data-backed and tied to real user actions.

## Prerequisites

- Saves, reviews, posts, checklists/portfolios are stable.
- Event tracking is idempotent.

## Implementation Tasks

1. Define event sources:
   - review submitted
   - post published
   - dish saved
   - checklist item tried
   - portfolio published
   - cuisine explored
2. Verify/implement tables:
   - `food_cred_events`
   - `user_mission_progress`
   - `passport_stamps`
   - `passport_progress_events`
3. Add idempotency keys.
4. Add anti-gaming limits.
5. Add visibility settings.
6. Add progress recalculation script.
7. Add UI for earned badges/stamps.
8. Ensure progress is not fake.

## Files Likely Touched

- `src/store/usePassportStore.ts`
- `src/app/screens/profile/PassportScreen.tsx`
- `src/app/screens/profile/MissionsScreen.tsx`
- `src/components/gamification/**`
- `src/lib/services/supabase/supabaseService.ts`
- `supabase/migrations/**`

## Tests

- Review submitted awards points once.
- Portfolio publish creates passport event once.
- Duplicate event is blocked.
- Progress persists across devices.

## Done Criteria

- Gamification uses real events.
- Production can enable gamification without misleading users.

---

# Advanced Phase 7 — Full Merchant Centre

## Goal

Allow verified merchants to manage their business data safely.

## Prerequisites

- Merchant claim flow works.
- Merchant verification/RLS works.
- Consumer search/detail data model is stable.

## Implementation Tasks

1. Verify merchant account/outlet ownership model.
2. Verify merchant route access by role:
   - owner
   - manager
   - staff
3. Implement merchant profile editor:
   - stall name
   - description
   - opening hours
   - location/contact
   - images
4. Implement menu editor:
   - add/edit/delete dish
   - price
   - availability
   - featured toggle
   - photo upload
5. Ensure merchant edits update consumer screens.
6. Add audit log for merchant changes.
7. Add moderation/ops review for sensitive changes if needed.
8. Add merchant analytics only if real.
9. Add customer inbox only if review/comment backend is stable.

## Files Likely Touched

- `src/app/navigation/MerchantTabs.tsx`
- `src/app/screens/merchant/**`
- `src/features/merchant/**`
- `src/lib/services/supabase/supabaseService.ts`
- `marketing/website/web-v2/src/app/merchant/**`
- `supabase/migrations/**`

## Tests

- Unverified merchant cannot edit public menu.
- Verified merchant can update own dish.
- Merchant cannot edit another merchant’s outlet.
- Consumer detail reflects merchant update.
- Audit log records change.

## Done Criteria

- Merchant centre is secure enough for staging merchants.
- Production rollout requires support/ops readiness.

---

# Advanced Phase 8 — OCR Menu Pipeline and Ops Review

## Goal

Use OCR to help build menu data without publishing unverified data directly.

## Prerequisites

- Storage upload pipeline is stable.
- Ops role/RLS exists.
- Dish schema is stable.

## Implementation Tasks

1. Upload menu photo to private bucket.
2. Trigger OCR edge function.
3. Extract candidate dishes.
4. Insert into `dishes_draft`.
5. Dedupe against existing dishes.
6. Ops reviews drafts:
   - accept
   - edit
   - reject
   - duplicate
7. Accepted drafts promote into real dishes.
8. Consumer screens never show pending drafts.
9. Add latency/cost monitoring.

## Files Likely Touched

- `supabase/functions/**`
- `supabase/migrations/**`
- `src/app/screens/merchant/OCRDraftScreen.tsx`
- `ops/dishes-draft/**`
- `scripts/supabase-ocr-smoke.mjs`

## Tests

- OCR smoke upload to draft queue.
- Non-admin cannot read queue.
- Accepted draft becomes dish.
- Rejected draft never appears to consumer.

## Done Criteria

- OCR helps supply data safely.
- No unreviewed OCR data reaches users.

---

# Advanced Phase 9 — Indoor Maps and Floorplans

## Goal

Enable accurate indoor stall discovery only after geometry QA.

## Prerequisites

- Building/stall data is accurate.
- Floorplan source is documented.
- Tap accuracy QA is complete.

## Implementation Tasks

1. Validate floorplan geometry:
   - no self-intersections
   - no degenerate polygons
   - no invalid overlaps
2. Generate visual QA overlays.
3. Test polygon tap accuracy.
4. Add fallback for invalid floorplan data.
5. Link polygons to venue IDs.
6. Add analytics for floorplan interaction.
7. Keep `floorplansEnabled = false` until QA passes.

## Files Likely Touched

- `src/components/map/**`
- `src/app/screens/discover/BuildingDrillDownScreen.tsx`
- `src/app/screens/discover/BuildingDrillDownScreenV2.tsx`
- `scripts/floorplan/**`
- `data/floorplans/**`

## Tests

- Invalid floorplan does not crash.
- Polygon tap opens correct stall.
- Fallback layout appears when floorplan disabled.

## Done Criteria

- Indoor maps are trustworthy enough for users.

---

# Advanced Phase 10 — AI Creator Suite and AI Merchant Tools

## Goal

Add AI assistance only where it improves a completed workflow.

## Prerequisites

- Posting/reviewing works without AI.
- Merchant menu/profile tools work without AI.
- Safety/cost controls exist.

## Implementation Tasks

1. Define AI features:
   - caption suggestion
   - dish description generation
   - ingredient suggestions
   - merchant reply drafts
   - menu cleanup suggestions
2. Add clear AI labeling.
3. Add moderation/safety filters.
4. Add rate limits.
5. Add cost tracking.
6. Add fallback if AI fails.
7. Store prompts/outputs only if privacy-approved.
8. Avoid generating false factual claims.

## Files Likely Touched

- `src/features/post/useComposerStore.ts`
- `src/app/screens/post/PostComposerScreenV2.tsx`
- `src/app/screens/merchant/AIAssistantScreen.tsx`
- `supabase/functions/**`
- `src/lib/services/supabase/supabaseService.ts`

## Tests

- AI disabled in production if not configured.
- AI suggestion failure does not block user.
- Generated text is editable before publish.
- Rate limits work.

## Done Criteria

- AI is assistive, not a source of fake truth.

---

# Advanced Phase 11 — Merchant/Admin Web Console

## Goal

Provide admin and merchant tooling outside the consumer app.

## Prerequisites

- Merchant/account model is stable.
- Admin roles are defined.
- Web auth/session security is reviewed.

## Implementation Tasks

1. Separate marketing website from admin/merchant app if needed.
2. Secure merchant login/session.
3. Secure admin console routes.
4. Add CSRF protections.
5. Add RBAC.
6. Audit all API routes.
7. Add rate limits.
8. Add audit logs.
9. Add deployment environment separation.

## Files Likely Touched

- `marketing/website/web-v2/src/app/merchant/**`
- `marketing/website/web-v2/src/app/console/**`
- `marketing/website/web-v2/src/app/api/**`
- `marketing/website/web-v2/src/lib/security/**`
- `marketing/website/web-v2/src/lib/supabase/**`

## Tests

- Unauthenticated user cannot access console.
- Merchant cannot access another merchant’s outlet.
- Admin-only routes reject non-admin users.
- CSRF checks work.

## Done Criteria

- Web console is safe for internal staging.

---

# Advanced Phase 12 — QR Ordering and Payments

## Goal

Add ordering only after discovery, merchant data, and merchant operations are stable.

## Prerequisites

- Verified merchants exist.
- Menu availability is accurate.
- Merchant can handle orders operationally.
- Payment/refund/support policy exists.

## Implementation Tasks

1. Define order lifecycle:
   - cart
   - submitted
   - accepted
   - preparing
   - ready
   - completed
   - cancelled
   - refunded
2. Add tables:
   - `orders`
   - `order_items`
   - `payments`
   - `refunds`
3. Add payment provider integration.
4. Add merchant order dashboard.
5. Add user order history.
6. Add cancellation/refund rules.
7. Add customer support flow.
8. Add receipts.
9. Add fraud and abuse checks.

## Files Likely Touched

- New ordering screens
- Merchant dashboard
- Supabase migrations
- Payment provider integration
- Edge Functions

## Tests

- User places test order.
- Merchant accepts order.
- Payment succeeds/fails safely.
- Refund path works in sandbox.

## Done Criteria

- Ordering is operationally safe.
- Do not launch ordering without merchant support readiness.

---

# Advanced Phase 13 — Advanced Recommendations and Habit Learning

## Goal

Make recommendations smarter after the basic discovery loop has real usage data.

## Prerequisites

- Taste profile is stored.
- Search/detail/save/review/post events are persisted.
- Privacy controls exist.

## Implementation Tasks

1. Persist explicit feedback:
   - saves
   - ratings
   - reviews
   - search queries
   - dish clicks
2. Persist implicit feedback only with privacy controls:
   - dwell time
   - repeated ignores
   - photo zoom
3. Build recommendation slate RPC/service.
4. Add reason/explanation for each recommendation.
5. Add “not interested” and “show more like this.”
6. Add cache invalidation when taste changes.
7. Add analytics for recommendation conversion.

## Files Likely Touched

- `src/lib/ai/**`
- `src/lib/services/supabase/supabaseService.ts`
- `src/store/useProfileStore.ts`
- `supabase/migrations/**`

## Tests

- Taste quiz affects recommendations.
- Save/review adjusts profile.
- Recommendation slate excludes hidden/dismissed items.
- Privacy toggle disables behavioral learning.

## Done Criteria

- Recommendations are explainable and privacy-safe.

---

# Advanced Phase 14 — Advanced Release, Observability, and Scaling

## Goal

Make Hungry operationally ready for a larger beta/public launch.

## Implementation Tasks

1. Add dashboards:
   - crash-free sessions
   - sign-up funnel
   - search conversion
   - post publish success
   - review submit success
   - media upload failures
   - Supabase errors
   - OCR latency/cost
2. Add alerts:
   - high crash rate
   - failed uploads
   - failed auth
   - RLS errors
   - edge function failures
3. Add backup/restore drill.
4. Add migration rollback plan.
5. Add dependency/security scan cadence.
6. Add App Store / Play Store launch checklist.

## Done Criteria

- Team can detect and respond to production issues.
- Launch can be rolled back safely.

---

# Recommended Advanced PR Split

1. **Following Feed and Social Graph**
2. **Comments and Moderation**
3. **Activity and Notifications**
4. **Stories**
5. **Checklists and Portfolios**
6. **Passport and Missions**
7. **Full Merchant Centre**
8. **OCR Ops Pipeline**
9. **Indoor Floorplans**
10. **AI Creator and Merchant Tools**
11. **Merchant/Admin Web Console**
12. **QR Ordering and Payments**
13. **Advanced Recommendations**
14. **Observability and Scaling**

---

# Codex Prompt — Advanced Features Only After MVP

```text
You are working on the Hungry `frontend-design-overhaul` branch.

Your task is to plan and implement advanced features only after the MVP phases in `tasks/Roadmap/mvp-basic-features-implementation-phases.md` are complete and verified.

Read:
- `tasks/Roadmap/advanced-features-implementation-phases.md`
- `tasks/Roadmap/mvp-basic-features-implementation-phases.md`
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`

Rules:
1. Do not enable advanced features in production until their gates pass.
2. Every advanced feature must have a feature flag.
3. Every shared feature must be database-backed with RLS.
4. Zustand stores are cache/optimistic state only.
5. User-generated content requires moderation/reporting.
6. Merchant/admin features require RBAC and audit logs.
7. Do not implement QR ordering or payments until merchant operations are stable.

Implement advanced phases in order. After each phase, run relevant tests and update `tasks/todo.md`.

Final response should include:
1. Advanced phase completed
2. Files changed
3. Database migrations added
4. Tests added
5. Feature flag status
6. Production readiness status
```
