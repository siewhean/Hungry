import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { groupActivityUpdates, type ActivityUpdate } from "@/features/home/activity";
import { formatVenueLine, getHomeFeedBundleCacheKey } from "@/features/home/feed";
import { getWeeklyPicksCacheKey, resolveStoredWeeklyPicks } from "@/features/home/weeklyPicks";
import { stableCacheKeyForUri } from "@/lib/images/stableCacheKey";
import { biteToStallPost } from "@/lib/services/postTransforms";
import type { Bite } from "@/lib/services/types";
import {
  PERSISTED_COMMENT_THREAD_LIMIT,
  PERSISTED_INTERACTION_LIMIT,
  partializeSocialState,
} from "@/store/useSocialStore";
import type { DishDetail, UserProfile } from "@/types/domain";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const like = (id: string, postId: string, actorName: string, unread = true): ActivityUpdate => ({
  id,
  kind: "like",
  postId,
  actorName,
  text: "liked your post",
  target: "",
  time: "2026-10-21T10:00:00Z",
  unread,
});

// ---------------------------------------------------------------------------
// M7: likes on the same post fold into one inbox row
// ---------------------------------------------------------------------------

test("M7: likes on one post group into a single row, in place, with other kinds untouched", () => {
  const updates: ActivityUpdate[] = [
    like("a", "post-1", "Ahmad"),
    {
      id: "c",
      kind: "comment",
      postId: "post-1",
      actorName: "Sarah",
      text: "commented on your post",
      target: "",
      time: "2026-10-21T09:00:00Z",
      unread: true,
    },
    like("b", "post-1", "Wei Ling"),
    like("d", "post-2", "Uncle Tan", false),
    like("e", "post-1", "Mei"),
  ];
  const rows = groupActivityUpdates(updates, []);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0]?.memberIds, ["a", "b", "e"]);
  assert.equal(rows[0]?.actorCount, 3);
  assert.equal(rows[0]?.text, "and 2 others liked your post");
  assert.equal(rows[1]?.kind, "comment");
  assert.equal(rows[2]?.memberIds[0], "d");
  assert.equal(rows[2]?.isUnread, false);

  const two = groupActivityUpdates([like("a", "post-1", "Ahmad"), like("b", "post-1", "Mei")], []);
  assert.equal(two[0]?.text, "and 1 other liked your post");
});

test("M7: a grouped row stays unread while any member is unread", () => {
  const updates = [like("a", "post-1", "Ahmad"), like("b", "post-1", "Mei")];
  assert.equal(groupActivityUpdates(updates, ["update:a"])[0]?.isUnread, true);
  assert.equal(groupActivityUpdates(updates, ["update:a", "update:b"])[0]?.isUnread, false);
});

