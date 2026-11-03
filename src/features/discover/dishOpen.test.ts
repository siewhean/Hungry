import assert from "node:assert/strict";
import test from "node:test";

import type { TasteInteractionEvent } from "@/types/domain";
import { DISH_OPEN_DEDUPE_MS, shouldRecordDishOpen } from "./dishOpen";

const NOW = 1_000_000_000_000;
const VECTOR = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

function event(
  type: TasteInteractionEvent["type"],
  dishId: string,
  ageMs: number,
): TasteInteractionEvent {
  return {
    id: `e-${type}-${dishId}-${ageMs}`,
    type,
    surface: "discover",
    dishId,
    createdAt: new Date(NOW - ageMs).toISOString(),
    userVectorBefore: VECTOR,
    userVectorAfter: VECTOR,
    applied: true,
  };
}

test("a dish opened from nowhere that records clicks is recorded by the dish page", () => {
  assert.equal(shouldRecordDishOpen([], "d1", NOW), true);
});

test("a click the list just recorded on this dish is not counted twice", () => {
  assert.equal(shouldRecordDishOpen([event("dish_result_click", "d1", 2_000)], "d1", NOW), false);
  assert.equal(shouldRecordDishOpen([event("food_button_click", "d1", 2_000)], "d1", NOW), false);
});

test("an old click, another dish, or another kind of event does not block the record", () => {
  assert.equal(
    shouldRecordDishOpen([event("dish_result_click", "d1", DISH_OPEN_DEDUPE_MS + 1)], "d1", NOW),
    true,
  );
  assert.equal(shouldRecordDishOpen([event("dish_result_click", "d2", 1_000)], "d1", NOW), true);
  assert.equal(shouldRecordDishOpen([event("saved", "d1", 1_000)], "d1", NOW), true);
});
