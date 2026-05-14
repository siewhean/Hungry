import { test, expect } from "./fixtures";
import { assertNoCrashVisible, clickDevButton, resetAppState } from "./helpers/app";

const CONTENT_TIMEOUT_MS = 30_000;

test.describe("guest browsing", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Guest browsing route smoke is covered once on desktop Chromium.",
    );
  });

  test("signed-out users can browse home, discover, search, and detail surfaces", async ({
    page,
  }) => {
    await resetAppState(page);
    await clickDevButton(page, "Signed out", "Session presets");

    await page.getByRole("button", { name: "Open normal app flow" }).click();
    await expect(page.getByText("Your Story", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });

    await page.getByRole("button", { name: "Discover" }).click();
    await expect(page.getByText("Popular right now", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });

    await page.getByRole("button", { name: "Search dishes, stalls, or hawker centres" }).click();
    await expect(page.getByPlaceholder("Laksa, satay, Tian Tian...")).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });

    await resetAppState(page);
    await clickDevButton(page, "Signed out", "Session presets");
    await clickDevButton(page, "Dish V2", "Core app flow");
    await expect(page.getByText("Chicken Rice", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await assertNoCrashVisible(page);
  });

  test("protected create action redirects guests to login", async ({ page }) => {
    await resetAppState(page);
    await clickDevButton(page, "Signed out", "Session presets");
    await page.getByRole("button", { name: "Open normal app flow" }).click();
    await expect(page.getByText("Your Story", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });

    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await assertNoCrashVisible(page);
  });
});
