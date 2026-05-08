import { test, expect } from "./fixtures";
import {
  clickDevButton,
  resetAppState,
  startOnboardedMockSession,
  uniqueCaption,
} from "./helpers/app";

test.describe("chat", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Chat smoke is covered once on desktop Chromium.",
    );
  });

  test("opens a seeded conversation, sends a message, and refreshes the inbox preview", async ({
    page,
  }, testInfo) => {
    const chatMessage = uniqueCaption(testInfo);

    await resetAppState(page);
    await startOnboardedMockSession(page);
    await clickDevButton(page, "Home", "Core app flow");

    await page.getByRole("button", { name: "Open activity inbox" }).click();
    await expect(page.getByText("Activity", { exact: true }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Messages" }).click();
    await page.getByRole("button", { name: "Open chat with Ahmad" }).click();

    await expect(page.getByText("That chicken rice was amazing!")).toBeVisible();
    await page.getByPlaceholder("Type a message...").fill(chatMessage);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText(chatMessage)).toBeVisible();
    await page.getByRole("button", { name: "Go back to activity" }).click();
    await expect(page.getByText(chatMessage).first()).toBeVisible();
  });
});
