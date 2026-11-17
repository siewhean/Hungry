import assert from "node:assert/strict";
import test from "node:test";
import { dishes } from "@/lib/services/mock/data";
import { satisfiesDietaryRequirements } from "./dietaryRequirements";

test("dietary eligibility requires every selected canonical flag", () => {
  for (const dish of dishes) {
    assert.equal(
      satisfiesDietaryRequirements(dish, ["halal", "vegetarian"]),
      dish.dietaryFlags.includes("halal") && dish.dietaryFlags.includes("vegetarian"),
    );
  }
});
test("unknown dietary data cannot satisfy a requirement", () => {
  assert.equal(satisfiesDietaryRequirements(undefined, ["halal"]), false);
  assert.equal(satisfiesDietaryRequirements(undefined, []), true);
});
test("zero eligible results remains empty instead of restoring the original list", () => {
  const eligible = dishes.filter((dish) =>
    satisfiesDietaryRequirements(dish, ["halal", "vegetarian"]),
  );
  assert.ok(
    eligible.every(
      (dish) => dish.dietaryFlags.includes("halal") && dish.dietaryFlags.includes("vegetarian"),
    ),
  );
});
