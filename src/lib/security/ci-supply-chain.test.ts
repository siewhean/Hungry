import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

test("GitHub Actions are SHA-pinned and least-privilege", () => {
  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/security.yml"]) {
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
  assert.match(easJob, /npx --yes eas-cli@21\.1\.0 whoami/);
  assert.match(easJob, /npx --yes eas-cli@21\.1\.0 build/);
  assert.match(easJob, /--profile internal-alpha/);
});

test("final-candidate CI uses the pinned Node runtime and fails closed for required release proof", () => {
  const ci = read(".github/workflows/ci.yml");
  const qualityGates = ci.slice(ci.indexOf("quality-gates:"), ci.indexOf("eas-build-gate:"));
  const easJob = ci.slice(ci.indexOf("eas-build-gate:"));

  assert.equal(ci.match(/node-version: 22\.22\.1/g)?.length, 3);
  assert.match(easJob, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(easJob, /always\(\) && \(/);
  assert.match(easJob, /needs: \[quality-gates, merge-compatibility\]/);
  assert.match(ci, /Supabase credentials missing for a final-candidate PR or main push/);
  assert.match(
    easJob,
    /Missing required release credentials for a final-candidate PR or main push/,
  );
  assert.match(easJob, /for name in EXPO_TOKEN SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD/);
  assert.match(easJob, /Quality gates completed with/);
  assert.match(easJob, /Merge compatibility completed with/);
  assert.match(easJob, /EXPO_TOKEN missing for a final-candidate PR or main push/);
  assert.match(easJob, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
  assert.match(qualityGates, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
  assert.ok(
    easJob.indexOf("Require successful quality gates") <
      easJob.indexOf("Validate final-candidate release credentials"),
    "upstream failures should surface before release-credential validation",
  );
  assert.ok(
    easJob.indexOf("Require merge compatibility for pull requests") <
      easJob.indexOf("Validate final-candidate release credentials"),
    "PR merge compatibility should block artifact dispatch before credential validation",
  );
  assert.doesNotMatch(ci, /skipping EAS account validation/);
  assert.doesNotMatch(ci, /skipping EAS build gate/);
});

test("PR merge compatibility remains checked without changing final-head artifact provenance", () => {
  const ci = read(".github/workflows/ci.yml");
  const mergeCompatibility = ci.slice(
    ci.indexOf("merge-compatibility:"),
    ci.indexOf("eas-build-gate:"),
  );

  assert.match(mergeCompatibility, /if: github\.event_name == 'pull_request'/);
  assert.match(mergeCompatibility, /Checkout GitHub PR merge commit/);
  assert.doesNotMatch(mergeCompatibility, /pull_request\.head\.sha/);
  assert.match(mergeCompatibility, /npm ci/);
  assert.match(mergeCompatibility, /npm run typecheck/);
  assert.doesNotMatch(mergeCompatibility, /EXPO_TOKEN|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD/);
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
