import { test, expect } from "./fixtures";
import { publishPostFromComposer, uniqueCaption } from "./helpers/app";

test.describe("post generation and publishing", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Publishing E2E is covered once on desktop Chromium.",
    );
  });

  test("publishes a generated post and shows it in the home feed", async ({ page }, testInfo) => {
    const caption = uniqueCaption(testInfo);

    await publishPostFromComposer(page, caption);
    await page.getByRole("button", { name: "View Post" }).click();

    await expect(page.getByText(caption)).toBeVisible();
  });
});
