import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";
import {
  assertNoCrashVisible,
  clickDevButton,
  resetAppState,
  startOnboardedMockSession,
} from "./helpers/app";

// Round-four Search walk: Search home, typeahead, results, Filters sheet, stall results, saving,
// back. Every step checks one thing a person would notice, at phone widths 390 and 320 in both
// colour schemes. Mock data, desktop Chromium resized to a phone.

const WIDTHS = [390, 320];
const SCHEMES = ["light", "dark"] as const;

// The page itself and every scroll view or container 300pt or wider: none may be scrolled
// sideways or hold content wider than itself. (Scroll views meant to scroll sideways, such as the
// chip rows, may be wider inside, but they may not start scrolled.)
async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => {
    const found: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) {
      found.push(`page is ${root.scrollWidth} wide in ${root.clientWidth}`);
    }
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      if (element.clientWidth < 300 || element.getClientRects().length === 0) continue;
      const overflowX = getComputedStyle(element).overflowX;
      const scrollsOnPurpose = overflowX === "auto" || overflowX === "scroll";
      const label = element.getAttribute("aria-label") ?? element.getAttribute("data-testid") ?? "";
      if (element.scrollLeft > 0) {
        found.push(`${element.tagName} ${label} starts scrolled ${element.scrollLeft}`);
      } else if (!scrollsOnPurpose && element.scrollWidth > element.clientWidth + 1) {
        found.push(
          `${element.tagName} ${label} holds ${element.scrollWidth} in ${element.clientWidth}`,
        );
      }
    }
    return found;
  });
  expect(overflow, `${where} must not scroll sideways`).toEqual([]);
}

// The walk needs no internet: photos come from a tiny stand-in image. "broken" answers with bytes
// that are not an image, which is what a failed photo looks like to the app.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function stubImages(page: Page, mode: "ok" | "broken") {
  await page.unroute(isOutsideImage).catch(() => undefined);
  await page.route(isOutsideImage, (route) =>
    route.request().resourceType() === "image"
      ? route.fulfill(
          mode === "ok"
            ? { status: 200, contentType: "image/png", body: PIXEL_PNG }
            : { status: 200, contentType: "image/png", body: Buffer.from("not an image") },
        )
      : route.continue(),
  );
}

function isOutsideImage(url: URL) {
  return url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
}

