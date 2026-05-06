import { expect, type Page, type TestInfo } from "@playwright/test";

const CAPTION_PLACEHOLDER = "Write your masterpiece... Use @ to tag or # for topics.";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clearBrowserStorage(page: Page) {
  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    if ("indexedDB" in window && indexedDB.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map(
          (database) =>
            new Promise<void>((resolve) => {
              if (!database.name) {
                resolve();
                return;
              }

              const request = indexedDB.deleteDatabase(database.name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }),
        ),
      );
    }
  });
}

export async function resetAppState(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await clearBrowserStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Developer Launcher", { exact: true }).first()).toBeVisible();
}

export async function gotoLauncher(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Developer Launcher", { exact: true }).first()).toBeVisible();
}

export async function clickDevButton(page: Page, label: string, section?: string) {
  const button = page.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}$`) }).first();
  if ((await button.count()) === 0 && section) {
    await page.getByText(section, { exact: true }).click();
  } else if (!(await button.isVisible().catch(() => false)) && section) {
    await page.getByText(section, { exact: true }).click();
  }
  await expect(button).toBeVisible();
  await button.click();
}

export async function startOnboardedMockSession(page: Page) {
  await gotoLauncher(page);
  await clickDevButton(page, "Auth + Onboard", "Session presets");
  await expect(page.getByText("Authenticated").first()).toBeVisible();
}

export async function createEmailAccountFromScratch(page: Page, prefix: string) {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  const emailPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const user = {
    name: `${prefix} ${unique}`,
    email: `${emailPrefix}-${unique}@example.test`,
    password: "HungryPass123!",
  };

  await resetAppState(page);
  await clickDevButton(page, "SignUp", "Auth & Onboarding");
  await page.getByPlaceholder("Full Name").fill(user.name);
  await page.getByPlaceholder("Email Address").fill(user.email);
  await page.getByPlaceholder("Create Password").fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("Verify your email", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
  await page.getByRole("button", { name: "I Verified My Email" }).click();
  await expect(page.getByText("Start with the dish, not the brand")).toBeVisible();

  return user;
}

export async function openComposerFromLauncher(page: Page) {
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Launch V2 Composer");
  await expect(page.getByText("New post")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish Both" })).toBeVisible();
}

export async function publishPostFromComposer(page: Page, caption: string) {
  await openComposerFromLauncher(page);
  await page.getByPlaceholder(CAPTION_PLACEHOLDER).fill(caption);
  await page.getByRole("button", { name: "Publish Both" }).click();
  await expect(page.getByText("Shared!", { exact: true })).toBeVisible();
}

export function uniqueCaption(testInfo: TestInfo) {
  const safeTitle = testInfo.title
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);
  return `E2E ${safeTitle} ${Date.now()}`;
}

export async function assertNoCrashVisible(page: Page) {
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await expect(page.getByText("Dish not found")).toHaveCount(0);
  await expect(page.getByText("Stall not found")).toHaveCount(0);
}
