import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("onboarding typed routes are registered and flow through cuisine, food, taste, and dietary setup", () => {
  const types = read("src/app/navigation/navigationTypes.ts");
  const stack = read("src/app/screens/onboarding/OnboardingStack.tsx");
  const intro3 = read("src/app/screens/onboarding/OnboardingIntro3Screen.tsx");
  const cuisines = read("src/app/screens/onboarding/CuisineSelectionScreen.tsx");
  const foods = read("src/app/screens/onboarding/FoodSelectionScreen.tsx");
  const quiz = read("src/app/screens/onboarding/TasteQuizScreen.tsx");

  for (const routeName of ["CuisineSelection", "FoodSelection", "DietaryPreferences"]) {
    assert.match(types, new RegExp(`${routeName}:`));
    assert.match(stack, new RegExp(`name="${routeName}"`));
  }

  assert.match(intro3, /nextScreen="CuisineSelection"/);
  assert.match(cuisines, /navigation\.navigate\("FoodSelection", \{ cuisines: selected \}\)/);
  assert.match(foods, /navigation\.navigate\("TasteQuiz"\)/);
  assert.match(
    quiz,
    /navigation\.navigate\("DietaryPreferences", \{[\s\S]*initialPhase: "dietary"[\s\S]*\}\)/,
  );
  assert.match(quiz, /route\.name === "DietaryPreferences"/);
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
  assert.doesNotMatch(types, /Create: undefined/);
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
