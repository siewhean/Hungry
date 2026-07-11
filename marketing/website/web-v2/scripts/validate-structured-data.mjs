import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaSource = await readFile(path.join(root, "src/lib/seo/schema.ts"), "utf8");
const contentSource = await readFile(path.join(root, "src/lib/seo/content.ts"), "utf8");
const pageSources = await Promise.all(
  [
    "src/app/singapore/page.tsx",
    "src/app/singapore/[area]/food/page.tsx",
    "src/app/dishes/[dishSlug]/page.tsx",
    "src/app/guides/[guideSlug]/page.tsx",
    "src/components/seo/PlaceContent.tsx",
  ].map(async (relativePath) => readFile(path.join(root, relativePath), "utf8")),
);
const combinedPages = pageSources.join("\n");
const failures = [];

for (const marker of [
  "buildOrganizationSchema",
  "buildWebsiteSchema",
  "buildSoftwareApplicationSchema",
  "buildLocalBusinessSchema",
  "buildFoodEstablishmentSchema",
  "buildRestaurantSchema",
  "buildBreadcrumbSchema",
  "buildItemListSchema",
  "buildArticleSchema",
  "buildFAQSchema",
  "buildProfilePageSchema",
]) {
  if (!schemaSource.includes(marker)) {
    failures.push(`schema.ts is missing ${marker}`);
  }
}

if (/aggregateRating\s*:/.test(schemaSource) || /reviewCount\s*:/.test(schemaSource)) {
  failures.push("schema.ts emits rating/review fields without visible data guards");
}

if (/openingHours\s*:/.test(schemaSource)) {
  failures.push(
    "schema.ts emits openingHours even though public SEO pages do not show verified hours",
  );
}

if (!contentSource.includes("Ratings are only shown where real review data is available")) {
  failures.push("content.ts does not document the no-fake-rating policy in visible FAQ content");
}

if (!combinedPages.includes("buildFAQSchema") || !combinedPages.includes("buildBreadcrumbSchema")) {
  failures.push("SEO pages do not emit FAQ and breadcrumb structured data");
}

if (failures.length > 0) {
  console.error("SEO structured-data validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SEO structured-data validation passed.");
