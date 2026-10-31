import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("profile home contract: quick access lives behind the header menu", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(source, /headerRight=\{/);
  // A native menu (UIMenu on iOS) with a web dropdown fallback, opened from a "more" symbol.
  assert.match(source, /<OverflowMenu/);
  assert.match(source, /<AppSymbol name="moreActions"/);
  assert.match(source, /openAccessibilityLabel="Close quick access"/);
  assert.match(source, /`Open quick access, \$\{followRequestLabel\}`/);
  assert.match(source, /: "Open quick access"/);
  assert.match(source, /if \(!FEATURE_FLAGS\.directMessagesEnabled\)/);
  assert.match(source, /recipients=\{directMessagesEnabled \? shareRecipients : \[\]\}/);
  assert.match(source, /toChatShareRecipient/);
  assert.doesNotMatch(source, /ACTIVITY_MESSAGES/);
  assert.doesNotMatch(source, /Your established list-based profile/);
  assert.doesNotMatch(source, /label="Saved Content"/);
});

test("profile home contract: profile stats use dynamic profile and social store values", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const domainSource = read("src/types/domain.ts");

  assert.match(domainSource, /followersCount: number/);
  assert.match(domainSource, /followingCount: number/);
  // Follower and following counts come from the server and open the lists (R3 PROF-2: the
  // lists hold Remove follower and Find people). No Stalls tile (visited stalls are on Achievements).
  assert.match(source, /getFollowCounts\(profile\.id\)/);
  assert.match(source, /key: "followers",[\s\S]*?navigation\.navigate\("Followers"\)/);
  assert.match(source, /key: "following",[\s\S]*?navigation\.navigate\("Following"\)/);
  assert.doesNotMatch(source, /mergeFollowerNames|localFollowerCount|localFollowingCount/);
  // Reviews count real reviews from the server.
  assert.match(source, /ownReviews === null\s*\? null/);
  assert.doesNotMatch(source, /label="Stalls"/);
  // One flat stat row: Saved, Reviews, Followers, Following (no per-stat icons).
  assert.match(source, /<ProfileStatRow stats=\{stats\} testID="profile-follow-counts" \/>/);
  assert.match(source, /key: "reviews",[\s\S]*?onPress: handleReviewsCardPress/);
  assert.match(source, /key: "saved",[\s\S]*?navigation\.navigate\("Favourites"\)/);
  assert.match(source, /<AppText variant="h1" style=\{\{ color: palette\.orange \}\}>/);
  assert.match(
    source,
    /<AppText variant="h1" numberOfLines=\{2\} style=\{\{ color: palette\.text \}\}>/,
  );
  assert.match(
    read("src/components/profile/ProfileStatRow.tsx"),
    /value === null \? \(\s*<Skeleton[\s\S]*?<AppText variant="h2" style=\{\{ color: palette\.text \}\}>\s*\{value\}\s*<\/AppText>/,
  );
  assert.match(source, /const headerActionSize = spacing\[8\] \+ spacing\[2\.5\]/);
  assert.match(source, /height: headerActionSize/);
  assert.match(source, /width: headerActionSize/);
  assert.match(source, /height: spacing\[20\]/);
  assert.match(source, /width: spacing\[20\]/);
  assert.doesNotMatch(source, /fontSize: 24/);
  assert.doesNotMatch(source, /fontSize: 18/);
  assert.doesNotMatch(source, /top: 34/);
  assert.doesNotMatch(source, /height: 80/);
  assert.doesNotMatch(source, /last 5 reviews/);
});

