import { test, expect } from "./fixtures";
import {
  clickDevButton,
  expectPostCaptionVisible,
  gotoLauncher,
  publishPostFromComposer,
  uniqueCaption,
} from "./helpers/app";

test.describe("feed/profile sync", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Feed/profile sync is covered once on desktop Chromium.",
    );
  });

  test("published post remains visible in home feed and author profile after navigation", async ({
    page,
  }, testInfo) => {
    const caption = uniqueCaption(testInfo);

    await publishPostFromComposer(page, caption);
    await page.getByRole("button", { name: "View Post" }).click();
    await expectPostCaptionVisible(page, caption, "home-social-feed");

    await gotoLauncher(page);
    await clickDevButton(page, "Profile", "Profile & Review");
    await expectPostCaptionVisible(page, caption, "profile-home-screen");
  });
});
