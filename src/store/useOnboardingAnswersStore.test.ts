import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  MAX_ONBOARDING_NAME_LENGTH,
  MAX_TASTE_SIGNALS,
  MAX_USUAL_AREAS,
  cleanOnboardingName,
  useOnboardingAnswersStore,
} from "./useOnboardingAnswersStore";

beforeEach(() => useOnboardingAnswersStore.getState().reset());

test("a new device has no name, areas or meal times", () => {
  const state = useOnboardingAnswersStore.getState();
  assert.equal(state.displayName, "");
  assert.deepEqual(state.usualAreaIds, []);
  assert.deepEqual(state.mealTimes, {});
});

test("a name is trimmed, single-spaced and cut at 40 characters", () => {
  assert.equal(cleanOnboardingName("  Mei   Ling "), "Mei Ling");
  assert.equal(cleanOnboardingName("x".repeat(80)).length, MAX_ONBOARDING_NAME_LENGTH);
  useOnboardingAnswersStore.getState().setDisplayName("  Raj ");
  assert.equal(useOnboardingAnswersStore.getState().displayName, "Raj");
});

test("up to three areas can be picked, a fourth is refused and a tap removes one", () => {
  const { toggleUsualArea } = useOnboardingAnswersStore.getState();
  assert.equal(MAX_USUAL_AREAS, 3);
  assert.equal(toggleUsualArea("tampines"), true);
  assert.equal(toggleUsualArea("bishan"), true);
  assert.equal(toggleUsualArea("bedok"), true);
  assert.equal(toggleUsualArea("jurong-east"), false);
  assert.deepEqual(useOnboardingAnswersStore.getState().usualAreaIds, [
    "tampines",
    "bishan",
    "bedok",
  ]);
  assert.equal(toggleUsualArea("bishan"), true);
  assert.deepEqual(useOnboardingAnswersStore.getState().usualAreaIds, ["tampines", "bedok"]);
});

test("meal times keep only the meals that were picked", () => {
  useOnboardingAnswersStore.getState().setMealTimes({ lunch: "12:00", dinner: undefined });
  assert.deepEqual(useOnboardingAnswersStore.getState().mealTimes, { lunch: "12:00" });
  useOnboardingAnswersStore.getState().reset();
  assert.deepEqual(useOnboardingAnswersStore.getState().mealTimes, {});
});

test("hearting a dish toggles it, and a swipe moves it between liked and passed", () => {
  const store = useOnboardingAnswersStore.getState();
  store.toggleLikedDish("d1");
  assert.deepEqual(useOnboardingAnswersStore.getState().likedDishIds, ["d1"]);
  store.toggleLikedDish("d1");
  assert.deepEqual(useOnboardingAnswersStore.getState().likedDishIds, []);

  store.recordSwipe("d2", true);
  store.recordSwipe("d2", false);
  const after = useOnboardingAnswersStore.getState();
  assert.deepEqual(after.likedDishIds, []);
  assert.deepEqual(after.passedDishIds, ["d2"]);
  store.recordSwipe("d2", true);
  assert.deepEqual(useOnboardingAnswersStore.getState().passedDishIds, []);
});

test("only the newest signals are kept", () => {
  const store = useOnboardingAnswersStore.getState();
  for (let index = 0; index < MAX_TASTE_SIGNALS + 5; index += 1)
    store.recordSwipe(`d${index}`, true);
  const liked = useOnboardingAnswersStore.getState().likedDishIds;
  assert.equal(liked.length, MAX_TASTE_SIGNALS);
  assert.equal(liked.at(-1), `d${MAX_TASTE_SIGNALS + 4}`);
  assert.equal(liked[0], "d5");
});

test("taking the signals empties them once and keeps the name, areas and times", () => {
  const store = useOnboardingAnswersStore.getState();
  store.setDisplayName("Mei");
  store.recordSwipe("a", true);
  store.recordSwipe("b", false);
  store.setWantsMealPicks(true);
  assert.deepEqual(store.takeTasteSignals(), { liked: ["a"], passed: ["b"], wantsMealPicks: true });
  assert.deepEqual(useOnboardingAnswersStore.getState().takeTasteSignals(), {
    liked: [],
    passed: [],
    wantsMealPicks: false,
  });
  assert.equal(useOnboardingAnswersStore.getState().displayName, "Mei");
});
