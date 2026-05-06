import { test, expect } from "./fixtures";
import {
  clickDevButton,
  expectPostCaptionVisible,
  gotoLauncher,
  publishPostFromComposer,
  startOnboardedMockSession,
  uniqueCaption,
} from "./helpers/app";

test.describe("cross-user visibility", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Cross-user mock visibility is covered once on desktop Chromium.",
    );
  });

  test("User B can see User A's public published post without owner controls", async ({
    page,
  }, testInfo) => {
    const caption = uniqueCaption(testInfo);

    await publishPostFromComposer(page, caption);
    await page.getByRole("button", { name: "View Post" }).click();
    await expectPostCaptionVisible(page, caption, "home-social-feed");

    await gotoLauncher(page);
    await clickDevButton(page, "Signed out", "Session presets");
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");

    await expectPostCaptionVisible(page, caption, "home-social-feed");
    await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /edit/i })).toHaveCount(0);
  });
});
