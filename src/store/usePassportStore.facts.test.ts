import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { buildings, venues } from "@/lib/services/mock/data";
import { usePassportStore } from "@/store/usePassportStore";

const hawkerBuilding = buildings.find((building) => building.type === "hawker_centre");
const hawkerStall = venues.find((venue) => venue.buildingId === hawkerBuilding?.id);

beforeEach(() => usePassportStore.getState()._reset());

async function settleFacts() {
  for (let i = 0; i < 20 && usePassportStore.getState().stallFactsPending; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("a visited stall in a hawker centre earns the Hawker stamp once its facts arrive", async () => {
  assert.ok(hawkerStall, "the mock data has a stall in a hawker centre");
  const store = usePassportStore;
  store.getState().computeProgress([hawkerStall.id]);
  assert.equal(store.getState().stallFactsPending, true, "facts are being fetched");

  await settleFacts();
  const state = store.getState();
  assert.equal(state.stallFactsPending, false);
  assert.ok(hawkerStall.id in state.stallFacts);
  assert.equal(state.progressMap["cuisine-hawker"]?.triedCount, 1);
  assert.ok(state.getEarnedStamps().some((stamp) => stamp.id === "cuisine-hawker-1"));
});

test("facts are fetched once per stall, not on every recompute", async () => {
  assert.ok(hawkerStall);
  const store = usePassportStore;
  store.getState().computeProgress([hawkerStall.id]);
  await settleFacts();
  store.getState().computeProgress([hawkerStall.id]);
  assert.equal(store.getState().stallFactsPending, false, "nothing new to fetch");
});
