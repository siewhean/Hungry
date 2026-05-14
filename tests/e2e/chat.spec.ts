import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

test.describe("chat", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Chat route gating is covered once on desktop Chromium.",
    );
  });

  test("hides direct-message surfaces when the feature flag is disabled", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");

    await page.getByRole("button", { name: "Open activity inbox" }).click();
    await expect(page.getByTestId("activity-tab-updates")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Messages" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open chat with/i })).toHaveCount(0);
  });
});
