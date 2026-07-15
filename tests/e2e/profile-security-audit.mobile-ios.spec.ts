import { test } from "./fixtures";
import { runProfileSecurityAudit } from "./helpers/profileSecurityAudit";

test.describe("Profile security production audit", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-ios", "Runs on the iOS-like viewport.");
  });

  test("uses a verified recovery email instead of a fabricated recovery code", async ({
    page,
  }, testInfo) => {
    await runProfileSecurityAudit(page, testInfo);
  });
});
