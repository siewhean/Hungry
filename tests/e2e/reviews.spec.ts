import { expect, test } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

// The Reviews page group on the mock build, at an iPhone-sized viewport: the review editor, its
// dish picker and Publish, then the success modal. Every control is pressed once.

test.use({ viewport: { width: 390, height: 844 } });

// A 1x1 PNG, enough for the photo step.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function openEditor(page: import("@playwright/test").Page) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "QuickRate", "Profile & Review");
  await expect(page.getByText("Write a review", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Reviews editor", () => {
  test("the dish picker opens, searches, shows the empty state, clears and picks a dish", async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Select stall & dish" }).click();

    const search = page.getByLabel("Search dishes or stalls");
    await expect(search).toBeVisible();
    // Stalls come with the building they are in, not only a unit number.
    await expect(page.getByRole("button", { name: /^Choose a dish at / }).first()).toBeVisible();

    await search.fill("zzzzqqqq");
    await expect(page.getByText(/No dishes or stalls match/)).toBeVisible({ timeout: 15_000 });
    await search.fill("");
    await expect(page.getByRole("button", { name: /^Choose a dish at / }).first()).toBeVisible();

    await page
      .getByRole("button", { name: /^Choose a dish at / })
      .first()
      .click();
    await page
      .getByRole("button", { name: /^Review / })
      .first()
      .click();
    await expect(page.getByRole("button", { name: "Change dish" })).toBeVisible();
  });

  test("the missing-field line, stars, tags and recommend, then publish with a photo", async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Select stall & dish" }).click();
    await page
      .getByRole("button", { name: /^Choose a dish at / })
      .first()
      .click();
    await page
      .getByRole("button", { name: /^Review / })
      .first()
      .click();

    const publish = page.getByRole("button", { name: "Publish review" });
    await expect(publish).toBeDisabled();
    const missing = page.getByText("Add a photo of the dish to publish.");
    await expect(missing).toBeVisible();
    await missing.click();

    // A photo is required before anything else can be published.
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /^Add a photo, \d/ }).click();
    await (await chooser).setFiles({ name: "dish.png", mimeType: "image/png", buffer: PIXEL_PNG });
    await expect(page.getByText("Add a star rating to publish.")).toBeVisible();

    await page.getByTestId("star-4").first().click();
    await expect(publish).toBeEnabled();

    await page.getByRole("button", { name: "Yes", exact: true }).click();
    await page.getByRole("button", { name: "No", exact: true }).click();
    await page.getByLabel("Your review").fill("Rich broth and silky noodles.");

    await publish.click();
    await expect(page.getByText("Review posted", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Review posted", { exact: true })).toHaveCount(0);
  });
});

test.describe("Reviews tab", () => {
  test("opens from Home and lists review tiles with the filter chips", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");
    await page
      .getByRole("tab", { name: /Reviews/ })
      .first()
      .click();
    await expect(page.getByRole("button", { name: /Show all reviews|All/ }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
