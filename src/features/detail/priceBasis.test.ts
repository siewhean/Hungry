import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCheckedDate,
  formatPriceWithBasis,
  halalStatusCopy,
  priceBasisCopy,
  priceBasisDetail,
  toHalalStatus,
  toPriceBasis,
} from "./priceBasis";

test("price basis reads only the three known sources", () => {
  assert.equal(toPriceBasis("counter"), "counter");
  assert.equal(toPriceBasis("menu"), "menu");
  assert.equal(toPriceBasis("delivery"), "delivery");
  assert.equal(toPriceBasis("counter_price"), undefined);
  assert.equal(toPriceBasis(null), undefined);
});

test("missing halal status is never read as not halal", () => {
  assert.equal(toHalalStatus("yes"), "yes");
  assert.equal(toHalalStatus("no"), "no");
  assert.equal(toHalalStatus("unknown"), "unknown");
  assert.equal(toHalalStatus(undefined), undefined);
  assert.equal(toHalalStatus("maybe"), undefined);
});

test("a delivery-app price reads as an estimate; counter and menu prices do not", () => {
  assert.deepEqual(formatPriceWithBasis({ price: 6.8, priceRange: "", priceBasis: "delivery" }), {
    text: "~S$6.80",
    estimated: true,
    listed: true,
  });
  assert.equal(
    formatPriceWithBasis({ price: 6.8, priceRange: "", priceBasis: "delivery" }, "long").text,
    "about S$6.80",
  );
  assert.deepEqual(formatPriceWithBasis({ price: 5.5, priceRange: "", priceBasis: "counter" }), {
    text: "S$5.50",
    estimated: false,
    listed: true,
  });
  assert.deepEqual(formatPriceWithBasis({ price: 0, priceRange: "", priceBasis: "delivery" }), {
    text: "Price not listed",
    estimated: false,
    listed: false,
  });
});

test("the checked date is a Singapore calendar date", () => {
  assert.equal(formatCheckedDate("2026-11-11T17:00:00Z"), "12 Nov 2026");
  assert.equal(formatCheckedDate("not a date"), undefined);
  assert.equal(formatCheckedDate(undefined), undefined);
});

test("dish page copy says where the price came from and when", () => {
  assert.deepEqual(
    priceBasisDetail({ priceBasis: "counter", priceCheckedAt: "2026-11-12T04:00:00Z" }),
    { title: "Counter price, checked 12 Nov 2026.", body: "This is what you pay at the stall." },
  );
  assert.match(
    priceBasisDetail({ priceBasis: "delivery", priceCheckedAt: "2026-10-03T04:00:00Z" })?.title ??
      "",
    /delivery app, seen 3 Oct 2026/,
  );
  assert.equal(priceBasisDetail({ priceBasis: undefined }), undefined);
  assert.equal(priceBasisCopy("delivery").long, "Delivery app price");
});

test("unknown halal status asks the diner to check with the stall", () => {
  assert.equal(halalStatusCopy("unknown").tag, "Halal not confirmed");
  assert.match(halalStatusCopy("unknown").body, /Ask the stall/);
  assert.equal(halalStatusCopy("yes").tag, "Halal");
  assert.equal(halalStatusCopy("no").tag, "Not halal");
});
