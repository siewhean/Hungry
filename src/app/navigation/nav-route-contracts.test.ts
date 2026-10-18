import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("onboarding typed routes are registered and flow through cuisine, taste, and dietary setup", () => {
  const types = read("src/app/navigation/navigationTypes.ts");
  const stack = read("src/app/screens/onboarding/OnboardingStack.tsx");
  const welcome = read("src/app/screens/onboarding/WelcomeScreen.tsx");
  const intro1 = read("src/app/screens/onboarding/OnboardingIntro1Screen.tsx");
  const introTemplate = read("src/app/screens/onboarding/OnboardingIntroTemplate.tsx");
  const cuisines = read("src/app/screens/onboarding/CuisineSelectionScreen.tsx");
  const quiz = read("src/app/screens/onboarding/TasteQuizScreen.tsx");
  const result = read("src/app/screens/onboarding/TasteProfileResultScreen.tsx");

  for (const routeName of ["CuisineSelection", "DietaryPreferences"]) {
    assert.match(types, new RegExp(`${routeName}:`));
    assert.match(stack, new RegExp(`name="${routeName}"`));
  }

  // Short flow: Welcome -> Cuisine (+ optional dishes) -> quiz -> dietary -> result -> location.
  for (const removed of [
    "OnboardingIntro2",
    "OnboardingIntro3",
    "FoodSelection",
    "TasteProfileLoading",
  ]) {
    assert.doesNotMatch(stack, new RegExp(`name="${removed}"`));
    assert.doesNotMatch(types, new RegExp(`\\b${removed}:`));
  }
  assert.match(welcome, /navigation\.navigate\("CuisineSelection"\)/);
  assert.match(intro1, /nextScreen="CuisineSelection"/);
  assert.match(introTemplate, /navigation\.navigate\("LocationPermission"\)/);
  assert.doesNotMatch(introTemplate, /next step: \$\{nextScreen\}/);
  assert.match(introTemplate, /paddingTop: insets\.top/);
  assert.match(cuisines, /setOnboardingSelectedDishIds\(/);
  assert.match(cuisines, /navigation\.navigate\("TasteQuiz"\)/);
  assert.match(
    quiz,
    /navigation\.navigate\("DietaryPreferences", \{[\s\S]*initialPhase: "dietary"[\s\S]*\}\)/,
  );
  assert.match(quiz, /route\.name === "DietaryPreferences"/);
  assert.match(quiz, /navigation\.navigate\("TasteProfileResult"\)/);
  assert.match(quiz, /setSkippedTasteQuiz\(true\);\s*navigation\.navigate\("LocationPermission"\)/);
  assert.match(result, /navigation\.navigate\("LocationPermission"\)/);
  // Signing up mid-onboarding continues to Location instead of finishing early.
  const onboardingAuth = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");
  assert.match(onboardingAuth, /navigation\.navigate\("LocationPermission"\)/);
  assert.doesNotMatch(onboardingAuth, /completeOnboarding\(/);
  assert.doesNotMatch(result, /completeOnboarding/);
});

test("root and nested route targets avoid stale or unregistered screens", () => {
  const types = read("src/app/navigation/navigationTypes.ts");
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  const merchantSettings = read("src/app/screens/merchant/MerchantSettingsScreen.tsx");

  assert.doesNotMatch(types, /DishDetailStandard/);
  assert.doesNotMatch(rootNavigator, /"SettingsV2"/);
  assert.match(favourites, /rootNavigation\.navigate\("MainTabs", \{ screen: "Discover" \}\)/);
  assert.match(
    settings,
    /rootNavigation\.navigate\("OnboardingStack", \{ screen: "ManualLocationPicker" \}\)/,
  );
  assert.match(merchantSettings, /CommonActions\.reset/);
  assert.match(
    merchantSettings,
    /routes: \[\{ name: "MainTabs", params: \{ screen: "Home" \} \}\]/,
  );
  assert.doesNotMatch(merchantSettings, /navigation\.navigate\("Profile" as never\)/);
});

test("synthetic create tab targets root routes without registering a fake tab route", () => {
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");

  assert.doesNotMatch(tabs, /<Tab\.Screen name="Create"/);
  assert.doesNotMatch(types, /^\s+Create: undefined;/m);
  assert.match(tabs, /navigation\.getParent<NavigationProp<RootStackParamList>>\(\)/);
  assert.match(
    tabs,
    /const composerRoute = FEATURE_FLAGS\.prototypeRoutesEnabled \? "PostComposerV2" : "Post"/,
  );
  assert.match(
    tabs,
    /rootNavigation\?\.navigate\("PostComposerV2"\)[\s\S]*rootNavigation\?\.navigate\("Post"\)/,
  );
  assert.match(tabs, /rootNavigation\?\.navigate\("AuthStack", \{ screen: "Login" \}\)/);
  assert.doesNotMatch(tabs, /navigation\.getParent\(\)\?\.navigate\("PostComposerV2"\)/);
  assert.doesNotMatch(tabs, /navigation\.navigate\("AuthStack", \{ screen: "Login" \}\)/);
});

test("going offline shows a banner instead of taking over navigation", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

  assert.match(rootNavigator, /function OfflineBanner\(\)/);
  assert.match(rootNavigator, /<OfflineBanner \/>/);
  assert.doesNotMatch(rootNavigator, /navigationRef\.navigate\("Offline"\)/);
  assert.doesNotMatch(rootNavigator, /currentTopRoute === "Offline"/);
  // The route stays registered for the developer launcher.
  assert.match(rootNavigator, /name="Offline"/);
});

test("wheel party mode is gated and /join links explain group spins are coming", () => {
  const wheelHome = read("src/app/screens/wheel/WheelHomeScreen.tsx");
  const wheelLobby = read("src/app/screens/wheel/WheelLobbyScreen.tsx");
  const wheelStore = read("src/store/useWheelStore.ts");

  assert.match(wheelHome, /const PARTY_ENABLED = FEATURE_FLAGS\.wheelPartyEnabled/);
  assert.match(
    wheelHome,
    /!PARTY_ENABLED && route\.params\?\.code[\s\S]*Group spins are coming soon/,
  );
  assert.match(wheelHome, /\{PARTY_ENABLED \? \([\s\S]*Join your friends/);
  assert.match(wheelLobby, /\{PARTY_ENABLED \? \([\s\S]*party\.code/);
  assert.match(wheelStore, /if \(!FEATURE_FLAGS\.wheelPartyEnabled\) \{/);
});
