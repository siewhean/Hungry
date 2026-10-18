import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

function parseJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T;
}

const scalingReports = [
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
] as const;

const loadScripts = [
  "scripts/load/public-web.k6.js",
  "scripts/load/search.k6.js",
  "scripts/load/discovery.k6.js",
  "scripts/load/detail.k6.js",
  "scripts/load/post-publish.k6.js",
  "scripts/load/merchant-portal.k6.js",
  "scripts/load/admin-dashboard.k6.js",
] as const;

test("scaling readiness deliverables exist and keep production-touch blockers explicit", () => {
  for (const report of scalingReports) {
    assert.equal(exists(report), true, `${report} should exist`);
  }

  const baseline = read("tasks/Roadmap/Scaling/scaling-baseline-audit.md");
  assert.match(baseline, /repo-local scaling foundation only/i);
  assert.match(baseline, /No production Supabase migration was applied/i);
  assert.match(baseline, /marketing\/website\/web-v2/);
  assert.match(baseline, /marketing\/web/);
  assert.match(baseline, /Conditional Go \/ repo-local scaling foundation complete/);

  const rollout = read("tasks/Roadmap/Scaling/release-rollout-and-rollback-plan.md");
  assert.match(rollout, /No-Go Conditions/);
  assert.match(rollout, /Production advanced feature flags enabled without approval/);
  assert.match(rollout, /Supabase migration/);

  const postLaunch = read("tasks/Roadmap/Scaling/post-launch-scaling-review.md");
  assert.match(postLaunch, /T\+24 hours/);
  assert.match(postLaunch, /T\+7 days/);
  assert.match(postLaunch, /T\+30 days/);
});

test("production feature flags remain MVP-safe and documented in the release matrix", () => {
  const flags = read("src/constants/featureFlags.ts");
  const matrix = read("tasks/Roadmap/Scaling/feature-flag-release-matrix.md");

  // Advanced surfaces stay out of production (main's nonProductionSurfaceEnabled).
  assert.match(flags, /const prototypeRoutesEnabled = appEnv !== "production"/);
  assert.match(flags, /release01CoreOnly: enabled\(env, "EXPO_PUBLIC_RELEASE_01_CORE_ONLY"\)/);
  for (const flag of [
    "directMessagesEnabled",
    "commentsEnabled",
    "oauthProvidersEnabled",
    "gamificationEnabled",
    "collectionsEnabled",
    "storiesEnabled",
  ]) {
    assert.match(flags, new RegExp(`${flag}: nonProductionSurfaceEnabled`));
    assert.match(matrix, new RegExp(`\\\`${flag}\\\`[\\s\\S]*false`));
  }
  // Core surfaces keep a per-surface env gate (EXPO_PUBLIC_ENABLE_*=0 narrows a build).
  for (const flag of [
    "socialFeedEnabled",
    "postCreationEnabled",
    "reviewCreationEnabled",
    "activityEnabled",
    "readsEnabled",
    "mapEnabled",
    "hungryWheelEnabled",
    "craveEnabled",
  ]) {
    assert.match(flags, new RegExp(`const ${flag} = surface\\(`));
  }
  assert.match(flags, /floorplansEnabled: false/);
  assert.match(matrix, /Production defaults must stay MVP-safe/);
});

test("root navigation and linking do not expose advanced production routes without flags", () => {
  const rootNavigator = read("src/app/navigation/RootNavigator.tsx");
  const linking = read("src/app/navigation/linking.ts");

  for (const gate of [
    "FEATURE_FLAGS.merchantCentreEnabled",
    "FEATURE_FLAGS.directMessagesEnabled",
    "FEATURE_FLAGS.storiesEnabled",
    "FEATURE_FLAGS.gamificationEnabled",
    "FEATURE_FLAGS.collectionsEnabled",
    "FEATURE_FLAGS.prototypeRoutesEnabled",
  ]) {
    assert.match(rootNavigator, new RegExp(gate.replace(".", "\\.")));
  }

  for (const route of [
    "MerchantTabs",
    "DirectMessages",
    "ChatDetail",
    "StoryViewer",
    "AddStory",
    "PassportScreen",
    "MissionsScreen",
    "CollectionList",
    "CollectionDetail",
    "AdminPortfolioFlags",
  ]) {
    assert.match(rootNavigator, new RegExp(`name="${route}"`));
  }

  assert.match(linking, /FEATURE_FLAGS\.merchantCentreEnabled/);
  assert.match(linking, /FEATURE_FLAGS\.portfoliosEnabled/);
  assert.doesNotMatch(linking, /DirectMessages:/);
});

