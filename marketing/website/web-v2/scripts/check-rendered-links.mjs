const baseUrl = new URL(process.env.WEBSITE_BASE_URL || "http://127.0.0.1:3000");
const timeoutMs = Number(process.env.LINK_CRAWL_TIMEOUT_MS || 10000);
const failures = [];
const checkedRoutes = new Set();
const discoveredRoutes = new Set();

const privateRoutePrefixes = ["/api/", "/console", "/merchant"];
const ignoredSchemes = ["mailto:", "tel:", "sms:", "javascript:"];
const ignoredPathPrefixes = ["/_next/", "/images/", "/favicon", "/apple-touch-icon", "/robots.txt", "/sitemap.xml"];
const assetExtensions = /\.(avif|css|gif|ico|jpg|jpeg|js|json|map|pdf|png|svg|txt|webp|xml)$/i;

function fail(message) {
  failures.push(message);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeInternalHref(href, fromRoute) {
  const value = href.trim();
  if (!value || value.startsWith("#")) return null;
  if (ignoredSchemes.some((scheme) => value.toLowerCase().startsWith(scheme))) return null;

  let url;
  try {
    url = new URL(value, new URL(fromRoute, baseUrl));
  } catch {
    fail(`${fromRoute}: invalid href ${JSON.stringify(value)}`);
    return null;
  }

  if (url.origin !== baseUrl.origin) return null;

  const path = url.pathname.replace(/\/$/, "") || "/";
  if (ignoredPathPrefixes.some((prefix) => path.startsWith(prefix))) return null;
  if (assetExtensions.test(path)) return null;

  return path;
}

function extractHrefs(html) {
  return [...html.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
}

async function getSitemapRoutes() {
  const sitemapUrl = new URL("/sitemap.xml", baseUrl);
  const response = await fetchWithTimeout(sitemapUrl);
  if (!response.ok) {
    fail(`/sitemap.xml returned ${response.status}`);
    return [];
  }

  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => {
      try {
        const url = new URL(match[1]);
        return url.pathname.replace(/\/$/, "") || "/";
      } catch {
        return normalizeInternalHref(match[1], "/sitemap.xml");
      }
    })
    .filter(Boolean);
}

async function checkRoute(route) {
  if (checkedRoutes.has(route)) return;
  checkedRoutes.add(route);

  if (privateRoutePrefixes.some((prefix) => route === prefix.replace(/\/$/, "") || route.startsWith(prefix))) {
    fail(`Public page crawl discovered private route: ${route}`);
    return;
  }

  const url = new URL(route, baseUrl);
  let response;
  try {
    response = await fetchWithTimeout(url, {
      headers: { accept: "text/html,application/xhtml+xml" },
    });
  } catch (error) {
    fail(`${route} failed to load: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (response.status >= 400) {
    fail(`${route} returned ${response.status}`);
    return;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return;

  const html = await response.text();
  for (const href of extractHrefs(html)) {
    const linkedRoute = normalizeInternalHref(href, route);
    if (linkedRoute) discoveredRoutes.add(linkedRoute);
  }
}

const sitemapRoutes = await getSitemapRoutes();
for (const route of sitemapRoutes) discoveredRoutes.add(route);

if (discoveredRoutes.size === 0) {
  fail("Sitemap did not expose any crawlable public routes.");
}

for (const route of [...discoveredRoutes]) {
  await checkRoute(route);
}

for (const route of [...discoveredRoutes]) {
  await checkRoute(route);
}

if (failures.length > 0) {
  console.error("Rendered link crawl failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Rendered link crawl passed. Checked ${checkedRoutes.size} internal routes from ${baseUrl.origin}.`);
