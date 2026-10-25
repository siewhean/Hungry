import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3107";
const productionSmoke = process.env.HUNGRY_BROWSER_PRODUCTION === "1";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
// Development Analytics uses an external debug script blocked by the production CSP.
// Production smoke enforces CSP; only development smoke bypasses its blocked debug script.
const context = await browser.newContext({
  bypassCSP: !productionSmoke,
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
if (productionSmoke)
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
const analyticsScripts = [];
await context.route(/(?:_vercel\/insights\/|va\.vercel-scripts\.com)/, async (route) => {
  analyticsScripts.push(route.request().url());
  await route.fulfill({
    contentType: "application/javascript",
    body: "/* analytics transport mocked by privacy smoke */",
  });
});
// No personal information leaves this browser test.
let waitlistPayload;
await context.route("**/api/waitlist", async (route) => {
  waitlistPayload = route.request().postDataJSON();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true }),
  });
});
try {
  const initialResponse = await page.goto(`${base}/join-waitlist`, { waitUntil: "networkidle" });
  if (productionSmoke)
    assert.match(initialResponse.headers()["content-security-policy"], /script-src 'self'/);
  await page.getByRole("heading", { name: "Your privacy choices" }).waitFor();
  assert.equal(analyticsScripts.length, 0, "optional script loaded before consent");
  const reject = page.getByRole("button", { name: "Reject analytics", exact: true });
  const accept = page.getByRole("button", { name: "Accept analytics", exact: true });
  const rejectStyle = await reject.evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
    width: el.getBoundingClientRect().width,
  }));
  const acceptStyle = await accept.evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
    width: el.getBoundingClientRect().width,
  }));
  assert.deepEqual(rejectStyle, acceptStyle, "accept/reject must have equal prominence");
  await page.screenshot({ path: "/tmp/hungry-cookie-consent-smoke.png", fullPage: false });
  await reject.click();
  assert.equal(analyticsScripts.length, 0);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("heading", { name: "Your privacy choices" }).count(), 0);
  assert.equal(analyticsScripts.length, 0);
  await page.getByRole("button", { name: "Cookie preferences" }).click();
  await reject.waitFor();
  assert.equal(await reject.evaluate((el) => el === document.activeElement), true);
  await accept.click();
  await page.waitForFunction(() =>
    document.querySelector('script[src*="insights"], script[src*="vercel-scripts"]'),
  );
  await page.waitForTimeout(300);
  assert.equal(analyticsScripts.length, 1);
  if (productionSmoke) {
    assert.equal(new URL(analyticsScripts[0]).origin, new URL(base).origin);
    assert.equal(new URL(analyticsScripts[0]).pathname, "/_vercel/insights/script.js");
  }
  await page.getByRole("button", { name: "Cookie preferences" }).click();
  await reject.click();
  const choice = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hungry.website-consent.v1")),
  );
  assert.equal(choice.analytics, false);
  const foodie = page.getByRole("tab", { name: "I'm a foodie" });
  await foodie.focus();
  await page.keyboard.press("ArrowRight");
  const merchant = page.getByRole("tab", { name: "I'm a merchant" });
  assert.equal(await merchant.getAttribute("aria-selected"), "true");
  assert.equal(await merchant.evaluate((el) => el === document.activeElement), true);
  assert.equal(await page.getByLabel("Business name (optional)").getAttribute("required"), null);
  await page.keyboard.press("Home");
  assert.equal(await foodie.getAttribute("aria-selected"), "true");
  await page.getByLabel("Email address", { exact: true }).fill("privacy-smoke@example.test");
  await page.getByRole("button", { name: "Join foodie waitlist" }).click();
  assert.equal(waitlistPayload, undefined, "unchecked consent must block submission");
  await page.getByRole("checkbox", { name: /I am 18 or older/ }).check();
  await page.getByRole("checkbox", { name: /Email me about early access/ }).check();
  await page.getByRole("button", { name: "Join foodie waitlist" }).click();
  await page.getByRole("heading", { name: "You are on the list" }).waitFor();
  assert.equal(waitlistPayload.ageConfirmed, true);
  assert.equal(waitlistPayload.updatesRequested, true);
  assert.equal(waitlistPayload.businessName, undefined);
  await page.goto(`${base}/merchant/signup`, { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("checkbox").count(), 2);
  for (const checkbox of await page.getByRole("checkbox").all())
    assert.equal(await checkbox.isChecked(), false);
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join("\n"));
  await page.screenshot({ path: "/tmp/hungry-merchant-consent-smoke.png", fullPage: true });
  console.log(
    "Privacy browser smoke passed: equal choices, no pre-consent script, persisted rejection, accept/withdraw, preference keyboard focus, waitlist tab keys, required unchecked attestations and mocked-only submission; zero page errors.",
  );
} finally {
  await context.close();
  await browser.close();
}
