import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useProfileStore } from "@/store/useProfileStore";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Decide For Me shows distance, Directions and Save, and respects the budget softly", () => {
  const screen = read("src/app/screens/discover/DecideForMeResultScreen.tsx");

  assert.match(screen, /formatDistance\(dish\.distanceMeters\)/);
  assert.match(screen, /label="Directions"/);
  assert.match(screen, /trackAnalyticsEvent\("directions_opened"/);
  assert.match(screen, /openTrustedMapsUrl\(buildMapsSearchUrl\(stallAddress\)\)/);
  assert.match(screen, /toggleFavourite\(dish\)/);
  assert.match(screen, /withinBudget\.length \? withinBudget : results/);
});

test("Decide For Me has no fake cart, routes back to Discover, and tracks its funnel", () => {
  const screen = read("src/app/screens/discover/DecideForMeResultScreen.tsx");

  assert.doesNotMatch(screen, /Add to cart|useCartStore|useOrderStore|handleAddToCart/);
  assert.doesNotMatch(screen, /Sparkles/);
  assert.doesNotMatch(screen, /MUST ORDER|Palate Match|WHY THIS DISH/);
  assert.match(screen, /navigation\.navigate\("MainTabs", \{ screen: "Discover" \}\)/);
  assert.doesNotMatch(screen, /navigate\("SearchHome"\)/);
  // Home does not track the trigger itself, so the screen does unless Discover opened it.
  assert.match(
    screen,
    /if \(entrySurface === "discover"\) return;[\s\S]*"decide_for_me_triggered"/,
  );
  assert.match(screen, /trackAnalyticsEvent\("decide_for_me_no_match"/);
  assert.match(screen, /trackAnalyticsEvent\("decide_for_me_radius_expanded"/);
  // Guests are asked to sign in instead of the save silently doing nothing.
  assert.match(
    screen,
    /if \(!isAuthenticated\) \{[\s\S]*navigate\("AuthStack", \{ screen: "Login" \}\)/,
  );
});

test("taste quiz asks for a usual budget and saves it with dietary preferences", () => {
  const quiz = read("src/app/screens/onboarding/TasteQuizScreen.tsx");

  assert.match(quiz, /Usual budget per dish/);
  assert.match(quiz, /setMaxDishBudget\(maxDishBudget\)/);
});

test("setMaxDishBudget stores the budget locally and logs it", () => {
  useProfileStore.getState().setMaxDishBudget(12);
  assert.equal(useProfileStore.getState().profile.maxDishBudget, 12);
  const events = getTrackedAnalyticsEvents().filter((e) => e.event === "budget_preference_set");
  assert.equal(events.at(-1)?.properties.max_dish_budget, 12);

  useProfileStore.getState().setMaxDishBudget(undefined);
  assert.equal(useProfileStore.getState().profile.maxDishBudget, undefined);
});
