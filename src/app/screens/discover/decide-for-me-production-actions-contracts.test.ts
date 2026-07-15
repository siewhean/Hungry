import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/app/screens/discover/DecideForMeResultScreen.tsx"),
  "utf8",
);

test("Decide for Me does not create fake carts or draft orders", () => {
  assert.doesNotMatch(source, /useCartStore|useOrderStore|handleAddToCart/);
  assert.doesNotMatch(source, /label="Add to cart"|buttonId: "add_to_cart"/);
  assert.doesNotMatch(source, /status: "draft"/);
});

test("Decide for Me retains source-backed navigation actions", () => {
  assert.match(source, /label="View Stall Details"/);
  assert.match(source, /navigation\.navigate\("StallDetail", \{ venueId: dish\.venueId \}\)/);
  assert.match(source, /label="Try Another Pick"/);
});
