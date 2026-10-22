import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useProfileStore } from "@/store/useProfileStore";
import {
  hasAnsweredAnyQuestion,
  nearestOptionIndex,
  resolveQuestionCard,
} from "./tasteQuizAnswers";
import { describeTaste, matchesAllDietaryFlags, noDietaryPicksMessage } from "./resultPicks";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const DIR = "src/app/screens/onboarding";
const quiz = () => read(`${DIR}/TasteQuizScreen.tsx`);
const welcome = () => read(`${DIR}/WelcomeScreen.tsx`);
const location = () => read(`${DIR}/LocationPermissionScreen.tsx`);
const picker = () => read(`${DIR}/ManualLocationPickerScreen.tsx`);
const openness = () => read(`${DIR}/FoodOpennessScreen.tsx`);
const result = () => read(`${DIR}/TasteProfileResultScreen.tsx`);
const auth = () => read(`${DIR}/OnboardingAuthScreen.tsx`);

test("M2: a retake highlights and centres the saved answer, not Balanced", () => {
  assert.equal(nearestOptionIndex(8), 2);
  assert.equal(nearestOptionIndex(2), 0);
  assert.equal(nearestOptionIndex(5), 1);
  assert.equal(nearestOptionIndex(6.4), 1);
  assert.equal(nearestOptionIndex(7), 2);

  const saved = { ...NEUTRAL_TASTE_VECTOR, spicy: 8 };
  assert.deepEqual(resolveQuestionCard(saved, "spicy", ["spicy"]), {
    scrollIndex: 2,
    selectedIndex: 2,
  });
  // Going Back to an answered question also lands on the answer.
  assert.deepEqual(resolveQuestionCard({ ...saved, sweet: 2 }, "sweet", ["sweet"]), {
    scrollIndex: 0,
    selectedIndex: 0,
  });
});

