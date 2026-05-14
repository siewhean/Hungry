import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test.describe("production route gating", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Static production route guard only needs one browser project.",
    );
  });

  test("prototype, merchant, and direct-message routes are feature gated", () => {
    const flags = read("src/constants/featureFlags.ts");
    const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

    expect(flags).toContain("prototypeRoutesEnabled");
    expect(flags).toContain('appEnv !== "production"');
    expect(rootNavigator).toContain("FEATURE_FLAGS.prototypeRoutesEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.merchantCentreEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.directMessagesEnabled ? (");

    for (const routeName of [
      "DiscoverV2",
      "DishDetailV2",
      "SearchHomeV2",
      "StallDetailV2",
      "BuildingDrillDownV2",
      "QuickReviewV2",
      "SplashV2",
      "DesignGallery",
      "ReviewFeedV2",
      "VenueDirectory",
      "MerchantTabs",
      "ChatDetail",
      "DirectMessages",
    ]) {
      expect(rootNavigator).toContain(`name="${routeName}"`);
    }
  });
});
