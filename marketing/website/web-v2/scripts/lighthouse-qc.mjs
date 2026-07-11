import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const baseUrl = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3000";
const routes = (process.env.HUNGRY_LIGHTHOUSE_ROUTES || "/,/for-foodies,/for-merchants,/join-waitlist,/merchant/login")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const requireAuthenticated = process.env.HUNGRY_REQUIRE_AUTHENTICATED_LIGHTHOUSE === "1";
const merchantAccessToken = process.env.HUNGRY_MERCHANT_ACCESS_TOKEN?.trim() || "";
const consoleUsername =
  process.env.HUNGRY_CONSOLE_USERNAME?.trim() ||
  process.env.HUNGRY_CONSOLE_BASIC_AUTH_USERNAME?.trim() ||
  "";
const consolePassword =
  process.env.HUNGRY_CONSOLE_PASSWORD?.trim() ||
  process.env.HUNGRY_CONSOLE_BASIC_AUTH_PASSWORD?.trim() ||
  "";
const outputDir = process.env.HUNGRY_LIGHTHOUSE_OUTPUT_DIR || join(tmpdir(), "hungry-web-v2-lighthouse");
const failures = [];

const defaultThresholds = {
  accessibility: 0.9,
  "best-practices": 0.9,
  performance: 0.75,
  seo: 0.9,
};

function routeUrl(route) {
  return new URL(route, baseUrl).toString();
}

function routeSlug(route) {
  const normalized = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || "home";
}

function basicAuthorization(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function headersForRoute(route) {
  if (route.startsWith("/merchant") && !["/merchant/login", "/merchant/signup", "/merchant/forgot-password"].includes(route)) {
    if (!merchantAccessToken) return undefined;
    return { Cookie: `hungry_merchant_access_token=${encodeURIComponent(merchantAccessToken)}` };
  }

  if (route.startsWith("/console")) {
    if (!consoleUsername || !consolePassword) return undefined;
    return { Authorization: basicAuthorization(consoleUsername, consolePassword) };
  }

  return undefined;
}

function thresholdsForRoute(route) {
  if (route.startsWith("/merchant") || route.startsWith("/console")) {
    return { ...defaultThresholds, seo: 0.6 };
  }
  return defaultThresholds;
}

function runLighthouse(route) {
  const headers = headersForRoute(route);
  const requiresAuth = route.startsWith("/console") || (route.startsWith("/merchant") && route !== "/merchant/login" && route !== "/merchant/signup" && route !== "/merchant/forgot-password");

  if (requiresAuth && !headers) {
    if (requireAuthenticated) {
      failures.push(`${route}: authenticated Lighthouse token is required.`);
    } else {
      console.log(`${route}: authenticated Lighthouse skipped because token is not set.`);
    }
    return;
  }

  const outputPath = join(outputDir, `${routeSlug(route)}.json`);
  const args = [
    "--yes",
    "lighthouse@latest",
    routeUrl(route),
    "--quiet",
    "--chrome-flags=--headless=new --no-sandbox",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    `--output-path=${outputPath}`,
  ];

  if (headers) {
    args.push(`--extra-headers=${JSON.stringify(headers)}`);
  }

  const result = spawnSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    failures.push(`${route}: Lighthouse failed.\n${result.stderr || result.stdout}`);
    return;
  }

  const report = JSON.parse(readFileSync(outputPath, "utf8"));
  const thresholds = thresholdsForRoute(route);
  const scores = Object.fromEntries(
    Object.entries(thresholds).map(([category]) => [category, report.categories?.[category]?.score ?? 0]),
  );

  for (const [category, minimum] of Object.entries(thresholds)) {
    if (scores[category] < minimum) {
      failures.push(`${route}: ${category} score ${Math.round(scores[category] * 100)} is below ${Math.round(minimum * 100)}.`);
    }
  }

  console.log(
    `${route}: Lighthouse ${Object.entries(scores)
      .map(([category, score]) => `${category} ${Math.round(score * 100)}`)
      .join(", ")}`,
  );
}

mkdirSync(outputDir, { recursive: true });

for (const route of routes) {
  runLighthouse(route);
}

if (failures.length > 0) {
  console.error("Lighthouse QC failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lighthouse QC passed for ${routes.length} configured route(s). Reports: ${outputDir}`);
