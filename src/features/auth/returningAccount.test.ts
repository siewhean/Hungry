import assert from "node:assert/strict";
import test from "node:test";

import { RETURNING_ACCOUNT_MIN_AGE_MS, isReturningAccount } from "./returningAccount";

const NOW = Date.parse("2026-10-31T06:00:00Z");

test("an account made moments ago is new", () => {
  assert.equal(isReturningAccount({ createdAt: "2026-10-31T05:59:30Z" }, NOW), false);
});

test("an account older than the margin is returning", () => {
  const old = new Date(NOW - RETURNING_ACCOUNT_MIN_AGE_MS - 1000).toISOString();
  assert.equal(isReturningAccount({ createdAt: old }, NOW), true);
  assert.equal(isReturningAccount({ createdAt: "2026-03-14T00:00:00Z" }, NOW), true);
});

test("a missing or unreadable creation time is treated as new, so nobody is greeted wrongly", () => {
  assert.equal(isReturningAccount({}, NOW), false);
  assert.equal(isReturningAccount({ createdAt: "" }, NOW), false);
  assert.equal(isReturningAccount({ createdAt: "not a date" }, NOW), false);
});