test("profile home contract: Palate Fingerprint plots all six dimensions and keeps saved dishes linked", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  const radar = read("src/components/profile/TasteRadar.tsx");

  assert.match(source, /<TasteRadar vector=\{profile\.tasteVector\}/);
  assert.match(radar, /TASTE_DIMENSIONS\.map\(\(\{ key, label \}\) => \(/);
  assert.match(radar, /Math\.max\(0, Math\.min\(10, vector\[key\]\)\)/);
  // Saved dishes, stalls and lists live behind the one Saved stat.
  assert.match(source, /label: "Saved"/);
  assert.doesNotMatch(source, /label="Favourites"|>Favourites</);
});

test("profile home contract: web review actions remain separate and radar SVG is accessible", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const card = read("src/components/profile/ProfileReviewCard.tsx");

  // The shared card keeps the open-dish Pressable and the "..." menu as siblings, so a screen
  // reader can reach both.
  assert.match(source, /<ProfileReviewCard[\s\S]*?<OwnReviewMenuButton/);
  assert.match(
    card,
    /<Pressable[\s\S]*?accessibilityLabel=\{`Review of[\s\S]*?<\/Pressable>\s*\) : \([\s\S]*?\{menu\}/,
  );
  assert.match(
    read("src/components/profile/TasteRadar.tsx"),
    /accessible=\{Platform\.OS === "web" \? undefined : true\}/,
  );
});

test("Stitch profile surfaces use account data and preserve their destinations", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.doesNotMatch(source, /SINGAPORE FOODIE PASSPORT/);
  assert.doesNotMatch(source, /FollowRequestsRow/);
  assert.match(source, /id: "follow-requests"/);
  assert.match(source, /subtitle: followRequestCount \? `\$\{followRequestCount\} waiting`/);
  // Saved is the one entry point to dishes, stalls and lists; the old Collections and Badges
  // tiles are gone, and the Passport card shows the stamps.
  assert.doesNotMatch(source, /label="Collections"|label="Badges"/);
  assert.match(source, /<PassportCard/);
  assert.match(source, /navigation\.navigate\("Settings"\)/);
  assert.match(source, /socialFeedEnabled \? "Recent activity" : "Your reviews"/);
  assert.match(source, /onPress=\{handleReviewsCardPress\}/);
  assert.match(
    source,
    /const hasAccountProfile = isAuthenticated && profile\.id !== "guest-user";/,
  );
});

test("profile home contract: a signed-out Profile tab shows a sign-in view instead of bouncing to Login", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  // The tab navigator mounts Profile in the background, so nothing may redirect on mount.
  assert.match(source, /const isFocused = useIsFocused\(\);/);
  assert.match(source, /if \(!isAuthenticated\) \{[\s\S]*?testID="profile-signed-out"/);
  assert.match(
    source,
    /setReturnRoute\("Profile"\);\s*rootNavigation\.navigate\("AuthStack", \{ screen: "Login" \}\)/,
  );
  assert.doesNotMatch(source, /mode !== "self"/);
});

test("profile home contract: merchant entry loads on sign-in and switching mode keeps the account", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(source, /\.merchant\.getMerchantAccount\(\)/);
  assert.match(source, /setMerchantAccount\(account\)/);
  assert.match(source, /title: "Merchant dashboard"/);
  assert.match(source, /title: "Hungry for Business"/);

  for (const file of [
    "src/app/screens/merchant/MerchantProfileScreen.tsx",
    "src/app/screens/merchant/MerchantSettingsScreen.tsx",
  ]) {
    const merchantSource = read(file);
    assert.match(merchantSource, /Switch to customer mode/);
    assert.doesNotMatch(merchantSource, /clearMerchant/);
  }
});

test("profile home contract: customer surfaces read the merchant mode flag, not account presence", () => {
  const store = read("src/store/useMerchantStore.ts");
  assert.match(store, /return state\.merchantModeActive && state\.account !== null;/);
  // The mode is remembered across restarts, but only as a launch restore: the session must confirm
  // the merchant account before the Merchant Centre opens and activates it.
  assert.match(
    store,
    /merchantModeActive: state\.merchantModeActive \|\| state\.merchantModeRestore === "restore"/,
  );
  assert.match(
    store,
    /merchantModeActive: false,\s*merchantModeRestore: rememberedMerchantMode === true \? "checking" : "none"/,
  );

  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  // Activated on focus, not mount, so a preloaded Merchant Centre never flips the customer app.
  assert.match(tabs, /navigation\.addListener\("focus", \(\) => setMerchantModeActive\(true\)\)/);
  // Leaving the Merchant Centre (its route gone from the stack) ends the mode; an app teardown
  // that unmounts it while still on the stack keeps the remembered mode.
  assert.match(
    tabs,
    /const stillOnStack = navigation\.getState\(\)\.routes\.some\(\(route\) => route\.key === routeKey\);\s*if \(!stillOnStack\) setMerchantModeActive\(false\);/,
  );
  assert.doesNotMatch(tabs, /useEffect\(\(\) => \{\s*setMerchantModeActive\(true\);/);

  for (const file of [
    "src/app/screens/merchant/MerchantProfileScreen.tsx",
    "src/app/screens/merchant/MerchantSettingsScreen.tsx",
  ]) {
    assert.match(read(file), /setMerchantModeActive\(false\)/);
  }

  for (const file of [
    "src/hooks/useAppBootstrap.ts",
    "src/app/navigation/RootNavigator.tsx",
    "src/app/screens/home/HomeFeedScreen.tsx",
    "src/app/screens/discover/DiscoverHomeScreen.tsx",
    "src/app/screens/post/PostComposerScreen.tsx",
    "src/app/screens/post/PostComposerScreenV2.tsx",
    "src/features/post/components/PostTab.tsx",
    "src/features/post/components/SharedMetadata.tsx",
    "src/features/post/components/StatusOverlay.tsx",
    "src/features/post/components/ReviewTab.tsx",
    "src/features/post/components/LivePreviewSheet.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /const isMerchantMode = useMerchantStore\(isMerchantModeActive\);/, file);
    assert.doesNotMatch(source, /isMerchantMode = useMerchantStore\(\(state\) =>/, file);
  }
});

test("profile home contract: a remembered merchant mode reopens the Merchant Centre after the session check", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  // The merchant account loads with the session, not only when Profile mounts.
  assert.match(bootstrap, /getHungryService\(\)\.merchant\.getMerchantAccount\(\)/);
  assert.match(bootstrap, /if \(!isAuthenticated \|\| !FEATURE_FLAGS\.merchantCentreEnabled\) \{/);
  assert.match(bootstrap, /merchantStore\.resolveMerchantModeRestore\(false\);/);
  assert.match(bootstrap, /resolveMerchantModeRestore\(hasMerchantAccount\)/);

  const splash = read("src/app/screens/SplashScreen.tsx");
  assert.match(
    splash,
    /if \(merchantModeRestore === "checking" && hasCompletedOnboarding\) \{\s*return;\s*\}/,
  );
  // Onboarding first: the remembered mode is cleared, not left pending.
  assert.match(
    splash,
    /if \(!hasCompletedOnboarding\) \{[^}]*dismissMerchantModeRestore\(\);\s*navigation\.reset/,
  );
  assert.match(
    splash,
    /if \(merchantModeRestore === "restore"\) \{\s*navigation\.reset\(\{\s*index: 0,\s*routes: \[\{ name: "MerchantTabs"/,
  );

  const root = read("src/app/navigation/RootNavigator.tsx");
  assert.match(root, /if \(merchantModeRestore === "restore"\) \{\s*navigationRef\.resetRoot/);
  // A deep link or tapped notification opens past Splash: the remembered mode is cleared.
  assert.match(
    root,
    /const launchRoute = navigationRef\.getRootState\(\)\?\.routes\[0\]\?\.name;\s*if \(launchRoute !== "Splash" && launchRoute !== "DeveloperLauncher"\) \{\s*setLaunchSkippedSplash\(true\);/,
  );
  assert.match(
    root,
    /if \(launchSkippedSplash && merchantModeRestore !== "none"\) \{\s*dismissMerchantModeRestore\(\);/,
  );

  // Sign-out and account switch reset the whole merchant store, including the remembered mode.
  const session = read("src/store/useSessionStore.ts");
  assert.match(session, /getMerchantStoreState\(\)\.clearMerchant\(\);/);
  const store = read("src/store/useMerchantStore.ts");
  assert.match(
    store,
    /clearMerchant: \(\) => \{\s*if \(!useMerchantStore\.persist\.hasHydrated\(\)\) clearedBeforeHydration = true;\s*set\(INITIAL_STATE\);/,
  );
  assert.match(store, /merchantModeActive: false,\s*merchantModeRestore: "none",\s*\};/);
});

test("profile home contract: account reads wait for a real profile id, not the guest placeholder", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(
    source,
    /const hasAccountProfile = isAuthenticated && profile\.id !== "guest-user";/,
  );
  // Posts, reviews and follow requests all send profile.id to the server as a uuid.
  // ...as do the stall-submission, follow-count and gamification loads.
  // ...and the pull-to-refresh handler, which re-reads the same three.
  assert.equal(source.match(/!hasAccountProfile/g)?.length, 6);
});
