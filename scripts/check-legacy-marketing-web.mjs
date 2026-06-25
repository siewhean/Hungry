#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const routePath = path.join(process.cwd(), "marketing", "web", "app", "api", "waitlist", "route.ts");

if (!fs.existsSync(routePath)) {
  console.log("Legacy marketing/web waitlist route is absent.");
  process.exit(0);
}

const source = fs.readFileSync(routePath, "utf8");
const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "HUNGRY_SUPABASE_SERVICE_ROLE_KEY",
  "Authorization:",
  "Bearer ",
];

const findings = forbidden.filter((pattern) => source.includes(pattern));
if (findings.length > 0) {
  console.error("Legacy marketing/web waitlist route must stay retired and service-role free.");
  for (const finding of findings) {
    console.error(`- Found forbidden pattern: ${finding}`);
  }
  process.exit(1);
}

if (!source.includes("retired_surface") || !source.includes("{ status: 410 }")) {
  console.error("Legacy marketing/web waitlist route must return a retired 410 response.");
  process.exit(1);
}

console.log("Legacy marketing/web security contract passed.");
