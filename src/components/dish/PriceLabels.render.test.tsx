// Price source tags on cards and menus, and the halal status tag on the dish page.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { HalalStatusTag, PriceBasisTag, PriceWithBasis } from "@/components/dish/PriceLabels";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("a card price shows where it came from", async () => {
  const view = await render(
    createElement(PriceWithBasis, { dish: { price: 5.5, priceRange: "", priceBasis: "counter" } }),
  );
  const text = view.container.textContent ?? "";
  assert.match(text, /S\$5\.50/);
  assert.match(text, /Counter/);
  assert.ok(view.container.querySelector('[aria-label="Counter price, seen at the stall"]'));
});

test("a delivery-app price reads as an estimate with an amber tag", async () => {
  const view = await render(
    createElement(PriceWithBasis, { dish: { price: 6.8, priceRange: "", priceBasis: "delivery" } }),
  );
  const text = view.container.textContent ?? "";
  assert.match(text, /~S\$6\.80/);
  assert.match(text, /Delivery/);
});

test("no tag when the source is unknown or there is no price", async () => {
  const unknown = await render(
    createElement(PriceWithBasis, { dish: { price: 4, priceRange: "", priceBasis: undefined } }),
  );
  assert.equal(unknown.container.textContent, "S$4.00");
  await cleanup();
  const unpriced = await render(
    createElement(PriceWithBasis, { dish: { price: 0, priceRange: "", priceBasis: "menu" } }),
  );
  assert.equal(unpriced.container.textContent, "Price not listed");
  await cleanup();
  const empty = await render(createElement(PriceBasisTag, { basis: undefined }));
  assert.equal(empty.container.textContent, "");
});

test("the dish page tag uses the long wording", async () => {
  const view = await render(createElement(PriceBasisTag, { basis: "delivery", form: "long" }));
  assert.match(view.container.textContent ?? "", /Delivery app price/);
});

test("halal status: yes, no and not confirmed read differently", async () => {
  const yes = await render(createElement(HalalStatusTag, { status: "yes" }));
  assert.match(yes.container.textContent ?? "", /Halal/);
  assert.ok(yes.container.querySelector('[data-testid="halal-status-yes"]'));
  await cleanup();
  const no = await render(createElement(HalalStatusTag, { status: "no" }));
  assert.match(no.container.textContent ?? "", /Not halal/);
  await cleanup();
  const unknown = await render(createElement(HalalStatusTag, { status: "unknown" }));
  assert.match(unknown.container.textContent ?? "", /Halal not confirmed/);
});
