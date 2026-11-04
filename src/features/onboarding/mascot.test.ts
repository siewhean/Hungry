import assert from "node:assert/strict";
import test from "node:test";

import { ONBOARDING_FLOW } from "./onboardingFlow";
import { MASCOT_POSES, PLACEHOLDER_EXPRESSION, poseForScreen } from "./mascot";

test("every pose has a placeholder face", () => {
  for (const pose of MASCOT_POSES) assert.ok(PLACEHOLDER_EXPRESSION[pose], pose);
});

test("every screen has a pose, defaulting to the clipboard", () => {
  for (const screen of ONBOARDING_FLOW) assert.ok(MASCOT_POSES.includes(poseForScreen(screen)));
  assert.equal(poseForScreen("something-new"), "clipboard");
  assert.equal(poseForScreen("loading"), "cooking");
});
