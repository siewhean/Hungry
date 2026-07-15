import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

test("GitHub Actions are SHA-pinned and least-privilege", () => {
  for (const workflow of [
    ".github/workflows/ci.yml",
    ".github/workflows/security.yml",
    ".github/workflows/scheduled-enrichment-review.yml",
  ]) {
    const source = read(workflow);
    assert.match(source, /permissions:\n\s+contents: read/);

    const uses = [...source.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1]);
    assert.ok(uses.length > 0, `${workflow} should use actions explicitly`);
    for (const action of uses) {
      assert.match(action, /@[a-f0-9]{40}$/i, `${workflow} has mutable action reference ${action}`);
    }
  }
});

test("release secrets are scoped to EAS steps, not install or workflow scope", () => {
  const ci = read(".github/workflows/ci.yml");
  const easJob = ci.slice(ci.indexOf("eas-build-gate:"));
  const installStep = easJob.slice(
    easJob.indexOf("Install dependencies"),
    easJob.indexOf("Validate Expo account access"),
  );

  assert.doesNotMatch(easJob.split("steps:")[0], /EXPO_TOKEN|SENTRY_AUTH_TOKEN/);
  assert.doesNotMatch(installStep, /EXPO_TOKEN|SENTRY_AUTH_TOKEN/);
  assert.match(easJob, /npx --yes eas-cli@18\.12\.3 whoami/);
  assert.match(easJob, /npx --yes eas-cli@18\.12\.3 build/);
});

