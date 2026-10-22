import assert from "node:assert/strict";
import test from "node:test";

import { createHelpfulVoteQueue, helpfulStateFor } from "./reviewHelpful";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const noFailure = () => assert.fail("no failure expected");

test("rapid taps send one request at a time", async () => {
  const sent: boolean[] = [];
  const gate = deferred();
  let inFlight = 0;
  let maxInFlight = 0;
  const submit = createHelpfulVoteQueue(async (_id, helpful) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    sent.push(helpful);
    if (sent.length === 1) await gate.promise;
    inFlight -= 1;
  });

  const first = submit("r1", true, false, noFailure);
  void submit("r1", false, false, noFailure);
  void submit("r1", true, false, noFailure);
  // The in-flight "true" is the only request so far; later taps only moved the wanted state.
  assert.deepEqual(sent, [true]);
  gate.resolve();
  await first;
  // The wanted state ended on true, which the server already has: no follow-up request.
  assert.deepEqual(sent, [true]);
  assert.equal(maxInFlight, 1);
});

test("a final state that differs from the confirmed one is sent after the first finishes", async () => {
  const sent: boolean[] = [];
  const gate = deferred();
  const submit = createHelpfulVoteQueue(async (_id, helpful) => {
    sent.push(helpful);
    if (sent.length === 1) await gate.promise;
  });
  const first = submit("r1", true, false, noFailure);
  void submit("r1", false, false, noFailure);
  gate.resolve();
  await first;
  assert.deepEqual(sent, [true, false]);
});

test("a failed request reports the last confirmed state", async () => {
  const submit = createHelpfulVoteQueue(async () => {
    throw new Error("offline");
  });
  let reverted: boolean | undefined;
  await submit("r1", true, false, (confirmed) => {
    reverted = confirmed;
  });
  assert.equal(reverted, false);
});

test("helpfulStateFor maps a confirmed vote onto the loaded count", () => {
  const base = { helpful: false, count: 4 };
  assert.deepEqual(helpfulStateFor(base, false), base);
  assert.deepEqual(helpfulStateFor(base, true), { helpful: true, count: 5 });
});
