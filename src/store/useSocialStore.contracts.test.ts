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

test("social store contract: UUID follows sync to service and retain local-name fallback", () => {
  const source = read("src/store/useSocialStore.ts");
  const homeSource = read("src/app/screens/home/HomeFeedScreen.tsx");
  const profileSource = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const connectionsSource = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");

  assert.match(source, /toggleAuthorFollow: \(authorName: string\) => void/);
  assert.match(source, /toggleFollow: \(userId: string\) => void/);
  assert.match(source, /followedAuthors: \{\}/);
  assert.match(source, /followedUserIds: \{\}/);
  assert.match(source, /\[authorName\]: !prev\.followedAuthors\[authorName\]/);
  assert.match(source, /service\.social\.unfollowUser\(userId\)/);
  assert.match(source, /service\.social\.followUser\(userId\)/);
  assert.match(homeSource, /state\.followedAuthors/);
  assert.match(homeSource, /state\.followedUserIds/);
  assert.match(homeSource, /const followTargetId = item\.authorId/);
  assert.match(
    homeSource,
    /followTargetId[\s\S]*\? Boolean\(followedUserIds\[followTargetId\]\)[\s\S]*: Boolean\(followedAuthors\[item\.authorName\]\)/,
  );
  assert.match(
    homeSource,
    /followTargetId[\s\S]*\? toggleFollow\(followTargetId\)[\s\S]*: toggleAuthorFollow\(item\.authorName\)/,
  );
  assert.match(profileSource, /Object\.values\(followedUserIds\)\.filter/);
  assert.match(profileSource, /Object\.values\(followedAuthors\)\.filter/);
  assert.match(connectionsSource, /const targetUserId = route\.params\?\.userId \?\? profile\.id/);
  assert.match(connectionsSource, /service\.listFollowers\(targetUserId\)/);
  assert.match(connectionsSource, /service\.listFollowing\(targetUserId\)/);
  assert.match(
    connectionsSource,
    /person\.userId[\s\S]*\? toggleFollow\(person\.userId\)[\s\S]*: toggleAuthorFollow\(person\.name\)/,
  );
});

test("social store contract: like and save toggles keep local state even if sync fails", () => {
  const source = read("src/store/useSocialStore.ts");

  assert.match(source, /liked: isLiked/);
  assert.match(source, /saved: isSaved/);
  assert.match(source, /kept optimistic state and will retry later/);
});

test("profile grid contract: liked and saved posts read from the persisted social store", () => {
  const homeSource = read("src/app/screens/home/HomeFeedScreen.tsx");
  const gridSource = read("src/app/screens/profile/SocialGridScreen.tsx");

  assert.match(homeSource, /useSocialStore/);
  assert.match(homeSource, /getHomeFeedBundle\(profile\)/);
  assert.match(homeSource, /\.\.\.bundle\.socialFeed/);
  assert.match(homeSource, /\.\.\.bundle\.sections\.flatMap\(\(section\) => section\.items\)/);
  assert.match(homeSource, /togglePostLike/);
  assert.match(homeSource, /togglePostSave/);
  assert.match(gridSource, /useSocialStore/);
  assert.match(gridSource, /type === "liked" \? interaction\.liked : interaction\.saved/);
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
