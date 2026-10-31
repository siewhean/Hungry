import { expect, test, type Page } from "@playwright/test";

async function openLoginAfterLocalOnboarding(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Continue as Guest/i)).toHaveCount(0);
  await expect(page.getByText(/Skip login/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in to existing account" }).click();
  await expect(page.getByText("Sign in to Hungry", { exact: true })).toBeVisible();
}

test("fresh users cannot enter the app without completing mandatory account authentication", async ({
  page,
}) => {
  await openLoginAfterLocalOnboarding(page);

  // Sign-in leads with an emailed code; the password form is one tap away.
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Email me a code", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(page.getByText("Discover", { exact: true })).toHaveCount(0);
});

test("protected web deep links return an onboarded signed-out user to login", async ({ page }) => {
  await openLoginAfterLocalOnboarding(page);

  await page.goto("/dish/dish-chicken-rice");
  await expect(page.getByText("Sign in to Hungry", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Chicken Rice", { exact: true })).toHaveCount(0);
});

test("successful mock authentication is required before the app shell mounts", async ({ page }) => {
  await openLoginAfterLocalOnboarding(page);

  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Email address", { exact: true }).fill("qa@hungry.test");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // The app shell opens on Discover, the home page.
  await expect(page.getByText(/^You are at/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Sign in to Hungry", { exact: true })).toHaveCount(0);
});
