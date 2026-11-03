import assert from "node:assert/strict";
import test from "node:test";

import { getFoodStyleOptions } from "./foodStyleOptions";

test("an unpinned popular dish offers only Add to favourites", () => {
  const { options } = getFoodStyleOptions(["satay"], "laksa");
  assert.deepEqual(
    options.map((option) => option.id),
    ["add"],
  );
});

test("a pinned popular dish can move toward the middle, and only toward the middle at the ends", () => {
  const ids = (pinned: string[], id: string) =>
    getFoodStyleOptions(pinned, id).options.map((option) => option.id);
  assert.deepEqual(ids(["a", "b", "c"], "b"), ["earlier", "later", "remove"]);
  assert.deepEqual(ids(["a", "b", "c"], "a"), ["later", "remove"]);
  assert.deepEqual(ids(["a", "b", "c"], "c"), ["earlier", "remove"]);
  assert.deepEqual(ids(["a"], "a"), ["remove"]);
});
