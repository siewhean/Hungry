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

test.describe("page agent: Profile", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Page-agent baseline runs on Chromium.");
  });

  test("guest profile route is protected", async ({ page }) => {
    await resetAppState(page);
    await assertProtectedRouteRedirects(page, async () => {
      await clickDevButton(page, "Profile", "Profile & Review");
    });
  });

  test("authenticated profile account actions are reachable", async ({ page }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Profile", "Profile & Review");
    if (!(await page.getByTestId("profile-home-screen").first().isVisible().catch(() => false))) {
      await page.getByRole("button", { name: "Profile" }).last().click();
    }
    await expect(page.getByTestId("profile-home-screen").first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await gradeInteractiveElements(page, 4);
    await assertNoBrokenImages(page);
    await capturePageEvidence(page, testInfo, "Profile", "cycle-0-profile");

    await startOnboardedMockSession(page);
    await clickDevButton(page, "Settings", "Profile & Review");
    await expect(page.getByText("ACCOUNT", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
    const signOutRow = page.getByText("Sign out", { exact: true }).last();
    await signOutRow.scrollIntoViewIfNeeded();
    await expect(signOutRow).toBeVisible();
    await assertNoBrokenImages(page);
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Profile", "cycle-1-settings");
  });
});
