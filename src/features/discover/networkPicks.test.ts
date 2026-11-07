import assert from "node:assert/strict";
import test from "node:test";

import {
  NETWORK_BOOST_MAX,
  boostNetworkBites,
  networkPickReason,
  networkSectionTitle,
} from "@/features/discover/networkPicks";
import type { Bite, NetworkStallPick } from "@/lib/services/types";

const mei = { userId: "a", displayName: "Mei" };
const arun = { userId: "b", displayName: "Arun" };

function pick(overrides: Partial<NetworkStallPick>): NetworkStallPick {
  return { venueId: "v", source: "following", peopleCount: 1, people: [mei], ...overrides };
}

function bite(id: string, venueId: string): Bite {
  return { id, dishId: `dish-${id}`, venueId } as Bite;
}

test("section title says follows, or taste twins when every pick came from them", () => {
  assert.equal(networkSectionTitle([pick({})]), "Loved by people you follow");
  assert.equal(
    networkSectionTitle([pick({ source: "taste_twin" }), pick({ source: "following" })]),
    "Loved by people you follow",
  );
  assert.equal(
    networkSectionTitle([pick({ source: "taste_twin" })]),
    "Loved by diners with your taste",
  );
});

test("pick reason names who loved it", () => {
  assert.equal(networkPickReason(pick({})), "Mei loved this");
  assert.equal(
    networkPickReason(pick({ peopleCount: 2, people: [mei, arun] })),
    "Mei and Arun loved this",
  );
  assert.equal(
    networkPickReason(pick({ peopleCount: 2, people: [mei] })),
    "Mei and 1 other you follow loved this",
  );
  assert.equal(
    networkPickReason(pick({ peopleCount: 4, people: [mei, arun] })),
    "Mei and 3 others you follow loved this",
  );
  assert.equal(
    networkPickReason(pick({ peopleCount: 3, people: [] })),
    "3 people you follow loved this",
  );
  assert.equal(
    networkPickReason(pick({ peopleCount: 0, people: [] })),
    "Someone you follow loved this",
  );
  assert.equal(
    networkPickReason(pick({ source: "taste_twin", peopleCount: 2 })),
    "2 diners with your taste loved this",
  );
  assert.equal(
    networkPickReason(pick({ source: "taste_twin" })),
    "A diner with your taste loved this",
  );
});

test("boost lifts at most two dishes from followed picks into slots 2 and 4, dropping nothing", () => {
  const bites = ["1", "2", "3", "4", "5", "6", "7", "8"].map((id) => bite(id, `v${id}`));
  const reasons = new Map([["dish-1", "Spicy, the way you like it"]]);
  const picks = [pick({ venueId: "v6" }), pick({ venueId: "v8" }), pick({ venueId: "v7" })];
  const result = boostNetworkBites(bites, reasons, picks);
  assert.deepEqual(
    result.bites.map((item) => item.id),
    ["1", "6", "2", "7", "3", "4", "5", "8"],
  );
  assert.equal(result.bites.length, bites.length);
  assert.equal(result.reasons.get("dish-1"), "Spicy, the way you like it");
  assert.equal(result.reasons.get("dish-6"), "Mei loved this");
  assert.equal(result.reasons.get("dish-7"), "Mei loved this");
  assert.equal(result.reasons.has("dish-8"), false);
  assert.ok(NETWORK_BOOST_MAX === 2);
});

test("boost leaves a dish already near the top in place but still says who loved it", () => {
  const bites = ["1", "2", "3", "4", "5"].map((id) => bite(id, `v${id}`));
  const result = boostNetworkBites(bites, new Map(), [pick({ venueId: "v2" })]);
  assert.deepEqual(
    result.bites.map((item) => item.id),
    ["1", "2", "3", "4", "5"],
  );
  assert.equal(result.reasons.get("dish-2"), "Mei loved this");
});

test("boost ignores taste-twin picks, repeats of one stall and an empty pick list", () => {
  const bites = ["1", "2", "3", "4", "5", "6"].map((id) =>
    bite(id, id === "6" || id === "5" ? "vx" : `v${id}`),
  );
  const twins = boostNetworkBites(bites, new Map(), [
    pick({ venueId: "vx", source: "taste_twin" }),
  ]);
  assert.deepEqual(
    twins.bites.map((item) => item.id),
    ["1", "2", "3", "4", "5", "6"],
  );
  const once = boostNetworkBites(bites, new Map(), [pick({ venueId: "vx" })]);
  assert.deepEqual(
    once.bites.map((item) => item.id),
    ["1", "5", "2", "3", "4", "6"],
  );
  assert.deepEqual(boostNetworkBites(bites, new Map(), []).bites, bites);
});
