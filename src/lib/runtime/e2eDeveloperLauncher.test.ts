import assert from "node:assert/strict";
import test from "node:test";

import { isE2eDeveloperLauncherBuildFor } from "./e2eDeveloperLauncherGate";

const enabledDevelopmentExtra = {
  appEnv: "development",
  e2eDeveloperLauncherEnabled: true,
};

test("the E2E launcher requires the dedicated development Web build", () => {
  assert.equal(isE2eDeveloperLauncherBuildFor(enabledDevelopmentExtra, "web"), true);
  assert.equal(isE2eDeveloperLauncherBuildFor(enabledDevelopmentExtra, "ios"), false);
  assert.equal(isE2eDeveloperLauncherBuildFor(enabledDevelopmentExtra, "android"), false);
  assert.equal(
    isE2eDeveloperLauncherBuildFor({ appEnv: "staging", e2eDeveloperLauncherEnabled: true }, "web"),
    false,
  );
  assert.equal(
    isE2eDeveloperLauncherBuildFor(
      { appEnv: "production", e2eDeveloperLauncherEnabled: true },
      "web",
    ),
    false,
  );
  assert.equal(isE2eDeveloperLauncherBuildFor({ appEnv: "development" }, "web"), false);
});
