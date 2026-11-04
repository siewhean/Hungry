import assert from "node:assert/strict";
import test from "node:test";

import {
  TYPE_MAX_TOTAL_MS,
  TYPE_MS_PER_LETTER,
  shouldTick,
  startTypewriter,
  typingDurationMs,
  typingIntervalMs,
} from "./typewriter";

function fakeTimers() {
  let callback: (() => void) | null = null;
  let intervalMs = 0;
  let cleared = 0;
  return {
    setIntervalFn: (fn: () => void, ms: number) => {
      callback = fn;
      intervalMs = ms;
      return 1;
    },
    clearIntervalFn: () => {
      cleared += 1;
      callback = null;
    },
    tick: () => callback?.(),
    get active() {
      return callback !== null;
    },
    get intervalMs() {
      return intervalMs;
    },
    get cleared() {
      return cleared;
    },
  };
}

test("a short line types at 45 ms a letter and a long line is capped at 2.2 seconds", () => {
  assert.equal(typingIntervalMs(10), TYPE_MS_PER_LETTER);
  assert.equal(typingDurationMs("x".repeat(10)), 450);
  assert.equal(typingIntervalMs(100), TYPE_MAX_TOTAL_MS / 100);
  assert.equal(typingDurationMs("x".repeat(100)), TYPE_MAX_TOTAL_MS);
  assert.equal(typingIntervalMs(0), 0);
});

test("spaces do not tick", () => {
  assert.equal(shouldTick("a"), true);
  assert.equal(shouldTick(" "), false);
});

test("letters appear one at a time, each with a tick except spaces, and the timer stops at the end", () => {
  const timers = fakeTimers();
  const shown: string[] = [];
  let ticks = 0;
  let done = false;
  startTypewriter({
    text: "Hi you",
    instant: false,
    onProgress: (visible, finished) => {
      shown.push(visible);
      done = finished;
    },
    onTick: () => (ticks += 1),
    ...timers,
  });
  assert.equal(timers.intervalMs, TYPE_MS_PER_LETTER);
  for (let i = 0; i < 6; i += 1) timers.tick();
  assert.deepEqual(shown, ["", "H", "Hi", "Hi ", "Hi y", "Hi yo", "Hi you"]);
  assert.equal(ticks, 5);
  assert.equal(done, true);
  assert.equal(timers.active, false);
});

test("instant mode shows the whole line at once, with no timer and no ticks", () => {
  const timers = fakeTimers();
  const calls: [string, boolean][] = [];
  let ticks = 0;
  startTypewriter({
    text: "Hello",
    instant: true,
    onProgress: (visible, finished) => calls.push([visible, finished]),
    onTick: () => (ticks += 1),
    ...timers,
  });
  assert.deepEqual(calls, [["Hello", true]]);
  assert.equal(ticks, 0);
  assert.equal(timers.active, false);
});

test("an empty line is finished straight away", () => {
  const calls: [string, boolean][] = [];
  startTypewriter({
    text: "",
    instant: false,
    onProgress: (visible, finished) => calls.push([visible, finished]),
    onTick: () => undefined,
    ...fakeTimers(),
  });
  assert.deepEqual(calls, [["", true]]);
});

test("tapping finishes the line with no more ticks; cancel stops without showing more", () => {
  const timers = fakeTimers();
  const shown: string[] = [];
  let ticks = 0;
  const typewriter = startTypewriter({
    text: "Hello",
    instant: false,
    onProgress: (visible) => shown.push(visible),
    onTick: () => (ticks += 1),
    ...timers,
  });
  timers.tick();
  typewriter.finish();
  assert.equal(shown.at(-1), "Hello");
  assert.equal(ticks, 1);
  typewriter.finish();
  assert.equal(shown.filter((entry) => entry === "Hello").length, 1, "second finish does nothing");

  const second = fakeTimers();
  const progress: string[] = [];
  const cancelled = startTypewriter({
    text: "Hello",
    instant: false,
    onProgress: (visible) => progress.push(visible),
    onTick: () => undefined,
    ...second,
  });
  cancelled.cancel();
  second.tick();
  assert.deepEqual(progress, [""]);
});
