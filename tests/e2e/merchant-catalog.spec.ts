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

    await expect(page.getByText(/Tiong Bahru Chicken Rice|Your Stall/).first()).toBeVisible();
    await expect(page.getByText("Manage Menu").first()).toBeVisible();

    await page.getByText("Manage Menu").first().click();
    await expect(page.getByText("Menu", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add menu item" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Add menu item" }).first().click();
    await page.getByText("Add Menu Item Manually").first().click();
    await expect(page.getByText("Add Dish", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dish Name *").first()).toBeVisible();
  });
});
