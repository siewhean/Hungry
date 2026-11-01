import assert from "node:assert/strict";
import test from "node:test";

import { shareInFlight } from "./shareInFlight";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("identical reads that overlap share one request", async () => {
  const scope = {};
  const gate = deferred<number>();
  let started = 0;
  const start = () => {
    started += 1;
    return gate.promise;
  };
  const first = shareInFlight(scope, "same", start);
  const second = shareInFlight(scope, "same", start);
  assert.equal(started, 1, "the second read joins the first");
  gate.resolve(7);
  assert.deepEqual(await Promise.all([first, second]), [7, 7]);
});

test("different keys, and different clients, do not share", async () => {
  let started = 0;
  const start = async () => {
    started += 1;
    return started;
  };
  const scope = {};
  await Promise.all([shareInFlight(scope, "a", start), shareInFlight(scope, "b", start)]);
  assert.equal(started, 2);
  const gate = deferred<number>();
  shareInFlight({}, "a", () => gate.promise);
  shareInFlight({}, "a", () => gate.promise);
  gate.resolve(0);
});

test("with no client, every read runs on its own", async () => {
  let started = 0;
  const start = async () => (started += 1);
  await Promise.all([shareInFlight(null, "k", start), shareInFlight(undefined, "k", start)]);
  assert.equal(started, 2);
});

test("a read after the first one ends is a fresh request, not a cached answer", async () => {
  const scope = {};
  let started = 0;
  const start = async () => {
    started += 1;
    return started;
  };
  assert.equal(await shareInFlight(scope, "k", start), 1);
  assert.equal(await shareInFlight(scope, "k", start), 2);
});

test("a request that hangs is not joined for ever", async () => {
  const scope = {};
  let clock = 1_000;
  let started = 0;
  const hang = () => {
    started += 1;
    return new Promise<number>(() => undefined);
  };
  shareInFlight(scope, "k", hang, () => clock);
  shareInFlight(scope, "k", hang, () => clock + 5_000);
  assert.equal(started, 1, "still within the window: joined");
  clock += 11_000;
  shareInFlight(scope, "k", hang, () => clock);
  assert.equal(started, 2, "past the window: a new request");
});

test("a failure reaches everyone who joined, and the next read tries again", async () => {
  const scope = {};
  const gate = deferred<number>();
  const first = shareInFlight(scope, "fail", () => gate.promise);
  const second = shareInFlight(scope, "fail", () => gate.promise);
  gate.reject(new Error("down"));
  await assert.rejects(first, /down/);
  await assert.rejects(second, /down/);
  assert.equal(await shareInFlight(scope, "fail", async () => 5), 5);
});
