import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const htmlPath = path.join(__dirname, "index.html");
const slidesDir = path.join(__dirname, "slides");

await fs.mkdir(slidesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 1450 },
  deviceScaleFactor: 1,
});

page.on("pageerror", (error) => {
  throw error;
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await document.fonts.ready;
  const images = Array.from(document.images);
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
    }),
  );
});

const slides = await page.locator("[data-slide]").all();

for (const slide of slides) {
  const slideNumber = await slide.getAttribute("data-slide");
  await slide.screenshot({
    path: path.join(slidesDir, `slide-${slideNumber}.png`),
    omitBackground: false,
  });
}

await browser.close();

console.log(`Exported ${slides.length} slides to ${slidesDir}`);
