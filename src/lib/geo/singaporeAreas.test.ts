import assert from "node:assert/strict";
import test from "node:test";

import { getNearestSingaporeArea } from "@/lib/geo/singaporeBuildings";

test("getNearestSingaporeArea returns town labels for Singapore coordinates", () => {
  assert.equal(getNearestSingaporeArea(1.3376, 103.6974), "Pioneer");
  assert.equal(getNearestSingaporeArea(1.3404, 103.7066), "Jurong West");
  assert.equal(getNearestSingaporeArea(1.3331, 103.7437), "Jurong East");
  assert.equal(getNearestSingaporeArea(1.3526, 103.9448), "Tampines");
});
