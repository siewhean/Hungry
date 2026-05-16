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

  assert.match(security, /npm audit --audit-level=moderate/);
  assert.match(security, /gitleaks\/gitleaks-action@/);
  assert.match(security, /trufflesecurity\/trufflehog@/);
});

test("service-role helpers require explicit smoke opt-in and smoke env names", () => {
  for (const helper of ["test_service_role.ts", "test_trigger.ts", "test_jwt.js"]) {
    const source = read(helper);
    assert.match(source, /HUNGRY_ALLOW_SERVICE_ROLE_SMOKE/);
    assert.match(source, /HUNGRY_SMOKE_SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /readFileSync\(["']\.env\.local/);
  }
});
