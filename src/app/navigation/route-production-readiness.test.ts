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
  // Advanced surfaces follow main: available outside production only.
  assert.match(flags, /const nonProductionSurfaceEnabled = prototypeRoutesEnabled/);
  for (const flag of [
    "directMessagesEnabled",
    "gamificationEnabled",
    "collectionsEnabled",
    "storiesEnabled",
    "commentsEnabled",
    "merchantCentreEnabled",
    "merchantClaimCtaEnabled",
    "oauthProvidersEnabled",
  ]) {
    assert.match(flags, new RegExp(`${flag}: nonProductionSurfaceEnabled`));
  }
  assert.match(flags, /floorplansEnabled: false/);
  assert.match(flags, /favouritesEnabled: true,/);
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
  for (const [flag, routeName] of [
    ["mapEnabled", "DiscoverMap"],
    ["mapEnabled", "MapZoomedIn"],
    ["postCreationEnabled", "Post"],
    ["readsEnabled", "BlogPost"],
    ["reviewCreationEnabled", "ReviewStack"],
    ["hungryWheelEnabled", "WheelStack"],
    ["activityEnabled", "ActivityInbox"],
    ["activityEnabled", "ActivityPostDetail"],
  ]) {
    assert.match(
      rootNavigator,
      new RegExp(`FEATURE_FLAGS\\.${flag} \\? \\([\\s\\S]*name="${routeName}"`),
      `${routeName} should be registered only when ${flag} is enabled`,
    );
  }
  assert.match(rootNavigator, /!FEATURE_FLAGS\.release01CoreOnly \? \([\s\S]*name="QuickBites"/);
  assert.match(rootNavigator, /FEATURE_FLAGS\.favouritesEnabled \? \([\s\S]*name="Favourites"/);
  assert.match(
    rootNavigator,
    /FEATURE_FLAGS\.reviewCreationEnabled \? \([\s\S]*name="ReviewHistory"/,
  );
  assert.match(rootNavigator, /FEATURE_FLAGS\.socialFeedEnabled \? \([\s\S]*name="UserProfile"/);
  assert.match(rootNavigator, /function isReleaseRouteAvailable/);
});

test("floorplan screens are removed while floorplans stay hard-off", () => {
  const mapZoom = read("src/app/screens/discover/MapZoomedInScreen.tsx");
  const developerLauncher = read("src/app/screens/dev/DeveloperLauncherScreen.tsx");

  assert.doesNotMatch(mapZoom, /navigation\.navigate\("VenueDirectory"/);
  assert.doesNotMatch(developerLauncher, /BuildingDrillDown/);
});

test("signed-out app entry requires an account (no guest mode)", () => {
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
  // Mandatory sign-in: new users go to onboarding (which ends at the account step),
  // returning signed-out users go to Login; MainTabs opens only with a session.
  assert.match(splash, /if \(!isAuthenticated\) \{[\s\S]*name: "AuthStack"[\s\S]*screen: "Login"/);
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
    /if \(currentTopRoute === "OnboardingStack" && hasCompletedOnboarding\) \{[\s\S]*if \(isAuthenticated\) \{[\s\S]*navigateHome\(\);[\s\S]*name: "AuthStack"[\s\S]*screen: "Login"/,
  );
  assert.match(rootNavigator, /const isDeveloperMode = useMerchantStore/);
  assert.match(rootNavigator, /const isMerchantMode = useMerchantStore/);
  assert.match(rootNavigator, /const authDataSource = useSessionStore/);
  assert.match(
    rootNavigator,
    /currentTopRoute === "DeveloperLauncher"[\s\S]*isAuthenticated[\s\S]*hasCompletedOnboarding[\s\S]*authDataSource === "supabase"[\s\S]*!isDeveloperMode[\s\S]*!isMerchantMode[\s\S]*navigateHome\(\)/,
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
    rootNavigator.indexOf(
      "else if (isRootRouteName(returnRoute) && isReleaseRouteAvailable(returnRoute))",
    ),
    rootNavigator.indexOf(
      "} else {",
      rootNavigator.indexOf(
        "else if (isRootRouteName(returnRoute) && isReleaseRouteAvailable(returnRoute))",
      ),
    ),
  );
  assert.match(rootReturnRestore, /index: 1/);
  assert.match(rootReturnRestore, /name: "MainTabs", params: \{ screen: "Home" \}/);
  assert.match(rootReturnRestore, /name: returnRoute/);
  const parameterizedRootReturnRestore = rootNavigator.slice(
    rootNavigator.indexOf(
      "else if (isRootRouteName(returnRoute.name) && isReleaseRouteAvailable(returnRoute.name))",
    ),
    rootNavigator.indexOf(
      "} else {",
      rootNavigator.indexOf(
        "else if (isRootRouteName(returnRoute.name) && isReleaseRouteAvailable(returnRoute.name))",
      ),
    ),
  );
  assert.match(parameterizedRootReturnRestore, /index: 1/);
  assert.match(parameterizedRootReturnRestore, /name: "MainTabs", params: \{ screen: "Home" \}/);
  assert.match(
    parameterizedRootReturnRestore,
    /name: returnRoute\.name, params: returnRoute\.params/,
  );
  assert.match(tabs, /FEATURE_FLAGS\.postCreationEnabled/);
  assert.match(tabs, /rootNavigation\?\.navigate\("Post"\)/);
  assert.match(tabs, /setReturnRoute\(\{ name: "Post" \}\)/);
});
