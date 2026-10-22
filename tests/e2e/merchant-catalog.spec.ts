import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState } from "./helpers/app";

test.describe("merchant catalog", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Merchant catalog smoke is covered once on desktop Chromium.",
    );
  });

  test("merchant preset opens dashboard and menu management surfaces", async ({ page }) => {
    await resetAppState(page);
    await clickDevButton(page, "Merchant", "Developer mode");

    // The preset has one outlet, so the outlet switcher stays hidden.
    await expect(page.getByRole("button", { name: /Switch outlet/ })).toHaveCount(0);
    await expect(page.getByText("Manage Menu").first()).toBeVisible();

    await page.getByText("Manage Menu").first().click();
    await expect(page.getByText("Menu", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add menu item" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Add menu item" }).first().click();
    // Photo drafts are off, so the button opens the dish editor directly.
    await expect(page.getByText("Add Dish", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dish Name *").first()).toBeVisible();
  });
});
