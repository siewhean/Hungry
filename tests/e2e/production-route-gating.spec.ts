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

  test("prototype, merchant, social, and gamification routes are feature gated", () => {
    const flags = read("src/constants/featureFlags.ts");
    const rootNavigator = read("src/app/navigation/RootNavigator.tsx");

    expect(flags).toContain("prototypeRoutesEnabled");
    expect(flags).toContain("gamificationEnabled");
    expect(flags).toContain("collectionsEnabled");
    expect(flags).toContain("storiesEnabled");
    expect(flags).toContain("commentsEnabled: nonProductionSurfaceEnabled");
    expect(flags).toContain("directMessagesEnabled: nonProductionSurfaceEnabled");
    expect(flags).toContain("merchantCentreEnabled: nonProductionSurfaceEnabled");
    expect(flags).toContain("merchantClaimCtaEnabled: nonProductionSurfaceEnabled");
    expect(flags).toContain('appEnv !== "production"');
    expect(rootNavigator).toContain("FEATURE_FLAGS.prototypeRoutesEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.merchantCentreEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.merchantClaimCtaEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.directMessagesEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.storiesEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.gamificationEnabled ? (");
    expect(rootNavigator).toContain("FEATURE_FLAGS.collectionsEnabled ? (");

    for (const routeName of [
      "DesignGallery",
      "PostComposerV2",
      "MerchantTabs",
      "ChatDetail",
      "DirectMessages",
      "StoryViewer",
      "AddStory",
      "PassportScreen",
      "MissionsScreen",
      "CollectionList",
      "CollectionDetail",
      "PortfolioPublicView",
      "AdminPortfolioFlags",
    ]) {
      expect(rootNavigator).toContain(`name="${routeName}"`);
    }
    for (const removedRouteName of [
      "DiscoverV2",
      "SearchHomeV2",
      "QuickReviewV2",
      "ReviewFeedV2",
    ]) {
      expect(rootNavigator).not.toContain(`name="${removedRouteName}"`);
    }
  });
});
