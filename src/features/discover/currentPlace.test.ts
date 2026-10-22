import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogPlace } from "@/lib/services/catalog";
import { isStillInPlace } from "./currentPlace";
import { preferBuildingBites } from "./bites";
import type { Bite } from "@/lib/services/types";

const jem: CatalogPlace = {
  id: "b-jem",
  name: "JEM",
  venueCount: 40,
  latitude: 1.3331,
  longitude: 103.7437,
};

test("a place is kept while the phone stays within the leave radius, dropped beyond it", () => {
  assert.equal(isStillInPlace(jem, { latitude: 1.3331, longitude: 103.7437 }), true);
  // ~110 m north: past the 100 m enter radius but inside the 160 m leave radius.
  assert.equal(isStillInPlace(jem, { latitude: 1.3341, longitude: 103.7437 }), true);
  // ~220 m north: out.
  assert.equal(isStillInPlace(jem, { latitude: 1.3351, longitude: 103.7437 }), false);
  assert.equal(
    isStillInPlace({ ...jem, latitude: undefined }, { latitude: 1.3331, longitude: 103.7437 }),
    false,
  );
});

test("preferBuildingBites puts the current building first and keeps each group's order", () => {
  const bite = (id: string, buildingId: string) => ({ id, buildingId }) as unknown as Bite;
  const bites = [bite("a", "x"), bite("b", "jem"), bite("c", "x"), bite("d", "jem")];
  assert.deepEqual(
    preferBuildingBites(bites, "jem").map((item) => item.id),
    ["b", "d", "a", "c"],
  );
  assert.equal(preferBuildingBites(bites, undefined), bites);
});
