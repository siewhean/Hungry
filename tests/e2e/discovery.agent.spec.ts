import { test, expect } from "./fixtures";
import {
  assertNoBrokenImages,
  assertNoCrashOrMissingData,
  assertNoNetwork500s,
  capturePageEvidence,
  collectNetwork500s,
  gradeInteractiveElements,
} from "./helpers/pageAgent";
import { clickDevButton, startOnboardedMockSession } from "./helpers/app";

const CONTENT_TIMEOUT_MS = 30_000;

test.describe("page agent: Discovery", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Page-agent baseline runs on Chromium.");
  });

  test("authenticated user can open discovery with populated local decision sections", async ({
    page,
  }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Discover", "Core app flow");

    await expect(page.getByText("Popular right now", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await expect(page.getByText(/places to eat in this area/i).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await expect(page.getByRole("button", { name: /^Quick bite:/ }).first()).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Open .* at / }).first()).toHaveCount(1);
    await gradeInteractiveElements(page, 4);
    await assertNoBrokenImages(page);
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Discovery", "cycle-0-baseline");
  });

  test("search entry opens searchable dish and stall surface", async ({ page }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Discover", "Core app flow");
    await page
      .getByRole("button", { name: "Search dishes, stalls, or hawker centres" })
      .first()
      .click();
    await expect(page.getByRole("button", { name: "View search results" }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await page.getByPlaceholder("Laksa, satay, Tian Tian...").first().fill("laksa");
    await page.getByRole("button", { name: "View search results" }).first().click();
    await expect(page.getByRole("button", { name: /Open .*laksa/i }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await assertNoBrokenImages(page);
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Discovery", "cycle-1-search");
  });

  test("dish and stall discovery cards navigate to detail surfaces", async ({ page }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Discover", "Core app flow");
    await expect(page.getByText("Popular right now", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });

    await page
      .getByRole("button")
      .filter({ hasText: "Chicken Rice" })
      .filter({ hasText: "Tian Tian Chicken Rice" })
      .first()
      .click();
    await expect(page.getByText("Opening Hours", { exact: true }).first()).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await expect(page.getByText("Signature Dishes", { exact: true }).first()).toBeVisible();
    await assertNoCrashOrMissingData(page);

    await page.getByRole("button", { name: /Open Tian Tian Chicken Rice stall details/i }).click();
    await expect(page.getByRole("button", { name: "Share stall" })).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await expect(page.getByText("Menu", { exact: true }).first()).toBeVisible();
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Discovery", "cycle-1-navigation");
  });
});
