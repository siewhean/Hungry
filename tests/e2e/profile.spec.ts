import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

// Round-four profile walk: every control on the own profile opens the right screen, at phone
// widths (375 and 320). Mock data, desktop Chromium resized to a phone.

const WIDTHS = [375, 320];

async function openProfile(page: Page, width: number) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Profile", "Profile & Review");
  // The launcher is laid out for desktop; the profile is what runs at phone width.
  await page.setViewportSize({ width, height: 800 });
  await expect(page.getByText("Taste Fingerprint", { exact: true }).first()).toBeVisible();
}

test.describe("profile page walk", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The profile walk runs once on desktop Chromium at phone widths.",
    );
  });

  for (const width of WIDTHS) {
    test(`fits ${width}pt and Saved opens the one saved area`, async ({ page }) => {
      await openProfile(page, width);

      // No page-wide horizontal scroll at this width.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await page.getByRole("button", { name: /^Saved \d+/ }).click();
      await expect(page.getByRole("tab", { name: "Saved dishes" })).toBeVisible();
    });
  }

  for (const width of WIDTHS) {
    test(`stat labels are whole words at ${width}pt (one line, or two by two when narrow)`, async ({
      page,
    }) => {
      await openProfile(page, width);
      const row = page.getByTestId("profile-follow-counts");
      for (const label of ["Saved", "Followers", "Following"]) {
        const text = row.getByText(label, { exact: true });
        const box = await text.boundingBox();
        expect(box, `${label} is on screen`).not.toBeNull();
        // One line of the 12pt label is 16-18pt tall; a word broken over two lines would be 32+.
        expect(box!.height).toBeLessThanOrEqual(20);
        // Not cut off: the label's text fits its own box.
        const clipped = await text.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(clipped, `${label} is not cut to an ellipsis`).toBe(false);
      }
    });
  }

  test("Followers opens a searchable list", async ({ page }) => {
    await openProfile(page, 375);
    await page.getByRole("button", { name: /^Followers/ }).click();
    await expect(
      page.getByLabel("Search followers").filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("the quick access menu has one close control and a sign-out that asks first", async ({
    page,
  }) => {
    await openProfile(page, 375);

    await page.getByRole("button", { name: /^Open quick access/ }).click();
    await expect(page.getByRole("button", { name: "Close quick access" })).toHaveCount(1);

    // Sign out asks (the browser confirm on web); dismissing keeps you signed in.
    let asked = "";
    page.once("dialog", async (dialog) => {
      asked = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect.poll(() => asked).toContain("Sign out");
    await expect(page.getByText("Taste Fingerprint", { exact: true }).first()).toBeVisible();
  });

  test("Edit profile with a draft asks before leaving", async ({ page }) => {
    await openProfile(page, 375);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const nameInput = page.getByLabel(/Display name|Name/i).first();
    await nameInput.fill("Wei Ming Edited");

    let asked = "";
    page.once("dialog", async (dialog) => {
      asked = dialog.message();
      await dialog.dismiss();
    });
    // The form has Cancel in the header where the back arrow was.
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.poll(() => asked).toContain("Discard changes?");
    await expect(nameInput).toHaveValue("Wei Ming Edited");
  });
});
