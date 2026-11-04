import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { SLIDER_FLOW_ROUTES } from "@/features/onboarding/flowRoutes";
import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { onboardingEntryRoute } from "./onboardingEntry";

const flags = FEATURE_FLAGS as unknown as Record<string, boolean>;
const original = flags.sliderOnboardingEnabled;

beforeEach(() => {
  flags.sliderOnboardingEnabled = true;
  useOnboardingDraftStore.getState().clearDraft();
});
afterEach(() => {
  flags.sliderOnboardingEnabled = original;
  useOnboardingDraftStore.getState().clearDraft();
});

test("a fresh start opens on Welcome", () => {
  assert.deepEqual(onboardingEntryRoute(), {
    name: "OnboardingStack",
    params: { screen: "OnboardingWelcome" },
  });
});

test("a relaunch stacks every slider-flow step before the one the person was on", () => {
  useOnboardingDraftStore.getState().rememberRoute("OnboardingPrice");
  const entry = onboardingEntryRoute();
  const names = entry.state?.routes.map((route) => route.name);
  const target = SLIDER_FLOW_ROUTES.indexOf("OnboardingPrice");
  assert.deepEqual(names, SLIDER_FLOW_ROUTES.slice(0, target + 1));
  assert.equal(entry.state?.index, target);
});

test("the diet step in the stack carries the saved quiz answers", () => {
  useOnboardingDraftStore.getState().rememberQuiz({
    answers: { spicy: 8, sweet: 5, salty: 5, sour: 5, rich: 5, aromatic: 5 },
    answeredKeys: ["spicy"],
    step: 5,
  });
  useOnboardingDraftStore.getState().rememberRoute("OnboardingDishGrid");
  const diet = onboardingEntryRoute().state?.routes.find(
    (route) => route.name === "DietaryPreferences",
  );
  assert.deepEqual(diet?.params?.answeredKeys, ["spicy"]);
  assert.equal(diet?.params?.initialPhase, "dietary");
});

test("a draft saved by the old flow is dropped when the slider flow is on", () => {
  useOnboardingDraftStore.getState().rememberRoute("FoodOpenness");
  useOnboardingDraftStore.getState().rememberRoute("TasteProfileResult");
  assert.deepEqual(onboardingEntryRoute().params, { screen: "OnboardingWelcome" });
  assert.equal(useOnboardingDraftStore.getState().route, null);
});
