import { expect, type Page, type TestInfo } from "@playwright/test";

const CAPTION_PLACEHOLDER = "Write your masterpiece... Use @ to tag or # for topics.";
const E2E_DEVELOPER_LAUNCHER_PATH = "/";
const E2E_DEVELOPER_LAUNCHER_STORAGE_KEY = "hungry.e2eDeveloperLauncher";
const CONSENT_STORE_NAME = "hungry-consent-v1";

function toDevTestId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function devButtonTestId(label: string) {
  return `dev-button-${toDevTestId(label)}`;
}

const DEV_BUTTON_SECTIONS: Record<string, string> = {
  "Launch V2 Composer": "Post Composer V2 Settings",
  "Seed sample media": "Post Composer V2 Settings",
};

type MockAccountPreset = "default" | "User A" | "User B";

function authPresetLabel(account: MockAccountPreset = "default") {
  return account === "default" ? "Auth + Onboard" : `Auth + Onboard ${account}`;
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

async function enableE2eDeveloperLauncher(page: Page) {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, "1");
  }, E2E_DEVELOPER_LAUNCHER_STORAGE_KEY);
}

/**
 * The one-time "Help improve Hungry?" question covers the whole screen until it is answered, so
 * walks that are not about it start with it already answered (kept again after storage is cleared).
 */
async function answerAnalyticsConsent(page: Page) {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ state: { analyticsAsked: true, aiSearchAllowed: false }, version: 0 }),
    );
  }, CONSENT_STORE_NAME);
}

async function disableE2eDeveloperLauncher(page: Page) {
  await page.addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, E2E_DEVELOPER_LAUNCHER_STORAGE_KEY);
}

async function authenticateMockDeveloperSession(page: Page) {
  const launcher = page.getByText("Developer Launcher", { exact: true }).first();
  await expect(launcher).toBeVisible({ timeout: 60_000 });
}

export async function openDevSection(page: Page, section: string) {
  const sectionId = toDevTestId(section);
  const sectionToggle = page.getByTestId(`dev-section-toggle-${sectionId}`);
  const sectionBody = page.getByTestId(`dev-section-body-${sectionId}`);

  if (!(await sectionBody.isVisible().catch(() => false))) {
    await sectionToggle.scrollIntoViewIfNeeded();
    await sectionToggle.click();
    await expect(sectionBody).toBeVisible();
  }

  return sectionBody;
}

export async function resetAppState(page: Page) {
  await enableE2eDeveloperLauncher(page);
  await answerAnalyticsConsent(page);
  await page.goto(E2E_DEVELOPER_LAUNCHER_PATH, { waitUntil: "domcontentloaded" });
  await clearBrowserStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await authenticateMockDeveloperSession(page);
}

export async function gotoLauncher(page: Page) {
  await enableE2eDeveloperLauncher(page);
  await answerAnalyticsConsent(page);
  await page.goto(E2E_DEVELOPER_LAUNCHER_PATH, { waitUntil: "domcontentloaded" });
  await authenticateMockDeveloperSession(page);
}

export async function clickDevButton(page: Page, label: string, section?: string) {
  const resolvedSection = section ?? DEV_BUTTON_SECTIONS[label];

  if (resolvedSection) {
    const sectionBody = await openDevSection(page, resolvedSection);

    const scopedButton = sectionBody.getByTestId(devButtonTestId(label)).first();
    await expect(scopedButton).toBeVisible();
    await scopedButton.scrollIntoViewIfNeeded();
    await scopedButton.click();
    return;
  }

  const button = page.getByTestId(devButtonTestId(label)).first();
  await expect(button).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  await button.click();
}

