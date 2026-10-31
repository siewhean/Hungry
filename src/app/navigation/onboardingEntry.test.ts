import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { onboardingEntryRoute } from "@/app/navigation/onboardingEntry";
import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";

beforeEach(() => {
  useOnboardingDraftStore.getState().clearDraft();
});

test("a fresh install starts at Welcome", () => {
  assert.deepEqual(onboardingEntryRoute(), {
    name: "OnboardingStack",
    params: { screen: "OnboardingWelcome" },
  });
});

test("a draft reopens its step with the earlier steps underneath, so Back works", () => {
  useOnboardingDraftStore.getState().rememberRoute("FoodOpenness");
  const route = onboardingEntryRoute();
  assert.equal(route.name, "OnboardingStack");
  assert.deepEqual(
    route.state?.routes.map((entry) => entry.name),
    ["OnboardingWelcome", "LocationPermission", "TasteQuiz", "DietaryPreferences", "FoodOpenness"],
  );
  assert.equal(route.state?.index, 4);
});

test("a resumed dietary step carries the quiz answers that were given", () => {
  const draft = useOnboardingDraftStore.getState();
  draft.rememberQuiz({
    answers: { ...NEUTRAL_TASTE_VECTOR, spicy: 8 },
    answeredKeys: ["spicy"],
    step: 1,
  });
  draft.rememberRoute("DietaryPreferences");
  const dietary = onboardingEntryRoute().state?.routes.at(-1);
  assert.equal(dietary?.name, "DietaryPreferences");
  assert.deepEqual(dietary?.params, {
    mode: "onboarding",
    initialPhase: "dietary",
    answers: { ...NEUTRAL_TASTE_VECTOR, spicy: 8 },
    answeredKeys: ["spicy"],
  });
});

test("a skipped quiz resumes the dietary step without answers", () => {
  useOnboardingDraftStore.getState().rememberRoute("DietaryPreferences");
  const dietary = onboardingEntryRoute().state?.routes.at(-1);
  assert.deepEqual(dietary?.params, { mode: "onboarding", initialPhase: "dietary" });
});

test("an expired draft is cleared and the run starts at Welcome", () => {
  useOnboardingDraftStore.getState().rememberRoute("TasteQuiz");
  useOnboardingDraftStore.setState({ savedAt: Date.now() - 25 * 60 * 60 * 1000 });
  assert.deepEqual(onboardingEntryRoute().params, { screen: "OnboardingWelcome" });
  assert.equal(useOnboardingDraftStore.getState().route, null);
});
