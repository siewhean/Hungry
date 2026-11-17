const baseUrl = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3000";
const requireAuthenticatedProof = process.env.HUNGRY_REQUIRE_PRIVATE_ROUTE_QC === "1";
const merchantAccessToken = process.env.HUNGRY_MERCHANT_ACCESS_TOKEN?.trim() || "";
const consoleUsername =
  process.env.HUNGRY_CONSOLE_USERNAME?.trim() ||
  process.env.HUNGRY_CONSOLE_BASIC_AUTH_USERNAME?.trim() ||
  "";
const consolePassword =
  process.env.HUNGRY_CONSOLE_PASSWORD?.trim() ||
  process.env.HUNGRY_CONSOLE_BASIC_AUTH_PASSWORD?.trim() ||
  "";
const failures = [];

function routeUrl(path) {
  return new URL(path, baseUrl).toString();
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

function basicAuthorization(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
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

function authHeaders(cookiesOrHeaders) {
  return "cookie" in cookiesOrHeaders || "authorization" in cookiesOrHeaders
    ? cookiesOrHeaders
    : { cookie: cookieHeader(cookiesOrHeaders) };
}

async function expectPageOk(path, cookiesOrHeaders) {
  const headers = authHeaders(cookiesOrHeaders);
  const response = await request(path, {
    headers,
  });
  expect(response.status === 200, `${path}: expected authenticated page status 200, got ${response.status}`);
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on authenticated private page.`);
}

async function expectApiOk(path, cookiesOrHeaders) {
  const headers = authHeaders(cookiesOrHeaders);
  const response = await request(path, {
    headers: {
      accept: "application/json",
      ...headers,
    },
  });
  expect(response.status === 200, `${path}: expected authenticated API status 200, got ${response.status}`);
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on authenticated private API.`);
}

async function expectDeniedWithInvalidBasic(path) {
  const response = await request(path, {
    headers: {
      accept: "application/json",
      authorization: basicAuthorization("wrong-user", "wrong-password"),
    },
  });
  expect(
    response.status === 401,
    `${path}: expected invalid Basic Auth denial, got ${response.status}`,
  );
  expect(hasPrivateHeaders(response), `${path}: expected no-store/noindex headers on non-admin denial.`);
  expect(
    response.headers.get("www-authenticate")?.includes("Basic"),
    `${path}: expected Basic Auth challenge on invalid credentials.`,
  );
}

await expectRedirect("/merchant", "/merchant/login");
await expectRedirect("/merchant/menu", "/merchant/login");
await expectJsonDenied("/console", [401, 503]);
await expectJsonDenied("/console/waitlist", [401, 503]);
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

if (consoleUsername && consolePassword) {
  const authorization = basicAuthorization(consoleUsername, consolePassword);
  await expectPageOk("/console", { authorization });
  await expectPageOk("/console/waitlist", { authorization });
  await expectApiOk("/api/console/waitlist", { authorization });
  await expectDeniedWithInvalidBasic("/api/console/waitlist");
} else if (requireAuthenticatedProof) {
  failures.push(
    "HUNGRY_CONSOLE_USERNAME and HUNGRY_CONSOLE_PASSWORD are required when HUNGRY_REQUIRE_PRIVATE_ROUTE_QC=1.",
  );
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
if (consoleUsername && consolePassword) {
  console.log("Authenticated console route/API QC passed.");
} else {
  console.log("Authenticated console route/API QC skipped: console username/password is not set.");
}
