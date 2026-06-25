import { readFileSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

const ROOT = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test.describe("page-agent production feature gates", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Static gate only needs Chromium.");
  });

  test("advanced surfaces stay non-production by default", () => {
    const flags = read("src/constants/featureFlags.ts");
    const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
    const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");

    for (const expected of [
      "const prototypeRoutesEnabled = appEnv !== \"production\"",
      "const nonProductionSurfaceEnabled = prototypeRoutesEnabled",
      "const merchantCentreEnabled = nonProductionSurfaceEnabled",
      "directMessagesEnabled: nonProductionSurfaceEnabled",
      "commentsEnabled: nonProductionSurfaceEnabled",
      "gamificationEnabled: nonProductionSurfaceEnabled",
      "collectionsEnabled: nonProductionSurfaceEnabled",
      "storiesEnabled: nonProductionSurfaceEnabled",
    ]) {
      expect(flags).toContain(expected);
    }

    for (const expected of [
      "FEATURE_FLAGS.prototypeRoutesEnabled ? (",
      "FEATURE_FLAGS.merchantCentreEnabled ? (",
      "FEATURE_FLAGS.directMessagesEnabled ? (",
      "FEATURE_FLAGS.storiesEnabled ? (",
      "FEATURE_FLAGS.gamificationEnabled ? (",
      "FEATURE_FLAGS.collectionsEnabled ? (",
    ]) {
      expect(rootNavigator).toContain(expected);
    }

    expect(tabs).toContain(
      'const composerRoute = FEATURE_FLAGS.prototypeRoutesEnabled ? "PostComposerV2" : "Post"',
    );
  });
});
