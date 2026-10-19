import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("social store contract: post interactions persist locally", () => {
  const source = read("src/store/useSocialStore.ts");

  assert.match(source, /persist\(/);
  assert.match(source, /name: "hungry-social-v1"/);
  assert.match(source, /storage: hungryPersistStorage/);
  assert.match(source, /interactions: Record<string, InteractionState>/);
  assert.match(source, /followedAuthors: Record<string, boolean>/);
  assert.match(source, /followedUserIds: Record<string, boolean>/);
  assert.match(source, /commentsByPostId: Record<string, SocialComment\[\]>/);
  assert.match(source, /repliesByCommentId: Record<string, SocialReply\[\]>/);
  assert.match(source, /loadCommentsForPost: \(postId: string\) => Promise<void>/);
});

test("social store contract: UUID follows sync to service while local-name fallback is dev/mock only", () => {
  const source = read("src/store/useSocialStore.ts");
  const homeSource = read("src/app/screens/home/HomeFeedScreen.tsx");
  const profileSource = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const profileContentSource = read("src/app/screens/profile/UserProfileContent.tsx");
  const connectionsSource = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");

  assert.match(source, /toggleAuthorFollow: \(authorName: string\) => void/);
  assert.match(source, /toggleFollow: \(userId: string\) => void/);
  assert.match(source, /function canUseLocalAuthorFollowFallback\(\)/);
  assert.match(source, /Author-name follow ignored because this author is not backed by Supabase/);
  assert.match(source, /followedAuthors: \{\}/);
  assert.match(source, /followedUserIds: \{\}/);
  assert.match(source, /\[authorName\]: !prev\.followedAuthors\[authorName\]/);
  assert.match(source, /service\.social\.unfollowUser\(userId\)/);
  assert.match(source, /service\.social\.followUser\(userId\)/);
  // Failed follows roll back with a visible error; private accounts get a request notice.
  assert.match(source, /Couldn't follow\. Please try again\./);
  assert.match(source, /if \(result !== "pending"\) return;/);
  assert.match(source, /Follow request sent/);
  assert.match(source, /markFollowedUserIds: \(userIds\) =>/);
  assert.match(homeSource, /state\.followedAuthors/);
  assert.match(homeSource, /state\.followedUserIds/);
  assert.match(homeSource, /const followTargetId = item\.authorId/);
  assert.match(homeSource, /const canUseAuthorFallbackFollow =/);
  assert.match(
    homeSource,
    /const canShowFollowButton = Boolean\(followTargetId\) \|\| canUseAuthorFallbackFollow/,
  );
  assert.match(
    homeSource,
    /followTargetId[\s\S]*\? Boolean\(followedUserIds\[followTargetId\]\)[\s\S]*: canUseAuthorFallbackFollow && Boolean\(followedAuthors\[item\.authorName\]\)/,
  );
  assert.match(
    homeSource,
    /followTargetId[\s\S]*\? toggleFollow\(followTargetId\)[\s\S]*: toggleAuthorFollow\(item\.authorName\)/,
  );
  // Own counts are server-only; local follow maps must not be added on top.
  assert.doesNotMatch(profileSource, /Object\.values\(followedUserIds\)\.filter/);
  assert.doesNotMatch(profileSource, /Object\.values\(followedAuthors\)\.filter/);
  assert.match(connectionsSource, /const targetUserId = route\.params\?\.userId \?\? profile\.id/);
  assert.match(connectionsSource, /service\.listFollowers\(targetUserId, page\)/);
  assert.match(connectionsSource, /service\.listFollowing\(targetUserId, page\)/);
  // Lists are the viewed profile's server lists; the viewer's local follows only drive buttons.
  assert.doesNotMatch(connectionsSource, /Object\.entries\(followedUserIds\)/);
  assert.doesNotMatch(connectionsSource, /followedAuthors/);
  assert.match(connectionsSource, /const canShowFollowButton = person\.userId !== profile\.id/);
  assert.match(connectionsSource, /onPress=\{\(\) => toggleFollow\(person\.userId\)\}/);
  assert.match(connectionsSource, /`\$\{targetDisplayName\} doesn't have any followers yet\.`/);
  // Other profiles follow by account id only; a name-only author shows "Profile unavailable".
  assert.doesNotMatch(profileContentSource, /canUseAuthorFallbackFollow/);
  assert.doesNotMatch(profileContentSource, /toggleAuthorFollow/);
  assert.match(profileContentSource, /title="Profile unavailable"/);
  // Other users' stats come from the server, not hard-coded values.
  assert.match(profileContentSource, /service\.getFollowCounts\(resolvedAuthorId\)/);
  assert.match(profileContentSource, /value=\{followersCount\}/);
  assert.match(profileContentSource, /value=\{followingCount\}/);
  assert.doesNotMatch(profileContentSource, /value=\{isFollowingAuthor \? 1 : 0\}/);
  assert.match(profileContentSource, /const canShowFollowButton = Boolean\(resolvedAuthorId\)/);
  assert.match(profileContentSource, /if \(resolvedAuthorId\) toggleFollow\(resolvedAuthorId\)/);
});

test("social store contract: follow state is loaded from the server on sign-in", () => {
  const source = read("src/store/useSocialStore.ts");
  const session = read("src/store/useSessionStore.ts");

  assert.match(source, /syncFollowedUserIds: \(userId: string\) => Promise<void>/);
  assert.match(source, /social\.listFollowing\(userId, \{/);
  // A complete server list replaces local follows, so stale ones are cleared.
  assert.match(source, /return \{ followedUserIds: followed, requestedUserIds: requested \};/);
  assert.match(session, /syncFollowStateFromServer\(nextUserId\)/);
  assert.match(session, /\.syncFollowedUserIds\(userId\)/);
});

test("social store contract: like and save toggles roll back failed Supabase sync", () => {
  const source = read("src/store/useSocialStore.ts");

  assert.match(source, /liked: isLiked/);
  assert.match(source, /saved: isSaved/);
  assert.match(source, /interactionStatesMatch/);
  assert.match(source, /rolled back optimistic state/);
});

test("social store contract: real post shares sync to Supabase and unsupported ids no-op", () => {
  const source = read("src/store/useSocialStore.ts");
  const serviceTypes = read("src/lib/services/types.ts");
  const mockService = read("src/lib/services/mock/mockService.ts");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  const reviewShareSheet = read("src/app/screens/review/ReviewShareSheet.tsx");
  const reviewFeed = read("src/app/screens/review/ReviewFeedScreen.tsx");

  assert.match(
    serviceTypes,
    /shareBite\(\s*biteId: string,\s*options\?: \{\s*channel\?: "in_app" \| "system_share" \| "copy_link"/,
  );
  assert.match(mockService, /async shareBite\(\)/);
  assert.match(supabaseService, /async shareBite\(biteId, options\)/);
  assert.match(supabaseService, /from\("post_shares"\)\.insert/);
  assert.match(supabaseService, /share_channel: options\?\.channel \?\? "in_app"/);
  assert.match(source, /incrementShare: \(postId: string, channel\?: ShareChannel\) => void/);
  assert.match(source, /Post share ignored because this post is not backed by Supabase/);
  assert.match(source, /isUuidPostId\(postId\)/);
  assert.match(source, /social\.shareBite\(postId, \{ channel \}\)/);
  assert.match(source, /rolled back optimistic state/);
  assert.match(
    reviewShareSheet,
    /if \(activeReview\.postId\) \{\s*onShared\(activeReview\.postId, "in_app"\)/,
  );
  assert.match(reviewShareSheet, /onShared\(activeReview\.postId, "copy_link"\)/);
  assert.match(reviewShareSheet, /onShared\(activeReview\.postId, "system_share"\)/);
  assert.match(reviewFeed, /postId: linkedPost\?\.id \?\? ""/);
  assert.match(reviewFeed, /shareCount: 0/);
  assert.doesNotMatch(reviewFeed, /postId: linkedPost\?\.id \?\? item\.review\.id/);
  assert.doesNotMatch(reviewFeed, /stallPosts\[0\]/);
});

test("profile grid contract: liked and saved posts read from the persisted social store", () => {
  const homeSource = read("src/app/screens/home/HomeFeedScreen.tsx");
  const gridSource = read("src/app/screens/profile/SocialGridScreen.tsx");

  assert.match(homeSource, /useSocialStore/);
  assert.match(homeSource, /getHomeFeedBundle\(profile,\s*\{/);
  assert.match(homeSource, /followedAuthors,/);
  assert.match(homeSource, /followedUserIds,/);
  assert.match(homeSource, /\.\.\.bundle\.socialFeed/);
  assert.match(homeSource, /\.\.\.bundle\.sections\.flatMap\(\(section\) => section\.items\)/);
  assert.match(homeSource, /togglePostLike/);
  assert.match(homeSource, /togglePostSave/);
  assert.match(gridSource, /useSocialStore/);
  assert.match(gridSource, /type === "liked" \? interaction\.liked : interaction\.saved/);
});

test("public profile post history has a service-backed user post path", () => {
  const serviceTypes = read("src/lib/services/types.ts");
  const mockService = read("src/lib/services/mock/mockService.ts");
  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  const profileContent = read("src/app/screens/profile/UserProfileContent.tsx");

  assert.match(
    serviceTypes,
    /listUserPosts\(userId: string, page\?: \{ limit\?: number; offset\?: number \}\): Promise<Bite\[\]>/,
  );
  assert.match(mockService, /async listUserPosts\(userId: string, page\?/);
  assert.match(supabaseService, /async listUserPosts\(userId: string, page\?/);
  assert.match(profileContent, /\.social\.listUserPosts\(normalizedAuthorId as string, \{/);
  assert.match(profileContent, /biteToStallPost/);
});

test("public profile does not expose the current user's saved card", () => {
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const profileContent = read("src/app/screens/profile/UserProfileContent.tsx");

  assert.match(profileHome, /!\s*isOtherUserProfile \? \([\s\S]*label="Saved"/);
  assert.doesNotMatch(profileContent, /label="Saved"/);
  assert.doesNotMatch(profileContent, /navigation\.navigate\("Favourites"\)/);
});

test("social store contract: comments and replies update visible post counters", () => {
  const source = read("src/store/useSocialStore.ts");
  const homeSource = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(source, /addComment: \(postId: string, comment: SocialComment\) => void/);
  assert.match(source, /addReply: \(postId: string, reply: SocialReply\) => void/);
  assert.match(source, /loadCommentsForPost: \(postId: string\) => Promise<void>/);
  assert.match(source, /social\.listCommentsForPost\(postId\)/);
  assert.match(source, /commentsByPostId: \{/);
  assert.match(
    source,
    /\[postId\]: \[\s*\.\.\.\(prev\.commentsByPostId\[postId\] \?\? \[\]\),\s*comment,?\s*\]/,
  );
  assert.match(source, /repliesByCommentId: \{/);
  assert.match(
    source,
    /\[reply\.parentCommentId\]: \[\s*\.\.\.\(prev\.repliesByCommentId\[reply\.parentCommentId\] \?\? \[\]\),\s*reply,?\s*\]/,
  );
  assert.match(source, /commentCount: current\.commentCount \+ 1/);
  assert.match(source, /social\.createComment\(postId, comment\.text\)/);
  assert.match(source, /social\.createComment\(postId, reply\.text, reply\.parentCommentId\)/);
  assert.doesNotMatch(source, /social\.createComment\(reply\.parentCommentId, reply\.text\)/);
  assert.match(homeSource, /void loadCommentsForPost\(activeCommentItem\.id\)/);
});
