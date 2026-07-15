import assert from "node:assert/strict";
import test from "node:test";

import { parseRedisRateLimitPipeline } from "./redisPipeline.ts";

test("accepts a complete successful Redis rate-limit pipeline", () => {
  assert.equal(parseRedisRateLimitPipeline([{ result: 3 }, { result: 1 }]), 3);
  assert.equal(parseRedisRateLimitPipeline([{ result: "4" }, { result: "0" }]), 4);
});

test("fails closed on command errors or incomplete pipeline results", () => {
  assert.throws(
    () => parseRedisRateLimitPipeline([{ error: "ERR" }, { result: false }]),
    /command error/,
  );
  assert.throws(() => parseRedisRateLimitPipeline([{ result: 1 }]), /pipeline response/);
  assert.throws(
    () => parseRedisRateLimitPipeline([{ result: undefined }, { result: 1 }]),
    /invalid INCR result/,
  );
  assert.throws(
    () => parseRedisRateLimitPipeline([{ result: 1 }, { result: false }]),
    /invalid EXPIRE result/,
  );
});

test("rejects non-positive, fractional, and unsafe counters", () => {
  for (const result of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseRedisRateLimitPipeline([{ result }, { result: 1 }]), /invalid/);
  }
});
