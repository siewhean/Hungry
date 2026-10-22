// Keeps "everything is tested" true as the app grows.
//
// Every screen, store, service, feature module, shared component and Edge Function must be
// named by at least one test. A file with no test fails here the day it is added. The
// allowlists below hold files that predate the rule: they may only shrink (an entry whose
// file now has a test, or no longer exists, fails too, so the list is deleted from, never
// added to). Behaviour, not just a mention, is held up by `npm run test:coverage`.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(path.join(repoRoot, dir))) {
    const relative = path.join(dir, name);
    if (statSync(path.join(repoRoot, relative)).isDirectory()) {
      if (name !== "node_modules") walk(relative, found);
    } else {
      found.push(relative);
    }
  }
  return found;
}

const testSources = [
  ...walk("src").filter((file) => /\.test\.tsx?$/.test(file)),
  "src/test/render/screenMatrix.ts",
  ...walk("tests/e2e").filter((file) => file.endsWith(".ts")),
]
  .map((file) => readFileSync(path.join(repoRoot, file), "utf8"))
  .join("\n");

function isMentioned(name: string): boolean {
  return new RegExp(
    `(?<![A-Za-z0-9_])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`,
  ).test(testSources);
}

function modulesIn(dirs: readonly string[], skip: readonly RegExp[] = []): string[] {
  return dirs
    .flatMap((dir) => walk(dir))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => !/\.(test|d)\.tsx?$/.test(file) && !/\.contract\.test\./.test(file))
    .filter((file) => !["index.ts", "index.tsx", "types.ts"].includes(path.basename(file)))
    .filter((file) => !skip.some((pattern) => pattern.test(file)));
}

function untested(files: readonly string[], keyOf: (file: string) => string): string[] {
  return files.filter((file) => !isMentioned(keyOf(file))).sort();
}

const moduleName = (file: string) => path.basename(file).replace(/\.tsx?$/, "");

function assertGuard(label: string, found: readonly string[], allowlist: readonly string[]) {
  const unexpected = found.filter((file) => !allowlist.includes(file));
  assert.deepEqual(
    unexpected,
    [],
    `${label}: these files have no test that names them. Add a test (a behaviour test for logic, a contract test for a screen). Do not add them to the allowlist.`,
  );
  const stale = allowlist.filter((file) => !found.includes(file));
  assert.deepEqual(
    stale,
    [],
    `${label}: these allowlisted files now have a test (or are gone). Remove them from the allowlist.`,
  );
}

// Pure artwork (SVG components, brand constants) has nothing to assert on.
const ARTWORK = [
  /^src\/components\/icons\//,
  /^src\/constants\/(brandAssets|visualAssetColors)\.ts$/,
];

const UNTESTED_SCREENS: readonly string[] = [];

const UNTESTED_MODULES: readonly string[] = [];

const UNTESTED_COMPONENTS: readonly string[] = [];

test("every screen is named by a test", () => {
  const screens = modulesIn(["src/app/screens"]);
  assert.ok(screens.length > 80, "screen discovery found too few files");
  assertGuard("screens", untested(screens, moduleName), UNTESTED_SCREENS);
});

test("every store, service, hook, feature and lib module is named by a test", () => {
  const modules = modulesIn(
    ["src/store", "src/lib", "src/features", "src/hooks", "src/utils", "src/app/navigation"],
    [...ARTWORK, /\/components\//],
  );
  assert.ok(modules.length > 150, "module discovery found too few files");
  assertGuard("modules", untested(modules, moduleName), UNTESTED_MODULES);
});

test("every shared component is named by a test", () => {
  const components = modulesIn(["src/components", "src/features"], ARTWORK).filter((file) =>
    file.endsWith(".tsx"),
  );
  assert.ok(components.length > 80, "component discovery found too few files");
  assertGuard("components", untested(components, moduleName), UNTESTED_COMPONENTS);
});

test("every Edge Function is named by a test", () => {
  const functions = readdirSync(path.join(repoRoot, "supabase/functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => `supabase/functions/${entry.name}`);
  assert.ok(functions.length >= 8);
  assertGuard(
    "edge functions",
    untested(functions, (dir) => path.basename(dir)),
    [],
  );
});

test("every Supabase smoke script is run by the local Postgres stand-in or CI", () => {
  const smokes = walk("supabase/smoke").filter((file) => file.endsWith(".sql"));
  const runners = [
    ...walk("scripts/local-pg-standin"),
    ".github/workflows/ci.yml",
    ...walk("scripts").filter((file) => /\.(sh|mjs|cjs)$/.test(file)),
  ]
    .map((file) => readFileSync(path.join(repoRoot, file), "utf8"))
    .join("\n");
  assert.ok(smokes.length > 50);
  const unrun = smokes.filter(
    (file) => !runners.includes(path.basename(file)) && !runners.includes("supabase/smoke"),
  );
  assert.deepEqual(unrun, [], "smoke scripts nothing runs");
});
