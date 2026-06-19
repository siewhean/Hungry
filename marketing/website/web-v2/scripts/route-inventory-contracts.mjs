import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const appDir = join(root, "src", "app");
const auditPath = join(root, "..", "..", "..", "tasks", "Roadmap", "website-production-readiness-audit.md");
const audit = readFileSync(auditPath, "utf8");
const failures = [];

function walk(dir) {
  const entries = readdirSync(dir).sort();
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...walk(path));
    } else if (entry === "page.tsx" || entry === "route.ts") {
      files.push(path);
    }
  }

  return files;
}

function routeFromFile(file) {
  const relativeFile = relative(appDir, file).split(sep).join("/");
  const withoutLeaf = relativeFile.replace(/\/(?:page|route)\.tsx?$/, "").replace(/^(?:page|route)\.tsx?$/, "");

  if (!withoutLeaf) return "/";
  return `/${withoutLeaf}`;
}

const routes = walk(appDir).map(routeFromFile).sort();

for (const route of routes) {
  const rowMarker = `| \`${route}\` |`;
  if (!audit.includes(rowMarker)) {
    failures.push(`Route inventory is missing ${route}`);
  }
}

if (failures.length > 0) {
  console.error("Website route inventory contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Website route inventory contracts passed for ${routes.length} route(s).`);
