import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";
import {
  clickDevButton,
  expectPostCaptionVisible,
  gotoLauncher,
  publishPostFromComposer,
  uniqueCaption,
} from "./helpers/app";

async function getPublishedPostIdByCaption(page: Page, caption: string) {
  return page.evaluate((expectedCaption) => {
    const candidates: unknown[] = [];
    const publishedStore = window.localStorage.getItem("hungry-published-posts-v1");
    const mockStore = window.localStorage.getItem("@mock_published_stall_posts");

    if (publishedStore) {
      try {
        const parsed = JSON.parse(publishedStore) as { state?: { posts?: unknown[] } };
        candidates.push(...(parsed.state?.posts ?? []));
      } catch {
        // Ignore malformed test storage and fall back to mock service state.
      }
    }

    if (mockStore) {
      try {
        const parsed = JSON.parse(mockStore) as unknown[];
        candidates.push(...parsed);
      } catch {
        // Ignore malformed test storage.
      }
    }

    const match = candidates.find(
      (post): post is { id: string; caption: string } =>
        Boolean(post) &&
        post !== null &&
        typeof post === "object" &&
        "id" in post &&
        "caption" in post &&
        (post as { caption?: unknown }).caption === expectedCaption,
    );

    return match?.id ?? null;
  }, caption);
}

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
    await page.getByRole("button", { name: "View Post" }).first().click();
    await expectPostCaptionVisible(page, caption, "home-social-feed");
    const publishedPostId = await getPublishedPostIdByCaption(page, caption);
    expect(publishedPostId).toBeTruthy();

    await gotoLauncher(page);
    await clickDevButton(page, "Profile", "Profile & Review");
    await expect(page.getByTestId(`profile-post-tile-${publishedPostId}`).first()).toBeVisible();
  });
});
