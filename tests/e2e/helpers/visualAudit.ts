import { expect, type Page, type TestInfo } from "@playwright/test";

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

export async function captureVisualEvidence(page: Page, testInfo: TestInfo, name: string) {
  await settleVisuals(page);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ animations: "disabled", path });
  await testInfo.attach(name, { contentType: "image/png", path });
}

export async function assertRenderedImagesAreHealthy(page: Page) {
  await expect
    .poll(
      () =>
        page.locator("img:visible").evaluateAll((images) =>
          images
            .map((image) => image as HTMLImageElement)
            .filter((image) => !image.complete || image.naturalWidth === 0)
            .map(
              (image) => image.getAttribute("aria-label") ?? image.getAttribute("src") ?? "unknown",
            ),
        ),
      { message: "Visible images should load or switch to their bundled fallback" },
    )
    .toEqual([]);
}
