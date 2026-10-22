import { test, expect } from "./fixtures";
import { openComposerFromLauncher, openDevSection, resetAppState } from "./helpers/app";

test.describe("supported buttons and composer interactions", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(
      info.project.name !== "chromium",
      "Desktop Chrome checks the shared browser interaction path.",
    );
  });

  test("launcher buttons open the supported composer", async ({ page }) => {
    await resetAppState(page);
    await expect(page.getByRole("button", { name: "Open normal app flow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "User", exact: true })).toBeVisible();
    await openDevSection(page, "Post Composer V2 Settings");
    await expect(page.getByRole("button", { name: "Launch V2 Composer" })).toBeVisible();
    await openComposerFromLauncher(page);
    await expect(
      page.getByTestId("post-composer-add-media").filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("an account-scoped composer draft survives reload and returning to that account", async ({
    page,
  }) => {
    await resetAppState(page);
    await openComposerFromLauncher(page);
    const caption = "Runtime durable draft check.";
    await page
      .getByPlaceholder("What makes this worth the queue?")
      .filter({ visible: true })
      .first()
      .fill(caption);
    await page.reload({ waitUntil: "domcontentloaded" });
    await openComposerFromLauncher(page);
    await expect(
      page.getByPlaceholder("What makes this worth the queue?").filter({ visible: true }).first(),
    ).toHaveValue(caption);
  });

  test("unsupported AI and scheduling controls are absent from the supported composer", async ({
    page,
  }) => {
    await resetAppState(page);
    await openComposerFromLauncher(page);
    await expect(page.getByRole("button", { name: "Edit with AI", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Auto-Enhance media", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Schedule Post", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open publish options", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("button", { name: "Publish post", exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeDisabled();
  });

  test("missing media keeps publication disabled while preserving the entered draft", async ({
    page,
  }) => {
    await resetAppState(page);
    await openComposerFromLauncher(page);
    const caption = "Runtime publication retry without media.";
    await page
      .getByPlaceholder("What makes this worth the queue?")
      .filter({ visible: true })
      .first()
      .fill(caption);
    await expect(
      page
        .getByRole("button", { name: "Publish post", exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeDisabled();
    await expect(
      page.getByPlaceholder("What makes this worth the queue?").filter({ visible: true }).first(),
    ).toHaveValue(caption);
    await expect(
      page.getByTestId("post-composer-add-media").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Post published successfully.", { exact: true })).toHaveCount(0);
  });
});