test("M3: an unanswered question is centred but not selected, and no answers means skipped", () => {
  assert.deepEqual(resolveQuestionCard(NEUTRAL_TASTE_VECTOR, "sweet", []), {
    scrollIndex: 1,
    selectedIndex: -1,
  });
  assert.equal(hasAnsweredAnyQuestion([]), false);
  assert.equal(hasAnsweredAnyQuestion(["sour"]), true);

  const source = quiz();
  // Only a tap or a swipe marks a question answered.
  assert.match(source, /setAnsweredKeys\(\(current\) =>/);
  assert.match(source, /flowMode === "profile" \? \[\.\.\.STEPS\] : \[\]/);
  // The card the carousel was placed on is not an answer.
  assert.match(source, /if \(index === scrollIndexRef\.current\) return;/);
  assert.doesNotMatch(source, /snappedIndex/);
});

test("M5 and L3: the result fallback respects every dietary flag, and says so when empty", () => {
  const halalVegan = { dietaryFlags: ["halal", "vegan", "gluten_free"] };
  const halalOnly = { dietaryFlags: ["halal"] };
  assert.equal(matchesAllDietaryFlags(halalVegan, ["halal", "vegan"]), true);
  // Halal and vegan means both: a halal-only dish does not pass.
  assert.equal(matchesAllDietaryFlags(halalOnly, ["halal", "vegan"]), false);
  assert.equal(matchesAllDietaryFlags({}, []), true);
  assert.equal(matchesAllDietaryFlags({}, ["halal"]), false);
  assert.equal(
    noDietaryPicksMessage(["halal", "gluten_free", "vegan"]),
    "We don't have many halal and gluten free dishes tagged yet. Browse Home to see what's nearby.",
  );

  const source = result();
  assert.equal(source.match(/matchesAllDietaryFlags\(/g)?.length, 2, "both fallback paths filter");
  assert.match(source, /noDietaryPicksMessage\(/);

  assert.equal(
    describeTaste({ ...NEUTRAL_TASTE_VECTOR, spicy: 8, rich: 8 }),
    "You lean spicy and rich.",
  );
  assert.equal(describeTaste(NEUTRAL_TASTE_VECTOR), "You like your flavours balanced.");
  assert.equal(
    describeTaste({ sweet: 2, spicy: 2, sour: 2, salty: 2, rich: 2, aromatic: 2 }),
    "You keep things light and mild.",
  );
});

test("M6: dietary analytics carry a count, never the religious or health flags", () => {
  clearTrackedAnalyticsEvents();
  useProfileStore.getState().setDietaryPreferences(["halal", "diabetic_friendly"]);
  const event = getTrackedAnalyticsEvents().find(
    (entry) => entry.event === "dietary_preferences_set",
  );
  assert.ok(event);
  assert.deepEqual(event.properties, { flag_count: 2 });
  assert.doesNotMatch(JSON.stringify(event), /halal|diabetic/);
});

test("M4: the budget answer is saved on the account and merged at sign-in", () => {
  assert.match(
    read("src/store/useProfileStore.ts"),
    /updateMaxDishBudget\(maxDishBudget \?\? null\)/,
  );
  assert.match(
    read("src/lib/services/types.ts"),
    /updateMaxDishBudget\(maxDishBudget: number \| null\)/,
  );
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /maxDishBudget: asNumber\(row\.max_dish_budget\)/);
  assert.match(service, /upsert\(\{ id: userId, max_dish_budget: maxDishBudget \}/);
  assert.match(
    read("src/features/auth/applySignedInProfile.ts"),
    // Re-onboarding: the new single-choice answer (budget) replaces the saved one.
    /maxDishBudget: provisional\.maxDishBudget \?\? serverProfile\.maxDishBudget/,
  );
  const sql = read("supabase/migrations/20261022020000_profile_max_dish_budget.sql");
  assert.match(sql, /add column if not exists max_dish_budget numeric\(6, 2\)/);
  assert.match(sql, /max_dish_budget > 0 and max_dish_budget <= 1000/);
});

test("M1, L14: Welcome has no counter; the quiz shows one counter; Welcome copy is not repeated", () => {
  const welcomeSource = welcome();
  assert.doesNotMatch(welcomeSource, /<OnboardingProgress/);
  assert.doesNotMatch(welcomeSource, /Discover dishes, not just restaurants/);
  assert.match(welcomeSource, /Ranked by people who ate it/);
  assert.doesNotMatch(quiz(), /<OnboardingProgress/);
});

test("M7: only the photos a question shows are bundled, as WebP", () => {
  const registry = read(`${DIR}/onboardingFoodImages.ts`);
  for (const unused of ["bibimbap", "burger", "pasta", "pizza", "roti-prata", "yong-tau-foo"]) {
    assert.doesNotMatch(registry, new RegExp(unused));
  }
  assert.doesNotMatch(registry, /\.png/);
});

test("M8: Welcome, Location and the quiz scroll instead of clipping at large text sizes", () => {
  assert.match(welcome(), /<ScrollView[\s\S]*flexGrow: 1[\s\S]*<\/ScrollView>[\s\S]*Get started/);
  assert.match(
    location(),
    /<ScrollView[\s\S]*<FeatureCard[\s\S]*<\/ScrollView>[\s\S]*Allow location/,
  );
  // The taste phase of the quiz scrolls; its footer buttons stay outside the scroller.
  assert.match(
    quiz(),
    /<ScrollView\s+style=\{\{ flex: 1 \}\}[\s\S]*\{headline\}[\s\S]*<\/ScrollView>/,
  );
});

test("M9: every taste question, the dietary step and the area picker are tracked", () => {
  const progress = read(`${DIR}/OnboardingProgress.tsx`);
  assert.match(progress, /trackAnalyticsEvent\("onboarding_question_viewed"/);
  assert.match(progress, /trackAnalyticsEvent\("onboarding_area_picker_viewed"/);
  assert.match(quiz(), /trackOnboardingQuestionViewed\("dietary", STEPS\.length\)/);
  assert.match(quiz(), /trackOnboardingQuestionViewed\(currentKey, step\)/);
  assert.match(picker(), /trackOnboardingAreaPickerViewed\(\)/);
});

test("L1: each question lists its dishes mild to strong, so the example matches the label", () => {
  const registry = read(`${DIR}/onboardingFoodImages.ts`);
  const block = registry.slice(registry.indexOf("TASTE_QUESTION_FOODS"));
  assert.match(block, /spicy: \[[^\]]*"Korean stew"[^\]]*"Laksa"[^\]]*"Mala xiang guo"/);
  assert.match(block, /sour: \[[^\]]*"Mee siam"[^\]]*"Rojak"[^\]]*"Asam laksa"/);
});

test("L2: opening a dish from the result screen completes onboarding after navigating", () => {
  assert.match(
    result(),
    /\.navigate\("DishDetail", \{ dishId: dish\.id \}\);[\s\S]*completeOnboarding\(hasSkippedTasteQuiz\);/,
  );
});

test("L4 (not adopted): sign-in is the step after Done, never opened early by a save", () => {
  assert.doesNotMatch(result(), /navigate\("OnboardingAuth", \{ dishName: dish\.name \}\)/);
  assert.match(result(), /rememberPendingDishSave\(dish\);/);
});

test("L5, L6: location copy is honest, the icon is neutral, and a blocked permission stays on screen", () => {
  const source = location();
  assert.doesNotMatch(source, /palate/);
  assert.match(
    source,
    /We use your location to show stalls near you\. You can change it anytime\./,
  );
  assert.doesNotMatch(source, /Clock3|errorSoft/);
  assert.match(source, /icon: Star,\s*iconTone: "textSecondary"/);
  // Blocked: toast and stay, with Open Settings next to Pick my area, even after an area was picked.
  assert.match(source, /setPermissionBlocked\(true\);\s*showToast\([\s\S]*?return;/);
  assert.match(source, /\{permissionBlocked \? \(\s*<Button\s*label="Open Settings"/);
});

test("L7: the quiz has a visible back arrow on every question", () => {
  const source = quiz();
  assert.match(source, /accessibilityLabel="Back"\s*onPress=\{handleHeaderBack\}/);
  assert.match(source, /const handleHeaderBack = \(\) => \{/);
});

test("L8: back buttons are 44 points and area rows at least 48", () => {
  for (const source of [location(), picker(), openness()]) {
    assert.match(source, /height: 44,[\s\S]{0,60}width: 44,/);
    assert.doesNotMatch(source, /height: 40,/);
  }
  assert.match(picker(), /minHeight: 48,/);
});

test("L9: choices are radios in a group, headings are headers, the illustration is decorative", () => {
  assert.match(picker(), /accessibilityRole="radiogroup"/);
  assert.match(picker(), /accessibilityRole="radio"[\s\S]*accessibilityState=\{\{ checked:/);
  assert.match(location(), /<AppText variant="h2" accessibilityRole="header"/);
  assert.match(location(), /<AccessibleImage[\s\S]*?decorative/);
  assert.doesNotMatch(location(), /Location permission illustration/);
  assert.match(quiz(), /<AppText variant="h2" accessibilityRole="header"/);
});

test("L10: OnboardingAuth field errors use the shared Input error props", () => {
  const source = auth();
  assert.equal(source.match(/errorText=\{/g)?.length, 5);
  assert.doesNotMatch(source, /\{(signUpErrors|loginErrors)\.\w+ \? \(/);
});

test("L11: the area list has Sembawang and Tengah, and finds areas by their common names", () => {
  const source = `${read(`${DIR}/singaporeAreas.ts`)}\n${picker()}`;
  assert.match(source, /id: "sembawang", name: "Sembawang"/);
  assert.match(source, /id: "tengah", name: "Tengah"/);
  assert.match(source, /keywords: \["outram", "tanjong pagar"\]/);
  assert.match(
    source,
    /area\.keywords\?\.some\(\(keyword\) => keyword\.includes\(normalizedQuery\)\)/,
  );
});

test("L13: Skip on the openness step saves nothing", () => {
  const source = openness();
  assert.match(
    source,
    /trackOnboardingStepSkipped\("openness"\);\s*navigation\.navigate\("TasteProfileResult"\);/,
  );
  assert.doesNotMatch(source, /finish\(DEFAULT_FOOD_OPENNESS\)/);
});

test("L15, L16: budget chips say S$, and the dietary button always says Continue with a None option", () => {
  const source = quiz();
  assert.match(source, /label: "Under S\$6"/);
  assert.match(source, /label: "Under S\$12"/);
  assert.doesNotMatch(source, /No restrictions/);
  assert.match(source, /label="Continue"\s*onPress=\{handleFinish\}/);
  assert.match(source, /label: "None",[\s\S]*onPress: \(\) => setDietaryPreferencesState\(\[\]\)/);
});

test("L17: the carousel is positioned in one place", () => {
  const source = quiz();
  assert.equal(source.match(/scrollToOffset\(\{ animated: false/g)?.length, 1);
  assert.doesNotMatch(source, /setTimeout\(\(\) => \{\s*carouselRef/);
  assert.doesNotMatch(source, /onLayout=/);
});
