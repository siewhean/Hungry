import { test, expect } from "./fixtures";
import { openPublishedPost, publishPostFromComposer, uniqueCaption } from "./helpers/app";

test.describe("post/profile sync", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Post/profile sync is covered once on desktop Chromium.",
    );
  });

  test("published post remains visible on its post page and the author profile after navigation", async ({
    page,
  }, testInfo) => {
    const caption = uniqueCaption(testInfo);

    await publishPostFromComposer(page, caption);
    await page.getByRole("button", { name: "View Post" }).first().click();
    await openPublishedPost(page, caption);

    await page
      .getByRole("button", { name: /^Open Wei Ming profile$/ })
      .first()
      .click();
    await page.getByRole("tab", { name: "Show profile posts" }).click();
    await expect(page.getByRole("button", { name: `Open post ${caption}` }).first()).toBeVisible();
  });
});
