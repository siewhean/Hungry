import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

test.describe("chat", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Chat route gating is covered once on desktop Chromium.",
    );
  });

  test("keeps direct-message surfaces available in dev smoke mode", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");

    await page.getByTestId("home-activity-inbox-button").filter({ visible: true }).click();
    await expect(page.getByTestId("activity-tab-updates").first()).toBeVisible();
    await page.getByRole("tab", { name: "Messages" }).click();
    await expect(page.getByRole("button", { name: /Open chat with/i }).first()).toBeVisible();
  });
});
