import { test, expect } from "./fixtures";
import {
  assertNoCrashVisible,
  clickDevButton,
  resetAppState,
  startOnboardedMockSession,
} from "./helpers/app";

// The stall page on the mock build, signed in, on a phone-sized window. One fresh page per
// control, so one broken control cannot hide the next.

test.use({ viewport: { width: 390, height: 844 } });

async function openStall(page: import("@playwright/test").Page) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Stall", "Core app flow");
  await expect(page.getByText("Tian Tian Chicken Rice", { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("stall page", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Stall controls are covered once on Chromium.");
  });

  test("the rating pill says what it counts and is a button", async ({ page }) => {
    await openStall(page);
    const pill = page.getByRole("button", { name: /stars from \d+ dish ratings?/ });
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(/dish ratings?/);
    await pill.click();
    await assertNoCrashVisible(page);
  });

  test("Save toggles the stall in the bar", async ({ page }) => {
    await openStall(page);
    // The mock account already saved this stall: the bar says "Saved" and a tap removes it.
    await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save this stall" })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Save this stall" }).click();
    await expect(page.getByText(/Saved\. Find it in Profile/)).toBeVisible({ timeout: 10_000 });
  });

  test("Mark visited is one tap and opens the What did you have sheet", async ({ page }) => {
    await openStall(page);
    const markVisited = page.getByRole("checkbox", { name: "Mark this stall visited" });
    const visited = page.getByRole("checkbox", { name: "Visited", exact: true });
    // The bar renders after the first paint: wait for whichever state it opens in.
    await expect(markVisited.or(visited)).toBeVisible({ timeout: 30_000 });
    if (!(await markVisited.isVisible())) {
      // Already visited in the mock account: take the mark off first.
      await visited.click();
    }
    await expect(markVisited).toBeVisible({ timeout: 10_000 });
    const before = page.url();
    await markVisited.click();
    await expect(page.getByTestId("stall-visited-sheet")).toBeVisible({ timeout: 10_000 });
    // On web the form sheet is a route over the stall; Skip returns to the stall.
    expect(page.url()).toContain("StallVisited");
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByTestId("stall-visited-sheet")).toHaveCount(0);
    expect(page.url()).toBe(before);
  });

  test("a menu dish opens its page, and Back returns to the stall", async ({ page }) => {
    await openStall(page);
    const dish = page.getByRole("button", { name: /must order|S\$\d/ }).first();
    await expect(dish).toBeVisible();
    await dish.click();
    await expect(page.getByRole("button", { name: "Go back" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Go back" }).first().click();
    await expect(page.getByText("Tian Tian Chicken Rice", { exact: true }).first()).toBeVisible();
  });

  test("the share button opens the share sheet", async ({ page }) => {
    await openStall(page);
    await page.getByRole("button", { name: "Share stall" }).click();
    await expect(page.getByText(/Share|Copy link/).first()).toBeVisible({ timeout: 10_000 });
  });
});