test("M7: the inbox shows an error banner, skeleton, mark-all and paging; the store keeps the list", () => {
  const inbox = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const store = read("src/store/useActivityStore.ts");
  assert.match(inbox, /groupActivityUpdates\(/);
  assert.match(inbox, /Mark all as read/);
  assert.match(inbox, /Show older updates/);
  assert.match(inbox, /<Skeleton/);
  assert.match(inbox, /`Unread\. /);
  assert.match(store, /activityLoadFailed/);
  assert.match(store, /hasLoadedActivity/);
  assert.match(store, /fetchMoreActivityEvents/);
  assert.match(store, /notifications\.markAllActivityRead\(\)/);
  assert.doesNotMatch(store, /set\(\{ dbActivityEvents: \[\] \}\)/);
});

test("M7: Home refreshes the bell count on focus and when the app returns to the foreground", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /AppState\.addEventListener\("change"/);
  assert.match(home, /nextState === "active"\) void fetchActivityEvents\(\)/);
  assert.match(home, /Activity, \$\{activityUnreadCount\} unread/);
});

// ---------------------------------------------------------------------------
// L11: the persisted social store is bounded
// ---------------------------------------------------------------------------

test("L11: the social store persists follow state and a bounded window of per-post state", () => {
  const interactions: Record<string, never> = {};
  for (let index = 0; index < PERSISTED_INTERACTION_LIMIT + 25; index += 1) {
    interactions[`post-${index}`] = {
      liked: true,
      saved: false,
      likeCount: 1,
      saveCount: 0,
      shareCount: 0,
      commentCount: 0,
    } as never;
  }
  const commentsByPostId: Record<string, never[]> = {};
  for (let index = 0; index < PERSISTED_COMMENT_THREAD_LIMIT + 5; index += 1) {
    commentsByPostId[`post-${index}`] = [
      { id: `comment-${index}`, authorName: "A", text: "hi", createdAt: "2026-10-21T10:00:00Z" },
    ] as never[];
  }
  const kept = partializeSocialState({
    interactions,
    followedAuthors: { Ahmad: true },
    followedUserIds: { u1: true },
    requestedUserIds: { u2: true },
    commentsByPostId,
    repliesByCommentId: {
      "comment-0": [{ id: "r0" }] as never[],
      [`comment-${PERSISTED_COMMENT_THREAD_LIMIT + 4}`]: [{ id: "r1" }] as never[],
    },
  });
  assert.equal(Object.keys(kept.interactions).length, PERSISTED_INTERACTION_LIMIT);
  // The newest posts survive, the oldest go.
  assert.ok(kept.interactions[`post-${PERSISTED_INTERACTION_LIMIT + 24}`]);
  assert.equal(kept.interactions["post-0"], undefined);
  assert.equal(Object.keys(kept.commentsByPostId).length, PERSISTED_COMMENT_THREAD_LIMIT);
  assert.deepEqual(kept.followedUserIds, { u1: true });
  assert.deepEqual(kept.requestedUserIds, { u2: true });
  assert.equal(kept.repliesByCommentId["comment-0"], undefined);
  assert.ok(kept.repliesByCommentId[`comment-${PERSISTED_COMMENT_THREAD_LIMIT + 4}`]);
});

test("L11: server read state replaces the local read list for server events, which is capped", () => {
  const store = read("src/store/useActivityStore.ts");
  assert.match(store, /READ_ACTIVITY_ID_LIMIT|slice\(-/);
});

// ---------------------------------------------------------------------------
// M1: weekly picks are computed once per account, week and dietary filter
// ---------------------------------------------------------------------------

test("M1: the picks key ignores taste and dietary order, and changes with the week or filters", () => {
  const base = getWeeklyPicksCacheKey("user-1", "2026-W42", ["vegan", "halal"]);
  assert.equal(base, getWeeklyPicksCacheKey("user-1", "2026-W42", ["halal", "vegan"]));
  assert.notEqual(base, getWeeklyPicksCacheKey("user-1", "2026-W43", ["vegan", "halal"]));
  assert.notEqual(base, getWeeklyPicksCacheKey("user-1", "2026-W42", ["vegan"]));
  assert.notEqual(base, getWeeklyPicksCacheKey("user-2", "2026-W42", ["vegan", "halal"]));
});

test("M1: stored picks resolve to dishes, or to null when a dish left the catalog", () => {
  const dish = (id: string) => ({ id, name: id }) as unknown as DishDetail;
  const stored = {
    picks: [
      { dishId: "a", explanation: "One" },
      { dishId: "b", explanation: "Two" },
    ],
  };
  const resolved = resolveStoredWeeklyPicks(stored, (id) => dish(id));
  assert.deepEqual(
    resolved?.map((pick) => [pick.dish.id, pick.explanation]),
    [
      ["a", "One"],
      ["b", "Two"],
    ],
  );
  assert.equal(
    resolveStoredWeeklyPicks(stored, (id) => (id === "a" ? dish(id) : undefined)),
    null,
  );
});

test("M1 and L3 and M11: the rail reads saved picks, says Popular on Hungry, and holds a compact Decide button", () => {
  const rail = read("src/components/dish/WeeklyPicksRail.tsx");
  assert.match(rail, /useWeeklyPicksStore/);
  assert.match(rail, /resolveStoredWeeklyPicks\(/);
  assert.match(rail, /savePicks\(/);
  assert.doesNotMatch(rail, /Popular near you/);
  assert.match(rail, /<Button label="Decide for me" size="sm" onPress=\{onDecideForMe\} \/>/);
  const store = read("src/store/useWeeklyPicksStore.ts");
  assert.match(store, /name: "hungry-weekly-picks-v1"/);
});

// ---------------------------------------------------------------------------
// M3: no hidden taste ranking in the feed
// ---------------------------------------------------------------------------

test("M3: the Home feed cache key holds the account and follows, not taste or openness", () => {
  const profileA = { id: "user-1", tasteVector: { sweet: 1 } } as unknown as UserProfile;
  const profileB = { id: "user-1", tasteVector: { sweet: 9 } } as unknown as UserProfile;
  assert.equal(getHomeFeedBundleCacheKey(profileA), getHomeFeedBundleCacheKey(profileB));
  assert.notEqual(
    getHomeFeedBundleCacheKey(profileA, { followedUserIds: { x: true } }),
    getHomeFeedBundleCacheKey(profileA),
  );
  const feed = read("src/features/home/feed.ts");
  assert.doesNotMatch(feed, /rankHomeFeedItems|runRecommendationPipeline|HomeFeedSection/);
});

// ---------------------------------------------------------------------------
// M2: cursor paging and the all-caught-up footer
// ---------------------------------------------------------------------------

test("M2: the feed pages on the oldest post, and ends with a caught-up footer", () => {
  const shared = read("src/features/social/sharedStallPosts.ts");
  assert.match(shared, /export const FEED_PAGE_SIZE = 40/);
  assert.match(shared, /nextCursor/);
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /p_cursor_feed_created_at: cursorCreatedAt/);
  assert.match(service, /p_cursor_post_id: cursorPostId/);
  assert.match(service, /page\.cursor\?\.createdAt/);
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /onEndReached=\{\(\) => void loadMoreFeed\(\)\}/);
  assert.match(home, /getHomeFeedNextPage\(/);
  assert.match(home, /You&apos;re all caught up/);
});

// ---------------------------------------------------------------------------
// M4, M5, L17: the safety sheet
// ---------------------------------------------------------------------------

test("M4 and M5: report, hide and block use one app-wide sheet with reasons and a block confirmation", () => {
  const sheet = read("src/features/safety/SafetyActionsSheet.tsx");
  const safety = read("src/lib/security/communitySafety.ts");
  const body = read("src/app/AppBody.tsx");
  assert.match(body, /<SafetyActionsSheet \/>/);
  for (const reason of ["spam", "offensive", "wrong_place", "other"]) {
    assert.match(sheet, new RegExp(`reason: "${reason}"`));
  }
  assert.match(sheet, /You won't see posts or comments from/);
  assert.match(sheet, /setStep\("block"\)/);
  assert.match(safety, /openSafetyMenu\(/);
  assert.match(safety, /reason: `user_reported_\$\{target\.targetType\}_\$\{reason\}`/);
  // The three-button system alert (Android drops the fourth) is gone from the post menu.
  assert.doesNotMatch(safety, /Manage \$\{label\}`, managementCopy/);
  assert.doesNotMatch(safety, /We will reduce content from this user/);
  assert.doesNotMatch(safety, /We will show less content like this/);
});

test("M5: Settings lists blocked people and hidden posts with Unblock and Unhide", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  const screen = read("src/app/screens/profile/BlockedAndHiddenScreen.tsx");
  const navigator = read("src/app/navigation/RootNavigator.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");
  assert.match(settings, /label=\{BLOCKED_AND_HIDDEN_TITLE\}/);
  // Hidden posts belong to the archived social feed and only list while it is on.
  assert.match(screen, /const showHiddenPosts = FEATURE_FLAGS\.socialFeedEnabled;/);
  assert.match(settings, /rootNavigation\.navigate\("BlockedAndHidden"\)/);
  assert.match(types, /BlockedAndHidden: undefined/);
  assert.match(navigator, /name="BlockedAndHidden"/);
  assert.match(screen, /unblockUserForSession/);
  assert.match(screen, /unhidePostForSession/);
  assert.match(screen, /listBlockedUsers\(\)/);
  assert.match(screen, /listHiddenPosts\(\)/);
});

