import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3000";
const outputDir = path.resolve(
  process.env.CSP_EVIDENCE_DIR || "../../../tasks/release-evidence/web-csp-pr115",
);
const merchantPortalEnabled = process.env.HUNGRY_MERCHANT_PORTAL_ENABLED === "1";
const vercelAnalyticsEnabled = process.env.VERCEL === "1";

const routes = [
  { path: "/", status: 200 },
  { path: "/for-foodies", status: 200 },
  { path: "/for-merchants", status: 200 },
  { path: "/join-waitlist", status: 200 },
  { path: "/privacy", status: 200 },
  { path: "/singapore", status: 200 },
  { path: "/merchant", status: merchantPortalEnabled ? 200 : 503 },
  { path: "/console", status: 503 },
];

function nonceFromPolicy(policy) {
  return policy?.match(/script-src[^;]*'nonce-([^']+)'/)?.[1] ?? "";
}

function assertHardenedPolicy(policy, route) {
  assert.ok(policy, `${route}: missing Content-Security-Policy`);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/, `${route}: unsafe inline scripts`);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-eval'/, `${route}: unsafe eval`);
  assert.match(policy, /script-src[^;]*'strict-dynamic'/, `${route}: strict-dynamic missing`);
  assert.match(policy, /script-src-attr 'none'/, `${route}: inline event handlers not denied`);
  assert.match(policy, /frame-src 'none'/, `${route}: frame sources not denied`);
  assert.match(policy, /style-src-elem[^;]*'nonce-/, `${route}: style-element nonce missing`);
  assert.match(
    policy,
    /style-src-attr 'unsafe-inline'/,
    `${route}: React style compatibility missing`,
  );
  assert.match(policy, /connect-src 'self'/, `${route}: connect-src not same-origin only`);
  assert.doesNotMatch(policy, /connect-src[^;]*https:/, `${route}: broad HTTPS connects allowed`);
}

async function addViolationCollector(page) {
  await page.addInitScript(() => {
    window.__hungryCspViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => {
      window.__hungryCspViolations.push({
        blockedURI: event.blockedURI,
        effectiveDirective: event.effectiveDirective,
        violatedDirective: event.violatedDirective,
      });
    });
  });
}

async function inspectDocument(page, route, expectedStatus) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await addViolationCollector(page);

  const response = await page.goto(new URL(route, baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  assert.ok(response, `${route}: navigation returned no response`);
  assert.equal(response.status(), expectedStatus, `${route}: unexpected response status`);

  const policy = response.headers()["content-security-policy"] ?? "";
  assertHardenedPolicy(policy, route);
  const nonce = nonceFromPolicy(policy);
  assert.ok(nonce, `${route}: CSP nonce missing`);

  if (expectedStatus === 200) {
    const state = await page.evaluate(() => ({
      jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
        (script) => script.nonce,
      ),
      mainHeight: document.querySelector("main")?.getBoundingClientRect().height ?? 0,
      scripts: Array.from(document.scripts).map((script) => ({
        nonce: script.nonce,
        src: script.getAttribute("src") ?? "",
      })),
      styleElements: Array.from(document.querySelectorAll("style")).map((style) => style.nonce),
      violations: window.__hungryCspViolations,
    }));

    assert.ok(state.mainHeight > 0, `${route}: main content did not render`);
    assert.ok(state.scripts.length > 0, `${route}: no framework scripts rendered`);
    assert.ok(
      state.scripts.every(
        (script) =>
          script.nonce === nonce ||
          (vercelAnalyticsEnabled && script.src === "/_vercel/insights/script.js"),
      ),
      `${route}: an untrusted script is missing the response nonce`,
    );
    assert.ok(
      state.styleElements.every((styleNonce) => styleNonce === nonce),
      `${route}: a style element is missing the response nonce`,
    );
    assert.ok(
      state.jsonLd.every((scriptNonce) => scriptNonce === nonce),
      `${route}: JSON-LD is missing the response nonce`,
    );
    assert.deepEqual(state.violations, [], `${route}: legitimate resources violated CSP`);
    assert.deepEqual(pageErrors, [], `${route}: page errors detected`);
    assert.deepEqual(
      consoleErrors.filter((message) => message.includes("Content Security Policy")),
      [],
      `${route}: unexpected CSP console errors`,
    );
  }

  return nonce;
}

mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

const nonces = [];
for (const route of routes) {
  const page = await context.newPage();
  nonces.push(await inspectDocument(page, route.path, route.status));
  await page.close();
}
assert.equal(new Set(nonces).size, nonces.length, "Document requests reused a CSP nonce");

const hostilePage = await context.newPage();
await hostilePage.setExtraHTTPHeaders({
  "Content-Security-Policy": "default-src *; script-src 'unsafe-inline' *",
  "x-nonce": "attacker-controlled",
});
const hostileNonce = await inspectDocument(hostilePage, "/about", 200);
assert.notEqual(
  hostileNonce,
  "attacker-controlled",
  "Untrusted request nonce reached the response",
);

await hostilePage.evaluate(() => {
  window.__hungryCspViolations = [];
  window.__hungryInlineHandlerExecuted = false;

  const button = document.createElement("button");
  button.hidden = true;
  button.setAttribute("onclick", "window.__hungryInlineHandlerExecuted = true");
  document.body.append(button);
  button.click();

  const style = document.createElement("style");
  style.textContent = "body { --hungry-injected-style: applied; }";
  document.head.append(style);
});
await hostilePage.waitForTimeout(100);
const injectionState = await hostilePage.evaluate(() => ({
  inlineHandlerExecuted: window.__hungryInlineHandlerExecuted,
  injectedStyle: getComputedStyle(document.body).getPropertyValue("--hungry-injected-style"),
  violations: window.__hungryCspViolations,
}));
assert.equal(injectionState.inlineHandlerExecuted, false, "Inline event handler executed");
assert.equal(injectionState.injectedStyle, "", "Nonce-less style element applied");
assert.ok(
  injectionState.violations.some((entry) => entry.effectiveDirective === "script-src-attr"),
  "Blocked inline event handler did not emit a CSP violation",
);
assert.ok(
  injectionState.violations.some((entry) => entry.effectiveDirective === "style-src-elem"),
  "Blocked style element did not emit a CSP violation",
);
await hostilePage.close();

const interactionPage = await context.newPage();
await addViolationCollector(interactionPage);
await interactionPage.goto(new URL("/", baseUrl).toString(), { waitUntil: "networkidle" });
const discoverLink = interactionPage
  .locator('header nav[aria-label="Primary navigation"]')
  .getByRole("link", { name: "Discover Food", exact: true });
await assert.doesNotReject(async () => {
  await Promise.all([
    interactionPage.waitForURL(new URL("/for-foodies", baseUrl).toString()),
    discoverLink.click(),
  ]);
});
assert.equal(new URL(interactionPage.url()).pathname, "/for-foodies");
assert.deepEqual(
  await interactionPage.evaluate(() => window.__hungryCspViolations),
  [],
  "Client navigation caused a CSP violation",
);
await interactionPage.screenshot({
  path: path.join(outputDir, "for-foodies-desktop.png"),
  fullPage: false,
});
await interactionPage.close();

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const mobilePage = await mobileContext.newPage();
await inspectDocument(mobilePage, "/", 200);
await mobilePage.screenshot({
  path: path.join(outputDir, "home-mobile.png"),
  fullPage: false,
});
await mobileContext.close();

await context.close();
await browser.close();

console.log(
  `CSP browser smoke passed for ${routes.length} routes, hostile-header overwrite, blocked injection, client navigation, and desktop/mobile screenshots.`,
);
