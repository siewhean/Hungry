import { expect, type Page, type TestInfo } from "@playwright/test";

import { captureVisualEvidence } from "./visualAudit";

const PRODUCTION_SESSION = {
  state: {
    isAuthenticated: true,
    authenticatedUserId: "00000000-0000-4000-8000-000000000106",
    authDataSource: "supabase",
    hasCompletedOnboarding: true,
    hasSkippedTasteQuiz: true,
  },
  version: 0,
};

export async function runProductionBoundaryAudit(page: Page, testInfo: TestInfo) {
  await page.addInitScript((session) => {
    window.localStorage.setItem("hungry-session-v1", JSON.stringify(session));
  }, PRODUCTION_SESSION);

  await page.route("https://example.supabase.co/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Production boundary audit: service unavailable" }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Developer Launcher", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Something went wrong", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("We couldn't load your feed right now.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.getByText("Chicken Rice", { exact: true })).toHaveCount(0);
  await expect(page.getByText("S$5.50 – S$7.00", { exact: true })).toHaveCount(0);
  await captureVisualEvidence(page, testInfo, "production-home-recovery");

  const discoverTab = page.getByRole("button", { name: "Discover", exact: true });
  await expect(discoverTab).toHaveCount(1);
  await discoverTab.click();

  await expect(page.getByText("Live discovery unavailable", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("No sample dishes were substituted.", { exact: false }),
  ).toBeVisible();
  for (const tabName of ["Home", "Discover", "Create post", "Review", "Profile"]) {
    await expect(page.getByRole("button", { name: tabName, exact: true })).toBeVisible();
  }
  await expect(page.getByText("Chicken Rice", { exact: true })).toHaveCount(0);
  await expect(page.getByText("S$5.50 – S$7.00", { exact: true })).toHaveCount(0);
  await captureVisualEvidence(page, testInfo, "production-discover-recovery");

  const retryButton = page.getByRole("button", { name: "Retry", exact: true });
  await expect(retryButton).toHaveCount(1);
  await retryButton.click();
  await expect(page.getByText("Live discovery unavailable", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