test("Supabase source of truth and bounded service read paths are covered by reports and code", () => {
  const report = read("tasks/Roadmap/Database/database-scaling-readiness-report.md");
  const serviceReport = read("tasks/Roadmap/Scaling/service-layer-scaling-audit.md");
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const sourceOfTruth = read("src/store/mvp-source-of-truth-contracts.test.ts");
  const migrations = readdirSync(path.join(root, "supabase/migrations")).join("\n");
  const smokes = readdirSync(path.join(root, "supabase/smoke")).join("\n");

  assert.match(report, /Supabase is the source of truth/);
  assert.match(serviceReport, /Zustand stores remain device-local cache/);
  assert.match(sourceOfTruth, /Supabase writes as source of truth/);
  assert.match(repository, /rpcRows\("search_dishes"/);
  assert.match(repository, /rpcRows\("get_discovery_feed_by_location"/);
  assert.match(repository, /p_limit/);
  assert.match(repository, /p_cursor_id/);
  assert.match(service, /client\.rpc\("get_home_social_feed_v2"/);
  assert.match(service, /p_limit/);
  assert.match(service, /p_cursor_feed_created_at/);
  assert.match(migrations, /20260606120000_database_excel_integration_foundation\.sql/);
  assert.match(migrations, /0033_social_governance_feed_foundation_fixes\.sql/);
  assert.match(smokes, /database_excel_integration\.sql/);
  assert.match(smokes, /social_governance_feed_foundation\.sql/);
});

test("public website scaling gates target web-v2 and legacy web stays documented", () => {
  const report = read("tasks/Roadmap/Scaling/public-website-scaling-report.md");
  const webPackage = parseJson<{ scripts: Record<string, string> }>(
    "marketing/website/web-v2/package.json",
  );

  assert.match(report, /Active site: `marketing\/website\/web-v2`/);
  assert.match(report, /Legacy site: `marketing\/web`/);
  for (const script of ["seo:validate", "seo:sitemap", "seo:structured-data", "security:audit"]) {
    assert.equal(typeof webPackage.scripts[script], "string", `${script} should exist`);
  }
  assert.equal(exists("marketing/website/web-v2/scripts/validate-sitemap.mjs"), true);
  assert.equal(exists("marketing/website/web-v2/scripts/validate-structured-data.mjs"), true);
  assert.equal(exists("marketing/website/web-v2/scripts/seo-ai-readiness-check.mjs"), true);
  assert.equal(exists("marketing/website/web-v2/src/app/robots.ts"), true);
  assert.equal(exists("marketing/website/web-v2/src/app/sitemap.ts"), true);
});

test("merchant and admin scaling reports require server-side auth, RBAC, and CSRF", () => {
  const merchantReport = read("tasks/Roadmap/Merchant Portal/merchant-portal-scaling-qa-report.md");
  const adminReport = read("tasks/Roadmap/Scaling/admin-dashboard-scaling-qa-report.md");
  const merchantSession = read("marketing/website/web-v2/src/app/api/merchant/_session.ts");
  const consoleAuth = read("marketing/website/web-v2/src/app/api/console/_auth.ts");
  const csrfContracts = read("src/lib/security/merchant-portal-csrf-contracts.test.ts");

  assert.match(merchantReport, /server-side RBAC/);
  assert.match(merchantReport, /CSRF/);
  assert.match(adminReport, /server-side guarded/);
  assert.match(adminReport, /Admin session validation/);
  assert.match(merchantSession, /MERCHANT_CSRF_HEADER/);
  assert.match(merchantSession, /Cross-site merchant requests are not allowed/);
  assert.match(consoleAuth, /CONSOLE_CSRF_HEADER/);
  assert.match(consoleAuth, /Request origin is not allowed/);
  assert.match(csrfContracts, /CSRF/);
});

test("load scripts and package commands are present with fail-closed mutation safety", () => {
  const pkg = parseJson<{ scripts: Record<string, string> }>("package.json");

  assert.equal(pkg.scripts["scaling:validate"], "node scripts/validate-scaling-readiness.mjs");
  assert.equal(exists("scripts/validate-scaling-readiness.mjs"), true);

  for (const scriptPath of loadScripts) {
    assert.equal(exists(scriptPath), true, `${scriptPath} should exist`);
    const source = read(scriptPath);
    assert.match(source, /thresholds/);
    assert.match(source, /http_req_failed/);
    assert.match(source, /http_req_duration/);
  }

  for (const [name, scriptPath] of [
    ["load:public-web", "scripts/load/public-web.k6.js"],
    ["load:search", "scripts/load/search.k6.js"],
    ["load:discovery", "scripts/load/discovery.k6.js"],
    ["load:detail", "scripts/load/detail.k6.js"],
    ["load:post-publish", "scripts/load/post-publish.k6.js"],
    ["load:merchant", "scripts/load/merchant-portal.k6.js"],
    ["load:admin", "scripts/load/admin-dashboard.k6.js"],
  ] as const) {
    assert.equal(pkg.scripts[name], `k6 run ${scriptPath}`);
  }
  assert.match(pkg.scripts["load:read-only"], /load:public-web/);
  assert.match(pkg.scripts["load:read-only"], /load:detail/);

  for (const scriptPath of [
    "scripts/load/post-publish.k6.js",
    "scripts/load/merchant-portal.k6.js",
    "scripts/load/admin-dashboard.k6.js",
  ]) {
    const source = read(scriptPath);
    assert.match(source, /LOAD_ALLOW_MUTATIONS/);
    assert.match(source, /LOAD_STAGING_ONLY/);
    assert.match(source, /fail\(/);
  }
});

test("CI uses static scaling and website quality gates, not real load tests", () => {
  const ci = read(".github/workflows/ci.yml");

  assert.match(ci, /Scaling readiness static contracts/);
  assert.match(ci, /Scaling readiness scaffold validation/);
  assert.match(ci, /Website SEO static validation/);
  assert.match(ci, /src\/app\/scaling-readiness-contracts\.test\.ts/);
  assert.doesNotMatch(ci, /npm run load:/);
  assert.doesNotMatch(ci, /k6 run/);
});

test("observability and background job plans define thresholds, sanitization, queues, and blockers", () => {
  const observability = read("tasks/Roadmap/Scaling/observability-runbook.md");
  const jobs = read("tasks/Roadmap/Scaling/background-jobs-scaling-plan.md");
  const loadResults = read("tasks/Roadmap/Scaling/scaling-load-test-results.md");
  const privacy = read("src/lib/analytics/privacy.ts");
  const securityTests = read("src/lib/security/security-hardening.test.ts");

  for (const token of ["Sentry", "Supabase", "Vercel", "PostHog", "Threshold"]) {
    assert.match(observability, new RegExp(token));
  }
  assert.match(observability, /Do not send tokens, emails, phone numbers/);
  assert.match(privacy, /sanitizeSentryEvent/);
  assert.match(privacy, /sanitizeSentryBreadcrumb/);
  assert.match(securityTests, /Sentry event and breadcrumb sanitizers/);
  assert.match(jobs, /OCR\/menu photo ingestion/);
  assert.match(jobs, /dedupe_key/);
  assert.match(jobs, /No queue migration is added in this pass/);
  assert.match(loadResults, /no production load test run/i);
});
