import { expect, test } from "./fixtures";

const CONTENT_TIMEOUT_MS = 30_000;

async function clearSignedOutState(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    if ("indexedDB" in window && indexedDB.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map(
          (database) =>
            new Promise<void>((resolve) => {
              if (!database.name) return resolve();
              const request = indexedDB.deleteDatabase(database.name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }),
        ),
      );
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

test.describe("guest mode is prohibited", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Mandatory-auth route smoke is covered once on desktop Chromium.",
    );
  });

  test("fresh install exposes onboarding and account authentication, not guest browsing", async ({
    page,
  }) => {
    await clearSignedOutState(page);

    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible({
      timeout: CONTENT_TIMEOUT_MS,
    });
    await expect(page.getByText(/Continue as Guest/i)).toHaveCount(0);
    await expect(page.getByText(/Skip login/i)).toHaveCount(0);
    await expect(page.getByText(/Continue without an account/i)).toHaveCount(0);
    await expect(page.getByText("Home", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Discover", { exact: true })).toHaveCount(0);
  });

  test("signed-out dish, venue, and create links cannot expose app content", async ({ page }) => {
    await clearSignedOutState(page);
    await page.getByRole("button", { name: "Sign in to existing account" }).click();
    await expect(page.getByText("Sign in to Hungry", { exact: true })).toBeVisible();
    await expect(page.getByText(/Continue without an account/i)).toHaveCount(0);

    for (const path of ["/dish/dish-chicken-rice", "/venue/venue-test", "/order"]) {
      await page.goto(path);
      await expect(page.getByText("Sign in to Hungry", { exact: true })).toBeVisible({
        timeout: CONTENT_TIMEOUT_MS,
      });
      await expect(page.getByText("Chicken Rice", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Discover", { exact: true })).toHaveCount(0);
    }
  });
});
