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

test("production route gates expose audited v1 surfaces and hide prototypes and floorplans", () => {
  const flags = read("src/constants/featureFlags.ts");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.match(flags, /prototypeRoutesEnabled/);
  assert.match(flags, /directMessagesEnabled: true/);
  assert.match(flags, /gamificationEnabled: true/);
  assert.match(flags, /collectionsEnabled: true/);
  assert.match(flags, /storiesEnabled: true/);
  assert.match(flags, /commentsEnabled: true/);
  assert.match(flags, /const merchantCentreEnabled = true/);
  assert.match(flags, /oauthProvidersEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /floorplansEnabled: false/);
  assert.match(flags, /appEnv !== "production"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.prototypeRoutesEnabled \? \(/);
  for (const routeName of [
    "DishDetailV2",
    "StallDetailV2",
    "BuildingDrillDownV2",
    "SplashV2",
    "DesignGallery",
    "VenueDirectory",
  ]) {
    assert.match(rootNavigator, new RegExp(`name="${routeName}"`));
  }
  for (const removedRouteName of ["DiscoverV2", "SearchHomeV2", "QuickReviewV2", "ReviewFeedV2"]) {
    assert.doesNotMatch(rootNavigator, new RegExp(`name="${removedRouteName}"`));
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
  assert.match(rootNavigator, /FEATURE_FLAGS\.floorplansEnabled \? \(/);
  assert.match(rootNavigator, /name="BuildingDrillDown"/);
  assert.match(rootNavigator, /name="BuildingDrillDownV2"/);
  assert.match(rootNavigator, /name="VenueDirectory"/);
});

test("floorplan entry points are hidden behind the floorplans flag", () => {
  const mapZoom = read("src/app/screens/discover/MapZoomedInScreen.tsx");
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");

  assert.match(mapZoom, /FEATURE_FLAGS\.floorplansEnabled \? \(/);
  assert.match(mapZoom, /navigation\.navigate\("VenueDirectory"/);
  assert.match(developerLauncher, /FEATURE_FLAGS\.floorplansEnabled \? \(/);
  assert.match(developerLauncher, /navigation\.navigate\("BuildingDrillDownV2"/);
  assert.match(developerLauncher, /Floorplan routes are disabled for this build\./);
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
