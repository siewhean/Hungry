import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("onboarding is welcome, then four counted steps: location, optional taste quiz, food openness, done", () => {
  const types = read("src/app/navigation/navigationTypes.ts");
  const stack = read("src/app/screens/onboarding/OnboardingStack.tsx");
  const progress = read("src/app/screens/onboarding/OnboardingProgress.tsx");
  const welcome = read("src/app/screens/onboarding/WelcomeScreen.tsx");
  const location = read("src/app/screens/onboarding/LocationPermissionScreen.tsx");
  const picker = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  const quiz = read("src/app/screens/onboarding/TasteQuizScreen.tsx");
  const done = read("src/app/screens/onboarding/TasteProfileResultScreen.tsx");
  const openness = read("src/app/screens/onboarding/FoodOpennessScreen.tsx");
  const onboardingAuth = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");

  for (const routeName of [
    "OnboardingWelcome",
    "LocationPermission",
    "ManualLocationPicker",
    "TasteQuiz",
    "DietaryPreferences",
    "FoodOpenness",
    "TasteProfileResult",
    "OnboardingAuth",
  ]) {
    assert.match(types, new RegExp(`\\b${routeName}:`));
    assert.match(stack, new RegExp(`name="${routeName}"`));
  }
  // Intro, cuisine and other redundant screens are gone from the flow.
  for (const removed of [
    "OnboardingIntro1",
    "OnboardingIntro2",
    "OnboardingIntro3",
    "CuisineSelection",
    "FoodSelection",
    "TasteProfileLoading",
  ]) {
    assert.doesNotMatch(stack, new RegExp(`name="${removed}"`));
    assert.doesNotMatch(types, new RegExp(`\\b${removed}:`));
    assert.doesNotMatch(
      read("src/app/screens/dev/DeveloperLauncherScreen.tsx"),
      new RegExp(`"${removed}"`),
    );
  }
  for (const removedFile of [
    "CuisineSelectionScreen.tsx",
    "OnboardingIntro1Screen.tsx",
    "OnboardingIntroTemplate.tsx",
  ]) {
    assert.ok(!existsSync(path.join(root, "src/app/screens/onboarding", removedFile)), removedFile);
  }
  // Only RootNavigator routes after auth; SignUp no longer resets into onboarding itself.
  assert.doesNotMatch(read("src/app/screens/auth/SignUpScreen.tsx"), /screen: "OnboardingWelcome"/);
  assert.match(
    read("src/app/navigation/RootNavigator.tsx"),
    /isAuthenticated && !hasCompletedOnboarding[\s\S]*screen: "OnboardingWelcome"/,
  );

  // One progress component, "Step x of 4" from Location to Done. Welcome has no counter
  // (r2 onboarding-L14) and the quiz shows its own "Question x of 7" instead of a second bar
  // (r2 onboarding-M1).
  assert.match(
    progress,
    /ONBOARDING_STEPS = \["welcome", "location", "taste", "openness", "done"\] as const/,
  );
  assert.match(
    progress,
    /PROGRESS_STEPS = ONBOARDING_STEPS\.filter\(\(name\) => name !== "welcome"\)/,
  );
  assert.match(progress, /Step \{current\} of \{total\}/);
  assert.match(progress, /accessibilityRole="progressbar"/);
  assert.doesNotMatch(welcome, /<OnboardingProgress/);
  assert.match(location, /<OnboardingProgress step="location" \/>/);
  assert.match(picker, /\{isOnboarding \? <OnboardingProgress step="location" \/> : null\}/);
  assert.doesNotMatch(quiz, /<OnboardingProgress/);
  assert.match(quiz, /Question \{inDietaryStep \? totalSteps : step \+ 1\} of \{totalSteps\}/);
  assert.match(done, /<OnboardingProgress step="done" \/>/);
  assert.match(openness, /\{isSettings \? null : <OnboardingProgress step="openness" \/>\}/);
  // The quiz no longer draws its own progress bar.
  assert.doesNotMatch(quiz, /progressAnim|progressTrack/);

  // Welcome -> Location (GPS or pick area) -> quiz -> done -> Home.
  assert.match(welcome, /navigation\.navigate\("LocationPermission"\)/);
  assert.match(location, /const next = \(\) => \{\s*navigation\.navigate\("TasteQuiz"\);/);
  assert.match(location, /navigation\.navigate\("ManualLocationPicker"\)/);
  assert.match(picker, /navigation\.navigate\("TasteQuiz"\)/);
  assert.match(
    quiz,
    /navigation\.navigate\("DietaryPreferences", \{[\s\S]*initialPhase: "dietary"[\s\S]*\}\)/,
  );
  assert.match(quiz, /route\.name === "DietaryPreferences"/);
  // The dietary route is a fresh TasteQuizScreen instance: the taste answers must be
  // carried over, and a missing draft must never reset the vector to neutral.
  assert.match(
    quiz,
    /navigation\.navigate\("DietaryPreferences", \{[\s\S]*\.\.\.\(answeredAny \? \{ answers: values \} : \{\}\),[\s\S]*\}\)/,
  );
  assert.match(
    quiz,
    /useState<TasteVector>\(\s*carriedAnswers \?\? \(flowMode === "profile" \? profile\.tasteVector : INITIAL\),?\s*\)/,
  );
  assert.match(quiz, /if \(hasTasteAnswers\) \{\s*setTasteVector\(values\);/);
  // Swipes only change the local draft; the vector is committed once in handleFinish.
  assert.equal(quiz.match(/setTasteVector\(/g)?.length, 1);
  assert.match(types, /DietaryPreferences:[\s\S]*answers\?: TasteVector;/);
  assert.match(quiz, /navigation\.navigate\("FoodOpenness", \{ mode: "onboarding" \}\)/);
  // Openness: Continue saves the choice; Skip saves nothing (the default applies); both go to done.
  assert.match(openness, /navigation\.navigate\("TasteProfileResult"\)/);
  assert.doesNotMatch(openness, /finish\(DEFAULT_FOOD_OPENNESS\)/);
  // The taste questions are optional, but Skip still asks about dietary needs
  // (without taste answers), and the quiz stays marked as skipped.
  assert.match(
    quiz,
    /setSkippedTasteQuiz\(true\);\s*navigation\.navigate\("DietaryPreferences", \{\s*mode: flowMode,\s*initialPhase: "dietary",\s*\}\)/,
  );
  // Next through every question without answering is also a skip, not an all-balanced taste.
  assert.match(quiz, /const answeredAny = hasAnsweredAnyQuestion\(answeredKeys\)/);
  assert.match(
    quiz,
    /setSkippedTasteQuiz\(!hasTasteAnswers\);\s*navigation\.navigate\("FoodOpenness", \{ mode: "onboarding" \}\)/,
  );
  assert.doesNotMatch(quiz, /navigation\.navigate\("LocationPermission"\)/);

  // The done step completes onboarding, then resets to Home. The only other exit is
  // a guest who signs up from OnboardingAuth and confirms their email: the stack is
  // reset to EmailVerification, which completes onboarding (completeVerifiedSignUp).
  for (const source of [welcome, location, picker, quiz, openness, onboardingAuth]) {
    assert.doesNotMatch(source, /completeOnboarding/);
  }
  // RootNavigator owns the transition Home once onboarding completes (one navigation).
  assert.match(
    done,
    /completeOnboarding\(hasSkippedTasteQuiz\);\s*if \(alreadyCompleted\) \{\s*navigation\.getParent<NavigationProp<RootStackParamList>>\(\)\?\.reset\(\{\s*index: 0,\s*routes: \[\{ name: "MainTabs", params: \{ screen: "Home" \} \}\],/,
  );
  assert.match(
    read("src/app/navigation/RootNavigator.tsx"),
    /currentTopRoute === "OnboardingStack" && hasCompletedOnboarding[\s\S]*?navigateHome\(\)/,
  );
  assert.match(
    onboardingAuth,
    /screen: "EmailVerification",\s*params: \{ email: values\.email, completedOnboarding: true \}/,
  );
  assert.match(
    read("src/app/screens/auth/EmailVerificationScreen.tsx"),
    /completeVerifiedSignUp\(shouldCompleteOnboarding\)/,
  );

  // Sign-in is not a step: OnboardingAuth opens just-in-time (saving a dish as a
  // guest) and returns to where the user was. The dish is kept on the device and saved
  // after sign-in or email verification, even once this screen has unmounted.
  assert.match(
    done,
    /rememberPendingDishSave\(dish\);\s*navigation\.navigate\("OnboardingAuth", \{ dishName: dish\.name \}\)/,
  );
  assert.match(
    read("src/features/auth/applySignedInProfile.ts"),
    /\.then\(\(\) => flushPendingDishSave\(\)\)/,
  );
  assert.match(onboardingAuth, /const finishOnboarding = \(\) => \{\s*navigation\.goBack\(\);/);
  assert.doesNotMatch(onboardingAuth, /navigation\.navigate\("LocationPermission"\)/);
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
    /rootNavigation\.navigate\("OnboardingStack", \{\s*screen: "ManualLocationPicker",\s*params: \{ mode: "settings" \},\s*\}\)/,
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
  assert.match(tabs, /rootNavigation\?\.navigate\("Post"\)/);
  assert.doesNotMatch(tabs, /composerRoute|PostComposerV2/);
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
