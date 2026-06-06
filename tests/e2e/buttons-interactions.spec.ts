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

    await clickDevButton(page, "Developer");
    await expect(page.getByLabel("Add to your story")).toBeVisible();
  });

  test("composer draft controls produce a real draft state", async ({ page }) => {
    await openComposerFromLauncher(page);
    await page.getByRole("button", { name: "Save Draft" }).first().click();
    await expect(page.getByText("Draft Saved", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep Editing" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Keep Editing" }).first().click();
    await expect(page.getByText("Draft Saved")).toHaveCount(0);
  });

  test("composer rich controls are clickable and update visible state", async ({ page }) => {
    await openComposerFromLauncher(page, { seedMedia: true, businessMode: true });

    await page.getByRole("button", { name: "Edit with AI" }).first().click();
    await expect(page.getByText("Edit Media", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Auto-Enhance media" }).first().click();
    await expect(page.getByText("Auto-enhance applied", { exact: true }).first()).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText("Edit Media", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Add CTA Button" }).first().click();
    await page.getByRole("button", { name: "View Menu" }).first().click();
    await expect(page.getByText("View Menu", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Open publish options" }).click();
    await page.getByRole("button", { name: "Schedule Post" }).click();
    await expect(page.getByText("Schedule", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Post Scheduled!", { exact: true }).first()).toBeVisible();
  });

  test("composer publish modes and retry controls execute real handlers", async ({ page }) => {
    await openComposerFromLauncher(page, { seedMedia: true });

    await page.getByRole("tab", { name: "Review tab" }).click();
    await page.getByPlaceholder("What did you think of the food?").first().fill("Runtime review only.");
    await page.getByRole("button", { name: "4 star" }).first().click();
    await page.getByRole("button", { name: "Open publish options" }).click();
    await page.getByRole("button", { name: "Select Review Only publish mode" }).click();
    await page.getByRole("button", { name: "Review Only" }).click();
    await expect(page.getByText("Review saved", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Create Another" }).click();

    await page.getByRole("tab", { name: "Post tab" }).click();
    await page.getByRole("button", { name: "Open publish options" }).click();
    await page.getByRole("button", { name: "Select Post and Review publish mode" }).click();
    await page
      .getByPlaceholder("Write your masterpiece... Use @ to tag or # for topics.")
      .first()
      .fill("Runtime retry validation.");
    await page.getByRole("button", { name: "Publish Both" }).first().click();
    await expect(page.getByText("Something went wrong", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Try Again" }).first().click();
    await expect(page.getByText("Add a photo or video before publishing.").first()).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
