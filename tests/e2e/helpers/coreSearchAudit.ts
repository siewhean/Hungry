import { expect, type Page, type TestInfo } from "@playwright/test";

import { clickDevButton, resetAppState, startOnboardedMockSession } from "./app";
import { assertRenderedImagesAreHealthy, captureVisualEvidence } from "./visualAudit";

export async function runCoreSearchAudit(page: Page, testInfo: TestInfo) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Search", "Core app flow");

  const entry = page.locator('input[placeholder="Laksa, satay, Tian Tian..."]:visible').first();
  await expect(entry).toBeVisible();
  await entry.fill("Chicken Rice");
  await entry.press("Enter");

  const searchInput = page.getByRole("textbox", { name: "Search results", exact: true });
  await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toHaveValue("Chicken Rice");

  const result = page.getByRole("button", {
    name: /^Open Chicken Rice at Tian Tian Chicken Rice, Local, S\$5\.50 – S\$7\.00, 180 m away$/,
  });
  await expect(result).toBeVisible();
  await expect(result.getByText("Tian Tian Chicken Rice", { exact: true })).toBeVisible();
  await expect(result.getByText("Local", { exact: true })).toBeVisible();
  await expect(result.getByText("180 m", { exact: true })).toBeVisible();
  await expect(result.getByText("S$5.50 – S$7.00", { exact: true })).toBeVisible();
  await assertRenderedImagesAreHealthy(page);
  await captureVisualEvidence(page, testInfo, "search-results-chicken-rice");

  await result.click();
  const openStall = page.getByRole("button", {
    name: "Open Tian Tian Chicken Rice stall details",
  });
  await expect(openStall).toBeVisible();
  await captureVisualEvidence(page, testInfo, "search-dish-detail");

  await openStall.click();
  await expect(
    page.getByText("Save this stall", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await assertRenderedImagesAreHealthy(page);
  await captureVisualEvidence(page, testInfo, "search-stall-detail");
}
