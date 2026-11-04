import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState } from "./helpers/app";
import type { Page } from "@playwright/test";

// Walks the Merchant Centre by pressing its buttons, in both colour schemes: every tab and the
// screens behind Home open, their main controls respond, and nothing logs a page error (the
// fixtures fail the test on any critical console error or failed request).

const SCHEMES = ["light", "dark"] as const;

async function openTab(page: Page, name: "Home" | "Menu" | "Performance" | "Profile") {
  await page
    .getByRole("tab", { name: `Merchant ${name}` })
    .first()
    .click();
}

async function back(page: Page) {
  await page.getByRole("button", { name: "Go back" }).first().click();
}

test.describe("merchant button walk", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The merchant walk runs once on desktop Chromium.",
    );
  });

  for (const scheme of SCHEMES) {
    test(`every merchant tab and Home tool opens and responds (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await resetAppState(page);
      await clickDevButton(page, "Merchant", "Developer mode");

      // Home: the headline card, the shop-status pill and the tool tiles.
      await expect(page.getByText("Manage menu").first()).toBeVisible();
      await page
        .getByRole("button", { name: /^Stall status:/ })
        .first()
        .click();
      await expect(page.getByText("Pause your stall").first()).toBeVisible();
      await page
        .getByRole("button", { name: /^Stall status:/ })
        .first()
        .click();

      for (const tile of [
        { label: /^Promotions\./, heading: "Promotions" },
        { label: /^Featured visitors\./, heading: "Featured visitors" },
        { label: /^Insights\./, heading: "Insights" },
        { label: /^Merchant settings\./, heading: "Merchant settings" },
      ]) {
        await page.getByRole("button", { name: tile.label }).first().click();
        await expect(page.getByText(tile.heading, { exact: true }).first()).toBeVisible();
        await back(page);
        await expect(page.getByText("Manage menu").first()).toBeVisible();
      }

      // Menu: the add button opens the dish editor; the tab root has no back arrow.
      await openTab(page, "Menu");
      await expect(page.getByRole("button", { name: "Go back" })).toHaveCount(0);
      await page.getByRole("button", { name: "Add menu item" }).first().click();
      await expect(page.getByText("Dish name *").first()).toBeVisible();
      await back(page);

      // Performance: the three ranges respond and the choice sticks across tabs.
      await openTab(page, "Performance");
      await expect(page.getByRole("button", { name: "Go back" })).toHaveCount(0);
      // Tabs stay mounted, so only the chips that are on screen count.
      for (const range of ["Today", "7 days", "30 days"]) {
        await page
          .getByRole("button", { name: range, exact: true })
          .locator("visible=true")
          .click();
      }
      await openTab(page, "Home");
      await expect(
        page
          .getByText(/vs previous 30 days/)
          .locator("visible=true")
          .first(),
      ).toBeVisible();

      // Profile: stall data only, and Contact opens the editor.
      await openTab(page, "Profile");
      await expect(page.getByRole("button", { name: "Go back" })).toHaveCount(0);
      await page
        .getByRole("button", { name: /^Contact:/ })
        .first()
        .click();
      await expect(page.getByText("Business profile").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Save profile" }).first()).toBeVisible();
      await back(page);
    });
  }
});
