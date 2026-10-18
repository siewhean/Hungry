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
  assert.match(easJob, /npx --yes eas-cli@18\.12\.3 whoami/);
  assert.match(easJob, /npx --yes eas-cli@18\.12\.3 build/);
});

test("main CI uses the pinned Node runtime and fails closed for required release proof", () => {
  const ci = read(".github/workflows/ci.yml");

  assert.equal(ci.match(/node-version: 22\.22\.1/g)?.length, 3);
  assert.match(ci, /Supabase credentials missing on main; failing closed\./);
});

test("EAS build gate skips with a visible notice when EXPO_TOKEN is absent, and runs otherwise", () => {
  const ci = read(".github/workflows/ci.yml");
  const easJob = ci.slice(ci.indexOf("eas-build-gate:"));

  // A missing secret must not turn main red; quality-gates decides main's colour.
  assert.match(easJob, /::notice title=EAS build gate skipped::/);
  assert.match(easJob, /echo "available=false" >> "\$GITHUB_OUTPUT"/);
  // The gate itself is kept: every real step runs when the secret is present.
  for (const step of [
    "Checkout",
    "Install dependencies",
    "Validate Expo account access",
    "Trigger EAS build gates",
  ]) {
    const stepBody = easJob.slice(easJob.indexOf(`- name: ${step}`));
    assert.match(
      stepBody.split("- name:")[1],
      /if: steps\.eas-credentials\.outputs\.available == 'true'/,
      `${step} must run when EXPO_TOKEN is available`,
    );
  }
  assert.doesNotMatch(easJob, /continue-on-error/);
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
