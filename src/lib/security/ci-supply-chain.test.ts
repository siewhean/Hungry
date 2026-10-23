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
    ".github/workflows/release-candidate.yml",
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

test("ordinary CI is secretless and never dispatches live release work", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.doesNotMatch(ci, /secrets\./);
  assert.doesNotMatch(
    ci,
    /EXPO_TOKEN|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|SUPABASE_DB_URL|SENTRY_AUTH_TOKEN/,
  );
  assert.doesNotMatch(ci, /eas-cli|supabase db push|advisor-security/);
  assert.match(ci, /Mock\/local Playwright suite/);
  assert.match(ci, /npm run test:e2e/);
  assert.match(ci, /npm run audit:supabase:static/);
});

test("protected release-candidate workflow validates immutable same-repository candidates", () => {
  const releaseCandidate = read(".github/workflows/release-candidate.yml");

  assert.match(releaseCandidate, /workflow_dispatch:/);
  assert.match(releaseCandidate, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(releaseCandidate, /candidate_sha:/);
  assert.match(releaseCandidate, /pull_request_number:/);
  assert.match(releaseCandidate, /environment: release-candidate/);
  assert.match(releaseCandidate, /candidate_sha must be a full lowercase 40-character SHA/);
  assert.match(releaseCandidate, /git merge-base --is-ancestor origin\/main/);
  assert.match(releaseCandidate, /current head of an open same-repository PR targeting main/);
  assert.match(
    releaseCandidate,
    /pull\.head\?\.repo\?\.full_name === process\.env\.GITHUB_REPOSITORY/,
  );
  assert.match(releaseCandidate, /test "\$\(git rev-parse HEAD\)" = "\$\{CANDIDATE_SHA\}"/);
  assert.doesNotMatch(releaseCandidate, /pull_request_target/);
});

test("release secrets and live checks are isolated behind the approved environment", () => {
  const ci = read(".github/workflows/ci.yml");
  const releaseCandidate = read(".github/workflows/release-candidate.yml");

  assert.match(releaseCandidate, /EXPO_TOKEN: \$\{\{ secrets\.EXPO_TOKEN \}\}/);
  assert.match(releaseCandidate, /SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/);
  // Self-hosted Supabase: no Management API token, linked project, or separate DB password.
  assert.doesNotMatch(releaseCandidate, /SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|_PROJECT_REF/);
  assert.doesNotMatch(releaseCandidate, /--linked/);
  assert.match(releaseCandidate, /HUNGRY_SUPABASE_ADVISOR_REQUIRED: "1"/);
  assert.match(releaseCandidate, /HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL: "1"/);
  assert.match(releaseCandidate, /HUNGRY_SUPABASE_SMOKE_REQUIRED: "1"/);
  assert.match(releaseCandidate, /Credentialed staging fallback and no-results Playwright/);
  assert.match(releaseCandidate, /npx supabase db push --dry-run --db-url "\$SUPABASE_DB_URL"/);
  assert.match(releaseCandidate, /npx --yes eas-cli@21\.1\.0 build/);
  assert.match(releaseCandidate, /--profile internal-alpha --non-interactive --no-wait --json/);
  assert.doesNotMatch(releaseCandidate, /eas-cli@21\.1\.0 build[^\n]*--environment/);
  assert.match(releaseCandidate, /release-candidate-eas-builds/);
  assert.doesNotMatch(ci, /EXPO_TOKEN|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|SUPABASE_DB_URL/);
});

test("normal CI and security workflows remain SHA-pinned with no pull_request_target", () => {
  const ci = read(".github/workflows/ci.yml");
  const security = read(".github/workflows/security.yml");
  const releaseCandidate = read(".github/workflows/release-candidate.yml");
  const mergeCompatibility = ci.slice(ci.indexOf("merge-compatibility:"));

  assert.match(mergeCompatibility, /if: github\.event_name == 'pull_request'/);
  assert.match(mergeCompatibility, /Checkout GitHub PR merge commit/);
  assert.doesNotMatch(mergeCompatibility, /pull_request\.head\.sha/);
  assert.match(mergeCompatibility, /npm ci/);
  assert.match(mergeCompatibility, /npm run typecheck/);
  assert.doesNotMatch(
    mergeCompatibility,
    /EXPO_TOKEN|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|SUPABASE_DB_URL/,
  );
  for (const source of [ci, security, releaseCandidate]) {
    assert.doesNotMatch(source, /pull_request_target/);
  }
  assert.equal(ci.match(/node-version: 22\.22\.1/g)?.length, 2);
});

test("security workflow keeps dependency, gitleaks, and trufflehog gates", () => {
  const security = read(".github/workflows/security.yml");
  const packageJson = read("package.json");
  const trufflehogRunner = read("scripts/run-trufflehog.mjs");

  assert.match(security, /node scripts\/npm-audit-gate\.mjs/);
  const auditGate = read("scripts/npm-audit-gate.mjs");
  assert.match(auditGate, /\["audit", "--json"\]/);
  assert.match(auditGate, /new Set\(\["moderate", "high", "critical"\]\)/);
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
  assert.match(trufflehogExcludes, /\^\\\.claude\/worktrees\//);
  assert.match(trufflehogExcludes, /\^data\/\.\*\\\.xlsx\$/);
  assert.match(trufflehogExcludes, /\^scripts\/venv\//);
  assert.match(trufflehogExcludes, /\^\\\.env\$/);
  assert.match(trufflehogExcludes, /\^\\\.env\\\.local\$/);
  assert.match(trufflehogExcludes, /\^\\\.env\\\.\.\*\\\.local\$/);
});

test("release checklist includes the Supabase Advisor regression guard", () => {
  const releaseChecklist = read("scripts/release_ready_checklist.sh");
  const ci = read(".github/workflows/ci.yml");
  const releaseCandidate = read(".github/workflows/release-candidate.yml");
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
  assert.doesNotMatch(ci, /Supabase Security Advisor guard/);
  assert.match(releaseCandidate, /Supabase Security Advisor/);
  assert.match(releaseCandidate, /npm run audit:supabase:advisor-security/);
  assert.match(releaseCandidate, /SUPABASE_NPX_ALLOW_INSTALL: "1"/);
  assert.match(advisorClassifier, /unexpected app-owned Advisor findings/);
  assert.match(advisorClassifier, /HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL/);
  assert.match(advisorClassifier, /SUPABASE_NPX_ALLOW_INSTALL/);
  assert.match(releaseCandidate, /Supabase Security Advisor\n\s+env:\n\s+SUPABASE_DB_URL:/);
});

test("service-role smoke scripts require explicit opt-in and smoke env names", () => {
  for (const helper of ["scripts/supabase-chat-smoke.mjs", "scripts/supabase-ocr-smoke.mjs"]) {
    const source = read(helper);
    assert.match(source, /HUNGRY_ALLOW_SERVICE_ROLE_SMOKE/);
    assert.match(source, /HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /readFileSync\(["']\.env\.local/);
  }
});
