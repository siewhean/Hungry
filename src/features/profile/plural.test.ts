import assert from "node:assert/strict";
import test from "node:test";

import { pluralLabel } from "./plural";

test("pluralLabel uses the singular only for exactly one", () => {
  assert.equal(pluralLabel(1, "Review"), "Review");
  assert.equal(pluralLabel(0, "Review"), "Reviews");
  assert.equal(pluralLabel(2, "Follower"), "Followers");
});

test("pluralLabel keeps the plural while loading or for a capped count", () => {
  assert.equal(pluralLabel(null, "Review"), "Reviews");
  assert.equal(pluralLabel("20+", "Review"), "Reviews");
  assert.equal(pluralLabel("–", "Follower"), "Followers");
});
