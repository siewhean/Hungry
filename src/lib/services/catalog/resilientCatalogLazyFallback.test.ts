import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("an Excel fallback that cannot load becomes the retryable unavailable error", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/lib/services/serviceProvider.ts"),
    "utf8",
  );
  const start = source.indexOf("function createLazyExcelCatalogFallback()");
  const end = source.indexOf("export function createResilientCatalogReadService(");
  const body = source.slice(start, end);

  // Release bundles stub the Excel catalog, so a failed live read must not crash the app.
  assert.ok(start > 0 && end > start);
  assert.match(body, /resolved = getExcelCatalogFallbackService\(\)/);
  assert.match(body, /throw new CatalogUnavailableError\(undefined, error\)/);
});
