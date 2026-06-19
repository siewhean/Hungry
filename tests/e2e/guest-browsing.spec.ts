import { test, expect } from "./fixtures";
import { assertNoCrashVisible, clickDevButton, resetAppState } from "./helpers/app";

const CONTENT_TIMEOUT_MS = 30_000;

test.describe("signed-out entry", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Guest browsing route smoke is covered once on desktop Chromium.",
    );
  });

  test("signed-out normal app flow starts at login while explicit public details remain openable", async ({
    page,
  }) => {
    await resetAppState(page);

    await page.getByRole("button", { name: "Open normal app flow" }).click();
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });

    await resetAppState(page);
    await clickDevButton(page, "Dish V2", "Core app flow");
    await expect(page.getByText("Chicken Rice", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await assertNoCrashVisible(page);
  });

  test("protected create action redirects guests to login", async ({ page }) => {
    await resetAppState(page);

    await clickDevButton(page, "Composer", "Core app flow");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await assertNoCrashVisible(page);
  });
});
