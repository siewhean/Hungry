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
