import assert from "node:assert/strict";
import test from "node:test";

import { dishPrefillFrom } from "./dishPrefill";

test("a card with a name becomes a prefill with only the facts it has", () => {
  assert.deepEqual(
    dishPrefillFrom({
      name: "  Chicken Rice ",
      price: 4.5,
      priceRange: "$",
      venueId: "venue-1",
      venueName: "Tian Tian",
    }),
    {
      name: "Chicken Rice",
      price: 4.5,
      priceRange: "$",
      venueId: "venue-1",
      venueName: "Tian Tian",
    },
  );
});

test("a free dish keeps its zero price; empty fields are left out", () => {
  assert.deepEqual(dishPrefillFrom({ name: "Water", price: 0, venueId: "", priceRange: "" }), {
    name: "Water",
    price: 0,
  });
});

test("a photo link is kept when it is a safe image URL and dropped when it is not", () => {
  const safe = dishPrefillFrom({ name: "Laksa", imageUrl: "https://example.test/laksa.jpg" });
  assert.equal(safe?.imageUrl, "https://example.test/laksa.jpg");
  const unsafe = dishPrefillFrom({ name: "Laksa", imageUrl: "javascript:alert(1)" });
  assert.equal(unsafe?.imageUrl, undefined);
  assert.equal("imageUrl" in (unsafe ?? {}), false);
});

test("no card, or a card with no name, gives no prefill", () => {
  assert.equal(dishPrefillFrom(undefined), undefined);
  assert.equal(dishPrefillFrom({ name: "   " }), undefined);
  assert.equal(dishPrefillFrom({ price: 3 }), undefined);
});
