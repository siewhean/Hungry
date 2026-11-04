import assert from "node:assert/strict";
import test from "node:test";

import type { DishDetail } from "@/types/domain";
import { pickVisitedSheetDishes } from "./stallVisited";

const dish = (id: string, extra: Partial<DishDetail> = {}) =>
  ({ id, name: id, reviewCount: 0, rating: 0, mustOrder: false, ...extra }) as DishDetail;

test("R4-STALL-3: the visited sheet offers must-orders first, then the most reviewed", () => {
  const picked = pickVisitedSheetDishes([
    dish("plain"),
    dish("rated", { reviewCount: 10, rating: 4.1 }),
    dish("loved", { reviewCount: 10, rating: 4.8 }),
    dish("must", { mustOrder: true }),
  ]);
  assert.deepEqual(
    picked.map((entry) => entry.id),
    ["must", "loved", "rated", "plain"],
  );
});

test("R4-STALL-3: dishes already tried or reviewed are left out, and the list is capped", () => {
  const dishes = ["a", "b", "c", "d", "e", "f"].map((id) => dish(id));
  assert.deepEqual(
    pickVisitedSheetDishes(dishes, ["a", "b"]).map((entry) => entry.id),
    ["c", "d", "e", "f"],
  );
  assert.equal(pickVisitedSheetDishes(dishes).length, 4);
  assert.deepEqual(pickVisitedSheetDishes([], []), []);
});
