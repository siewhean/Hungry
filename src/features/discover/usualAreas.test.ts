import assert from "node:assert/strict";
import test from "node:test";

import { usualAreasFor } from "./usualAreas";

test("usual areas keep the diner's order and drop unknown or repeated ids", () => {
  const areas = usualAreasFor(["bishan", "no-such-area", "tampines", "bishan"]);
  assert.deepEqual(
    areas.map((area) => area.id),
    ["bishan", "tampines"],
  );
  assert.ok(areas[0]!.coordinate.latitude > 1);
});
