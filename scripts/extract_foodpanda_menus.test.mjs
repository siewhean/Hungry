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

const PS_CAFE = fs.readFileSync(
  new URL(
    "../data/source_snapshots/foodpanda_pilot_20261025/ps-cafe-great-world.stripped.html",
    import.meta.url,
  ),
  "utf8",
);

test("large multi-category stall: every category tab count matches the parsed items", () => {
  assert.deepEqual(vendorFromHtml(PS_CAFE), {
    url: "https://www.foodpanda.sg/restaurant/y6cf/ps-cafe-great-world",
    name: "PS.Cafe (Great World)",
    code: "y6cf",
  });
  const items = extractMenuFromHtml(PS_CAFE);
  assert.equal(items.length, 43);
  const parsed = {};
  for (const i of items) parsed[i.category] = (parsed[i.category] || 0) + 1;
  // Tab labels in the page read "BRUNCH (11)", "Desserts (9)", ... (the "Popular (4)" tab repeats items).
  const tabs = {};
  for (const m of PS_CAFE.matchAll(/id="tabs__tab-\d+-label">([^<]+?) \((\d+)\)</g)) {
    if (m[1] !== "Popular") tabs[m[1].replace(/&amp;/g, "&")] = Number(m[2]);
  }
  assert.deepEqual(parsed, tabs);
  assert.equal(Object.keys(tabs).length, 9);
  assert.equal(new Set(items.map((i) => i.item_name)).size, 43);
});

test("large stall: variation ranges, missing images and descriptions are kept as-is", () => {
  const byName = Object.fromEntries(extractMenuFromHtml(PS_CAFE).map((i) => [i.item_name, i]));
  assert.equal(byName["PS. Full Breakfast"].price_sgd, 34);
  assert.equal(byName["PS. Full Breakfast"].price_from, false);
  assert.deepEqual(byName["Americano"].variation_prices_sgd, [7, 8]);
  assert.equal(byName["Americano"].price_from, true);
  assert.deepEqual(byName["Our Tea Options"].variation_prices_sgd, [7, 7.5, 8.5]);
  assert.equal(byName["Cow & Egg"].price_sgd, 31);
  assert.equal(byName["Sprite"].image_url, null);
  assert.equal(byName["Iced Peach Tea"].description, "");
  assert.ok(extractMenuFromHtml(PS_CAFE).every((i) => i.discounted_price_sgd === null && !i.sold_out));
});

test("large stall: DOM fallback skips the nameless Popular carousel tiles", () => {
  const noState = PS_CAFE.replace(/<script>window\.__PROVIDER_PROPS__[\s\S]*?<\/script>/, "");
  const items = extractMenuFromHtml(noState);
  assert.equal(items.length, 43);
  assert.ok(items.every((i) => i.price_sgd > 0));
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

const RAFFLES = fs.readFileSync(
  new URL(
    "../data/source_snapshots/foodpanda_pilot_20261025/ps-cafe-raffles-city.stripped.html",
    import.meta.url,
  ),
  "utf8",
);

test("Raffles City outlet: separate vendor from Great World, tab counts match, scheduled menu is recorded", () => {
  assert.deepEqual(vendorFromHtml(RAFFLES), {
    url: "https://www.foodpanda.sg/restaurant/y6kw/ps-cafe-raffles-city",
    name: "PS.Cafe (Raffles City)",
    code: "y6kw",
  });
  const items = extractMenuFromHtml(RAFFLES);
  assert.equal(items.length, 38);
  const parsed = {};
  for (const i of items) parsed[i.category] = (parsed[i.category] || 0) + 1;
  const tabs = {};
  for (const m of RAFFLES.matchAll(/id="tabs__tab-\d+-label">([^<]+?) \((\d+)\)</g)) {
    tabs[m[1].replace(/&amp;/g, "&")] = Number(m[2]);
  }
  assert.deepEqual(parsed, tabs);
  // The page embeds only the menu active at save time (a weekend brunch window here).
  assert.ok(items.every((i) => i.menu_id === "5132897" && i.menu_title === "Brunch (Weekends)"));
  assert.ok(items.every((i) => i.menu_description === "Available from 10am to 4pm"));
  assert.ok(items.every((i) => i.menu_hours.start === "10:00:00" && i.menu_hours.end === "15:59:59"));
  // Stall hours come from ld+json and stay separate from menu hours.
  assert.deepEqual(items[0].stall_hours, [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "11:00", closes: "21:00" },
  ]);
  assert.ok(items.every((i) => i.discounted_price_sgd === null && !i.sold_out));
  assert.equal(items.filter((i) => !i.image_url).length, 5);
  assert.ok(items.every((i) => i.image_url === null || !i.image_url.includes("?")));
});

test("DOM fallback leaves menu fields null", () => {
  const noState = RAFFLES.replace(/<script>window\.__PROVIDER_PROPS__[\s\S]*?<\/script>/, "");
  const items = extractMenuFromHtml(noState);
  assert.equal(items.length, 38);
  assert.ok(items.every((i) => i.menu_id === null && i.menu_title === null && i.menu_hours === null));
  assert.equal(items[0].stall_hours[0].opens, "11:00");
});

test("per-item menu hours: Newton and Great World carry their own menu and stall hours", () => {
  const nw = extractMenuFromHtml(html);
  assert.ok(nw.every((i) => i.menu_id === "83166" && i.menu_title === "Main Menu"));
  assert.deepEqual(nw[0].menu_hours, { start: "09:00:00", end: "22:00:00", expedition_type: "DELIVERY" });
  assert.equal(nw[0].menu_description, null);
  assert.deepEqual(nw[0].stall_hours, [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "11:00", closes: "22:00" },
  ]);
  const gw = extractMenuFromHtml(PS_CAFE);
  assert.ok(gw.every((i) => i.menu_id === "160134" && i.menu_title === "Brunch (Weekends)"));
  assert.deepEqual(gw[0].menu_hours, { start: "08:00:00", end: "16:00:00", expedition_type: "DELIVERY" });
  assert.equal(gw[0].stall_hours[0].closes, "21:00");
});

test("with several menus each product maps to the menu that holds its category; no schedule gives null", () => {
  const prod = (n) => ({ title: n, variations: [{ __ref: "V:1" }], priceAttributes: {} });
  const state = {
    initialState: {
      "RestaurantMenu:1": { id: "1", title: "Lunch", startTime: "11:00:00", endTime: "14:00:00", expeditionType: "DELIVERY", categories: [{ __ref: "RestaurantMenuCategory:1" }] },
      "RestaurantMenu:2": { id: "2", title: "Always", categories: [{ __ref: "RestaurantMenuCategory:2" }] },
      "RestaurantMenuCategory:1": { title: "Rice", products: [{ __ref: "P:1" }] },
      "RestaurantMenuCategory:2": { title: "Drinks", products: [{ __ref: "P:2" }] },
      "P:1": prod("Chicken Rice"),
      "P:2": prod("Tea"),
      "V:1": { price: 5 },
    },
  };
  const page = `<script>window.__PROVIDER_PROPS__=Object.assign({},{apollo:${JSON.stringify(state)}});</script>`;
  const [rice, tea] = extractMenuFromHtml(page);
  assert.deepEqual([rice.menu_id, rice.menu_title], ["1", "Lunch"]);
  assert.deepEqual(rice.menu_hours, { start: "11:00:00", end: "14:00:00", expedition_type: "DELIVERY" });
  assert.deepEqual([tea.menu_id, tea.menu_title, tea.menu_hours], ["2", "Always", null]);
  assert.equal(tea.stall_hours, null);
});
