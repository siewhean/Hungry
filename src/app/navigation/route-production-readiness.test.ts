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

test("production route gates keep advanced surfaces behind MVP-safe flags", () => {
  const flags = read("src/constants/featureFlags.ts");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const linking = read("src/app/navigation/linking.ts");

  assert.match(flags, /prototypeRoutesEnabled/);
  assert.match(flags, /directMessagesEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /gamificationEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /collectionsEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /storiesEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /commentsEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /const merchantCentreEnabled = nonProductionSurfaceEnabled/);
  assert.match(flags, /const merchantClaimCtaEnabled = nonProductionSurfaceEnabled/);
  assert.match(flags, /oauthProvidersEnabled: nonProductionSurfaceEnabled/);
  assert.match(flags, /floorplansEnabled: false/);
  assert.match(flags, /appEnv !== "production"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.prototypeRoutesEnabled \? \(/);
  for (const routeName of ["DesignGallery", "PostComposerV2"]) {
    assert.match(rootNavigator, new RegExp(`name="${routeName}"`));
  }
  for (const removedRouteName of [
    "DiscoverV2",
    "SearchHomeV2",
    "QuickReviewV2",
    "ReviewFeedV2",
    "DishDetailV2",
    "StallDetailV2",
    "SplashV2",
    "BuildingDrillDown",
    "BuildingDrillDownV2",
    "VenueDirectory",
  ]) {
    assert.doesNotMatch(rootNavigator, new RegExp(`name="${removedRouteName}"`));
  }
  assert.doesNotMatch(rootNavigator, /QuickReview/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.merchantCentreEnabled \? \(/);
  assert.match(rootNavigator, /name="MerchantTabs"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.merchantClaimCtaEnabled \? \(/);
  assert.match(rootNavigator, /name="MerchantClaimExplainer"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.directMessagesEnabled \? \(/);
  assert.match(rootNavigator, /name="ChatDetail"/);
  assert.match(rootNavigator, /name="DirectMessages"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.storiesEnabled \? \(/);
  assert.match(rootNavigator, /name="StoryViewer"/);
  assert.match(rootNavigator, /name="AddStory"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.gamificationEnabled \? \(/);
  assert.match(rootNavigator, /name="PassportScreen"/);
  assert.match(rootNavigator, /name="MissionsScreen"/);
  // Collections were folded into Lists (portfolios): no separate Collection routes.
  assert.doesNotMatch(rootNavigator, /name="Collection(List|Detail)"/);
  assert.match(
    rootNavigator,
    /FEATURE_FLAGS\.portfoliosEnabled \? \([\s\S]*name="PortfolioPublicView"/,
  );
  assert.match(
    rootNavigator,
    /FEATURE_FLAGS\.prototypeRoutesEnabled \? \([\s\S]*name="AdminPortfolioFlags"/,
  );
  assert.match(linking, /FEATURE_FLAGS\.merchantCentreEnabled/);
  assert.match(linking, /FEATURE_FLAGS\.portfoliosEnabled/);
  assert.match(linking, /PortfolioPublicView/);
  assert.match(linking, /MerchantTabs/);
});

test("floorplan screens are removed while floorplans stay hard-off", () => {
  const mapZoom = read("src/app/screens/discover/MapZoomedInScreen.tsx");
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");

  assert.doesNotMatch(mapZoom, /navigation\.navigate\("VenueDirectory"/);
  assert.doesNotMatch(developerLauncher, /BuildingDrillDown/);
});

test("signed-out app entry opens the app as a guest while public routes stay unprotected", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const splash = read("src/app/screens/SplashScreen.tsx");
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const protectedRoutes = protectedRoutesBlock(rootNavigator);

  for (const publicRoute of [
    "MainTabs",
    "SearchHome",
    "SearchResults",
    "BrowseDishes",
    "BrowseStalls",
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
  // No login wall: new users go to onboarding, returning signed-out users browse as guests.
  assert.doesNotMatch(splash, /name: "AuthStack"/);
  assert.match(
    splash,
    /if \(!hasCompletedOnboarding\) \{[\s\S]*name: "OnboardingStack"[\s\S]*screen: "OnboardingWelcome"/,
  );
  assert.match(splash, /name: "MainTabs"[\s\S]*params: \{ screen: "Home" \}/);
  assert.match(profileHome, /setReturnRoute\("Profile"\)/);
  assert.match(
    profileHome,
    /rootNavigation\.reset\(\{[\s\S]*name: "AuthStack"[\s\S]*screen: "Login"/,
  );
  assert.doesNotMatch(profileHome, /Unlock your taste profile|Sign In \/ Create Account/);
  assert.match(
    rootNavigator,
    /if \(currentTopRoute === "OnboardingStack" && hasCompletedOnboarding\) \{\s*navigateHome\(\);\s*\}/,
  );
  assert.match(rootNavigator, /const isDeveloperMode = useMerchantStore/);
  assert.match(rootNavigator, /const isMerchantMode = useMerchantStore/);
  assert.match(
    rootNavigator,
    /currentTopRoute === "DeveloperLauncher"[\s\S]*isAuthenticated[\s\S]*hasCompletedOnboarding[\s\S]*!isDeveloperMode[\s\S]*!isMerchantMode[\s\S]*navigateHome\(\)/,
  );
  assert.match(
    developerLauncher,
    /const resetToSignedOut = \(\) => \{[\s\S]*name: "AuthStack"[\s\S]*screen: "Login"/,
  );
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
  // Shared post links open for visitors; the screen gates like/save itself.
  assert.doesNotMatch(protectedRoutes, /"ActivityPostDetail"/);

  assert.match(rootNavigator, /setReturnRoute\(/);
  assert.match(rootNavigator, /navigationRef\.resetRoot\(\{[\s\S]*name: "AuthStack"/);
  const rootReturnRestore = rootNavigator.slice(
    rootNavigator.indexOf("else if (isRootRouteName(returnRoute))"),
    rootNavigator.indexOf(
      "} else {",
      rootNavigator.indexOf("else if (isRootRouteName(returnRoute))"),
    ),
  );
  assert.match(rootReturnRestore, /index: 1/);
  assert.match(rootReturnRestore, /name: "MainTabs", params: \{ screen: "Home" \}/);
  assert.match(rootReturnRestore, /name: returnRoute/);
  const parameterizedRootReturnRestore = rootNavigator.slice(
    rootNavigator.indexOf("else if (isRootRouteName(returnRoute.name))"),
    rootNavigator.indexOf(
      "} else {",
      rootNavigator.indexOf("else if (isRootRouteName(returnRoute.name))"),
    ),
  );
  assert.match(parameterizedRootReturnRestore, /index: 1/);
  assert.match(parameterizedRootReturnRestore, /name: "MainTabs", params: \{ screen: "Home" \}/);
  assert.match(
    parameterizedRootReturnRestore,
    /name: returnRoute\.name, params: returnRoute\.params/,
  );
  assert.match(tabs, /setReturnRoute\(\{ name: "Post" \}\)/);
});
