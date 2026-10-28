import assert from "node:assert/strict";
import test from "node:test";

import { hasTypedLine, markTypedLine, resetTypedLines } from "./typedLines";

test("a line counts as typed only after it is marked, and reset forgets them all", () => {
  resetTypedLines();
  assert.equal(hasTypedLine("taste-spicy"), false);
  markTypedLine("taste-spicy");
  assert.equal(hasTypedLine("taste-spicy"), true);
  assert.equal(hasTypedLine("taste-sweet"), false);
  resetTypedLines();
  assert.equal(hasTypedLine("taste-spicy"), false);
});
