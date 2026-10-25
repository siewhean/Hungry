import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import baseline from "./screen-error-reporting-baseline.json";

const root = process.cwd();

function walk(dir: string, accept: (path: string) => boolean): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, accept);
    return accept(path) ? [relative(root, join(root, path))] : [];
  });
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("every Edge Function is served through the Sentry wrapper", () => {
  const functions = readdirSync(join(root, "supabase/functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => `supabase/functions/${entry.name}/index.ts`);
  assert.ok(functions.length > 0, "expected Edge Functions to check");

  for (const file of functions) {
    const source = read(file);
    assert.match(
      source,
      /import \{[^}]*\bserveWithSentry\b[^}]*\} from "\.\.\/_shared\/sentry\.ts"/,
      `${file} must import serveWithSentry from ../_shared/sentry.ts`,
    );
    assert.match(
      source,
      /^serveWithSentry\("[a-z0-9-]+", /m,
      `${file} must call serveWithSentry("<function-name>", handler)`,
    );
    assert.doesNotMatch(
      source,
      /\bDeno\.serve\(/,
      `${file} must not call Deno.serve directly; use serveWithSentry so errors reach Sentry`,
    );
  }
});

test("Edge Function Sentry wrapper stays inert without a DSN and scrubs events", () => {
  const wrapper = read("supabase/functions/_shared/sentry.ts");
  assert.match(wrapper, /Deno\.env\.get\("SENTRY_DSN"\)/);
  assert.match(wrapper, /if \(dsn\) \{\s*Sentry\.init/);
  assert.match(wrapper, /sendDefaultPii: false/);
  assert.match(wrapper, /beforeSend: \(event\) => scrubEvent\(event\)/);
});

test("mobile diagnostics disables default PII and automatic performance collection", () => {
  const app = read("App.tsx");
  assert.match(app, /sendDefaultPii: false/);
  assert.match(app, /enableAutoPerformanceTracing: false/);
  assert.match(app, /tracesSampleRate: 0/);
  assert.match(app, /beforeSend: \(event\) => sanitizeSentryEvent\(event\)/);
  assert.match(app, /beforeBreadcrumb: \(breadcrumb\) => sanitizeSentryBreadcrumb\(breadcrumb\)/);
});

// New screens must report the errors they catch. Screens that predate this rule are listed in
// the baseline; the list can only shrink. When you add reportError to a baselined screen,
// delete it from screen-error-reporting-baseline.json.
const screens = walk("src/app/screens", (path) => path.endsWith(".tsx"));

function isCompliant(source: string): boolean {
  return /import \{[^}]*\breportError\b[^}]*\} from "@\/lib\/monitoring\/reportError"/.test(source);
}

function hasCatch(source: string): boolean {
  return /\bcatch\b\s*(\(|\{)/.test(source);
}

test("screens that catch errors report them with reportError", () => {
  const allowed = new Set<string>(baseline.screens);
  const offenders = screens.filter(
    (file) => hasCatch(read(file)) && !isCompliant(read(file)) && !allowed.has(file),
  );
  assert.deepEqual(
    offenders,
    [],
    "These screens catch errors without reporting them. Import reportError from " +
      "@/lib/monitoring/reportError and call it in the catch block (or in a service call's " +
      "failure path) so the error reaches Sentry.",
  );
});

test("the screen error-reporting baseline only lists screens that still need it", () => {
  for (const file of baseline.screens) {
    assert.ok(screens.includes(file), `${file} no longer exists; remove it from the baseline`);
    const source = read(file);
    assert.ok(hasCatch(source), `${file} has no catch block; remove it from the baseline`);
    assert.ok(!isCompliant(source), `${file} now uses reportError; remove it from the baseline`);
  }
});

test("map rendering opts out of optional SDK telemetry", () => {
  const map = read("src/components/map/MapSurface.tsx");
  assert.match(map, /resolved.setTelemetryEnabled\(false\)/);
  assert.match(map, /attributionEnabled/);
  assert.match(map, /logoEnabled/);
});
