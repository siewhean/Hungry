import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  extractMenuFromHtml,
  parseStallList,
  vendorFromHtml,
} from "./extract_foodpanda_menus.mjs";

const SNAPSHOT = new URL(
  "../data/source_snapshots/foodpanda_pilot_20261025/newton-51-newton-food-centre.stripped.html",
  import.meta.url,
);
const html = fs.readFileSync(SNAPSHOT, "utf8");

test("vendor is read from the canonical link and ld+json", () => {
  assert.deepEqual(vendorFromHtml(html), {
    url: "https://www.foodpanda.sg/restaurant/y2ny/newton-51-newton-food-centre",
    name: "Newton 51 (Newton Food Centre)",
    code: "y2ny",
  });
});

test("Apollo state gives category, dollar prices, variations and original-size images", () => {
  const items = extractMenuFromHtml(html);
  assert.equal(items.length, 4);
  const hokkien = items[0];
  assert.equal(hokkien.category, "Mains");
  assert.equal(hokkien.item_name, "Fried Hokkien Prawn Noodle");
  assert.equal(hokkien.price_sgd, 7.5);
  assert.equal(hokkien.discounted_price_sgd, null);
  assert.equal(hokkien.price_from, true);
  assert.deepEqual(hokkien.variation_prices_sgd, [7.5, 10, 12]);
  assert.equal(hokkien.image_url, "https://foodpanda.dhmedia.io/image/fd-sg/products/4498058.jpg");
  assert.ok(items.every((i) => !i.image_url.includes("?")));
});

test("DOM tiles are the fallback and drop the resize query from image URLs", () => {
  const noState = html.replace(/<script>window\.__PROVIDER_PROPS__[\s\S]*?<\/script>/, "");
  const items = extractMenuFromHtml(noState);
  assert.equal(items.length, 4);
  assert.equal(items[1].item_name, "Fried Carrot Cake Black");
  assert.equal(items[1].price_sgd, 6);
  assert.equal(items[1].price_from, true);
  assert.equal(items[1].image_url, "https://foodpanda.dhmedia.io/image/fd-sg/products/4498059.jpg");
  assert.match(items[1].description, /shredded white radish.*chinese sausage & mushroom/);
});

test("a discounted price is kept apart from the list price", () => {
  const state = {
    initialState: {
      "RestaurantMenuCategory:1": { title: "Sets", products: [{ __ref: "P:1" }] },
      "P:1": {
        title: "Set A",
        variations: [{ __ref: "V:1" }],
        priceAttributes: { originalPrice: 10, discountedPrice: 8, displayFromTag: false },
      },
      "V:1": { price: 10 },
    },
  };
  const [item] = extractMenuFromHtml(`<script>window.x=Object.assign(a,{apollo:${JSON.stringify(state)}})</script>`);
  assert.equal(item.price_sgd, 10);
  assert.equal(item.discounted_price_sgd, 8);
  assert.equal(item.price_from, false);
});

test("stall list accepts a CSV with a URL column or bare URLs", () => {
  const csv = "F&B Name,SFA Licence,Menu URL\nStall A,LIC1,https://foodpanda.sg/restaurant/y2ny/a\nStall A again,LIC1,https://foodpanda.sg/restaurant/y2ny/a\nNo link,LIC2,\n";
  assert.deepEqual(parseStallList(csv), [
    { licence_no: "LIC1", name: "Stall A", menu_source_url: "https://foodpanda.sg/restaurant/y2ny/a" },
  ]);
  assert.deepEqual(parseStallList("https://www.foodpanda.sg/restaurant/t3ip/b\nnot a url\n"), [
    { licence_no: "t3ip", name: "t3ip", menu_source_url: "https://www.foodpanda.sg/restaurant/t3ip/b" },
  ]);
});
