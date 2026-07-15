import { test } from "./fixtures";
import { runCoreSearchAudit } from "./helpers/coreSearchAudit";

test.describe("Core Search production audit", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-ios", "Runs on the iOS-like viewport.");
  });

  test("preserves truthful result context through dish and stall navigation", async ({
    page,
  }, testInfo) => {
    await runCoreSearchAudit(page, testInfo);
  });
});