test("L17: the Home post menu asks guests to sign in instead of failing", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const safety = read("src/lib/security/communitySafety.ts");
  assert.match(home, /requireAuthForPostAction\("Sign in to report or block\."\)/);
  assert.match(safety, /Sign in to report or block/);
});

// ---------------------------------------------------------------------------
// M6, L1, L16: the migration
// ---------------------------------------------------------------------------

test("M6, L1, L16: the activity migration dedupes events, ends follows on block and hides blocked actors", () => {
  const sql = read(
    "supabase/migrations/20261022030000_social_activity_dedupe_and_block_cleanup.sql",
  );
  assert.match(sql, /create unique index if not exists idx_activity_events_once_per_actor_target/);
  assert.match(sql, /event_type in \('new_like', 'new_follower', 'follow_request'\)/);
  assert.equal(sql.match(/on conflict do nothing/g)?.length, 3);
  assert.match(
    sql,
    /create trigger trg_activity_on_post_unlike\s+after delete on public\.post_likes/,
  );
  assert.match(sql, /create trigger trg_activity_on_unfollow\s+after delete on public\.follows/);
  assert.match(sql, /function app_private\.block_user\(/);
  assert.match(sql, /delete from public\.follows f/);
  assert.match(sql, /function public\.block_user\(/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /function public\.mark_all_activity_read\(\)/);
  assert.match(sql, /activity_events_select_hide_blocked/);
  assert.match(sql, /as restrictive/);
  assert.match(sql, /function app_private\.list_my_blocked_users\(\)/);
  assert.match(sql, /function app_private\.list_my_hidden_posts\(\)/);
});

test("M6, L1, L16: the smoke file exercises the migration and rolls back", () => {
  const smoke = read("supabase/smoke/home_feed_social_activity.sql");
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);
  assert.match(smoke, /public\.block_user\(/);
  assert.match(smoke, /public\.mark_all_activity_read\(\)/);
  assert.match(smoke, /list_my_blocked_users/);
  assert.match(smoke, /list_my_hidden_posts/);
});

test("L1: blocking calls the block_user RPC and unblocking deletes the viewer's own block", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /client\.rpc\("block_user"/);
  assert.match(service, /async unblockUser\(blockedUserId: string\)/);
  assert.match(service, /client\.rpc\("list_my_blocked_users"\)/);
  assert.match(service, /client\.rpc\("list_my_hidden_posts"\)/);
  assert.match(service, /client\.rpc\("mark_all_activity_read"\)/);
});

// ---------------------------------------------------------------------------
// M8: social push
// ---------------------------------------------------------------------------

test("M8: follow requests and a daily likes digest are push categories behind one preference", () => {
  const sql = read("supabase/migrations/20261022031000_social_push_categories.sql");
  assert.match(sql, /add column if not exists social_activity boolean not null default true/);
  assert.match(sql, /'social_follow_request',\s*'social_like_digest'/);
  assert.match(sql, /'follow_request',\s*'like_digest'/);
  assert.match(sql, /'https:\/\/usehungry\.com\/follow-requests'/);
  assert.match(sql, /'https:\/\/usehungry\.com\/post\/'/);
  assert.match(sql, /'https:\/\/usehungry\.com\/activity'/);
  assert.match(sql, /app_user_block_exists\(ae\.recipient_id, ae\.actor_id\)/);
  assert.match(
    sql,
    /grant execute on function public\.enqueue_social_like_digest_notifications\(\) to service_role/,
  );
  assert.match(sql, /'0 3 \* \* \*'/);
  const smoke = read("supabase/smoke/social_push_jobs.sql");
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);
  assert.match(smoke, /enqueue_social_like_digest_notifications/);
});

