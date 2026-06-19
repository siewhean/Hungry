import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seoSource = await readFile(path.join(root, "src/app/seo.ts"), "utf8");
const sitemapSource = await readFile(path.join(root, "src/app/sitemap.ts"), "utf8");
const robotsSource = await readFile(path.join(root, "src/app/robots.ts"), "utf8");
const failures = [];

const staticRoutePaths = [...seoSource.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
const generatedRouteMarkers = [
  "...seoAreas.map",
  "...seoDishes.map",
  "...dishAreaPages.map",
  "...seoPlaces.map",
  "...seoGuides.map",
];

const privatePatterns = ["/api/", "/console", "/merchant", "/merchant/login", "/merchant/signup"];

for (const routePath of staticRoutePaths) {
  if (privatePatterns.some((pattern) => routePath.startsWith(pattern))) {
    failures.push(`Private route appears in public SEO routes: ${routePath}`);
  }
}

for (const marker of generatedRouteMarkers) {
  if (!seoSource.includes(marker)) {
    failures.push(`SEO route registry is missing generated sitemap route marker: ${marker}`);
  }
}

for (const marker of [
  ".filter((route) => !route.noindex)",
  "absoluteUrl(route.path)",
  "lastModified: new Date(route.lastModified)",
]) {
  if (!sitemapSource.includes(marker)) {
    failures.push(`sitemap.ts is missing marker: ${marker}`);
  }
}

for (const marker of [
  '"/api/"',
  '"/console/"',
  '"/merchant/"',
  "OAI-SearchBot",
  "Claude-SearchBot",
]) {
  if (!robotsSource.includes(marker)) {
    failures.push(`robots.ts is missing marker: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error("SEO sitemap validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SEO sitemap validation passed.");
