import { expect, test, type Page } from "@playwright/test";

const stagingEmail = process.env.PLAYWRIGHT_STAGING_EMAIL?.trim();
const stagingPassword = process.env.PLAYWRIGHT_STAGING_PASSWORD?.trim();
const hasStagingAccount = Boolean(stagingEmail && stagingPassword);

async function authenticateFromFreshInstall(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Sign in to existing account" }).click();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Email address").fill(stagingEmail ?? "");
  await page.getByPlaceholder("Password").fill(stagingPassword ?? "");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Discover", { exact: true })).toBeVisible({ timeout: 60_000 });
}

test.describe("authenticated Excel fallback on a deployed staging build", () => {
  test.skip(
    !hasStagingAccount,
    "Set PLAYWRIGHT_STAGING_EMAIL and PLAYWRIGHT_STAGING_PASSWORD against a staging base URL.",
  );

  test("catalog RPC outage falls back to Excel only after authentication", async ({ page }) => {
    // Home reads the discovery feed and Search reads the catalog RPCs; the redesigned Home
    // hands off to the offline (Excel) Home only when its feed is down too.
    await page.route(
      /\/rest\/v1\/rpc\/(catalog_raw_|get_discovery_feed_by_location)/,
      async (route) => {
        await route.abort("failed");
      },
    );

    await authenticateFromFreshInstall(page);
    // The Discover tab is labelled Home since the Stitch redesign.
    await page.getByText("Home", { exact: true }).click();

    await expect(page.getByTestId("catalog-source-excel")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Offline catalog", { exact: true })).toBeVisible();
    await expect(page.getByText("Nearby dishes", { exact: true })).toBeVisible();
    // "Stalls near you" only with a GPS fix or a picked area; a fresh install has neither.
    await expect(page.getByText(/^Stalls( near you)?$/)).toBeVisible();

    const imageSources = await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .map((image) => image.getAttribute("src") ?? "")
          .filter((source) => source.length > 0),
      );
    expect(imageSources.some((source) => /unsplash|picsum/i.test(source))).toBe(false);
  });

  test("a successful no-results search remains empty instead of substituting Excel rows", async ({
    page,
  }) => {
    await authenticateFromFreshInstall(page);
    // The Discover tab is labelled Home since the Stitch redesign.
    await page.getByText("Home", { exact: true }).click();
    // Supabase builds show the redesigned Home (DiscoverHomeScreen), not the catalog Home.
    await expect(page.getByText("Hawker classics", { exact: true })).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: "Browse dishes" }).click();
    await page.getByPlaceholder("Search all dishes").fill("zzzz-no-such-hungry-dish-2026");
    await expect(page.getByText("No matches found", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Offline catalog", { exact: true })).toHaveCount(0);
  });
});