test("M8: the worker honours the social preference and never caps follow requests", () => {
  const worker = read("supabase/functions/send-notifications/index.ts");
  assert.match(worker, /social_activity: true/);
  assert.match(worker, /const isSocial = job\.category\.startsWith\("social_"\)/);
  assert.match(worker, /isSocial\s*\? !pref\.social_activity/);
  assert.match(worker, /!isMealtime\s*&&\s*!isWeeklyPicks\s*&&\s*!isSocial/);
  assert.match(worker, /!isFollowRequest &&/);
  assert.match(worker, /social_follow_request/);
});

test("M8: the deep links the pushes use open the inbox and the follow requests screen", () => {
  const linking = read("src/app/navigation/linking.ts");
  assert.match(linking, /ActivityInbox: "activity"/);
  assert.match(linking, /FollowRequests: "follow-requests"/);
  // Every route needs a session (sign-in only), so there is no protected-route list.
});

// ---------------------------------------------------------------------------
// M9, M10: the shared, memoised card
// ---------------------------------------------------------------------------

test("M10: each card is memoised, owns its own state and reads its counts from the store", () => {
  const card = read("src/components/social/FeedPostCard.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(card, /export const FeedPostCard = memo\(FeedPostCardImpl\)/);
  assert.match(card, /useSocialStore\(\(state\) => state\.interactions\[item\.id\]\)/);
  assert.match(card, /const \[carouselIndex, setCarouselIndex\]/);
  assert.match(card, /const \[isCaptionExpanded, setIsCaptionExpanded\]/);
  assert.match(card, /const \[heartBurst, setHeartBurst\]/);
  // The screen no longer holds per-card state or subscribes to the whole interactions map.
  assert.doesNotMatch(home, /useSocialStore\(\(state\) => state\.interactions\)/);
  assert.doesNotMatch(home, /carouselIndexByPostId|expandedCaptionByPostId|heartBurst/);
  assert.match(home, /renderItem=\{renderFeedItem\}/);
  assert.match(home, /const feedCardActions = useMemo<FeedPostCardActions>/);
});

test("M9: the post detail screen reuses the feed card and drops the extra play overlay", () => {
  const detail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  assert.match(detail, /<FeedPostCard/);
  assert.match(detail, /toggleFollow: \(\) => \{/);
  assert.match(detail, /openProfile: \(\) =>/);
  assert.doesNotMatch(detail, /PlayCircle/);
  assert.doesNotMatch(detail, /pointerEvents="none"/);
});

// ---------------------------------------------------------------------------
// M11, M12, L3: header, errors, copy
// ---------------------------------------------------------------------------

test("M12: a feed error keeps the header, and a failed refresh toasts", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /feedState === "error" \? \(/);
  assert.match(home, /Could not refresh your feed/);
  // The old full-screen error early return is gone.
  assert.doesNotMatch(home, /if \(feedState === "error"\) \{\s*return \(/);
});

test("L3: empty-feed copy says near you only when a location is known", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /coordinate \? "Top rated near you" : "Top rated on Hungry"/);
  assert.doesNotMatch(home, /top-rated dishes near you\."\s*\n?\s*\)/);
});

// ---------------------------------------------------------------------------
// L2, L5, L6: data and card copy
// ---------------------------------------------------------------------------

test("L2: share and comment counts from the feed reach the post and the store", () => {
  const bite = {
    id: "post-1",
    authorName: "Ahmad",
    authorAvatar: "",
    createdAt: "2026-10-21T10:00:00Z",
    mediaUrl: "https://example.test/a.jpg",
    mediaType: "photo",
    caption: "Good",
    likeCount: 3,
    dishName: "Laksa",
    stallId: "venue-1",
    stallName: "Stall",
    commentCount: 4,
    shareCount: 7,
  } as unknown as Bite;
  const post = biteToStallPost(bite, { authorAvatarUrl: "" });
  assert.equal(post.commentCount, 4);
  assert.equal(post.shareCount, 7);
  const store = read("src/store/useSocialStore.ts");
  assert.match(store, /item\.shareCount/);
});

test("L5: a missing avatar stays empty so initials show, never the food photo", () => {
  const bite = {
    id: "post-2",
    authorName: "Mei",
    authorAvatar: "",
    createdAt: "2026-10-21T10:00:00Z",
    mediaUrl: "https://example.test/food.jpg",
    mediaType: "photo",
    caption: "",
    likeCount: 0,
    dishName: "Chicken rice",
    stallId: "venue-1",
    stallName: "Stall",
  } as unknown as Bite;
  assert.equal(biteToStallPost(bite).authorAvatarUrl, "");
});

test("L6: the venue line joins floor and unit only when present, and shows once per card", () => {
  assert.equal(
    formatVenueLine({ name: "Maxwell Food Centre", floor: "#01", unitNumber: "23" }),
    "Maxwell Food Centre · #01 23",
  );
  assert.equal(
    formatVenueLine({ name: "Maxwell Food Centre", floor: "", unitNumber: "#01-23" }),
    "Maxwell Food Centre · #01-23",
  );
  assert.equal(
    formatVenueLine({ name: "Maxwell Food Centre", floor: "", unitNumber: "" }),
    "Maxwell Food Centre",
  );
  const card = read("src/components/social/FeedPostCard.tsx");
  // With the overlay on, the header subline is the time; with it off, the venue moves up.
  assert.match(
    card,
    /shouldShowFoodContextOverlay \? \(\s*<AppText variant="micro" tone="secondary">\s*\{postAgeLabel\}/,
  );
  assert.match(card, /\{venueLine\}/);
});

// ---------------------------------------------------------------------------
// L7, L8, L9, L10, L12, L14, L15: smaller fixes
// ---------------------------------------------------------------------------

test("L7: photo hints describe what a tap does, and comment avatars are labelled", () => {
  const card = read("src/components/social/FeedPostCard.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(card, /Tap the left or right side to change photo\. Double tap to like\./);
  assert.doesNotMatch(card, /Opens this (image|media)/);
  assert.match(home, /accessibilityLabel=\{`Open \$\{comment\.authorName\} profile`\}/);
  assert.doesNotMatch(home, /Shows messages, comments, likes, and shares/);
});

test("L8: re-pressing the Home tab scrolls the feed to the top", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /navigation\.addListener\("tabPress"/);
  assert.match(home, /scrollToOffset\(\{ offset: 0, animated: true \}\)/);
});

test("L9: a failed like or save rolls back with a toast", () => {
  const store = read("src/store/useSocialStore.ts");
  assert.match(store, /showSocialToast\([^)]*like/i);
  assert.match(store, /showSocialToast\([^)]*save/i);
});

test("L10: saving a post says the dish was saved too", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /Saved \$\{primaryDish\.name\} to your dishes/);
});

test("L12: posts report an impression after a short dwell, and videos report a play", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const card = read("src/components/social/FeedPostCard.tsx");
  assert.match(home, /trackAnalyticsEvent\("post_impression"/);
  assert.match(home, /POST_IMPRESSION_DWELL_MS/);
  assert.match(card, /trackAnalyticsEvent\("video_play"/);
});

test("L13: stories and direct messages stay behind their flags in production", () => {
  const flags = read("src/constants/featureFlags.ts");
  assert.match(flags, /storiesEnabled/);
  assert.match(flags, /directMessagesEnabled/);
});

test("L14: the Home tab does not take pager swipes, so the photo carousel keeps them", () => {
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  assert.match(tabs, /name="Home"[\s\S]{0,120}options=\{\{ swipeEnabled: false \}\}/);
});

test("L15: the empty comments copy says comment, not review", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /Be the first to comment\./);
  assert.doesNotMatch(home, /share your review/);
});