async function openSearchHome(
  page: Page,
  width: number,
  scheme: (typeof SCHEMES)[number],
  images: "ok" | "broken" = "ok",
) {
  await page.emulateMedia({ colorScheme: scheme });
  await stubImages(page, images);
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await page.setViewportSize({ width, height: 800 });
  await clickDevButton(page, "Search", "Core app flow");
  await expect(page.getByPlaceholder("Try laksa or chicken rice").first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("search page walk", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "The search walk runs once on desktop Chromium at phone widths.",
    );
  });

  for (const width of WIDTHS) {
    for (const scheme of SCHEMES) {
      test(`walks Search at ${width}pt, ${scheme}`, async ({ page }) => {
        const problems: string[] = [];
        page.on("pageerror", (error) => problems.push(error.message));
        const field = () => page.getByPlaceholder("Try laksa or chicken rice").first();

        await test.step("1. Search home opens with the field", async () => {
          await openSearchHome(page, width, scheme);
          await expect(field()).toBeVisible();
        });
        await test.step("2. Search home does not scroll sideways", async () => {
          await expectNoHorizontalScroll(page, "Search home");
        });
        await test.step("3. Typing two letters opens the suggestions panel", async () => {
          await field().fill("la");
          await expect(page.getByLabel("Search suggestions")).toBeVisible();
        });
        await test.step("4. The first row searches for what was typed", async () => {
          await expect(page.getByLabel("Search for la")).toBeVisible();
        });
        await test.step("5. Typing the full word shows matching dishes", async () => {
          await field().fill("laksa");
          await expect(page.getByLabel("Matching dishes and stalls")).toBeVisible({
            timeout: 15_000,
          });
        });
        await test.step("6. The panel does not scroll sideways", async () => {
          await expectNoHorizontalScroll(page, "Typeahead panel");
        });
        await test.step("7. Enter opens the results", async () => {
          await field().press("Enter");
          await expect(page.getByTestId("search-sticky-row")).toBeVisible({ timeout: 30_000 });
        });
        await test.step("8. The header names the query", async () => {
          await expect(page.getByText(/for “laksa”/).first()).toBeVisible();
        });
        await test.step("9. Results do not scroll sideways", async () => {
          await expectNoHorizontalScroll(page, "Results");
        });
        await test.step("10. Dish cards carry a Save heart", async () => {
          await expect(page.getByRole("button", { name: /^Save / }).first()).toBeVisible();
        });
        await test.step("11. Tapping the heart saves the dish", async () => {
          await page
            .getByRole("button", { name: /^Save / })
            .first()
            .click();
          await expect(
            page.getByRole("button", { name: /^Remove .* from saved$/ }).first(),
          ).toBeVisible();
        });
        await test.step("12. Tapping it again removes the dish", async () => {
          await page
            .getByRole("button", { name: /^Remove .* from saved$/ })
            .first()
            .click();
          await expect(page.getByRole("button", { name: /^Save / }).first()).toBeVisible();
        });
        await test.step("13. Filters opens a sheet", async () => {
          await page.getByRole("button", { name: /^Filters and sort/ }).click();
          await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
        });
        await test.step("14. The sheet does not scroll sideways", async () => {
          await expectNoHorizontalScroll(page, "Filters sheet");
        });
        await test.step("15. Choosing a sort option closes the sheet", async () => {
          await page
            .getByRole("radio", { name: /Price: low to high/ })
            .first()
            .click();
          await expect(page.getByRole("button", { name: "Done" })).toBeHidden();
        });
        await test.step("16. Reopening Filters shows that sort as selected, and Done closes it", async () => {
          await page.getByRole("button", { name: /^Filters and sort/ }).click();
          await expect(
            page.getByRole("radio", { name: /Price: low to high/ }).first(),
          ).toBeChecked();
          await page.getByRole("button", { name: "Done" }).click();
          await expect(page.getByRole("button", { name: "Done" })).toBeHidden();
        });
        await test.step("17. The Stalls tab lists stalls for the same query", async () => {
          await page.getByLabel("Show stalls").filter({ visible: true }).first().click();
          await expect(page.getByText(/stalls? for “laksa”/).first()).toBeVisible({
            timeout: 15_000,
          });
        });
        await test.step("18. Stall results do not scroll sideways", async () => {
          await expectNoHorizontalScroll(page, "Stall results");
        });
        await test.step("19. A stall card opens the stall", async () => {
          await page.locator('[data-testid^="search-card-stalls-"]').first().click();
          await expect(page.getByTestId("search-sticky-row")).toBeHidden({ timeout: 15_000 });
        });
        await test.step("20. Back returns to the stall results with the query kept", async () => {
          await page.goBack();
          await expect(page.getByTestId("search-sticky-row")).toBeVisible({ timeout: 15_000 });
          await expect(page.getByText(/stalls? for “laksa”/).first()).toBeVisible();
        });
        await test.step("21. The Dishes tab brings the dish cards back", async () => {
          await page.getByLabel("Show dishes").filter({ visible: true }).first().click();
          await expect(page.getByText(/dish(es)? for “laksa”/).first()).toBeVisible({
            timeout: 15_000,
          });
        });
        await test.step("22. Halal in Filters shows a count of 1 on the button", async () => {
          await page.getByRole("button", { name: /^Filters and sort/ }).click();
          await page.getByRole("button", { name: "Halal", exact: true }).click();
          await page.getByRole("button", { name: "Done" }).click();
          await expect(page.getByTestId("search-filters-badge")).toHaveText("1");
        });
        await test.step("23. The Filters button says one filter is on", async () => {
          await expect(page.getByRole("button", { name: "Filters and sort, 1 on" })).toBeVisible();
        });
        await test.step("24. All clears the filter and the count goes away", async () => {
          await page.getByRole("button", { name: /^Filters and sort/ }).click();
          await page.getByRole("button", { name: "All", exact: true }).click();
          await page.getByRole("button", { name: "Done" }).click();
          await expect(page.getByTestId("search-filters-badge")).toBeHidden();
        });
        await test.step("25. A dish card opens the dish", async () => {
          await page.locator('[data-testid^="search-card-dishes-"]').first().click();
          await expect(page.getByTestId("search-sticky-row")).toBeHidden({ timeout: 15_000 });
        });
        await test.step("26. Back returns to the results with the query kept", async () => {
          await page.goBack();
          await expect(page.getByTestId("search-sticky-row")).toBeVisible({ timeout: 15_000 });
          await expect(page.getByText(/dish(es)? for “laksa”/).first()).toBeVisible();
        });
        await test.step("27. Back on the header returns to Search home", async () => {
          await page.getByRole("button", { name: "Go back" }).first().click();
          await expect(field()).toBeVisible({ timeout: 15_000 });
        });
        await test.step("28. The search is in recent searches", async () => {
          await expect(
            page.getByLabel("Search laksa again").filter({ visible: true }),
          ).toBeVisible();
        });
        await test.step("29. Tapping the recent search runs it again", async () => {
          await page.getByLabel("Search laksa again").filter({ visible: true }).click();
          await expect(page.getByText(/dish(es)? for “laksa”/).first()).toBeVisible({
            timeout: 15_000,
          });
        });
        await test.step("30. Back to Search home again", async () => {
          await page.getByRole("button", { name: "Go back" }).first().click();
          await expect(field()).toBeVisible({ timeout: 15_000 });
        });
        await test.step("31. A stall name in the typeahead lists stalls", async () => {
          await field().fill("tian");
          await expect(page.getByLabel("Matching dishes and stalls")).toBeVisible({
            timeout: 15_000,
          });
        });
        await test.step("32. A search with no match says so", async () => {
          await field().fill("zzzqq");
          await field().press("Enter");
          await expect(page.getByText("No matches found")).toBeVisible({ timeout: 15_000 });
        });
        await test.step("33. The empty state does not scroll sideways", async () => {
          await expectNoHorizontalScroll(page, "Empty results");
        });
        await test.step("34. Back from the empty results lands on Search home", async () => {
          await page.getByRole("button", { name: "Go back" }).first().click();
          await expect(field()).toBeVisible({ timeout: 15_000 });
        });
        await test.step("35. Search home still fits the screen after the walk", async () => {
          await expectNoHorizontalScroll(page, "Search home after the walk");
        });
        await test.step("36. No page error and no crash screen", async () => {
          expect(problems).toEqual([]);
          await assertNoCrashVisible(page);
        });
      });
    }
  }

  test("a photo that fails to load shows the stall mark, not a blank tile", async ({ page }) => {
    const marks = () =>
      page
        .getByLabel(/ stall logo unavailable$/)
        .filter({ visible: true })
        .count();
    const searchLaksa = async (images: "ok" | "broken") => {
      await openSearchHome(page, 390, "light", images);
      const field = page.getByPlaceholder("Try laksa or chicken rice").first();
      await field.fill("laksa");
      await field.press("Enter");
      await expect(page.getByTestId("search-sticky-row")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid^="search-card-dishes-"]').first()).toBeVisible();
      // Photos have loaded or failed by the time the images settle.
      await page.waitForLoadState("networkidle");
      return marks();
    };
    const withPhotos = await searchLaksa("ok");
    const withBrokenPhotos = await searchLaksa("broken");
    expect(
      withBrokenPhotos,
      "cards whose photo fails show the stall mark in its place",
    ).toBeGreaterThan(withPhotos);
  });
});
