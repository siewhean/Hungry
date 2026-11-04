import assert from "node:assert/strict";
import test from "node:test";

import { ONBOARDING_FLOW } from "./onboardingFlow";
import { SLIDER_FLOW_ROUTES, flowScreenForRoute, nextOnboardingRoute } from "./flowRoutes";

test("with the slider flow off, every step goes where it goes today", () => {
  assert.equal(nextOnboardingRoute("OnboardingWelcome", false), "LocationPermission");
  assert.equal(nextOnboardingRoute("LocationPermission", false), "TasteQuiz");
  assert.equal(nextOnboardingRoute("ManualLocationPicker", false), "TasteQuiz");
  assert.equal(nextOnboardingRoute("TasteQuiz", false), "DietaryPreferences");
  assert.equal(nextOnboardingRoute("DietaryPreferences", false), "FoodOpenness");
  assert.equal(nextOnboardingRoute("FoodOpenness", false), "TasteProfileResult");
});

test("with the slider flow on, each route leads to the next one in the plan", () => {
  SLIDER_FLOW_ROUTES.slice(0, -1).forEach((route, index) => {
    assert.equal(nextOnboardingRoute(route, true), SLIDER_FLOW_ROUTES[index + 1]);
  });
  assert.equal(
    nextOnboardingRoute("OnboardingAuth", true),
    "OnboardingAuth",
    "the account is last",
  );
  assert.equal(nextOnboardingRoute("ManualLocationPicker", true), "OnboardingAreas");
});

test("the routes cover the numbered screens in order, the six sliders sharing one route", () => {
  const screens = SLIDER_FLOW_ROUTES.map(flowScreenForRoute);
  const expected = ONBOARDING_FLOW.filter((screen) => !/^taste-(?!spicy)/.test(screen));
  assert.deepEqual(screens, expected);
});