test("main CI uses the pinned Node runtime and fails closed for required release proof", () => {
  const ci = read(".github/workflows/ci.yml");
  const security = read(".github/workflows/security.yml");
  const enrichment = read(".github/workflows/scheduled-enrichment-review.yml");

  for (const [source, expectedCount] of [
    [ci, 4],
    [security, 1],
    [enrichment, 2],
  ] as const) {
    const nodeVersions = [...source.matchAll(/^\s*node-version:\s*([^\s#]+)\s*$/gm)].map(
      (match) => match[1],
    );
    assert.equal(nodeVersions.length, expectedCount);
    assert.deepEqual(new Set(nodeVersions), new Set(["22.22.1"]));
  }
  assert.match(ci, /Supabase credentials missing on main; failing closed\./);
  assert.match(ci, /EXPO_TOKEN missing on main; failing closed\./);
  assert.doesNotMatch(ci, /skipping EAS account validation/);
  assert.doesNotMatch(ci, /skipping EAS build gate/);
});

test("CI fails closed on web-v2 and store-layout-editor quality gates", () => {
  const ci = read(".github/workflows/ci.yml");
  const webJob = ci.slice(
    ci.indexOf("  web-v2-quality-gates:"),
    ci.indexOf("  store-layout-editor-quality-gates:"),
  );
  const layoutJob = ci.slice(
    ci.indexOf("  store-layout-editor-quality-gates:"),
    ci.indexOf("  eas-build-gate:"),
  );

  assert.match(webJob, /web-v2-quality-gates:/);
  assert.match(webJob, /working-directory: marketing\/website\/web-v2/);
  assert.match(webJob, /cache-dependency-path: marketing\/website\/web-v2\/package-lock\.json/);
  assert.match(webJob, /Install web-v2 dependencies\s*\n\s*run: npm ci/);
  assert.match(webJob, /Website dependency audit\s*\n\s*run: npm audit --audit-level=moderate/);
  assert.match(webJob, /Website lint\s*\n\s*run: npm run lint/);
  assert.match(webJob, /Website typecheck\s*\n\s*run: npm exec -- tsc --noEmit/);
  assert.match(webJob, /Website production build\s*\n\s*run: npm run build/);
  assert.match(webJob, /Website bundle budget\s*\n\s*run: npm run bundle:budget/);
  assert.match(webJob, /Website static security contracts\s*\n\s*run: npm run security:audit/);
  const websiteStaticStep = webJob.slice(webJob.indexOf("- name: Website SEO static validation"));
  for (const script of [
    "routes:inventory",
    "seo:validate",
    "seo:sitemap",
    "seo:structured-data",
    "legal:validate",
    "a11y:contracts",
  ]) {
    assert.match(websiteStaticStep, new RegExp(`npm run ${script.replace(":", "\\:")}`));
  }
  assert.doesNotMatch(webJob, /skip|continue-on-error/i);

  assert.match(layoutJob, /store-layout-editor-quality-gates:/);
  assert.match(layoutJob, /working-directory: store-layout-editor/);
  assert.match(layoutJob, /cache-dependency-path: store-layout-editor\/package-lock\.json/);
  assert.match(layoutJob, /Install store-layout-editor dependencies\s*\n\s*run: npm ci/);
  assert.match(layoutJob, /Store layout editor full check\s*\n\s*run: npm run check/);
  assert.doesNotMatch(layoutJob, /skip|continue-on-error/i);
  assert.match(
    ci,
    /needs: \[quality-gates, web-v2-quality-gates, store-layout-editor-quality-gates\]/,
  );
});

test("security workflow keeps dependency, gitleaks, and trufflehog gates", () => {
  const security = read(".github/workflows/security.yml");
  const packageJson = read("package.json");
  const trufflehogRunner = read("scripts/run-trufflehog.mjs");

  assert.match(security, /npm audit --audit-level=moderate/);
  assert.match(security, /gitleaks\/gitleaks-action@/);
  assert.match(security, /trufflesecurity\/trufflehog@/);
  assert.match(packageJson, /"security:trufflehog": "node scripts\/run-trufflehog\.mjs"/);
  assert.match(trufflehogRunner, /brew install trufflehog/);
  assert.match(trufflehogRunner, /\.github\/workflows\/security\.yml/);
  assert.match(trufflehogRunner, /"--no-update"/);
  assert.match(trufflehogRunner, /"--fail"/);
  assert.match(trufflehogRunner, /--exclude-paths=scripts\/trufflehog-exclude-paths\.txt/);
  assert.match(trufflehogRunner, /filesystem",[\s\S]*"--only-verified",[\s\S]*"\."/);

  const trufflehogExcludes = read("scripts/trufflehog-exclude-paths.txt");
  assert.match(trufflehogExcludes, /\^\\\.env\$/);
  assert.match(trufflehogExcludes, /\^\\\.env\\\.local\$/);
  assert.match(trufflehogExcludes, /\^\\\.env\\\.\.\*\\\.local\$/);
});

test("release checklist includes the Supabase Advisor regression guard", () => {
  const releaseChecklist = read("scripts/release_ready_checklist.sh");
  const ci = read(".github/workflows/ci.yml");
  const packageJson = read("package.json");
  const advisorClassifier = read("scripts/supabase-advisor-security-classifier.mjs");
  const releaseGates = read("references/release-gates.md");
  const auditStatus = read(
    "tasks/Roadmap/Archive/claude-full-project-audit-implementation-status.md",
  );
  const releaseEvidenceExample = read("tasks/release-evidence/full-audit-v1.example.env");

  assert.match(packageJson, /"audit:supabase:advisor-security"/);
  assert.match(releaseChecklist, /npm run audit:supabase:advisor-security/);
  assert.match(releaseChecklist, /HUNGRY_RELEASE_EVIDENCE_FILE/);
  assert.match(releaseChecklist, /tasks\/release-evidence\/full-audit-v1\.env/);
  assert.match(releaseChecklist, /pushed GitHub CI evidence/);
  assert.match(releaseChecklist, /dirty-worktree reconciliation/);
  assert.match(releaseChecklist, /SEC-06/);
  assert.match(releaseChecklist, /SEC-08/);
  assert.match(releaseChecklist, /MER-PORTAL-01/);
  assert.match(releaseChecklist, /MERCH-P0-ANALYTICS-01/);
  assert.match(releaseChecklist, /MERCH_P0_ANALYTICS_PROOF/);
  assert.match(releaseChecklist, /npm run website:predeploy:local/);
  assert.doesNotMatch(releaseChecklist, /security:release-hygiene/);
  assert.doesNotMatch(releaseChecklist, /security:legacy-web/);
  assert.match(releaseGates, /tasks\/Roadmap\/claude-full-project-audit\.md/);
  assert.match(releaseGates, /tasks\/release-evidence\/full-audit-v1\.env/);
  assert.match(auditStatus, /verified-only filesystem scan/);
  assert.match(auditStatus, /pushed GitHub CI evidence/);
  assert.match(auditStatus, /dirty-worktree reconciliation/);
  assert.match(auditStatus, /SEC-06/);
  assert.match(auditStatus, /SEC-08/);
  assert.match(auditStatus, /MER-PORTAL-01/);
  assert.match(auditStatus, /MERCH-P0-ANALYTICS-01/);
  assert.match(releaseEvidenceExample, /ANDROID_EAS_PROOF=0/);
  assert.match(releaseEvidenceExample, /DIRTY_WORKTREE_RECONCILED=0/);
  assert.match(releaseEvidenceExample, /MERCH_P0_ANALYTICS_PROOF=0/);
  assert.match(ci, /Supabase Security Advisor guard/);
  assert.match(ci, /npm run audit:supabase:advisor-security/);
  assert.match(ci, /SUPABASE_NPX_ALLOW_INSTALL: "1"/);
  assert.match(advisorClassifier, /unexpected app-owned Advisor findings/);
  assert.match(advisorClassifier, /HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL/);
  assert.match(advisorClassifier, /SUPABASE_NPX_ALLOW_INSTALL/);
});

test("service-role smoke scripts require explicit opt-in and smoke env names", () => {
  for (const helper of ["scripts/supabase-chat-smoke.mjs", "scripts/supabase-ocr-smoke.mjs"]) {
    const source = read(helper);
    assert.match(source, /HUNGRY_ALLOW_SERVICE_ROLE_SMOKE/);
    assert.match(source, /HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /readFileSync\(["']\.env\.local/);
  }
});