export async function startOnboardedMockSession(
  page: Page,
  account: MockAccountPreset = "default",
) {
  await gotoLauncher(page);
  await clickDevButton(page, authPresetLabel(account), "Session presets");
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

  await disableE2eDeveloperLauncher(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await clearBrowserStorage(page);
  // Navigate to "/" again instead of reloading: the fast splash may already have
  // replaced the URL with /login, which would reopen Login after a reload.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Sign in to existing account" }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  // Create account leads with an emailed code; these tests use the password form.
  await page
    .getByRole("button", { name: "Use a password instead" })
    .filter({ visible: true })
    .click();
  // Login stays mounted (hidden) under SignUp, so pick the visible fields.
  await page.getByLabel("Name shown on your reviews").filter({ visible: true }).fill(user.name);
  await page
    .getByLabel("Email address", { exact: true })
    .filter({ visible: true })
    .fill(user.email);
  await page
    .getByLabel("Create password", { exact: true })
    .filter({ visible: true })
    .fill(user.password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByText("Verify your email", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
  await page.getByRole("button", { name: "I've confirmed my email" }).click();
  await expect(page.getByText("Developer Launcher", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });

  return user;
}

export async function openComposerFromLauncher(
  page: Page,
  options?: { seedMedia?: boolean; account?: MockAccountPreset; businessMode?: boolean },
) {
  await startOnboardedMockSession(page, options?.account);
  if (options?.seedMedia) {
    await clickDevButton(page, "Seed sample media");
  }
  if (options?.businessMode) {
    await page.getByLabel("Enable business mode in composer").click();
  }
  await clickDevButton(page, "Launch V2 Composer");
  await expect(page.getByText("New post", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish Both" }).first()).toBeVisible();
}

export async function publishPostFromComposer(
  page: Page,
  caption: string,
  options?: { account?: MockAccountPreset },
) {
  await openComposerFromLauncher(page, { seedMedia: true, account: options?.account });
  await page.getByPlaceholder(CAPTION_PLACEHOLDER).first().fill(caption);
  await page.getByRole("button", { name: "Publish Both" }).first().click();
  await expect(page.getByText("Shared!", { exact: true }).first()).toBeVisible();
}

export async function expectPostCaptionVisible(page: Page, caption: string, testId?: string) {
  const scope = testId ? page.getByTestId(testId) : page;
  await expect(scope.getByText(caption).first()).toBeVisible();
}

/**
 * The id the mock service gave a published post, read from the same local storage the app
 * persists posts in. Null until the post has been published in this browser.
 */
export async function getPublishedPostIdByCaption(page: Page, caption: string) {
  return page.evaluate((expectedCaption) => {
    const candidates: unknown[] = [];
    const publishedStore = window.localStorage.getItem("hungry-published-posts-v1");
    const mockStore = window.localStorage.getItem("@mock_published_stall_posts");

    if (publishedStore) {
      try {
        const parsed = JSON.parse(publishedStore) as { state?: { posts?: unknown[] } };
        candidates.push(...(parsed.state?.posts ?? []));
      } catch {
        // Ignore malformed test storage and fall back to mock service state.
      }
    }

    if (mockStore) {
      try {
        const parsed = JSON.parse(mockStore) as unknown[];
        candidates.push(...parsed);
      } catch {
        // Ignore malformed test storage.
      }
    }

    const match = candidates.find(
      (post): post is { id: string; caption: string } =>
        Boolean(post) &&
        post !== null &&
        typeof post === "object" &&
        "id" in post &&
        "caption" in post &&
        (post as { caption?: unknown }).caption === expectedCaption,
    );

    return match?.id ?? null;
  }, caption);
}

/**
 * Moves the running app to a path through the browser history, the way a link inside the app does,
 * without reloading: in-memory state (the signed-in mock user and their posts) stays as it is.
 */
export async function openPathInApp(page: Page, path: string) {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/**
 * Opens a published post's own page (`/post/:postId`, the page a shared link or an Activity update
 * opens) for the signed-in mock user, without reloading the app. The Home tab is no longer a posts feed, so this page, the
 * author's profile and the Review feed are where a post shows up.
 */
export async function openPublishedPost(page: Page, caption: string) {
  const postId = await getPublishedPostIdByCaption(page, caption);
  expect(postId, `no published post with the caption "${caption}" in storage`).toBeTruthy();
  await openPathInApp(page, `/post/${postId}`);
  await expectPostCaptionVisible(page, caption);
  return postId as string;
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
