import { expect, test, type Page } from "@playwright/test";

// The emailed-code sign-in on the mock build: the mock accepts any 8-digit code.

async function openLogin(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Sign in to existing account" }).click();
  await expect(page.getByText("Sign in to Hungry", { exact: true })).toBeVisible();
}

test("sign in with an emailed code: email, check your email, 8 digits, signed in", async ({
  page,
}) => {
  await openLogin(page);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);

  await page.getByLabel("Email address", { exact: true }).fill("qa-code@hungry.test");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
  await expect(page.getByText(/qa-code@hungry\.test/)).toBeVisible();

  // The field submits itself on the eighth digit.
  await page.getByLabel("Enter the code", { exact: true }).fill("12345678");
  await expect(page.getByText(/^You are at/).first()).toBeVisible({ timeout: 30_000 });
});

test("Wrong email? returns to the email step with the address kept", async ({ page }) => {
  await openLogin(page);
  await page.getByLabel("Email address", { exact: true }).fill("qa-wrong@hungry.test");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wrong email? Change it" }).click();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "qa-wrong@hungry.test",
  );
});

test("a mistyped provider domain offers the likely address", async ({ page }) => {
  await openLogin(page);
  await page.getByLabel("Email address", { exact: true }).fill("qa@gmial.com");
  await page.getByLabel("Email address", { exact: true }).blur();
  await page.getByRole("button", { name: "Use this address: qa@gmail.com" }).click();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("qa@gmail.com");
});

test("Create account takes a name and an email, and the password form is one tap away", async ({
  page,
}) => {
  await openLogin(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByLabel("Name shown on your reviews").filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Create password", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Use a password instead" })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByLabel("Create password", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});

test("the web address never carries the email a screen was opened with", async ({ page }) => {
  await openLogin(page);
  await page.getByRole("button", { name: "Use a password instead" }).click();
  await page.getByLabel("Email address", { exact: true }).fill("qa-link@hungry.test");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Forgot password", { exact: true }).first()).toBeVisible();
  expect(page.url()).not.toContain("email");
  expect(page.url()).not.toContain("qa-link");
});
