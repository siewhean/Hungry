import { test, expect } from "./fixtures";
import {
  clickDevButton,
  openComposerFromLauncher,
  resetAppState,
  startOnboardedMockSession,
} from "./helpers/app";

test.describe("mobile iOS smoke", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-ios",
      "Runs only on the iOS-like Playwright project.",
    );
  });

  test("opens feed, profile, and composer on an iPhone-like viewport", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");
    await expect(page.getByText("Chicken Rice", { exact: true }).first()).toBeVisible();

    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Profile", "Profile & Review");
    await expect(page.getByText("Wei Ming", { exact: true }).first()).toBeVisible();

    await resetAppState(page);
    await openComposerFromLauncher(page);
    await expect(page.getByRole("button", { name: "Publish Both" })).toBeVisible();
  });
});
