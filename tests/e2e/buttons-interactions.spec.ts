import { test, expect } from "./fixtures";
import {
  clickDevButton,
  openComposerFromLauncher,
  openDevSection,
  resetAppState,
} from "./helpers/app";

test.describe("buttons and interactions", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Interaction smoke is covered once on desktop Chromium.",
    );
  });

  test("core launcher buttons are named and navigate to real surfaces", async ({ page }) => {
    await resetAppState(page);
    await expect(page.getByRole("button", { name: "Open normal app flow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "User" })).toBeVisible();
    await openDevSection(page, "Post Composer V2 Settings");
    await expect(page.getByRole("button", { name: "Launch V2 Composer" })).toBeVisible();

    await clickDevButton(page, "User");
    await expect(page.getByText("Your Story")).toBeVisible();
  });

  test("composer draft controls produce a real draft state", async ({ page }) => {
    await openComposerFromLauncher(page);
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByText("Draft Saved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep Editing" })).toBeVisible();
    await page.getByRole("button", { name: "Keep Editing" }).click();
    await expect(page.getByText("Draft Saved")).toHaveCount(0);
  });
});
