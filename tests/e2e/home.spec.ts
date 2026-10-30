import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";
import {
  assertNoCrashVisible,
  clickDevButton,
  resetAppState,
  startOnboardedMockSession,
} from "./helpers/app";

// Round-four Home walk: opens Home, checks what is on the first screen, presses every button a
// diner can press and checks where it lands. Phone widths 390 and 320, both colour schemes, mock
// data, desktop Chromium resized to a phone. Any page error fails the walk.

const WIDTHS = [390, 320];
const SCHEMES = ["light", "dark"] as const;
const VIEWPORT_HEIGHT = 800;

// The page may not scroll sideways, and what a diner presses must sit inside the screen. (Rails
// and the edge-to-edge tiles scroll sideways on purpose, so containers are not measured.)
async function expectNoHorizontalScroll(page: Page, where: string) {
  const found = await page.evaluate(() => {
    const root = document.documentElement;
    const problems: string[] = [];
    if (root.scrollWidth > root.clientWidth) {
      problems.push(`page is ${root.scrollWidth} wide in ${root.clientWidth}`);
    }
    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>("[role='button'], button, input"),
    )) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // Cards in a sideways rail may start off screen; only controls that start on screen count.
      if (box.left >= 0 && box.left < root.clientWidth && box.right > root.clientWidth + 1) {
        let inRail = false;
        for (let up = element.parentElement; up; up = up.parentElement) {
          const overflowX = getComputedStyle(up).overflowX;
          if (
            (overflowX === "auto" || overflowX === "scroll") &&
            up.scrollWidth > up.clientWidth + 1
          ) {
            inRail = true;
          }
        }
        if (!inRail)
          problems.push(`${element.getAttribute("aria-label") ?? element.tagName} spills right`);
      }
    }
    return problems;
  });
  expect(found, `${where} must not scroll sideways`).toEqual([]);
}

// The walk needs no internet: photos come from a tiny stand-in image.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function stubImages(page: Page) {
  await page.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (route) =>
      route.request().resourceType() === "image"
        ? route.fulfill({ status: 200, contentType: "image/png", body: PIXEL_PNG })
        : route.continue(),
  );
}

async function openHome(page: Page, width: number, scheme: (typeof SCHEMES)[number]) {
  await page.emulateMedia({ colorScheme: scheme });
  await stubImages(page);
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await clickDevButton(page, "Discover", "Core app flow");
  await expect(searchBar(page)).toBeVisible({ timeout: 30_000 });
}

function searchBar(page: Page) {
  return page
    .getByLabel("Search dishes, stalls, or hawker centres")
    .filter({ visible: true })
    .last();
}

/** Back to Home after a button took the walk elsewhere. */
async function backToHome(page: Page) {
  await page.goBack();
  await expect(searchBar(page)).toBeVisible({ timeout: 30_000 });
}

test.describe("home page walk", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The Home walk runs once on desktop Chromium at phone widths.",
    );
  });

  for (const width of WIDTHS) {
    for (const scheme of SCHEMES) {
      test(`walks Home at ${width}pt, ${scheme}`, async ({ page }) => {
        const problems: string[] = [];
        page.on("pageerror", (error) => problems.push(error.message));
        // The Home tab can sit under Discover in the launcher, so the bar that counts is the top one.
        const search = () => searchBar(page);

        await test.step("1. Home opens with the search bar", async () => {
          await openHome(page, width, scheme);
          await expect(search()).toBeVisible();
        });
        await test.step("2. Home does not scroll sideways", async () => {
          await expectNoHorizontalScroll(page, "Home");
        });
        await test.step("3. The search bar fills the row between the page edges", async () => {
          // The screen may still be sliding in; wait until the bar sits on screen.
          await expect.poll(async () => (await search().boundingBox())?.x ?? -1).toBeGreaterThan(0);
          const box = await search().boundingBox();
          expect(box).not.toBeNull();
          const gutter = box!.x;
          expect(gutter).toBeGreaterThan(8);
          expect(Math.abs(width - (box!.x + box!.width) - gutter)).toBeLessThanOrEqual(2);
        });
        await test.step("4. A dish is on the first screen", async () => {
          const firstDish = page.getByRole("button", { name: /, S\$\d+\.\d\d/ }).first();
          await expect(firstDish).toBeVisible();
          const box = await firstDish.boundingBox();
          expect(box!.y, "the first dish starts above the fold").toBeLessThan(VIEWPORT_HEIGHT);
        });
        await test.step("5. Decide for me opens the quiz, and back returns", async () => {
          await page.getByLabel("Decide for me").first().click();
          await expect(search()).toBeHidden({ timeout: 15_000 });
          await backToHome(page);
        });
        await test.step("6. The search bar opens Search", async () => {
          await search().click();
          await expect(page.getByPlaceholder("Try laksa or chicken rice").first()).toBeVisible({
            timeout: 30_000,
          });
          await backToHome(page);
        });
        await test.step("7. A dish row opens its page, and back returns", async () => {
          await page
            .getByRole("button", { name: /, S\$\d+\.\d\d/ })
            .first()
            .click();
          await expect(search()).toBeHidden({ timeout: 15_000 });
          await assertNoCrashVisible(page);
          await backToHome(page);
        });
        await test.step("8. A chip filters the page and a way out is offered", async () => {
          await page.getByRole("button", { name: "Spicy" }).first().click();
          await page.waitForTimeout(400);
          await expectNoHorizontalScroll(page, "Home with a chip on");
          await page.getByRole("button", { name: "Spicy" }).first().click();
        });
        await test.step("9. A classics tile searches for that dish", async () => {
          const tile = page
            .getByRole("button", { name: "Search for Chicken Rice", exact: true })
            .first();
          await tile.scrollIntoViewIfNeeded();
          await tile.click();
          await expect(search()).toBeHidden({ timeout: 15_000 });
          await backToHome(page);
        });
        await test.step("10. All stalls closes the page and opens the stall list", async () => {
          const allStalls = page
            .getByLabel("Browse stalls and restaurants")
            .filter({ visible: true })
            .last();
          await allStalls.scrollIntoViewIfNeeded();
          await allStalls.click();
          await expect(search()).toBeHidden({ timeout: 15_000 });
          await backToHome(page);
        });
        await test.step("11. All dishes opens the dish list", async () => {
          const allDishes = page.getByLabel("Browse dishes").filter({ visible: true }).last();
          await allDishes.scrollIntoViewIfNeeded();
          await allDishes.click();
          await expect(search()).toBeHidden({ timeout: 15_000 });
          await backToHome(page);
        });
        await test.step("12. Nothing crashed and no page error was raised", async () => {
          await assertNoCrashVisible(page);
          expect(problems).toEqual([]);
        });
      });
    }
  }
});
