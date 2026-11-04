import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

test.describe("checklist and portfolio critical flows", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Checklist and portfolio flows are covered once on desktop Chromium.",
    );
  });

  test("creates a checklist from the Saved area", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Profile", "Profile & Review");

    // Saved is the one entry point (R4); its Lists section reaches Checklists and the lists hub.
    await page.getByRole("button", { name: /^Saved \d+/ }).click();
    await page.getByRole("tab", { name: "Saved lists" }).click();
    await page.getByRole("button", { name: "Checklists", exact: true }).click();
    await expect(page.getByText("My checklists", { exact: true }).first()).toBeVisible();

    await page
      .getByRole("button", { name: /Create checklist|Create/i })
      .first()
      .click();
    await expect(page.getByText("Checklist", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Checklist name", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Checklist name")).toHaveValue("New Checklist");
  });

  test("creates and publishes a portfolio from the Saved area", async ({ page }) => {
    const portfolioName = `E2E Portfolio ${Date.now()}`;

    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Profile", "Profile & Review");

    await page.getByRole("button", { name: /^Saved \d+/ }).click();
    await page.getByRole("tab", { name: "Saved lists" }).click();
    await page.getByRole("button", { name: "Shared and followed lists" }).click();
    await expect(
      page.getByText("Your lists", { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Create list" })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByPlaceholder("e.g. Best laksa nearby").fill(portfolioName);
    await page.getByPlaceholder("What makes this list useful?").fill("Created by E2E smoke.");
    await page
      .getByRole("button", { name: "Create list" })
      .filter({ visible: true })
      .last()
      .click();

    // The list name is the screen title (the list card behind it stays mounted but hidden).
    await expect(
      page.getByText(portfolioName, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();

    // Publishing asks first; once live the toggle offers Unpublish.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Publish this list?", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).last().click();
    await expect(
      page.getByRole("button", { name: "Unpublish", exact: true }).first(),
    ).toBeVisible();
  });
});
