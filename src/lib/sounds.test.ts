import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { useUIStore } from "@/store/useUIStore";

import {
  playMilestoneSound,
  resetSoundThrottle,
  setAudioForTests,
  soundsAvailable,
} from "./sounds";

type Call = { kind: string; value?: unknown };
let calls: Call[] = [];

function fakeAudio() {
  return {
    createAudioPlayer: (source: number) => {
      calls.push({ kind: "create", value: source });
      return {
        play: () => calls.push({ kind: "play" }),
        seekTo: (seconds: number) => calls.push({ kind: "seek", value: seconds }),
      };
    },
    setAudioModeAsync: async (mode: unknown) => {
      calls.push({ kind: "mode", value: mode });
    },
  };
}

beforeEach(() => {
  calls = [];
  resetSoundThrottle();
  useUIStore.setState({ soundsEnabled: true });
});

test("without the audio module nothing plays and the switch is hidden", () => {
  setAudioForTests(null);
  assert.equal(soundsAvailable(), false);
  assert.equal(playMilestoneSound("tried", 10_000), false);
});

test("the Sounds switch turns every sound off", () => {
  setAudioForTests(fakeAudio() as never);
  useUIStore.setState({ soundsEnabled: false });
  assert.equal(playMilestoneSound("milestone", 10_000), false);
  assert.deepEqual(calls, []);
});

test("sounds mix with music, stay quiet on silent, and a burst plays once", () => {
  const ids = { tried: 1, milestone: 2, streak: 3 };
  setAudioForTests(fakeAudio() as never, (sound) => ids[sound]);
  assert.equal(soundsAvailable(), true);
  assert.equal(playMilestoneSound("streak", 10_000), true);
  assert.deepEqual(calls[0], {
    kind: "mode",
    value: { playsInSilentMode: false, interruptionMode: "mixWithOthers" },
  });
  assert.deepEqual(calls[1], { kind: "create", value: 3 });
  assert.deepEqual(calls[2], { kind: "play" });
  // Another moment right after is dropped; later, the same player rewinds and plays again.
  assert.equal(playMilestoneSound("streak", 10_500), false);
  assert.equal(playMilestoneSound("streak", 20_000), true);
  assert.deepEqual(calls.slice(3), [{ kind: "seek", value: 0 }, { kind: "play" }]);
});
