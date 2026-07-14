import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return existsSync(path.join(root, relativePath));
}

function parseJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const loadScripts = {
  "load:public-web": "scripts/load/public-web.k6.js",
  "load:search": "scripts/load/search.k6.js",
  "load:discovery": "scripts/load/discovery.k6.js",
  "load:detail": "scripts/load/detail.k6.js",
  "load:post-publish": "scripts/load/post-publish.k6.js",
  "load:merchant": "scripts/load/merchant-portal.k6.js",
  "load:admin": "scripts/load/admin-dashboard.k6.js",
};

const requiredReports = [
  "tasks/Roadmap/Scaling/scaling-baseline-audit.md",
  "tasks/Roadmap/Scaling/feature-flag-release-matrix.md",
  "tasks/Roadmap/Database/database-scaling-readiness-report.md",
  "tasks/Roadmap/Database/database-query-performance-report.md",
  "tasks/Roadmap/Scaling/service-layer-scaling-audit.md",
  "tasks/Roadmap/Scaling/public-website-scaling-report.md",
  "tasks/Roadmap/Scaling/mobile-scaling-qa-report.md",
  "tasks/Roadmap/Merchant Portal/merchant-portal-scaling-qa-report.md",
  "tasks/Roadmap/Scaling/admin-dashboard-scaling-qa-report.md",
  "tasks/Roadmap/Scaling/background-jobs-scaling-plan.md",
  "tasks/Roadmap/Scaling/observability-runbook.md",
  "tasks/Roadmap/Scaling/incident-response-plan.md",
  "tasks/Roadmap/Scaling/scaling-load-test-results.md",
  "tasks/Roadmap/Scaling/release-rollout-and-rollback-plan.md",
  "tasks/Roadmap/Scaling/production-release-checklist.md",
  "tasks/Roadmap/Scaling/post-launch-scaling-review.md",
];

function validateReports() {
  for (const report of requiredReports) {
    assert.equal(exists(report), true, `${report} is missing`);
  }

  const baseline = read("tasks/Roadmap/Scaling/scaling-baseline-audit.md");
  assert.match(baseline, /repo-local scaling foundation only/i);
  assert.match(baseline, /No production Supabase migration was applied/i);
  assert.match(baseline, /marketing\/website\/web-v2/);
  assert.match(baseline, /marketing\/web/);

  const plan = read("tasks/Roadmap/Scaling/scaling-implementation-test-qaqc-plan.md");
  assert.doesNotMatch(plan, /\.k6\.ts/);
  assert.doesNotMatch(plan, /cd marketing\/web &&/);
  assert.match(plan, /cd marketing\/website\/web-v2 && npm run build/);
}

function validateLoadScripts() {
  const pkg = parseJson("package.json");

  for (const [command, scriptPath] of Object.entries(loadScripts)) {
    assert.equal(
      pkg.scripts[command],
      `k6 run ${scriptPath}`,
      `${command} points at the wrong script`,
    );
    assert.equal(exists(scriptPath), true, `${scriptPath} is missing`);

    const source = read(scriptPath);
    assert.match(source, /thresholds/, `${scriptPath} must declare thresholds`);
    assert.match(source, /http_req_failed/, `${scriptPath} must declare an error-rate threshold`);
    assert.match(source, /http_req_duration/, `${scriptPath} must declare a latency threshold`);
    assert.doesNotMatch(
      source,
      /hungry\.sg|api\.hungry/i,
      `${scriptPath} must not default to production`,
    );
  }

  assert.match(pkg.scripts["load:read-only"], /load:public-web/);
  assert.match(pkg.scripts["load:read-only"], /load:search/);
  assert.match(pkg.scripts["load:read-only"], /load:discovery/);
  assert.match(pkg.scripts["load:read-only"], /load:detail/);

  for (const scriptPath of [
    "scripts/load/search.k6.js",
    "scripts/load/discovery.k6.js",
    "scripts/load/detail.k6.js",
  ]) {
    const source = read(scriptPath);
    assert.match(source, /SUPABASE_URL/);
    assert.match(source, /SUPABASE_ANON_KEY/);
    assert.match(source, /fail\(/, `${scriptPath} must fail closed without staging Supabase env`);
  }

  for (const scriptPath of [
    "scripts/load/post-publish.k6.js",
    "scripts/load/merchant-portal.k6.js",
    "scripts/load/admin-dashboard.k6.js",
  ]) {
    const source = read(scriptPath);
    assert.match(source, /LOAD_ALLOW_MUTATIONS/);
    assert.match(source, /LOAD_STAGING_ONLY/);
    assert.match(source, /LOAD_AUTH_TOKEN/);
    assert.match(
      source,
      /fail\(/,
      `${scriptPath} must fail closed without explicit staging/auth env`,
    );
  }
}

function validateCi() {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /Scaling readiness static contracts/);
  assert.match(ci, /Scaling readiness scaffold validation/);
  assert.match(ci, /Website SEO static validation/);
  assert.doesNotMatch(ci, /k6 run/);
  assert.doesNotMatch(ci, /npm run load:/);
}

validateReports();
validateLoadScripts();
validateCi();

console.log("[scaling-readiness] static scaffold validation passed");
