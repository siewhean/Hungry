import { test, expect } from "./fixtures";
import { createEmailAccountFromScratch, gotoLauncher, clickDevButton } from "./helpers/app";

test.describe("auth", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Auth creation is covered once on desktop Chromium.",
    );
  });

  test("creates User A and User B from scratch in mock auth", async ({ page }) => {
    const userA = await createEmailAccountFromScratch(page, "User A");
    await expect(page.getByText(userA.email)).toHaveCount(0);

    await gotoLauncher(page);
    await clickDevButton(page, "Signed out", "Session presets");

    const userB = await createEmailAccountFromScratch(page, "User B");
    await expect(page.getByText(userB.email)).toHaveCount(0);
  });
});
