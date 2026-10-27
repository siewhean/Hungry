import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("resilient catalog service loads the Excel fallback only when it is used", () => {
  const source = readFileSync(resolve(process.cwd(), "src/lib/services/serviceProvider.ts"), "utf8");
  const start = source.indexOf("export function createResilientCatalogReadService(");
  const end = source.indexOf("export function getServiceProvider()");
  const body = source.slice(start, end);

  // Production bundles stub the Excel catalog; an eager require crashed every catalog read.
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(body, /CatalogReadService\s*=\s*getExcelCatalogFallbackService\(\)/);
  assert.match(body, /fallbackService \?\?= getExcelCatalogFallbackService\(\)/);
  assert.doesNotMatch(body, /\bfallback\.\w+\(/);
});
