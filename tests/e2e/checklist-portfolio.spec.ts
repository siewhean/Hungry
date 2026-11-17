import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

test.describe("checklist and portfolio critical flows", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Checklist and portfolio flows are covered once on desktop Chromium.",
    );
  });

  test("creates a checklist from the profile quick access menu", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Profile", "Profile & Review");

    await page.getByRole("button", { name: "Open quick access" }).click();
    await page.getByRole("button", { name: "My Checklists" }).click();
    await expect(page.getByText("My Checklists", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /Create Checklist|Create/ }).first().click();
    await expect(page.getByText("Checklist", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Checklist name", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Checklist name")).toHaveValue("New Checklist");
  });

  test("creates and publishes a portfolio from the profile quick access menu", async ({ page }) => {
    const portfolioName = `E2E Portfolio ${Date.now()}`;

    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Profile", "Profile & Review");

    await page.getByRole("button", { name: "Open quick access" }).click();
    await page.getByRole("button", { name: "Hungry Portfolios" }).click();
    await expect(page.getByText("Hungry Portfolios", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Create portfolio" }).first().click();
    await page.getByPlaceholder("e.g. Best laksa nearby").fill(portfolioName);
    await page.getByPlaceholder("What makes this list useful?").fill("Created by E2E smoke.");
    await page.getByRole("button", { name: "Create portfolio" }).click();

    await expect(page.getByText("Hungry Portfolio", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue(portfolioName);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Published" }).first()).toBeVisible();
  });
});
