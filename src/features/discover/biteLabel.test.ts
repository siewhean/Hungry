import assert from "node:assert/strict";
import test from "node:test";

import { buildBiteLabel, formatBiteDistance } from "./biteLabel";

const base = {
  dishName: "Chicken Rice",
  venueName: "Tian Tian",
  price: 4.5,
  rating: 0,
  cravingCount: 0,
};

test("a dish with everything reads name, stall, price, rating and distance", () => {
  assert.equal(
    buildBiteLabel({ ...base, rating: 4.46, cravingCount: 12, distanceMeters: 350 }),
    "Chicken Rice, Tian Tian, S$4.50, rated 4.5 from 12 reviews, 350 m away",
  );
});

test("parts the dish does not have are left out", () => {
  assert.equal(buildBiteLabel({ ...base, price: 0 }), "Chicken Rice, Tian Tian");
  assert.equal(
    buildBiteLabel({ ...base, rating: 5, cravingCount: 1 }),
    "Chicken Rice, Tian Tian, S$4.50, rated 5.0 from 1 review",
  );
  assert.equal(
    buildBiteLabel({ ...base, rating: 4.5, cravingCount: 0 }),
    "Chicken Rice, Tian Tian, S$4.50",
  );
});

test("distances use metres under a kilometre and kilometres above", () => {
  assert.equal(formatBiteDistance(349.6), "350 m");
  assert.equal(formatBiteDistance(1250), "1.3 km");
  assert.equal(formatBiteDistance(0), undefined);
  assert.equal(formatBiteDistance(undefined), undefined);
  assert.equal(formatBiteDistance(Number.NaN), undefined);
});
