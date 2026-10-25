import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const base = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3107";
const evidence = new URL("../../../../docs/audit/consumer-safeguards-browser/", import.meta.url);
mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
const errors = [];
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push({ kind: "pageerror", message: error.message }));
    page.on("console", msg => { if (msg.type() === "error") errors.push({ kind: "console", message: msg.text() }); });
    for (const route of ["/", "/for-foodies", "/for-merchants", "/privacy", "/refund", "/cookies", "/business", "/credits"]) {
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, route);
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("href"), "#main-content", `${route}: skip link first`);
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(":focus").getAttribute("id"), "main-content", `${route}: skip focuses main`);
      if (await page.getByRole("button", { name: "Reject analytics", exact: true }).count()) {
        await page.getByRole("button", { name: "Reject analytics", exact: true }).click();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${route}: no horizontal overflow at ${viewport.width}px`);
      assert.equal(await page.locator("img:not([alt])").count(), 0, `${route}: images have alternatives`);
      if (route === "/") {
        const rail = page.getByRole("region", { name: "Singapore food culture cards" });
        await rail.scrollIntoViewIfNeeded();
        await rail.focus();
        await page.keyboard.press("End");
        assert.ok(await rail.evaluate(el => el.scrollWidth <= el.clientWidth || el.scrollLeft > 0), "End scrolls overflowing culture rail");
        await page.keyboard.press("Home");
        assert.equal(await rail.evaluate(el => el.scrollLeft), 0, "Home resets culture rail");
        await page.keyboard.press("ArrowRight");
        assert.ok(await rail.evaluate(el => el.scrollWidth <= el.clientWidth || el.scrollLeft > 0), "Right arrow scrolls overflowing culture rail");
      }
      if (route === "/" && viewport.width < 700) {
        const story = page.locator("#product-story");
        const nonOverlapping = await story.evaluate(el => {
          const preview = el.querySelector('[class*="visualRail"]')?.getBoundingClientRect();
          const copy = el.querySelector('[class*="copyRail"]')?.getBoundingClientRect();
          return preview && copy && preview.bottom <= copy.top;
        });
        assert.equal(nonOverlapping, true, "mobile phone must not overlap story copy");
        await page.getByRole("heading", { name: "Start with what is nearby." }).evaluate(el => {
          window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 140, behavior: "instant" });
        });
        await page.waitForTimeout(250);
        await page.screenshot({ path: fileURLToPath(new URL("390-product-story-readable.png", evidence)) });
      }
      const name = `${viewport.width}-${route.replaceAll("/", "_") || "home"}`;
      if (["/", "/privacy", "/cookies", "/business", "/credits"].includes(route)) {
        await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, evidence)), fullPage: true });
      }
      results.push({ route, width: viewport.width, skipLink: true, noOverflow: true, imageAlt: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(new URL("results.json", evidence), JSON.stringify({ results, errors }, null, 2));
}
assert.deepEqual(errors, [], "no browser runtime/console errors");
console.log(`Consumer browser smoke passed: ${results.length} route/viewports; keyboard skip, carousel, image alt and overflow; no browser errors.`);
