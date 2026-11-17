import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("profile social grid opens posts in a detail route", () => {
  const gridSource = read("src/app/screens/profile/SocialGridScreen.tsx");
  const navTypesSource = read("src/app/navigation/navigationTypes.ts");
  const stackSource = read("src/app/screens/profile/ProfileStack.tsx");

  assert.match(gridSource, /navigation\.navigate\("SocialPostDetail"/);
  assert.doesNotMatch(gridSource, /Navigation to social post detail coming soon/);
  assert.match(navTypesSource, /SocialPostDetail: \{ postId: string; type: "liked" \| "saved" \}/);
  assert.match(stackSource, /FEATURE_FLAGS\.collectionsEnabled \? \(/);
  assert.match(stackSource, /name="SocialPostDetail" getComponent=\{loadSocialPostDetailScreen\}/);
});

test("profile social post detail shows a continuous feed of the selected collection", () => {
  const source = read("src/app/screens/profile/SocialPostDetailScreen.tsx");

  assert.match(source, /route\.params/);
  assert.match(source, /postId/);
  assert.match(source, /orderedPosts/);
  assert.match(source, /selectedPost/);
  assert.match(source, /data=\{orderedPosts\}/);
  assert.match(source, /scroll=\{false\}/);
  assert.match(source, /ZoomableMedia/);
  assert.match(source, /LinearGradient/);
  assert.match(source, /styles\.imageContainer/);
  assert.match(source, /styles\.detailRow/);
  assert.match(source, /styles\.inlineActionsRow/);
  assert.match(source, /visiblePosts/);
  assert.match(source, /toggleLike\(feedPost\.id\)/);
  assert.match(source, /toggleSave\(feedPost\.id\)/);
  assert.match(source, /marginBottom: spacing\[12\]/);
  assert.doesNotMatch(source, /IconButton/);
  assert.doesNotMatch(source, /More liked posts/);
  assert.doesNotMatch(source, /More saved posts/);
  assert.doesNotMatch(source, /<ScrollView[\s\S]*horizontal/);
  assert.doesNotMatch(source, /styles\.bottomPost/);
});

test("profile social grid removes side padding for edge-to-edge tiles", () => {
  const gridSource = read("src/app/screens/profile/SocialGridScreen.tsx");

  assert.match(
    gridSource,
    /<Screen[\s\S]*fullWidth[\s\S]*contentContainerStyle=\{\{ paddingHorizontal: 0 \}\}/,
  );
  assert.match(gridSource, /const itemWidth = width \/ COLUMN_COUNT/);
  assert.match(gridSource, /width: itemWidth/);
});

test("profile social post detail shows only stored social counts", () => {
  const detailSource = read("src/app/screens/profile/SocialPostDetailScreen.tsx");
  const storeSource = read("src/store/useSocialStore.ts");

  assert.match(detailSource, /interaction\.likeCount > 0/);
  assert.match(detailSource, /likeCount: 0/);
  assert.match(detailSource, /commentCount: 0/);
  assert.doesNotMatch(detailSource, /likeCount: primaryDish\?\.reviews\.length/);
  assert.doesNotMatch(detailSource, /commentCount: primaryDish\?\.reviews\.length/);
  assert.match(storeSource, /const seededCommentCount = item\.commentCount \?\? 0/);
  assert.match(storeSource, /const seededLikes = item\.likeCount \?\? 0/);
  assert.doesNotMatch(storeSource, /item\.cravingCount \?\? seededComments/);
  assert.doesNotMatch(storeSource, /reviews\?\.length \?\? 0/);
});
