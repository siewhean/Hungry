import { test, expect } from '../../../tests/e2e/fixtures';
import { resetAppState } from '../../../tests/e2e/helpers/app';

test('fresh normal flow reaches onboarding, then existing-account sign-in', async ({ page }) => {
  await resetAppState(page);
  await page.getByRole('button', { name: 'Open normal app flow' }).click();
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/audit/page-review-2026-10-20/runtime/current-web-welcome.png', fullPage: true });
  await page.getByRole('button', { name: 'Sign in to existing account' }).click();
  await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/audit/page-review-2026-10-20/runtime/current-web-login.png', fullPage: true });
});
