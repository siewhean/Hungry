import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.join(process.cwd(), "src/lib/services/excel/repositories.ts"),
  "utf8",
);
const serviceSource = readFileSync(
  path.join(process.cwd(), "src/lib/services/excel/excelService.ts"),
  "utf8",
);

test("Excel repositories preserve missing coordinates and never synthesize Singapore centroid", () => {
  assert.match(source, /function coordinateFromRecord/);
  assert.match(source, /coordinate: coordinateFromRecord\(record\)/);
  assert.doesNotMatch(source, /asNumber\(record\.latitude, 1\.3521\)/);
  assert.doesNotMatch(source, /asNumber\(record\.longitude, 103\.8198\)/);
});

test("Location-scoped dish search excludes venues with unknown coordinates", () => {
  assert.match(
    source,
    /if \(currentLocation && \(distanceMeters === undefined \|\| distanceMeters > filters\.radius\)\)/,
  );
  assert.match(serviceSource, /distanceMeters === Number\.MAX_SAFE_INTEGER\s+\? \[\]/);
});
