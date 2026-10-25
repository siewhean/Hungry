import assert from "node:assert/strict";
import test from "node:test";

import type { VenueSummary } from "@/types/domain";
import { describeMissingStalls, loadVenuesByIds, VENUE_LOOKUP_CHUNK_SIZE } from "./loadVenuesByIds";

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

test("a failed chunk rejects the whole lookup, so screens show Retry (SAVED-V1)", async () => {
  const ids = Array.from({ length: 60 }, (_, index) => `v${index}`);
  await assert.rejects(
    loadVenuesByIds(ids, async (chunk) => {
      if (chunk.length < VENUE_LOOKUP_CHUNK_SIZE) throw new Error("offline");
      return chunk.map(venue);
    }),
  );
});

test("the missing-stalls note is singular for one stall", () => {
  assert.equal(
    describeMissingStalls(1),
    "1 stall couldn't be loaded. It may have closed or left Hungry.",
  );
  assert.match(describeMissingStalls(3), /^3 stalls couldn't be loaded\. They may/);
});
