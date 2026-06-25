import { test, expect } from "./fixtures";
import {
  assertNoBrokenImages,
  assertNoCrashOrMissingData,
  assertNoNetwork500s,
  assertProtectedRouteRedirects,
  capturePageEvidence,
  collectNetwork500s,
  gradeInteractiveElements,
} from "./helpers/pageAgent";
import {
  clickDevButton,
  expectPostCaptionVisible,
  openComposerFromLauncher,
  publishPostFromComposer,
  resetAppState,
  uniqueCaption,
} from "./helpers/app";

test.describe("page agent: Post Composer", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Page-agent baseline runs on Chromium.");
  });

  test("guest composer route is protected", async ({ page }) => {
    await resetAppState(page);
    await assertProtectedRouteRedirects(page, async () => {
      await clickDevButton(page, "Composer", "Core app flow");
    });
  });

  test("composer baseline controls, missing media error, and publish success work", async ({
    page,
  }, testInfo) => {
    const network500s = collectNetwork500s(page);
    await openComposerFromLauncher(page);
    await expect(page.getByTestId("post-composer-screen").first()).toBeVisible();
    await expect(page.getByText("New post", { exact: true }).first()).toBeVisible();
    await gradeInteractiveElements(page, 5);
    await assertNoBrokenImages(page);
    await capturePageEvidence(page, testInfo, "Post Composer", "cycle-0-baseline");

    await page
      .getByPlaceholder("Write your masterpiece... Use @ to tag or # for topics.")
      .first()
      .fill("Page-agent missing media validation.");
    await page.getByRole("button", { name: "Publish Both" }).first().click();
    await expect(page.getByText("Add a photo or video before publishing.").first()).toBeVisible();

    const caption = uniqueCaption(testInfo);
    await publishPostFromComposer(page, caption);
    await page.getByRole("button", { name: "View Post" }).first().click();
    await expectPostCaptionVisible(page, caption, "home-social-feed");
    await assertNoBrokenImages(page);
    await assertNoCrashOrMissingData(page);
    await assertNoNetwork500s(network500s);
    await capturePageEvidence(page, testInfo, "Post Composer", "cycle-1-publish");
  });
});
