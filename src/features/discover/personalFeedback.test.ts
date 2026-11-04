import assert from "node:assert/strict";
import test from "node:test";

import type { Bite } from "@/lib/services/types";
import type { TasteVector } from "@/types/domain";
import {
  activeMutedFoodTypes,
  applyFeedbackToBites,
  applySessionShift,
  SESSION_ACTION_LIMIT,
  SESSION_SHIFT_MAX,
  SESSION_WINDOW_MS,
  sessionShift,
  shouldShowMatchPercent,
  type SessionAction,
} from "./personalFeedback";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
const MILD_FAN: TasteVector = { ...NEUTRAL, spicy: 2, sweet: 6 };
const SPICY_DISH: TasteVector = { sweet: 3, spicy: 9, sour: 5, salty: 6, rich: 4, aromatic: 7 };
const NOW = 1_000_000_000;

const lookup =
  (dishes: Record<string, { tasteVector: TasteVector; tasteConfidence?: number }>) =>
  (dishId: string) =>
    dishes[dishId];

function action(dishId: string, kind: SessionAction["kind"], ageMs = 1_000): SessionAction {
  return { dishId, kind, at: NOW - ageMs };
}

function bite(dishId: string): Bite {
  return { id: `bite-${dishId}`, dishId, dishName: dishId } as Bite;
}

test("an opened spicy dish pulls the palate toward spicy, a little", () => {
  const shift = sessionShift(
    [action("hot", "open")],
    MILD_FAN,
    lookup({ hot: { tasteVector: SPICY_DISH } }),
    NOW,
  );
  assert.ok(shift.spicy > 0 && shift.spicy < 2, `spicy shift ${shift.spicy}`);
  assert.ok(shift.sweet < 0, "a less sweet dish pulls sweet down");
});

test("a save pulls harder than an open, and a hide pushes the other way", () => {
  const dishes = lookup({ hot: { tasteVector: SPICY_DISH } });
  const opened = sessionShift([action("hot", "open")], MILD_FAN, dishes, NOW).spicy;
  const saved = sessionShift([action("hot", "save")], MILD_FAN, dishes, NOW).spicy;
  const hidden = sessionShift([action("hot", "hide")], MILD_FAN, dishes, NOW).spicy;
  assert.ok(saved > opened);
  assert.ok(hidden < 0);
});

test("the shift never passes the cap on any axis", () => {
  const many = Array.from({ length: SESSION_ACTION_LIMIT }, () => action("hot", "save"));
  const shift = sessionShift(
    many,
    { ...NEUTRAL, spicy: 0 },
    lookup({ hot: { tasteVector: { ...SPICY_DISH, spicy: 10 } } }),
    NOW,
  );
  assert.equal(shift.spicy, SESSION_SHIFT_MAX);
});

test("actions older than the session window move nothing", () => {
  const shift = sessionShift(
    [action("hot", "save", SESSION_WINDOW_MS + 1)],
    MILD_FAN,
    lookup({ hot: { tasteVector: SPICY_DISH } }),
    NOW,
  );
  assert.deepEqual(Object.values(shift), [0, 0, 0, 0, 0, 0]);
});

test("only the latest actions count", () => {
  const dishes = lookup({
    hot: { tasteVector: SPICY_DISH },
    mild: { tasteVector: { ...NEUTRAL, spicy: 1 } },
  });
  const older = Array.from({ length: SESSION_ACTION_LIMIT }, () => action("hot", "save", 5_000));
  const latest = Array.from({ length: SESSION_ACTION_LIMIT }, () => action("mild", "save", 1_000));
  const shift = sessionShift([...older, ...latest], NEUTRAL, dishes, NOW);
  assert.ok(shift.spicy < 0, "the hot saves fell outside the latest ten");
});

test("a dish without taste data, or with the placeholder vector, moves nothing", () => {
  const shift = sessionShift(
    [action("unknown", "save"), action("blank", "save")],
    MILD_FAN,
    lookup({ blank: { tasteVector: NEUTRAL } }),
    NOW,
  );
  assert.deepEqual(Object.values(shift), [0, 0, 0, 0, 0, 0]);
});

test("a low-confidence dish pulls less than a confident one", () => {
  const sure = sessionShift(
    [action("hot", "save")],
    MILD_FAN,
    lookup({ hot: { tasteVector: SPICY_DISH, tasteConfidence: 1 } }),
    NOW,
  ).spicy;
  const unsure = sessionShift(
    [action("hot", "save")],
    MILD_FAN,
    lookup({ hot: { tasteVector: SPICY_DISH, tasteConfidence: 0.3 } }),
    NOW,
  ).spicy;
  assert.ok(unsure < sure);
});

test("applySessionShift adds the shift and stays on the 0 to 10 scale", () => {
  const shifted = applySessionShift(
    { ...NEUTRAL, spicy: 9.5, sweet: 0.5 },
    { ...NEUTRAL, spicy: 2, sweet: -2, sour: 1, salty: 0, rich: 0, aromatic: 0 },
  );
  assert.equal(shifted.spicy, 10);
  assert.equal(shifted.sweet, 0);
  assert.equal(shifted.sour, 6);
});

test("hidden dishes leave the rail", () => {
  const rail = applyFeedbackToBites([bite("a"), bite("b"), bite("c")], {
    dismissedDishIds: new Set(["b"]),
    mutedFoodTypes: new Set(),
    foodTypeOf: () => undefined,
  });
  assert.deepEqual(
    rail.map((item) => item.dishId),
    ["a", "c"],
  );
});

test("a muted food type moves to the end of the rail, in order, and is not removed", () => {
  const types: Record<string, string> = { a: "laksa", b: "satay", c: "laksa", d: "satay" };
  const rail = applyFeedbackToBites([bite("a"), bite("b"), bite("c"), bite("d")], {
    dismissedDishIds: new Set(),
    mutedFoodTypes: new Set(["laksa"]),
    foodTypeOf: (dishId) => types[dishId],
  });
  assert.deepEqual(
    rail.map((item) => item.dishId),
    ["b", "d", "a", "c"],
  );
});

test("a rail with no feedback comes back in the same order", () => {
  const rail = applyFeedbackToBites([bite("a"), bite("b")], {
    dismissedDishIds: new Set(),
    mutedFoodTypes: new Set(),
    foodTypeOf: () => "laksa",
  });
  assert.deepEqual(
    rail.map((item) => item.dishId),
    ["a", "b"],
  );
});

test("activeMutedFoodTypes drops the ones that ended", () => {
  const active = activeMutedFoodTypes(
    [
      { foodType: "laksa", until: NOW - 1 },
      { foodType: "satay", until: NOW + 1 },
    ],
    NOW,
  );
  assert.deepEqual(
    active.map((item) => item.foodType),
    ["satay"],
  );
});

test("a match percentage needs a trusted profile and confident dish tags", () => {
  assert.equal(shouldShowMatchPercent({ profileTrusted: true, dishConfidence: 0.9 }), true);
  assert.equal(shouldShowMatchPercent({ profileTrusted: true, dishConfidence: 0.7 }), true);
  assert.equal(shouldShowMatchPercent({ profileTrusted: true }), true);
  assert.equal(shouldShowMatchPercent({ profileTrusted: true, dishConfidence: 0.69 }), false);
  assert.equal(shouldShowMatchPercent({ profileTrusted: false, dishConfidence: 1 }), false);
});
