import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function protectedRoutesBlock(source: string): string {
  const match = source.match(
    /const PROTECTED_ROOT_ROUTES = new Set<RootRouteName>\(\[([\s\S]*?)\]\);/,
  );
  assert.ok(match, "RootNavigator should declare an explicit protected root route list");
  return match[1];
}

test("production route gates hide prototypes, merchant centre, social, and gamification surfaces", () => {
  const flags = read("src/constants/featureFlags.ts");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.match(flags, /prototypeRoutesEnabled/);
  assert.match(flags, /gamificationEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /collectionsEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /storiesEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /commentsEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /appEnv !== "production"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.prototypeRoutesEnabled \? \(/);
  for (const routeName of [
    "DiscoverV2",
    "DishDetailV2",
    "SearchHomeV2",
    "StallDetailV2",
    "BuildingDrillDownV2",
    "QuickReviewV2",
    "SplashV2",
    "DesignGallery",
    "ReviewFeedV2",
    "VenueDirectory",
  ]) {
    assert.match(rootNavigator, new RegExp(`name="${routeName}"`));
  }
  assert.match(rootNavigator, /FEATURE_FLAGS\.merchantCentreEnabled \? \(/);
  assert.match(rootNavigator, /name="MerchantTabs"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.directMessagesEnabled \? \(/);
  assert.match(rootNavigator, /name="ChatDetail"/);
  assert.match(rootNavigator, /name="DirectMessages"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.storiesEnabled \? \(/);
  assert.match(rootNavigator, /name="StoryViewer"/);
  assert.match(rootNavigator, /name="AddStory"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.gamificationEnabled \? \(/);
  assert.match(rootNavigator, /name="PassportScreen"/);
  assert.match(rootNavigator, /name="MissionsScreen"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.collectionsEnabled \? \(/);
  assert.match(rootNavigator, /name="CollectionList"/);
  assert.match(rootNavigator, /name="CollectionDetail"/);
});

test("signed-out consumers can browse public discovery and detail routes", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const splash = read("src/app/screens/SplashScreen.tsx");
  const protectedRoutes = protectedRoutesBlock(rootNavigator);

  for (const publicRoute of [
    "MainTabs",
    "SearchHome",
    "SearchResults",
    "BrowseDishes",
    "BrowseStalls",
    "TasteFilter",
    "DiscoverMap",
    "MapZoomedIn",
    "DishDetail",
    "StallDetail",
    "BlogPost",
  ]) {
    assert.doesNotMatch(
      protectedRoutes,
      new RegExp(`"${publicRoute}"`),
      `${publicRoute} should remain browseable while signed out`,
    );
  }

  assert.match(
    rootNavigator,
    /const PROTECTED_MAIN_TAB_ROUTES = new Set<MainTabRouteName>\(\["Profile"\]\)/,
  );
  assert.doesNotMatch(splash, /!isAuthenticated[\s\S]*AuthStack/);
  assert.match(splash, /name: "MainTabs"[\s\S]*params: \{ screen: "Home" \}/);
});

test("protected actions preserve return routes before auth", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const protectedRoutes = protectedRoutesBlock(rootNavigator);

  for (const protectedRoute of [
    "MerchantTabs",
    "Post",
    "PostComposerV2",
    "ActivityInbox",
    "ActivityPostDetail",
    "ChatDetail",
    "DirectMessages",
    "EditProfile",
    "Favourites",
    "ReviewHistory",
    "Settings",
    "ReviewStack",
    "QuickReviewV2",
    "AddStory",
    "MusicSelection",
    "MerchantClaimExplainer",
  ]) {
    assert.match(protectedRoutes, new RegExp(`"${protectedRoute}"`));
  }

  assert.match(rootNavigator, /setReturnRoute\(/);
  assert.match(rootNavigator, /navigationRef\.resetRoot\(\{[\s\S]*name: "AuthStack"/);
  assert.match(
    tabs,
    /const composerRoute = FEATURE_FLAGS\.prototypeRoutesEnabled \? "PostComposerV2" : "Post"/,
  );
  assert.match(tabs, /setReturnRoute\(\{ name: composerRoute \}\)/);
});