// ---------------------------------------------------------------------------
// L4, M13: dead code and image cache
// ---------------------------------------------------------------------------

test("L4: review mode and its helpers are gone from Home", () => {
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  for (const dead of [
    /HomeFeedMode/,
    /mode === "review"/,
    /function FeedSkeleton/,
    /VerticalActionMetric/,
    /reviewFeedScrollRef/,
    /\?\? 4\.5/,
    /overlayContent|playButtonBackdrop|quickPostButton/,
  ]) {
    assert.doesNotMatch(home, dead);
  }
  assert.doesNotMatch(tabs, /HomeFeedScreen mode=/);
});

test("M13: signed storage URLs get a cache key that survives re-signing", () => {
  const signed =
    "https://abc.supabase.co/storage/v1/object/sign/post-media/u1/p1/photo.jpg?token=eyJ.one";
  const resigned =
    "https://abc.supabase.co/storage/v1/object/sign/post-media/u1/p1/photo.jpg?token=eyJ.two";
  assert.equal(
    stableCacheKeyForUri(signed),
    "https://abc.supabase.co/storage/v1/object/sign/post-media/u1/p1/photo.jpg",
  );
  assert.equal(stableCacheKeyForUri(signed), stableCacheKeyForUri(resigned));
  assert.equal(stableCacheKeyForUri("https://images.example.test/a.jpg?w=100"), undefined);
  assert.equal(stableCacheKeyForUri(undefined), undefined);
  assert.match(
    read("src/components/ui/AccessibleImage.tsx"),
    /stableCacheKeyForUri\(source\.uri\)/,
  );
});

test("new files exist", () => {
  for (const path of [
    "src/components/social/FeedPostCard.tsx",
    "src/features/safety/SafetyActionsSheet.tsx",
    "src/app/screens/profile/BlockedAndHiddenScreen.tsx",
    "supabase/smoke/home_feed_social_activity.sql",
    "supabase/smoke/social_push_jobs.sql",
  ]) {
    assert.ok(existsSync(resolve(process.cwd(), path)), path);
  }
});
