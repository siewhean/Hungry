import { test, expect } from "./fixtures";
import { type Page } from "@playwright/test";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

/**
 * Owner acceptance scenario for the Food Portfolio (audit 2026-11-10, decisions D1 to D4):
 * "my best chicken rice at Stall A", "my favourite laksa at Stall B", a top pick overall, and a
 * diary that keeps every entry when a favourite changes.
 *
 * Expected to FAIL until the redesign (roadmap Phase 2) ships "My bests" and the
 * "Make this my best <dish type>" switch. Playwright reports an expected failure as passing and
 * flags this test the day it starts passing: then remove `test.fail` below.
 * The redesign PR also adds two more chicken rice stalls and a curry puff to the mock catalog so
 * the full scenario (three chicken rice, two laksa, one curry puff) can be walked here.
 */

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function openFoodPortfolio(page: Page) {
  await clickDevButton(page, "Profile", "Profile & Review");
  const portfolio = page.getByTestId("food-portfolio-section");
  await portfolio.scrollIntoViewIfNeeded();
  await expect(portfolio).toBeVisible();
  return portfolio;
}

/** Posts one dish through the Food Portfolio composer, optionally as the best of its dish type. */
async function addDish(page: Page, dish: string, stall: string, options?: { best?: string }) {
  const portfolio = await openFoodPortfolio(page);
  await portfolio.getByRole("button", { name: /Post a dish/ }).click();
  await page.getByLabel("Find a dish to post about").fill(dish);
  const row = page.getByText(stall).first();
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "Choose" }).first().click();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add post media" }).click();
  await (await chooser).setFiles({ name: "dish.png", mimeType: "image/png", buffer: PIXEL_PNG });

  if (options?.best) {
    // Target UI (D1): the switch names the dish type it would make this entry the best of.
    await page.getByRole("switch", { name: `Make this my best ${options.best}` }).click();
  }
  await page.getByRole("button", { name: "Publish post" }).click();
}

test.describe("Food Portfolio acceptance", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Walked once on desktop Chromium.");
  });

  test("a best per dish type, changed later without losing the entry", async ({ page }) => {
    test.fail(true, "Waiting on the Food Portfolio redesign (roadmap Phase 2).");

    await resetAppState(page);
    await startOnboardedMockSession(page);

    await addDish(page, "Chicken Rice", "Tian Tian Chicken Rice", { best: "chicken rice" });
    await addDish(page, "Signature Laksa", "Katong Laksa Maxwell", { best: "laksa" });

    const portfolio = await openFoodPortfolio(page);
    const bests = portfolio.getByTestId("food-portfolio-bests");
    await expect(bests.getByText("Best chicken rice")).toBeVisible();
    await expect(bests.getByText("Tian Tian Chicken Rice")).toBeVisible();
    await expect(bests.getByText("Best laksa")).toBeVisible();
    await expect(bests.getByText("Katong Laksa Maxwell")).toBeVisible();

    // Changing the favourite laksa keeps the old entry in the diary.
    await addDish(page, "Signature Laksa", "Tian Tian Chicken Rice", { best: "laksa" });
    const after = await openFoodPortfolio(page);
    await expect(
      after.getByTestId("food-portfolio-bests").getByText("Katong Laksa Maxwell"),
    ).toHaveCount(0);
    await expect(
      after.getByTestId("food-portfolio-diary").getByText("Katong Laksa Maxwell"),
    ).toBeVisible();
  });
});
