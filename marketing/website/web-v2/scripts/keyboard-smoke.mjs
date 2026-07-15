import { chromium } from "playwright";

const baseUrl = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3000";
const routes = [
  "/",
  "/for-foodies",
  "/for-merchants",
  "/join-waitlist",
  "/contact",
  "/privacy",
  "/terms",
  "/account/delete",
  "/singapore",
];
const merchantAuthRoutes = [
  "/merchant/login",
  "/merchant/signup",
  "/merchant/forgot-password",
];
const merchantPortalEnabled = process.env.HUNGRY_MERCHANT_PORTAL_ENABLED === "1";
if (merchantPortalEnabled) routes.push(...merchantAuthRoutes);
const redirectRoutes = merchantPortalEnabled ? ["/merchant"] : [];
const failClosedMerchantRoutes = merchantPortalEnabled
  ? []
  : ["/merchant", ...merchantAuthRoutes, "/api/merchant/session"];
const failClosedConsoleRoutes = ["/console"];
const authenticatedMerchantRoutes = [
  "/merchant",
  "/merchant/menu",
  "/merchant/analytics",
  "/merchant/reviews",
  "/merchant/promotions",
  "/merchant/verification",
  "/merchant/profile",
  "/merchant/settings",
];
const authenticatedConsoleRoutes = ["/console", "/console/waitlist"];
const merchantAccessToken = process.env.HUNGRY_MERCHANT_ACCESS_TOKEN?.trim() || "";
const consoleUsername =
  process.env.HUNGRY_CONSOLE_USERNAME?.trim() ||
  process.env.HUNGRY_CONSOLE_BASIC_AUTH_USERNAME?.trim() ||
  "";
const consolePassword =
  process.env.HUNGRY_CONSOLE_PASSWORD?.trim() ||
  process.env.HUNGRY_CONSOLE_BASIC_AUTH_PASSWORD?.trim() ||
  "";
const consoleBreakGlassEnabled = process.env.HUNGRY_CONSOLE_BREAK_GLASS_ENABLED === "1";
const failures = [];

function routeUrl(route) {
  return new URL(route, baseUrl).toString();
}

function basicAuthorization(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

const browser = await chromium.launch({ headless: true });

async function assertSkipLink(route, page) {
  await page.goto(routeUrl(route), { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(220);

  const skipState = await page.evaluate(() => {
    const active = document.activeElement;
    const rect = active?.getBoundingClientRect();
    return {
      className: active?.getAttribute("class") ?? "",
      href: active?.getAttribute("href") ?? "",
      isVisible:
        Boolean(rect) &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0,
      tagName: active?.tagName ?? "",
      text: active?.textContent?.trim() ?? "",
    };
  });

  if (
    skipState.tagName !== "A" ||
    skipState.href !== "#main-content" ||
    !skipState.className.includes("skipLink") ||
    !skipState.isVisible
  ) {
    failures.push(`${route}: first Tab did not reveal the skip link (${JSON.stringify(skipState)})`);
    await page.close();
    return;
  }

  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);

  const targetState = await page.evaluate(() => ({
    activeId: document.activeElement?.id ?? "",
    activeTabIndex: document.activeElement?.getAttribute("tabindex") ?? "",
    hash: window.location.hash,
    targetExists: Boolean(document.getElementById("main-content")),
  }));

  if (
    targetState.hash !== "#main-content" ||
    targetState.activeId !== "main-content" ||
    targetState.activeTabIndex !== "-1" ||
    !targetState.targetExists
  ) {
    failures.push(`${route}: skip link did not focus main content (${JSON.stringify(targetState)})`);
  }

  await page.close();
}

for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await assertSkipLink(route, page);
}

if (merchantPortalEnabled && merchantAccessToken) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([
    {
      domain: new URL(baseUrl).hostname,
      httpOnly: true,
      name: "hungry_merchant_access_token",
      path: "/",
      sameSite: "Lax",
      value: merchantAccessToken,
    },
  ]);

  for (const route of authenticatedMerchantRoutes) {
    const page = await context.newPage();
    await assertSkipLink(route, page);
  }

  await context.close();
}

if (consoleBreakGlassEnabled && consoleUsername && consolePassword) {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      Authorization: basicAuthorization(consoleUsername, consolePassword),
    },
    viewport: { width: 1280, height: 900 },
  });

  for (const route of authenticatedConsoleRoutes) {
    const page = await context.newPage();
    await assertSkipLink(route, page);
  }

  await context.close();
}

for (const route of redirectRoutes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const response = await page.goto(routeUrl(route), { waitUntil: "domcontentloaded" });
  const pathname = new URL(page.url()).pathname;
  const status = response?.status() ?? 0;

  if (route === "/merchant" && pathname !== "/merchant/login") {
    failures.push(`${route}: expected unauthenticated redirect to /merchant/login, got ${page.url()}`);
  }

  if (status >= 500) {
    failures.push(`${route}: redirect smoke returned server error ${status}`);
  }

  await page.close();
}

for (const route of failClosedMerchantRoutes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const response = await page.goto(routeUrl(route), { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;

  if (new URL(page.url()).pathname !== route || status !== 503) {
    failures.push(
      `${route}: expected fail-closed 503 with Merchant Portal disabled, got ${status} at ${page.url()}`,
    );
  }

  await page.close();
}

for (const route of failClosedConsoleRoutes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const response = await page.goto(routeUrl(route), { waitUntil: "domcontentloaded" });
  const pathname = new URL(page.url()).pathname;
  const status = response?.status() ?? 0;

  if (consoleBreakGlassEnabled && consoleUsername && consolePassword) {
    if (pathname !== "/") {
      failures.push(`${route}: expected unauthenticated redirect to /, got ${page.url()}`);
    }
    if (status >= 500) {
      failures.push(`${route}: redirect smoke returned server error ${status}`);
    }
  } else {
    if (pathname !== route || status !== 503) {
      failures.push(
        `${route}: expected fail-closed 503 with no console credentials, got ${status} at ${page.url()}`,
      );
    }
  }

  await page.close();
}

await browser.close();

if (failures.length > 0) {
  console.error("Keyboard smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Keyboard smoke passed for ${routes.length} pages and ${redirectRoutes.length} private redirects.`);
if (!merchantPortalEnabled) {
  console.log(`Fail-closed Merchant Portal smoke passed for ${failClosedMerchantRoutes.length} routes.`);
}
if (!consoleBreakGlassEnabled || !consoleUsername || !consolePassword) {
  console.log(`Fail-closed console smoke passed for ${failClosedConsoleRoutes.length} private route.`);
}
if (merchantPortalEnabled && merchantAccessToken) {
  console.log(`Authenticated merchant keyboard smoke passed for ${authenticatedMerchantRoutes.length} pages.`);
} else if (!merchantPortalEnabled) {
  console.log("Authenticated merchant keyboard smoke skipped: Merchant Portal is disabled.");
} else {
  console.log("Authenticated merchant keyboard smoke skipped: HUNGRY_MERCHANT_ACCESS_TOKEN is not set.");
}
if (consoleBreakGlassEnabled && consoleUsername && consolePassword) {
  console.log(`Authenticated console keyboard smoke passed for ${authenticatedConsoleRoutes.length} pages.`);
} else if (!consoleBreakGlassEnabled) {
  console.log("Authenticated console keyboard smoke skipped: Basic Auth break-glass access is disabled.");
} else {
  console.log("Authenticated console keyboard smoke skipped: HUNGRY_CONSOLE_USERNAME/PASSWORD is not set.");
}
