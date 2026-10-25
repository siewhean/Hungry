import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "src/app/seo.ts",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/components/seo/JsonLd.tsx",
  "src/lib/seo/content.ts",
  "src/lib/seo/pageMetadata.ts",
  "src/lib/seo/schema.ts",
  "src/lib/seo/slugs.ts",
  "src/app/singapore/page.tsx",
  "src/app/singapore/[area]/food/page.tsx",
  "src/app/singapore/mrt/[station]/food/page.tsx",
  "src/app/singapore/[area]/[dish]/page.tsx",
  "src/app/dishes/[dishSlug]/page.tsx",
  "src/app/guides/[guideSlug]/page.tsx",
  "src/app/hawker-centres/[centreSlug]/page.tsx",
  "src/app/malls/[mallSlug]/food/page.tsx",
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
  ["src/lib/seo/schema.ts", "Organization"],
  ["src/lib/seo/schema.ts", "WebSite"],
  ["src/lib/seo/schema.ts", "MobileApplication"],
  ["src/lib/seo/content.ts", "Jurong East"],
  ["src/lib/seo/content.ts", "Chinatown"],
  ["src/lib/seo/content.ts", "food-under-6-dollars"],
  ["src/lib/seo/schema.ts", "buildBreadcrumbSchema"],
  ["src/lib/seo/schema.ts", "buildFAQSchema"],
  ["src/lib/seo/schema.ts", "buildRestaurantSchema"],
  ["src/lib/seo/pageMetadata.ts", "robots"],
  ["public/llms.txt", "https://hungry.sg/for-foodies"],
  ["public/llms.txt", "https://hungry.sg/for-merchants"],
  ["public/llms.txt", "https://hungry.sg/singapore"],
  ["public/llms-full.txt", "dish-first discovery"],
  ["public/llms-full.txt", "https://hungry.sg/singapore/jurong-east/food"],
];

const staleRouteMarkers = ["/about", "/merchant-login", "/merchant-dashboard"];

const failures = [];

const routeTemplates = [
  [/^\/$/, "src/app/page.tsx"],
  [/^\/for-foodies$/, "src/app/for-foodies/page.tsx"],
  [/^\/for-merchants$/, "src/app/for-merchants/page.tsx"],
  [/^\/about$/, "src/app/about/page.tsx"],
  [/^\/join-waitlist$/, "src/app/join-waitlist/page.tsx"],
  [/^\/privacy$/, "src/app/privacy/page.tsx"],
  [/^\/terms$/, "src/app/terms/page.tsx"],
  [/^\/refund$/, "src/app/refund/page.tsx"],
  [/^\/cookies$/, "src/app/cookies/page.tsx"],
  [/^\/business$/, "src/app/business/page.tsx"],
  [/^\/credits$/, "src/app/credits/page.tsx"],

  [/^\/account\/delete$/, "src/app/account/delete/page.tsx"],
  [/^\/contact$/, "src/app/contact/page.tsx"],
  [/^\/singapore$/, "src/app/singapore/page.tsx"],
  [/^\/singapore\/[^/]+\/food$/, "src/app/singapore/[area]/food/page.tsx"],
  [/^\/singapore\/mrt\/[^/]+\/food$/, "src/app/singapore/mrt/[station]/food/page.tsx"],
  [/^\/singapore\/[^/]+\/[^/]+$/, "src/app/singapore/[area]/[dish]/page.tsx"],
  [/^\/dishes\/[^/]+$/, "src/app/dishes/[dishSlug]/page.tsx"],
  [/^\/guides\/[^/]+$/, "src/app/guides/[guideSlug]/page.tsx"],
  [/^\/hawker-centres\/[^/]+$/, "src/app/hawker-centres/[centreSlug]/page.tsx"],
  [/^\/malls\/[^/]+\/food$/, "src/app/malls/[mallSlug]/food/page.tsx"],
];

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

const metadataSource = await readRelative("src/lib/seo/pageMetadata.ts");
const seoContentSource = await readRelative("src/lib/seo/content.ts");

if (!/title:\s*{\s*absolute:\s*route\.title/s.test(metadataSource)) {
  failures.push(
    "src/lib/seo/pageMetadata.ts should use title.absolute to avoid title template duplication",
  );
}

for (const routePath of routePaths) {
  const template = routeTemplates.find(([pattern]) => pattern.test(routePath));

  if (!template) {
    failures.push(`public route ${routePath} has no matching route template`);
    continue;
  }

  const pagePath = template[1];

  if (!(await existsRelative(pagePath))) {
    failures.push(`public route ${routePath} has no page file at ${pagePath}`);
  }
}

for (const marker of [
  "...seoAreas.map",
  "...seoDishes.map",
  "...dishAreaPages.map",
  "...seoPlaces.map",
  "...seoGuides.map",
]) {
  if (!seoSource.includes(marker)) {
    failures.push(`src/app/seo.ts is missing generated route marker: ${marker}`);
  }
}

if (!seoContentSource.includes("seoDishes.flatMap((dish)")) {
  failures.push(
    "src/lib/seo/content.ts should generate dish-area pages from every dish areaSlug so public dish pages cannot link missing area/dish metadata",
  );
}

if (/dishAreaPages[\s\S]*?dishSlugs\.slice\(/.test(seoContentSource)) {
  failures.push(
    "src/lib/seo/content.ts should not slice area dishSlugs when generating dish-area public routes",
  );
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

const requiredLlmRoutes = [
  "/",
  "/for-foodies",
  "/for-merchants",
  "/join-waitlist",
  "/singapore",
  "/singapore/jurong-east/food",
  "/singapore/chinatown/food",
  "/dishes/chicken-rice",
  "/guides/what-to-eat-in-singapore-first-time",
  "/singapore/halal-food",
  "/singapore/late-night-supper",
];

for (const routePath of requiredLlmRoutes) {
  if (!llmsCombined.includes(`https://hungry.sg${routePath === "/" ? "/" : routePath}`)) {
    failures.push(`LLM context files do not reference key public route: ${routePath}`);
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
