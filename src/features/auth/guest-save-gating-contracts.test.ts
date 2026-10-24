import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

// The app is sign-in only. These guards stay as defence in depth (a session can
// expire mid-use), and save actions keep their sign-in prompts.
const root = path.resolve(__dirname, "../../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("useRequireAccount asks a guest to sign in and returns them afterwards", () => {
  const hook = read("src/features/auth/useRequireAccount.ts");
  assert.match(hook, /if \(isAuthenticated\) return true;/);
  assert.match(hook, /setReturnRoute\(returnRoute\)/);
  assert.match(hook, /openSignInPrompt\(\{ title: [^}]+\}, onSignedIn\)/);
});

test("one sign-in sheet opens the shared Login and finishes the guest's action once", () => {
  const sheet = read("src/features/auth/SignInPromptSheet.tsx");
  assert.match(
    sheet,
    /navigationRef\.navigate\("AuthStack", \{ screen: "Login", params: \{ title \} \}\)/,
  );
  assert.match(
    sheet,
    /if \(!isAuthenticated\) return;\s*const action = useUIStore\.getState\(\)\.takePendingAuthAction\(\);/,
  );
  // "Not now" drops the action and the return route.
  assert.match(sheet, /if \(!goingToSignIn\.current\) \{\s*ui\.takePendingAuthAction\(\);/);
  assert.match(read("src/app/AppBody.tsx"), /<SignInPromptSheet \/>/);
  // Login has no guest "Not now" exit: the app is sign-in only.
  assert.doesNotMatch(read("src/app/screens/auth/LoginScreen.tsx"), /continueAsGuest/);

  const ui = read("src/store/useUIStore.ts");
  assert.match(ui, /pendingAuthAction: \(\(\) => void\) \| null;/);
  // The slot holds a function, so it must never be persisted.
  assert.doesNotMatch(ui.slice(ui.indexOf("partialize")), /pendingAuthAction|signInPrompt/);

  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  assert.match(dish, /`Sign in to save \$\{dish\.name\}`[\s\S]*?saveDishAfterSignIn\(dish\)/);
  const finish = read("src/features/auth/finishGuestAction.ts");
  // Finishing never toggles an existing save/like/follow off.
  assert.match(
    finish,
    /if \(profile\.profile\.favouriteDishIds\.includes\(dish\.id\)\) (return true|continue);/,
  );
  assert.match(finish, /if \(!social\.interactions\[postId\]\?\.liked\)/);
});

test("guest-reachable follow, like and comment taps prompt sign-in first", () => {
  const homeFeed = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(
    homeFeed,
    /!requireAuthForFollow\([\s\S]*?followUserAfterSignIn\(followTargetId\)[\s\S]*?toggleFollow\(followTargetId\)/,
  );
  // The comment sheet closes before sign-in opens, so it is not left on top.
  assert.match(
    homeFeed,
    /handlePostCommentOrReply = useCallback\(\(\) => \{[\s\S]*?commentsSheetRef\.current\?\.dismiss\(\);\s*requireAccount\("Sign in to comment\."/,
  );

  const reviewFeed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  // Round 6: the Reviews grid has no like button; only reporting needs a sign-in there.
  assert.doesNotMatch(reviewFeed, /toggleLike|likePostAfterSignIn/);
  assert.match(reviewFeed, /requireAccountForReviewAction\("Sign in to report reviews\."\)/);
  // Review cards no longer have comments (round 2), so there is nothing to gate there.
  assert.doesNotMatch(reviewFeed, /ReviewCommentsSheet/);
  const commentsSheet = read("src/components/social/ReviewCommentsSheet.tsx");
  assert.match(commentsSheet, /if \(onBeforeSend && !onBeforeSend\(\)\) return;/);

  const userProfile = read("src/app/screens/profile/UserProfileContent.tsx");
  assert.match(userProfile, /followPress\(\{ userId: resolvedAuthorId, name: authorName/);
  // The shared follow press (profile and follower lists) holds the sign-in gate.
  assert.match(
    read("src/features/profile/useFollowPress.ts"),
    /requireAccount\(\s*`Sign in to follow \$\{name\}`[\s\S]*?followUserAfterSignIn\(userId\)[\s\S]*?toggleFollow\(userId\)/,
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
  // Favourites refuse a signed-out caller (for example after session expiry).
  assert.match(
    profile,
    /toggleFavourite: async \(dish\) => \{[\s\S]*?if \(!session\.isAuthenticated\) \{[\s\S]*?reason: "signed_out"/,
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

  // Onboarding taste is held as a provisional migration and written to the
  // account once it signs in (the app is sign-in only, so this is the pre-auth quiz).
  // An account with saved taste is recalibrated toward the answers, never
  // overwritten or ignored; diet restrictions and allergies are unioned.
  const apply = read("src/features/auth/applySignedInProfile.ts");
  assert.match(apply, /return profile\.id === "guest-user";/);
  assert.match(
    apply,
    /if \(hasNoSavedTaste\(serverProfile\)\) return provisional\.tasteProfile;\s*return recalibrateTasteProfile\(savedTasteProfile\(serverProfile\), provisional\.tasteProfile\);/,
  );
  assert.match(
    apply,
    /mergeDietaryPreferences\(serverProfile\.dietaryPreferences, provisional\.dietaryPreferences\)/,
  );
  assert.match(apply, /operations\.updateTasteProfile\(resolvedTasteProfile\)/);
  for (const screen of [
    "src/app/screens/auth/LoginScreen.tsx",
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/auth/EmailVerificationScreen.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    assert.match(read(screen), /applySignedInProfile\(/, `${screen} must merge guest taste`);
  }
});

test("search and browse load only for a signed-in user; the taste signal too", () => {
  const search = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.match(search, /if \(!isAuthenticated\) return;\s*const startedAt = Date\.now\(\);/);
  assert.match(search, /if \(initialQueryRecordedRef\.current\) return;/);
  assert.match(search, /recordTaste: isAuthenticated && !fromDiscoverChip/);
});

test("a guest swipe-right on Crave asks to sign in instead of saving", () => {
  const crave = read("src/app/screens/discover/CraveScreen.tsx");
  assert.match(
    crave,
    /const swipeRight = \(\) => \{\s*if \(!isAuthenticated\) \{[\s\S]*?navigation\.navigate\("AuthStack", \{ screen: "Login" \}\);\s*return;/,
  );
});
