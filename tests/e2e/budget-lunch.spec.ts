import { test, expect } from "./fixtures";
import { clickDevButton, resetAppState, startOnboardedMockSession } from "./helpers/app";

test.use({
  video: "off",
  trace: "off",
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 1.2813, longitude: 103.8458 },
  permissions: ["geolocation"],
});

test.beforeEach(async ({ page }) => {
  await resetAppState(page);
  await startOnboardedMockSession(page);
});

test("budget discovery is reachable from Discover and changes the inclusive maximum", async ({
  page,
}, info) => {
  await clickDevButton(page, "Discover", "Core app flow");
  const budgetLink = page
    .getByLabel(/^See all budget dishes/)
    .filter({ visible: true })
    .first();
  await budgetLink.scrollIntoViewIfNeeded();
  await budgetLink.click();
  const enableLocation = page.getByRole("button", { name: "Enable location", exact: true });
  if (await enableLocation.isVisible()) await enableLocation.click();
  await expect(page.getByTestId("budget-maximum-controls")).toBeVisible();
  await expect(page.getByText("Listed items up to S$8.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Maximum listed item price S$5", exact: true }).click();
  await expect(page.getByText("Listed items up to S$5.00", { exact: true })).toBeVisible();
  const budgetCards = page.getByRole("button", { name: /^Open .+ at / });
  await expect.poll(() => budgetCards.count()).toBeGreaterThan(0);
  for (const card of await budgetCards.all()) {
    const price = (await card.innerText()).match(/S\$(\d+(?:\.\d+)?)/);
    expect(price).not.toBeNull();
    expect(Number(price![1])).toBeGreaterThan(0);
    expect(Number(price![1])).toBeLessThanOrEqual(5);
  }
  await page.getByRole("button", { name: "Maximum listed item price S$10", exact: true }).click();
  await expect(page.getByText("Listed items up to S$10.00", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Listed item prices; portions and dine-in prices may vary."),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("budget-mobile.png"), fullPage: true });
});

test("lunch requires a chosen location and keeps budget and radius explicit", async ({
  page,
}, info) => {
  await clickDevButton(page, "Wheel", "Core app flow");
  await expect(page.getByText("Choose a location first", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lunch budget S$5", exact: true }).click();
  await expect(page.getByText(/Effective maximum S\$5.00/)).toBeVisible();
  await page.getByRole("button", { name: "Enable location", exact: true }).click();
  await expect(page.getByText("Choose a location first", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lunch radius 3000 metres", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lunch radius 3000 metres", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/Walking routes, queue and preparation/)).toBeVisible();
  await expect(page.getByText("Finding matching dishes…", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Effective maximum S\$5.00/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("lunch-mobile.png"), fullPage: true });
});

test("a stricter profile budget produces an honest empty shortlist without relaxing limits", async ({
  page,
}, info) => {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage).filter((key) =>
      key.startsWith("hungry-profile-v2:"),
    )) {
      const value = JSON.parse(localStorage.getItem(key)!);
      value.state.profile.maxDishBudget = 0.01;
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await clickDevButton(page, "Wheel", "Core app flow");
  await page.getByRole("button", { name: "Enable location", exact: true }).click();
  await expect(page.getByText("No match found", { exact: true })).toBeVisible();
  await expect(page.getByText(/Effective maximum S\$0.01 \(profile budget\)/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lunch radius 500 metres", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Lunch budget S$10", exact: true }).click();
  await expect(page.getByText(/Effective maximum S\$0.01 \(profile budget\)/)).toBeVisible();
  await page.getByRole("button", { name: "Expand radius to 1.0 km", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lunch radius 1000 metres", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("No match found", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("lunch-empty-mobile.png"), fullPage: true });
});
