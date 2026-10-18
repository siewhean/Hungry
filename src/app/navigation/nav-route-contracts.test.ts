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
