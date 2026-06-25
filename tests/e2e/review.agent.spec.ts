import { test, expect } from "./fixtures";
import {
  assertNoBrokenImages,
  assertNoCrashOrMissingData,
  assertNoNetwork500s,
  assertProtectedRouteRedirects,
  capturePageEvidence,
  collectNetwork500s,
  gradeInteractiveElements,
} from "./helpers/pageAgent";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

const CONTENT_TIMEOUT_MS = 30_000;

test.describe("page agent: Review", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Page-agent baseline runs on Chromium.");
  });

  test("guest quick review action is protected", async ({ page }) => {
    await resetAppState(page);
    await assertProtectedRouteRedirects(page, async () => {
      await clickDevButton(page, "QuickRate", "Profile & Review");
    });
  });

  test("authenticated review feed and review composer controls are usable", async ({
    page,
  }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Review", "Core app flow");
    await expect(page.getByText("Reviews", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await gradeInteractiveElements(page, 3);
    await assertNoBrokenImages(page);
    await capturePageEvidence(page, testInfo, "Review", "cycle-0-feed");

    await startOnboardedMockSession(page);
    await clickDevButton(page, "QuickRate", "Profile & Review");
    await expect(page.getByText("Caption", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await page.getByRole("button", { name: "Select Stall & Dish" }).first().click();
    await page.getByText("Tian Tian Chicken Rice", { exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Change" }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await page.getByRole("button", { name: "4 star" }).first().click();
    await page.getByPlaceholder("What made this dish special?").first().fill(
      "Reliable page-agent review.",
    );
    await expect(page.getByRole("button", { name: "Publish Review" }).first()).toBeEnabled();
    await assertNoBrokenImages(page);
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Review", "cycle-1-composer");
  });
});
