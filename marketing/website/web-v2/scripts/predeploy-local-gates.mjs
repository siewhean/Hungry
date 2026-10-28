import { spawnSync } from "node:child_process";

const defaultGates = [
  ["routes:inventory", "Route inventory coverage for public, private, and API website routes."],
  ["security:audit", "Security route, header, CSRF, private route, and server-only secret contracts."],
  ["seo:validate", "SEO metadata, public route, and content-truth contracts."],
  ["seo:sitemap", "Sitemap and robots private-route exclusion contracts."],
  ["seo:structured-data", "JSON-LD validity and no-fake-rating/hour contracts."],
  ["legal:validate", "Legal, support, provider, and account-deletion readiness contracts."],
  ["env:validate", "Deployment environment fail-closed checks; local mode may skip proof-only checks."],
  ["a11y:contracts", "Skip-link, landmark, modal, and auth-form accessibility contracts."],
];

const optionalGates = [
  {
    script: "waitlist:e2e",
    description: "Waitlist signup stored end to end through /api/waitlist against a stand-in database.",
    enabled: () => process.env.HUNGRY_PREDEPLOY_WAITLIST_E2E === "1",
    skipReason: "set HUNGRY_PREDEPLOY_WAITLIST_E2E=1; starts a local dev server",
  },
  {
    script: "private-routes:qc",
    description: "Runtime private merchant/console page and API access checks.",
    enabled: () => Boolean(process.env.WEBSITE_BASE_URL) || process.env.HUNGRY_PREDEPLOY_WITH_SERVER === "1",
    skipReason: "set WEBSITE_BASE_URL or HUNGRY_PREDEPLOY_WITH_SERVER=1 after starting a local server",
  },
  {
    script: "seo:links",
    description: "Rendered public-page internal link checks.",
    enabled: () => Boolean(process.env.WEBSITE_BASE_URL) && process.env.HUNGRY_PREDEPLOY_BROWSER === "1",
    skipReason: "set WEBSITE_BASE_URL and HUNGRY_PREDEPLOY_BROWSER=1",
  },
  {
    script: "a11y:keyboard",
    description: "Rendered keyboard smoke checks.",
    enabled: () => Boolean(process.env.WEBSITE_BASE_URL) && process.env.HUNGRY_PREDEPLOY_BROWSER === "1",
    skipReason: "set WEBSITE_BASE_URL and HUNGRY_PREDEPLOY_BROWSER=1",
  },
  {
    script: "perf:lighthouse",
    description: "Lighthouse production-readiness smoke.",
    enabled: () => Boolean(process.env.WEBSITE_BASE_URL) && process.env.HUNGRY_PREDEPLOY_LIGHTHOUSE === "1",
    skipReason: "set WEBSITE_BASE_URL and HUNGRY_PREDEPLOY_LIGHTHOUSE=1",
  },
  {
    script: "build",
    description: "Next.js production build.",
    enabled: () => process.env.HUNGRY_PREDEPLOY_BUILD === "1",
    skipReason: "set HUNGRY_PREDEPLOY_BUILD=1; skipped by default to avoid heavy cache writes on local disks",
  },
];

function runNpmScript(script, description) {
  console.log(`\n==> npm run ${script}`);
  console.log(description);
  const result = spawnSync("npm", ["run", script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Failed to start npm run ${script}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`npm run ${script} failed with exit code ${result.status ?? "unknown"}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("Running web-v2 local predeploy gates.");
console.log("Static gates run by default. Runtime/browser/build gates are opt-in.");

for (const [script, description] of defaultGates) {
  runNpmScript(script, description);
}

for (const gate of optionalGates) {
  if (gate.enabled()) {
    runNpmScript(gate.script, gate.description);
  } else {
    console.log(`\n==> skipped npm run ${gate.script}`);
    console.log(`${gate.description} Skipped: ${gate.skipReason}.`);
  }
}

console.log("\nweb-v2 local predeploy gates passed.");
