import { expect, type Page, type TestInfo } from "@playwright/test";

import { clickDevButton, resetAppState, startOnboardedMockSession } from "./app";
import { captureVisualEvidence } from "./visualAudit";

export async function runProfileSecurityAudit(page: Page, testInfo: TestInfo) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Edit", "Profile & Review");

  await expect(
    page.getByText("Edit profile", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  const changePassword = page
    .getByRole("button", { name: "Change password", exact: true })
    .filter({ visible: true });
  await expect(changePassword).toBeVisible();
  await captureVisualEvidence(page, testInfo, "edit-profile-password-entry");

  await changePassword.click();
  await expect(
    page.getByText(/Password reset email sent to .+\./).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Edit profile", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("NEW PASSWORD", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await captureVisualEvidence(page, testInfo, "edit-profile-password-email-sent");
}
