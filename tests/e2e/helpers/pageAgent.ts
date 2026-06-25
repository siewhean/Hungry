import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

import { assertNoCrashVisible } from "./app";

export type PageAgentIssue = {
  category: "broken-image" | "network-500" | "interactive-element" | "protected-route";
  severity: "P0" | "P1" | "P2";
  description: string;
  locator?: string;
  url?: string;
};

export type PageAgentEvidence = {
  pageName: string;
  cycle: string;
  screenshotPath: string;
};

const DEFAULT_SKIP_BUTTON_PATTERNS = [
  /delete/i,
  /remove account/i,
  /sign out/i,
  /logout/i,
  /publish/i,
  /submit/i,
  /send/i,
  /confirm/i,
];

export async function capturePageEvidence(
  page: Page,
  testInfo: TestInfo,
  pageName: string,
  cycle: string,
): Promise<PageAgentEvidence> {
  const safePageName = pageName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const safeCycle = cycle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const screenshotPath = testInfo.outputPath(
    "page-agents",
    safePageName,
    safeCycle,
    "screenshot.png",
  );
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`${safePageName}-${safeCycle}-screenshot`, {
    path: screenshotPath,
    contentType: "image/png",
  });
  return { pageName, cycle, screenshotPath };
}

export async function assertNoBrokenImages(page: Page) {
  await page.waitForLoadState("domcontentloaded");

  const visibleZeroWidthImages = async () =>
    page.locator("img").evaluateAll((images) =>
      images
        .map((image) => {
          const img = image as HTMLImageElement;
          const rect = img.getBoundingClientRect();
          const style = window.getComputedStyle(img);
          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth &&
            style.display !== "none" &&
            style.visibility !== "hidden";

          return {
            alt: img.alt,
            src: img.currentSrc || img.src,
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            isVisible,
          };
        })
        .filter((image) => image.isVisible && image.src && image.naturalWidth === 0),
    );

  await expect
    .poll(async () => (await visibleZeroWidthImages()).length, {
      message: "Visible images should finish loading or expose pixels",
      timeout: 8_000,
    })
    .toBe(0);

  const brokenImages = await visibleZeroWidthImages();
  expect(brokenImages, "No visible rendered image elements should be broken or hung").toEqual([]);
}

export function collectNetwork500s(page: Page) {
  const failures: PageAgentIssue[] = [];
  const criticalResourceTypes = new Set(["document", "fetch", "xhr"]);

  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (response.status() >= 500 && criticalResourceTypes.has(resourceType)) {
      failures.push({
        category: "network-500",
        severity: "P0",
        description: `${response.status()} ${response.statusText()}`,
        url: response.url(),
      });
    }
  });
  page.on("requestfailed", (request) => {
    if (!criticalResourceTypes.has(request.resourceType())) {
      return;
    }
    failures.push({
      category: "network-500",
      severity: "P0",
      description: request.failure()?.errorText ?? "Request failed",
      url: request.url(),
    });
  });
  return failures;
}

export async function assertNoNetwork500s(issues: PageAgentIssue[]) {
  expect(issues, "No document/fetch/xhr request should return 5xx").toEqual([]);
}

export async function assertNoCrashOrMissingData(page: Page) {
  await assertNoCrashVisible(page);
  await expect(page.getByText("Missing dish data for ID:")).toHaveCount(0);
  await expect(page.getByText("Missing stall data for ID:")).toHaveCount(0);
}

export async function visibleButtonInventory(page: Page, scope?: Locator) {
  const root = scope ?? page.locator("body");
  const buttons = root.getByRole("button");
  const count = await buttons.count();
  const inventory: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    const name = (await button.textContent().catch(() => ""))?.trim();
    const aria = await button.getAttribute("aria-label").catch(() => null);
    const label = aria || name || `button-${index + 1}`;
    inventory.push(label.replace(/\s+/g, " "));
  }

  return inventory;
}

export async function clickAllVisibleButtons(
  page: Page,
  options: {
    scope?: Locator;
    skipPatterns?: RegExp[];
    maxClicks?: number;
    dryRun?: boolean;
  } = {},
) {
  const root = options.scope ?? page.locator("body");
  const skipPatterns = options.skipPatterns ?? DEFAULT_SKIP_BUTTON_PATTERNS;
  const maxClicks = options.maxClicks ?? 8;
  const buttons = root.getByRole("button");
  const count = await buttons.count();
  const clicked: string[] = [];
  const skipped: string[] = [];

  for (let index = 0; index < count && clicked.length < maxClicks; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    const name = (
      (await button.getAttribute("aria-label").catch(() => null)) ||
      (await button.textContent().catch(() => "")) ||
      `button-${index + 1}`
    )
      .trim()
      .replace(/\s+/g, " ");

    if (!name || skipPatterns.some((pattern) => pattern.test(name))) {
      skipped.push(name);
      continue;
    }

    if (!options.dryRun) {
      await button.click();
    }
    clicked.push(name);
  }

  return { clicked, skipped };
}

export async function gradeInteractiveElements(page: Page, minVisibleButtons = 1) {
  const buttons = await visibleButtonInventory(page);
  expect(buttons.length, "Expected visible actionable controls on the page").toBeGreaterThanOrEqual(
    minVisibleButtons,
  );
  return buttons;
}

export async function recordAgentIssue(
  testInfo: TestInfo,
  pageName: string,
  issue: PageAgentIssue,
) {
  await testInfo.attach(`${pageName}-issue-${issue.category}`, {
    body: JSON.stringify(issue, null, 2),
    contentType: "application/json",
  });
}

export async function assertProtectedRouteRedirects(
  page: Page,
  openProtectedRoute: () => Promise<void>,
) {
  await openProtectedRoute();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible({ timeout: 30_000 });
}
