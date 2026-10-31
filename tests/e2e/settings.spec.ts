import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

// Round-four Settings walk: every row opens the right screen, sheet or dialog, toggles flip, and
// nothing overflows at phone widths (390 and 320). Mock data, desktop Chromium resized to a phone.

const WIDTHS = [390, 320];

async function openSettings(page: Page, width: number) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Profile", "Profile & Review");
  await page.setViewportSize({ width, height: 800 });
  await expect(page.getByText("Taste Fingerprint", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /^Open quick access/ }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Privacy & data" })).toBeVisible();
}

/** Confirms the next browser dialog (the web build asks with confirm()) and returns its text. */
function acceptNextDialog(page: Page) {
  const asked = { message: "" };
  page.once("dialog", async (dialog) => {
    asked.message = dialog.message();
    await dialog.accept();
  });
  return asked;
}

test.describe("settings page walk", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The settings walk runs once on desktop Chromium at phone widths.",
    );
  });

  for (const width of WIDTHS) {
    test(`fits ${width}pt: profile card on top, six sections, no horizontal scroll`, async ({
      page,
    }) => {
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(error.message));
      await openSettings(page, width);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await expect(page.getByRole("button", { name: /^Edit profile, / })).toBeVisible();
      for (const title of [
        "Privacy & data",
        "Account & security",
        "On this phone",
        "Help & legal",
      ]) {
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
      }
      // Phone-permission rows are native only.
      await expect(page.getByRole("button", { name: "Phone permissions" })).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  }

  test("the profile card opens Edit profile", async ({ page }) => {
    await openSettings(page, 390);
    await page.getByRole("button", { name: /^Edit profile, / }).click();
    await expect(page.getByLabel(/Display name|Name/i).first()).toBeVisible();
  });

  test("there is no app Theme or Reduce motion row (iOS owns both)", async ({ page }) => {
    await openSettings(page, 390);
    await expect(page.getByRole("button", { name: "Theme" })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Reduce motion" })).toHaveCount(0);
  });

  test("Profile visibility saves from its sheet", async ({ page }) => {
    await openSettings(page, 390);
    await page.getByRole("button", { name: "Profile visibility" }).click();
    await page.getByRole("radio", { name: "Private" }).click();
    await expect(page.getByRole("button", { name: "Profile visibility" })).toContainText("Private");
  });

  test("switches flip when tapped", async ({ page }) => {
    await openSettings(page, 390);
    for (const name of ["Share usage analytics", "Allow search history", "Haptic feedback"]) {
      const row = page.getByRole("switch", { name });
      const before = await row.getAttribute("aria-checked");
      await row.click();
      await expect(row).not.toHaveAttribute("aria-checked", before ?? "");
    }
  });

  test("Contact us offers email or the help centre", async ({ page }) => {
    await openSettings(page, 390);
    await page.getByRole("button", { name: "Contact us" }).click();
    await expect(page.getByRole("button", { name: "Email us" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Help centre" })).toBeVisible();
  });

  test("Clear local cache and Sign out of all devices ask first, then act", async ({ page }) => {
    await openSettings(page, 390);

    const clearAsked = acceptNextDialog(page);
    await page.getByRole("button", { name: "Clear local cache" }).click();
    await expect.poll(() => clearAsked.message).toContain("Clear local cache");

    const signOutAsked = acceptNextDialog(page);
    await page.getByRole("button", { name: "Sign out of all devices" }).click();
    await expect.poll(() => signOutAsked.message).toContain("Sign out of all devices");
    await expect(page.getByText("Signed out of all devices.").first()).toBeVisible();
  });

  test("Delete account shows the dialog, the optional reason and Download my data first", async ({
    page,
  }) => {
    await openSettings(page, 390);
    await page.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByText("Why are you leaving? (optional)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Download my data first" })).toBeVisible();
    await page.getByRole("button", { name: "Privacy concerns" }).click();
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText("Confirm it's you")).toBeVisible();
  });
});
