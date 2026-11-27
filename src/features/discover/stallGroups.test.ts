// The Stalls tab on a collection page lists the stalls behind its dishes, once each.
import assert from "node:assert/strict";
import test from "node:test";

import { groupBitesByStall } from "@/features/discover/stallGroups";
import type { Bite } from "@/lib/services/types";

function bite(id: string, venueId: string, extra: Partial<Bite> & { distance?: number } = {}) {
  return {
    id,
    dishId: `dish-${id}`,
    dishName: `Dish ${id}`,
    venueId,
    venueName: `Stall ${venueId}`,
    buildingName: `Building ${venueId}`,
    photoUrl: "",
    ...extra,
  } as Bite & { distance?: number };
}

test("a stall with two dishes appears once, in the order its first dish appeared", () => {
  const stalls = groupBitesByStall([bite("1", "a"), bite("2", "b"), bite("3", "a")]);
  assert.deepEqual(
    stalls.map((stall) => stall.venueId),
    ["a", "b"],
  );
});

test("a stall keeps its nearest distance and the first photo any of its dishes has", () => {
  const stalls = groupBitesByStall([
    bite("1", "a", { distance: 900 }),
    bite("2", "a", { distance: 400, photoUrl: "https://example.com/a.jpg" }),
    bite("3", "a", { distance: 700, photoUrl: "https://example.com/other.jpg" }),
  ]);
  assert.equal(stalls.length, 1);
  assert.equal(stalls[0]?.distance, 400);
  assert.equal(stalls[0]?.photoUrl, "https://example.com/a.jpg");
});

test("no dishes means no stalls", () => {
  assert.deepEqual(groupBitesByStall([]), []);
});
