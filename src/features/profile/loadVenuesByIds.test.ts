import assert from "node:assert/strict";
import test from "node:test";

import type { VenueSummary } from "@/types/domain";
import { loadVenuesByIds, VENUE_LOOKUP_CHUNK_SIZE } from "./loadVenuesByIds";

const venue = (id: string) => ({ id, name: `Stall ${id}` }) as VenueSummary;

test("reads ids in chunks of at most 50, keeps id order, and counts ids with no stall", async () => {
  const ids = Array.from({ length: 120 }, (_, index) => `v${index}`);
  const calls: string[][] = [];
  const result = await loadVenuesByIds([...ids, "v0"], async (chunk) => {
    calls.push(chunk);
    return chunk
      .filter((id) => id !== "v7")
      .reverse()
      .map(venue);
  });
  assert.deepEqual(
    calls.map((chunk) => chunk.length),
    [VENUE_LOOKUP_CHUNK_SIZE, VENUE_LOOKUP_CHUNK_SIZE, 20],
  );
  assert.equal(result.venues.length, 119);
  assert.equal(result.venues[0].id, "v0");
  assert.equal(result.venues[7].id, "v8");
  assert.equal(result.missingCount, 1);
});

test("no ids makes no call", async () => {
  let called = false;
  const result = await loadVenuesByIds([], async () => {
    called = true;
    return [];
  });
  assert.equal(called, false);
  assert.deepEqual(result, { venues: [], missingCount: 0 });
});
