import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("asset audit script covers mobile, passport, and marketing asset buckets", () => {
  const pkg = read("package.json");
  const script = read("scripts/audit-assets.mjs");
  const provenance = read("tasks/asset-provenance.md");

  assert.match(pkg, /"audit:assets": "node scripts\/audit-assets\.mjs"/);
  assert.match(script, /src\/assets\/discover/);
  assert.match(script, /src\/assets\/gamification\/passport/);
  assert.match(script, /marketing\/website\/web-v2\/public\/images\/food/);
  assert.match(
    script,
    /IGNORED_DIRS = new Set\(\["\.git", "\.next", "build", "dist", "node_modules"\]\)/,
  );
  assert.match(script, /referencedMiB/);
  assert.match(script, /source\/licensing/);
  assert.match(script, /tasks\/asset-provenance\.md/);
  assert.match(provenance, /src\/assets\/discover/);
  assert.match(provenance, /src\/assets\/gamification\/passport/);
  assert.match(provenance, /marketing\/website\/web-v2\/public\/images\/food/);
  assert.match(provenance, /Generated with the built-in image generation workflow/);
});
