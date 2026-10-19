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
  assert.match(source, /<Menu color=\{palette\.text\} size=\{22\}/);
  assert.match(
    source,
    /accessibilityLabel=\{menuOpen \? "Close quick access" : "Open quick access"\}/,
  );
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
  // Follow counts come only from the server; never invented from feed/comment authors
  // or inflated with local follow maps.
  assert.match(source, /\.social\.getFollowCounts\(profile\.id\)/);
  assert.match(source, /value=\{profileFollowCounts\?\.followersCount \?\? null\}/);
  assert.match(source, /value=\{profileFollowCounts\?\.followingCount \?\? null\}/);
  assert.doesNotMatch(source, /mergeFollowerNames|localFollowerCount|localFollowingCount/);
  assert.match(source, /value=\{profile\.stats\.dishesReviewed\}/);
  assert.match(source, /label="Followers"/);
  assert.match(source, /label="Following"/);
  assert.match(source, /label="Reviews"[\s\S]*<PencilLine size=\{14\}/);
  assert.match(source, /label="Stalls"[\s\S]*<Utensils size=\{14\}/);
  assert.match(source, /label="Saved"[\s\S]*<Bookmark size=\{14\}/);
  assert.match(source, /<AppText variant="h1" style=\{\{ color: palette\.orange \}\}>/);
  assert.match(
    source,
    /<AppText\s+variant="h1"\s+numberOfLines=\{1\}\s+adjustsFontSizeToFit\s+minimumFontScale=\{0\.78\}[\s\S]*style=\{\{ color: palette\.text \}\}/,
  );
  assert.match(
    source,
    /value === null \? \(\s*<Skeleton[\s\S]*?<AppText variant="h3" style=\{\{ color: palette\.text \}\}>\s*\{value\}\s*<\/AppText>/,
  );
  assert.match(source, /const headerActionSize = spacing\[8\] \+ spacing\[2\.5\]/);
  assert.match(source, /height: headerActionSize/);
  assert.match(source, /width: headerActionSize/);
  assert.match(source, /top: spacing\[8\] \+ spacing\[0\.5\]/);
  assert.match(source, /height: spacing\[20\]/);
  assert.match(source, /width: spacing\[20\]/);
  assert.doesNotMatch(source, /fontSize: 24/);
  assert.doesNotMatch(source, /fontSize: 18/);
  assert.doesNotMatch(source, /top: 34/);
  assert.doesNotMatch(source, /height: 80/);
  assert.doesNotMatch(source, /last 5 reviews/);
});

test("profile home contract: Taste Fingerprint shows all six dimensions and Saved naming", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  assert.match(source, /TASTE_DIMENSIONS\.map\(\(dimension\) => \(\s*<TasteBar/);
  assert.match(source, /value=\{profile\.tasteVector\[dimension\.key\]\}/);
  assert.match(source, /label="Saved"/);
  assert.doesNotMatch(source, /label="Favourites"|>Favourites</);
});

test("profile home contract: a preloaded Profile tab never bounces guests to Login", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");

  // The tab navigator mounts Profile in the background, so the guest redirect must wait for focus.
  assert.match(source, /const isFocused = useIsFocused\(\);/);
  assert.match(source, /if \(mode !== "self" \|\| isAuthenticated \|\| !isFocused\) \{/);
});

test("profile home contract: merchant entry loads on sign-in and switching mode keeps the account", () => {
  const source = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(source, /\.merchant\.getMerchantAccount\(\)/);
  assert.match(source, /setMerchantAccount\(account\)/);
  assert.match(source, /label="Merchant Dashboard"/);
  assert.match(source, /label="Hungry for Business"/);

  for (const file of [
    "src/app/screens/merchant/MerchantProfileScreen.tsx",
    "src/app/screens/merchant/MerchantSettingsScreen.tsx",
  ]) {
    const merchantSource = read(file);
    assert.match(merchantSource, /Switch to Customer Mode/);
    assert.doesNotMatch(merchantSource, /clearMerchant/);
  }
});

test("profile home contract: customer surfaces read the merchant mode flag, not account presence", () => {
  const store = read("src/store/useMerchantStore.ts");
  assert.match(store, /return state\.merchantModeActive && state\.account !== null;/);
  // The mode flag must not survive a restart, or the customer app reopens in merchant mode.
  assert.doesNotMatch(store, /merchantModeActive: state\.merchantModeActive/);

  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  // Activated on focus, not mount, so a preloaded Merchant Centre never flips the customer app.
  assert.match(tabs, /navigation\.addListener\("focus", \(\) => setMerchantModeActive\(true\)\)/);
  assert.match(tabs, /unsubscribe\(\);\s*setMerchantModeActive\(false\);/);
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
    "src/app/screens/review/ReviewScreen.tsx",
    "src/app/screens/review/QuickReviewSheet.tsx",
    "src/app/screens/review/ReviewSuccessModal.tsx",
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
