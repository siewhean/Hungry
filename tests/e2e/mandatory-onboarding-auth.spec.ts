import { expect, test, type Page } from "@playwright/test";

async function openLoginAfterLocalOnboarding(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Continue as Guest/i)).toHaveCount(0);
  await expect(page.getByText(/Skip login/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in to existing account" }).click();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
}

test("completing onboarding on a fresh install opens Create account, which links to Sign in", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click({ timeout: 60_000 });
  await page
    .getByLabel(/^Select /)
    .first()
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Enter Manually" }).click();
  await page
    .getByLabel(/^Choose /)
    .first()
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Create your account", { exact: true })).toBeVisible();
  await expect(page.getByText("Welcome back", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Full Name", exact: true })).toBeVisible();
  // Compact requirements stay hidden until the password field is focused.
  await expect(page.getByTestId("password-requirements")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Password", exact: true }).focus();
  await expect(page.getByTestId("password-requirements")).toBeVisible();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Hungrypass12!");
  await expect(page.getByTestId("password-requirements-strong")).toBeVisible();
  await expect(page.getByTestId("signup-terms-consent")).toBeVisible();

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();

  // A returning (onboarded, signed-out) launch lands on Login, not onboarding.
  await page.goto("/");
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("fresh users cannot enter the app without completing mandatory account authentication", async ({
  page,
}) => {
  await openLoginAfterLocalOnboarding(page);

  await expect(page.getByRole("textbox", { name: "Email Address", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(page.getByText("Discover", { exact: true })).toHaveCount(0);
});

test("protected web deep links return an onboarded signed-out user to login", async ({ page }) => {
  await openLoginAfterLocalOnboarding(page);

  await page.goto("/dish/dish-chicken-rice");
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Chicken Rice", { exact: true })).toHaveCount(0);
});

test("successful mock authentication is required before the app shell mounts", async ({ page }) => {
  await openLoginAfterLocalOnboarding(page);

  await page.getByRole("textbox", { name: "Email Address", exact: true }).fill("qa@hungry.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByTestId("home-social-feed")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Welcome back", { exact: true })).toHaveCount(0);
});
