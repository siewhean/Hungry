import { expect, type Page, type TestInfo } from "@playwright/test";

import { clickDevButton, resetAppState, startOnboardedMockSession } from "./app";

async function settleVisuals(page: Page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all(
      Array.from(document.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );
  });
  await page.waitForTimeout(250);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await settleVisuals(page);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ animations: "disabled", path });
  await testInfo.attach(name, { contentType: "image/png", path });
}

async function assertRenderedImagesAreHealthy(page: Page) {
  const failures = await page.locator("img").evaluateAll((images) =>
    images
      .map((image) => image as HTMLImageElement)
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute("aria-label") ?? image.getAttribute("src") ?? "unknown"),
  );
  expect(failures, `Broken rendered images: ${failures.join(", ")}`).toEqual([]);
}

export async function runDiscoverProductionAudit(page: Page, testInfo: TestInfo) {
  await resetAppState(page);
  await startOnboardedMockSession(page);
  await clickDevButton(page, "Discover", "Core app flow");

  await expect(page.getByText("Popular right now", { exact: true }).first()).toBeVisible();
  await assertRenderedImagesAreHealthy(page);
  await capture(page, testInfo, "discover-top");

  const browseDishes = page.getByRole("button", { name: "Browse dishes" });
  await browseDishes.scrollIntoViewIfNeeded();
  await capture(page, testInfo, "discover-browse-entry");
  await browseDishes.click();
  await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();

  for (const filter of ["Local", "Japanese", "Western"] as const) {
    const chip = page.getByRole("button", { name: filter, exact: true });
    await chip.scrollIntoViewIfNeeded();
    await chip.click();
    await expect(
      page.getByRole("button", { name: new RegExp(`^Open .*, ${filter},`) }).first(),
    ).toBeVisible();
    await assertRenderedImagesAreHealthy(page);
    await capture(page, testInfo, `browse-${filter.toLowerCase()}`);
  }

  const localChip = page.getByRole("button", { name: "Local", exact: true });
  await localChip.scrollIntoViewIfNeeded();
  await localChip.click();
  await expect(
    page.getByRole("button", {
      name: /^Open Chicken Rice at Tian Tian Chicken Rice, Local, S\$5\.50 – S\$7\.00, 180 m away$/,
    }),
  ).toBeVisible();
  await expect(page.getByText("S$0.00", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0 m", { exact: true })).toHaveCount(0);
}
