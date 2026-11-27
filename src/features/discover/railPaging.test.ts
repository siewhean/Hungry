import assert from "node:assert/strict";
import test from "node:test";

import {
  RAIL_PAGE_SIZE,
  RAIL_POOL_SIZE,
  appendRailTail,
  isNearRailEnd,
  nextRailCount,
} from "./railPaging";

const key = (item: { id: string }) => item.id;
const items = (...ids: string[]) => ids.map((id) => ({ id }));

test("a row keeps its first cards and adds the rest of its candidates in order, without repeats", () => {
  const rail = appendRailTail(items("a", "b"), items("b", "c", "a", "d"), key);
  assert.deepEqual(
    rail.map((item) => item.id),
    ["a", "b", "c", "d"],
  );
});

test("a row never holds more than its limit", () => {
  const many = Array.from({ length: 100 }, (_, index) => ({ id: `d${index}` }));
  assert.equal(appendRailTail([], many, key).length, RAIL_POOL_SIZE);
  assert.equal(appendRailTail(items("x"), many, key, 5).length, 5);
});

test("the next page shows once the diner is within a screen of the end", () => {
  assert.equal(isNearRailEnd({ offset: 0, viewportWidth: 390, contentWidth: 2000 }), false);
  assert.equal(isNearRailEnd({ offset: 1300, viewportWidth: 390, contentWidth: 2000 }), true);
  // Not measured yet: nothing to page.
  assert.equal(isNearRailEnd({ offset: 0, viewportWidth: 0, contentWidth: 0 }), false);
});

test("paging adds a page at a time and stops at the cards there are", () => {
  assert.equal(nextRailCount(6, 40), 6 + RAIL_PAGE_SIZE);
  assert.equal(nextRailCount(36, 40), 40);
  assert.equal(nextRailCount(40, 40), 40);
});

test("a first page longer than the limit is cut to the limit", () => {
  const rail = appendRailTail(["a", "b", "c", "d", "e", "f"], [], (item) => item, 5);
  assert.deepEqual(rail, ["a", "b", "c", "d", "e"]);
});
