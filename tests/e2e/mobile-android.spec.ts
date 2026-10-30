import { test, expect } from "./fixtures";
import {
  clickDevButton,
  openComposerFromLauncher,
  resetAppState,
  startOnboardedMockSession,
} from "./helpers/app";

test.describe("mobile Android smoke", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-android",
      "Runs only on the Android-like Playwright project.",
    );
  });

  test("opens feed, discover, and composer on an Android-like viewport", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");
    await expect(page.getByText("Chicken Rice", { exact: true }).first()).toBeVisible();

    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Discover", "Core app flow");
    await expect(page.getByText("Dishes across Singapore", { exact: true }).first()).toBeVisible();

    await resetAppState(page);
    await openComposerFromLauncher(page);
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  });
});
