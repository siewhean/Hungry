import assert from "node:assert/strict";
import test from "node:test";

import {
  GRID_SIZE,
  RESULT_SIZE,
  SWIPE_SIZE,
  gridDishes,
  resultDishes,
  swipeDishes,
} from "./onboardingDeck";

const pool = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `d${index}` }));

test("the grid is the top twelve of the pool", () => {
  assert.deepEqual(
    gridDishes(pool(30)).map((dish) => dish.id),
    pool(GRID_SIZE).map((dish) => dish.id),
  );
  assert.equal(gridDishes(pool(5)).length, 5);
});

test("the swipe cards are dishes the grid did not show", () => {
  const cards = swipeDishes(pool(30), []);
  assert.equal(cards.length, SWIPE_SIZE);
  assert.deepEqual(
    cards.map((dish) => dish.id),
    ["d12", "d13", "d14", "d15", "d16"],
  );
});

test("a short pool refills the swipe from grid dishes the person did not heart", () => {
  const cards = swipeDishes(pool(14), ["d0", "d1"]);
  assert.deepEqual(
    cards.map((dish) => dish.id),
    ["d12", "d13", "d2", "d3", "d4"],
  );
  assert.deepEqual(swipeDishes([], []), []);
});

test("results never include a passed dish and put new dishes before hearted ones", () => {
  const dishes = resultDishes(pool(10), { liked: ["d0", "d1"], passed: ["d2"] });
  assert.equal(dishes.length, RESULT_SIZE);
  assert.deepEqual(
    dishes.map((dish) => dish.id),
    ["d3", "d4", "d5"],
  );
  const small = resultDishes(pool(3), { liked: ["d0"], passed: ["d1"] });
  assert.deepEqual(
    small.map((dish) => dish.id),
    ["d2", "d0"],
  );
});
