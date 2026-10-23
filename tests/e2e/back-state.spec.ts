import { expect, test } from "./fixtures";
import { resetAppState, startOnboardedMockSession } from "./helpers/app";

// Expo Web does not expose a chip's selected state to the accessibility tree, so read the
// orange selected border the chip draws instead.
const borderColorOf = (page: import("@playwright/test").Page, name: string) =>
  page
    .getByRole("button", { name, exact: true })
    .first()
    .evaluate((element) => getComputedStyle(element).borderColor);

// UX research doc section 17.6 check 5: after leaving the results for another screen and
// coming back, the search text and the chips are still there.
test.describe("search back-state", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Covered once on desktop Chromium.");
  });

  test("Back from the area picker keeps the query and the selected chip", async ({ page }) => {
    await resetAppState(page);
    await startOnboardedMockSession(page);
    await page.goto("/search?q=rice&filter=Halal");

    const input = page.getByRole("textbox").first();
    await expect(input).toHaveValue("rice", { timeout: 60_000 });
    const unselected = await borderColorOf(page, "Western");
    expect(await borderColorOf(page, "Halal")).not.toBe(unselected);

    await page.getByText("Choose your area", { exact: true }).click();
    await expect(page.getByText("Pick a location", { exact: true })).toBeVisible();
    await page.goBack();

    await expect(page.getByRole("textbox").first()).toHaveValue("rice", { timeout: 30_000 });
    expect(await borderColorOf(page, "Halal")).not.toBe(await borderColorOf(page, "Western"));
    expect(await borderColorOf(page, "Rice")).toBe(await borderColorOf(page, "Western"));
  });
});
