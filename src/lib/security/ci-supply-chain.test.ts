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
  assert.match(trufflehogRunner, /--exclude-paths=scripts\/trufflehog-exclude-paths\.txt/);
  assert.match(trufflehogRunner, /filesystem",[\s\S]*"--only-verified",[\s\S]*"\."/);
});

test("release checklist includes the Supabase Advisor regression guard", () => {
  const releaseChecklist = read("scripts/release_ready_checklist.sh");
  const ci = read(".github/workflows/ci.yml");
  const packageJson = read("package.json");
  const advisorClassifier = read("scripts/supabase-advisor-security-classifier.mjs");

  assert.match(packageJson, /"audit:supabase:advisor-security"/);
  assert.match(releaseChecklist, /npm run audit:supabase:advisor-security/);
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
