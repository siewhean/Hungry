import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "src/app/seo.ts",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/components/seo/JsonLd.tsx",
  "public/llms.txt",
  "public/llms-full.txt",
];

const requiredSourceMarkers = [
  ["src/app/layout.tsx", "metadataBase"],
  ["src/app/layout.tsx", "openGraph"],
  ["src/app/layout.tsx", "twitter"],
  ["src/app/layout.tsx", "robots"],
  ["src/app/layout.tsx", "JsonLd"],
  ["src/app/robots.ts", "OAI-SearchBot"],
  ["src/app/robots.ts", "GPTBot"],
  ["src/app/robots.ts", "Claude-SearchBot"],
  ["src/app/robots.ts", "PerplexityBot"],
  ["src/app/robots.ts", "Google-Extended"],
  ["src/app/sitemap.ts", "publicRoutes"],
  ["src/app/sitemap.ts", "lastModified: new Date(route.lastModified)"],
  ["src/app/seo.ts", "Organization"],
  ["src/app/seo.ts", "WebSite"],
  ["src/app/seo.ts", "MobileApplication"],
  ["public/llms.txt", "https://hungry.sg/for-foodies"],
  ["public/llms.txt", "https://hungry.sg/for-merchants"],
  ["public/llms-full.txt", "dish-first discovery"],
];

const staleRouteMarkers = [
  "/about",
  "/merchant-login",
  "/merchant-dashboard",
];

const failures = [];

async function readRelative(relativePath) {
  const absolutePath = path.join(root, relativePath);

  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    failures.push(`${relativePath} is missing or unreadable: ${error.message}`);
    return "";
  }
}

async function existsRelative(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

for (const relativePath of requiredFiles) {
  await readRelative(relativePath);
}

const seoSource = await readRelative("src/app/seo.ts");
const routePaths = [...seoSource.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);

if (routePaths.length === 0) {
  failures.push("src/app/seo.ts does not expose any public route paths");
}

const uniqueRoutePaths = new Set(routePaths);

if (uniqueRoutePaths.size !== routePaths.length) {
  failures.push("src/app/seo.ts contains duplicate public route paths");
}

if (!/title:\s*{\s*absolute:\s*route\.title/s.test(seoSource)) {
  failures.push("src/app/seo.ts should use title.absolute to avoid title template duplication");
}

for (const routePath of routePaths) {
  const pagePath =
    routePath === "/" ? "src/app/page.tsx" : `src/app${routePath.replace(/\/$/, "")}/page.tsx`;

  if (!(await existsRelative(pagePath))) {
    failures.push(`public route ${routePath} has no page file at ${pagePath}`);
  }
}

for (const [relativePath, marker] of requiredSourceMarkers) {
  const source = await readRelative(relativePath);

  if (!source.includes(marker)) {
    failures.push(`${relativePath} is missing marker: ${marker}`);
  }
}

const ogImagePathMatch = seoSource.match(/openGraphImage:\s*"([^"]+)"/);

if (!ogImagePathMatch) {
  failures.push("src/app/seo.ts is missing openGraphImage");
} else {
  const publicImagePath = `public${ogImagePathMatch[1]}`;

  if (!(await existsRelative(publicImagePath))) {
    failures.push(`Open Graph image does not exist at ${publicImagePath}`);
  }
}

const llmsText = await readRelative("public/llms.txt");
const llmsFullText = await readRelative("public/llms-full.txt");

for (const marker of staleRouteMarkers) {
  if (llmsText.includes(marker) || llmsFullText.includes(marker)) {
    failures.push(`LLM context files still reference stale route: ${marker}`);
  }
}

const llmsCombined = `${llmsText}\n${llmsFullText}`;

for (const routePath of routePaths) {
  if (!llmsCombined.includes(`https://hungry.sg${routePath === "/" ? "/" : routePath}`)) {
    failures.push(`LLM context files do not reference public route: ${routePath}`);
  }
}

if (failures.length > 0) {
  console.error("SEO/AI readiness check failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("SEO/AI readiness check passed.");
