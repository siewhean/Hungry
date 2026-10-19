import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getSpinWinnerIndex, useWheelStore } from "./useWheelStore";

const repoRoot = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8");

async function startSoloWheel(spinMode: "classic" | "elimination", count: number) {
  useWheelStore.getState().reset();
  await useWheelStore.getState().createParty(spinMode, "manual");
  for (let i = 0; i < count; i += 1) {
    useWheelStore.getState().addEntry(`venue-${i}`, "building-1", `Venue ${i}`, "");
  }
}

function landedEntryId(): string {
  const { party, entries } = useWheelStore.getState();
  const active = entries.filter((e) => !e.isEliminated);
  const index = getSpinWinnerIndex(party!.spinSeed!, active.length);
  return active[index].id;
}

test("spin seed maps to a whole-number slice for n in {2, 3, 7}", async () => {
  for (const n of [2, 3, 7]) {
    for (const seed of [0, 1, 6, 7, 123456789, 2 ** 31 - 1]) {
      const index = getSpinWinnerIndex(seed, n);
      assert.ok(Number.isInteger(index), `index for seed ${seed}, n ${n} must be an integer`);
      assert.ok(index >= 0 && index < n);
    }
    await startSoloWheel("classic", n);
    useWheelStore.getState().triggerSpin();
    const { party, entries } = useWheelStore.getState();
    assert.equal(party?.status, "spinning");
    assert.ok(Number.isInteger(party?.spinSeed));
    assert.ok(entries[getSpinWinnerIndex(party!.spinSeed!, n)], "winner entry must exist");
  }
  useWheelStore.getState().reset();
});

test("classic solo spin resolves on the client and spin again starts clean", async () => {
  await startSoloWheel("classic", 3);
  useWheelStore.getState().triggerSpin();
  const winner = landedEntryId();
  useWheelStore.getState().completeSpin(winner);

  let party = useWheelStore.getState().party!;
  assert.equal(party.status, "resolved");
  assert.equal(party.winnerEntryId, winner);
  assert.equal(party.spinSeed, undefined);

  useWheelStore.getState().resetSpin();
  party = useWheelStore.getState().party!;
  assert.equal(party.status, "lobby");
  assert.equal(party.winnerEntryId, undefined);
  assert.equal(party.spinSeed, undefined);
  useWheelStore.getState().reset();
});

test("elimination solo spin drops the landed entry until one remains", async () => {
  await startSoloWheel("elimination", 3);

  useWheelStore.getState().triggerSpin();
  const first = landedEntryId();
  useWheelStore.getState().completeSpin(first);
  let state = useWheelStore.getState();
  assert.equal(state.party?.status, "lobby");
  assert.equal(state.party?.currentRound, 2);
  assert.equal(state.party?.spinSeed, undefined, "stale seed must not replay on the next spin");
  assert.equal(state.entries.find((e) => e.id === first)?.isEliminated, true);

  useWheelStore.getState().triggerSpin();
  const second = landedEntryId();
  useWheelStore.getState().completeSpin(second);
  state = useWheelStore.getState();
  const survivor = state.entries.find((e) => !e.isEliminated);
  assert.equal(state.party?.status, "resolved");
  assert.equal(state.party?.winnerEntryId, survivor?.id);
  useWheelStore.getState().reset();
});

test("spin screen resolves via completeSpin and offers a close control", () => {
  const spinScreen = read("src/app/screens/wheel/WheelSpinScreen.tsx");
  const resultModal = read("src/app/screens/wheel/WheelResultModal.tsx");

  assert.match(spinScreen, /getSpinWinnerIndex\(seed, activeEntries\.length\)/);
  assert.match(spinScreen, /completeSpin\(winnerEntry\.id\)/);
  assert.match(spinScreen, /accessibilityLabel="Close wheel"/);
  assert.match(resultModal, /resetSpin\(\);\s*navigation\.replace\("WheelSpin"/);
});
