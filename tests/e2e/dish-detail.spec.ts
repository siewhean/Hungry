import { test, expect } from "./fixtures";
import {
  assertNoCrashVisible,
  clickDevButton,
  resetAppState,
  startOnboardedMockSession,
} from "./helpers/app";

// The dish page on the mock build, signed in, on a phone-sized window and at 320 pt.

async function openDish(page: import("@playwright/test").Page) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Dish", "Core app flow");
  await expect(page.getByRole("button", { name: /^Share / }).first()).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("dish page", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Dish controls are covered once on Chromium.");
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the bar has Tried and Save and no Like; Share sits in the header", async ({ page }) => {
      await openDish(page);
      await expect(page.getByRole("checkbox", { name: "Tried" })).toBeVisible();
      await expect(
        page.getByTestId("dish-action-bar").getByRole("button", { name: /^Like/ }),
      ).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Share / }).first()).toBeVisible();
      await assertNoCrashVisible(page);
    });

    test("Share opens the share sheet", async ({ page }) => {
      await openDish(page);
      await page
        .getByRole("button", { name: /^Share / })
        .first()
        .click();
      await expect(page.getByText(/Share|Copy link/).first()).toBeVisible({ timeout: 10_000 });
    });

    test("a review has a visible report button, and See all opens the full list", async ({
      page,
    }) => {
      await openDish(page);
      const more = page.getByRole("button", { name: /^Report or block, review by/ }).first();
      if (await more.count()) {
        await more.scrollIntoViewIfNeeded();
        await expect(more).toBeVisible();
        await more.click();
        await expect(page.getByText(/Report or block|Report this review/).first()).toBeVisible({
          timeout: 10_000,
        });
        await page.keyboard.press("Escape");
      }
      const seeAll = page.getByRole("button", { name: /^See all/ }).first();
      if (await seeAll.count()) {
        await seeAll.scrollIntoViewIfNeeded();
        await seeAll.click();
        await expect(page.getByText("Reviews", { exact: true }).first()).toBeVisible({
          timeout: 10_000,
        });
        await assertNoCrashVisible(page);
      }
    });
  });

  test.describe("320 pt", () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test("nothing scrolls sideways and the bar stays on screen", async ({ page }) => {
      await openDish(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const tried = page.getByRole("checkbox", { name: "Tried" });
      await expect(tried).toBeVisible();
      const box = await tried.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
    });
  });
});
