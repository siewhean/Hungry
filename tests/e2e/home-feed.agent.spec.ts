import { test, expect } from "./fixtures";
import {
  assertNoBrokenImages,
  assertNoCrashOrMissingData,
  assertNoNetwork500s,
  capturePageEvidence,
  collectNetwork500s,
  gradeInteractiveElements,
} from "./helpers/pageAgent";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

const CONTENT_TIMEOUT_MS = 30_000;

test.describe("page agent: Home Feed", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Page-agent baseline runs on Chromium.");
  });

  test("guest entry reaches login and explicit Home launch renders feed safely", async ({
    page,
  }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await resetAppState(page);
    await page.getByRole("button", { name: "Open normal app flow" }).click();
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });

    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");
    await expect(page.getByTestId("home-social-feed")).toBeVisible({ timeout: CONTENT_TIMEOUT_MS });
    await expect(page.getByText(/Recommended for you|Following|Popular/i).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await gradeInteractiveElements(page, 3);
    await assertNoBrokenImages(page);
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Home Feed", "cycle-0-baseline");
  });

  test("authenticated feed card actions and profile navigation are interactive", async ({
    page,
  }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");
    await expect(page.getByTestId("home-social-feed")).toBeVisible({ timeout: CONTENT_TIMEOUT_MS });

    const saveButton = page.getByRole("button", { name: /^Save / }).first();
    await expect(saveButton).toBeVisible({ timeout: CONTENT_TIMEOUT_MS });
    const initialUnsaveCount = await page.getByRole("button", { name: /^Unsave / }).count();
    await saveButton.click();
    await expect(page.getByRole("button", { name: /^Unsave / })).toHaveCount(
      initialUnsaveCount + 1,
    );

    const likeButton = page.getByRole("button", { name: /^Like / }).first();
    await expect(likeButton).toBeVisible();
    const initialUnlikeCount = await page.getByRole("button", { name: /^Unlike / }).count();
    await likeButton.click();
    await expect(page.getByRole("button", { name: /^Unlike / })).toHaveCount(
      initialUnlikeCount + 1,
    );

    await page.getByRole("button", { name: /^Open .* profile$/ }).first().click();
    await expect(page.getByText(/posts|followers|following/i).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Home Feed", "cycle-1-actions");
  });
});
