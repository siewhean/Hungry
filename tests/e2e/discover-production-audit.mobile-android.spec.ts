import { test } from "./fixtures";
import { runDiscoverProductionAudit } from "./helpers/discoverProductionAudit";

test.describe("Discover production visual audit", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-android", "Runs on the Android-like viewport.");
  });

  test("shows truthful card imagery, cuisine, price, and distance across Discover filters", async ({
    page,
  }, testInfo) => {
    await runDiscoverProductionAudit(page, testInfo);
  });
});
