import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("your own profile never renders as a stranger's with Follow on yourself", () => {
  const screen = read("src/app/screens/profile/UserProfileScreen.tsx");
  const content = read("src/app/screens/profile/UserProfileContent.tsx");

  assert.match(screen, /route\.params\.authorId === viewerId/);
  assert.match(screen, /navigation\.popTo\("MainTabs", \{ screen: "Profile"/);
  assert.match(
    content,
    /const isSelf = Boolean\(resolvedAuthorId && resolvedAuthorId === viewerId\)/,
  );
  assert.match(content, /const canShowFollowButton = Boolean\(resolvedAuthorId\) && !isSelf/);
});

test("other profiles confirm unfollow, offer report/block, and title the active tab", () => {
  const content = read("src/app/screens/profile/UserProfileContent.tsx");

  assert.match(content, /Alert\.alert\(`Unfollow \$\{authorName\}\?`/);
  assert.match(content, /promptContentSafetyActions\(\{\s*targetType: "profile"/);
  assert.match(content, /accessibilityLabel=\{`More options for \$\{authorName\}`\}/);
  assert.match(content, /\{activeTab === "posts" \? "Posts" : "Reviews"\}/);
});

test("profile home loads once per account and recomputes passport progress separately", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.doesNotMatch(source, /loadStallInteractions\(profile\.id\)\.then/);
  assert.match(source, /loadStallSubmissions\(\)\.catch\(/);
  assert.match(
    source,
    /if \(!isAuthenticated \|\| !gamificationEnabled\) return;\s*computePassportProgress\(triedStallIds\);/,
  );
});

test("profile home shows real reviews, loading skeletons, retry, and a confirmed sign-out", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(source, /reviews\.getUserReviews\(profile\.id\)/);
  assert.doesNotMatch(source, /You reviewed this dish\./);
  assert.match(source, /!postsLoaded \? \(\s*<ProfileGridSkeleton \/>/);
  assert.match(source, /ctaLabel="Retry"/);
  // Same confirmation copy as Settings > Sign out.
  assert.match(source, /Alert\.alert\("Sign out", "You will be signed out from Hungry on this device\."/);
  assert.match(source, /accessibilityViewIsModal/);
  assert.doesNotMatch(source, /Guest User/);
  assert.match(source, /label="Edit profile"/);
  assert.match(source, /accessibilityRole="progressbar"/);
  assert.match(source, /tastePersonaSummary/);
});

test("stalls stat and visited stalls list share one source", () => {
  const home = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const visited = read("src/app/screens/profile/VisitedStallsScreen.tsx");
  const hook = read("src/features/profile/visitedStalls.ts");

  assert.match(hook, /interaction\.isTried/);
  assert.match(home, /useVisitedStallIds\(\)/);
  assert.match(visited, /useVisitedStallIds\(\)/);
  assert.match(visited, /title="Visited stalls"/);
  assert.doesNotMatch(visited, /Visited stores/);
});

test("gamification and submission stores reset on account change", () => {
  const session = read("src/store/useSessionStore.ts");

  for (const store of [
    "useFoodCredStore",
    "useMissionStore",
    "usePassportStore",
    "useStallSubmissionStore",
  ]) {
    assert.match(session, new RegExp(`${store}\\.getState\\(\\)\\._reset\\(\\)`));
  }
});

test("AddStall starts with no hours, validates input, and gates gamification", () => {
  const source = read("src/app/screens/profile/AddStallScreen.tsx");

  assert.match(source, /useState<TimeRange\[\]>\(\[\]\)/);
  assert.match(source, /SINGAPORE_POSTAL_CODE_PATTERN = \/\^\\d\{6\}\$\//);
  assert.match(source, /isHttpUrl\(deliveryLink\.trim\(\)\)/);
  assert.match(source, /addListener\("beforeRemove"/);
  assert.match(source, /if \(FEATURE_FLAGS\.gamificationEnabled\) \{\s*await Promise\.allSettled/);
  assert.doesNotMatch(source, /\{\.\.\.PanResponder\.create/);
  assert.match(source, /onAccessibilityAction=/);
});

test("review history shows only the user's own rating with one CTA", () => {
  const source = read("src/app/screens/profile/ReviewHistoryScreen.tsx");

  assert.doesNotMatch(source, /dish\?\.rating/);
  assert.equal(source.match(/label="Write another review"/g)?.length, 1);
  assert.doesNotMatch(source, /"review-history-entry"/);
  assert.match(source, /navigate\("DishDetail", \{ dishId \}\)/);
});

test("cred toast is event driven, auto-dismisses and announces", () => {
  const source = read("src/components/gamification/CredEarnedToast.tsx");

  assert.match(source, /useFoodCredStore\.subscribe/);
  assert.match(source, /setTimeout\(/);
  assert.match(source, /announceForAccessibility/);
  assert.doesNotMatch(source, /lastShownRef/);
});

test("locked passport stamps use their own category count", () => {
  const card = read("src/components/gamification/PassportStampCard.tsx");
  const screen = read("src/app/screens/profile/PassportScreen.tsx");

  assert.match(card, /stamp\.threshold - triedInCategory/);
  assert.match(screen, /triedInCategory=\{progress\?\.triedCount \?\? 0\}/);
  assert.match(screen, /trackPassportViewed\("profile"\)/);
});

test("profile sub-screens do not nest a vertical ScrollView in the shell", () => {
  for (const file of [
    "src/app/screens/profile/ProfileConnectionsScreen.tsx",
    "src/app/screens/profile/VisitedStallsScreen.tsx",
    "src/app/screens/profile/FollowedStallsScreen.tsx",
    "src/app/screens/profile/PassportScreen.tsx",
  ]) {
    assert.doesNotMatch(read(file), /<ScrollView/, file);
  }
});
