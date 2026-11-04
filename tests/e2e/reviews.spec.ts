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

    // One Publish, in the header; the optional parts sit under a fold.
    const publish = page.getByRole("button", { name: "Publish", exact: true });
    await expect(publish).toBeDisabled();
    // A star rating is the one thing still needed; a photo is optional (sh, 2026-11-04).
    await expect(page.getByText("Add a photo of the dish to publish.")).toHaveCount(0);
    const missing = page.getByText("Add a star rating to publish.");
    await expect(missing).toBeVisible();
    await missing.click();

    await page.getByTestId("star-4").first().click();
    await expect(publish).toBeEnabled();

    // A photo can still be added.
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /^Add a photo, \d/ }).click();
    await (await chooser).setFiles({ name: "dish.png", mimeType: "image/png", buffer: PIXEL_PNG });

    await page.getByRole("button", { name: "Add more detail (optional)" }).click();
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
  test("opens from Home and lists review tiles and the section tabs", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");
    await page
      .getByRole("tab", { name: /Reviews/ })
      .first()
      .click();
    // Review tiles, the All / For you tabs (taste diners) or the filter chips (anyone else).
    await expect(
      page
        .getByTestId(/^review-tile-/)
        .or(page.getByRole("tablist", { name: "Review sections" }))
        .or(page.getByRole("button", { name: /Show all reviews/ }))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
