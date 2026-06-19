const baseUrl = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3000";
const requireAuthenticatedProof = process.env.HUNGRY_REQUIRE_PRIVATE_ROUTE_QC === "1";
const merchantAccessToken = process.env.HUNGRY_MERCHANT_ACCESS_TOKEN?.trim() || "";
const consoleToken =
  process.env.HUNGRY_CONSOLE_API_TOKEN?.trim() ||
  process.env.HUNGRY_CONSOLE_ADMIN_TOKEN?.trim() ||
  "";
const consoleAdminBearerToken = process.env.HUNGRY_CONSOLE_ADMIN_BEARER_TOKEN?.trim() || "";
const consoleNonAdminBearerToken = process.env.HUNGRY_CONSOLE_NON_ADMIN_BEARER_TOKEN?.trim() || "";
const failures = [];

function routeUrl(path) {
  return new URL(path, baseUrl).toString();
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

async function request(path, init = {}) {
  return fetch(routeUrl(path), {
    redirect: "manual",
    ...init,
    headers: {
      ...(init.headers || {}),
    },
  });
}

function hasPrivateHeaders(response) {
  const cacheControl = response.headers.get("cache-control") || "";
  const robots = response.headers.get("x-robots-tag") || "";
  return cacheControl.includes("no-store") && robots.includes("noindex");
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

async function expectRedirect(path, expectedLocationPart) {
  const response = await request(path, { headers: { accept: "text/html" } });
  const location = response.headers.get("location") || "";
  expect(
    response.status >= 300 && response.status < 400,
    `${path}: expected redirect, got status ${response.status}`,
  );
  expect(location.includes(expectedLocationPart), `${path}: expected redirect to ${expectedLocationPart}, got ${location}`);
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on private redirect.`);
}

async function expectJsonDenied(path, expectedStatuses = [401, 403, 503]) {
  const response = await request(path, { headers: { accept: "application/json" } });
  expect(
    expectedStatuses.includes(response.status),
    `${path}: expected denied JSON status ${expectedStatuses.join("/")}, got ${response.status}`,
  );
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on private API denial.`);
}

async function expectPageOk(path, cookies) {
  const response = await request(path, {
    headers: {
      cookie: cookieHeader(cookies),
    },
  });
  expect(response.status === 200, `${path}: expected authenticated page status 200, got ${response.status}`);
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on authenticated private page.`);
}

async function expectApiOk(path, cookiesOrHeaders) {
  const headers =
    "cookie" in cookiesOrHeaders || "authorization" in cookiesOrHeaders
      ? cookiesOrHeaders
      : { cookie: cookieHeader(cookiesOrHeaders) };
  const response = await request(path, {
    headers: {
      accept: "application/json",
      ...headers,
    },
  });
  expect(response.status === 200, `${path}: expected authenticated API status 200, got ${response.status}`);
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on authenticated private API.`);
}

async function expectApiDeniedWithBearer(path, bearerToken) {
  const response = await request(path, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${bearerToken}`,
    },
  });
  expect(
    response.status === 401 || response.status === 403,
    `${path}: expected non-admin bearer denial, got ${response.status}`,
  );
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on non-admin denial.`);
}

await expectRedirect("/merchant", "/merchant/login");
await expectRedirect("/merchant/menu", "/merchant/login");
await expectRedirect("/console", "/");
await expectRedirect("/console/waitlist", "/");
await expectJsonDenied("/api/merchant/session", [401]);
await expectJsonDenied("/api/merchant/overview", [401]);
await expectJsonDenied("/api/console/waitlist", [401, 503]);

if (merchantAccessToken) {
  const merchantCookies = { hungry_merchant_access_token: merchantAccessToken };
  await expectPageOk("/merchant", merchantCookies);
  await expectPageOk("/merchant/menu", merchantCookies);
  await expectApiOk("/api/merchant/session", merchantCookies);
  await expectApiOk("/api/merchant/overview", merchantCookies);
} else if (requireAuthenticatedProof) {
  failures.push("HUNGRY_MERCHANT_ACCESS_TOKEN is required when HUNGRY_REQUIRE_PRIVATE_ROUTE_QC=1.");
}

if (consoleToken) {
  const consoleCookies = { hungry_console_api_token: consoleToken };
  await expectPageOk("/console", consoleCookies);
  await expectPageOk("/console/waitlist", consoleCookies);
  await expectApiOk("/api/console/waitlist", consoleCookies);
} else if (consoleAdminBearerToken) {
  await expectApiOk("/api/console/waitlist", { authorization: `Bearer ${consoleAdminBearerToken}` });
} else if (requireAuthenticatedProof) {
  failures.push(
    "HUNGRY_CONSOLE_API_TOKEN/HUNGRY_CONSOLE_ADMIN_TOKEN or HUNGRY_CONSOLE_ADMIN_BEARER_TOKEN is required when HUNGRY_REQUIRE_PRIVATE_ROUTE_QC=1.",
  );
}

if (consoleNonAdminBearerToken) {
  await expectApiDeniedWithBearer("/api/console/waitlist", consoleNonAdminBearerToken);
}

if (failures.length > 0) {
  console.error("Private route QC failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Private route QC passed: unauthenticated merchant/console access is denied.");
if (merchantAccessToken) {
  console.log("Authenticated merchant route/API QC passed.");
} else {
  console.log("Authenticated merchant route/API QC skipped: HUNGRY_MERCHANT_ACCESS_TOKEN is not set.");
}
if (consoleToken || consoleAdminBearerToken) {
  console.log("Authenticated console route/API QC passed.");
} else {
  console.log("Authenticated console route/API QC skipped: console token/admin bearer token is not set.");
}
if (consoleNonAdminBearerToken) {
  console.log("Non-admin console bearer denial QC passed.");
} else {
  console.log("Non-admin console bearer denial QC skipped: HUNGRY_CONSOLE_NON_ADMIN_BEARER_TOKEN is not set.");
}
