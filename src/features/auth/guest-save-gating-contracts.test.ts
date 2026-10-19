import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

// Product rule: guests can browse stall data, but anything that saves needs an account.
const root = path.resolve(__dirname, "../../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("useRequireAccount asks a guest to sign in and returns them afterwards", () => {
  const hook = read("src/features/auth/useRequireAccount.ts");
  assert.match(hook, /if \(isAuthenticated\) return true;/);
  assert.match(hook, /setReturnRoute\(returnRoute\)/);
  assert.match(hook, /navigation\.navigate\("AuthStack", \{ screen: "Login" \}\)/);
});

test("guest-reachable follow, like and comment taps prompt sign-in first", () => {
  const homeFeed = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(
    homeFeed,
    /if \(!requireAuthForFollow\(\)\) return;[\s\S]*toggleFollow\(followTargetId\)/,
  );
  // The comment sheet closes before sign-in opens, so it is not left on top.
  assert.match(
    homeFeed,
    /handlePostCommentOrReply = useCallback\(\(\) => \{[\s\S]*?commentsSheetRef\.current\?\.dismiss\(\);\s*requireAccount\("Sign in to comment\."/,
  );

  const reviewFeed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.match(
    reviewFeed,
    /reviewReactionsEnabled &&\s*requireAccountForReviewAction\("Sign in to like reviews\."\)/,
  );
  assert.match(reviewFeed, /onBeforeSend=\{requireAccountForComment\}/);
  assert.match(
    reviewFeed,
    /requireAccountForComment = useCallback\(\(\) => \{[\s\S]*?commentsSheetRef\.current\?\.dismiss\(\);\s*return requireAccountForReviewAction\("Sign in to comment\."\)/,
  );
  const commentsSheet = read("src/components/social/ReviewCommentsSheet.tsx");
  assert.match(commentsSheet, /if \(onBeforeSend && !onBeforeSend\(\)\) return;/);

  const userProfile = read("src/app/screens/profile/UserProfileContent.tsx");
  assert.match(
    userProfile,
    /requireAccount\("Sign in to follow people\."[\s\S]*?toggleFollow\(resolvedAuthorId\)/,
  );
});

test("social writes and taste signals never reach the server for a guest", () => {
  const social = read("src/store/useSocialStore.ts");
  for (const action of [
    "toggleLike: (postId) => {",
    "toggleSave: (postId) => {",
    "toggleFollow: (userId: string) => {",
    'incrementShare: (postId, channel = "in_app") => {',
    "addComment: (postId, comment) => {",
    "addReply: (postId, reply) => {",
  ]) {
    assert.ok(
      social.includes(`${action}\n        if (!isSignedIn()) return;`),
      `${action} must return early for a guest`,
    );
  }

  const profile = read("src/store/useProfileStore.ts");
  assert.match(
    profile,
    /function persistTasteInteraction[\s\S]*?!getSessionStoreState\(\)\.isAuthenticated\s*\) \{\s*return;/,
  );
  assert.match(
    profile,
    /toggleFavourite: \(dish\) => \{[\s\S]*?if \(!getSessionStoreState\(\)\.isAuthenticated\) \{/,
  );
});

test("a guest's taste quiz stays on the device and uploads on sign-in", () => {
  const profile = read("src/store/useProfileStore.ts");
  // Quiz results only sync when the profile belongs to the signed-in account.
  assert.match(
    profile,
    /setTasteProfile: \(tasteProfile\) => \{[\s\S]*?if \(!shouldSyncAuthenticatedProfile\(optimisticProfile\)\) \{\s*return;/,
  );
  assert.match(profile, /partialize: \(state\) => \(\{\s*profile: state\.profile,\s*tasteProfile:/);

  const apply = read("src/features/auth/applySignedInProfile.ts");
  assert.match(apply, /profile\.id !== "guest-user"/);
  assert.match(apply, /getHungryService\(\)\.profile\.updateTasteProfile\(guestTasteProfile\)/);
  for (const screen of [
    "src/app/screens/auth/LoginScreen.tsx",
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/auth/EmailVerificationScreen.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    assert.match(read(screen), /applySignedInProfile\(/, `${screen} must merge guest taste`);
  }
});

test("guests can search and browse the catalog; only the search taste signal is skipped", () => {
  const search = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.doesNotMatch(search, /Sign in to browse the full directory/);
  assert.doesNotMatch(search, /if \(!isAuthenticated\) return;\s*const version/);
  assert.match(search, /if \(!isAuthenticated \|\| initialQueryRecordedRef\.current\) return;/);
});

test("a guest swipe-right on Crave asks to sign in instead of saving", () => {
  const crave = read("src/app/screens/discover/CraveScreen.tsx");
  assert.match(
    crave,
    /const swipeRight = \(\) => \{\s*if \(!isAuthenticated\) \{[\s\S]*?navigation\.navigate\("AuthStack", \{ screen: "Login" \}\);\s*return;/,
  );
});
