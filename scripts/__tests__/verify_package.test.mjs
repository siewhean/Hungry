import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(repoRoot, "scripts/verify-package.sh");

test("verify-package runs all mandatory repo safety gates in order and accepts focused tests", () => {
  const withTests = execFileSync(
    "bash",
    [script, "--dry-run", "src/lib/analytics/trafficTag.test.ts"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const steps = [...withTests.matchAll(/^==> \[verify-package\] (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(steps, [
    "focused tests (1)",
    "typecheck",
    "rate-limits",
    "n-plus-one",
    "race-patterns",
    "staging-functions-manifest",
    "migration-safety",
    "whitespace-diff-check",
    "PASS",
  ]);
  assert.match(withTests, /TSX_TSCONFIG_PATH=tsconfig\.test\.json/);

  const withoutTests = execFileSync("bash", [script, "--dry-run"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.doesNotMatch(withoutTests, /focused tests/);
  assert.match(withoutTests, /==> \[verify-package\] PASS/);
});
