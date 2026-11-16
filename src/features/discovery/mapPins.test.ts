import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogMapItem } from "@/lib/services/catalog";
import { groupColocatedVenues, isColocatedCluster } from "./mapPins";

const venue = (id: string, latitude: number, longitude: number): CatalogMapItem => ({
  kind: "venue",
  id,
  label: id,
  latitude,
  longitude,
  verificationStatus: "approved",
});

test("stalls on one spot become one count pin, in the place of the first", () => {
  const items = [
    venue("a", 1.3329, 103.7436),
    venue("solo", 1.3, 103.8),
    venue("b", 1.3329, 103.7436),
    venue("c", 1.33290001, 103.74360001),
  ];
  const grouped = groupColocatedVenues(items);
  assert.equal(grouped.length, 2);
  const cluster = grouped[0];
  assert.equal(cluster.kind, "cluster");
  assert.equal(cluster.kind === "cluster" ? cluster.count : 0, 3);
  assert.equal(isColocatedCluster(cluster), true);
  assert.deepEqual(grouped[1], items[1]);
});

test("single stalls and the server's own clusters pass through", () => {
  const server: CatalogMapItem = {
    kind: "cluster",
    id: "9",
    latitude: 1,
    longitude: 103,
    count: 40,
  };
  const items = [venue("a", 1.1, 103.1), venue("b", 1.2, 103.2), server];
  assert.deepEqual(groupColocatedVenues(items), items);
  assert.equal(isColocatedCluster(server), false);
});

test("menuStallsFirst puts stalls with dishes first and keeps each group's order", async () => {
  const { menuStallsFirst } = await import("./mapPins");
  const stalls = [
    { id: "a", menuCount: 0 },
    { id: "b", menuCount: 3 },
    { id: "c", menuCount: 0 },
    { id: "d", menuCount: 1 },
  ];
  assert.deepEqual(
    menuStallsFirst(stalls).map((s) => s.id),
    ["b", "d", "a", "c"],
  );
  // Nothing is dropped and the input is left alone.
  assert.equal(stalls[0].id, "a");
});
