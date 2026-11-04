import assert from "node:assert/strict";
import test from "node:test";

import { putFavouritesFirst } from "./favouriteOrder";

const items = ["laksa", "satay", "kopi", "chendol"].map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((item) => item.id);

test("pinned dishes lead in the order they were pinned and the rest keep their order", () => {
  assert.deepEqual(ids(putFavouritesFirst(items, ["kopi", "laksa"])), [
    "kopi",
    "laksa",
    "satay",
    "chendol",
  ]);
});

test("nothing pinned changes nothing, and a pinned dish that is gone is skipped", () => {
  assert.deepEqual(ids(putFavouritesFirst(items, [])), ids(items));
  assert.deepEqual(ids(putFavouritesFirst(items, ["missing", "satay"])), [
    "satay",
    "laksa",
    "kopi",
    "chendol",
  ]);
});
